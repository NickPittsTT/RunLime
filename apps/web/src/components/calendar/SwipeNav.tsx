'use client';
import { useRouter } from 'next/navigation';
import { useRef, type ReactNode } from 'react';

/** Horizontal swipe on touch screens moves to the previous/next month. Buttons remain for everyone else. */
export function SwipeNav({ prevHref, nextHref, children }: { prevHref: string; nextHref: string; children: ReactNode }) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) start.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        const t = e.changedTouches[0];
        start.current = null;
        if (!s || !t) return;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) router.push(dx < 0 ? nextHref : prevHref, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
