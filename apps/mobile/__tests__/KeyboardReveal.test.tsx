import { fireEvent, render, screen } from '@testing-library/react-native';
import { RevealContext, TextField, revealOffset } from '@/components/ui';

describe('fields stay visible above the keyboard (owner retest B2)', () => {
  const view = { offset: 0, height: 400 }; // visible part of the screen once the keyboard is open

  it('a box that sits below the visible area scrolls up until its bottom edge is visible, with a margin', () => {
    expect(revealOffset({ y: 500, height: 120 }, view)).toBe(500 + 120 + 16 - 400);
  });
  it('a box that has grown taller scrolls further, so its last line stays visible', () => {
    const small = revealOffset({ y: 300, height: 60 }, view);
    const grown = revealOffset({ y: 300, height: 140 }, view);
    expect(small).toBeNull(); // 300+60+16 <= 400: already visible
    expect(grown).toBe(300 + 140 + 16 - 400);
  });
  it('a box above the visible area scrolls down to show its top', () => {
    expect(revealOffset({ y: 100, height: 60 }, { offset: 300, height: 400 })).toBe(84);
  });
  it('a box taller than the visible area keeps its top in view (it scrolls inside)', () => {
    expect(revealOffset({ y: 500, height: 500 }, view)).toBe(484);
  });

  it('every text field asks to be revealed on focus and whenever a multi-line box grows', () => {
    const reveal = jest.fn();
    render(
      <RevealContext.Provider value={reveal}>
        <TextField label="Tell us what happened" multiline value="" onChangeText={() => undefined} />
        <TextField label="Name" value="" onChangeText={() => undefined} />
      </RevealContext.Provider>,
    );
    fireEvent(screen.getByLabelText('Tell us what happened'), 'focus');
    fireEvent(screen.getByLabelText('Tell us what happened'), 'contentSizeChange', { nativeEvent: { contentSize: { width: 300, height: 140 } } });
    fireEvent(screen.getByLabelText('Name'), 'focus');
    fireEvent(screen.getByLabelText('Name'), 'contentSizeChange', { nativeEvent: { contentSize: { width: 300, height: 40 } } });
    expect(reveal).toHaveBeenCalledTimes(3); // focus ×2 + the multi-line box growing (single-line growth ignored)
  });

  it('multi-line boxes are capped (about a third of the screen) and scroll inside', () => {
    render(<TextField label="Notes" multiline value="" onChangeText={() => undefined} />);
    const style = Object.assign({}, ...(screen.getByLabelText('Notes').props.style as object[]).flat().filter(Boolean));
    expect(style.maxHeight).toBeGreaterThan(100);
  });
});
