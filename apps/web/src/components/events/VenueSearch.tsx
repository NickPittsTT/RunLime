'use client';
import { NOMINATIM_ATTRIBUTION, PRECISION_LABEL, pinFarFromAddress, type GeocodePrecision } from '@runlime/shared/location';
import { useState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { searchVenueAction, type VenueHit } from '@/lib/events/checkin-actions';

export interface FoundVenue {
  label: string;
  lat: number;
  lng: number;
  precision: GeocodePrecision;
}

/**
 * Venue/address search that drops the start pin (Phase 4). Search runs only when the button is pressed (Nominatim
 * usage policy: no type-ahead). "Town only" results never drop the pin: the organiser must place it on the map.
 */
export function VenueSearch({ pin, found, onPin, onFound, warnM = 1000 }: {
  pin: { lat: number; lng: number } | null;
  found: FoundVenue | null;
  onPin: (lat: number, lng: number) => void;
  onFound: (f: FoundVenue | null) => void;
  warnM?: number;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VenueHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const search = async () => {
    setBusy(true);
    setMessage(undefined);
    const r = await searchVenueAction(query);
    setBusy(false);
    setHits(r.hits);
    if (r.error) setMessage(r.error);
    else if (r.hits.length === 0) setMessage('Nothing found. Try the venue name and town, or place the pin on the map.');
  };
  const choose = (h: VenueHit) => {
    onFound({ label: h.label, lat: h.lat, lng: h.lng, precision: h.precision });
    if (h.precision !== 'town') onPin(Math.round(h.lat * 1e6) / 1e6, Math.round(h.lng * 1e6) / 1e6);
    setHits(null);
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) return setMessage('This browser cannot share its location.');
    navigator.geolocation.getCurrentPosition(
      (p) => onPin(Math.round(p.coords.latitude * 1e6) / 1e6, Math.round(p.coords.longitude * 1e6) / 1e6),
      () => setMessage('Location not available. Allow location for this site, or place the pin on the map.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="mb-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-56">
          <Field label="Find the venue or address" htmlFor="venue-search" hint="Type, then press Search. Saved venues (pins already checked) come first.">
            <Input
              id="venue-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void search();
                }
              }}
            />
          </Field>
        </div>
        <Button type="button" variant="secondary" onClick={() => void search()} disabled={busy || query.trim().length < 3}>
          {busy ? 'Searching…' : 'Search'}
        </Button>
        <Button type="button" variant="secondary" onClick={useMyLocation}>
          Use my current location
        </Button>
      </div>
      {message && <Notice tone="info">{message}</Notice>}
      {hits && hits.length > 0 && (
        <ul className="border border-line rounded-lg divide-y divide-line mb-2" aria-label="Venue search results">
          {hits.map((h) => (
            <li key={`${h.label}-${h.lat}`} className="p-2">
              <button type="button" className="text-left w-full underline" onClick={() => choose(h)}>
                {h.label}
              </button>
              <span className="block text-sm text-ink-muted">{PRECISION_LABEL[h.precision]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-muted m-0">{NOMINATIM_ATTRIBUTION}</p>
      {found && (
        <p className="text-sm mt-2 mb-0" data-testid="venue-precision">
          Venue search: {PRECISION_LABEL[found.precision]}
        </p>
      )}
      {found && found.precision === 'town' && <Notice tone="info">Only the town was found. Tap the map to place the start pin on the start line.</Notice>}
      {found && pin && pinFarFromAddress(pin, found, warnM) && (
        <Notice tone="danger">The start pin is more than {Math.round(warnM / 100) / 10} km from the address found. Check that it is on the start line.</Notice>
      )}
    </div>
  );
}
