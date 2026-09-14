extends Node
## Capture harness: boots the real app, drives it, and writes PNGs of the
## menu, a live run and the game-over card. Used to review the look without a
## device.
##
##   xvfb-run godot --path . tools/screenshot.tscn

const SHOT_DIR := "res://build/shots"

var _main: Node
var _game: Node2D
var _player: Node2D


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(SHOT_DIR))
	_main = preload("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_game = _main.get_node("Game")
	_player = _game.get_node("Field/Player")
	await get_tree().create_timer(0.8).timeout
	await _shoot("01_menu.png")

	_main.call("_start_run")
	await _play(7.0)
	await _shoot("02_run.png")

	await _play(9.0)
	await _shoot("03_run_fast.png")

	# Force the end of the run to capture the summary card.
	_player.has_shield = false
	_player.color_index = -99
	await _play(3.0)
	await get_tree().create_timer(1.0).timeout
	await _shoot("04_game_over.png")

	print("[shots] done")
	get_tree().quit(0)


## Runs the game for `seconds` while an autopilot keeps the ship alive.
func _play(seconds: float) -> void:
	var left := seconds
	while left > 0.0:
		await get_tree().process_frame
		left -= get_process_delta_time()
		if _game.running and _player.color_index >= 0:
			_autopilot()


func _autopilot() -> void:
	var width: float = _game.get_viewport_rect().size.x
	var target: Node2D = null
	var best := INF
	for child in _game.get_node("Field").get_children():
		if child == _player or child.resolved or not child.has_method("mark_cleared"):
			continue
		var gap: float = _player.position.y - child.position.y
		if gap > 0.0 and gap < best:
			best = gap
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


func _shoot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	var path := ProjectSettings.globalize_path(SHOT_DIR.path_join(name))
	image.save_png(path)
	print("[shots] wrote ", path, " ", image.get_size())
