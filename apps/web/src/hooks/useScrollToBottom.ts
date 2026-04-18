import { useEffect, useRef } from 'react';

/** Smoothly scroll a ref'd element to its bottom whenever deps change. */
export function useScrollToBottom<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    // Scroll to bottom if:
    // 1. User is near the bottom (within 300px) — for new incoming messages
    // 2. scrollTop is still 0 but element has content — this catches timing where
    //    the MessageList rAF hasn't fired yet but the hook fires first
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 300;
    const isAtTop = el.scrollTop === 0 && el.scrollHeight > el.clientHeight;

    if (nearBottom || isAtTop) {
      el.scrollTop = el.scrollHeight;
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
