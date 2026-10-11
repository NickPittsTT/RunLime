'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { saveClub } from './actions';

export interface ClubRow {
  id: string;
  name: string;
  description: string | null;
  region_id: string | null;
}

export function ClubForm({ club, areas }: { club?: ClubRow; areas: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveClub, {});
  const p = club ? `club-${club.id}` : 'club-new';
  return (
    <form action={action}>
      {club && <input type="hidden" name="id" value={club.id} />}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <Field label="Club name" htmlFor={`${p}-name`}>
        <Input id={`${p}-name`} name="name" required maxLength={80} defaultValue={club?.name} />
      </Field>
      <Field label="Description (optional)" htmlFor={`${p}-description`}>
        <Textarea id={`${p}-description`} name="description" rows={2} maxLength={500} defaultValue={club?.description ?? ''} />
      </Field>
      <Field label="Area (optional)" htmlFor={`${p}-region`}>
        <Select id={`${p}-region`} name="regionId" defaultValue={club?.region_id ?? ''}>
          <option value="">Anywhere in T&amp;T</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        {club ? 'Save changes' : 'Create club'}
      </Button>
    </form>
  );
}
