import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';

function createMockElement(): any {
  const children: any[] = [];
  const classes = new Set<string>();
  return {
    className: '',
    style: { cssText: '', display: '', marginTop: '', background: '', width: '' },
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
    parentElement: null as any,
  };
}

beforeEach(() => {
  if (!globalThis.requestAnimationFrame) {
    (globalThis as any).requestAnimationFrame = (cb: Function) => { cb(); return 0; };
  }
  if (!globalThis.document) {
    (globalThis as any).document = {
      createElement: () => {
        const el = createMockElement();
        el.parentElement = el; // self-ref for parentElement
        return el;
      },
    };
  } else {
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      const el = createMockElement();
      el.parentElement = el;
      return el;
    });
  }
});

describe('PauseMenu', () => {
  let eventBus: EventBus;
  let parent: any;

  beforeEach(() => {
    eventBus = new EventBus();
    parent = createMockElement();
    parent.parentElement = parent;
  });

  async function createMenu() {
    const mod = await import('../PauseMenu');
    return new mod.PauseMenu(parent, eventBus);
  }

  it('hidden initially', async () => {
    const menu = await createMenu();
    // The overlay div should have display: none initially (set via cssText)
    const overlay = parent.children[0];
    expect(overlay.style.cssText).toContain('display: none');
    menu.destroy();
  });

  it('shows on game:paused event', async () => {
    const menu = await createMenu();
    eventBus.emit('game:paused', undefined);
    const overlay = parent.children[0];
    expect(overlay.style.display).toBe('flex');
    menu.destroy();
  });

  it('resume button emits game:resumed', async () => {
    const menu = await createMenu();
    const spy = vi.fn();
    eventBus.on('game:resumed', spy);

    // The overlay > panel > resume button
    const overlay = parent.children[0];
    const panel = overlay.children[0];
    const resumeBtn = panel.children[1]; // [title, resumeBtn, menuBtn]

    const clickCall = resumeBtn.addEventListener.mock.calls.find(
      (c: any) => c[0] === 'click',
    );
    expect(clickCall).toBeDefined();
    clickCall[1](); // invoke click

    expect(spy).toHaveBeenCalled();
    menu.destroy();
  });
});
