import { useCallback, useState } from 'react';

/**
 * Field errors that clear as soon as the person edits that field (owner retest 2026-10-18: a "too short" message
 * stayed on screen after the text was long enough). Errors are set on submit, as before.
 */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clear = useCallback((field: string) => setErrors((e) => (field in e ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== field)) : e)), []);
  /** Wraps a setter so typing in `field` clears its error. */
  const edit = useCallback(<T,>(field: string, set: (v: T) => void) => (v: T) => {
    set(v);
    clear(field);
  }, [clear]);
  return { errors, setErrors, clear, edit };
}
