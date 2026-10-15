import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { DateOfBirthInput } from '../src/components/DateOfBirthInput';

/** The Jest TextInput mock shares one `focus` jest.fn; `mock.contexts` tells us which input was focused. */
const focus = (TextInput.prototype as unknown as { focus: jest.Mock }).focus;
const focusedIds = () => focus.mock.contexts.map((ctx) => (ctx as { props: { testID?: string } }).props.testID);

describe('date of birth input', () => {
  beforeAll(async () => {
    render(<DateOfBirthInput onSubmit={() => undefined} />);
    await screen.findByText('What is your date of birth?', {}, { timeout: 60_000 });
    cleanup();
  }, 60_000);

  beforeEach(() => focus.mockClear());

  it('moves Day -> Month -> Year after two digits each', () => {
    render(<DateOfBirthInput onSubmit={() => undefined} />);
    fireEvent.changeText(screen.getByLabelText('Day'), '1');
    expect(focusedIds()).toEqual([]);
    fireEvent.changeText(screen.getByLabelText('Day'), '15');
    fireEvent.changeText(screen.getByLabelText('Month'), '06');
    expect(focusedIds()).toEqual(['dob-month', 'dob-year']);
  });

  it('uses Next on Day and Month, and Done on Year submits', () => {
    const onSubmit = jest.fn();
    render(<DateOfBirthInput onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Day').props.returnKeyType).toBe('next');
    expect(screen.getByLabelText('Month').props.returnKeyType).toBe('next');
    expect(screen.getByLabelText('Year').props.returnKeyType).toBe('done');
    fireEvent.changeText(screen.getByLabelText('Day'), '5');
    fireEvent(screen.getByLabelText('Day'), 'submitEditing');
    fireEvent.changeText(screen.getByLabelText('Month'), '6');
    fireEvent(screen.getByLabelText('Month'), 'submitEditing');
    expect(focusedIds()).toEqual(['dob-month', 'dob-year']);
    fireEvent.changeText(screen.getByLabelText('Year'), '1990');
    fireEvent(screen.getByLabelText('Year'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('5', '6', '1990');
  });

  it('goes back to the previous box on backspace in an empty box only', () => {
    render(<DateOfBirthInput onSubmit={() => undefined} />);
    const backspace = { nativeEvent: { key: 'Backspace' } };
    fireEvent(screen.getByLabelText('Year'), 'keyPress', backspace);
    fireEvent(screen.getByLabelText('Month'), 'keyPress', backspace);
    expect(focusedIds()).toEqual(['dob-month', 'dob-day']);
    focus.mockClear();
    fireEvent.changeText(screen.getByLabelText('Month'), '1');
    fireEvent(screen.getByLabelText('Month'), 'keyPress', backspace);
    expect(focusedIds()).toEqual([]);
  });

  it('strips non-digits and asks for a complete date on Done', () => {
    const onSubmit = jest.fn();
    render(<DateOfBirthInput onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('Day'), '1a');
    expect(screen.getByLabelText('Day').props.value).toBe('1');
    fireEvent(screen.getByLabelText('Year'), 'submitEditing');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter your full date of birth.')).toBeTruthy();
  });
});
