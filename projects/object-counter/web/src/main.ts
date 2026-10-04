/**
 * Licznik Obiektów -- app controller.
 *
 * camera -> (ImageBitmap) -> inference worker (YOLO-seg ONNX | Separator)
 *        -> detections -> tracker (+ global motion) -> overlay + counts
 */
import './styles.css';
import { Detector } from './engine/client';
import type { DetectOptions, Detection, ModelInfo } from './engine/types';
import { Tracker, type TrackView } from './tracking/tracker';
import { estimateMotion, grayFrom, type GrayFrame, type Motion } from './tracking/gmc';
import { containView, drawItems, drawRoi, readingOrder, type DrawItem } from './overlay';
import { PRESETS, loadOverride, resolve, saveOverride, type EngineChoice, type Preset, type Resolved } from './presets';
import { api, loadManifest, type Health } from './api';
import { history, samples, type Measurement, type Sample } from './store';
import { buildDatasetZip } from './dataset';
import { icons } from './icons';

// ------------------------------------------------------------------ helpers
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const setBtn = (id: string, icon: string, text: string) => { $(id).innerHTML = `${icons[icon] ?? ''}<span>${text}</span>`; };
let toastTimer = 0;
function toast(msg: string, ms = 2600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), ms);
}
const pct = (v: number | null) => (v == null ? '–' : `${Math.round(v * 100)}%`);
function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

// ------------------------------------------------------------------ settings
interface Settings { conf: number; sens: number; masks: boolean; showConf: boolean; server: boolean; backend: 'auto' | 'wasm'; preset: string }
const defaults: Settings = { conf: 0.35, sens: 0.5, masks: true, showConf: true, server: false, backend: 'auto', preset: 'boards' };
function loadSettings(): Settings {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('oc.settings') ?? '{}') }; } catch { return { ...defaults }; }
}
const settings = loadSettings();
const saveSettings = () => { try { localStorage.setItem('oc.settings', JSON.stringify(settings)); } catch { /* ignore */ } };

// ------------------------------------------------------------------ state
const video = $<HTMLVideoElement>('video');
const overlay = $<HTMLCanvasElement>('overlay');
const still = $<HTMLCanvasElement>('still');
const octx = overlay.getContext('2d')!;
const detector = new Detector();
const tracker = new Tracker();

let models: ModelInfo[] = [];
let health: Health | null = null;
let preset: Preset = PRESETS.find((p) => p.id === settings.preset) ?? PRESETS[0];
let resolved: Resolved = resolve(preset, [], null);
let engineReady = false;
let engineLoading: Promise<void> | null = null;
let stream: MediaStream | null = null;
let liveViews: TrackView[] = [];
let lastFrame = { w: 0, h: 0 };
let prevGray: GrayFrame | null = null;
let prevMotion: Motion | null = null;
let fps = 0;
let lastResultT = 0;
let roi: { x1: number; y1: number; x2: number; y2: number } | null = null;
let roiMode = false;

interface Frozen {
  canvas: HTMLCanvasElement;
  items: (DrawItem & { cls: number })[];
  mode: 'freeze' | 'photo';
  engine: string;
}
let frozen: Frozen | null = null;

const gmcCanvas = document.createElement('canvas');
const gmcCtx = gmcCanvas.getContext('2d', { willReadFrequently: true })!;

// ------------------------------------------------------------------ engine
function engineLabel(): string {
  if (resolved.choice.engine === 'cv') return 'Separator (bez modelu)';
  const m = resolved.model!;
  const cls = resolved.classes ? resolved.classes.map((i) => m.classes[i]).slice(0, 3).join(', ') + (resolved.classes.length > 3 ? '…' : '') : 'wszystkie klasy';
  return `${m.name} · ${cls}`;
}

async function applyEngine() {
  resolved = resolve(preset, models, loadOverride(preset.id));
  engineReady = false;
  tracker.reset();
  liveViews = [];
  updateLabels();
  if (resolved.choice.engine === 'cv') {
    engineReady = true;
    $('engine-pill').textContent = 'Separator · CPU';
    return;
  }
  const m = resolved.model!;
  if (detector.model?.id === m.id) { engineReady = true; $('engine-pill').textContent = `${m.name} · ${detector.backend}`; return; }
  $('engine-pill').textContent = `Ładowanie ${m.name}…`;
  setStatus(`Ładowanie modelu AI „${m.name}” (${m.sizeMB ?? '?'} MB)…`);
  const p = (async () => {
    try {
      const b = await detector.load(m, `models/${m.file}`, settings.backend);
      engineReady = true;
      $('engine-pill').textContent = `${m.name} · ${b}`;
      setStatus(stream ? '' : 'Model gotowy. Włącz kamerę lub wczytaj zdjęcie.');
    } catch (e) {
      console.error(e);
      toast(`Nie udało się załadować modelu: ${(e as Error).message}. Używam Separatora.`, 5000);
      resolved = { choice: { engine: 'cv' }, model: null, classes: null, why: 'błąd modelu' };
      engineReady = true;
      $('engine-pill').textContent = 'Separator · CPU';
      updateLabels();
    }
  })();
  engineLoading = p;
  await p;
  engineLoading = null;
}

