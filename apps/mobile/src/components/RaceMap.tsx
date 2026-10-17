import { Camera, GeoJSONSource, Layer, Map, Marker, type InitialViewState } from '@maplibre/maplibre-react-native';
import { MAP_ATTRIBUTION_LINKS, MAP_STYLE_URL, TT_CENTER } from '@runlime/shared/events';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

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
  showLabels = true,
}: {
  pins?: MapPin[];
  route?: [number, number][] | null;
  onPinPress?: (id: string) => void;
  height?: number;
  label: string;
  interactive?: boolean;
  /** Race name above each pin (on by default). */
  showLabels?: boolean;
}) {
  const { c, radius } = useTheme();
  const points: [number, number][] = [...pins.map((p) => [p.lng, p.lat] as [number, number]), ...(route ?? [])];
  return (
    <View accessible={false} accessibilityLabel={label} style={[{ overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: c.border }, height ? { height } : { flex: 1 }]}>
      <Map
        style={{ flex: 1 }}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        attribution={false}
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
          <Marker key={p.id} id={p.id} lngLat={[p.lng, p.lat]} anchor="bottom" onPress={() => onPinPress?.(p.id)}>
            <Pressable accessibilityRole="button" accessibilityLabel={p.label} onPress={() => onPinPress?.(p.id)} hitSlop={12} style={{ alignItems: 'center' }}>
              {showLabels ? (
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2, maxWidth: 160, borderWidth: 1, borderColor: '#D9E3CC' }}>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>
                    {p.label}
                  </Text>
                </View>
              ) : null}
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#14532D', borderWidth: 3, borderColor: '#FFFFFF' }} />
            </Pressable>
          </Marker>
        ))}
      </Map>
      {/* Map credit (OSM licence): always-visible text with links, replacing the native "i" button. */}
      <View testID="map-attribution" style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderTopLeftRadius: 6 }}>
        <Text style={{ fontSize: 11, color: '#0F172A' }}>
          {MAP_ATTRIBUTION_LINKS.map((l, i) => (
            <Text key={l.url}>
              {i > 0 ? ' · ' : ''}
              <Text accessibilityRole="link" onPress={() => void Linking.openURL(l.url)} style={{ textDecorationLine: 'underline' }}>
                {l.label}
              </Text>
            </Text>
          ))}
        </Text>
      </View>
    </View>
  );
}
