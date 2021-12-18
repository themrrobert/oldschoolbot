import { Client } from 'klasa';

Client.defaultClientSchema
	.add('commandStats', 'any', { default: {} })
	.add('totalCommandsUsed', 'integer', { default: 0 })
	.add('prices', 'any', { default: {} })
	.add('sold_items_bank', 'any', { default: {} })
	.add('herblore_cost_bank', 'any', { default: {} })
	.add('construction_cost_bank', 'any', { default: {} })
	.add('farming_cost_bank', 'any', { default: {} })
	.add('farming_loot_bank', 'any', { default: {} })
	.add('buy_cost_bank', 'any', { default: {} })
	.add('magic_cost_bank', 'any', { default: {} })
	.add('crafting_cost', 'any', { default: {} })
	.add('gnome_res_cost', 'any', { default: {} })
	.add('gnome_res_loot', 'any', { default: {} })
	.add('rogues_den_cost', 'any', { default: {} })
	.add('gauntlet_loot', 'any', { default: {} })
	.add('cox_cost', 'any', { default: {} })
	.add('cox_loot', 'any', { default: {} })
	.add('collecting_cost', 'any', { default: {} })
	.add('collecting_loot', 'any', { default: {} })
	.add('mta_cost', 'any', { default: {} })
	.add('bf_cost', 'any', { default: {} })
	.add('mage_arena_cost', 'any', { default: {} })
	.add('hunter_cost', 'any', { default: {} })
	.add('hunter_loot', 'any', { default: {} })
	.add('revs_cost', 'any', { default: {} })
	.add('revs_loot', 'any', { default: {} })
	.add('inferno_cost', 'any', { default: {} })
	.add('dropped_items', 'any', { default: {} })
	.add('runecraft_cost', 'any', { default: {} })
	.add('smithing_cost', 'any', { default: {} })
	.add('nightmare_cost', 'any', { default: {} })
	.add('create_cost', 'any', { default: {} })
	.add('create_loot', 'any', { default: {} })
	.add('tob_cost', 'any', { default: {} })
	.add('tob_loot', 'any', { default: {} })
	.add('degraded_items_cost', 'any', { default: {} })
	.add('economyStats', folder =>
		folder
			.add('dicingBank', 'number', { default: 0 })
			.add('duelTaxBank', 'number', { default: 0 })
			.add('dailiesAmount', 'number', { default: 0 })
			.add('itemSellTaxBank', 'number', { default: 0 })
			.add('bankBgCostBank', 'any', { default: {} })
			.add('sacrificedBank', 'any', { default: {} })
			.add('wintertodtCost', 'any', { default: {} })
			.add('wintertodtLoot', 'any', { default: {} })
			.add('fightCavesCost', 'any', { default: {} })
			.add('PVMCost', 'any', { default: {} })
			.add('thievingCost', 'any', { default: {} })
	)

	.add('gp_sell', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_pvm', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_alch', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_pickpocket', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_dice', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_open', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })
	.add('gp_daily', 'integer', { default: 0, maximum: Number.MAX_SAFE_INTEGER })

	.add('locked_skills', 'any', { array: true, default: [] })
	.add('custom_prices', 'any', { default: {} });
