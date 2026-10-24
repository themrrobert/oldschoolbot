import { findGroupOfUser } from '@/lib/bso/util/findGroupOfUser.js';

import { activeEntitlements, effectivePerkTier, normalizeEntitlements, RoboChimpBit, UserError } from '@oldschoolgg/toolkit';

import { srcMUserFetch } from '@/lib/user/MUser.js';
import { markPatreonReminderSent, patreonExpiredOffer, shouldSendExpiredPatreonReminder } from '@/lib/patreonEntitlements.js';

export type Entitlement = {
	perkTier: number;
	bitfield: number;
};

export type EntitlementCheckResult = {
	success: boolean;
	authorized_user: string | null;
	entitlement: Partial<Entitlement> | null;
	expired: boolean;
	offer?: ReturnType<typeof patreonExpiredOffer>;
};

export class MissingEntitlementError extends UserError {
	public readonly entitlementCheck: EntitlementCheckResult;

	constructor(result: EntitlementCheckResult) {
		super(result.offer?.content ?? 'You do not have the required entitlement.');
		this.name = 'MissingEntitlementError';
		this.entitlementCheck = result;
	}
}

const robochimpTierBitfields: number[][] = [
	[
		RoboChimpBit.CyrTier0,
		RoboChimpBit.CyrTier1,
		RoboChimpBit.CyrTier2,
		RoboChimpBit.CyrTier3,
		RoboChimpBit.CyrTier4,
		RoboChimpBit.CyrTier5,
		RoboChimpBit.CyrTier6,
		RoboChimpBit.CyrTier7
	],
	[
		RoboChimpBit.MagnaTier1,
		RoboChimpBit.MagnaTier2,
		RoboChimpBit.MagnaTier3,
		RoboChimpBit.MagnaTier4,
		RoboChimpBit.MagnaTier5,
		RoboChimpBit.MagnaTier6
	]
];

function hasBitfieldEntitlement(ownedBitfields: number[], requiredBitfield: number) {
	const tierBitfields = robochimpTierBitfields.find(bitfields => bitfields.includes(requiredBitfield));
	const eligibleBitfields = tierBitfields
		? tierBitfields.slice(tierBitfields.indexOf(requiredBitfield))
		: [requiredBitfield];
	return eligibleBitfields.some(bitfield => ownedBitfields.includes(bitfield));
}

export async function checkEntitlements(
	user: MUser,
	entitlements: Partial<Entitlement>[],
	{ checkGroupedUsers = true, throwOnFailure = true }: { checkGroupedUsers?: boolean; throwOnFailure?: boolean } = {}
): Promise<EntitlementCheckResult> {
	const userIds = checkGroupedUsers ? await findGroupOfUser(user.id) : [user.id];
	const users = await Promise.all(userIds.map(userId => (userId === user.id ? user : srcMUserFetch(userId))));
	const needsPerkTier = entitlements.some(entitlement => entitlement.perkTier !== undefined);
	const needsBitfield = entitlements.some(entitlement => entitlement.bitfield !== undefined);

	let expired = false;
	let expiredMigration = false;
	for (const eligibleUser of users) {
		const [perkTier, robochimpUser] = await Promise.all([
			needsPerkTier ? eligibleUser.fetchPerkTier() : null,
			needsBitfield ? Cache.getRoboChimpUser(eligibleUser.id) : null
		]);
		const canonicalEntitlements = robochimpUser ? normalizeEntitlements(robochimpUser.entitlements) : [];
		const canonical = canonicalEntitlements.length > 0;
		if (canonical && canonicalEntitlements.some(value => value.expiresAt !== undefined && value.expiresAt <= Date.now())) {
			expired = true;
			expiredMigration ||= canonicalEntitlements.some(value => value.source === 'legacy-bitfield' && value.expiresAt !== undefined && value.expiresAt <= Date.now());
		}
		const canonicalTier = canonical ? effectivePerkTier(canonicalEntitlements) : perkTier;
		for (const entitlement of entitlements) {
			const hasRequirements = entitlement.perkTier !== undefined || entitlement.bitfield !== undefined;
			const matchesPerkTier = entitlement.perkTier === undefined || canonicalTier! >= entitlement.perkTier;
			const matchesBitfield =
				entitlement.bitfield === undefined || (!canonical && hasBitfieldEntitlement(robochimpUser!.bits, entitlement.bitfield));
			if (hasRequirements && matchesPerkTier && matchesBitfield) {
				const matched = canonical
					? activeEntitlements(canonicalEntitlements).find(value => entitlement.perkTier === undefined || value.perkTier >= entitlement.perkTier)
					: null;
				return {
					success: true,
					authorized_user: eligibleUser.id,
					entitlement: matched ?? { ...entitlement },
					expired: false
				};
			}
		}
	}

	const result: EntitlementCheckResult = {
		success: false,
		authorized_user: null,
		entitlement: null,
		expired,
		...(expired ? { offer: patreonExpiredOffer(user.id, expiredMigration) } : {})
	};
	if (throwOnFailure && expired && await shouldSendExpiredPatreonReminder(BigInt(user.id))) {
		await markPatreonReminderSent(user.id);
		throw new MissingEntitlementError(result);
	}
	return result;
}
