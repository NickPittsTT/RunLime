'use client';
import { useActionState } from 'react';
import { Button, Input, Notice, Select, Textarea } from '@/components/ui';
import { saveSetting } from './actions';

export function SettingForm({ settingKey, value, description }: { settingKey: string; value: unknown; description: string | null }) {
  const [state, action, pending] = useActionState(saveSetting, {});
  const kind = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : typeof value === 'string' || value === null ? 'string' : 'json';
  const id = `set-${settingKey.replace(/\W/g, '-')}`;
  return (
    <form action={action} className="py-4">
      <label htmlFor={id} className="block font-mono text-sm font-semibold">
        {settingKey}
      </label>
      {description && <p className="text-sm text-ink-muted mb-2">{description}</p>}
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="key" value={settingKey} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-3 items-start">
        {kind === 'boolean' ? (
          <Select id={id} name="value" defaultValue={String(value)} className="max-w-40">
            <option value="true">On</option>
            <option value="false">Off</option>
          </Select>
        ) : kind === 'number' ? (
          <Input id={id} name="value" type="number" step="any" defaultValue={String(value)} className="max-w-40" />
        ) : kind === 'string' && String(value ?? '').length < 80 ? (
          <Input id={id} name="value" defaultValue={(value as string | null) ?? ''} />
        ) : (
          <Textarea id={id} name="value" rows={3} defaultValue={kind === 'json' ? JSON.stringify(value) : ((value as string | null) ?? '')} />
        )}
        <Button type="submit" variant="secondary" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}
