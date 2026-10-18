'use client';
import { useActionState } from 'react';
import { Button, Notice } from '@/components/ui';
import { removePhotoAction, resolveReportAction } from './actions';

/** Actions for one open report. "Remove photo" appears for photo reports while the reported photo is still shown. */
export function ReportActions({ reportId, userId, canRemovePhoto }: { reportId: string; userId: string | null; canRemovePhoto: boolean }) {
  const [removeState, remove, removing] = useActionState(removePhotoAction, {});
  const [resolveState, resolve, resolving] = useActionState(resolveReportAction, {});
  const state = removeState.error || removeState.ok ? removeState : resolveState;
  return (
    <div className="mt-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="flex flex-wrap gap-3 items-end">
        {canRemovePhoto && userId && (
          <form action={remove}>
            <input type="hidden" name="reportId" value={reportId} />
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="note" value="Photo removed: breaks the photo rules" />
            <Button type="submit" variant="danger" disabled={removing}>
              Remove photo
            </Button>
          </form>
        )}
        <form action={resolve} className="flex flex-wrap gap-3 items-end">
          <input type="hidden" name="reportId" value={reportId} />
          <label className="block">
            <span className="text-sm font-semibold">Note (kept in the history)</span>
            <input name="note" maxLength={500} className="block border border-line rounded-lg px-3 py-2 min-h-11" />
          </label>
          <Button type="submit" name="status" value="actioned" variant="secondary" disabled={resolving}>
            Mark as handled
          </Button>
          <Button type="submit" name="status" value="dismissed" variant="secondary" disabled={resolving}>
            Dismiss
          </Button>
        </form>
      </div>
    </div>
  );
}
