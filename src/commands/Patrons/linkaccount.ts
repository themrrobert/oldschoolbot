import { GuildMember } from 'discord.js';
import { CommandStore, KlasaMessage } from 'klasa';

import { PerkTier } from '../../lib/constants';
import { UserSettings } from '../../lib/settings/types/UserSettings';
import { BotCommand } from '../../lib/structures/BotCommand';

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			perkTier: PerkTier.Two,
			oneAtTime: true,
			cooldown: 60,
			description: 'Allows you to link your ironman account to share Patreon/Github perks.',
			usage: '[accountToLink:member]',
			examples: ['+linkaccount @Magnaboy'],
			categoryFlags: ['patron', 'minion']
		});
	}

	async run(msg: KlasaMessage, [accountToLink]: [GuildMember]) {
		if (!accountToLink) {
			return msg.channel.send('You must specify a target account to link.');
		}
		const preLinkedAccount = msg.author.settings.get(UserSettings.PerksLinkedAccount);
		if (preLinkedAccount) {
			return msg.channel.send('You cannot change your linked account once set.');
		}
		const klasaUserToLink = await this.client.users.fetch(accountToLink.user.id);
		if (!klasaUserToLink) {
			return msg.channel.send(`Unable to fetch user with id ${accountToLink.user.id}`);
		}
		if (!msg.author.isIronman && !klasaUserToLink.isIronman) {
			return msg.channel.send('You can only link a main and an ironman.');
		}
		const otherLinkedAccount = klasaUserToLink.settings.get(UserSettings.PerksLinkedAccount);
		if (otherLinkedAccount) {
			return msg.channel.send('Target account is already linked!');
		}

		const accountToLinkFullName = `${accountToLink.user.username}#${accountToLink.user.discriminator}`;
		await msg.channel.send(
			`Are you sure you want to link your Patreon perks with account: ${accountToLinkFullName}?\n` +
				'**This action cannot be undone**.\n\nType `confirm account link` to confirm.'
		);

		try {
			await msg.channel.awaitMessages({
				max: 1,
				time: 15_000,
				errors: ['time'],
				filter: answer => answer.author.id === msg.author.id && answer.content === 'confirm account link'
			});
			msg.author.log(`attempting to link patreon perks to ${accountToLinkFullName}...`);

			// Confirm the other account.
			const accountToLinkConfirmMsg = await msg.channel.send(
				`${accountToLink}, do you confirm that both of these accounts are yours, one is an ironman, ` +
					`and you wish to share your perks with \`${msg.author.username}#${msg.author.discriminator}\`?\n` +
					'**This action cannot be undone.** Type `confirm account link` to confirm'
			);

			// Await confirmation:
			try {
				await msg.channel.awaitMessages({
					max: 1,
					time: 20_000,
					errors: ['time'],
					filter: _msg =>
						_msg.author.id === accountToLink.user.id &&
						_msg.content.toLowerCase() === 'confirm account link'
				});
			} catch (err) {
				accountToLinkConfirmMsg.edit('Cancelling account link.');
				return msg.channel.send('Cancelling account link.');
			}

			// Now actually link the accounts:
			await msg.author.settings.update(UserSettings.PerksLinkedAccount, klasaUserToLink.id);
			await klasaUserToLink.settings.update(UserSettings.PerksLinkedAccount, msg.author.id);
			msg.author.log(`Successfully linked ${msg.author} and ${klasaUserToLink}`);
			return msg.channel.send(`Successfully linked ${msg.author} and ${klasaUserToLink}`);
		} catch (_) {
			return msg.channel.send('Cancelled account linkage.');
		}
	}
}
