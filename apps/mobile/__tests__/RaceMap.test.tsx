import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { RaceMap } from '../src/components/RaceMap';

describe('race map', () => {
  it('always shows the OpenStreetMap / OpenFreeMap credit as visible text with links', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<RaceMap label="Map" height={200} pins={[{ id: 'a', lat: 10.6, lng: -61.5, label: 'Start' }]} />);
    const credit = await screen.findByTestId('map-attribution', {}, { timeout: 30_000 });
    expect(credit).toHaveTextContent('OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors');
    fireEvent.press(screen.getByText('© OpenStreetMap contributors'));
    expect(open).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
  }, 30_000);
});
