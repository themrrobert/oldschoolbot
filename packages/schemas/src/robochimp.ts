import z from 'zod';

import { ZBigInt } from './shared.js';

const ZNullableBigInt = ZBigInt.nullable();
const ZEntitlement = z.object({
	id: z.string().min(1),
	source: z.enum(['magna-patreon', 'cyr-patreon', 'magna-github', 'gift', 'trial', 'legacy-bitfield', 'other']),
	tier: z.number().int().nonnegative(),
	perkTier: z.number().int().nonnegative(),
	extra: z.array(z.number().int().nonnegative().refine(value => value === 1, 'Unknown entitlement extra bit.')),
	issuedAt: z.number().int().nonnegative(),
	expiresAt: z.number().int().positive().optional(),
	extensionsLeft: z.number().int().nonnegative().optional(),
	extensionDurationMs: z.number().int().positive().optional()
}).superRefine((value, ctx) => {
	if (value.expiresAt !== undefined && value.expiresAt <= value.issuedAt) {
		ctx.addIssue({ code: 'custom', message: 'Entitlement expiry must be after issue time.' });
	}
	if ((value.extensionsLeft === undefined) !== (value.extensionDurationMs === undefined)) {
		ctx.addIssue({ code: 'custom', message: 'Trial extensions require both extension fields.' });
	}
});

export const ZRoboChimpUser = z.object({
	id: ZBigInt,
	bits: z.array(z.number().int()),
	github_id: z.number().int().nullable(),
	patreon_id: z.string().nullable(),
	cyr_patreon_id: z.string().nullable(),
	migrated_user_id: ZNullableBigInt,
	leagues_completed_tasks_ids: z.array(z.number().int()),
	leagues_points_balance_osb: z.number().int(),
	leagues_points_balance_bso: z.number().int(),
	leagues_points_total: z.number().int(),
	react_emoji_id: z.string().nullable(),
	osb_total_level: z.number().int().nullable(),
	bso_total_level: z.number().int().nullable(),
	osb_total_xp: ZNullableBigInt,
	bso_total_xp: ZNullableBigInt,
	osb_cl_percent: z.number().nullable(),
	bso_cl_percent: z.number().nullable(),
	osb_mastery: z.number().nullable(),
	bso_mastery: z.number().nullable(),
	store_bitfield: z.array(z.number().int()),
	testing_points: z.number(),
	testing_points_balance: z.number(),
	perk_tier: z.number().int(),
	entitlements: z.array(ZEntitlement),
	premium_balance_tier: z.number().int().nullable(),
	premium_balance_is_cyr: z.boolean().nullable(),
	premium_balance_expiry_date: ZNullableBigInt,
	last_patreon_gift: ZNullableBigInt,
	user_group_id: z.string().nullable()
});
export type IRoboChimpUser = z.infer<typeof ZRoboChimpUser>;
