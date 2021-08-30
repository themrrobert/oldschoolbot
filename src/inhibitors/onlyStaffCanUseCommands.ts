import { Command, Inhibitor, KlasaMessage } from 'klasa';

import { BitField, SupportServer } from '../lib/constants';
import { getGuildSettings } from '../lib/settings/settings';
import { GuildSettings } from '../lib/settings/types/GuildSettings';
import { UserSettings } from '../lib/settings/types/UserSettings';

export default class extends Inhibitor {
	async run(msg: KlasaMessage, cmd: Command) {
		if (!msg.guild) return;
		if (msg.channel.id === '855691390339121194' && cmd.name === 'tag') {
			return;
		}
		const userBitfield = msg.author.settings.get(UserSettings.BitField);
		const isStaff = userBitfield.includes(BitField.isModerator) || userBitfield.includes(BitField.isContributor);

		// Allow contributors + moderators to use disabled channels in SupportServer
		if (msg.guild.id === SupportServer && isStaff) {
			return false;
		}

		// Allow guild-moderators to use commands in disabled channels
		const settings = await getGuildSettings(msg.guild!);
		if (settings.get(GuildSettings.StaffOnlyChannels).includes(msg.channel.id)) {
			const hasPerm = await msg.hasAtLeastPermissionLevel(6);
			if (!hasPerm) throw true;
		}
	}
}
