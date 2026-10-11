'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Textarea } from '@/components/ui';
import { applyAsOrganiser, type ApplyState } from './actions';

export function ApplyForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAsOrganiser, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="max-w-xl">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Organisation or race name" htmlFor="organisationName" error={fe.organisationName}>
        <Input id="organisationName" name="organisationName" required maxLength={120} />
      </Field>
      <Field label="Contact email for runners" htmlFor="contactEmail" error={fe.contactEmail}>
        <Input id="contactEmail" name="contactEmail" type="email" required />
      </Field>
      <Field label="Contact phone" htmlFor="contactPhone" error={fe.contactPhone}>
        <Input id="contactPhone" name="contactPhone" type="tel" required placeholder="+1 868 555 0100" />
      </Field>
      <Field label="Website or social page (optional)" htmlFor="website" error={fe.website}>
        <Input id="website" name="website" type="url" placeholder="https://" />
      </Field>
      <Field label="About your organisation and races" htmlFor="about" error={fe.about} hint="Who you are, which races you run, and for how long.">
        <Textarea id="about" name="about" required rows={5} maxLength={2000} aria-describedby="about-hint" />
      </Field>
      <label className="flex gap-3 items-start mb-6">
        <input type="checkbox" name="isCharity" className="mt-1 h-5 w-5" />
        <span>We are a registered charity or non-profit</span>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Submit application'}
      </Button>
    </form>
  );
}
