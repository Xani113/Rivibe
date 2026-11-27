import { useEffect, useRef, useState } from 'react';

interface AnimatedOverlayState {
  shouldRender: boolean;
  isVisible: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Interruptible mount/transition state for drawers, sheets, and modals.
 * Never locks user input on rapid open/close and cancels pending frames cleanly.
 */
export function useAnimatedOverlay(isOpen: boolean, durationMs = 280): AnimatedOverlayState {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(isOpen);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (isOpen) {
      setShouldRender(true);
      if (prefersReducedMotion()) {
        setIsVisible(true);
        return;
      }
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = window.requestAnimationFrame(() => {
          setIsVisible(true);
          rafRef.current = null;
        });
      });
      return;
    }

    setIsVisible(false);
    if (!shouldRender) return;

    if (prefersReducedMotion()) {
      setShouldRender(false);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setShouldRender(false);
      timerRef.current = null;
    }, durationMs);
  }, [isOpen, durationMs, shouldRender]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { shouldRender, isVisible };
}
