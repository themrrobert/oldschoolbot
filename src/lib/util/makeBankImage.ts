import type { Bank } from 'oldschooljs';

import { type BankFlag, type BankImageProfile, bankImageTask } from '@/lib/canvas/bankImage.js';
import type { IconPackID } from '@/lib/canvas/iconPacks.js';
import type { Flags } from '@/lib/minions/types.js';

export interface MakeBankImageOptions {
	bank: Bank;
	content?: string;
	title?: string;
	background?: number;
	spoiler?: boolean;
	flags?: Record<string, string | number>;
	user?: MUser;
	previousCL?: Bank;
	showNewCL?: boolean;
	mahojiFlags?: BankFlag[];
	iconPackId?: IconPackID;
	profile?: BankImageProfile;
}

export async function makeBankImage({
	bank,
	title,
	background,
	user,
	previousCL,
	spoiler,
	showNewCL = false,
	flags = {},
	mahojiFlags = [],
	iconPackId,
	profile
}: MakeBankImageOptions): Promise<SendableFile> {
	const realFlags: Flags = { ...flags, background: background ?? 1, nocache: 1 };
	if (showNewCL || previousCL !== undefined) realFlags.showNewCL = 1;

	const { image } = await bankImageTask.generateBankImage({
		bank,
		title,
		showValue: true,
		flags: realFlags,
		user,
		collectionLog: previousCL,
		mahojiFlags,
		iconPackId,
		profile
	});

	return {
		name: `${spoiler ? 'SPOILER_' : ''}bank.png`,
		buffer: image
	};
}
