extends Node2D
## The player ship: three lanes, three colours, one thumb.

const TRAIL_POINTS := 14
const MOVE_SPEED := 14.0
const SIZE := 30.0

var lane: int = 1
var color_index: int = 0
var has_shield: bool = false
var prism_time: float = 0.0
var alive: bool = true

var _viewport_width: float = 720.0
var _target_x: float = 360.0
var _trail: Array[Vector2] = []
var _tilt: float = 0.0
var _pulse: float = 0.0
var _flash: float = 0.0


func setup(width: float) -> void:
	_viewport_width = width
	lane = 1
	color_index = 0
	has_shield = false
	prism_time = 0.0
	alive = true
	_target_x = Track.lane_x(lane, width)
	position.x = _target_x
	_trail.clear()


func _process(delta: float) -> void:
	_target_x = Track.lane_x(lane, _viewport_width)
	var prev_x := position.x
	position.x = lerpf(position.x, _target_x, clampf(MOVE_SPEED * delta, 0.0, 1.0))

	var drift := (position.x - prev_x) / maxf(delta, 0.0001)
	_tilt = lerpf(_tilt, clampf(drift / 1600.0, -0.42, 0.42), clampf(10.0 * delta, 0.0, 1.0))
	_pulse += delta
	_flash = maxf(0.0, _flash - delta * 3.0)
	if prism_time > 0.0:
		prism_time = maxf(0.0, prism_time - delta)

	_trail.push_front(position)
	if _trail.size() > TRAIL_POINTS:
		_trail.resize(TRAIL_POINTS)
	queue_redraw()


func current_color() -> Color:
	if prism_time > 0.0:
		return Color.from_hsv(fmod(_pulse * 0.8, 1.0), 0.65, 1.0)
	return Palette.color_of(color_index)


## A prism run matches every gate colour.
func matches(cell: int) -> bool:
	if cell == Palette.WALL_CELL:
		return false
	if prism_time > 0.0:
		return true
	return cell == color_index


func cycle_color(step: int = 1) -> void:
	color_index = posmod(color_index + step, Palette.COLORS.size())
	_flash = 1.0


func set_lane(value: int) -> void:
	lane = clampi(value, 0, Track.LANES - 1)


func take_hit() -> bool:
	## Returns true when the shield absorbed the hit.
	_flash = 1.0
	if has_shield:
		has_shield = false
		return true
	alive = false
	return false


func _draw() -> void:
	var col := current_color()
	var reduced: bool = SaveData.reduced_effects

	# Motion trail in local space.
	if not reduced and _trail.size() > 2:
		for i in range(_trail.size() - 1):
			var a: Vector2 = to_local(_trail[i])
			var b: Vector2 = to_local(_trail[i + 1])
			var fade: float = 1.0 - float(i) / float(_trail.size())
			var c := col
			c.a = 0.22 * fade
			draw_line(a + Vector2(0, 14), b + Vector2(0, 14), c, 16.0 * fade, true)

	var breathe: float = 1.0 + sin(_pulse * 4.0) * 0.035
	var s: float = SIZE * breathe
	var body := PackedVector2Array([
		Vector2(0, -s), Vector2(s * 0.86, s * 0.72), Vector2(0, s * 0.40), Vector2(-s * 0.86, s * 0.72),
	])
	var rotated := PackedVector2Array()
	for p in body:
		rotated.append(p.rotated(_tilt))

	if reduced:
		draw_colored_polygon(rotated, col)
	else:
		Neon.polygon(self, rotated, col, 4, 0.13)

	# Core.
	var core := col.lightened(0.55)
	core.a = 0.85
	draw_circle(Vector2(0, s * 0.05), s * 0.22, core)

	# Colour-change flash.
	if _flash > 0.0:
		var f := Color(1, 1, 1, _flash * 0.45)
		draw_colored_polygon(rotated, f)

	# Shield ring.
	if has_shield:
		var ring := Palette.INK
		ring.a = 0.55 + sin(_pulse * 7.0) * 0.20
		draw_arc(Vector2.ZERO, s * 1.55, 0.0, TAU, 48, ring, 3.0, true)

	# Prism halo.
	if prism_time > 0.0:
		for i in 3:
			var hc := Color.from_hsv(fmod(_pulse * 0.8 + float(i) / 3.0, 1.0), 0.7, 1.0, 0.30)
			draw_arc(Vector2.ZERO, s * (1.8 + float(i) * 0.22), 0.0, TAU, 40, hc, 2.0, true)
