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
		new ButtonBuilder().setCustomId(`patreon_trial_try_without:${userID}`).setLabel('Try without it').setStyle(ButtonStyle.Secondary),
		new ButtonBuilder().setCustomId(`patreon_trial_suppress:${userID}`).setLabel("Don't remind me again").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setURL('https://www.patreon.com/c/OldSchoolCyr').setLabel("Visit Cyr's Patreon").setStyle(ButtonStyle.Link)
	];
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
	const current = (await getStoredEntitlements(userID)).filter(entitlement => entitlement.expiresAt === undefined || entitlement.expiresAt > now);
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
	const active = current.find(entitlement => entitlement.id === TRIAL_ID && entitlement.source === 'trial' && (entitlement.expiresAt ?? 0) > now);
	if (!active || !active.extensionsLeft || !active.extensionDurationMs) return { extended: false, entitlement: active ?? null };
	const updated = { ...active, expiresAt: (active.expiresAt ?? now) + active.extensionDurationMs, extensionsLeft: active.extensionsLeft - 1 };
	await saveEntitlements(userID, current.map(entitlement => entitlement.id === active.id ? updated : entitlement));
	return { extended: true, entitlement: updated };
}

export async function shouldSendPatreonReminder(userID: string, now = Date.now()) {
	const suppressed = await Cache.getSharedString(RedisKeys.PatreonReminderSuppressed(userID));
	if (suppressed) return false;
	const last = await Cache.getSharedString(RedisKeys.PatreonReminderLast(userID));
	return !last || now - Number(last) >= 7 * DAY;
}

export function migrationReminderRolls(durationMinutes: number): number {
	return Math.max(1, Math.ceil(durationMinutes / 10));
}

export function shouldRollMigrationReminder(durationMinutes: number, random = Math.random): boolean {
	return Array.from({ length: migrationReminderRolls(durationMinutes) }, () => random() < 1 / 140).some(Boolean);
}

export async function shouldSendDailyPatreonReminder(userID: string, now = Date.now()) {
	if (!(await shouldSendPatreonReminder(userID, now))) return false;
	const last = await Cache.getSharedString(RedisKeys.PatreonReminderLast(userID));
	return !last || new Date(Number(last)).toDateString() !== new Date(now).toDateString();
}

export async function markPatreonReminderSent(userID: string, now = Date.now()) {
	await Cache.setSharedString(RedisKeys.PatreonReminderLast(userID), String(now));
}

export async function suppressPatreonReminders(userID: string) {
	await Cache.setSharedString(RedisKeys.PatreonReminderSuppressed(userID), '1');
}
