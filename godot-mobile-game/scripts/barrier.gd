extends Node2D
## One falling gate row. Each lane holds either a coloured cell (pass it only
## while carrying that colour) or a solid wall (never passable).

const HEIGHT := 58.0
const PAD := 5.0

var cells: Array = [0, 0, 0]
var resolved: bool = false
var width: float = 720.0

var _dissolve: float = 0.0
var _cleared_lane: int = -1
var _t: float = 0.0


func setup(cell_data: Array, viewport_width: float) -> void:
	cells = cell_data.duplicate()
	width = viewport_width
	resolved = false
	_dissolve = 0.0
	_cleared_lane = -1
	queue_redraw()


func mark_cleared(lane: int) -> void:
	_cleared_lane = lane
	_dissolve = 1.0


func _process(delta: float) -> void:
	_t += delta
	if _dissolve > 0.0:
		_dissolve = maxf(0.0, _dissolve - delta * 3.2)
	queue_redraw()


func _draw() -> void:
	var lw := Track.lane_width(width)
	var reduced: bool = SaveData.reduced_effects
	for i in Track.LANES:
		var cell: int = cells[i]
		var x := Track.lane_x(i, width) - lw * 0.5 + PAD
		var r := Rect2(x, -HEIGHT * 0.5, lw - PAD * 2.0, HEIGHT)

		if i == _cleared_lane and _dissolve > 0.0:
			var c := Palette.color_of(cell)
			c.a = _dissolve * 0.7
			draw_rect(r.grow(8.0 * (1.0 - _dissolve)), c, false, 3.0)
			continue
		if i == _cleared_lane:
			continue

		if cell == Palette.WALL_CELL:
			_draw_wall(r)
		else:
			_draw_gate(r, Palette.color_of(cell), reduced)


func _draw_wall(r: Rect2) -> void:
	draw_rect(r, Palette.WALL, true)
	var edge := Palette.WALL.lightened(0.28)
	draw_rect(r, edge, false, 2.0)
	# Diagonal hazard hatching.
	var step := 16.0
	var x := r.position.x - r.size.y
	while x < r.end.x:
		var a := Vector2(maxf(x, r.position.x), r.end.y - minf(r.size.y, maxf(0.0, r.position.x - x)))
		var b := Vector2(minf(x + r.size.y, r.end.x), r.position.y + maxf(0.0, (x + r.size.y) - r.end.x))
		draw_line(a, b, edge, 2.0, true)
		x += step


func _draw_gate(r: Rect2, col: Color, reduced: bool) -> void:
	var fill := col
	fill.a = 0.16
	draw_rect(r, fill, true)
	if reduced:
		draw_rect(r, col, false, 3.0)
	else:
		Neon.outline(self, r, col, 3.0, 3, 3.0)
	# Direction chevrons so the passable cell reads instantly.
	var cx := r.position.x + r.size.x * 0.5
	var cy := r.position.y + r.size.y * 0.5
	var w := r.size.x * 0.20
	var h := r.size.y * 0.22
	var a := col
	a.a = 0.55 + sin(_t * 5.0) * 0.20
	for k in 2:
		var off := -h * 1.1 + float(k) * h * 2.2
		draw_line(Vector2(cx - w, cy + off - h), Vector2(cx, cy + off), a, 3.0, true)
		draw_line(Vector2(cx, cy + off), Vector2(cx + w, cy + off - h), a, 3.0, true)
