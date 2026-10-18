import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DeleteAccountScreen from '../app/(app)/delete-account';
import EditProfileScreen from '../app/(app)/edit-profile';
import LegalScreen from '../app/(app)/legal';
import ProfileScreen from '../app/(app)/profile';
import ReportScreen from '../app/(app)/report';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockRpc = jest.fn();
const mockUpdate = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
const mockCall = jest.fn();
const mockPick = jest.fn();
const mockManipulate = jest.fn();
let mockParams: Record<string, string> = {};
let mockProfile: Record<string, unknown> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (...a: unknown[]) => mockPick(...a) }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: (...a: unknown[]) => mockManipulate(...a), SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('@/lib/edgeFunctions', () => ({ callFunction: (...a: unknown[]) => mockCall(...a) }));
jest.mock('@/lib/regions', () => ({ useAreas: () => ({ areas: [{ id: '6f1b0a52-6a0c-4e43-9a5e-7d0f6f4e2a11', name: 'Port of Spain' }] }) }));
jest.mock('@/lib/legalLinks', () => ({ LEGAL_PAGES: [{ path: '/legal/terms', label: 'Terms of Use' }], openWebPage: jest.fn() }));
jest.mock('@/state/session', () => ({
  useSession: () => ({ profile: mockProfile, session: { user: { email: 'ana@example.com' } }, refreshProfile: mockRefresh, signOut: jest.fn() }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ update: (v: unknown) => ({ eq: async () => mockUpdate(v) }) }),
  },
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;

const baseProfile = { id: 'u1', display_name: 'Ana Lopez', nickname: null, home_region_id: '6f1b0a52-6a0c-4e43-9a5e-7d0f6f4e2a11', account_privacy: 'private', runner_level: null, avatar_path: null, show_attendance_to_clubs: false };

beforeAll(() => {
  mockProfile = baseProfile;
  render(<EditProfileScreen />);
  cleanup();
});
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockProfile = { ...baseProfile };
  mockUpdate.mockReturnValue({ error: null });
});

describe('runner level', () => {
  it('is optional, explains it never affects checks, and is saved with the profile', async () => {
    render(<EditProfileScreen />);
    expect(screen.getByText('Just for your profile. It never changes how runs or times are checked.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Not set' }).props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByRole('radio', { name: 'Club runner' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ runner_level: 'club_runner' })));
  });
  it('club turnout opt-in (off by default) is saved with the profile', async () => {
    render(<EditProfileScreen />);
    const box = screen.getByRole('checkbox', { name: /Count me in my clubs/ });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(box);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ show_attendance_to_clubs: true })));
  });
  it('shows on the profile', () => {
    mockProfile = { ...baseProfile, runner_level: 'competitive' };
    render(<ProfileScreen />);
    expect(screen.getByText('Competitive')).toBeTruthy();
  });
});

