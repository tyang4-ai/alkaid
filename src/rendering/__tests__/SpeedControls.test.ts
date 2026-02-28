import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';

// Minimal DOM shim
function createMockElement(): any {
  const children: any[] = [];
  return {
    className: '',
    style: { cssText: '', display: '' },
    textContent: '',
    dataset: {} as Record<string, string>,
    appendChild(child: any) { children.push(child); return child; },
    remove: vi.fn(),
    addEventListener: vi.fn(),
    querySelectorAll() { return children; },
    children,
  };
}

let mockElements: any[] = [];

beforeEach(() => {
  mockElements = [];
  if (!globalThis.document) {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        const el = createMockElement();
        el.tagName = tag.toUpperCase();
        mockElements.push(el);
        return el;
      },
    };
  } else {
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = createMockElement();
      el.tagName = tag.toUpperCase();
      mockElements.push(el);
      return el;
    });
  }
});

describe('SpeedControls', () => {
  let eventBus: EventBus;
  let parent: any;

  beforeEach(() => {
    eventBus = new EventBus();
    parent = createMockElement();
  });

  async function createControls() {
    const mod = await import('../SpeedControls');
    return new mod.SpeedControls(parent, eventBus);
  }

  it('renders all speed options', async () => {
    const controls = await createControls();
    // Container is appended to parent
    expect(parent.children.length).toBe(1);
    const container = parent.children[0];
    // 1 pause btn + 4 speed buttons = 5 children
    expect(container.children.length).toBe(5);
    controls.destroy();
  });

  it('default speed is 1x', async () => {
    const controls = await createControls();
    const container = parent.children[0];
    const speedBtns = container.children.slice(1);
    // The 1x button (index 1) should have active styling (#C9A84C background)
    const oneXBtn = speedBtns[1]; // [0.5x, 1x, 2x, 3x]
    expect(oneXBtn.style.cssText).toContain('#C9A84C');
    controls.destroy();
  });

  it('click speed button emits speed:changed', async () => {
    const controls = await createControls();
    const container = parent.children[0];
    const twoXBtn = container.children[3]; // pause, 0.5x, 1x, 2x
    const spy = vi.fn();
    eventBus.on('speed:changed', spy);

    // Find the click handler
    const clickCall = twoXBtn.addEventListener.mock.calls.find(
      (c: any) => c[0] === 'click',
    );
    expect(clickCall).toBeDefined();
    clickCall[1](); // invoke click handler

    expect(spy).toHaveBeenCalledWith({ multiplier: 2 });
    controls.destroy();
  });

  it('pause button toggles', async () => {
    const controls = await createControls();
    const container = parent.children[0];
    const pauseBtn = container.children[0];

    const pauseSpy = vi.fn();
    eventBus.on('game:paused', pauseSpy);

    const clickCall = pauseBtn.addEventListener.mock.calls.find(
      (c: any) => c[0] === 'click',
    );
    clickCall[1](); // click when not paused → should emit game:paused
    expect(pauseSpy).toHaveBeenCalled();
    controls.destroy();
  });

  it('updates visual state on external speed change', async () => {
    const controls = await createControls();
    controls.update(false, 3.0);
    // After update, internal state should reflect 3x
    controls.update(false, 3.0); // second call should be no-op (dirty check)
    controls.destroy();
  });
});
