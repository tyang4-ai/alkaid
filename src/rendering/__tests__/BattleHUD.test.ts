import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitState, UnitType, DeploymentPhase } from '../../constants';

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

function createMockUnitManager(teamUnits: Array<{ team: number; size: number; maxSize: number; morale: number; fatigue: number; state: number }>): any {
  return {
    getByTeam(team: number) { return teamUnits.filter(u => u.team === team); },
  };
}

function createMockSupply(foodPcts: Map<number, number>): any {
  return {
    getFoodPercent(team: number) { return foodPcts.get(team) ?? 1.0; },
  };
}

function createMockSurrender(pressures: Map<number, number>): any {
  return {
    getPressure(team: number) { return pressures.get(team) ?? 0; },
  };
}

function createMockGameState(overrides?: any): any {
  return {
    getState() {
      return {
        tickNumber: 100,
        speedMultiplier: 1.0,
        paused: false,
        ...overrides,
      };
    },
  };
}

describe('BattleHUD', () => {
  let parent: any;

  beforeEach(() => {
    parent = createMockElement();
  });

  async function createHUD() {
    const mod = await import('../BattleHUD');
    return new mod.BattleHUD(parent);
  }

  it('hidden initially', async () => {
    const hud = await createHUD();
    const container = parent.children[0];
    expect(container.style.cssText).toContain('display: none');
    hud.destroy();
  });

  it('shows soldier counts after update', async () => {
    const hud = await createHUD();
    hud.show();

    const um = createMockUnitManager([
      { team: 0, size: 80, maxSize: 100, morale: 70, fatigue: 20, state: UnitState.IDLE },
      { team: 1, size: 60, maxSize: 100, morale: 50, fatigue: 40, state: UnitState.IDLE },
    ]);
    const supply = createMockSupply(new Map([[0, 0.8], [1, 0.6]]));
    const surrender = createMockSurrender(new Map([[0, 10], [1, 30]]));
    const gs = createMockGameState();

    hud.update(um, supply, surrender, gs);

    const container = parent.children[0];
    const content = container.children[1]; // [title, content]
    expect(content.innerHTML).toContain('80/100');
    expect(content.innerHTML).toContain('60/100');
    hud.destroy();
  });

  it('shows morale bars', async () => {
    const hud = await createHUD();
    hud.show();

    const um = createMockUnitManager([
      { team: 0, size: 50, maxSize: 100, morale: 75, fatigue: 10, state: UnitState.IDLE },
    ]);
    const supply = createMockSupply(new Map([[0, 1.0], [1, 1.0]]));
    const surrender = createMockSurrender(new Map());
    const gs = createMockGameState();

    hud.update(um, supply, surrender, gs);

    const content = parent.children[0].children[1];
    expect(content.innerHTML).toContain('Morale');
    hud.destroy();
  });

  it('updates on state change', async () => {
    const hud = await createHUD();
    hud.show();

    const um1 = createMockUnitManager([
      { team: 0, size: 100, maxSize: 100, morale: 80, fatigue: 0, state: UnitState.IDLE },
    ]);
    const supply = createMockSupply(new Map([[0, 1.0], [1, 1.0]]));
    const surrender = createMockSurrender(new Map());
    const gs = createMockGameState();

    hud.update(um1, supply, surrender, gs);
    const content1 = parent.children[0].children[1].innerHTML;

    const um2 = createMockUnitManager([
      { team: 0, size: 50, maxSize: 100, morale: 40, fatigue: 60, state: UnitState.IDLE },
    ]);
    const gs2 = createMockGameState({ tickNumber: 200 });
    hud.update(um2, supply, surrender, gs2);
    const content2 = parent.children[0].children[1].innerHTML;

    expect(content2).not.toBe(content1);
    hud.destroy();
  });
});
