'use client';
import { parseGpx } from '@runlime/shared/schemas';
import dynamic from 'next/dynamic';
import { useActionState, useState } from 'react';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { saveEventAction } from '@/lib/events/actions';

const MapView = dynamic(() => import('@/components/map/MapView'), {
  ssr: false,
  loading: () => <div className="h-80 rounded-lg border border-line bg-surface grid place-items-center text-ink-muted">Loading map…</div>,
});

export interface EventFormValues {
  id?: string;
  listingSource: 'organiser' | 'runlime';
  organisationId?: string;
  name: string;
  description: string;
  startsLocal: string;
  timezone: string;
  regionId: string;
  venueName: string;
  startLat: number | null;
  startLng: number | null;
  registrationUrl: string;
  registrationInstructions: string;
  packageCollection: string;
  parking: string;
  contactEmail: string;
  contactPhone: string;
  cause: string;
  charityName: string;
  walkFriendly: boolean;
  feeMin: number;
  feeMax: number | null;
  route: [number, number][] | null;
  distances: { km: number; label: string }[];
}

export const emptyEvent = (listingSource: 'organiser' | 'runlime', organisationId?: string): EventFormValues => ({
  listingSource,
  organisationId,
  name: '',
  description: '',
  startsLocal: '',
  timezone: 'America/Port_of_Spain',
  regionId: '',
  venueName: '',
  startLat: null,
  startLng: null,
  registrationUrl: '',
  registrationInstructions: '',
  packageCollection: '',
  parking: '',
  contactEmail: '',
  contactPhone: '',
  cause: '',
  charityName: '',
  walkFriendly: false,
  feeMin: 0,
  feeMax: null,
  route: null,
  distances: [{ km: 5, label: '5K' }],
});

const PRESETS = [
  { km: 5, label: '5K' },
  { km: 10, label: '10K' },
  { km: 2, label: '2K fun walk' },
  { km: 21.1, label: 'Half marathon' },
];

interface Props {
  initial: EventFormValues;
  areas: { id: string; name: string }[];
  organisations?: { id: string; name: string }[];
  back: string;
  /** Admin: creating from a race suggestion marks it converted. */
  suggestionId?: string;
}

