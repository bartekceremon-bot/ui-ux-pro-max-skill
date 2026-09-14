extends Control
## End-of-run summary with a one-tap retry, which is the only button that
## matters on a phone.

signal retry_pressed
signal quit_pressed

var _pulse: Tween


func _ready() -> void:
	UIKit.panel(%Panel, Palette.MAGENTA)
	UIKit.title(%Title, 52, Palette.INK)
	UIKit.title(%Score, 96, Palette.AMBER)
	UIKit.body(%Record, 28, Palette.MAGENTA)
	UIKit.body(%Detail, 24, Palette.MUTED)
	UIKit.primary_button(%Retry, Palette.MAGENTA)
	UIKit.ghost_button(%Quit)
	%Retry.pressed.connect(func() -> void:
		Sfx.play("ui")
		retry_pressed.emit())
	%Quit.pressed.connect(func() -> void:
		Sfx.play("ui")
		quit_pressed.emit())


func show_result(score: int, gates: int, record: bool) -> void:
	%Score.text = str(score)
	%Detail.text = "%d gates  ·  best %d" % [gates, SaveData.best_score]
	%Record.visible = record
	if _pulse and _pulse.is_valid():
		_pulse.kill()
	if record:
		_pulse = create_tween().set_loops()
		_pulse.tween_property(%Record, "modulate:a", 0.35, 0.5)
		_pulse.tween_property(%Record, "modulate:a", 1.0, 0.5)
