import { CommandStore, KlasaMessage } from 'klasa';
import { Item } from 'oldschooljs/dist/meta/types';

import { allPetsCL, chambersOfXericMetamorphPets } from '../../lib/data/CollectionsExport';
import { growablePets } from '../../lib/growablePets';
import { requiresMinion } from '../../lib/minions/decorators';
import { UserSettings } from '../../lib/settings/types/UserSettings';
import { BotCommand } from '../../lib/structures/BotCommand';

export const allPetIDs = [
	...allPetsCL,
	...chambersOfXericMetamorphPets,
	...growablePets.map(petSeries => petSeries.stages).flat(1)
];

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			altProtection: true,
			oneAtTime: true,
			cooldown: 1,
			usage: '(item:...item)',
			aliases: ['ep'],
			description: 'Equips a pet, like dropping it on the floor ingame.',
			examples: ['+equippet smolcano', '+ep smolcano'],
			categoryFlags: ['minion']
		});
	}

	@requiresMinion
	async run(msg: KlasaMessage, [itemArray]: [Item[]]): Promise<KlasaMessage> {
		const userBank = msg.author.bank().bank;
		const petItem = itemArray.find(i => userBank[i.id] && allPetIDs.includes(i.id));
		if (!petItem) {
			return msg.channel.send("That's not a pet, or you do not own this pet.");
		}

		const currentlyEquippedPet = msg.author.settings.get(UserSettings.Minion.EquippedPet);
		if (currentlyEquippedPet) {
			await msg.author.petUnequip();
		}

		const doubleCheckEquippedPet = msg.author.settings.get(UserSettings.Minion.EquippedPet);
		if (doubleCheckEquippedPet) {
			msg.author.log(`Aborting pet equip so we don't clobber ${doubleCheckEquippedPet}`);
			return msg.channel.send('You still have a pet equipped, cancelling.');
		}
		await msg.author.petEquip(petItem.id);

		msg.author.log(`equipping ${petItem.name}[${petItem.id}]`);

		return msg.channel.send(
			`${msg.author.minionName} takes their ${petItem.name} from their bank, and puts it down to follow them.`
		);
	}
}
