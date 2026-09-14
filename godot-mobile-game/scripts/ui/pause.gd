extends Control
## Pause overlay. Also the target of the Android back gesture mid-run.

signal resume_pressed
signal restart_pressed
signal quit_pressed


func _ready() -> void:
	UIKit.panel(%Panel, Palette.CYAN)
	UIKit.title(%Title, 56, Palette.INK)
	UIKit.body(%Info, 24, Palette.MUTED)
	UIKit.primary_button(%Resume, Palette.CYAN)
	UIKit.ghost_button(%Restart)
	UIKit.ghost_button(%Quit)
	%Resume.pressed.connect(func() -> void:
		Sfx.play("ui")
		resume_pressed.emit())
	%Restart.pressed.connect(func() -> void:
		Sfx.play("ui")
		restart_pressed.emit())
	%Quit.pressed.connect(func() -> void:
		Sfx.play("ui")
		quit_pressed.emit())


func show_with(score: int, gates: int) -> void:
	%Info.text = "score %d  ·  %d gates" % [score, gates]
