extends Node
## Headless smoke test. Boots the gameplay scene, drives it with an autopilot
## that reads the incoming gates, and asserts the loop actually scores.
##
##   godot --headless --path . tests/smoke.tscn
##
## Exits with code 0 on success, 1 on failure, so CI can gate on it.

const RUN_SECONDS := 20.0

var _game: Node2D
var _player: Node2D
var _elapsed := 0.0
var _finished := false
var _deaths := 0
var _best := 0


func _ready() -> void:
	_game = preload("res://scenes/game.tscn").instantiate()
	add_child(_game)
	_player = _game.get_node("Field/Player")
	_game.run_finished.connect(_on_run_finished)
	_game.start_run()
	print("[smoke] run started")


func _process(delta: float) -> void:
	if _finished:
		return
	_elapsed += delta
	if _game.running:
		_autopilot()
		_best = maxi(_best, _game.score)
	if _elapsed >= RUN_SECONDS:
		_report()


func _on_run_finished(score: int, gates: int, _record: bool) -> void:
	_deaths += 1
	_best = maxi(_best, score)
	print("[smoke] run ended  score=%d gates=%d deaths=%d" % [score, gates, _deaths])
	if _deaths >= 6:
		_report()
		return
	_game.start_run()


## Picks the lane and colour that clears the next gate in front of the ship.
func _autopilot() -> void:
	var width: float = _game.get_viewport_rect().size.x
	var player_y: float = _player.position.y
	var target: Node2D = null
	var best_gap := INF
	for child in _game.get_node("Field").get_children():
		if child == _player or child.resolved:
			continue
		if not child.has_method("mark_cleared"):
			continue
		var gap: float = player_y - child.position.y
		if gap > 0.0 and gap < best_gap:
			best_gap = gap
			target = child
	if target == null:
		return
	var here := Track.lane_of_x(_player.position.x, width)
	if target.cells[here] != Palette.WALL_CELL:
		_player.color_index = target.cells[here]
		return
	for lane in Track.LANES:
		if target.cells[lane] != Palette.WALL_CELL:
			_player.set_lane(lane)
			_player.color_index = target.cells[lane]
			return


func _report() -> void:
	_finished = true
	var ok: bool = _best > 0
	print("[smoke] best score = %d over %.0fs, %d runs" % [_best, _elapsed, _deaths + 1])
	if ok:
		print("[smoke] PASS")
		get_tree().quit(0)
	else:
		printerr("[smoke] FAIL - the autopilot never scored")
		get_tree().quit(1)
