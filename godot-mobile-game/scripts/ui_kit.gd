class_name UIKit
extends RefCounted
## One place for the visual language of every button, panel and label, so the
## scenes stay plain and the look stays consistent.

const TOUCH_MIN := 64  # Minimum comfortable tap target in project pixels.


static func _box(bg: Color, border: Color, width: int, radius: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(width)
	sb.set_corner_radius_all(radius)
	sb.content_margin_left = 26
	sb.content_margin_right = 26
	sb.content_margin_top = 18
	sb.content_margin_bottom = 18
	return sb


static func primary_button(b: Button, accent: Color = Palette.CYAN) -> void:
	var idle := accent
	idle.a = 0.16
	var hover := accent
	hover.a = 0.28
	var press := accent
	press.a = 0.42
	b.add_theme_stylebox_override("normal", _box(idle, accent, 2, 18))
	b.add_theme_stylebox_override("hover", _box(hover, accent, 2, 18))
	b.add_theme_stylebox_override("pressed", _box(press, accent.lightened(0.2), 3, 18))
	b.add_theme_stylebox_override("focus", _box(hover, accent, 2, 18))
	b.add_theme_stylebox_override("disabled", _box(Color(1, 1, 1, 0.05), Palette.MUTED, 2, 18))
	b.add_theme_color_override("font_color", Palette.INK)
	b.add_theme_color_override("font_hover_color", Color.WHITE)
	b.add_theme_color_override("font_pressed_color", Color.WHITE)
	b.add_theme_font_size_override("font_size", 34)
	b.custom_minimum_size.y = maxf(b.custom_minimum_size.y, TOUCH_MIN + 16)


static func ghost_button(b: Button) -> void:
	var sb := _box(Color(1, 1, 1, 0.04), Color(1, 1, 1, 0.14), 1, 16)
	b.add_theme_stylebox_override("normal", sb)
	b.add_theme_stylebox_override("hover", _box(Color(1, 1, 1, 0.09), Palette.MUTED, 1, 16))
	b.add_theme_stylebox_override("pressed", _box(Color(1, 1, 1, 0.14), Palette.INK, 1, 16))
	b.add_theme_stylebox_override("focus", sb)
	b.add_theme_color_override("font_color", Palette.MUTED)
	b.add_theme_color_override("font_hover_color", Palette.INK)
	b.add_theme_font_size_override("font_size", 26)
	b.custom_minimum_size.y = maxf(b.custom_minimum_size.y, TOUCH_MIN)


static func panel(p: PanelContainer, accent: Color = Palette.CYAN) -> void:
	var sb := _box(Color(0.03, 0.04, 0.10, 0.92), accent, 2, 26)
	sb.content_margin_left = 30
	sb.content_margin_right = 30
	sb.content_margin_top = 30
	sb.content_margin_bottom = 30
	sb.shadow_color = Color(0, 0, 0, 0.5)
	sb.shadow_size = 18
	p.add_theme_stylebox_override("panel", sb)


static func title(l: Label, size: int = 82, color: Color = Palette.INK) -> void:
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_constant_override("outline_size", 0)


static func body(l: Label, size: int = 26, color: Color = Palette.MUTED) -> void:
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
