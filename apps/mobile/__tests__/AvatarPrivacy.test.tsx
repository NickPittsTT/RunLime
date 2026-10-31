import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Avatar } from '@/components/Avatar';
import { forgetPhotoUrls, signedPhotoUrl } from '@/lib/profilePhoto';

// Owner decisions C2 + 4: the server returns a photo path only to people allowed to see it (pgTAP 026/027), and the
// file itself is private: the app shows it through a short-lived signed link that storage only signs for them.
const mockSign = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrls: (...a: unknown[]) => mockSign(...a) }) } } }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: {} }));
jest.mock('@/lib/edgeFunctions', () => ({ callFunction: jest.fn() }));

const A = '00000000-0000-0000-0000-00000000000a/0123456789abcdef0123456789abcdef.jpg';
const B = '00000000-0000-0000-0000-00000000000b/0123456789abcdef0123456789abcdef.jpg';
const allow = (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}?t=1`, error: null })) });

beforeEach(() => {
  forgetPhotoUrls();
  mockSign.mockReset();
  mockSign.mockImplementation(async (paths: string[]) => allow(paths));
});

describe('profile photos are private (owner decisions C2 and 4)', () => {
  it('no path from the server → initials, and nothing is asked of storage', () => {
    render(<Avatar name="Ana Baptiste" path={null} />);
    expect(screen.getByTestId('avatar-initials')).toBeTruthy();
    expect(screen.getByText('AB')).toBeTruthy();
    expect(mockSign).not.toHaveBeenCalled();
  });
  it('an allowed path → the photo through a signed link (never a public URL)', async () => {
    render(<Avatar name="Ana Baptiste" path={A} />);
    expect(screen.getByTestId('avatar-initials')).toBeTruthy(); // while signing
    expect((await screen.findByTestId('avatar-photo')).props.source.uri).toBe(`https://signed.example/${A}?t=1`);
    expect(mockSign).toHaveBeenCalledWith([A], 600); // 10-minute links
  });
  it('storage refuses (not allowed) → initials', async () => {
    mockSign.mockResolvedValue({ data: [{ path: A, signedUrl: null, error: 'Object not found' }] });
    render(<Avatar name="Ana Baptiste" path={A} />);
    await waitFor(() => expect(mockSign).toHaveBeenCalled());
    expect(screen.getByTestId('avatar-initials')).toBeTruthy();
  });
  it('a refusal is not remembered: once allowed (e.g. switched to Public), the next load shows the photo', async () => {
    mockSign.mockResolvedValueOnce({ data: [{ path: A, signedUrl: null, error: 'Object not found' }] });
    expect(await signedPhotoUrl(A)).toBeNull();
    expect(await signedPhotoUrl(A)).toBe(`https://signed.example/${A}?t=1`);
  });
  it('photos on one screen are signed in one request, and reused for a few minutes', async () => {
    const [a, b] = await Promise.all([signedPhotoUrl(A), signedPhotoUrl(B)]);
    expect(a && b).toBeTruthy();
    expect(mockSign).toHaveBeenCalledTimes(1);
    expect(mockSign).toHaveBeenCalledWith([A, B], 600);
    await signedPhotoUrl(A);
    expect(mockSign).toHaveBeenCalledTimes(1);
  });
  it('signing out forgets the links (they belong to the account that asked)', async () => {
    await signedPhotoUrl(A);
    act(() => forgetPhotoUrls());
    await signedPhotoUrl(A);
    expect(mockSign).toHaveBeenCalledTimes(2);
  });
  it('offline → initials, and it tries again next time', async () => {
    mockSign.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await signedPhotoUrl(A)).toBeNull();
    expect(await signedPhotoUrl(A)).not.toBeNull();
  });
});
