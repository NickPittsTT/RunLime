'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { deleteMyAccount } from './actions';

export function DeleteForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteMyAccount, {});
  return (
    <form action={action} className="rounded-xl border border-danger/40 p-6 mt-6">
      <h2 className="text-xl font-bold mb-2 break-words [overflow-wrap:anywhere]">Delete the account for {email}</h2>
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <Field label="Type DELETE to confirm" htmlFor="confirm" hint="This is permanent and cannot be undone.">
        <Input id="confirm" name="confirm" autoComplete="off" aria-describedby="confirm-hint" required />
      </Field>
      <Button variant="danger" type="submit" disabled={pending}>
        {pending ? 'Deleting…' : 'Delete my account'}
      </Button>
    </form>
  );
}
