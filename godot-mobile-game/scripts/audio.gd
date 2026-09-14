extends Node
## Fully procedural audio. Every sound effect and the music loop are synthesised
## into AudioStreamWAV buffers at boot, so the game ships with zero audio assets
## and the APK stays tiny.

const RATE := 22050
const VOICES := 6

var _sfx: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _next_voice := 0
var _music_player: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in VOICES:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_pool.append(p)
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Master"
	_music_player.volume_db = -11.0
	add_child(_music_player)

	_build_library()
	_music_player.stream = _build_music()
	if SaveData.music_on:
		_music_player.play()
	SaveData.settings_changed.connect(_on_settings_changed)


func _on_settings_changed() -> void:
	if SaveData.music_on and not _music_player.playing:
		_music_player.play()
	elif not SaveData.music_on and _music_player.playing:
		_music_player.stop()


func play(name: String, pitch: float = 1.0) -> void:
	if not SaveData.sfx_on or not _sfx.has(name):
		return
	var p: AudioStreamPlayer = _pool[_next_voice]
	_next_voice = (_next_voice + 1) % VOICES
	p.stream = _sfx[name]
	p.pitch_scale = pitch
	p.play()


func duck_music(active: bool) -> void:
	_music_player.volume_db = -24.0 if active else -11.0


# --- synthesis helpers -------------------------------------------------------

func _to_stream(buf: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(buf.size() * 2)
	for i in buf.size():
		var v: float = clampf(buf[i], -1.0, 1.0)
		bytes.encode_s16(i * 2, int(v * 32000.0))
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = RATE
	s.stereo = false
	s.data = bytes
	if loop:
		s.loop_mode = AudioStreamWAV.LOOP_FORWARD
		s.loop_begin = 0
		s.loop_end = buf.size()
	return s


## Adds one enveloped tone into `buf` starting at `start` seconds.
## wave: 0 = sine, 1 = square, 2 = saw, 3 = noise
func _tone(buf: PackedFloat32Array, start: float, dur: float, freq: float,
		amp: float, wave: int = 0, bend: float = 1.0, attack: float = 0.006) -> void:
	var first := int(start * RATE)
	var count := int(dur * RATE)
	var phase := 0.0
	for i in count:
		var idx := first + i
		if idx < 0 or idx >= buf.size():
			continue
		var t: float = float(i) / float(count)
		var f: float = freq * lerpf(1.0, bend, t)
		phase += TAU * f / float(RATE)
		var s: float
		match wave:
			1: s = 1.0 if sin(phase) >= 0.0 else -1.0
			2: s = fmod(phase, TAU) / PI - 1.0
			3: s = randf() * 2.0 - 1.0
			_: s = sin(phase)
		# Percussive envelope: short attack, exponential decay.
		var env: float = minf(t / maxf(attack / maxf(dur, 0.0001), 0.0001), 1.0)
		env *= pow(1.0 - t, 1.6)
		buf[idx] += s * amp * env


func _make(dur: float) -> PackedFloat32Array:
	var buf := PackedFloat32Array()
	buf.resize(int(dur * RATE))
	buf.fill(0.0)
	return buf


func _build_library() -> void:
	# Colour swap: clean short blip.
	var b := _make(0.10)
	_tone(b, 0.0, 0.09, 720.0, 0.32, 1, 1.25)
	_sfx["swap"] = _to_stream(b)

	# Gate cleared: rising two-step chime.
	b = _make(0.16)
	_tone(b, 0.0, 0.07, 880.0, 0.22, 0)
	_tone(b, 0.05, 0.10, 1318.0, 0.20, 0)
	_sfx["gate"] = _to_stream(b)

	# Pickup: bright arpeggio.
	b = _make(0.30)
	_tone(b, 0.00, 0.10, 784.0, 0.24, 1)
	_tone(b, 0.07, 0.10, 1046.0, 0.22, 1)
	_tone(b, 0.14, 0.14, 1568.0, 0.20, 1)
	_sfx["pickup"] = _to_stream(b)

	# Shield absorbs a hit.
	b = _make(0.35)
	_tone(b, 0.0, 0.30, 320.0, 0.30, 2, 2.2)
	_tone(b, 0.0, 0.18, 1200.0, 0.10, 3)
	_sfx["shield"] = _to_stream(b)

	# Crash.
	b = _make(0.55)
	_tone(b, 0.0, 0.50, 180.0, 0.40, 2, 0.35)
	_tone(b, 0.0, 0.25, 90.0, 0.35, 3)
	_sfx["crash"] = _to_stream(b)

	# Run over.
	b = _make(0.90)
	_tone(b, 0.00, 0.28, 440.0, 0.26, 1)
	_tone(b, 0.22, 0.28, 349.0, 0.26, 1)
	_tone(b, 0.44, 0.45, 261.0, 0.28, 1)
	_sfx["over"] = _to_stream(b)

	# New record fanfare.
	b = _make(0.95)
	_tone(b, 0.00, 0.20, 523.0, 0.24, 1)
	_tone(b, 0.15, 0.20, 659.0, 0.24, 1)
	_tone(b, 0.30, 0.20, 784.0, 0.24, 1)
	_tone(b, 0.45, 0.45, 1046.0, 0.28, 1)
	_sfx["record"] = _to_stream(b)

	# UI tick.
	b = _make(0.07)
	_tone(b, 0.0, 0.06, 520.0, 0.20, 1)
	_sfx["ui"] = _to_stream(b)


## Four-bar loop in A minor at 126 BPM: kick, bass, and a drifting arpeggio.
func _build_music() -> AudioStreamWAV:
	var beat := 60.0 / 126.0
	var bars := 4
	var total := beat * 4.0 * float(bars)
	var buf := _make(total)
	var arp := [440.0, 523.25, 659.25, 880.0, 659.25, 523.25]
	var bass := [110.0, 110.0, 146.83, 130.81]

	for bar in bars:
		var bar_t := beat * 4.0 * float(bar)
		# Kick on every beat, softer off-beat.
		for beat_i in 4:
			var t := bar_t + beat * float(beat_i)
			_tone(buf, t, 0.16, 120.0, 0.34, 0, 0.35)
			_tone(buf, t + beat * 0.5, 0.05, 2400.0, 0.035, 3)
		# Sustained bass note per bar.
		_tone(buf, bar_t, beat * 3.6, bass[bar], 0.20, 2, 1.0, 0.05)
		# Sixteenth-note arpeggio.
		for step in 8:
			var t := bar_t + beat * 0.5 * float(step)
			var note: float = arp[(bar * 2 + step) % arp.size()]
			_tone(buf, t, beat * 0.45, note, 0.085, 1)

	# Soft-clip so the mix never distorts on phone speakers.
	for i in buf.size():
		buf[i] = tanh(buf[i] * 1.4) * 0.72
	return _to_stream(buf, true)


func shutdown() -> void:
	## Called before the app quits so the synthesised buffers are released
	## while the audio server is still alive.
	_music_player.stop()
	_music_player.stream = null
	for p in _pool:
		p.stop()
		p.stream = null
	_sfx.clear()


func _exit_tree() -> void:
	shutdown()
