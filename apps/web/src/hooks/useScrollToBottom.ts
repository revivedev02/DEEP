import { useEffect, useRef } from 'react';

/**
 * Scrolls a ref'd element to its bottom whenever deps change.
 * - Initial load (prevLen was 0 → content just appeared): instant jump to bottom.
 * - New single message and user is near bottom: smooth scroll.
 * - User scrolled up reading history: no-op.
 */
export function useScrollToBottom<T extends HTMLElement>(deps: unknown[]) {
  const ref     = useRef<T>(null);
  const prevLen = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Track length from the first numeric dep (messages.length)
    const lenDep = deps.find(d => typeof d === 'number');
    const newLen = typeof lenDep === 'number' ? lenDep : 0;

    if (prevLen.current === 0 && newLen > 0) {
      // Initial load — wait one frame so DOM has painted, then jump instantly
      requestAnimationFrame(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
      });
    } else {
      // Subsequent updates — only auto-scroll if user is near bottom
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
      if (nearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }

    prevLen.current = newLen;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
