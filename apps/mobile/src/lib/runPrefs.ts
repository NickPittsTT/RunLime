import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tracker preferences, stored on this phone only.
 * Body weight (optional) is used only to estimate calories and is never sent to RunLime (owner decision).
 */
const AUTO_PAUSE = 'runlime.autoPause.v1';
const WEIGHT = 'runlime.weightKg.v1';
const STEPS_ASKED = 'runlime.stepsAsked.v1';

export async function getAutoPause(): Promise<boolean> {
  return (await AsyncStorage.getItem(AUTO_PAUSE)) !== 'off'; // on by default
}
export async function setAutoPausePref(on: boolean) {
  await AsyncStorage.setItem(AUTO_PAUSE, on ? 'on' : 'off');
}
export async function getWeightKg(): Promise<number | null> {
  const v = Number(await AsyncStorage.getItem(WEIGHT));
  return Number.isFinite(v) && v >= 30 && v <= 250 ? v : null;
}
export async function setWeightKg(kg: number | null) {
  if (kg === null) await AsyncStorage.removeItem(WEIGHT);
  else await AsyncStorage.setItem(WEIGHT, String(kg));
}
export async function stepsPermissionAsked(): Promise<boolean> {
  return (await AsyncStorage.getItem(STEPS_ASKED)) === 'yes';
}
export async function markStepsPermissionAsked() {
  await AsyncStorage.setItem(STEPS_ASKED, 'yes');
}
export async function clearRunPrefs() {
  await AsyncStorage.multiRemove([AUTO_PAUSE, WEIGHT, STEPS_ASKED]);
}
