'use client';
import { useState } from 'react';

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-line px-5 py-3 font-semibold"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* cancelled */
          }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
    >
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
