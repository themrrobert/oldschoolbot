import { normalizeEntitlements, type Entitlement } from '@oldschoolgg/toolkit';
import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { RedisKeys } from '@oldschoolgg/util';
import type { Prisma } from '@/prisma/clients/robochimp/client.js';

import '@/lib/cache/redis.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const TRIAL = 14 * DAY;
const TRIAL_ID = 'trial-free';

export function patreonTrialButtons(userID: string): ButtonBuilder[] {
	return [
		new ButtonBuilder().setCustomId(`patreon_trial_extend:${userID}`).setLabel('Extend free trial').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(`patreon_trial_try_without:${userID}`).setLabel('Remind me later').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`patreon_trial_suppress:${userID}`).setLabel("Don't remind me again").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setURL('https://www.patreon.com/c/OldSchoolCyr').setLabel("Visit Cyr's Patreon").setStyle(ButtonStyle.Link)
	];
}

export function patreonExpiredOffer(userID: string, transitionTrial = false, nearingExpiry = false) {
	const duration = transitionTrial ? '18-day transition trial' : '14-day free trial';
	return {
		content: `Your previous temporary Patreon benefit is ${nearingExpiry ? 'nearing its end' : 'ended'}. Regular membership calculation will be used after expiration. You can start a ${duration} free trial with three optional one-week extensions. Patreon is optional. Use \`/tools patreon trial\` at any time.`,
		components: patreonTrialButtons(userID)
	};
}

export async function getStoredEntitlements(userID: bigint): Promise<Entitlement[]> {
	const user = await roboChimpClient.user.findUniqueOrThrow({ where: { id: userID }, select: { entitlements: true } });
	return normalizeEntitlements(user.entitlements);
}

async function saveEntitlements(userID: bigint, entitlements: Entitlement[]) {
	const saved = await roboChimpClient.user.update({ where: { id: userID }, data: { entitlements: entitlements as unknown as Prisma.InputJsonValue } });
	await Cache.getRoboChimpUser(userID.toString(), true);
	return saved;
}

export async function startFreeTrial(userID: bigint, now = Date.now()) {
	const current = (await getStoredEntitlements(userID)).filter(entitlement => entitlement.source === 'legacy-bitfield' || entitlement.expiresAt === undefined || entitlement.expiresAt > now);
	const active = current.find(entitlement => entitlement.id === TRIAL_ID && entitlement.source === 'trial');
	if (active) return { created: false, entitlement: active, extensionsLeft: active.extensionsLeft ?? 0 };
	const entitlement: Entitlement = {
		id: TRIAL_ID,
		source: 'trial',
		tier: 0,
		perkTier: 1,
		extra: [],
		issuedAt: now,
		expiresAt: now + TRIAL,
		extensionsLeft: 3,
		extensionDurationMs: WEEK
	};
	await saveEntitlements(userID, [...current, entitlement]);
	return { created: true, entitlement, extensionsLeft: 3 };
}

export async function extendFreeTrial(userID: bigint, now = Date.now()) {
	const current = await getStoredEntitlements(userID);
	const expired = current.find(entitlement =>
		(entitlement.source === 'trial' || entitlement.source === 'legacy-bitfield') &&
		(entitlement.extensionsLeft !== undefined) &&
		(entitlement.extensionDurationMs !== undefined) &&
		(entitlement.expiresAt ?? 0) <= now
	);
	if (!expired || !expired.extensionsLeft || !expired.extensionDurationMs) return { extended: false, entitlement: expired ?? null };
	const updated = { ...expired, expiresAt: now + expired.extensionDurationMs, extensionsLeft: expired.extensionsLeft - 1 };
	await saveEntitlements(userID, current.map(entitlement => entitlement.id === expired.id ? updated : entitlement));
	return { extended: true, entitlement: updated };
}

export async function shouldSendPatreonReminder(userID: string, now = Date.now()) {
	const suppressed = await Cache.getSharedString(RedisKeys.PatreonReminderSuppressed(userID));
	if (suppressed) return false;
	const last = await Cache.getSharedString(RedisKeys.PatreonReminderLast(userID));
	return !last || now - Number(last) >= 7 * DAY;
}

export async function shouldSendExpiredPatreonReminder(userID: bigint, now = Date.now()) {
	const entitlements = await getStoredEntitlements(userID);
	const expiredTransition = entitlements.find(entitlement => entitlement.source === 'legacy-bitfield' && entitlement.expiresAt !== undefined && entitlement.expiresAt <= now);
	if (!expiredTransition || !(await shouldSendPatreonReminder(userID.toString(), now))) return false;
	if ((expiredTransition.extensionsLeft ?? 0) === 0) {
		const finalSent = await Cache.getSharedString(RedisKeys.PatreonReminderFinal(userID));
		const later = await Cache.getSharedString(RedisKeys.PatreonReminderLater(userID));
		if (finalSent && !later) return false;
	}
	return true;
}

export function migrationReminderRolls(durationMinutes: number): number {
	return Math.max(1, Math.ceil(durationMinutes / 10));
}

export function shouldRollMigrationReminder(durationMinutes: number, random = Math.random): boolean {
	return Array.from({ length: migrationReminderRolls(durationMinutes) }, () => random() < 1 / 140).some(Boolean);
}

export async function shouldSendMigrationActivityReminder(userID: bigint, durationMs: number, now = Date.now()) {
	const activeMigration = (await getStoredEntitlements(userID)).some(entitlement => entitlement.source === 'legacy-bitfield' && (entitlement.expiresAt ?? 0) > now);
	return activeMigration && shouldRollMigrationReminder(durationMs / (60 * 1000)) && shouldSendDailyPatreonReminder(userID.toString(), now);
}

export async function shouldSendDailyPatreonReminder(userID: string, now = Date.now()) {
	if (await Cache.getSharedString(RedisKeys.PatreonReminderSuppressed(userID))) return false;
	const last = await Cache.getSharedString(RedisKeys.PatreonReminderLast(userID));
	return !last || new Date(Number(last)).toDateString() !== new Date(now).toDateString();
}

export async function markPatreonReminderSent(userID: string, now = Date.now()) {
	await Cache.setSharedString(RedisKeys.PatreonReminderLast(userID), String(now));
	await Cache.deleteSharedString(RedisKeys.PatreonReminderLater(userID));
	const exhausted = (await getStoredEntitlements(BigInt(userID))).some(entitlement => entitlement.source === 'legacy-bitfield' && entitlement.expiresAt !== undefined && entitlement.expiresAt <= now && entitlement.extensionsLeft === 0);
	if (exhausted) await Cache.setSharedString(RedisKeys.PatreonReminderFinal(userID), '1');
}

export async function suppressPatreonReminders(userID: string) {
	await Cache.setSharedString(RedisKeys.PatreonReminderSuppressed(userID), '1');
}

export async function remindPatreonLater(userID: string) {
	await Cache.setSharedString(RedisKeys.PatreonReminderLater(userID), '1');
}
