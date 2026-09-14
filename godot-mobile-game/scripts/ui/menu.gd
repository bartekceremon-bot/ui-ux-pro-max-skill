extends Control
## Title screen. Big single-thumb PLAY target, records, and a rules card.

signal play_pressed
signal settings_pressed


func _ready() -> void:
	UIKit.title(%Title, 84, Palette.INK)
	UIKit.body(%Tagline, 28, Palette.MUTED)
	UIKit.body(%Best, 34, Palette.AMBER)
	UIKit.body(%Stats, 20, Palette.MUTED)
	UIKit.primary_button(%Play, Palette.CYAN)
	UIKit.ghost_button(%HowTo)
	UIKit.ghost_button(%Settings)
	UIKit.panel(%Help, Palette.MAGENTA)
	UIKit.title(%HelpTitle, 40, Palette.MAGENTA)
	UIKit.body(%HelpBody, 26, Palette.INK)
	UIKit.ghost_button(%HelpClose)

	%HelpBody.text = _rules_text()

	%Play.pressed.connect(func() -> void:
		Sfx.play("ui")
		play_pressed.emit())
	%Settings.pressed.connect(func() -> void:
		Sfx.play("ui")
		settings_pressed.emit())
	%HowTo.pressed.connect(func() -> void:
		Sfx.play("ui")
		%Help.visible = true)
	%HelpClose.pressed.connect(func() -> void:
		Sfx.play("ui")
		%Help.visible = false)


func refresh() -> void:
	%Best.text = "BEST  %d" % SaveData.best_score
	if SaveData.total_runs > 0:
		var runs := "run" if SaveData.total_runs == 1 else "runs"
		%Stats.text = "%d %s  ·  %d gates cleared" % [SaveData.total_runs, runs, SaveData.total_gates]
	else:
		%Stats.text = ""
	%Help.visible = false


func _rules_text() -> String:
	return "\n".join([
		"DRAG anywhere to slide between the three lanes.",
		"TAP to cycle your ship through cyan, magenta and amber.",
		"A gate only lets you through where its colour matches yours.",
		"Grey walls are always solid.",
		"",
		"SHIELD absorbs one crash. SLOW-MO buys you a breath.",
		"PRISM makes every colour yours for five seconds.",
		"",
		"Every eight gates without a crash raises your multiplier.",
	])


func apply_insets(top: float, bottom: float) -> void:
	%Margin.add_theme_constant_override("margin_left", 40)
	%Margin.add_theme_constant_override("margin_right", 40)
	%Margin.add_theme_constant_override("margin_top", int(48.0 + top))
	%Margin.add_theme_constant_override("margin_bottom", int(48.0 + bottom))
