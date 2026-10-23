import { normalizeEntitlements, PerkTier, RoboChimpBit, type Entitlement } from '@oldschoolgg/toolkit';

import { initPrismaClients } from '../src/lib/prisma.js';

const DAY = 24 * 60 * 60 * 1000;
const apply = process.argv.includes('--apply');
const deploymentTime = Number(process.argv.find(value => value.startsWith('--deployment-time='))?.split('=')[1] ?? Date.now());

function highestLegacyTier(bits: number[]) {
	for (const [index, bit] of [21, 6, 5, 4, 3, 2].entries()) if (bits.includes(bit)) return index + 2;
	return 0;
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
	const users = await roboChimpClient.user.findMany({ select: { id: true, bits: true, entitlements: true } });
	const counts = new Map<string, number>();
	let missing = 0;
	let malformed = 0;
	let migrated = 0;
	for (const user of users) {
		const [bso, osb] = await Promise.all([
			bsoClient.user.findUnique({ where: { id: user.id.toString() }, select: { bitfield: true } }),
			osbClient.user.findUnique({ where: { id: user.id.toString() }, select: { bitfield: true } })
		]);
		if (!bso && !osb) { missing++; continue; }
		const raw = Array.isArray(user.entitlements) ? user.entitlements : [];
		const existing = normalizeEntitlements(raw);
		if (raw.length !== existing.length) malformed++;
		const legacyBits = [...(bso?.bitfield ?? []), ...(osb?.bitfield ?? [])];
		const tier = highestLegacyTier(legacyBits);
		const migratedEntitlements = [...existing.filter(entitlement => entitlement.source !== 'legacy-bitfield')];
		if (tier > 0) {
			migratedEntitlements.push({ id: `trial-legacy-tier-${tier - 1}`, source: 'legacy-bitfield', tier: tier - 1, perkTier: tier, extra: [], issuedAt: deploymentTime, expiresAt: deploymentTime + 18 * DAY, extensionsLeft: 3, extensionDurationMs: 7 * DAY });
			migrated++;
			counts.set('legacy-bitfield', (counts.get('legacy-bitfield') ?? 0) + 1);
		}
		for (const entitlement of courtesyEntitlements(user.bits, bso?.bitfield ?? [], osb?.bitfield ?? [], deploymentTime)) {
			if (!migratedEntitlements.some(existingEntitlement => existingEntitlement.id === entitlement.id)) migratedEntitlements.push(entitlement);
			counts.set(entitlement.id, (counts.get(entitlement.id) ?? 0) + 1);
		}
		const finalEntitlements = normalizeEntitlements(migratedEntitlements).filter(entitlement => entitlement.expiresAt === undefined || entitlement.expiresAt > deploymentTime);
		if (apply) await roboChimpClient.user.update({ where: { id: user.id }, data: { entitlements: finalEntitlements as any } });
	}
	console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', deploymentTime, users: users.length, migrated, missing, malformed, perSource: Object.fromEntries(counts) }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
