import { render, screen } from '@testing-library/react-native';
import { Avatar } from '@/components/Avatar';

// C2 (owner, 2026-10-30): the server returns no photo path for a Private account unless the viewer is an approved
// follower, the person or an admin (pgTAP 026). The app then shows initials, never an empty or broken image.
describe('profile photos on Private accounts (owner decision C2)', () => {
  it('no path from the server → initials', () => {
    render(<Avatar name="Ana Baptiste" path={null} />);
    expect(screen.getByTestId('avatar-initials')).toBeTruthy();
    expect(screen.getByText('AB')).toBeTruthy();
    expect(screen.queryByTestId('avatar-photo')).toBeNull();
  });
  it('a path (follower, Public account, self) → the photo', () => {
    render(<Avatar name="Ana Baptiste" path="00000000-0000-0000-0000-000000000000/0123456789abcdef0123456789abcdef.jpg" />);
    expect(screen.getByTestId('avatar-photo')).toBeTruthy();
  });
});
