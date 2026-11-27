import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mswServer';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class MockAudio {
  src = '';
  volume = 0.85;
  currentTime = 0;
  duration = 30;
  paused = true;
  private listeners: Record<string, Array<() => void>> = {};

  addEventListener(event: string, handler: () => void) {
    this.listeners[event] = this.listeners[event] ?? [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event: string, handler: () => void) {
    this.listeners[event] = (this.listeners[event] ?? []).filter((h) => h !== handler);
  }

  emit(event: string) {
    for (const h of this.listeners[event] ?? []) {
      h();
    }
  }

  play = vi.fn().mockImplementation(() => {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
    this.emit('pause');
  });

  load = vi.fn();
}

vi.stubGlobal('Audio', MockAudio);

Object.defineProperty(navigator, 'mediaSession', {
  writable: true,
  value: {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn(),
  },
});

if (typeof window.MediaMetadata === 'undefined') {
  vi.stubGlobal(
    'MediaMetadata',
    class MediaMetadata {
      title?: string;
      artist?: string;
      album?: string;
      artwork?: Array<{ src: string; sizes?: string; type?: string }>;
      constructor(init: {
        title?: string;
        artist?: string;
        album?: string;
        artwork?: Array<{ src: string; sizes?: string; type?: string }>;
      }) {
        Object.assign(this, init);
      }
    },
  );
}
