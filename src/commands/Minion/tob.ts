import { ChartConfiguration } from 'chart.js';
import { MessageAttachment } from 'discord.js';
import { calcWhatPercent, percentChance, Time } from 'e';
import { CommandStore, KlasaMessage, KlasaUser } from 'klasa';
import { Bank } from 'oldschooljs';
import { table } from 'table';

import { Emoji } from '../../lib/constants';
import {
	baseTOBUniques,
	calcTOBInput,
	calculateTOBDeaths,
	calculateTOBUserGearPercents,
	checkTOBTeam,
	checkTOBUser,
	createTOBTeam,
	TENTACLE_CHARGES_PER_RAID,
	TOBRooms
} from '../../lib/data/tob';
import { degradeItem } from '../../lib/degradeableItems';
import { ClientSettings } from '../../lib/settings/types/ClientSettings';
import { UserSettings } from '../../lib/settings/types/UserSettings';
import { TheatreOfBlood, TheatreOfBloodOptions } from '../../lib/simulation/tob';
import { BotCommand } from '../../lib/structures/BotCommand';
import { MakePartyOptions } from '../../lib/types';
import { TheatreOfBloodTaskOptions } from '../../lib/types/minions';
import { calcDropRatesFromBank, formatDuration, randomVariation, toKMB, updateBankSetting } from '../../lib/util';
import addSubTaskToActivityTask from '../../lib/util/addSubTaskToActivityTask';
import { generateChart } from '../../lib/util/chart';
import getOSItem from '../../lib/util/getOSItem';

export default class extends BotCommand {
	public constructor(store: CommandStore, file: string[], directory: string) {
		super(store, file, directory, {
			usage: '[start|sim|graph]',
			usageDelim: ' ',
			oneAtTime: true,
			altProtection: true,
			requiredPermissions: ['ADD_REACTIONS', 'ATTACH_FILES'],
			description: 'Sends your minion to do the Theatre of Blood.',
			examples: ['+raid solo', '+raid mass'],
			subcommands: true
		});
	}

	async graph(msg: KlasaMessage) {
		let size = 3;
		let inputSize = Number(msg.flagArgs.size);
		if (!isNaN(inputSize)) size = Math.min(5, Math.max(2, inputSize));
		const result = await this._graph(new Array(size).fill(msg.author), msg.flagArgs.hard ? true : false, 0);
		return msg.channel.send({ files: [result[0]] });
	}

