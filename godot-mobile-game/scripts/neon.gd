class_name Neon
extends RefCounted
## Additive-looking glow faked with stacked translucent draws. Works on every
## renderer including GL Compatibility on low-end phones, and costs nothing
## beyond a handful of extra quads.

static func rect(ci: CanvasItem, r: Rect2, color: Color, layers: int = 4, spread: float = 5.0) -> void:
	for i in range(layers, 0, -1):
		var g: float = spread * float(i)
		var c := color
		c.a = color.a * 0.10 * (1.0 - float(i - 1) / float(layers))
		ci.draw_rect(r.grow(g), c, true)
	ci.draw_rect(r, color, true)


static func outline(ci: CanvasItem, r: Rect2, color: Color, width: float = 2.0, layers: int = 3, spread: float = 4.0) -> void:
	for i in range(layers, 0, -1):
		var c := color
		c.a = color.a * 0.13
		ci.draw_rect(r.grow(spread * float(i)), c, false, width + spread * float(i) * 0.5)
	ci.draw_rect(r, color, false, width)


static func polygon(ci: CanvasItem, pts: PackedVector2Array, color: Color, layers: int = 4, spread: float = 0.10) -> void:
	var centroid := Vector2.ZERO
	for p in pts:
		centroid += p
	centroid /= float(pts.size())
	for i in range(layers, 0, -1):
		var scale: float = 1.0 + spread * float(i)
		var big := PackedVector2Array()
		for p in pts:
			big.append(centroid + (p - centroid) * scale)
		var c := color
		c.a = color.a * 0.11 * (1.0 - float(i - 1) / float(layers))
		ci.draw_colored_polygon(big, c)
	ci.draw_colored_polygon(pts, color)


static func line(ci: CanvasItem, a: Vector2, b: Vector2, color: Color, width: float = 3.0) -> void:
	var c := color
	c.a = color.a * 0.18
	ci.draw_line(a, b, c, width * 3.5, true)
	ci.draw_line(a, b, color, width, true)
