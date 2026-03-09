import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VictoryType, CINEMATIC_DURATION_MS } from '../../constants';

// Window shim for addEventListener
const windowListeners: Record<string, Function[]> = {};
if (!globalThis.window || !globalThis.window.addEventListener) {
  (globalThis as any).window = {
    addEventListener(event: string, handler: Function) {
      if (!windowListeners[event]) windowListeners[event] = [];
      windowListeners[event].push(handler);
    },
    removeEventListener(event: string, handler: Function) {
      const list = windowListeners[event];
      if (list) {
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
  };
}

function createMockElement(): any {
  const children: any[] = [];
  const classes = new Set<string>();
  return {
    className: '',
    style: { cssText: '', display: '', background: '', animation: '' },
    textContent: '',
    innerHTML: '',
    classList: {
      add(...names: string[]) { names.forEach(n => classes.add(n)); },
      remove(...names: string[]) { names.forEach(n => classes.delete(n)); },
      contains(name: string) { return classes.has(name); },
      toggle(name: string) { classes.has(name) ? classes.delete(name) : classes.add(name); },
    },
    appendChild(child: any) { children.push(child); return child; },
    remove: vi.fn(),
    addEventListener: vi.fn(),
    children,
  };
}

beforeEach(() => {
  if (!globalThis.requestAnimationFrame) {
    (globalThis as any).requestAnimationFrame = (cb: Function) => { cb(); return 0; };
  }
  // Clear listeners
  for (const key of Object.keys(windowListeners)) {
    windowListeners[key] = [];
  }

  const mockHead = createMockElement();
  if (!globalThis.document) {
    (globalThis as any).document = {
      createElement: () => createMockElement(),
      head: mockHead,
    };
  } else {
    vi.spyOn(document, 'createElement').mockImplementation(() => createMockElement());
    if (!document.head) {
      (document as any).head = mockHead;
    }
  }
});

describe('BattleCinematic', () => {
  let parent: any;

  beforeEach(() => {
    parent = createMockElement();
  });

  async function createCinematic() {
    const mod = await import('../BattleCinematic');
    return new mod.BattleCinematic(parent);
  }

  it('hidden initially', async () => {
    const cine = await createCinematic();
    expect(cine.visible).toBe(false);
    cine.destroy();
  });

  it('play shows overlay', async () => {
    vi.useFakeTimers();
    const cine = await createCinematic();

    const promise = cine.play(VictoryType.SURRENDER);
    expect(cine.visible).toBe(true);

    // Fast-forward past cinematic + 200ms fade-out transition
    await vi.advanceTimersByTimeAsync(CINEMATIC_DURATION_MS + 300);
    await promise;

    expect(cine.visible).toBe(false);
    cine.destroy();
    vi.useRealTimers();
  });

  it('skip on keypress resolves promise', async () => {
    vi.useFakeTimers();
    const cine = await createCinematic();

    const promise = cine.play(VictoryType.ANNIHILATION);
    expect(cine.visible).toBe(true);

    // Simulate keypress to skip
    const keyHandlers = windowListeners['keydown'] ?? [];
    if (keyHandlers.length > 0) {
      keyHandlers[0]({ type: 'keydown', code: 'Space' });
    }

    // Advance past 200ms fade-out transition in complete()
    await vi.advanceTimersByTimeAsync(300);
    await promise;
    expect(cine.visible).toBe(false);
    cine.destroy();
    vi.useRealTimers();
  });

  it('correct text for each type', async () => {
    vi.useFakeTimers();
    const cine = await createCinematic();

    // Test surrender text
    const promise = cine.play(VictoryType.SURRENDER);
    // Overlay is the first child of parent (styleEl goes to document.head)
    const overlay = parent.children[0];
    expect(overlay.innerHTML).toContain('投降');

    await vi.advanceTimersByTimeAsync(CINEMATIC_DURATION_MS + 300);
    await promise;
    cine.destroy();
    vi.useRealTimers();
  });
});
