import { Bank } from 'oldschooljs';

import { itemNameFromID } from '../../util';
import { logError } from '../../util/logError';

export async function unequipPet(user: MUser) {
	const equippedPet = user.user.minion_equippedPet;
	if (!equippedPet) return "You don't have a pet equipped.";

	const loot = new Bank().add(equippedPet);

	try {
		const tx = [
			user.updateTx({
				minion_equippedPet: null
			})
		];
		await user.transactItems({ itemsToAdd: loot, collectionLog: false, updates: tx });
	} catch (e) {
		logError(new Error('Failed to add pet to bank'), {
			user_id: user.id,
			pet_to_unequip: equippedPet.toString()
		});
		return 'Error removing pet, ask for help in the support server.';
	}

	return `${user.minionName} picks up their ${itemNameFromID(equippedPet)} pet and places it back in their bank.`;
}
