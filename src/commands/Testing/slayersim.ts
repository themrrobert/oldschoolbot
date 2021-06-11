import { calcWhatPercent, increaseNumByPercent, reduceNumByPercent, round } from 'e';
import { CommandStore, KlasaMessage, KlasaUser } from 'klasa';
import { Time } from '../../lib/constants';
import { bossTasks } from '../../lib/slayer/tasks/bossTasks';
import { table } from 'table';
import killableMonsters from '../../lib/minions/data/killableMonsters';
import { minionNotBusy, requiresMinion } from '../../lib/minions/decorators';
import { AttackStyles, resolveAttackStyles } from '../../lib/minions/functions';
import calculateMonsterFood from '../../lib/minions/functions/calculateMonsterFood';
import reducedTimeFromKC from '../../lib/minions/functions/reducedTimeFromKC';
import { userCanUseTask, weightedPick} from '../../lib/slayer/slayerUtil';
import { BotCommand } from '../../lib/structures/BotCommand';
import {
	addArrayOfNumbers
} from '../../lib/util';
import {slayerMasters} from "../../lib/slayer/slayerMasters";
import {boostCannon, boostCannonMulti, boostIceBarrage, boostIceBurst} from "../../lib/minions/data/combatConstants";

function applySkillBoost(
	user: KlasaUser,
	duration: number,
	styles: AttackStyles[]
): [number, string] {
	const skillTotal = addArrayOfNumbers(styles.map(s => user.skillLevel(s)));

	let newDuration = duration;
	let str = '';
	let percent = round(calcWhatPercent(skillTotal, styles.length * 99), 2);

	if (percent < 50) {
		percent = 50 - percent;
		newDuration = increaseNumByPercent(newDuration, percent);
		str = `-${percent.toFixed(2)}% for low stats`;
	} else {
		percent = Math.min(15, percent / 6.5);
		newDuration = reduceNumByPercent(newDuration, percent);
		str = `${percent.toFixed(2)}% for stats`;
	}

	return [newDuration, str];
}

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			altProtection: true,
			oneAtTime: true,
			cooldown: 1,
			usage: '[option:...string]',
			usageDelim: ' ',
			description: 'Sends your minion to kill monsters.'
		});
	}

	@requiresMinion
	@minionNotBusy
	async run(msg: KlasaMessage, [option = '']: [null | number | string, string]) {

		// Start sim code
		const simTable: string[][] = [];
		simTable.push(['Master', 'Monster', 'Food/hr', 'Sharks/hr', 'Kills/hr', 'SlayerXP/hr','Cannon','MCannon','Burst','Barrage', 'Boost MSG']);

		slayerMasters.forEach(master => {
			master.tasks.forEach(task => {
				task.monsters.forEach(tmon =>
				{
					const [, osjsMon, attackStyles] = resolveAttackStyles(msg.author, tmon);
					const kMonster = killableMonsters.find(km => {
						return km.id === tmon;
					});
					let [killTime, percentReduced] = reducedTimeFromKC(
						kMonster!,
						10000
					);
					const [newDuration, boostMsg] = applySkillBoost(msg.author, killTime, attackStyles);
					const mSlayerXP = osjsMon?.data?.hitpoints ?
						osjsMon!.data!.slayerXP ?
							osjsMon!.data!.slayerXP :
							osjsMon!.data!.hitpoints
						: 0;
					// add boosts
					let cannonXP = '';
					let cannonMXP = '';
					let barrageXP = '';
					let burstXP = '';
					if (kMonster.canCannon) {
						if (kMonster.cannonMulti) {
							const tmpNewDuration = newDuration (boostCannonMulti/100);
							const killsPerHour = Time.Hour / tmpNewDuration;
							cannonMXP = (killsPerHour * mSlayerXP).toLocaleString();
						} else {
							const tmpNewDuration = newDuration * (boostCannon/100);
							const killsPerHour = Time.Hour / tmpNewDuration;
							cannonXP = (killsPerHour * mSlayerXP).toLocaleString();
						}
					}
					if (kMonster.canBarrage) {
						const tmpBarrageDuration = newDuration * (boostIceBarrage/100);
						const killsPerHour = Time.Hour / tmpBarrageDuration;
						barrageXP = (killsPerHour * mSlayerXP).toLocaleString();
						const tmpBurstDuration = newDuration * (boostIceBurst/100);
						const killsPerHourBurst = Time.Hour / tmpBurstDuration;
						burstXP = (killsPerHourBurst * mSlayerXP).toLocaleString();

					}

					const killsPerHour = Time.Hour / newDuration;
					let slayerXpPerHour = 'NA';
					slayerXpPerHour = (killsPerHour * mSlayerXP).toLocaleString();


					const foodPerHour = calculateMonsterFood(kMonster!, msg.author)[0] * killsPerHour;
					simTable.push([master!.name, kMonster!.name, Math.round(foodPerHour).toLocaleString(),
						Math.ceil(foodPerHour / 20).toLocaleString(), Math.floor(killsPerHour).toString(),
						slayerXpPerHour, cannonXP, cannonMXP, burstXP, barrageXP, `${percentReduced}% for KC, ${boostMsg}`]);
				});
			});
		});

		return msg.channel.sendFile(Buffer.from(table(simTable)), `slayerMonsterSim.txt`);

/*
		// Check requirements
		const [hasReqs, reason] = msg.author.hasMonsterRequirements(monster);
		if (!hasReqs) throw reason;

		if (monster.pohBoosts) {
			const [boostPercent, messages] = calcPOHBoosts(
				await msg.author.getPOH(),
				monster.pohBoosts
			);
			if (boostPercent > 0) {
				timeToFinish = reduceNumByPercent(timeToFinish, boostPercent);
				boosts.push(messages.join(' + '));
			}
		}

		for (const [itemID, boostAmount] of Object.entries(
			msg.author.resolveAvailableItemBoosts(monster)
		)) {
			timeToFinish *= (100 - boostAmount) / 100;
			boosts.push(`${boostAmount}% for ${itemNameFromID(parseInt(itemID))}`);
		}

		// Removed vorkath because he has a special boost.
		if (
			monster.name.toLowerCase() !== 'vorkath' &&
			osjsMon?.data?.attributes?.includes(MonsterAttribute.Dragon)
		) {
			if (
				msg.author.hasItemEquippedOrInBank('Dragon hunter lance') &&
				!attackStyles.includes(SkillsEnum.Ranged) &&
				!attackStyles.includes(SkillsEnum.Magic)
			) {
				timeToFinish = reduceNumByPercent(timeToFinish, 15);
				boosts.push('15% for Dragon hunter lance');
			} else if (
				msg.author.hasItemEquippedOrInBank('Dragon hunter crossbow') &&
				attackStyles.includes(SkillsEnum.Ranged)
			) {
				timeToFinish = reduceNumByPercent(timeToFinish, 15);
				boosts.push('15% for Dragon hunter crossbow');
			}
		}
		// Add 15% slayer boost on task if they have black mask or similar
		if (attackStyles.includes(SkillsEnum.Ranged) || attackStyles.includes(SkillsEnum.Magic)) {
			if (isOnTask && msg.author.hasItemEquippedOrInBank(itemID('Black mask (i)'))) {
				timeToFinish = reduceNumByPercent(timeToFinish, 15);
				boosts.push('15% for Black mask (i) on non-melee task');
			}
		} else if (isOnTask && msg.author.hasItemEquippedOrInBank(itemID('Black mask'))) {
			timeToFinish = reduceNumByPercent(timeToFinish, 15);
			boosts.push('15% for Black mask on melee task');
		}

		const maxTripLength = msg.author.maxTripLength(Activity.MonsterKilling);

		// If no quantity provided, set it to the max.
		if (quantity === null) {
			quantity = floor(maxTripLength / timeToFinish);
		}
		*/

	}
}