	async _graph(users: KlasaUser[], hardMode: boolean, startingKC: number) {
		let duration = [];
		let successRates = [];
		let kc = [];
		let groupKc = 0;
		let amountOfKC = 450;

		for (let i = startingKC; i < startingKC + amountOfKC; i++) {
			const t = await createTOBTeam({
				team: users,
				hardMode,
				attemptsOverride: [i, i],
				kcOverride: [groupKc, groupKc],
				disableVariation: true
			});

			let wins = 0;
			const winRateSampleSize = 25;
			for (let o = 0; o < winRateSampleSize; o++) {
				const sim = await createTOBTeam({
					team: users,
					hardMode,
					attemptsOverride: [i, i],
					kcOverride: [groupKc, groupKc],
					disableVariation: true
				});
				if (!sim.wipedRoom) {
					wins++;
				}
			}
			let successRate = calcWhatPercent(wins, winRateSampleSize);
			if (percentChance(successRate)) groupKc++;
			successRates.push(successRate);
			kc.push(groupKc);
			duration.push(t.duration);
		}
		duration = duration.map(i => i / Time.Minute);

		const options: ChartConfiguration = {
			type: 'line',
			data: {
				// labels: [...Array(duration.length).keys()].map(i => `${i + 1}`),
				labels: [...Array(kc.length).keys()].map(i => `${i + 1}`),
				datasets: [
					{
						label: 'Success rate (%)',
						backgroundColor: 'rgb(255, 0, 0)',
						borderColor: 'rgb(255, 0, 0)',
						data: successRates,
						fill: false,
						yAxisID: 'y'
					},
					{
						label: 'Duration (Minutes)',
						backgroundColor: 'rgb(0, 255, 0)',
						borderColor: 'rgb(0, 255, 0)',
						data: duration,
						fill: false,
						yAxisID: 'y1'
					}
					// {
					// 	label: 'Actual KC',
					// 	fill: false,
					// 	backgroundColor: 'rgb(0, 0, 0)',
					// 	borderColor: 'rgb(0, 0, 0)',
					// 	data: kc,
					// 	yAxisID: 'right'
					// }
				]
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: `Simulating ${startingKC}-${startingKC + amountOfKC} TOB, Team Size ${
							users.length
						} (${users.map(u => u.username).join(',')}), ${hardMode ? 'Hardmode' : 'Not hardmode'}`
					}
				},
				scales: {
					x: {
						title: {
							display: true,
							text: 'Attempts',
							font: {
								size: 15
							}
						}
					},
					y: {
						type: 'linear',
						display: true,
						position: 'left',
						ticks: {
							// Include a dollar sign in the ticks
							callback(value) {
								return `${value}%`;
							}
						}
					},
					y1: {
						type: 'linear',
						display: true,
						position: 'right',
						grid: {
							drawOnChartArea: false
						},
						// Include a dollar sign in the ticks
						ticks: {
							callback(value) {
								return `${value}mins`;
							}
						}
					}
				}
			}
		};

		const imageBuffer = await generateChart(options);

		let arr = [['Attempts'].concat(options.data.datasets.map(i => i.label!))];
		for (let i = 1; i < options.data.datasets[0].data.length; i++) {
			arr[i] = [(i - 1).toString()];
			for (const dataset of options.data.datasets) {
				arr[i].push(dataset.data[i - 1]!.toString());
			}
		}

		const normalTable = table(arr);
		return [imageBuffer, new MessageAttachment(Buffer.from(normalTable), 'Fletchables.txt')];
	}

	async sim(msg: KlasaMessage) {
		const options: TheatreOfBloodOptions = {
			hardMode: false,
			team: [
				{ id: '1', deaths: [] },
				{ id: '2', deaths: [] },
				{ id: '3', deaths: [] },
				{ id: '4', deaths: [] }
			]
		};
		let its = 100_000;
		const totalLoot = new Bank();
		const userLoot = new Bank();
		for (let i = 0; i < its; i++) {
			const result = TheatreOfBlood.complete(options);
			for (const [id, b] of Object.entries(result.loot)) {
				totalLoot.add(b);
				if (id === '1') {
					userLoot.add(b);
				}
			}
		}

		return msg.channel.send(`Loot From ${its.toLocaleString()} TOB, Team of 4

**Team Loot:** ${toKMB(Math.round(totalLoot.value() / its))} avg \`\`\`${calcDropRatesFromBank(
			totalLoot,
			its,
			baseTOBUniques
		)}\`\`\`
**User Loot:** ${toKMB(Math.round(userLoot.value() / its))} avg \`\`\`${calcDropRatesFromBank(
			userLoot,
			its,
			baseTOBUniques
		)}\`\`\``);
	}

	async start(msg: KlasaMessage) {
		const isHardMode = Boolean(msg.flagArgs.hard);
		const initialCheck = await checkTOBUser(msg.author, isHardMode);
		if (initialCheck[0]) {
			return msg.channel.send(initialCheck[1]);
		}

		if (isHardMode) {
			const normalKC = await msg.author.getMinigameScore('tob');
			if (normalKC < 200) {
				return msg.channel.send(
					'You need atleast 200 completions of the Theatre of Blood before you can attempt Hard Mode.'
				);
			}
		}
		if (msg.author.minionIsBusy) {
			return msg.channel.send("Your minion is busy, so you can't start a raid.");
		}

		const partyOptions: MakePartyOptions = {
			leader: msg.author,
			minSize: 2,
			maxSize: 5,
			ironmanAllowed: true,
			message: `${msg.author.username} is hosting a ${
				isHardMode ? '**Hard mode** ' : ''
			}Theatre of Blood mass! Anyone can click the ${Emoji.Join} reaction to join, click it again to leave.`,
			customDenier: user => checkTOBUser(user, isHardMode)
		};

		const users = (await msg.makePartyAwaiter(partyOptions)).filter(u => !u.minionIsBusy);

		const teamCheckFailure = await checkTOBTeam(users, isHardMode);
		if (teamCheckFailure) {
			return msg.channel.send(`Your mass failed to start because of this reason: ${teamCheckFailure}`);
		}

		const { duration, totalReduction, reductions, wipedRoom, deathDuration } = await createTOBTeam({
			team: users,
			hardMode: isHardMode
		});

		let debugStr = '';

		const totalCost = new Bank();

		await Promise.all(
			users.map(async u => {
				const supplies = await calcTOBInput(u);
				const blowpipeData = u.settings.get(UserSettings.Blowpipe);
				const { realCost } = await u.specialRemoveItems(
					supplies
						.clone()
						.add('Coins', 100_000)
						.add(
							blowpipeData.dartID!,
							Math.floor(Math.min(blowpipeData.dartQuantity, randomVariation(110, 10)))
						)
						.add(u.getGear('range').ammo!.item, 100)
				);
				if (u.getGear('melee').hasEquipped('Abyssal tentacle')) {
					await degradeItem({
						item: getOSItem('Abyssal tentacle'),
						user: u,
						chargesToDegrade: TENTACLE_CHARGES_PER_RAID
					});
				}
				totalCost.add(realCost.clone().remove('Coins', realCost.amount('Coins')));
				const { total } = calculateTOBUserGearPercents(u);
				debugStr += `${u.username} (${Emoji.Gear}${total.toFixed(1)}% ${Emoji.CombatSword} ${calcWhatPercent(
					reductions[u.id],
					totalReduction
				).toFixed(1)}%) used ${realCost}\n`;
			})
		);

		updateBankSetting(this.client, ClientSettings.EconomyStats.TOBCost, totalCost);

		await addSubTaskToActivityTask<TheatreOfBloodTaskOptions>({
			userID: msg.author.id,
			channelID: msg.channel.id,
			duration: deathDuration ?? duration,
			type: 'TheatreOfBlood',
			leader: msg.author.id,
			users: users.map(u => u.id),
			hardMode: isHardMode,
			wipedRoom: wipedRoom === null ? null : TOBRooms.indexOf(wipedRoom),
			fakeDuration: duration
		});

		let str = `${partyOptions.leader.username}'s party (${users
			.map(u => u.username)
			.join(', ')}) is now off to do a Theatre of Blood raid - the total trip will take ${formatDuration(
			duration
		)}.`;

		str += ` \n\n${debugStr}`;

		return msg.channel.send(str);
	}

	async run(msg: KlasaMessage) {
		const hardKC = await msg.author.getMinigameScore('tob_hard');
		const kc = await msg.author.getMinigameScore('tob');
		const attempts = await msg.author.settings.get(UserSettings.Stats.TobAttempts);
		const hardAttempts = await msg.author.settings.get(UserSettings.Stats.TobHardModeAttempts);
		const deathChances = calculateTOBDeaths(kc, hardKC, attempts, hardAttempts, false);
		const hardDeathChances = calculateTOBDeaths(kc, hardKC, attempts, hardAttempts, true);

		return msg.channel.send(`**Theatre of Blood**
KC: ${kc}
Attempts: ${attempts}
Hard KC: ${hardKC}
Hard attempts: ${hardAttempts}
Death Chances: ${deathChances.deathChances.map(i => `${i.name}[${i.deathChance.toFixed(2)}%]`).join(' ')}
Hard Mode Death Chances: ${hardDeathChances.deathChances
			.map(i => `${i.name}[${i.deathChance.toFixed(2)}%]`)
			.join(' ')}`);
	}
}
