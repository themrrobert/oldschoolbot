import { PerkTier } from './misc.js';

export enum ExtraEntitlementBit { Cyr = 1 }
export type EntitlementSource = 'magna-patreon' | 'cyr-patreon' | 'magna-github' | 'gift' | 'trial' | 'legacy-bitfield' | 'other';
export type Entitlement = {
	id: string; source: EntitlementSource; tier: number; perkTier: PerkTier | number; extra: ExtraEntitlementBit[]; issuedAt: number;
	expiresAt?: number; extensionsLeft?: number; extensionDurationMs?: number;
};

const sources = new Set<EntitlementSource>(['magna-patreon', 'cyr-patreon', 'magna-github', 'gift', 'trial', 'legacy-bitfield', 'other']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

export function normalizeEntitlement(value: unknown): Entitlement | null {
	if (!isRecord(value) || typeof value.id !== 'string' || !sources.has(value.source as EntitlementSource)) return null;
	if (!isInteger(value.tier) || value.tier < 0 || !isInteger(value.perkTier) || value.perkTier < 0 || !isInteger(value.issuedAt) || value.issuedAt < 0) return null;
	if (!Array.isArray(value.extra) || value.extra.some(bit => !isInteger(bit) || bit < 0)) return null;
	if (value.expiresAt !== undefined && (!isInteger(value.expiresAt) || value.expiresAt <= value.issuedAt)) return null;
	if (value.extensionsLeft !== undefined && (!isInteger(value.extensionsLeft) || value.extensionsLeft < 0)) return null;
	if (value.extensionDurationMs !== undefined && (!isInteger(value.extensionDurationMs) || value.extensionDurationMs <= 0)) return null;
	if ((value.extensionsLeft === undefined) !== (value.extensionDurationMs === undefined)) return null;
	return { id: value.id, source: value.source as EntitlementSource, tier: value.tier, perkTier: value.perkTier, extra: [...new Set(value.extra as number[])].sort((a, b) => a - b), issuedAt: value.issuedAt, ...(value.expiresAt === undefined ? {} : { expiresAt: value.expiresAt }), ...(value.extensionsLeft === undefined ? {} : { extensionsLeft: value.extensionsLeft }), ...(value.extensionDurationMs === undefined ? {} : { extensionDurationMs: value.extensionDurationMs }) };
}

export function normalizeEntitlements(value: unknown): Entitlement[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	return value.map(normalizeEntitlement).filter((value): value is Entitlement => value !== null).filter(value => !seen.has(value.id) && seen.add(value.id)).sort((a, b) => a.id.localeCompare(b.id));
}

export function activeEntitlements(value: unknown, now = Date.now()): Entitlement[] {
	return normalizeEntitlements(value).filter(value => value.expiresAt === undefined || value.expiresAt > now);
}

export function effectivePerkTier(value: unknown, now = Date.now()): number {
	return Math.max(PerkTier.Zero, ...activeEntitlements(value, now).map(value => value.perkTier));
}

export function entitlementDisplayLabel(entitlement: Entitlement): string {
	if (entitlement.source === 'cyr-patreon') return `Cyr Tier ${entitlement.tier}`;
	if (entitlement.source === 'magna-patreon') return `Magna Tier ${entitlement.tier}`;
	if (entitlement.source === 'magna-github') return `Magna GitHub Tier ${entitlement.tier}`;
	if (entitlement.source === 'gift') return `Gifted Tier ${entitlement.tier}`;
	if (entitlement.source === 'legacy-bitfield') return '18-day transition trial';
	if (entitlement.source === 'trial') return 'Free trial';
	return entitlement.id.startsWith('courtesy-') ? `Courtesy: ${entitlement.id.slice(9).replaceAll('-', ' ')}` : `Permanent Tier ${entitlement.tier}`;
}
