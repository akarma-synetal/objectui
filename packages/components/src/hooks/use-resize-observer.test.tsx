import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useResizeObserver } from './use-resize-observer';

type Cb = (entries: any[]) => void;

class MockResizeObserver {
  static lastInstance: MockResizeObserver | null = null;
  callback: Cb;
  observed: Element | null = null;
  constructor(cb: Cb) {
    this.callback = cb;
    MockResizeObserver.lastInstance = this;
  }
  observe(el: Element) { this.observed = el; }
  disconnect() { this.observed = null; }
  unobserve() {}
  trigger(width: number, height: number) {
    this.callback([
      { borderBoxSize: [{ inlineSize: width, blockSize: height }], contentRect: { width, height } } as any,
    ]);
  }
}

beforeEach(() => {
  (globalThis as any).ResizeObserver = MockResizeObserver;
  MockResizeObserver.lastInstance = null;
});

function Probe({ onSize }: { onSize: (s: { width: number; height: number }) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const size = useResizeObserver(ref);
  React.useEffect(() => {
    onSize(size);
  }, [size, onSize]);
  return <div ref={ref} data-testid="probe" />;
}

describe('useResizeObserver', () => {
  it('reads initial size from getBoundingClientRect', () => {
    const sizes: Array<{ width: number; height: number }> = [];
    // Stub getBoundingClientRect on the rendered element.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 320,
      height: 200,
      top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    render(<Probe onSize={(s) => sizes.push(s)} />);
    expect(sizes.at(-1)).toEqual({ width: 320, height: 200 });
  });

  it('updates when ResizeObserver fires with new dimensions', () => {
    const sizes: Array<{ width: number; height: number }> = [];
    render(<Probe onSize={(s) => sizes.push(s)} />);
    expect(MockResizeObserver.lastInstance).toBeTruthy();
    act(() => {
      MockResizeObserver.lastInstance!.trigger(800, 600);
    });
    expect(sizes.at(-1)).toEqual({ width: 800, height: 600 });
  });

  it('does not re-render when size does not change (referential stability)', () => {
    const sizes: Array<{ width: number; height: number }> = [];
    render(<Probe onSize={(s) => sizes.push(s)} />);
    const initialCount = sizes.length;
    act(() => {
      MockResizeObserver.lastInstance!.trigger(800, 600);
    });
    const afterFirstChange = sizes.length;
    act(() => {
      // Same size again — should be a no-op.
      MockResizeObserver.lastInstance!.trigger(800, 600);
    });
    expect(sizes.length).toBe(afterFirstChange);
    expect(initialCount).toBeLessThan(afterFirstChange);
  });
});
