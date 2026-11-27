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
 * Forces an initial painted off-screen frame before entering so mobile WebViews
 * always animate smoothly rather than collapsing into a 0ms jump.
 */
export function useAnimatedOverlay(isOpen: boolean, durationMs = 340): AnimatedOverlayState {
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
      setIsVisible(false);
      rafRef.current = window.requestAnimationFrame(() => {
        if (typeof document !== 'undefined') {
          // Force style commit of initial translateY(100%) state before animating to translateY(0)
          void document.body.offsetHeight;
        }
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
