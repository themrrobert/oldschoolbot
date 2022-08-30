import { LootTable } from 'oldschooljs';

export const baseHolidayItems = new LootTable()
	.add('Chicken head')
	.add('Chicken wings')
	.add('Chicken legs')
	.add('Chicken feet')
	.add('Scythe')
	.add('Pumpkin')
	.add('Red halloween mask')
	.add('Blue halloween mask')
	.add('Green halloween mask')
	.add("Black h'ween mask")
	.add('Skeleton mask')
	.add('Skeleton shirt')
	.add('Skeleton leggings')
	.add('Skeleton gloves')
	.add('Skeleton boots')
	.add('Jack lantern mask')
	.add('Yo-yo')
	.add('Reindeer hat')
	.add('Bunny ears')
	.add('Easter egg')
	.add('Wintumber tree')
	.add('Santa hat')
	.add('Bobble hat')
	.add('Bobble scarf')
	.add('Jester hat')
	.add('Jester scarf')
	.add('Tri-jester hat')
	.add('Tri-jester scarf')
	.add('Woolly hat')
	.add('Woolly scarf')
	.add('Red marionette')
	.add('Green marionette')
	.add('Blue marionette')
	.add('Rubber chicken')
	.add('Disk of returning')
	.add('Zombie head')
	.add('Half full wine jug')
	.add('Christmas cracker')
	.add('War ship')
	.add("Black h'ween mask")
	.add('Cow mask')
	.add('Cow top')
	.add('Cow trousers')
	.add('Cow gloves')
	.add('Cow shoes')
	.add('Easter basket')
	.add('Druidic wreath')
	.add('Grim reaper hood')
	.add('Santa mask')
	.add('Santa jacket')
	.add('Santa pantaloons')
	.add('Santa gloves')
	.add('Santa boots')
	.add('Antisanta mask')
	.add('Antisanta jacket')
	.add('Antisanta pantaloons')
	.add('Antisanta gloves')
	.add('Antisanta boots')
	.add('Bunny feet')
	.add('Bunny top')
	.add('Bunny legs')
	.add('Bunny paws')
	.add('Mask of balance')
	.add('Anti-panties')
	.add('Gravedigger mask')
	.add('Gravedigger top')
	.add('Gravedigger leggings')
	.add('Gravedigger gloves')
	.add('Gravedigger boots')
	.add('Black santa hat')
	.add('Inverted santa hat')
	.add('Gnome child hat')
	.add('Cabbage cape')
	.add('Cruciferous codex')
	.add('Banshee mask')
	.add('Banshee top')
	.add('Banshee robe')
	.add('Snow globe')
	.add('Giant present')
	.add('Sack of presents')
	.add('4th birthday hat')
	.add('Birthday balloons')
	.add('Easter egg helm')
	.add('Eggshell platebody')
	.add('Eggshell platelegs')
	.add('Jonas mask')
	.add(21_847) // Snow imp costume head
	.add(21_849) // Snow imp costume body
	.add(21_851) // Snow imp costume legs
	.add(21_853) // Snow imp costume gloves
	.add(21_855) // Snow imp costume feet
	.add(21_857) // Snow imp costume tail
	.add('Star-face')
	.add('Tree top')
	.add('Tree skirt')
	.add('Candy cane')
	.add('Birthday cake')
	.add('Giant easter egg')
	.add('Bunnyman mask')
	.add('Spooky hood')
	.add('Spooky robe')
	.add('Spooky skirt')
	.add('Spooky gloves')
	.add('Spooky boots')
	.add('Spookier hood')
	.add('Spookier robe')
	.add('Spookier skirt')
	.add('Spookier gloves')
	.add('Spookier boots')
	.add('Pumpkin lantern')
	.add('Skeleton lantern')
	.add('Blue gingerbread shield')
	.add('Green gingerbread shield')
	.add('Cat ears')
	.add('Hell cat ears')
	.add('Magic egg ball')
	.add('Eek')
	.add('Carrot sword')
	.add("'24-carat' sword")
	// New
	.add('Web cloak')
	.add('Grim reaper hood')
	.add('Chocatrice cape')
	.add('Warlock top')
	.add('Warlock legs')
	.add('Warlock cloak')
	.add('Witch top')
	.add('Witch skirt')
	.add('Witch cloak')
	.add('Ring of snow')
	.add('Toy kite');

export const PartyhatTable = new LootTable()
	.oneIn(50, 'Black partyhat')
	.oneIn(25, 'Pink partyhat')
	.oneIn(20, 'Rainbow partyhat')
	.add('Red Partyhat')
	.add('Yellow partyhat')
	.add('Blue partyhat')
	.add('Purple partyhat')
	.add('Green partyhat')
	.add('White partyhat');

export const allHolidayItems = [...baseHolidayItems.allItems, ...PartyhatTable.allItems];
