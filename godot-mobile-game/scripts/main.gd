extends Node
## App shell: screen flow, Android back gesture, focus loss, notch insets.

enum Screen { MENU, PLAYING, PAUSED, OVER, SETTINGS }

const SETTINGS_SCENE := preload("res://scenes/ui/settings.tscn")

var _screen: int = Screen.MENU
var _settings: Control
var _shown_color: int = -1

@onready var _game: Node2D = $Game
@onready var _ui: CanvasLayer = $UI
@onready var _hud: Control = $UI/HUD
@onready var _menu: Control = $UI/Menu
@onready var _pause: Control = $UI/Pause
@onready var _over: Control = $UI/GameOver


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_settings = SETTINGS_SCENE.instantiate()
	_settings.visible = false
	_ui.add_child(_settings)

	_menu.play_pressed.connect(_start_run)
	_menu.settings_pressed.connect(_open_settings)
	_hud.pause_pressed.connect(_pause_run)
	_pause.resume_pressed.connect(_resume_run)
	_pause.restart_pressed.connect(_start_run)
	_pause.quit_pressed.connect(_to_menu)
	_over.retry_pressed.connect(_start_run)
	_over.quit_pressed.connect(_to_menu)
	_settings.closed.connect(_close_settings)

	_game.score_changed.connect(_on_score_changed)
	_game.powerup_collected.connect(_on_powerup)
	_game.shield_used.connect(_on_shield_used)
	_game.run_finished.connect(_on_run_finished)

	get_viewport().size_changed.connect(_apply_insets)
	_apply_insets()
	_to_menu()


func _process(_delta: float) -> void:
	if _screen != Screen.PLAYING:
		return
	var index: int = _game.get_node("Field/Player").color_index
	if index != _shown_color:
		_shown_color = index
		_hud.set_color(index)


# --- screen flow -------------------------------------------------------------

func _show(screen: int) -> void:
	_screen = screen
	_menu.visible = screen == Screen.MENU
	_hud.visible = screen in [Screen.PLAYING, Screen.PAUSED, Screen.OVER]
	_pause.visible = screen == Screen.PAUSED
	_over.visible = screen == Screen.OVER
	_settings.visible = screen == Screen.SETTINGS
	get_tree().paused = screen == Screen.PAUSED
	Sfx.duck_music(screen != Screen.PLAYING)


func _to_menu() -> void:
	_game.stop_run()
	_menu.refresh()
	_show(Screen.MENU)


func _start_run() -> void:
	get_tree().paused = false
	_hud.reset()
	_shown_color = 0
	_game.start_run()
	_show(Screen.PLAYING)


func _pause_run() -> void:
	if _screen != Screen.PLAYING:
		return
	_pause.show_with(_game.score, _game.gates_cleared)
	_show(Screen.PAUSED)


func _resume_run() -> void:
	if _screen != Screen.PAUSED:
		return
	_show(Screen.PLAYING)


func _open_settings() -> void:
	_settings.refresh()
	_show(Screen.SETTINGS)


func _close_settings() -> void:
	_to_menu()


# --- game signals ------------------------------------------------------------

func _on_score_changed(score: int, multiplier: int) -> void:
	_hud.set_score(score, multiplier)
	if score >= 60:
		_hud.hide_hint()


func _on_powerup(label: String) -> void:
	_hud.toast(label, Palette.AMBER)


func _on_shield_used() -> void:
	_hud.flash(Palette.INK, 0.35)
	_hud.toast("SHIELD DOWN", Palette.INK)


func _on_run_finished(score: int, gates: int, record: bool) -> void:
	_hud.flash(Palette.MAGENTA, 0.55)
	_over.show_result(score, gates, record)
	await get_tree().create_timer(0.45).timeout
	if _screen == Screen.PLAYING:
		_show(Screen.OVER)


# --- platform integration ----------------------------------------------------

func _notification(what: int) -> void:
	match what:
		NOTIFICATION_WM_GO_BACK_REQUEST:
			_handle_back()
		NOTIFICATION_WM_CLOSE_REQUEST:
			_quit()
		NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_APPLICATION_PAUSED:
			if _screen == Screen.PLAYING:
				_pause_run()


func _handle_back() -> void:
	match _screen:
		Screen.SETTINGS:
			_close_settings()
		Screen.PLAYING:
			_pause_run()
		Screen.PAUSED:
			_resume_run()
		Screen.OVER:
			_to_menu()
		_:
			_quit()


func _quit() -> void:
	Sfx.shutdown()
	get_tree().quit()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			_handle_back()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_ENTER and _screen in [Screen.MENU, Screen.OVER]:
			_start_run()


## Keeps the HUD and menu clear of notches, punch-holes and gesture bars.
func _apply_insets() -> void:
	var view: Vector2 = get_viewport().get_visible_rect().size
	var window := Vector2(DisplayServer.window_get_size())
	var top := 0.0
	var bottom := 0.0
	if window.x > 0.0 and window.y > 0.0:
		var safe := DisplayServer.get_display_safe_area()
		var sy := view.y / window.y
		top = maxf(0.0, float(safe.position.y) * sy)
		bottom = maxf(0.0, float(window.y - safe.end.y) * sy)
	_hud.apply_insets(top, bottom)
	_menu.apply_insets(top, bottom)
