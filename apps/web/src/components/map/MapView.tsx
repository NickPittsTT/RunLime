'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_ATTRIBUTION_LINKS, MAP_STYLE_URL, TT_CENTER } from '@runlime/shared/events';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, MapMouseEvent, Marker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

// The worker is served from public/maplibre (copied at build time; see scripts/copy-maplibre-worker.mjs).
if (typeof window !== 'undefined') maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  href?: string;
}

interface Props {
  pins?: MapPin[];
  route?: [number, number][] | null;
  /** Called with the clicked point (lng, lat). */
  onMapClick?: (lng: number, lat: number) => void;
  /** Fit the view to pins + route when they change. */
  fit?: boolean;
  height?: number;
  label: string;
}

/** MapLibre + OpenFreeMap tiles (free, no key). Client-only; load with next/dynamic(ssr: false). */
export default function MapView({ pins = [], route, onMapClick, fit = true, height = 320, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const clickRef = useRef(onMapClick);
  useEffect(() => {
    clickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE_URL,
      center: [TT_CENTER.lng, TT_CENTER.lat],
      zoom: 8,
      // Our own always-visible credit below replaces the collapsible control (OSM licence).
      attributionControl: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Tile/style errors (offline, blocked network) must never break the page: the map just stays blank.
    m.on('error', () => undefined);
    m.on('click', (e: MapMouseEvent) => clickRef.current?.(e.lngLat.lng, e.lngLat.lat));
    m.on('load', () => {
      m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#3F7D0F', 'line-width': 4 } });
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = pins.map((p) => {
      const el = document.createElement(p.href ? 'a' : 'div');
      el.className = 'block w-4 h-4 rounded-full border-2 border-white shadow';
      el.style.background = '#14532D';
      el.setAttribute('aria-label', p.label);
      el.title = p.label;
      if (p.href && el instanceof HTMLAnchorElement) el.href = p.href;
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
    const apply = () => {
      const src = m.getSource('route') as GeoJSONSource | undefined;
      src?.setData({
        type: 'FeatureCollection',
        features: route && route.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }] : [],
      });
      if (!fit) return;
      const pts: [number, number][] = [...pins.map((p) => [p.lng, p.lat] as [number, number]), ...(route ?? [])];
      if (pts.length === 1) m.jumpTo({ center: pts[0]!, zoom: 14 });
      else if (pts.length > 1) {
        const b = pts.reduce((acc, p) => acc.extend(p), new maplibregl.LngLatBounds(pts[0]!, pts[0]!));
        m.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 });
      }
    };
    if (m.isStyleLoaded()) apply();
    else m.once('load', apply);
  }, [pins, route, fit]);

  return (
    <div className="relative w-full rounded-lg border border-line overflow-hidden" style={{ height }}>
      {/* Inline position: maplibre-gl.css sets .maplibregl-map { position: relative } outside Tailwind's cascade layers,
          which beat the `absolute inset-0` utilities and collapsed the map to 0 px (blank map, owner re-test 2026-10-17). */}
      <div ref={box} role="region" aria-label={label} style={{ position: 'absolute', inset: 0 }} />
      <p data-testid="map-attribution" className="absolute bottom-0 right-0 m-0 px-1.5 py-0.5 text-[11px] leading-4 bg-white/90 text-[#0F172A] rounded-tl">
        {MAP_ATTRIBUTION_LINKS.map((l, i) => (
          <span key={l.url}>
            {i > 0 && ' · '}
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[#0F172A] underline">
              {l.label}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}
