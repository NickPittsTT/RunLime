'use client';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="h-72 rounded-lg border border-line bg-surface" />,
});

export function EventMap({ lat, lng, route, name }: { lat: number; lng: number; route: [number, number][] | null; name: string }) {
  return (
    <figure className="my-6">
      <MapView label={`Map of the start${route ? ' and route' : ''} for ${name}`} pins={[{ id: 'start', lat, lng, label: 'Start' }]} route={route} height={300} />
      <figcaption className="text-sm text-ink-muted mt-1">
        Start point{route ? ' and route' : ''}.{' '}
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`} target="_blank" rel="noopener noreferrer">
          Directions
        </a>
      </figcaption>
    </figure>
  );
}