function detectOptions(accurate: boolean): DetectOptions {
  const conf = settings.conf;
  return {
    engine: resolved.choice.engine,
    // live: detector threshold low, the tracker separates strong/weak (ByteTrack)
    conf: accurate ? conf : Math.max(0.05, conf * 0.5),
    iou: 0.6,
    classes: resolved.classes,
    tiled: accurate,
    masks: settings.masks,
    agnostic: true,
    roi,
    cv: { sensitivity: settings.sens, polarity: 'auto' },
  };
}

// ------------------------------------------------------------------ camera
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Ta przeglądarka nie udostępnia kamery (wymagane HTTPS lub localhost). Możesz wczytać zdjęcie.');
    return;
  }
  try {
    setStatus('Uruchamianie kamery…');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    video.srcObject = stream;
    await video.play();
    $('start-panel').hidden = true;
    tracker.reset();
    prevGray = null;
    if (engineLoading) await engineLoading;
    loop();
  } catch (e) {
    const err = e as DOMException;
    setStatus(err.name === 'NotAllowedError' ? 'Brak zgody na kamerę. Zezwól w ustawieniach przeglądarki albo wczytaj zdjęcie.'
      : `Nie można uruchomić kamery: ${err.message}`);
  }
}

function setStatus(s: string) { $('status').textContent = s; }

function sizeOverlay() {
  const r = overlay.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (overlay.width !== w || overlay.height !== h) { overlay.width = w; overlay.height = h; }
}

let looping = false;
function loop() {
  if (looping) return;
  looping = true;
  const tick = () => {
    if (!stream) { looping = false; return; }
    if (!frozen && engineReady && !detector.busy && !cvBusy && video.readyState >= 2) void analyseLive();
    'requestVideoFrameCallback' in video
      ? (video as HTMLVideoElement & { requestVideoFrameCallback: (cb: () => void) => void }).requestVideoFrameCallback(tick)
      : requestAnimationFrame(tick);
  };
  tick();
}

let cvBusy = false;
async function analyseLive() {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  cvBusy = true;
  try {
    const bitmap = await createImageBitmap(video);
    const pending = detector.detect(bitmap, detectOptions(false));
    // camera motion, computed while the worker runs inference
    const gw = 160, gh = Math.round((160 * vh) / vw);
    gmcCanvas.width = gw; gmcCanvas.height = gh;
    gmcCtx.drawImage(video, 0, 0, gw, gh);
    const g = grayFrom(gmcCtx.getImageData(0, 0, gw, gh).data, gw, gh, 160);
    let motion: Motion | null = null;
    if (prevGray && prevGray.w === g.w && prevGray.h === g.h) {
      motion = estimateMotion(prevGray, g, prevMotion);
      const k = vw / gw; // gray px -> video px
      motion = { dx: motion.dx * k, dy: motion.dy * k, confidence: motion.confidence };
    }
    const res = await pending;
    prevGray = g;
    prevMotion = motion ? { dx: motion.dx / (vw / gw), dy: motion.dy / (vw / gw), confidence: motion.confidence } : null;
    if (frozen) return;
    liveViews = tracker.update(res.dets, res.width, res.height, motion && motion.confidence > 0.15 ? motion : null);
    lastFrame = { w: res.width, h: res.height };
    const now = performance.now();
    if (lastResultT) fps = fps ? fps * 0.8 + 0.2 * (1000 / (now - lastResultT)) : 1000 / (now - lastResultT);
    lastResultT = now;
    renderLive();
  } catch (e) {
    console.error(e);
  } finally {
    cvBusy = false;
  }
}

function renderLive() {
  sizeOverlay();
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!lastFrame.w) return;
  const v = containView(lastFrame.w, lastFrame.h, overlay.width, overlay.height);
  if (roi) drawRoi(octx, roi, v, lastFrame.w, lastFrame.h);
  const items: DrawItem[] = liveViews.map((t) => ({ num: t.id, x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2, score: t.score, mask: t.mask, predicted: t.predicted }));
  drawItems(octx, items, v, lastFrame.w, lastFrame.h, { masks: settings.masks, labels: true, conf: settings.showConf });
  const n = liveViews.length;
  const avg = n ? liveViews.reduce((s, t) => s + t.score, 0) / n : null;
  $('count-num').textContent = String(n);
  $('hud-count').textContent = String(n);
  $('hud-conf').textContent = pct(avg);
  $('hud-fps').textContent = fps ? fps.toFixed(fps < 10 ? 1 : 0) : '–';
  $('unique-num').textContent = String(tracker.uniqueCount);
}

// ------------------------------------------------------------------ count & freeze / photo
function busy(on: boolean, text = 'Analiza…') {
  $('busy').hidden = !on;
  $('busy-text').textContent = text;
}

