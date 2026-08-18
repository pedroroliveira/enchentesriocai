import '@testing-library/jest-dom';
import { vi } from 'vitest';

process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/test';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

// Mock matchMedia. Guarded so node-environment tests (e.g. the dev-tools
// boot-spinner boundary test, which drives real vite serve/build) can share
// this setup file without a DOM.
if (typeof window !== 'undefined') {
  if (typeof window.localStorage?.clear !== 'function') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() });
  }
  if (typeof window.sessionStorage?.clear !== 'function') {
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
