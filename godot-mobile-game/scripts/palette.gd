class_name Palette
extends RefCounted
## Shared colour language for the whole game. Three play colours, one lethal
## wall colour, and the background ramp.

const CYAN := Color("22e6ff")
const MAGENTA := Color("ff3ea5")
const AMBER := Color("ffc13d")
const WALL := Color("3a4166")
const BG_TOP := Color("070a18")
const BG_BOTTOM := Color("141838")
const INK := Color("e8ecff")
const MUTED := Color("8a93bf")

const COLORS: Array = [CYAN, MAGENTA, AMBER]
const NAMES: Array = ["Cyan", "Magenta", "Amber"]

const WALL_CELL := -1


static func color_of(index: int) -> Color:
	if index == WALL_CELL:
		return WALL
	return COLORS[index % COLORS.size()]