/** Run the accurate (tiled) analysis on a still image and enter the frozen view. */
async function analyseStill(source: CanvasImageSource & { width?: number; height?: number }, w: number, h: number, mode: 'freeze' | 'photo') {
  if (engineLoading) { busy(true, 'Ładowanie modelu…'); await engineLoading; }
  still.width = w; still.height = h;
  const sctx = still.getContext('2d')!;
  sctx.drawImage(source, 0, 0, w, h);
  frozen = { canvas: still, items: [], mode, engine: engineLabel() };
  still.hidden = false;
  video.style.visibility = 'hidden';
  $('start-panel').hidden = true;
  showFrozenUi(true);
  busy(true, resolved.choice.engine === 'cv' ? 'Rozdzielanie obiektów…' : 'Dokładne liczenie (kafelki)…');
  try {
    let dets: Detection[];
    const t0 = performance.now();
    if (settings.server && health?.ok && resolved.model) {
      const blob = await new Promise<Blob>((r) => still.toBlob((b) => r(b!), 'image/jpeg', 0.92));
      const res = await api.serverDetect(blob, resolved.model.id, resolved.classes ? resolved.classes.map((i) => resolved.model!.classes[i]) : null, settings.conf);
      dets = res.dets;
      frozen.engine += ' · serwer';
    } else {
      const bmp = await createImageBitmap(still);
      const res = await detector.detect(bmp, detectOptions(true));
      dets = res.dets;
    }
    console.info(`still analysis: ${dets.length} objects in ${(performance.now() - t0).toFixed(0)} ms`);
    frozen.items = readingOrder(dets).map((d, i) => ({ num: i + 1, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, score: d.score, mask: d.mask, cls: d.cls }));
  } catch (e) {
    toast(`Błąd analizy: ${(e as Error).message}`, 5000);
  } finally {
    busy(false);
  }
  renderFrozen();
}

function renumber() {
  if (!frozen) return;
  let n = 0;
  const ordered = readingOrder(frozen.items.filter((i) => !i.removed));
  for (const it of ordered) it.num = ++n;
}

function renderFrozen() {
  if (!frozen) return;
  sizeOverlay();
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const v = containView(still.width, still.height, overlay.width, overlay.height);
  drawItems(octx, frozen.items, v, still.width, still.height, { masks: settings.masks, labels: true, conf: settings.showConf });
  const kept = frozen.items.filter((i) => !i.removed);
  const n = kept.length;
  const scored = kept.filter((i) => !i.manual);
  const avg = scored.length ? scored.reduce((s, i) => s + i.score, 0) / scored.length : null;
  $('count-num').textContent = String(n);
  $('frozen-num').textContent = String(n);
  $('frozen-word').textContent = plural(n, 'obiekt', 'obiekty', 'obiektów');
  $('hud-count').textContent = String(n);
  $('hud-conf').textContent = pct(avg);
}

function showFrozenUi(on: boolean) {
  $('actions-live').hidden = on;
  $('actions-frozen').hidden = !on;
  $('count-label').textContent = on ? 'WYNIK' : 'ZNALEZIONO';
  const b = $('mode-badge');
  b.textContent = on ? (frozen?.mode === 'photo' ? 'ZDJĘCIE' : 'ZATRZYMANO') : 'LIVE';
  b.classList.toggle('frozen', on);
  $('unique-wrap').hidden = on;
}

function unfreeze() {
  frozen = null;
  still.hidden = true;
  video.style.visibility = '';
  showFrozenUi(false);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!stream) { $('start-panel').hidden = false; $('count-num').textContent = '0'; }
  else renderLive();
}

async function countAndFreeze() {
  if (!stream || video.readyState < 2) { toast('Najpierw włącz kamerę (lub wczytaj zdjęcie).'); return; }
  await analyseStill(video, video.videoWidth, video.videoHeight, 'freeze');
}

async function takePhoto() {
  if (!stream) { $('file').click(); return; }
  const track = stream.getVideoTracks()[0];
  // full-resolution still when the platform supports it, else the video frame
  const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
  if (IC) {
    try {
      busy(true, 'Robienie zdjęcia…');
      const blob = await new IC(track).takePhoto();
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
      await analyseStill(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k), 'photo');
      bmp.close();
      return;
    } catch (e) {
      console.warn('takePhoto failed, using video frame', e);
    } finally { busy(false); }
  }
  await analyseStill(video, video.videoWidth, video.videoHeight, 'photo');
}

async function analyseFile(file: File) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
  await analyseStill(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k), 'photo');
  bmp.close();
}

async function snapshotThumb(maxSide = 480): Promise<Blob> {
  const k = Math.min(1, maxSide / Math.max(still.width, still.height));
  const c = document.createElement('canvas');
  c.width = Math.round(still.width * k); c.height = Math.round(still.height * k);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(still, 0, 0, c.width, c.height);
  if (frozen) drawItems(ctx, frozen.items.filter((i) => !i.removed), { scale: k, ox: 0, oy: 0 }, still.width, still.height, { masks: false, labels: frozen.items.length < 60, conf: false });
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8));
}

