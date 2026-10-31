import { GOOGLE_SATELLITE_LINK_LABEL, googleSatelliteUrl } from '@runlime/shared/location';

/** "Open in Google Maps (satellite)" next to a race pin (owner decision, 31 Oct 2026). No key; no referrer is sent. */
export function SatelliteLink({ lat, lng }: { lat: number | null | undefined; lng: number | null | undefined }) {
  if (lat == null || lng == null) return null;
  return (
    <span className="block text-sm">
      <a href={googleSatelliteUrl(lat, lng)} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
        {GOOGLE_SATELLITE_LINK_LABEL}
      </a>
      <span className="text-ink-muted"> (opens Google Maps centred on the pin; only the pin&apos;s coordinates are sent to Google, when you tap it)</span>
    </span>
  );
}
