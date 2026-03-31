import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '@/hooks/use-online-status';

describe('useOnlineStatus', () => {
  const originalOnLine = window.navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore navigator.onLine after each test
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('updates to false when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('updates to true when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('handles multiple connectivity changes', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);
  });

  it('removes event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());

    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
