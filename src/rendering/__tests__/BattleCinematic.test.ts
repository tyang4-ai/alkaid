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
  return {
    className: '',
    style: { cssText: '', display: '', background: '', animation: '' },
    textContent: '',
    innerHTML: '',
    appendChild(child: any) { children.push(child); return child; },
    remove: vi.fn(),
    addEventListener: vi.fn(),
    children,
  };
}

beforeEach(() => {
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

    // Fast-forward to complete
    vi.advanceTimersByTime(CINEMATIC_DURATION_MS + 100);
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

    vi.advanceTimersByTime(CINEMATIC_DURATION_MS + 100);
    await promise;
    cine.destroy();
    vi.useRealTimers();
  });
});
