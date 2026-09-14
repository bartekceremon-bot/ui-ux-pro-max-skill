extends Node2D
## Gameplay director: spawning, difficulty curve, input, scoring, collisions.
##
## Collisions are resolved analytically instead of with physics bodies: every
## gate is checked exactly once, the frame its centre crosses the ship line.
## That keeps the result identical at 30 fps on a budget phone and at 120 fps
## on a flagship.

signal score_changed(score: int, multiplier: int)
signal combo_changed(combo: int)
signal powerup_collected(label: String)
signal shield_used
signal run_finished(score: int, gates: int, record: bool)
signal speed_changed(level: int)

const BASE_SPEED := 330.0
const MAX_SPEED := 940.0
const BASE_GAP := 430.0
const MIN_GAP := 250.0
const SLOW_FACTOR := 0.55
const PLAYER_MARGIN := 250.0
const TAP_SLOP := 26.0
const TAP_TIME := 0.30

var running := false
var score := 0
var gates_cleared := 0
var combo := 0
var multiplier := 1
var level := 0

var _speed := BASE_SPEED
var _slow_time := 0.0
var _distance_since_gate := 0.0
var _gates_until_pickup := 4
var _last_open_lane := 1
var _last_color := 0
var _shake := 0.0
var _size := Vector2(720, 1280)
var _player_y := 1030.0
var _rng := RandomNumberGenerator.new()

var _touch_id := -1
var _touch_start := Vector2.ZERO
var _touch_time := 0.0
var _dragging := false

@onready var _field: Node2D = $Field
@onready var _player: Node2D = $Field/Player
@onready var _background: Node2D = $Background

var _barrier_scene: PackedScene = preload("res://scenes/barrier.tscn")
var _pickup_scene: PackedScene = preload("res://scenes/pickup.tscn")


func _ready() -> void:
	_rng.randomize()
	set_process(true)
	set_process_unhandled_input(true)
	_resize()
	get_viewport().size_changed.connect(_resize)


func _resize() -> void:
	_size = get_viewport_rect().size
	_player_y = _size.y - PLAYER_MARGIN
	_player.position.y = _player_y
	if not running:
		_player.setup(_size.x)
	_background.configure(_size)


# --- run lifecycle -----------------------------------------------------------

func start_run() -> void:
	for child in _field.get_children():
		if child != _player:
			child.queue_free()
	score = 0
	gates_cleared = 0
	combo = 0
	multiplier = 1
	level = 0
	_speed = BASE_SPEED
	_slow_time = 0.0
	_distance_since_gate = BASE_GAP
	_gates_until_pickup = 4
	_last_open_lane = 1
	_last_color = 0
	_shake = 0.0
	_size = get_viewport_rect().size
	_player_y = _size.y - PLAYER_MARGIN
	_player.position.y = _player_y
	_player.setup(_size.x)
	_background.configure(_size)
	_background.tint = Palette.color_of(0)
	running = true
	_player.visible = true
	score_changed.emit(score, multiplier)
	combo_changed.emit(combo)
	speed_changed.emit(level)


func stop_run() -> void:
	running = false
	_player.visible = false
	for child in _field.get_children():
		if child != _player:
			child.queue_free()


func _process(delta: float) -> void:
	if _touch_id != -1:
		_touch_time += delta

	if not running:
		# Keep the backdrop alive behind the menus.
		_background.advance(70.0 * delta)
		_apply_shake(delta)
		return

	if _slow_time > 0.0:
		_slow_time = maxf(0.0, _slow_time - delta)

	var speed := _speed * (SLOW_FACTOR if _slow_time > 0.0 else 1.0)
	var step := speed * delta
	_background.advance(step)
	_distance_since_gate += step

	for child in _field.get_children():
		if child == _player:
			continue
		child.position.y += step

	_check_collisions()
	_cull()

	var gap: float = maxf(MIN_GAP, BASE_GAP - float(level) * 11.0)
	if _distance_since_gate >= gap:
		_distance_since_gate = 0.0
		_spawn_row()

	_apply_shake(delta)


func _apply_shake(delta: float) -> void:
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - delta * 4.0)
		var amount := _shake * 18.0
		_field.position = Vector2(_rng.randf_range(-amount, amount), _rng.randf_range(-amount, amount))
	elif _field.position != Vector2.ZERO:
		_field.position = Vector2.ZERO


# --- spawning ----------------------------------------------------------------

func _spawn_row() -> void:
	var barrier := _barrier_scene.instantiate()
	_field.add_child(barrier)
	barrier.position = Vector2(0, -80.0)
	barrier.setup(_make_pattern(), _size.x)

	_gates_until_pickup -= 1
	if _gates_until_pickup <= 0:
		_gates_until_pickup = _rng.randi_range(4, 8)
		_spawn_pickup()


