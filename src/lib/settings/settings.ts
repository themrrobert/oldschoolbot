import { Util } from 'discord.js';
import { Gateway, Settings } from 'klasa';
import { ItemBank } from 'oldschooljs/dist/meta/types';
import { getConnection, LessThan } from 'typeorm';

import { client } from '../..';
import { MinigameKey, Minigames } from '../../extendables/User/Minigame';
import { Emoji } from '../constants';
import { ActivityTable } from '../typeorm/ActivityTable.entity';
import { MinigameTable } from '../typeorm/MinigameTable.entity';
import { NewUserTable } from '../typeorm/NewUserTable.entity';
import { parseUsername } from '../util';

export async function getUserSettings(userID: string): Promise<Settings> {
	return (client.gateways.get('users') as Gateway)!
		.acquire({
			id: userID
		})
		.sync(true);
}

export async function syncNewUserUsername(id: string, username: string) {
	let value = await NewUserTable.findOne({ id });
	if (!value) {
		value = new NewUserTable();
		value.id = id;
		value.username = username;
		value.save();
		return;
	}
	value.username = username;
	value.save();
}

export async function batchSyncNewUserUsernames(arr: [string, string][]) {
	await getConnection()
		.createQueryBuilder()
		.insert()
		.into(NewUserTable)
		.values(arr.map(arr => ({ id: arr[0], username: parseUsername(arr[1]) })))
		.orUpdate({
			conflict_target: ['id'],
			overwrite: ['username']
		})
		.execute();
}

export async function getMinigameEntity(userID: string): Promise<MinigameTable> {
	let value = await MinigameTable.findOne({ userID });
	if (!value) {
		value = new MinigameTable();
		value.userID = userID;
		await value.save();
	}
	return value;
}

export async function incrementMinigameScore(
	userID: string,
	minigame: MinigameKey,
	amountToAdd = 1
) {
	const game = Minigames.find(m => m.key === minigame)!;
	await getConnection()
		.createQueryBuilder()
		.update(MinigameTable)
		.set({ [minigame]: () => `${game.column} + ${amountToAdd}` })
		.where('userID = :userID', { userID })
		.execute();
}

export async function getMinionName(userID: string): Promise<string> {
	const result = await client.query<{ name?: string; isIronman: boolean; icon?: string }[]>(
		`SELECT "minion.name" as name, "minion.ironman" as isIronman, "minion.icon" as icon FROM users WHERE id = $1;`,
		[userID]
	);
	if (result.length === 0) {
		throw new Error(`No user found in database for minion name.`);
	}

	const [{ name, isIronman, icon }] = result;

	const prefix = isIronman ? Emoji.Ironman : '';

	const displayIcon = icon ?? Emoji.Minion;

	return name
		? `${prefix} ${displayIcon} **${Util.escapeMarkdown(name)}**`
		: `${prefix} ${displayIcon} Your minion`;
}

export async function setActivityLoot(id: string, loot: ItemBank) {
	await getConnection()
		.createQueryBuilder()
		.update(ActivityTable)
		.set({ loot })
		.where('id = :id', { id })
		.execute();
}

export async function getActiveTasks() {
	return ActivityTable.find({
		where: {
			completed: false,
			finishDate: LessThan('now()')
		}
	});
}
