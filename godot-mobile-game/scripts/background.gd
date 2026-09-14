extends Node2D
## Procedural parallax backdrop: gradient wash, a receding grid, and drifting
## motes. No textures, so it costs nothing to download and scales to any screen.

var scroll: float = 0.0
var tint: Color = Palette.CYAN

var _motes: Array[Vector3] = []
var _size: Vector2 = Vector2(720, 1280)
var _seeded := false


func _ready() -> void:
	z_index = -20


func configure(viewport_size: Vector2) -> void:
	_size = viewport_size
	if not _seeded:
		_seeded = true
		var rng := RandomNumberGenerator.new()
		rng.seed = 20260914
		for i in 46:
			# x, y, depth (0.3 far .. 1.0 near)
			_motes.append(Vector3(rng.randf(), rng.randf(), rng.randf_range(0.3, 1.0)))
	queue_redraw()


func advance(pixels: float) -> void:
	scroll = fmod(scroll + pixels, 100000.0)
	queue_redraw()


func _draw() -> void:
	var w := _size.x
	var h := _size.y

	# Vertical gradient built from horizontal bands.
	var bands := 26
	for i in bands:
		var t := float(i) / float(bands - 1)
		var c := Palette.BG_TOP.lerp(Palette.BG_BOTTOM, t)
		draw_rect(Rect2(0, h * float(i) / float(bands) - 1.0, w, h / float(bands) + 2.0), c, true)

	# Soft colour wash from the active gate colour.
	var wash := tint
	wash.a = 0.055
	draw_rect(Rect2(0, h * 0.45, w, h * 0.55), wash, true)

	if SaveData.reduced_effects:
		_draw_lane_guides(w, h)
		return

	# Receding horizontal grid.
	var spacing := 120.0
	var grid := tint
	var offset := fmod(scroll * 0.35, spacing)
	var y := -spacing + offset
	while y < h:
		var depth: float = clampf(y / h, 0.0, 1.0)
		grid.a = 0.03 + depth * 0.06
		draw_line(Vector2(0, y), Vector2(w, y), grid, 1.0 + depth * 1.5, true)
		y += spacing

	_draw_lane_guides(w, h)

	# Drifting motes, parallaxed by depth.
	for m in _motes:
		var mx: float = m.x * w
		var my: float = fposmod(m.y * h + scroll * m.z * 0.25, h)
		var c := Palette.INK
		c.a = 0.05 + m.z * 0.10
		draw_circle(Vector2(mx, my), 1.0 + m.z * 2.2, c)


func _draw_lane_guides(w: float, h: float) -> void:
	var guide := Palette.MUTED
	guide.a = 0.10
	for i in range(1, Track.LANES):
		var x := Track.lane_width(w) * float(i)
		draw_line(Vector2(x, 0), Vector2(x, h), guide, 1.0, true)