## Builds one gate row. Exactly one colour is passable; how many lanes carry it
## and whether the rest are obvious walls or decoy colours is what ramps up.
func _make_pattern() -> Array:
	var open_count := 2 if level < 2 else (2 if _rng.randf() < 0.28 else 1)
	var color := _rng.randi_range(0, Palette.COLORS.size() - 1)
	# Force a colour change often enough that the thumb keeps working.
	if color == _last_color and _rng.randf() < 0.55:
		color = posmod(color + _rng.randi_range(1, 2), Palette.COLORS.size())
	_last_color = color

	# At high speed keep the opening reachable from the previous one.
	var lanes := range(Track.LANES)
	if _speed > 620.0:
		lanes = []
		for i in Track.LANES:
			if absi(i - _last_open_lane) <= 1:
				lanes.append(i)
	lanes.shuffle()

	var open_lanes := lanes.slice(0, open_count)
	_last_open_lane = open_lanes[0]

	var wall_bias: float = clampf(1.0 - float(level) * 0.07, 0.35, 1.0)
	var cells: Array = []
	for i in Track.LANES:
		if i in open_lanes:
			cells.append(color)
		elif _rng.randf() < wall_bias:
			cells.append(Palette.WALL_CELL)
		else:
			cells.append(posmod(color + _rng.randi_range(1, 2), Palette.COLORS.size()))
	_background.tint = Palette.color_of(color)
	return cells


func _spawn_pickup() -> void:
	var pickup := _pickup_scene.instantiate()
	_field.add_child(pickup)
	var kind := _roll_pickup()
	var lane := _rng.randi_range(0, Track.LANES - 1)
	pickup.setup(kind, lane)
	pickup.position = Vector2(Track.lane_x(lane, _size.x), -80.0 - maxf(MIN_GAP, BASE_GAP - float(level) * 11.0) * 0.5)


func _roll_pickup() -> int:
	var roll := _rng.randf()
	if roll < 0.40:
		return 0  # ENERGY
	elif roll < 0.72:
		return 1  # SHIELD
	elif roll < 0.88:
		return 2  # SLOW
	return 3  # PRISM


# --- collisions --------------------------------------------------------------

func _check_collisions() -> void:
	for child in _field.get_children():
		if child == _player or child.resolved:
			continue
		if child.position.y < _player_y:
			continue
		child.resolved = true

		if child.has_method("mark_cleared"):
			_resolve_gate(child)
		else:
			_resolve_pickup(child)
		if not running:
			return


func _resolve_gate(barrier: Node2D) -> void:
	var lane: int = _player.lane
	# Judge by the ship's drawn position, not its target lane, so a late swerve
	# is a real miss.
	var visual_lane := Track.lane_of_x(_player.position.x, _size.x)
	var cell: int = barrier.cells[visual_lane]

	if _player.matches(cell):
		barrier.mark_cleared(visual_lane)
		gates_cleared += 1
		combo += 1
		multiplier = clampi(1 + combo / 8, 1, 8)
		score += 10 * multiplier
		level = int(score / 420)
		_speed = minf(MAX_SPEED, BASE_SPEED + float(level) * 26.0)
		score_changed.emit(score, multiplier)
		combo_changed.emit(combo)
		speed_changed.emit(level)
		Sfx.play("gate", 1.0 + minf(float(combo) * 0.01, 0.35))
	else:
		_on_hit()
	if lane != visual_lane:
		_player.set_lane(visual_lane)


func _resolve_pickup(pickup: Node2D) -> void:
	if Track.lane_of_x(_player.position.x, _size.x) != pickup.lane:
		return
	pickup.collect()
	match pickup.kind:
		1:
			_player.has_shield = true
		2:
			_slow_time = 4.0
		3:
			_player.prism_time = 5.0
		_:
			score += 25 * multiplier
			score_changed.emit(score, multiplier)
	var text: String = pickup.label()
	if text != "":
		powerup_collected.emit(text)
	Sfx.play("pickup")
	SaveData.vibrate(12)


func _on_hit() -> void:
	_shake = 1.0
	if _player.take_hit():
		combo = 0
		multiplier = 1
		combo_changed.emit(combo)
		shield_used.emit()
		Sfx.play("shield")
		SaveData.vibrate(40)
		return

	running = false
	Sfx.play("crash")
	Sfx.play("over")
	SaveData.vibrate(160)
	var record := SaveData.submit_run(score, gates_cleared)
	if record:
		Sfx.play("record")
	run_finished.emit(score, gates_cleared, record)


func _cull() -> void:
	for child in _field.get_children():
		if child == _player:
			continue
		if child.position.y > _size.y + 140.0:
			child.queue_free()


# --- input -------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if not running:
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			_touch_id = event.index
			_touch_start = event.position
			_touch_time = 0.0
			_dragging = false
			_steer_to(event.position.x)
		elif event.index == _touch_id:
			if not _dragging and _touch_time < TAP_TIME:
				_swap_color()
			_touch_id = -1
	elif event is InputEventScreenDrag and event.index == _touch_id:
		if _touch_start.distance_to(event.position) > TAP_SLOP:
			_dragging = true
		_steer_to(event.position.x)
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_LEFT, KEY_A:
				_player.set_lane(_player.lane - 1)
			KEY_RIGHT, KEY_D:
				_player.set_lane(_player.lane + 1)
			KEY_SPACE, KEY_UP, KEY_W:
				_swap_color()


func _steer_to(x: float) -> void:
	var lane := Track.lane_of_x(x, _size.x)
	if lane != _player.lane:
		_player.set_lane(lane)


func _swap_color() -> void:
	_player.cycle_color(1)
	Sfx.play("swap")
	SaveData.vibrate(8)
