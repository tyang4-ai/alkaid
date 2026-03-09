import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { UNIT_TYPE_CONFIGS, UnitType } from '../../constants';

function createMockElement(): any {
  const children: any[] = [];
  const classes = new Set<string>();
  return {
    className: '',
    style: { cssText: '', display: '' },
    textContent: '',
    innerHTML: '',
    dataset: {} as Record<string, string>,
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
  if (!globalThis.document) {
    (globalThis as any).document = {
      createElement: () => createMockElement(),
    };
  } else {
    vi.spyOn(document, 'createElement').mockImplementation(() => createMockElement());
  }
});

describe('Codex', () => {
  let eventBus: EventBus;
  let parent: any;

  beforeEach(() => {
    eventBus = new EventBus();
    parent = createMockElement();
  });

  async function createCodex() {
    const mod = await import('../Codex');
    return new mod.Codex(parent, eventBus);
  }

  it('hidden initially', async () => {
    const codex = await createCodex();
    expect(codex.visible).toBe(false);
    const overlay = parent.children[0];
    expect(overlay.style.cssText).toContain('display: none');
    codex.destroy();
  });

  it('toggle shows/hides', async () => {
    const codex = await createCodex();
    codex.toggle();
    expect(codex.visible).toBe(true);
    codex.toggle();
    expect(codex.visible).toBe(false);
    codex.destroy();
  });

  it('all 5 tabs render content', async () => {
    const codex = await createCodex();
    codex.show();

    const overlay = parent.children[0];
    const panel = overlay.children[0];
    const tabBar = panel.children[1]; // [header, tabBar, contentArea]

    // Tab bar should have 5 buttons
    expect(tabBar.children.length).toBe(5);

    codex.destroy();
  });

  it('unit data contains UNIT_TYPE_CONFIGS entries', async () => {
    const codex = await createCodex();
    codex.show();

    // Content area should contain unit names from config
    const overlay = parent.children[0];
    const panel = overlay.children[0];
    const contentArea = panel.children[2];

    const jiConfig = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS];
    expect(contentArea.innerHTML).toContain(jiConfig.chineseName);
    expect(contentArea.innerHTML).toContain(jiConfig.displayName);

    codex.destroy();
  });

  it('close button exists', async () => {
    const codex = await createCodex();
    const overlay = parent.children[0];
    const panel = overlay.children[0];
    const header = panel.children[0];

    // Find close button (second child of header)
    const closeBtn = header.children[1];
    expect(closeBtn.textContent).toBe('✕');

    codex.destroy();
  });
});
