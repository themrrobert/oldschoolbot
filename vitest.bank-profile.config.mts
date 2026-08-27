import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	clearScreen: false,
	test: {
		name: 'Old School Bot - Bank Profile',
		include: ['tests/profile/**/*.profile.test.ts'],
		testTimeout: 600_000,
		isolate: false,
		pool: 'forks',
		maxWorkers: 1
	},
	resolve: {
		alias: {
			'@': path.resolve(import.meta.dirname, './src')
		}
	}
});
