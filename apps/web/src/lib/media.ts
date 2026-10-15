/** Public URL of an image in the event-media bucket. */
export function eventMediaUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}
