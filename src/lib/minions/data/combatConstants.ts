import { Consumable } from "../types";
import { Bank } from 'oldschooljs';


// Configure boost percents
export const boostCannon = 30;
export const boostCannonMulti = 50;
export const xpPercentToCannon = 50;
export const xpPercentToCannonM = 80;
export const boostIceBurst = 35;
export const boostIceBarrage = 55;

export interface CombatOptionsDesc {
	id: number,
	name: string,
	desc: string,
	aliases: string[]
}
export enum CombatOptionsEnum {
	NullOption,
	AlwaysCannon,
	AlwaysIceBurst,
	AlwaysIceBarrage
}

export const CombatOptionsArray: CombatOptionsDesc[] = [
	{
		id: CombatOptionsEnum.AlwaysCannon,
		name: 'Always Cannon',
		desc: 'Use cannon whenever possible',
		aliases: ['always cannon', 'alwayscannon', 'use cannon', 'cannon']
	},
	{
		id: CombatOptionsEnum.AlwaysIceBurst,
		name: 'Always Ice Burst',
		desc: 'Use Ice burst whenever possible',
		aliases: ['always burst', 'alwaysiceburst', 'always ice burst', 'burst', 'ice burst']
	},
	{
		id: CombatOptionsEnum.AlwaysIceBarrage,
		name: 'Always Ice Barrage',
		desc: 'Use Ice barrage whenever possible',
		aliases: ['always barrage', 'alwaysicebarrage', 'always ice barrage', 'barrage', 'ice barrage']
	}
]

export const cannonSingleConsumables : Consumable = {
	itemCost: new Bank()
		.add('Cannonball', 1),
	qtyPerMinute: 25
}
export const cannonMultiConsumables : Consumable = {
	itemCost: new Bank()
		.add('Cannonball', 1),
	qtyPerMinute: 80
}
export const iceBarrageConsumables : Consumable = {
	itemCost: new Bank()
		.add('Water rune', 6)
		.add('Blood rune', 2)
		.add('Death rune', 4),
	qtyPerMinute: 20
}
export const iceBurstConsumables : Consumable = {
	itemCost: new Bank()
		.add('Water rune', 2)
		.add('Chaos rune', 4)
		.add('Death rune', 4),
	qtyPerMinute: 20
}