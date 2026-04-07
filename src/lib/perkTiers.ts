import { BitField, PerkTier } from '@/lib/constants.js';

export async function getUsersPerkTier(user: MUser): Promise<PerkTier | 0> {
	const eligibleTiers = [];
	if (user.isMod()) {
		eligibleTiers.push(PerkTier.Four);
	}

	if (
		user.bitfield.includes(BitField.IsPatronTier1) ||
		user.bitfield.includes(BitField.HasPermanentTierOne) ||
		user.bitfield.includes(BitField.BothBotsMaxedFreeTierOnePerks)
	) {
		eligibleTiers.push(PerkTier.Two);
	} else {
		eligibleTiers.push(PerkTier.One);
	}

	const roboChimpCached = await Cache.getRoboChimpUser(user.id);
	if (roboChimpCached) {
		eligibleTiers.push(roboChimpCached.perk_tier);
	}

	const bitfield = user.bitfield;

	if (bitfield.includes(BitField.IsPatronTier6)) {
		eligibleTiers.push(PerkTier.Seven);
	}

	if (bitfield.includes(BitField.IsPatronTier5)) {
		eligibleTiers.push(PerkTier.Six);
	}

	if (bitfield.includes(BitField.IsPatronTier4)) {
		eligibleTiers.push(PerkTier.Five);
	}

	if (bitfield.includes(BitField.IsPatronTier3)) {
		eligibleTiers.push(PerkTier.Four);
	}

	if (bitfield.includes(BitField.IsPatronTier2)) {
		eligibleTiers.push(PerkTier.Three);
	}

	return Math.max(...eligibleTiers, 0);
}
