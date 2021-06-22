import { CommandStore, KlasaMessage, KlasaUser } from 'klasa';

import { Activity, Emoji, Time } from '../../lib/constants';
import { minionNotBusy, requiresMinion } from '../../lib/minions/decorators';
import { UserSettings } from '../../lib/settings/types/UserSettings';
import { BotCommand } from '../../lib/structures/BotCommand';
import { MakePartyOptions } from '../../lib/types';
import { PestControlOptions } from '../../lib/types/minions';
import { formatDuration, randomVariation, stringMatches } from '../../lib/util';
import addSubTaskToActivityTask from '../../lib/util/addSubTaskToActivityTask';
import getOSItem from '../../lib/util/getOSItem';

const buyables = [
	{
		item: getOSItem('Void knight mace'),
		commendation: 250
	},
	{
		item: getOSItem('Void knight top'),
		commendation: 250
	},
	{
		item: getOSItem('Void knight robe'),
		commendation: 250
	},
	{
		item: getOSItem('Void knight gloves'),
		commendation: 150
	},
	{
		item: getOSItem('Void melee helm'),
		commendation: 200
	},
	{
		item: getOSItem('Void mage helm'),
		commendation: 200
	},
	{
		item: getOSItem('Void ranger helm'),
		commendation: 200
	}
];

function canUseNoviceLander(user: KlasaUser): boolean {
	return user.combatLevel >= 40;
}

export function canUseIntermediateLander(user: KlasaUser): boolean {
	return user.combatLevel >= 70;
}

export function canUseVeteranLander(user: KlasaUser): boolean {
	return user.combatLevel >= 100;
}

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			oneAtTime: true,
			altProtection: true,
			requiredPermissions: ['ADD_REACTIONS', 'ATTACH_FILES'],
			categoryFlags: ['minion', 'minigame'],
			description: 'Sends your minion to do the Pest Control minigame.',
			examples: ['+pestcontrol'],
			subcommands: true,
			usage: '[buy] [str:...str]',
			usageDelim: ' ',
			aliases: ['pc']
		});
	}

	@minionNotBusy
	@requiresMinion
	async run(msg: KlasaMessage, [input]: [string]) {
		const partyOptions: MakePartyOptions = {
			leader: msg.author,
			minSize: 1,
			maxSize: 25,
			ironmanAllowed: true,
			message: `${msg.author.username} is starting a Pest Control mass! Anyone can click the ${Emoji.Join} reaction to join, click it again to leave.`,
			customDenier: user => {
				if (!user.hasMinion) {
					return [true, "you don't have a minion."];
				}
				if (user.minionIsBusy) {
					return [true, 'your minion is busy.'];
				}
				if (!canUseNoviceLander) {
					return [true, "you don't have a combat level of atleast 40."];
				}

				return [false];
			}
		};

		const users =
			input === 'solo' ? [msg.author] : (await msg.makePartyAwaiter(partyOptions)).filter(u => !u.minionIsBusy);
		if (users.length === 0) {
			return;
		}

		const perDuration = randomVariation(Time.Minute * 7, 5);
		const quantity = Math.floor(msg.author.maxTripLength(Activity.SoulWars) / perDuration);
		const duration = quantity * perDuration;

		await addSubTaskToActivityTask<PestControlOptions>({
			userID: msg.author.id,
			channelID: msg.channel.id,
			quantity,
			duration,
			type: Activity.PestControl,
			leader: msg.author.id,
			users: users.map(u => u.id)
		});

		const str = `${partyOptions.leader.username}'s party (${users
			.map(u => u.username)
			.join(
				', '
			)}) is now off to do ${quantity}x games of Pest Control - the total trip will take ${formatDuration(
			duration
		)}.`;

		return msg.channel.send(str);
	}

	async buy(msg: KlasaMessage, [input = '']: [string]) {
		const item = buyables.find(i => stringMatches(input, i.item.name));
		if (!item) {
			return msg.channel.send(
				`That's not a valid item to buy from the Pest Control shop. These are the items you can buy: ${buyables
					.map(i => i.item.name)
					.join(', ')}.`
			);
		}
		const bal = msg.author.settings.get(UserSettings.Commendation);
		if (bal < item.commendation) {
			return msg.channel.send(
				`You don't have enough Commendations to buy a ${item.item.name}. You have ${bal} but need ${item.commendation}.`
			);
		}
		await msg.author.settings.update(UserSettings.Commendation, bal - item.commendation);
		await msg.author.addItemsToBank({ [item.item.id]: 1 }, true);
		return msg.channel.send(
			`Added 1x ${item.item.name} to your bank, removed ${item.commendation}x Commendations.`
		);
	}
}
