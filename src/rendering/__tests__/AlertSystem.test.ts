import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../../core/EventBus';
import { ALERT_BANNER_DURATION_MS, ALERT_MAX_VISIBLE, UnitType, UnitState, UnitCategory } from '../../constants';

function createMockElement(): any {
  const children: any[] = [];
  const el: any = {
    className: '',
    style: { cssText: '', display: '', opacity: '' },
    textContent: '',
    innerHTML: '',
    parentElement: null as any,
    appendChild(child: any) {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    remove() {
      if (el.parentElement) {
        const idx = el.parentElement.children.indexOf(el);
        if (idx !== -1) el.parentElement.children.splice(idx, 1);
      }
    },
    addEventListener: vi.fn(),
    children,
  };
  return el;
}

beforeEach(() => {
  if (!globalThis.document) {
    (globalThis as any).document = {
      createElement: () => createMockElement(),
    };
  } else {
    vi.spyOn(document, 'createElement').mockImplementation(() => createMockElement());
  }
});

function createMockUnitManager(): any {
  const units = new Map<number, any>();
  return {
    get(id: number) { return units.get(id); },
    getByTeam(team: number) { return [...units.values()].filter((u: any) => u.team === team); },
    getAll: function* () { yield* units.values(); },
    _set(id: number, unit: any) { units.set(id, unit); },
  };
}

describe('AlertSystem', () => {
  let eventBus: EventBus;
  let parent: any;
  let unitManager: any;

  beforeEach(() => {
    eventBus = new EventBus();
    parent = createMockElement();
    unitManager = createMockUnitManager();
  });

  async function createAlertSystem() {
    const mod = await import('../AlertSystem');
    return new mod.AlertSystem(parent, eventBus, unitManager);
  }

  it('fire adds banner to DOM', async () => {
    const system = await createAlertSystem();
    system.fire('test', 'Test alert', 'info');
    const container = parent.children[0];
    expect(container.children.length).toBe(1);
    system.destroy();
  });

  it('banner auto-removes after duration', async () => {
    const system = await createAlertSystem();
    system.fire('test', 'Test alert', 'info');
    // Advance time past duration
    system.update(ALERT_BANNER_DURATION_MS + 100);
    const container = parent.children[0];
    expect(container.children.length).toBe(0);
    system.destroy();
  });

  it('max visible limit respected', async () => {
    const system = await createAlertSystem();
    for (let i = 0; i < ALERT_MAX_VISIBLE + 2; i++) {
      system.fire('test', `Alert ${i}`, 'info');
    }
    const container = parent.children[0];
    expect(container.children.length).toBe(ALERT_MAX_VISIBLE);
    system.destroy();
  });

  it('click emits camera event', async () => {
    const system = await createAlertSystem();
    const spy = vi.fn();
    eventBus.on('camera:moved', spy);

    system.fire('test', 'Test', 'info', 100, 200);
    const container = parent.children[0];
    const banner = container.children[0];

    const clickCall = banner.addEventListener.mock.calls.find(
      (c: any) => c[0] === 'click',
    );
    expect(clickCall).toBeDefined();
    clickCall[1](); // invoke click
    expect(spy).toHaveBeenCalledWith({ x: 100, y: 200, zoom: 1.0 });
    system.destroy();
  });

  it('alert log accumulates', async () => {
    const system = await createAlertSystem();
    system.fire('a', 'Alert 1', 'info');
    system.fire('b', 'Alert 2', 'warning');
    system.fire('c', 'Alert 3', 'danger');
    expect(system.getLog().length).toBe(3);
    expect(system.getLog()[0].message).toBe('Alert 1');
    system.destroy();
  });
});