async function accept() {
  if (!frozen) return;
  const kept = frozen.items.filter((i) => !i.removed);
  const scored = kept.filter((i) => !i.manual);
  const m: Measurement = {
    date: new Date().toISOString(), presetId: preset.id, label: preset.id === 'custom' ? customName() : preset.label,
    count: kept.length, avgConf: scored.length ? scored.reduce((s, i) => s + i.score, 0) / scored.length : null,
    mode: frozen.mode, engine: frozen.engine, thumb: await snapshotThumb(),
  };
  const edits = frozen.items.filter((i) => i.removed || i.manual).length;
  if (edits) m.note = `ręczne poprawki: ${edits}`;
  await history.add(m);
  toast(`Zapisano: ${m.label} – ${m.count} szt.`);
  unfreeze();
}

/** tap on the frozen image: toggle a detection or add a missed object */
function frozenTap(cx: number, cy: number) {
  if (!frozen) return;
  const v = containView(still.width, still.height, overlay.width, overlay.height);
  const dpr = window.devicePixelRatio || 1;
  const x = (cx * dpr - v.ox) / v.scale, y = (cy * dpr - v.oy) / v.scale;
  if (x < 0 || y < 0 || x > still.width || y > still.height) return;
  const hits = frozen.items.filter((i) => x >= i.x1 && x <= i.x2 && y >= i.y1 && y <= i.y2)
    .sort((a, b) => (a.x2 - a.x1) * (a.y2 - a.y1) - (b.x2 - b.x1) * (b.y2 - b.y1));
  if (hits.length) {
    const it = hits[0];
    if (it.manual) frozen.items.splice(frozen.items.indexOf(it), 1);
    else it.removed = !it.removed;
  } else {
    const ref = frozen.items.filter((i) => !i.removed);
    const ws = ref.map((i) => i.x2 - i.x1).sort((a, b) => a - b), hs = ref.map((i) => i.y2 - i.y1).sort((a, b) => a - b);
    const w = ws.length ? ws[ws.length >> 1] : still.width / 10, h = hs.length ? hs[hs.length >> 1] : still.height / 10;
    frozen.items.push({ num: 0, x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2, score: 1, manual: true, cls: 0 });
  }
  renumber();
  renderFrozen();
}

// ------------------------------------------------------------------ ROI
let roiDrag: { x: number; y: number } | null = null;
function toSource(e: PointerEvent) {
  const r = overlay.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const v = containView(lastFrame.w || video.videoWidth, lastFrame.h || video.videoHeight, overlay.width, overlay.height);
  return { x: ((e.clientX - r.left) * dpr - v.ox) / v.scale, y: ((e.clientY - r.top) * dpr - v.oy) / v.scale };
}

overlay.addEventListener('pointerdown', (e) => {
  if (frozen) return;
  if (roiMode) { roiDrag = toSource(e); overlay.setPointerCapture(e.pointerId); }
});
overlay.addEventListener('pointermove', (e) => {
  if (!roiDrag) return;
  const p = toSource(e);
  roi = { x1: Math.min(roiDrag.x, p.x), y1: Math.min(roiDrag.y, p.y), x2: Math.max(roiDrag.x, p.x), y2: Math.max(roiDrag.y, p.y) };
  renderLive();
});
overlay.addEventListener('pointerup', (e) => {
  if (frozen) { const r = overlay.getBoundingClientRect(); frozenTap(e.clientX - r.left, e.clientY - r.top); return; }
  if (roiDrag) {
    roiDrag = null;
    if (roi && (roi.x2 - roi.x1 < 20 || roi.y2 - roi.y1 < 20)) roi = null;
    roiMode = false;
    $('btn-roi').classList.remove('active');
    tracker.reset();
    toast(roi ? 'Liczę tylko w zaznaczonym obszarze.' : 'Obszar usunięty.');
    updateRoiBtn();
  }
});
function updateRoiBtn() { setBtn('btn-roi', 'crop', roi ? 'Usuń obszar' : roiMode ? 'Przeciągnij na obrazie…' : 'Obszar liczenia'); }

// ------------------------------------------------------------------ object type dialog
function customName(): string {
  return (localStorage.getItem('oc.customName') || 'Własny obiekt').trim();
}

function updateLabels() {
  const typeText = preset.id === 'custom' ? customName().toUpperCase() : preset.label.toUpperCase();
  $('type-label').textContent = typeText;
  $('hud-obj').textContent = preset.id === 'custom' ? customName().toUpperCase() : preset.noun;
  $('engine-pill').title = `${engineLabel()} (${resolved.why})`;
}

function renderPresetGrid() {
  const grid = $('preset-grid');
  grid.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn preset';
    b.setAttribute('aria-pressed', String(p.id === preset.id));
    b.innerHTML = `${icons[p.icon]}<span>${p.label}</span>`;
    b.onclick = async () => {
      preset = p; settings.preset = p.id; saveSettings();
      renderPresetGrid();
      await applyEngine();
    };
    grid.appendChild(b);
  }
  $('custom-box').hidden = preset.id !== 'custom';
  ($('custom-text') as HTMLInputElement).value = localStorage.getItem('oc.customName') ?? '';
  $('custom-hint').textContent = health?.ok
    ? 'Serwer utworzy model open-vocabulary (YOLOE) dla tej nazwy i doda go do listy silników (~10–30 s).'
    : 'Bez serwera: wybierz poniżej model i klasę (np. „bottle” z COCO) albo Separator. Tworzenie modelu z nazwy wymaga backendu.';
  ($('btn-custom-make') as HTMLButtonElement).disabled = !health?.ok;
  renderEngineSelect();
}