export function EventForm({ initial, areas, organisations, back, suggestionId }: Props) {
  const [state, action, pending] = useActionState(saveEventAction, {});
  const [v, setV] = useState<EventFormValues>(initial);
  const [mapMode, setMapMode] = useState<'pin' | 'route'>('pin');
  const [gpxNote, setGpxNote] = useState<string | null>(null);
  const isListing = v.listingSource === 'runlime';
  const set = <K extends keyof EventFormValues>(k: K, value: EventFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const payload = JSON.stringify({
    ...v,
    startLat: v.startLat ?? undefined,
    startLng: v.startLng ?? undefined,
    feeMax: v.feeMax ?? undefined,
    route: v.route && v.route.length > 1 ? v.route : undefined,
    organisationId: isListing ? undefined : v.organisationId,
  });

  const onMapClick = (lng: number, lat: number) => {
    const r = (n: number) => Math.round(n * 1e6) / 1e6;
    if (mapMode === 'pin') setV((s) => ({ ...s, startLat: r(lat), startLng: r(lng) }));
    else setV((s) => ({ ...s, route: [...(s.route ?? []), [r(lng), r(lat)]] }));
  };

  const onGpx = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5_000_000) return setGpxNote('That file is too large (5 MB max).');
    const pts = parseGpx(await file.text());
    if (pts.length < 2) return setGpxNote('No track points found in that file.');
    setV((s) => ({ ...s, route: pts, ...(s.startLat === null ? { startLng: pts[0]![0], startLat: pts[0]![1] } : {}) }));
    setGpxNote(`Route loaded: ${pts.length} points.`);
  };

  return (
    <form action={action} className="max-w-2xl">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="back" value={back} />
      {suggestionId && <input type="hidden" name="suggestion" value={suggestionId} />}
      <input type="hidden" name="payload" value={payload} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}

      {isListing && (
        <Notice tone="info">
          <strong>RunLime listing.</strong> Enter public facts only: name, date and start time, distance, venue and start pin, and the official registration
          link. No flyers or logos without the organiser&apos;s permission. Runners will see the &quot;not affiliated, check with the organiser&quot; notice.
        </Notice>
      )}

      <h2 className="text-xl font-bold mt-2 mb-4">Basics</h2>
      {!isListing && organisations && (
        <Field label="Organisation" htmlFor="ev-org">
          <Select id="ev-org" value={v.organisationId ?? ''} onChange={(e) => set('organisationId', e.target.value)} required disabled={Boolean(v.id)}>
            <option value="">Choose…</option>
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Race name" htmlFor="ev-name">
        <Input id="ev-name" value={v.name} onChange={(e) => set('name', e.target.value)} required maxLength={140} />
      </Field>
      <Field label="Date and start time (Trinidad and Tobago time)" htmlFor="ev-start">
        <Input id="ev-start" type="datetime-local" value={v.startsLocal} onChange={(e) => set('startsLocal', e.target.value)} required />
      </Field>
      <fieldset className="mb-5">
        <legend className="font-semibold mb-2">Distances</legend>
        {v.distances.map((d, i) => (
          <div key={i} className="flex gap-2 mb-2 items-center">
            <label className="sr-only" htmlFor={`ev-d-km-${i}`}>
              Distance {i + 1} in km
            </label>
            <Input
              id={`ev-d-km-${i}`}
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              className="max-w-28"
              value={d.km}
              onChange={(e) => set('distances', v.distances.map((x, j) => (j === i ? { ...x, km: Number(e.target.value) } : x)))}
            />
            <span>km</span>
            <label className="sr-only" htmlFor={`ev-d-label-${i}`}>
              Distance {i + 1} label
            </label>
            <Input
              id={`ev-d-label-${i}`}
              value={d.label}
              maxLength={30}
              onChange={(e) => set('distances', v.distances.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            {v.distances.length > 1 && (
              <Button type="button" variant="secondary" onClick={() => set('distances', v.distances.filter((_, j) => j !== i))} aria-label={`Remove ${d.label}`}>
                ✕
              </Button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {PRESETS.filter((p) => !v.distances.some((d) => d.label === p.label)).map((p) => (
            <Button key={p.label} type="button" variant="secondary" onClick={() => set('distances', [...v.distances, p])}>
              + {p.label}
            </Button>
          ))}
        </div>
      </fieldset>
      {!isListing && (
        <Field label="Description (optional)" htmlFor="ev-desc">
          <Textarea id="ev-desc" rows={4} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
        </Field>
      )}

      <h2 className="text-xl font-bold mt-8 mb-4">Location</h2>
      <Field label="Area" htmlFor="ev-area">
        <Select id="ev-area" value={v.regionId} onChange={(e) => set('regionId', e.target.value)} required>
          <option value="">Choose…</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Venue / start location" htmlFor="ev-venue">
        <Input id="ev-venue" value={v.venueName} onChange={(e) => set('venueName', e.target.value)} required maxLength={200} />
      </Field>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Map tool">
        <Button type="button" variant={mapMode === 'pin' ? 'primary' : 'secondary'} onClick={() => setMapMode('pin')} aria-pressed={mapMode === 'pin'}>
          Place start pin
        </Button>
        <Button type="button" variant={mapMode === 'route' ? 'primary' : 'secondary'} onClick={() => setMapMode('route')} aria-pressed={mapMode === 'route'}>
          Draw route (optional)
        </Button>
        {v.route && v.route.length > 0 && (
          <>
            <Button type="button" variant="secondary" onClick={() => set('route', v.route!.slice(0, -1))}>
              Undo point
            </Button>
            <Button type="button" variant="secondary" onClick={() => set('route', null)}>
              Clear route
            </Button>
          </>
        )}
      </div>
      <p className="text-sm text-ink-muted mb-2">
        {mapMode === 'pin' ? 'Tap the map where the race starts. GPS check-in uses this point.' : 'Tap points along the course in order, or upload a GPX file.'}
      </p>
      <MapView
        label="Event location map"
        onMapClick={onMapClick}
        pins={v.startLat !== null && v.startLng !== null ? [{ id: 'start', lat: v.startLat, lng: v.startLng, label: 'Start' }] : []}
        route={v.route}
        fit={false}
        height={360}
      />
      <p className="text-sm mt-2 mb-3" aria-live="polite">
        {v.startLat !== null ? `Start pin: ${v.startLat.toFixed(5)}, ${v.startLng!.toFixed(5)}` : 'No start pin yet.'}
        {v.route && v.route.length > 1 ? ` · Route: ${v.route.length} points` : ''}
      </p>
      <Field label="Route from a GPX file (optional)" htmlFor="ev-gpx" hint={gpxNote ?? undefined}>
        <input id="ev-gpx" type="file" accept=".gpx,application/gpx+xml" onChange={(e) => void onGpx(e.target.files?.[0])} />
      </Field>

      <h2 className="text-xl font-bold mt-8 mb-4">Registration</h2>
      <Field
        label={isListing ? 'Official registration link (required)' : 'Registration link (optional)'}
        htmlFor="ev-reg"
        hint="RunLime doesn't take registrations or payments; runners register with the organiser."
      >
        <Input id="ev-reg" type="url" value={v.registrationUrl} onChange={(e) => set('registrationUrl', e.target.value)} required={isListing} placeholder="https://" />
      </Field>
      <label className="flex gap-3 items-center mb-5">
        <input type="checkbox" className="w-5 h-5" checked={v.walkFriendly} onChange={(e) => set('walkFriendly', e.target.checked)} />
        Walkers welcome
      </label>
      {!isListing && (
        <>
          <Field label="How to register (optional)" htmlFor="ev-reg-instr">
            <Textarea id="ev-reg-instr" rows={2} value={v.registrationInstructions} onChange={(e) => set('registrationInstructions', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry fee from (TT$)" htmlFor="ev-fee-min">
              <Input id="ev-fee-min" type="number" min="0" step="0.01" value={v.feeMin} onChange={(e) => set('feeMin', Number(e.target.value))} />
            </Field>
            <Field label="Entry fee up to (TT$, optional)" htmlFor="ev-fee-max">
              <Input
                id="ev-fee-max"
                type="number"
                min="0"
                step="0.01"
                value={v.feeMax ?? ''}
                onChange={(e) => set('feeMax', e.target.value === '' ? null : Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Race-pack collection (optional)" htmlFor="ev-pack">
            <Textarea id="ev-pack" rows={2} value={v.packageCollection} onChange={(e) => set('packageCollection', e.target.value)} />
          </Field>
          <Field label="Parking (optional)" htmlFor="ev-parking">
            <Textarea id="ev-parking" rows={2} value={v.parking} onChange={(e) => set('parking', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact email (optional)" htmlFor="ev-email">
              <Input id="ev-email" type="email" value={v.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
            </Field>
            <Field label="Contact phone (optional)" htmlFor="ev-phone">
              <Input id="ev-phone" value={v.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cause (optional)" htmlFor="ev-cause">
              <Input id="ev-cause" value={v.cause} onChange={(e) => set('cause', e.target.value)} maxLength={200} />
            </Field>
            <Field label="Charity name (optional)" htmlFor="ev-charity">
              <Input id="ev-charity" value={v.charityName} onChange={(e) => set('charityName', e.target.value)} maxLength={200} />
            </Field>
          </div>
        </>
      )}

      <div className="mt-6">
        <Button type="submit" disabled={pending}>
          {v.id ? 'Save changes' : isListing ? 'Save listing' : 'Save draft'}
        </Button>
      </div>
    </form>
  );
}
