import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard, StyleSheet } from 'react-native';
import { RevealContext, Screen, TextField, keyboardOverlap, revealOffset } from '@/components/ui';

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

describe('Android keyboard: the screen content stops at the keyboard (owner retest R2, round 3)', () => {
  it('the overlap uses window coordinates: a screen under an 80 dp header loses its lower 300 dp to the keyboard', () => {
    // Screen frame in the window: starts below the header at 80, 700 tall → bottom edge at 780. Keyboard top at 480.
    expect(keyboardOverlap({ y: 80, height: 700 }, 480)).toBe(300);
    // What KeyboardAvoidingView computed with its parent-relative frame (y = 0): 80 dp short, the bug on the phone.
    expect(keyboardOverlap({ y: 0, height: 700 }, 480)).toBe(220);
    expect(keyboardOverlap({ y: 80, height: 700 }, 900)).toBe(0);
  });

  it('when the keyboard opens, the screen pads by the measured overlap; when it closes, the padding goes', () => {
    const listeners: Record<string, (e: { endCoordinates: { screenY: number; height: number } }) => void> = {};
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: never) => void) => {
      listeners[event] = cb as never;
      return { remove: () => undefined } as never;
    }) as never);
    render(
      <Screen>
        <TextField label="Tell us what happened" multiline value="" onChangeText={() => undefined} />
      </Screen>,
    );
    // The native View is a mocked component in Jest: give its measureInWindow the frame a phone would report.
    type Node = { parent: Node | null; instance: { measureInWindow?: unknown } | null };
    let node = screen.getByTestId('screen-frame') as unknown as Node | null;
    while (node && !node.instance?.measureInWindow) node = node.parent;
    node!.instance!.measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 80, 400, 700);
    act(() => (listeners.keyboardDidShow ?? listeners.keyboardWillShow)?.({ endCoordinates: { screenY: 480, height: 320 } }));
    expect(StyleSheet.flatten(screen.getByTestId('screen-frame').props.style).paddingBottom).toBe(300);
    act(() => (listeners.keyboardDidHide ?? listeners.keyboardWillHide)?.({ endCoordinates: { screenY: 900, height: 0 } }));
    expect(StyleSheet.flatten(screen.getByTestId('screen-frame').props.style).paddingBottom).toBe(0);
    spy.mockRestore();
  });
});
