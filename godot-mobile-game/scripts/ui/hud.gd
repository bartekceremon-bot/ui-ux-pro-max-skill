extends Control
## In-run overlay: score, multiplier, current colour, power-up toasts.
## Everything except the pause button ignores touch so the playfield keeps it.

signal pause_pressed

var _toast_tween: Tween
var _hint_hidden := false


func _ready() -> void:
	UIKit.title(%Score, 74, Palette.INK)
	UIKit.body(%Multi, 30, Palette.AMBER)
	UIKit.body(%Toast, 40, Palette.INK)
	UIKit.body(%Hint, 22, Palette.MUTED)
	UIKit.ghost_button(%Pause)
	%Pause.add_theme_font_size_override("font_size", 32)

	for m in [%Top, %Bottom]:
		m.add_theme_constant_override("margin_left", 28)
		m.add_theme_constant_override("margin_right", 28)
		m.add_theme_constant_override("margin_top", 24)
		m.add_theme_constant_override("margin_bottom", 24)

	%Toast.modulate.a = 0.0
	%Pause.pressed.connect(func() -> void:
		Sfx.play("ui")
		pause_pressed.emit())
	set_color(0)


func reset() -> void:
	set_score(0, 1)
	set_color(0)
	%Flash.color = Color(1, 1, 1, 0)
	%Toast.modulate.a = 0.0
	%Hint.visible = not _hint_hidden


func set_score(value: int, multiplier: int) -> void:
	%Score.text = str(value)
	%Multi.text = "x%d" % multiplier
	%Multi.add_theme_color_override(
		"font_color", Palette.AMBER if multiplier > 1 else Palette.MUTED)


func set_color(index: int) -> void:
	var dots := %Dots.get_children()
	for i in dots.size():
		var sb := StyleBoxFlat.new()
		sb.set_corner_radius_all(19)
		var c: Color = Palette.color_of(i)
		if i == index:
			sb.bg_color = c
			sb.border_color = Color.WHITE
			sb.set_border_width_all(3)
		else:
			sb.bg_color = Color(c.r, c.g, c.b, 0.18)
			sb.border_color = Color(c.r, c.g, c.b, 0.45)
			sb.set_border_width_all(2)
		dots[i].add_theme_stylebox_override("panel", sb)


func hide_hint() -> void:
	_hint_hidden = true
	%Hint.visible = false


func toast(text: String, color: Color = Palette.INK) -> void:
	%Toast.text = text
	%Toast.add_theme_color_override("font_color", color)
	if _toast_tween and _toast_tween.is_valid():
		_toast_tween.kill()
	%Toast.modulate.a = 1.0
	%Toast.scale = Vector2.ONE
	_toast_tween = create_tween()
	_toast_tween.tween_interval(0.7)
	_toast_tween.tween_property(%Toast, "modulate:a", 0.0, 0.45)


func flash(color: Color, strength: float = 0.5) -> void:
	%Flash.color = Color(color.r, color.g, color.b, strength)
	var t := create_tween()
	t.tween_property(%Flash, "color:a", 0.0, 0.35)


func apply_insets(top: float, bottom: float) -> void:
	%Top.add_theme_constant_override("margin_top", int(24.0 + top))
	%Bottom.add_theme_constant_override("margin_bottom", int(24.0 + bottom))
