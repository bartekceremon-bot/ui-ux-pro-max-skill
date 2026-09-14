extends Node
## Persistent player profile: high score, settings, unlocked milestones.
## Stored in user:// so it survives app updates on Android and iOS.

const SAVE_PATH := "user://prism_run.cfg"

signal settings_changed

var best_score: int = 0
var total_runs: int = 0
var total_gates: int = 0
var music_on: bool = true
var sfx_on: bool = true
var haptics_on: bool = true
var reduced_effects: bool = false
var left_handed: bool = false

var _dirty := false


func _ready() -> void:
	load_profile()
	# Flush at most twice a second instead of on every change.
	var t := Timer.new()
	t.wait_time = 0.5
	t.autostart = true
	t.timeout.connect(_flush)
	add_child(t)


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		_flush()


func load_profile() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	best_score = int(cfg.get_value("progress", "best_score", 0))
	total_runs = int(cfg.get_value("progress", "total_runs", 0))
	total_gates = int(cfg.get_value("progress", "total_gates", 0))
	music_on = bool(cfg.get_value("settings", "music_on", true))
	sfx_on = bool(cfg.get_value("settings", "sfx_on", true))
	haptics_on = bool(cfg.get_value("settings", "haptics_on", true))
	reduced_effects = bool(cfg.get_value("settings", "reduced_effects", false))
	left_handed = bool(cfg.get_value("settings", "left_handed", false))


func _flush() -> void:
	if not _dirty:
		return
	_dirty = false
	var cfg := ConfigFile.new()
	cfg.set_value("progress", "best_score", best_score)
	cfg.set_value("progress", "total_runs", total_runs)
	cfg.set_value("progress", "total_gates", total_gates)
	cfg.set_value("settings", "music_on", music_on)
	cfg.set_value("settings", "sfx_on", sfx_on)
	cfg.set_value("settings", "haptics_on", haptics_on)
	cfg.set_value("settings", "reduced_effects", reduced_effects)
	cfg.set_value("settings", "left_handed", left_handed)
	cfg.save(SAVE_PATH)


func mark_dirty() -> void:
	_dirty = true


## Returns true when this run beat the stored record.
func submit_run(score: int, gates: int) -> bool:
	total_runs += 1
	total_gates += gates
	var record := score > best_score
	if record:
		best_score = score
	mark_dirty()
	return record


func set_setting(key: String, value: bool) -> void:
	if not (key in self):
		return
	set(key, value)
	mark_dirty()
	settings_changed.emit()


func vibrate(ms: int) -> void:
	if haptics_on and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)