function renderEngineSelect() {
  const sel = $<HTMLSelectElement>('engine-select');
  const override = loadOverride(preset.id);
  const auto = resolve(preset, models, null);
  sel.innerHTML = '';
  const add = (value: string, text: string) => { const o = document.createElement('option'); o.value = value; o.textContent = text; sel.appendChild(o); };
  add('auto', `Automatycznie → ${auto.choice.engine === 'cv' ? 'Separator' : auto.model!.name}`);
  for (const m of models) add(`yolo:${m.id}`, `${m.name}${m.source === 'trained' ? ' ★' : ''} (${m.classes.length} kl.)`);
  add('cv', 'Separator – bez modelu (czoła desek, rury)');
  sel.value = !override ? 'auto' : override.engine === 'cv' ? 'cv' : `yolo:${override.modelId}`;
  renderClassSelect();
}

function renderClassSelect() {
  const sel = $<HTMLSelectElement>('engine-select');
  const csel = $<HTMLSelectElement>('class-select');
  const v = sel.value;
  const show = v.startsWith('yolo:') || (v === 'auto' && resolved.choice.engine === 'yolo');
  csel.hidden = !show; $('class-label').hidden = !show;
  csel.innerHTML = '';
  if (show) {
    const m = v === 'auto' ? resolved.model! : models.find((x) => `yolo:${x.id}` === v)!;
    const chosen = new Set(resolved.model?.id === m.id && resolved.classes ? resolved.classes.map((i) => m.classes[i]) : []);
    m.classes.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; o.selected = chosen.has(c); csel.appendChild(o); });
    csel.disabled = v === 'auto';
  }
  const hint = resolved.choice.engine === 'cv'
    ? 'Separator działa bez AI: rozdziela elementy widoczne czołowo (deski, rury, kłody) po szczelinach między nimi. Najlepiej z zaznaczonym obszarem liczenia.'
    : `Aktywny: ${engineLabel()} – ${resolved.why}. Brak zaznaczonych klas = wszystkie klasy modelu.`;
  $('engine-hint').textContent = hint;
}

async function onEngineChange() {
  const v = $<HTMLSelectElement>('engine-select').value;
  let c: EngineChoice | null = null;
  if (v === 'cv') c = { engine: 'cv' };
  else if (v.startsWith('yolo:')) {
    const id = v.slice(5);
    const m = models.find((x) => x.id === id)!;
    const presetNames = new Set(preset.names.map((n) => n.toLowerCase()));
    const match = m.classes.filter((c2) => presetNames.has(c2.toLowerCase()));
    c = { engine: 'yolo', modelId: id, classNames: match };
  }
  saveOverride(preset.id, c);
  await applyEngine();
  renderClassSelect();
}

async function onClassChange() {
  const v = $<HTMLSelectElement>('engine-select').value;
  if (!v.startsWith('yolo:')) return;
  const names = [...$<HTMLSelectElement>('class-select').selectedOptions].map((o) => o.value);
  saveOverride(preset.id, { engine: 'yolo', modelId: v.slice(5), classNames: names });
  resolved = resolve(preset, models, loadOverride(preset.id));
  tracker.reset();
  updateLabels();
  renderClassSelect();
}

async function makeCustomModel() {
  const text = ($('custom-text') as HTMLInputElement).value.trim();
  if (!text) { toast('Wpisz nazwę obiektu.'); return; }
  localStorage.setItem('oc.customName', text);
  const btn = $<HTMLButtonElement>('btn-custom-make');
  btn.disabled = true; btn.textContent = 'Tworzenie…';
  try {
    const prompts = [...new Set([text, ...text.split(/[,;]/).map((s) => s.trim()).filter(Boolean)])];
    const m = await api.promptModel(prompts, `YOLOE: ${text}`);
    models = await loadManifest();
    saveOverride('custom', { engine: 'yolo', modelId: m.id, classNames: [] });
    await applyEngine();
    renderPresetGrid();
    toast(`Model „${text}” gotowy.`);
  } catch (e) {
    toast(`Serwer: ${(e as Error).message}`, 6000);
  } finally {
    btn.disabled = !health?.ok; btn.textContent = 'Utwórz model AI';
  }
}

