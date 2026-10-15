import { Camera, GeoJSONSource, Layer, Map, Marker, type InitialViewState } from '@maplibre/maplibre-react-native';
import { MAP_ATTRIBUTION, MAP_STYLE_URL, TT_CENTER } from '@runlime/shared/events';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

/** Initial camera: one point -> zoom 14 on it; several -> fit them; none -> Trinidad and Tobago. */
export function viewFor(points: [number, number][]): InitialViewState {
  if (points.length === 0) return { center: [TT_CENTER.lng, TT_CENTER.lat], zoom: 8 };
  if (points.length === 1) return { center: points[0]!, zoom: 14 };
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], padding: { top: 48, right: 48, bottom: 48, left: 48 } };
}

/** MapLibre + OpenFreeMap tiles (free, no key). */
export function RaceMap({
  pins = [],
  route,
  onPinPress,
  height,
  label,
  interactive = true,
}: {
  pins?: MapPin[];
  route?: [number, number][] | null;
  onPinPress?: (id: string) => void;
  height?: number;
  label: string;
  interactive?: boolean;
}) {
  const { c, radius } = useTheme();
  const points: [number, number][] = [...pins.map((p) => [p.lng, p.lat] as [number, number]), ...(route ?? [])];
  return (
    <View accessible={false} accessibilityLabel={label} style={[{ overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: c.border }, height ? { height } : { flex: 1 }]}>
      <Map
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        attribution
        compass={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={viewFor(points)} />
        {route && route.length > 1 ? (
          <GeoJSONSource id="route" data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }}>
            <Layer id="route-line" type="line" paint={{ 'line-color': '#3F7D0F', 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </GeoJSONSource>
        ) : null}
        {pins.map((p) => (
          <Marker key={p.id} id={p.id} lngLat={[p.lng, p.lat]} anchor="center" onPress={() => onPinPress?.(p.id)}>
            <Pressable accessibilityRole="button" accessibilityLabel={p.label} onPress={() => onPinPress?.(p.id)} hitSlop={12}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#14532D', borderWidth: 3, borderColor: '#FFFFFF' }} />
            </Pressable>
          </Marker>
        ))}
      </Map>
      <T variant="caption" style={{ position: 'absolute', bottom: 2, left: 6, fontSize: 10 }} importantForAccessibility="no">
        {MAP_ATTRIBUTION}
      </T>
    </View>
  );
}
