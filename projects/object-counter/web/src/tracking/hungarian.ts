/**
 * Hungarian algorithm (Kuhn-Munkres with potentials, O(n^3)) for a
 * rectangular cost matrix. Returns, for each row, the assigned column or -1.
 */
export function hungarian(cost: number[][]): number[] {
  const nr = cost.length;
  if (!nr) return [];
  const nc = cost[0].length;
  const n = Math.max(nr, nc);
  const BIG = 1e9;
  const a = (i: number, j: number) => (i < nr && j < nc ? cost[i][j] : BIG / 1e3);
  const u = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity);
    const used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = a(i0 - 1, j - 1) - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array<number>(nr).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] && p[j] - 1 < nr && j - 1 < nc) res[p[j] - 1] = j - 1;
  return res;
}
