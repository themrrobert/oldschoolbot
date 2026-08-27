import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { config as loadDotEnv } from 'dotenv';
import { describe, expect, test } from 'vitest';

import type { BankImageProfile } from '@/lib/canvas/bankImage.js';

const envResult = loadDotEnv({ path: path.resolve('.env'), override: true });
if (envResult.error) throw envResult.error;
process.env.USE_REAL_PG = '1';

function ms(value: number | undefined) {
	return `${(value ?? 0).toFixed(2)}ms`;
}

function totalQuantity(bank: MUser['bankWithGP']) {
	return bank.items().reduce((sum, [, qty]) => sum + qty, 0);
}

function logProfileRows(userId: string, profile: BankImageProfile) {
	for (const row of profile.rows) {
		console.log(
			[
				'[bank-profile:row]',
				`user=${userId}`,
				`row=${row.rowIndex}`,
				`items=${row.startItemIndex}-${row.endItemIndex}`,
				`y=${row.y}`,
				`clip_load=${ms(row.clipLoadMs)}`,
				`canvas_draw=${ms(row.drawMs)}`,
				`rest=${ms(row.restMs)}`,
				`total=${ms(row.totalMs)}`
			].join(' ')
		);
	}
}

describe('real DB /bank flag:show_all bank image profile', () => {
	test('generates full bank images for the first two admin IDs', async () => {
		if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in .env for this profile test.');

		await import('../../src/lib/safeglobals.js');
		const [{ PrismaClient }, { globalConfig }, { MUserClass }, { bankCommand }] = await Promise.all([
			import('../../src/prisma/main.js'),
			import('../../src/lib/constants.js'),
			import('../../src/lib/user/MUser.js'),
			import('../../src/mahoji/commands/bank.js')
		]);

		const prismaClient = new PrismaClient({
			log: [{ emit: 'event', level: 'query' }, 'warn'],
			adapter: new PrismaPg({
				connectionString: process.env.DATABASE_URL,
				idleTimeoutMillis: 5000,
				max: 2,
				min: 0
			})
		});
		(prismaClient as any).$on('query', (event: { duration: number; query: string }) => {
			console.log(
				`[bank-profile:query] duration=${ms(event.duration)} query=${event.query.replace(/\s+/g, ' ').trim()}`
			);
		});
		(globalThis as any).prisma = prismaClient;

		const outputDir = path.resolve('tmp/bank-profile');
		await mkdir(outputDir, { recursive: true });
		const adminIds = globalConfig.adminUserIDs.slice(0, 2);
		expect(adminIds).toHaveLength(2);
		console.log(`[bank-profile] env=.env database=DATABASE_URL outputDir=${outputDir}`);
		console.log(`[bank-profile] adminIds=${adminIds.join(',')}`);

		try {
			for (const userId of adminIds) {
				const dbStart = performance.now();
				const userRow = await prismaClient.user.findUnique({ where: { id: userId } });
				const dbFetchMs = performance.now() - dbStart;
				expect(userRow, `Expected real DB user row for admin ID ${userId}`).toBeTruthy();

				const constructStart = performance.now();
				const user = new MUserClass(userRow!);
				const constructMs = performance.now() - constructStart;
				const bank = user.bankWithGP;
				const profile: BankImageProfile = { rows: [], stampRows: true };
				const commandStart = performance.now();
				const result = await bankCommand.run({
					user,
					userId,
					member: null,
					channelId: 'bank-profile',
					guildId: null,
					rng: MathRNG,
					options: {
						flag: 'show_all',
						profile
					},
					interaction: {
						defer: async () => {
							console.log(`[bank-profile] deferred user=${userId}`);
						}
					}
				} as any);
				const commandMs = performance.now() - commandStart;

				const firstFile = (result as { files?: { name: string; buffer: Buffer }[] }).files?.[0];
				expect(firstFile?.buffer, `Expected /bank flag:show_all to return an image for ${userId}`).toBeTruthy();
				const outputPath = path.join(outputDir, `bank-show-all-${userId}.png`);
				await writeFile(outputPath, firstFile!.buffer);

				console.log(
					[
						'[bank-profile:summary]',
						`user=${userId}`,
						`username=${user.username}`,
						`items=${bank.length}`,
						`total_qty=${totalQuantity(bank)}`,
						`db_fetch=${ms(dbFetchMs)}`,
						`muser_construct=${ms(constructMs)}`,
						`command_total=${ms(commandMs)}`,
						`init=${ms(profile.initMs)}`,
						`prep=${ms(profile.prepMs)}`,
						`value_title=${ms(profile.valueTitleMs)}`,
						`a_canvas=${ms(profile.canvasCreateMs)}`,
						`b_bg_border_title=${ms(profile.backgroundBorderTitleMs)}`,
						`c_png=${ms(profile.pngMs)}`,
						`generate_total=${ms(profile.totalMs)}`,
						`canvas=${profile.canvasWidth}x${profile.canvasHeight}`,
						`items_per_row=${profile.itemsPerRow}`,
						`compact=${profile.compact}`,
						`rows=${profile.rows.length}`,
						`output=${outputPath}`
					].join(' ')
				);
				logProfileRows(userId, profile);
			}
		} finally {
			await prismaClient.$disconnect();
		}
	});
});
