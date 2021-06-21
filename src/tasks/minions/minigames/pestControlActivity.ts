import { Task } from 'klasa';
import { canUseIntermediateLander, canUseVeteranLander } from '../../../commands/Minion/pestcontrol';

import { UserSettings } from '../../../lib/settings/types/UserSettings';
import { PestControlOptions } from '../../../lib/types/minions';
import { noOp } from '../../../lib/util';
import { sendToChannelID } from '../../../lib/util/webhook';


function calcPoints() {
	let base = 5;
	if (!canUseIntermediateLander) {
		base -=1
	}
	if (!canUseVeteranLander){
		base -=1
	}
	return Math.ceil(base);
}

export default class extends Task {
	async run({ channelID, leader, users, quantity }: PestControlOptions) {
		const leaderUser = await this.client.users.fetch(leader);
		let str = `${leaderUser}, your party finished doing ${quantity}x games of Pest Control.\n\n`;

		for (const id of users) {
			const user = await this.client.users.fetch(id).catch(noOp);
			if (!user) continue;

			let points = 0;
			for (let i = 0; i < quantity; i++) {
				points += calcPoints();
			}

			await user.settings.update(
				UserSettings.Commendation,
				user.settings.get(UserSettings.Commendation) + points
			);

			user.incrementMinigameScore('PestControl', quantity);
			str += `${user} received ${points}x commendation.`;
		}

		sendToChannelID(this.client, channelID, { content: str });
	}
}
