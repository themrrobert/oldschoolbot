import { calcPercentOfNum, calcWhatPercent, noOp, objectEntries } from 'e';
import { Task } from 'klasa';
import { Bank } from 'oldschooljs';

import { Emoji, Events } from '../../../lib/constants';
import { createTOBTeam, TOBRooms, TOBUniques, totalXPFromRaid } from '../../../lib/data/tob';
import { incrementMinigameScore } from '../../../lib/settings/settings';
import { ClientSettings } from '../../../lib/settings/types/ClientSettings';
import { TheatreOfBlood } from '../../../lib/simulation/tob';
import { TheatreOfBloodTaskOptions } from '../../../lib/types/minions';
import { convertPercentChance, filterBankFromArrayOfItems, updateBankSetting } from '../../../lib/util';
import { formatOrdinal } from '../../../lib/util/formatOrdinal';
import { sendToChannelID } from '../../../lib/util/webhook';

export default class extends Task {
	async run(data: TheatreOfBloodTaskOptions) {
		const { channelID, users, hardMode, leader, wipedRoom, duration, fakeDuration } = data;
		const allUsers = await Promise.all(users.map(async u => this.client.fetchUser(u)));
		const team = await createTOBTeam({ team: allUsers, hardMode });
		console.log(JSON.stringify(team));
		const result = TheatreOfBlood.complete({
			hardMode,
			team: team.parsedTeam.map(t => ({ id: t.id, deaths: t.deaths }))
		});

		const allTag = allUsers.map(u => u.toString()).join('');

		// Add XP
		await Promise.all(
			allUsers.map(u =>
				Promise.all(
					objectEntries(totalXPFromRaid).map(val =>
						u.addXP({
							skillName: val[0],
							amount: wipedRoom
								? val[1]
								: calcPercentOfNum(calcWhatPercent(duration, fakeDuration), val[1])
						})
					)
				)
			)
		);

		// GIVE XP HERE
		// 100k tax if they wipe
		if (wipedRoom) {
			sendToChannelID(this.client, channelID, {
				content: `${allTag} Your team wiped in the Theatre of Blood, in the ${wipedRoom.name} room!`
			});
			// They each paid 100k tax, it doesn't get refunded, so track it in economy stats.
			await updateBankSetting(
				this.client,
				ClientSettings.EconomyStats.TOBCost,
				new Bank().add('Coins', users.length * 100_000)
			);
			return;
		}

		const totalLoot = new Bank();

		let resultMessage = `<@${leader}> Your ${hardMode ? 'Hard Mode Raid' : 'Raid'} has finished.

Unique chance: ${result.percentChanceOfUnique.toFixed(2)}% (1 in ${convertPercentChance(result.percentChanceOfUnique)})
Total Deaths: ${result.totalDeaths}

`;
		await Promise.all(allUsers.map(u => incrementMinigameScore(u.id, hardMode ? 'tob_hard' : 'tob', 1)));

		for (let [userID, _userLoot] of Object.entries(result.loot)) {
			const user = await this.client.fetchUser(userID).catch(noOp);
			if (!user) continue;
			const { deaths } = team.parsedTeam.find(u => u.id === user.id)!;

			const userLoot = new Bank(_userLoot);

			totalLoot.add(userLoot);

			const items = userLoot.items();

			const isPurple = items.some(([item]) => TOBUniques.includes(item.id));

			if (isPurple) {
				const itemsToAnnounce = filterBankFromArrayOfItems(TOBUniques, userLoot.bank);
				this.client.emit(
					Events.ServerNotification,
					`${Emoji.Purple} ${user.username} just received **${new Bank(
						itemsToAnnounce
					)}** on their ${formatOrdinal(await user.getMinigameScore(hardMode ? 'tob_hard' : 'tob'))} raid.`
				);
			}
			const str = isPurple ? `${Emoji.Purple} ||${userLoot}||` : userLoot.toString();
			const deathStr = deaths.length === 0 ? '' : `${Emoji.Skull}(${deaths.map(i => TOBRooms[i].name)})`;

			resultMessage += `\n${deathStr}**${user}** received: ${str}`;
			await user.addItemsToBank(userLoot.clone().add('Coins', 100_000), true);
		}

		updateBankSetting(this.client, ClientSettings.EconomyStats.TOBLoot, totalLoot.bank);

		sendToChannelID(this.client, channelID, { content: resultMessage });
	}
}
