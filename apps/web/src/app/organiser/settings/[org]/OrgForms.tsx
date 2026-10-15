'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { addMember, updateOrganisation } from './actions';

export function OrgDetailsForm({ org }: { org: { id: string; contact_email: string; contact_phone: string; website: string | null; about: string } }) {
  const [state, action, pending] = useActionState(updateOrganisation, {});
  return (
    <form action={action} className="max-w-xl">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="org" value={org.id} />
      <Field label="Contact email" htmlFor="org-email">
        <Input id="org-email" name="contactEmail" type="email" defaultValue={org.contact_email} required />
      </Field>
      <Field label="Contact phone" htmlFor="org-phone">
        <Input id="org-phone" name="contactPhone" defaultValue={org.contact_phone} required />
      </Field>
      <Field label="Website (optional)" htmlFor="org-web">
        <Input id="org-web" name="website" type="url" defaultValue={org.website ?? ''} placeholder="https://" />
      </Field>
      <Field label="About" htmlFor="org-about">
        <Textarea id="org-about" name="about" rows={4} defaultValue={org.about} required minLength={20} maxLength={2000} />
      </Field>
      <Button type="submit" disabled={pending}>
        Save details
      </Button>
    </form>
  );
}

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(addMember, {});
  return (
    <form action={action} className="max-w-xl mt-4">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="org" value={orgId} />
      <Field label="Their RunLime account email" htmlFor="mem-email">
        <Input id="mem-email" name="email" type="email" required />
      </Field>
      <Field label="Role" htmlFor="mem-role">
        <Select id="mem-role" name="role" defaultValue="manager">
          <option value="manager">Manager (manages events)</option>
          <option value="owner">Owner (also manages the team)</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add member
      </Button>
    </form>
  );
}
