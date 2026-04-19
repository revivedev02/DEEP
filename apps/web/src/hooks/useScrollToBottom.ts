import { useEffect, useRef } from 'react';

/** Smoothly scroll a ref'd element to its bottom whenever deps change. */
export function useScrollToBottom<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const overflow          = el.scrollHeight - el.clientHeight;
    const distanceFromBottom = overflow - el.scrollTop;
    const nearBottom = distanceFromBottom < 300;
    // Only fire the isAtTop heuristic if there's real content (>50px overflow).
    // Prevents skeleton inflation from triggering a spurious scroll-to-bottom
    // on channels that finish loading with 0 messages.
    const isAtTop = el.scrollTop === 0 && overflow > 50;

    if (nearBottom || isAtTop) {
      el.scrollTop = el.scrollHeight;
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
