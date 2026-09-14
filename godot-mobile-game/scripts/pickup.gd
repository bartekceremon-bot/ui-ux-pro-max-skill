extends Node2D
## Collectible token that drops between gates.

enum Kind { ENERGY, SHIELD, SLOW, PRISM }

const RADIUS := 26.0

var kind: int = Kind.ENERGY
var lane: int = 1
var resolved: bool = false

var _t: float = 0.0
var _taken: float = 0.0


func setup(k: int, lane_index: int) -> void:
	kind = k
	lane = lane_index
	resolved = false
	_taken = 0.0


func tint() -> Color:
	match kind:
		Kind.SHIELD:
			return Palette.INK
		Kind.SLOW:
			return Palette.CYAN
		Kind.PRISM:
			return Palette.MAGENTA
		_:
			return Palette.AMBER


func label() -> String:
	match kind:
		Kind.SHIELD:
			return "SHIELD UP"
		Kind.SLOW:
			return "SLOW-MO"
		Kind.PRISM:
			return "PRISM"
		_:
			return ""


func collect() -> void:
	resolved = true
	_taken = 1.0


func _process(delta: float) -> void:
	_t += delta
	if _taken > 0.0:
		_taken = maxf(0.0, _taken - delta * 4.0)
	queue_redraw()


func _draw() -> void:
	var col := tint()
	var spin := _t * 1.6
	var scale := 1.0 + sin(_t * 3.4) * 0.06
	if _taken > 0.0:
		scale = 1.0 + (1.0 - _taken) * 1.4
		col.a = _taken

	var pts := PackedVector2Array()
	for i in 6:
		var ang := spin + TAU * float(i) / 6.0
		pts.append(Vector2(cos(ang), sin(ang)) * RADIUS * scale)

	var body := col
	body.a = col.a * 0.20
	draw_colored_polygon(pts, body)
	var loop := pts.duplicate()
	loop.append(pts[0])
	draw_polyline(loop, col, 3.0, true)
	_draw_glyph(col, scale)


func _draw_glyph(col: Color, scale: float) -> void:
	var s := RADIUS * 0.46 * scale
	match kind:
		Kind.SHIELD:
			draw_colored_polygon(PackedVector2Array([
				Vector2(0, -s), Vector2(s * 0.85, -s * 0.35),
				Vector2(0, s), Vector2(-s * 0.85, -s * 0.35),
			]), col)
		Kind.SLOW:
			draw_arc(Vector2.ZERO, s, 0.0, TAU, 24, col, 3.0, true)
			draw_line(Vector2.ZERO, Vector2(0, -s * 0.7), col, 3.0, true)
			draw_line(Vector2.ZERO, Vector2(s * 0.5, 0), col, 3.0, true)
		Kind.PRISM:
			for i in 3:
				var c: Color = Palette.COLORS[i]
				c.a = col.a * 0.9
				draw_arc(Vector2.ZERO, s * (0.42 + float(i) * 0.28), 0.0, TAU, 20, c, 2.5, true)
		_:
			draw_circle(Vector2.ZERO, s * 0.7, col)
