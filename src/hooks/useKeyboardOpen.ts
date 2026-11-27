import { useEffect, useState } from 'react';

function isEditableElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'range' && type !== 'checkbox' && type !== 'radio' && type !== 'button';
  }
  return tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Tracks whether a mobile soft keyboard is active via input focus + visualViewport shrinkage
 * so docked mobile navigation and mini-player never jump up awkwardly over inputs.
 */
export function useKeyboardOpen(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const baselineHeight = window.innerHeight;

    const evaluate = () => {
      const focusedInput = isEditableElement(document.activeElement);
      const viewport = window.visualViewport;
      const shrunk = viewport ? baselineHeight - viewport.height > 140 : false;
      setKeyboardOpen(focusedInput || shrunk);
    };

    const handleFocusIn = () => evaluate();
    const handleFocusOut = () => {
      window.setTimeout(evaluate, 60);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', evaluate);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', evaluate);
    };
  }, []);

  return keyboardOpen;
}
