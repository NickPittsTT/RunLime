import * as Location from 'expo-location';

export type NearMeResult = { status: 'ok'; lat: number; lng: number } | { status: 'denied' } | { status: 'unavailable' };

/**
 * "Near me": asks for foreground location once and reads one position.
 * The position stays on the device (used only to sort/filter the list); it is never sent or stored.
 */
export async function getNearMe(): Promise<NearMeResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { status: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { status: 'unavailable' };
  }
}
