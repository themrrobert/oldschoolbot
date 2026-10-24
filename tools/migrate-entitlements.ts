import { normalizeEntitlements, PerkTier, RoboChimpBit, type Entitlement } from '@oldschoolgg/toolkit';

import { initPrismaClients } from '../src/lib/prisma.js';

const DAY = 24 * 60 * 60 * 1000;
const apply = process.argv.includes('--apply');
const deploymentTime = Number(process.argv.find(value => value.startsWith('--deployment-time='))?.split('=')[1] ?? Date.now());

function highestLegacyTier(bits: number[]) {
	for (const [bit, perkTier] of [[21, 7], [6, 6], [5, 5], [4, 4], [3, 3], [2, 2]] as const) {
		if (bits.includes(bit)) return perkTier;
	}
	return 0;
}

function hasPaidEntitlement(user: { bits: number[] }) {
	const paidBits = [...Array.from({ length: 6 }, (_, index) => index + 8), ...Array.from({ length: 8 }, (_, index) => index + 16)];
	return user.bits.some(bit => paidBits.includes(bit));
}

function maxPremiumExpiry(users: Array<{ premium_balance_tier?: number | null; premium_balance_expiry_date?: bigint | null }>, now: number) {
	const expiries = users.flatMap(user => user.premium_balance_tier && user.premium_balance_expiry_date && Number(user.premium_balance_expiry_date) > now ? [Number(user.premium_balance_expiry_date)] : []);
	return expiries.length > 0 ? Math.max(...expiries) : now;
}

function hasCourtesyBit(bits: number[]) {
	return [RoboChimpBit.Admin, RoboChimpBit.Moderator, RoboChimpBit.Trusted, RoboChimpBit.WikiContributor, RoboChimpBit.Contributor, RoboChimpBit.HasPermanentTierOne, RoboChimpBit.BothBotsMaxedFreeTierOnePerks].some(bit => bits.includes(bit));
}

function hasCourtesyLegacyBit(bits: number[]) {
	return [7, 8, 12, 24].some(bit => bits.includes(bit));
}

function courtesyEntitlements(bits: number[], bsoBits: number[], osbBits: number[], issuedAt: number): Entitlement[] {
	const result: Entitlement[] = [];
	const add = (id: string, perkTier: number) => result.push({ id, source: 'other', tier: perkTier - 1, perkTier, extra: [], issuedAt });
	if (bits.includes(RoboChimpBit.Admin)) add('courtesy-admin', PerkTier.Four);
	if (bits.includes(RoboChimpBit.Moderator)) add('courtesy-moderator', PerkTier.Four);
	if (bits.includes(RoboChimpBit.Contributor)) add('courtesy-contributor', PerkTier.Four);
	if (bits.includes(RoboChimpBit.WikiContributor)) add('courtesy-wiki-contributor', PerkTier.Four);
	if (bits.includes(RoboChimpBit.Trusted)) add('courtesy-trusted', PerkTier.Three);
	if (bsoBits.includes(12) || osbBits.includes(12)) add('permanent-tier-1', bsoBits.includes(12) ? PerkTier.Three : PerkTier.Two);
	if (bsoBits.includes(24) || osbBits.includes(24)) add('courtesy-both-bots-maxed', PerkTier.Two);
	return result;
}

async function main() {
	await initPrismaClients();
	const users = await roboChimpClient.user.findMany({ select: { id: true, bits: true, entitlements: true, user_group_id: true, premium_balance_expiry_date: true, premium_balance_tier: true } });
	const counts = new Map<string, number>();
	let missing = 0;
	let malformed = 0;
	let conflicting = 0;
	let migrated = 0;
	const groups = new Map<string, typeof users>();
	for (const user of users) {
		const [bso, osb] = await Promise.all([
			bsoClient.user.findUnique({ where: { id: user.id.toString() }, select: { bitfield: true } }),
			osbClient.user.findUnique({ where: { id: user.id.toString() }, select: { bitfield: true } })
		]);
		if (!bso && !osb) { missing++; continue; }
		const raw = Array.isArray(user.entitlements) ? user.entitlements : [];
		const existing = normalizeEntitlements(raw);
		if (raw.length !== existing.length) malformed++;
		if (Array.isArray(raw) && new Set(raw.map(value => typeof value === 'object' && value !== null && 'id' in value ? value.id : null)).size !== raw.length) conflicting++;
		const legacyBits = [...(bso?.bitfield ?? []), ...(osb?.bitfield ?? [])];
		const tier = highestLegacyTier(legacyBits);
		const groupKey = user.user_group_id ?? `user:${user.id.toString()}`;
		let groupUsers = groups.get(groupKey);
		if (!groupUsers) {
			groupUsers = user.user_group_id
				? await roboChimpClient.user.findMany({ where: { user_group_id: user.user_group_id }, select: { id: true, bits: true, entitlements: true, user_group_id: true, premium_balance_expiry_date: true, premium_balance_tier: true } })
				: [user];
			groups.set(groupKey, groupUsers);
		}
		const groupLegacyRows = await Promise.all(groupUsers.map(groupUser => Promise.all([
			bsoClient.user.findUnique({ where: { id: groupUser.id.toString() }, select: { bitfield: true } }),
			osbClient.user.findUnique({ where: { id: groupUser.id.toString() }, select: { bitfield: true } })
		])));
		const groupHasPaidEntitlement = groupUsers.some(groupUser => hasPaidEntitlement(groupUser));
		const groupHasCourtesyTier = groupUsers.some(groupUser => hasCourtesyBit(groupUser.bits)) || groupLegacyRows.some(([groupBso, groupOsb]) => hasCourtesyLegacyBit(groupBso?.bitfield ?? []) || hasCourtesyLegacyBit(groupOsb?.bitfield ?? []));
		const migratedEntitlements = [...existing.filter(entitlement => entitlement.source !== 'legacy-bitfield')];
		if (tier > 0 && !groupHasPaidEntitlement && !groupHasCourtesyTier) {
			const expiryBase = maxPremiumExpiry(groupUsers, deploymentTime);
			migratedEntitlements.push({ id: `trial-legacy-tier-${tier - 1}`, source: 'legacy-bitfield', tier: tier - 1, perkTier: tier, extra: [], issuedAt: deploymentTime, expiresAt: expiryBase + 18 * DAY, extensionsLeft: 3, extensionDurationMs: 7 * DAY });
			migrated++;
			counts.set('legacy-bitfield', (counts.get('legacy-bitfield') ?? 0) + 1);
		}
		for (const entitlement of courtesyEntitlements(user.bits, bso?.bitfield ?? [], osb?.bitfield ?? [], deploymentTime)) {
			if (!migratedEntitlements.some(existingEntitlement => existingEntitlement.id === entitlement.id)) migratedEntitlements.push(entitlement);
			counts.set(entitlement.id, (counts.get(entitlement.id) ?? 0) + 1);
		}
		const finalEntitlements = normalizeEntitlements(migratedEntitlements).filter(entitlement => entitlement.source === 'legacy-bitfield' || entitlement.expiresAt === undefined || entitlement.expiresAt > deploymentTime);
		if (apply) await roboChimpClient.user.update({ where: { id: user.id }, data: { entitlements: finalEntitlements as any } });
	}
	console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', deploymentTime, users: users.length, migrated, missing, malformed, conflicting, perSource: Object.fromEntries(counts) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
