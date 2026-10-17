'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Textarea } from '@/components/ui';
import { createOrganisation } from '../actions';

export function CreateOrganisationForm() {
  const [state, action, pending] = useActionState(createOrganisation, {});
  return (
    <form action={action} className="max-w-xl">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Organisation name" htmlFor="org-name">
        <Input id="org-name" name="name" required maxLength={120} />
      </Field>
      <Field label="Contact email" htmlFor="org-email">
        <Input id="org-email" name="contact_email" type="email" required />
      </Field>
      <Field label="Contact phone" htmlFor="org-phone">
        <Input id="org-phone" name="contact_phone" required maxLength={30} />
      </Field>
      <Field label="Website (optional)" htmlFor="org-web">
        <Input id="org-web" name="website" type="url" placeholder="https://" />
      </Field>
      <Field label="About the organisation" htmlFor="org-about" hint="At least 20 characters. Shown to admins only.">
        <Textarea id="org-about" name="about" rows={3} required minLength={20} maxLength={2000} />
      </Field>
      <label className="flex items-center gap-2 mb-4">
        <input type="checkbox" name="is_charity" /> Registered charity
      </label>
      <Field
        label="Organiser's RunLime account email (optional)"
        htmlFor="org-owner"
        hint="If they already have an account, they become the organisation's owner and get organiser access. Leave blank to add them later."
      >
        <Input id="org-owner" name="owner_email" type="email" />
      </Field>
      <Button type="submit" disabled={pending}>
        Create verified organisation
      </Button>
    </form>
  );
}
