import { loot_track_type, LootTrack } from '@prisma/client';
import { Time } from 'e';
import { Bank } from 'oldschooljs';

import { prisma } from './settings/prisma';
import { ItemBank } from './types';
import { cleanString, formatDuration } from './util';
import { makeBankImage } from './util/makeBankImage';

type TrackLootOptions =
	| {
			id: string;
			type: loot_track_type;
			duration: number;
			kc: number;
			totalLoot: Bank;
			changeType: 'loot';
			users: {
				id: string;
				loot: Bank;
				duration: number;
			}[];
			suffix?: 'tame';
	  }
	| {
			id: string;
			type: loot_track_type;
			totalCost: Bank;
			changeType: 'cost';
			users: {
				id: string;
				cost: Bank;
			}[];
			suffix?: 'tame';
	  };

async function trackIndividualsLoot({
	key,
	userID,
	data,
	bankToAdd,
	duration
}: {
	duration: number;
	bankToAdd: Bank;
	key: string;
	userID: bigint | null;
	data: TrackLootOptions;
}) {
	// Find the existing loot track
	let current = await prisma.lootTrack.findFirst({
		where: {
			key,
			user_id: userID
		}
	});

	// If no existing loot track, create one.
	if (!current) {
		return prisma.lootTrack.create({
			data: {
				key,
				total_kc: data.changeType === 'loot' ? data.kc : 0,
				total_duration: duration,
				[data.changeType]: bankToAdd.bank,
				type: data.type,
				user_id: userID
			}
		});
	}
	// If there was one, update it.
	return prisma.lootTrack.updateMany({
		where: {
			id: current.id
		},
		data: {
			total_duration:
				data.changeType === 'loot'
					? {
							increment: duration
					  }
					: undefined,
			total_kc:
				data.changeType === 'loot'
					? {
							increment: data.kc
					  }
					: undefined,
			[data.changeType]: bankToAdd.clone().add(current?.[data.changeType] as ItemBank | undefined).bank,
			user_id: userID
		}
	});
}

export async function trackLoot(opts: TrackLootOptions) {
	let key = cleanString(opts.id).toLowerCase().replace(/ /g, '_');
	if (opts.suffix) {
		key = `${key}-${opts.suffix}`;
	}
	const totalBank = opts.changeType === 'cost' ? opts.totalCost : opts.totalLoot;
	if (totalBank.length === 0) return;

	let teamDuration = 0;
	if (opts.changeType === 'loot') {
		teamDuration = Math.floor((opts.duration * opts.users.length) / Time.Minute);
	}

	if (opts.users) {
		return Promise.all(
			opts.users.map(u =>
				trackIndividualsLoot({
					key,
					bankToAdd: 'cost' in u ? u.cost : u.loot,
					duration: 'duration' in opts ? opts.duration : 0,
					data: opts,
					userID: BigInt(u.id)
				})
			)
		);
	}
	return trackIndividualsLoot({ key, bankToAdd: totalBank, duration: teamDuration, data: opts, userID: null });
}

export async function getAllTrackedLootForUser(userID: string) {
	return prisma.lootTrack.findMany({
		where: {
			user_id: BigInt(userID)
		}
	});
}

export async function getDetailsOfSingleTrackedLoot(user: MUser, trackedLoot: LootTrack) {
	const [cost, loot] = await Promise.all([
		makeBankImage({ bank: new Bank(trackedLoot.cost as ItemBank), title: `Cost For ${trackedLoot.key}` }),
		makeBankImage({ bank: new Bank(trackedLoot.loot as ItemBank), title: `Loot For ${trackedLoot.key}` })
	]);
	return {
		content: `Loot/Cost from ${trackedLoot.total_kc.toLocaleString()}x ${trackedLoot.key} for ${user.rawUsername}
**Total Duration:** ${formatDuration(trackedLoot.total_duration / Time.Minute)}
**Total KC:** ${trackedLoot.total_kc}`,
		files: [cost.file, loot.file]
	};
}