// ------------------------------------------------------------------ history dialog
async function renderHistory() {
  const list = $('history-list');
  const items = await history.all();
  list.innerHTML = items.length ? '' : '<li class="empty">Brak zapisanych pomiarów.</li>';
  for (const m of items) {
    const li = document.createElement('li');
    const d = new Date(m.date);
    const date = d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const img = m.thumb ? `<img alt="" src="${URL.createObjectURL(m.thumb)}">` : '<span class="noimg"></span>';
    li.innerHTML = `${img}<div><div class="h-date">${date} ${time}</div><div class="h-type"></div><div class="h-date">${pct(m.avgConf)} śr. pewności${m.note ? ' · ' + m.note : ''}</div></div>
      <div style="text-align:right"><div class="h-count">${m.count} szt.</div><button type="button" class="link" aria-label="Usuń pomiar">Usuń</button></div>`;
    li.querySelector('.h-type')!.textContent = m.label;
    li.querySelector('button')!.addEventListener('click', async () => { await history.remove(m.id!); renderHistory(); });
    list.appendChild(li);
  }
}

async function exportCsv() {
  const items = await history.all();
  const rows = [['data', 'typ', 'liczba', 'srednia_pewnosc', 'tryb', 'silnik', 'uwagi']]
    .concat(items.map((m) => [m.date, m.label, String(m.count), m.avgConf == null ? '' : m.avgConf.toFixed(3), m.mode, m.engine, m.note ?? '']));
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv' }), `pomiary-${new Date().toISOString().slice(0, 10)}.csv`);
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ------------------------------------------------------------------ calibration
function calibClass(): string {
  const v = ($('calib-class') as HTMLInputElement).value.trim();
  if (v) return v;
  const defaultsByPreset: Record<string, string> = { boards: 'board', boxes: 'box', parcels: 'parcel', pallets: 'pallet', pipes: 'pipe' };
  return defaultsByPreset[preset.id] ?? (customName().toLowerCase().replace(/\s+/g, '_') || 'object');
}

async function renderCalib() {
  const all = await samples.all();
  const mine = all.filter((s) => s.presetId === preset.id);
  const nBoxes = mine.reduce((s, x) => s + x.boxes.length, 0);
  $('calib-stats').textContent = `${preset.label}: ${mine.length} zdjęć, ${nBoxes} oznaczonych obiektów. Wszystkie typy: ${all.length} zdjęć. Zalecane: ≥ 30 zdjęć / ≥ 300 obiektów.`;
  const list = $('calib-list');
  list.innerHTML = '';
  for (const s of mine.slice().reverse()) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<img alt="" src="${URL.createObjectURL(s.image)}"><span>${s.boxes.length}</span>`;
    b.onclick = () => openLabelEditor(s);
    list.appendChild(b);
  }
  ($('calib-class') as HTMLInputElement).placeholder = calibClass();
  ($('btn-calib-train') as HTMLButtonElement).disabled = !health?.ok;
}

/** Capture an image + pre-label it with the current engine (accurate mode), then let the user fix boxes. */
async function addSample(source: CanvasImageSource, w: number, h: number) {
  const k = Math.min(1, 1600 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  let boxes: number[][] = [];
  try {
    if (engineLoading) await engineLoading;
    const res = await detector.detect(await createImageBitmap(c), { ...detectOptions(true), masks: false, roi: null });
    boxes = res.dets.map((d) => [d.x1, d.y1, d.x2, d.y2]);
  } catch { /* label from scratch */ }
  const image = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
  const s: Sample = { date: new Date().toISOString(), presetId: preset.id, className: calibClass(), image, w: c.width, h: c.height, boxes };
  s.id = await samples.add(s);
  openLabelEditor(s);
}

let editing: { s: Sample; img: HTMLImageElement; boxes: number[][] } | null = null;
let drag: { x: number; y: number; cur?: { x: number; y: number } } | null = null;

function openLabelEditor(s: Sample) {
  const img = new Image();
  img.onload = () => {
    editing = { s, img, boxes: s.boxes.map((b) => b.slice()) };
    const cv = $<HTMLCanvasElement>('label-canvas');
    cv.width = s.w; cv.height = s.h;
    drawLabel();
    const dlg = $<HTMLDialogElement>('dlg-label');
    if (!dlg.open) dlg.showModal();
  };
  img.src = URL.createObjectURL(s.image);
}

function drawLabel() {
  if (!editing) return;
  const cv = $<HTMLCanvasElement>('label-canvas');
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(editing.img, 0, 0);
  const lw = Math.max(2, cv.width / 400);
  ctx.lineWidth = lw;
  editing.boxes.forEach((b, i) => {
    ctx.strokeStyle = '#22C55E';
    ctx.strokeRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    ctx.fillStyle = '#22C55E';
    ctx.font = `700 ${Math.round(lw * 7)}px system-ui`;
    ctx.fillText(String(i + 1), b[0] + lw * 2, b[1] + lw * 8);
  });
  if (drag?.cur) {
    ctx.strokeStyle = '#38BDF8';
    ctx.setLineDash([lw * 4, lw * 3]);
    ctx.strokeRect(drag.x, drag.y, drag.cur.x - drag.x, drag.cur.y - drag.y);
    ctx.setLineDash([]);
  }
  $('label-count').textContent = String(editing.boxes.length);
}

function labelPoint(e: PointerEvent) {
  const cv = $<HTMLCanvasElement>('label-canvas');
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
}

function setupLabelEditor() {
  const cv = $<HTMLCanvasElement>('label-canvas');
  cv.addEventListener('pointerdown', (e) => { drag = labelPoint(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (drag) { drag.cur = labelPoint(e); drawLabel(); } });
  cv.addEventListener('pointerup', (e) => {
    if (!drag || !editing) return;
    const p = labelPoint(e);
    const minSide = Math.max(6, cv.width / 150);
    if (Math.abs(p.x - drag.x) > minSide && Math.abs(p.y - drag.y) > minSide) {
      editing.boxes.push([Math.min(drag.x, p.x), Math.min(drag.y, p.y), Math.max(drag.x, p.x), Math.max(drag.y, p.y)]);
    } else {
      // tap: delete the smallest box under the finger
      const hits = editing.boxes.map((b, i) => ({ b, i })).filter(({ b }) => p.x >= b[0] && p.x <= b[2] && p.y >= b[1] && p.y <= b[3])
        .sort((a, b) => (a.b[2] - a.b[0]) * (a.b[3] - a.b[1]) - (b.b[2] - b.b[0]) * (b.b[3] - b.b[1]));
      if (hits.length) editing.boxes.splice(hits[0].i, 1);
    }
    drag = null;
    drawLabel();
  });
  $('btn-label-save').onclick = async () => {
    if (!editing) return;
    editing.s.boxes = editing.boxes;
    editing.s.className = calibClass();
    await samples.put(editing.s);
    $<HTMLDialogElement>('dlg-label').close();
    toast(`Próbka zapisana (${editing.boxes.length} obiektów).`);
    editing = null;
    renderCalib();
  };
  $('btn-label-delete').onclick = async () => {
    if (!editing?.s.id) return;
    await samples.remove(editing.s.id);
    $<HTMLDialogElement>('dlg-label').close();
    editing = null;
    renderCalib();
  };
}

async function exportZip() {
  const list = await samples.all();
  if (!list.length) { toast('Brak próbek.'); return; }
  const { zip, classes } = await buildDatasetZip(list);
  download(zip, `dataset-${new Date().toISOString().slice(0, 10)}.zip`);
  toast(`Wyeksportowano ${list.length} zdjęć, klasy: ${classes.join(', ')}`);
}

async function uploadAndTrain() {
  const list = await samples.all();
  if (list.length < 2) { toast('Dodaj co najmniej kilka zdjęć.'); return; }
  const log = $('train-log');
  log.hidden = false;
  log.textContent = 'Wysyłanie datasetu…\n';
  try {
    const { zip } = await buildDatasetZip(list);
    const name = `ds-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
    const ds = await api.uploadDataset(name, zip);
    log.textContent += `Dataset: ${ds.images} zdjęć, klasy: ${ds.classes.join(', ')}\nStart treningu…\n`;
    let st = await api.train(ds.name, `${preset.label} ${new Date().toLocaleDateString('pl-PL')}`, 50);
    while (st.state === 'queued' || st.state === 'running') {
      log.textContent = st.log.slice(-14).join('\n');
      log.scrollTop = log.scrollHeight;
      await new Promise((r) => setTimeout(r, 3000));
      st = await api.trainStatus(st.id);
    }
    if (st.state === 'done' && st.model) {
      log.textContent += `\nGotowe: ${st.model.name}`;
      models = await loadManifest();
      saveOverride(preset.id, { engine: 'yolo', modelId: st.model.id, classNames: [] });
      await applyEngine();
      toast('Nowy model wdrożony i włączony.');
    } else log.textContent += `\nBłąd: ${st.error ?? 'nieznany'}`;
  } catch (e) {
    log.textContent += `\nBłąd: ${(e as Error).message}`;
  }
}

