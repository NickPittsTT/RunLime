'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui';

export const REASON_MIN = 5;
export const REASON_MAX = 500;

/** Reason box with the minimum shown up front and a live count (owner re-test 2026-10-17). */
export function ReasonField({ id, label, error }: { id: string; label: string; error?: string }) {
  const [value, setValue] = useState('');
  const n = value.trim().length;
  const short = n > 0 && n < REASON_MIN;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-semibold mb-1">
        {label}
      </label>
      <Textarea
        id={id}
        name="reason"
        rows={2}
        maxLength={REASON_MAX}
        placeholder={`Minimum ${REASON_MIN} characters`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={`${id}-count${error ? ` ${id}-error` : ''}`}
        aria-invalid={Boolean(error) || undefined}
      />
      <p id={`${id}-count`} className={`text-sm m-0 ${short ? 'text-danger' : 'text-ink-muted'}`} aria-live="polite">
        {n} / {REASON_MAX} characters · minimum {REASON_MIN}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-danger font-semibold m-0 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

/** Message shown when a required reason is too short. */
export function reasonTooShort(form: HTMLFormElement): string | undefined {
  const n = String(new FormData(form).get('reason') ?? '').trim().length;
  return n < REASON_MIN ? `Please give a reason of at least ${REASON_MIN} characters (you have ${n}).` : undefined;
}
