'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoportalSource } from '@/lib/sources';

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  title: string;
  type: string;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  details?: Record<string, string | number | null>;
}

export interface MapViewProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  geoportalSources?: GeoportalSource[];
  onSelect?: (m: MapMarker) => void;
  onMoveEnd?: (c: { lat: number; lon: number; zoom: number }) => void;
  className?: string;
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export default function MapView({
  center, zoom = 6, markers = [], geoportalSources = [], onSelect, onMoveEnd, className,
}: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerObjs = useRef<maplibregl.Marker[]>([]);
  const [layers, setLayers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: OSM_STYLE,
      center: [center[1], center[0]],
      zoom,
    });
    map.addControl(new maplibregl.NavigationControl({}), 'top-right');
    map.addControl(new maplibregl.ScaleControl({}), 'bottom-left');
    map.on('moveend', () => {
      const c = map.getCenter();
      onMoveEnd?.({ lat: c.lat, lon: c.lng, zoom: map.getZoom() });
    });
    map.on('load', () => {
      for (const src of geoportalSources.filter((s) => s.active && s.serviceType === 'WMS')) {
        const id = `gp-${slug(src.name)}`;
        const url =
          `${src.url}${src.url.includes('?') ? '&' : '?'}SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
          `&LAYERS=${encodeURIComponent(src.layers ?? '')}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
          '&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';
        map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256, attribution: 'Geoportal / GUGiK' });
        map.addLayer({ id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75 } });
      }
      setLayers(Object.fromEntries(geoportalSources.filter((s) => s.active && s.serviceType === 'WMS').map((s) => [s.name, false])));
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerObjs.current.forEach((m) => m.remove());
    markerObjs.current = markers.map((m) => {
      const el = document.createElement('button');
      el.className = 'h-3 w-3 rounded-full border border-white/70 bg-accent';
      el.title = m.title;
      el.addEventListener('click', () => onSelect?.(m));
      return new maplibregl.Marker({ element: el }).setLngLat([m.lon, m.lat]).addTo(map);
    });
  }, [markers, onSelect]);

  useEffect(() => {
    mapRef.current?.easeTo({ center: [center[1], center[0]], zoom });
  }, [center, zoom]);

  function toggle(name: string) {
    const map = mapRef.current;
    if (!map) return;
    const id = `gp-${slug(name)}`;
    const next = !layers[name];
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', next ? 'visible' : 'none');
    setLayers({ ...layers, [name]: next });
  }

  return (
    <div className={`relative ${className ?? 'h-[70vh]'}`}>
      <div ref={ref} className="h-full w-full rounded-lg border border-line" />
      {Object.keys(layers).length > 0 && (
        <div className="absolute left-3 top-3 max-w-[220px] rounded border border-line bg-panel/95 p-2 text-xs">
          <div className="mb-1 text-muted">Warstwy Geoportalu</div>
          {Object.entries(layers).map(([name, on]) => (
            <label key={name} className="flex cursor-pointer items-start gap-2 py-0.5">
              <input type="checkbox" checked={on} onChange={() => toggle(name)} className="mt-0.5" />
              <span>{name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