// ------------------------------------------------------------------ settings dialog
function setupSettings() {
  const conf = $<HTMLInputElement>('set-conf'), sens = $<HTMLInputElement>('set-sens');
  const sync = () => {
    $('set-conf-v').textContent = pct(settings.conf);
    $('set-sens-v').textContent = pct(settings.sens);
  };
  conf.value = String(settings.conf); sens.value = String(settings.sens);
  conf.oninput = () => { settings.conf = +conf.value; sync(); saveSettings(); };
  sens.oninput = () => { settings.sens = +sens.value; sync(); saveSettings(); };
  const chk = (id: string, key: 'masks' | 'showConf' | 'server') => {
    const el = $<HTMLInputElement>(id);
    el.checked = settings[key];
    el.onchange = () => { settings[key] = el.checked; saveSettings(); if (frozen) renderFrozen(); };
  };
  chk('set-masks', 'masks'); chk('set-showconf', 'showConf'); chk('set-server', 'server');
  const be = $<HTMLSelectElement>('set-backend');
  be.value = settings.backend;
  be.onchange = async () => { settings.backend = be.value as Settings['backend']; saveSettings(); detector.model = null; await applyEngine(); };
  sync();
}

// ------------------------------------------------------------------ wiring
function wire() {
  setBtn('btn-start', 'camera', 'Włącz kamerę');
  setBtn('btn-count', 'scan', 'POLICZ');
  setBtn('btn-photo', 'camera', 'ZRÓB ZDJĘCIE I POLICZ');
  setBtn('btn-type', 'swap', 'ZMIEŃ OBIEKT');
  setBtn('btn-history', 'history', 'HISTORIA');
  setBtn('btn-calib', 'target', 'Kalibracja');
  setBtn('btn-accept', 'check', 'AKCEPTUJ');
  setBtn('btn-retry', 'redo', 'PONÓW');
  setBtn('btn-sample', 'image', 'Zapisz jako próbkę do kalibracji');
  updateRoiBtn();
  $('btn-settings').innerHTML = icons.settings;
  document.querySelectorAll('dialog .close').forEach((b) => { b.innerHTML = icons.x; });

  $('btn-start').onclick = startCamera;
  $('btn-count').onclick = countAndFreeze;
  $('btn-photo').onclick = takePhoto;
  $<HTMLInputElement>('file').onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void analyseFile(f);
    (e.target as HTMLInputElement).value = '';
  };
  $('btn-accept').onclick = accept;
  $('btn-retry').onclick = () => {
    const wasPhotoOnly = !stream;
    unfreeze();
    if (wasPhotoOnly) $('file').click();
  };
  $('btn-sample').onclick = async () => { if (frozen) { await addSample(still, still.width, still.height); } };
  $('btn-reset').onclick = () => { tracker.reset(); prevGray = null; liveViews = []; renderLive(); toast('Śledzenie wyzerowane.'); };
  $('btn-roi').onclick = () => {
    if (roi) { roi = null; tracker.reset(); updateRoiBtn(); renderLive(); return; }
    if (!stream) { toast('Włącz kamerę, aby zaznaczyć obszar.'); return; }
    roiMode = !roiMode;
    $('btn-roi').classList.toggle('active', roiMode);
    updateRoiBtn();
  };

  $('btn-type').onclick = () => { renderPresetGrid(); $<HTMLDialogElement>('dlg-type').showModal(); };
  $('engine-select').onchange = onEngineChange;
  $('class-select').onchange = onClassChange;
  $('btn-custom-make').onclick = makeCustomModel;
  $<HTMLInputElement>('custom-text').onchange = (e) => { localStorage.setItem('oc.customName', (e.target as HTMLInputElement).value.trim()); updateLabels(); };

  $('btn-history').onclick = async () => { await renderHistory(); $<HTMLDialogElement>('dlg-history').showModal(); };
  $('btn-history-csv').onclick = exportCsv;
  $('btn-history-clear').onclick = async () => { if (confirm('Usunąć całą historię pomiarów?')) { await history.clear(); renderHistory(); } };

  $('btn-calib').onclick = async () => { await renderCalib(); $<HTMLDialogElement>('dlg-calib').showModal(); };
  $('btn-calib-add').onclick = async () => {
    if (!stream || video.readyState < 2) { toast('Włącz kamerę albo dodaj zdjęcie z pliku.'); return; }
    await addSample(video, video.videoWidth, video.videoHeight);
  };
  $<HTMLInputElement>('calib-file').onchange = async (e) => {
    const files = [...((e.target as HTMLInputElement).files ?? [])];
    for (const f of files) {
      const bmp = await createImageBitmap(f);
      await addSample(bmp, bmp.width, bmp.height);
      bmp.close();
    }
    (e.target as HTMLInputElement).value = '';
  };
  $('btn-calib-zip').onclick = exportZip;
  $('btn-calib-train').onclick = uploadAndTrain;
  $('btn-settings').onclick = () => $<HTMLDialogElement>('dlg-settings').showModal();
  setupSettings();
  setupLabelEditor();

  window.addEventListener('resize', () => (frozen ? renderFrozen() : renderLive()));
}

