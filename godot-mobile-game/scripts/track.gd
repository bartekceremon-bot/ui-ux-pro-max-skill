class_name Track
extends RefCounted
## Lane geometry. The playfield is a fixed number of vertical lanes spread
## across whatever viewport width the phone reports.

const LANES := 3


static func lane_x(index: int, width: float) -> float:
	return width * (float(index) + 0.5) / float(LANES)


static func lane_width(width: float) -> float:
	return width / float(LANES)


static func lane_of_x(x: float, width: float) -> int:
	return clampi(int(floor(x / lane_width(width))), 0, LANES - 1)