describe('profile photo', () => {
  it('picks with the system picker, re-encodes as a 512 px JPEG and uploads it', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picked.heic' }] });
    mockManipulate.mockResolvedValue({ uri: 'file:///small.jpg' });
    mockCall.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<EditProfileScreen />);
    expect(screen.getByText('RunLime only sees the photo you choose.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText('Photo saved.')).toBeTruthy();
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], exif: false }));
    expect(mockManipulate).toHaveBeenCalledWith('file:///picked.heic', [{ resize: { width: 512, height: 512 } }], { compress: 0.8, format: 'jpeg' });
    expect(mockCall).toHaveBeenCalledWith('profile-photo', expect.objectContaining({ method: 'POST', headers: { 'content-type': 'image/jpeg' } }));
    expect(mockRefresh).toHaveBeenCalled();
  });
  it('explains a rejected photo; cancelling does nothing', async () => {
    mockPick.mockResolvedValueOnce({ canceled: true, assets: null });
    render(<EditProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(mockCall).not.toHaveBeenCalled();
    // The button is disabled while the first (cancelled) pick finishes; pressing earlier is ignored (CI run 124).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a photo' })).not.toBeDisabled());
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///tiny.jpg' }] });
    mockManipulate.mockResolvedValue({ uri: 'file:///tiny-small.jpg' });
    mockCall.mockResolvedValue({ ok: false, json: async () => ({ error: 'bad_size' }) });
    fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText('That photo is too small. Choose one at least 64 × 64 pixels.')).toBeTruthy();
  });
  it('shows the photo and can remove it', async () => {
    mockProfile = { ...baseProfile, avatar_path: 'u1/0123456789abcdef0123456789abcdef.jpg' };
    mockCall.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    render(<EditProfileScreen />);
    expect(screen.getByTestId('avatar-photo').props.source.uri).toMatch(/\/storage\/v1\/object\/public\/avatars\/u1\/0123456789abcdef0123456789abcdef\.jpg$/);
    fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByText('Photo removed.')).toBeTruthy();
    expect(mockCall).toHaveBeenCalledWith('profile-photo', { method: 'DELETE' });
  });
  it('deleting the account removes the photo file first', async () => {
    mockCall.mockResolvedValue({ ok: true });
    mockRpc.mockResolvedValue({ error: null });
    render(<DeleteAccountScreen />);
    fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('delete_my_account'));
    expect(mockCall.mock.invocationCallOrder[0]).toBeLessThan(mockRpc.mock.invocationCallOrder[0]!);
  });
});

describe('reporting (Play UGC + Child Safety Standards)', () => {
  it('Help & legal and Profile open "Report a safety concern"', () => {
    render(<LegalScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Report a safety concern' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/report', params: { kind: 'general' } });
  });
  it('Profile also links to it, and to editing areas and distances', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Your areas and distances' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/onboarding', params: { edit: '1' } });
    expect(screen.getByRole('button', { name: 'Report a safety concern' })).toBeTruthy();
  });
  it('a safety concern needs a category and a description, then is sent in the app', async () => {
    mockRpc.mockResolvedValue({ data: 'r1', error: null });
    render(<ReportScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Choose what is wrong.')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'A child may be at risk' }));
    fireEvent.changeText(screen.getByLabelText('Tell us what happened'), 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Please describe the concern in at least 10 characters.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Tell us what happened'), 'An adult in a running group asked for photos of children');
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Thank you. Your report was sent.')).toBeTruthy();
    expect(screen.getByText('If someone is in immediate danger, call the police on 999.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('submit_report', {
      p_category: 'child_safety',
      p_target_kind: 'general',
      p_target_user: null,
      p_target_ref: null,
      p_details: 'An adult in a running group asked for photos of children',
    });
  });
  it('the "too short" message clears while typing, and the hint counts characters (owner retest 2026-10-18)', async () => {
    render(<ReportScreen />);
    fireEvent.press(screen.getByRole('radio', { name: 'Bullying or harassment' }));
    fireEvent.changeText(screen.getByLabelText('Tell us what happened'), 'short');
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Please describe the concern in at least 10 characters.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Tell us what happened'), 'This is just. Test');
    expect(screen.queryByText('Please describe the concern in at least 10 characters.')).toBeNull();
    expect(screen.getByText(/At least 10 characters \(18 so far\)/)).toBeTruthy();
  });
  it('reporting a photo sends the person; server messages are shown', async () => {
    mockParams = { kind: 'profile_photo', userId: '0b4d3c2a-1111-4222-8333-444455556666', name: 'Sam' };
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0429', message: 'Too many requests, please try again later' } });
    render(<ReportScreen />);
    expect(screen.getByText('About: Sam')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Nudity or sexual content' }));
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Too many attempts. Please wait a little and try again.')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('submit_report', expect.objectContaining({ p_target_kind: 'profile_photo', p_target_user: '0b4d3c2a-1111-4222-8333-444455556666' }));
  });
});
