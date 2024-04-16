import { Bank } from 'oldschooljs';

import { allPetIDs } from '../../data/CollectionsExport';
import { getItem } from '../../util/getOSItem';

export async function equipPet(user: MUser, itemName: string) {
	const petItem = getItem(itemName);
	if (!petItem) return "That's not a valid item.";
	const cost = new Bank().add(petItem.id);

	if (!allPetIDs.includes(petItem.id) || !user.owns(cost)) {
		return "That's not a pet, or you do not own this pet.";
	}

	const refundPet = new Bank();

	const currentlyEquippedPet = user.user.minion_equippedPet;
	if (currentlyEquippedPet) {
		refundPet.add(currentlyEquippedPet);
	}

	const tx = [
		user.updateTx({
			minion_equippedPet: petItem.id
		})
	];
	await transactItems({ userID: user.id, itemsToRemove: cost, itemsToAdd: refundPet, updates: tx });

	return `${user.minionName} takes their ${petItem.name} from their bank, and puts it down to follow them.`;
}
