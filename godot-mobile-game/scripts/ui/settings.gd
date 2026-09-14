extends Control
## Settings sheet. Each row is a full-width toggle so it stays thumb-friendly.

signal closed

var _rows: Array = []


func _ready() -> void:
	UIKit.panel(%Panel, Palette.AMBER)
	UIKit.title(%Title, 48, Palette.INK)
	UIKit.body(%Note, 21, Palette.MUTED)
	UIKit.primary_button(%Back, Palette.AMBER)

	_rows = [
		[%Music, "music_on", "MUSIC"],
		[%SfxBtn, "sfx_on", "SOUND"],
		[%Haptics, "haptics_on", "VIBRATION"],
		[%Reduced, "reduced_effects", "REDUCED EFFECTS"],
	]
	for row in _rows:
		var button: Button = row[0]
		var key: String = row[1]
		UIKit.ghost_button(button)
		button.add_theme_font_size_override("font_size", 24)
		button.toggled.connect(func(pressed: bool) -> void:
			Sfx.play("ui")
			SaveData.set_setting(key, pressed)
			_paint(button, row[2], pressed))

	%Back.pressed.connect(func() -> void:
		Sfx.play("ui")
		closed.emit())


func refresh() -> void:
	for row in _rows:
		var button: Button = row[0]
		var value: bool = SaveData.get(row[1])
		button.set_pressed_no_signal(value)
		_paint(button, row[2], value)


func _paint(button: Button, label: String, on: bool) -> void:
	button.text = "%s      %s" % [label, "ON" if on else "OFF"]
	button.add_theme_color_override("font_color", Palette.INK if on else Palette.MUTED)
	button.add_theme_color_override("font_hover_color", Palette.INK)
