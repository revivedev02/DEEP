import { useRef, useCallback } from 'react';

/**
 * A single absolutely-positioned highlight div that slides between .message-group
 * rows via translateY instead of toggling per-element backgrounds.
 * This gives the smooth "one puck gliding" effect seen in the demo.
 */
export function useFloatingHighlight(contentRef: React.RefObject<HTMLDivElement>) {
  const highlightRef = useRef<HTMLDivElement>(null);
  const lastTarget   = useRef<Element | null>(null);

  const onMouseOver = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const highlight = highlightRef.current;
    const content   = contentRef.current;
    if (!highlight || !content) return;

    // Walk up from the exact hovered element to find the message-group
    const target = (e.target as HTMLElement).closest?.('.message-group') as HTMLElement | null;

    // Same message — skip redundant style writes
    if (!target || target === lastTarget.current) return;
    lastTarget.current = target;

    const cRect = content.getBoundingClientRect();
    const mRect = target.getBoundingClientRect();

    // Offset from top of content wrapper (accounts for scroll automatically)
    const offsetTop = mRect.top - cRect.top;

    highlight.style.transform = `translateY(${offsetTop}px)`;
    highlight.style.height    = `${mRect.height}px`;
    highlight.style.opacity   = '1';
  }, [contentRef]);

  const onMouseLeave = useCallback(() => {
    lastTarget.current = null;
    if (highlightRef.current) highlightRef.current.style.opacity = '0';
  }, []);

  return { highlightRef, onMouseOver, onMouseLeave };
}
