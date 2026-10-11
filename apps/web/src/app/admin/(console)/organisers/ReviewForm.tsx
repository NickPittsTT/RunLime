'use client';
import { useActionState } from 'react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { reviewOrganisation } from './actions';

export function ReviewForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(reviewOrganisation, {});
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="id" value={id} />
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <Field label="Reason (required to reject or suspend)" htmlFor={`reason-${id}`}>
        <Input id={`reason-${id}`} name="reason" maxLength={500} />
      </Field>
      <div className="flex flex-wrap gap-3">
        {status !== 'verified' && (
          <Button type="submit" name="decision" value="verified" disabled={pending}>
            {status === 'suspended' ? 'Reinstate' : 'Approve'}
          </Button>
        )}
        {status === 'applied' && (
          <Button type="submit" name="decision" value="rejected" variant="secondary" disabled={pending}>
            Reject
          </Button>
        )}
        {status === 'verified' && (
          <Button type="submit" name="decision" value="suspended" variant="danger" disabled={pending}>
            Suspend
          </Button>
        )}
      </div>
    </form>
  );
}
