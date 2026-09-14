extends Node
## Headless UI walk: presses every button on every screen, plus in-run taps and
## keys, so a broken signal or a bad node path fails the build instead of the
## phone. Exits non-zero if any screen fails to open.

var _main: Node
var _game: Node2D
var _ui: CanvasLayer
var _failures: Array[String] = []


func _ready() -> void:
	_main = preload("res://scenes/main.tscn").instantiate()
	add_child(_main)
	_game = _main.get_node("Game")
	_ui = _main.get_node("UI")
	await _wait(0.4)

	var menu := _ui.get_node("Menu")
	var over := _ui.get_node("GameOver")
	var pause := _ui.get_node("Pause")
	var settings: Control = null
	for child in _ui.get_children():
		if child.has_signal("closed"):
			settings = child
	_expect(settings != null, "settings screen was not instantiated")

	# Menu: rules card.
	menu.get_node("%HowTo").pressed.emit()
	await _wait(0.2)
	_expect(menu.get_node("%Help").visible, "rules card did not open")
	menu.get_node("%HelpClose").pressed.emit()
	await _wait(0.2)
	_expect(not menu.get_node("%Help").visible, "rules card did not close")

	# Menu: settings, and every toggle in both directions.
	menu.get_node("%Settings").pressed.emit()
	await _wait(0.2)
	_expect(settings.visible, "settings did not open")
	for name in ["%Music", "%SfxBtn", "%Haptics", "%Reduced"]:
		var button: Button = settings.get_node(name)
		button.button_pressed = not button.button_pressed
		await _wait(0.1)
		button.button_pressed = not button.button_pressed
		await _wait(0.1)
	settings.get_node("%Back").pressed.emit()
	await _wait(0.2)
	_expect(menu.visible, "settings did not return to the menu")

	# Play, steer with taps and keys, then pause and resume.
	menu.get_node("%Play").pressed.emit()
	await _wait(0.3)
	_expect(_game.running, "run did not start")
	var w: float = _game.get_viewport_rect().size.x
	var h: float = _game.get_viewport_rect().size.y
	for x in [w * 0.1, w * 0.9, w * 0.5, w * 0.99, w * 0.01]:
		_tap(Vector2(x, h * 0.6))
		await _wait(0.12)
	for key in [KEY_LEFT, KEY_RIGHT, KEY_LEFT, KEY_LEFT, KEY_RIGHT, KEY_RIGHT, KEY_SPACE]:
		_key(key)
		await _wait(0.1)

	if _game.running:
		_ui.get_node("HUD").get_node("%Pause").pressed.emit()
		await _wait(0.2)
		_expect(pause.visible, "pause did not open")
		pause.get_node("%Resume").pressed.emit()
		await _wait(0.2)
		_expect(not pause.visible, "pause did not close")

	# Play until the run ends, then walk the summary card.
	var guard := 0
	while _game.running and guard < 2000:
		await get_tree().process_frame
		guard += 1
	await _wait(1.0)
	_expect(over.visible, "game over card did not open")
	over.get_node("%Retry").pressed.emit()
	await _wait(0.4)
	_expect(_game.running, "retry did not restart the run")
	_main.call("_to_menu")
	await _wait(0.3)
	_expect(menu.visible, "could not get back to the menu")

	if _failures.is_empty():
		print("[ui] PASS")
		get_tree().quit(0)
	else:
		for f in _failures:
			printerr("[ui] FAIL ", f)
		get_tree().quit(1)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _wait(seconds: float) -> void:
	var left := seconds
	while left > 0.0:
		await get_tree().process_frame
		left -= get_process_delta_time()


func _tap(pos: Vector2) -> void:
	for pressed in [true, false]:
		var e := InputEventScreenTouch.new()
		e.index = 0
		e.pressed = pressed
		e.position = pos
		Input.parse_input_event(e)


func _key(code: int) -> void:
	for pressed in [true, false]:
		var e := InputEventKey.new()
		e.keycode = code
		e.physical_keycode = code
		e.pressed = pressed
		Input.parse_input_event(e)
