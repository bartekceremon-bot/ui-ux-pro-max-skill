import type { SourceStatus } from './types';

export interface ConnectorHealth {
  id: string;
  label: string;
  status: SourceStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  latencyMs: number | null;
  requests: number;
  errors: number;
}

const registry = new Map<string, ConnectorHealth>();

export function registerConnector(id: string, label: string) {
  if (!registry.has(id)) {
    registry.set(id, {
      id, label, status: 'UNCONFIGURED', lastSuccessAt: null, lastErrorAt: null,
      lastError: null, latencyMs: null, requests: 0, errors: 0,
    });
  }
}

export function recordSuccess(id: string, latencyMs: number) {
  const h = registry.get(id);
  if (!h) return;
  h.requests += 1;
  h.latencyMs = latencyMs;
  h.lastSuccessAt = new Date().toISOString();
  const errorRate = h.requests ? h.errors / h.requests : 0;
  h.status = errorRate > 0.3 ? 'DEGRADED' : 'ONLINE';
}

export function recordError(id: string, error: string) {
  const h = registry.get(id);
  if (!h) return;
  h.requests += 1;
  h.errors += 1;
  h.lastError = error;
  h.lastErrorAt = new Date().toISOString();
  h.status = h.lastSuccessAt ? 'DEGRADED' : 'OFFLINE';
}

export function healthSnapshot(): ConnectorHealth[] {
  return [...registry.values()].map((h) => ({
    ...h,
    // error rate is derived at read time so the panel never stores a stale value
  }));
}

export function errorRate(h: ConnectorHealth): number {
  return h.requests ? h.errors / h.requests : 0;
}
