'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { setPlatformAdmin } from './actions';

export function RoleButton({ userId, isPlatformAdmin, name }: { userId: string; isPlatformAdmin: boolean; name: string }) {
  const [state, action, pending] = useActionState(setPlatformAdmin, {});
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="grant" value={String(!isPlatformAdmin)} />
      <Button type="submit" variant={isPlatformAdmin ? 'secondary' : 'primary'} disabled={pending} aria-label={`${isPlatformAdmin ? 'Remove' : 'Make'} ${name} platform admin`}>
        {isPlatformAdmin ? 'Remove admin' : 'Make admin'}
      </Button>
      {state.error && <p role="alert" className="text-danger text-sm">{state.error}</p>}
      {state.ok && <p role="status" className="text-success text-sm">{state.ok}</p>}
    </form>
  );
}
