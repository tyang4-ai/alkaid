import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VictoryType, UnitState, UnitType } from '../../constants';
import type { BattleMetrics } from '../../simulation/BattleEventLogger';

function createMockElement(): any {
  const children: any[] = [];
  return {
    className: '',
    style: { cssText: '', display: '' },
    textContent: '',
    innerHTML: '',
    appendChild(child: any) { children.push(child); return child; },
    remove: vi.fn(),
    addEventListener: vi.fn(),
    querySelector(sel: string) {
      // Simple mock for button find
      if (sel === '#aar-continue') return createMockElement();
      return null;
    },
    children,
  };
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

function createMockMetrics(): BattleMetrics {
  return {
    startTick: 0,
    endTick: 200,
    events: [
      { tick: 50, message: 'Squad routed', category: 'combat' },
      { tick: 150, message: 'Enemy surrendered', category: 'surrender' },
    ],
    moraleHistory: new Map([
      [0, [100, 90, 80, 70, 60]],
      [1, [100, 80, 60, 40, 20]],
    ]),
    supplyHistory: new Map([
      [0, [1.0, 0.9, 0.8, 0.7, 0.6]],
      [1, [1.0, 0.8, 0.5, 0.3, 0.1]],
    ]),
    casualtyHistory: new Map([
      [0, [0, 10, 20, 30, 40]],
      [1, [0, 20, 50, 80, 120]],
    ]),
    sampleInterval: 10,
  };
}

function createMockUnitManager(): any {
  return {
    getByTeam(team: number) {
      if (team === 0) return [
        { id: 1, type: UnitType.JI_HALBERDIERS, team: 0, size: 80, maxSize: 100, morale: 60, state: UnitState.IDLE },
      ];
      return [
        { id: 2, type: UnitType.DAO_SWORDSMEN, team: 1, size: 30, maxSize: 100, morale: 20, state: UnitState.ROUTING },
      ];
    },
  };
}

describe('AfterActionReport', () => {
  let parent: any;

  beforeEach(() => {
    parent = createMockElement();
  });

  async function createReport() {
    const mod = await import('../AfterActionReport');
    return new mod.AfterActionReport(parent);
  }

  it('hidden initially', async () => {
    const report = await createReport();
    expect(report.visible).toBe(false);
    report.destroy();
  });

  it('shows with battle data', async () => {
    const report = await createReport();
    report.show(createMockMetrics(), createMockUnitManager(), VictoryType.SURRENDER, 0);
    expect(report.visible).toBe(true);

    const overlay = parent.children[0];
    expect(overlay.innerHTML).toContain('Victory');
    expect(overlay.innerHTML).toContain('Enemy Surrendered');
    report.destroy();
  });

  it('timeline SVG rendered', async () => {
    const report = await createReport();
    report.show(createMockMetrics(), createMockUnitManager(), VictoryType.SURRENDER, 0);

    const overlay = parent.children[0];
    expect(overlay.innerHTML).toContain('<svg');
    expect(overlay.innerHTML).toContain('polyline');
    report.destroy();
  });

  it('continue button exists', async () => {
    const report = await createReport();
    report.show(createMockMetrics(), createMockUnitManager(), VictoryType.SURRENDER, 0);

    const overlay = parent.children[0];
    expect(overlay.innerHTML).toContain('Continue');
    report.destroy();
  });
});
