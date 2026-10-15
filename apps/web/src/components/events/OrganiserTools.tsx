'use client';
import { useActionState, useState } from 'react';
import { Button, Field, Input, Notice, Select } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { addMedia, addSponsor, inviteCoOrganiser } from '@/app/organiser/events/actions';

const MAX_BYTES = 5 * 1024 * 1024;

export function MediaUploader({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addMedia, {});
  const [path, setPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    setErr(null);
    setPath('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setErr('Use a JPG, PNG or WebP image.');
    if (file.size > MAX_BYTES) return setErr('Images must be 5 MB or smaller.');
    setUploading(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const p = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await createClient().storage.from('event-media').upload(p, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return setErr('Upload failed. Check your connection and try again.');
    setPath(p);
  };

  return (
    <form action={action}>
      {(err || state.error) && <Notice tone="danger">{err ?? state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="event" value={eventId} />
      <input type="hidden" name="path" value={path} />
      <Field label="Image (JPG, PNG or WebP, up to 5 MB)" htmlFor={`media-file-${eventId}`}>
        <input id={`media-file-${eventId}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void onFile(e.target.files?.[0])} />
      </Field>
      <Field label="Type" htmlFor={`media-kind-${eventId}`}>
        <Select id={`media-kind-${eventId}`} name="kind" defaultValue="flyer">
          <option value="flyer">Flyer</option>
          <option value="route_map">Route map</option>
          <option value="gallery">Photo</option>
        </Select>
      </Field>
      <Field label="Describe the image (alt text, required)" htmlFor={`media-alt-${eventId}`} hint="For people using screen readers, e.g. “Race flyer: 5K on 1 March, 6am start”.">
        <Input id={`media-alt-${eventId}`} name="alt" maxLength={300} required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending || uploading || !path}>
        {uploading ? 'Uploading…' : 'Add image'}
      </Button>
    </form>
  );
}

export function SponsorForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addSponsor, {});
  return (
    <form action={action} className="mt-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="event" value={eventId} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Sponsor name" htmlFor={`sp-name-${eventId}`}>
          <Input id={`sp-name-${eventId}`} name="name" maxLength={120} required />
        </Field>
        <Field label="Website (optional)" htmlFor={`sp-url-${eventId}`}>
          <Input id={`sp-url-${eventId}`} name="url" type="url" placeholder="https://" />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add sponsor
      </Button>
    </form>
  );
}

export function InviteForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(inviteCoOrganiser, {});
  return (
    <form action={action} className="mt-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.ok && <Notice tone="success">{state.ok}</Notice>}
      <input type="hidden" name="event" value={eventId} />
      <Field label="Their RunLime account email" htmlFor={`inv-${eventId}`}>
        <Input id={`inv-${eventId}`} name="email" type="email" required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        Invite co-organiser
      </Button>
    </form>
  );
}