async function main() {
  wire();
  updateLabels();
  setStatus('Ładowanie…');
  [models, health] = await Promise.all([loadManifest(), api.health()]);
  $('about').textContent = `Modele: ${models.length ? models.map((m) => m.name).join(', ') : 'brak (tylko Separator)'} · Backend: ${health?.ok ? `połączony (v${health.version})` : 'brak – aplikacja działa w pełni lokalnie'} · ${self.crossOriginIsolated ? 'WASM wielowątkowy' : 'WASM 1 wątek'}`;
  await applyEngine();
  if (!stream) setStatus(models.length ? 'Gotowe. Skieruj kamerę na obiekty.' : 'Brak modeli AI (uruchom server/export_models.py). Dostępny Separator.');
  // automation hook for tests / kiosk use: ?autostart=1
  if (new URLSearchParams(location.search).has('autostart')) void startCamera();
}

void main();

// expose state for end-to-end tests
(window as unknown as { __oc: unknown }).__oc = {
  get live() { return liveViews.length; },
  get unique() { return tracker.uniqueCount; },
  get frozen() { return frozen ? frozen.items.filter((i) => !i.removed).length : null; },
  get fps() { return fps; },
  get engine() { return engineLabel(); },
  get backend() { return detector.backend; },
  get ready() { return engineReady; },
  get ids() { return liveViews.map((v) => v.id); },
};
