import { useEffect, useRef } from 'react';

/** Smoothly scroll a ref'd element to its bottom whenever deps change. */
export function useScrollToBottom<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    // only auto-scroll if user is near bottom (within 200px)
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, deps);

  return ref;
}
