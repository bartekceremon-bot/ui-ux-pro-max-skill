/**
 * Local persistence (IndexedDB): measurement history and calibration samples.
 * Data never leaves the device unless the user exports / uploads it.
 */
export interface Measurement {
  id?: number;
  date: string; // ISO
  presetId: string;
  label: string;
  count: number;
  avgConf: number | null;
  mode: 'live' | 'freeze' | 'photo';
  engine: string;
  note?: string;
  thumb?: Blob;
}

export interface Sample {
  id?: number;
  date: string;
  presetId: string;
  className: string;
  image: Blob; // JPEG
  w: number;
  h: number;
  /** [x1, y1, x2, y2] in image px */
  boxes: number[][];
}

const DB = 'object-counter';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      const s = r.result.createObjectStore('samples', { keyPath: 'id', autoIncrement: true });
      s.createIndex('presetId', 'presetId');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const req = fn(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const history = {
  add: (m: Measurement) => tx('history', 'readwrite', (s) => s.add(m)) as Promise<number>,
  all: () => tx<Measurement[]>('history', 'readonly', (s) => s.getAll()).then((a) => a.reverse()),
  remove: (id: number) => tx('history', 'readwrite', (s) => s.delete(id)),
  clear: () => tx('history', 'readwrite', (s) => s.clear()),
};

export const samples = {
  add: (x: Sample) => tx('samples', 'readwrite', (s) => s.add(x)) as Promise<number>,
  put: (x: Sample) => tx('samples', 'readwrite', (s) => s.put(x)),
  all: () => tx<Sample[]>('samples', 'readonly', (s) => s.getAll()),
  remove: (id: number) => tx('samples', 'readwrite', (s) => s.delete(id)),
};
