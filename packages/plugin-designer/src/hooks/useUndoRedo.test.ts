/**
 * Tests for useUndoRedo, including the new sessionStorage-backed persistence.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('useUndoRedo', () => {
  it('pushes, undoes, and redoes states', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0));
    expect(result.current.current).toBe(0);
    act(() => result.current.push(1));
    act(() => result.current.push(2));
    expect(result.current.current).toBe(2);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.current).toBe(1);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.current).toBe(2);
  });

  it('caps history to maxHistory', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0, { maxHistory: 3 }));
    act(() => {
      result.current.push(1);
      result.current.push(2);
      result.current.push(3);
      result.current.push(4);
      result.current.push(5);
    });
    expect(result.current.undoCount).toBe(3);
  });

  it('jumpTo moves to an arbitrary index in one update', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0));
    act(() => {
      result.current.push(1);
      result.current.push(2);
      result.current.push(3);
    });
    expect(result.current.timeline).toEqual([0, 1, 2, 3]);
    expect(result.current.currentIndex).toBe(3);
    act(() => result.current.jumpTo(0));
    expect(result.current.current).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.redoCount).toBe(3);
    act(() => result.current.jumpTo(2));
    expect(result.current.current).toBe(2);
    expect(result.current.undoCount).toBe(2);
    expect(result.current.redoCount).toBe(1);
  });

  it('jumpTo ignores out-of-range indexes', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0));
    act(() => result.current.push(1));
    act(() => result.current.jumpTo(99));
    expect(result.current.current).toBe(1);
    act(() => result.current.jumpTo(-1));
    expect(result.current.current).toBe(1);
  });
});

describe('useUndoRedo — persistence', () => {
  let storage: MemStorage;
  beforeEach(() => { storage = new MemStorage(); });

  it('persists state to the configured storage on every change', () => {
    const { result } = renderHook(() =>
      useUndoRedo<number>(0, { persistKey: 'k', storage }),
    );
    act(() => result.current.push(1));
    act(() => result.current.push(2));
    const stored = JSON.parse(storage.getItem('k')!);
    expect(stored.current).toBe(2);
    expect(stored.past).toEqual([0, 1]);
    expect(stored.future).toEqual([]);
  });

  it('rehydrates from storage on the next mount', () => {
    storage.setItem('k', JSON.stringify({ v: 1, past: [0, 1], current: 2, future: [] }));
    const { result } = renderHook(() =>
      useUndoRedo<number>(0, { persistKey: 'k', storage }),
    );
    expect(result.current.current).toBe(2);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.undoCount).toBe(2);
    act(() => result.current.undo());
    expect(result.current.current).toBe(1);
  });

  it('ignores corrupt persisted data and falls back to initial state', () => {
    storage.setItem('k', '{not json');
    const { result } = renderHook(() =>
      useUndoRedo<number>(7, { persistKey: 'k', storage }),
    );
    expect(result.current.current).toBe(7);
    expect(result.current.canUndo).toBe(false);
  });

  it('clearPersisted removes the storage entry', () => {
    const { result } = renderHook(() =>
      useUndoRedo<number>(0, { persistKey: 'k', storage }),
    );
    act(() => result.current.push(1));
    expect(storage.getItem('k')).not.toBeNull();
    act(() => result.current.clearPersisted());
    expect(storage.getItem('k')).toBeNull();
  });

  it('does not touch storage when persistKey is omitted', () => {
    const { result } = renderHook(() =>
      useUndoRedo<number>(0, { storage }),
    );
    act(() => result.current.push(1));
    expect(storage.data.size).toBe(0);
  });
});
