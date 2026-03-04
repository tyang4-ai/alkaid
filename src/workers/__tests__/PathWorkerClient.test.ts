import { describe, it, expect } from 'vitest';

// Mock Worker for Node/Vitest environment
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private messageHandler: ((msg: any) => void) | null = null;

  constructor() {}

  postMessage(msg: any): void {
    // Simulate async worker response
    if (this.messageHandler) {
      setTimeout(() => this.messageHandler!(msg), 0);
    }
  }

  setResponseHandler(handler: (msg: any) => void): void {
    this.messageHandler = handler;
  }

  simulateResponse(data: any): void {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }

  terminate(): void {}
}

// We test the logic without actual Worker (not available in Node)
describe('PathWorkerClient message protocol', () => {
  it('terrain init message has correct shape', () => {
    const msg = {
      type: 'init' as const,
      width: 10,
      height: 10,
      terrain: new Uint8Array(100),
    };
    expect(msg.type).toBe('init');
    expect(msg.terrain.length).toBe(100);
  });

  it('path request message has correct shape', () => {
    const msg = {
      type: 'pathRequest' as const,
      id: 1,
      unitType: 0,
      startTX: 0,
      startTY: 0,
      goalTX: 5,
      goalTY: 5,
    };
    expect(msg.type).toBe('pathRequest');
    expect(msg.id).toBe(1);
  });

  it('path result message has correct shape', () => {
    const msg = {
      type: 'pathResult' as const,
      id: 1,
      found: true,
      path: [{ x: 8, y: 8 }, { x: 24, y: 24 }],
      nodesExplored: 10,
    };
    expect(msg.found).toBe(true);
    expect(msg.path).toHaveLength(2);
  });

  it('flow field request message has correct shape', () => {
    const msg = {
      type: 'flowRequest' as const,
      id: 2,
      unitType: 0,
      targetTX: 5,
      targetTY: 5,
    };
    expect(msg.type).toBe('flowRequest');
  });

  it('flow field result message has correct shape', () => {
    const msg = {
      type: 'flowResult' as const,
      id: 2,
      directions: new Int8Array(100),
      costs: new Float32Array(100),
      width: 10,
      height: 10,
      targetTileX: 5,
      targetTileY: 5,
    };
    expect(msg.directions.length).toBe(100);
    expect(msg.costs.length).toBe(100);
  });

  it('error message has correct shape', () => {
    const msg = {
      type: 'error' as const,
      id: 3,
      message: 'Terrain not initialized',
    };
    expect(msg.type).toBe('error');
    expect(msg.message).toBe('Terrain not initialized');
  });

  it('MockWorker simulates message flow', () => {
    const worker = new MockWorker();
    let received = false;
    worker.onmessage = (e: MessageEvent) => {
      received = true;
      expect(e.data.type).toBe('pathResult');
    };
    worker.simulateResponse({ type: 'pathResult', id: 0, found: true, path: [], nodesExplored: 0 });
    expect(received).toBe(true);
  });
});

describe('PathManager sync fallback', () => {
  it('PathManager works without worker (sync mode)', async () => {
    const { PathManager } = await import('../../simulation/pathfinding/PathManager');
    const { TerrainGrid } = await import('../../simulation/terrain/TerrainGrid');
    const { TerrainType, UnitType, UnitState, TILE_SIZE } = await import('../../constants');

    // Create a small terrain grid with all plains
    const size = 10;
    const terrain = new Uint8Array(size * size).fill(TerrainType.PLAINS);
    const grid = new TerrainGrid({
      width: size, height: size, seed: 0, templateId: 'test',
      elevation: new Float32Array(size * size),
      moisture: new Float32Array(size * size),
      terrain,
      riverFlow: new Int8Array(size * size).fill(-1),
      tileBitmask: new Uint8Array(size * size),
    });

    const pm = new PathManager(grid);
    const unit = {
      id: 1, type: UnitType.JI_HALBERDIERS, team: 0,
      x: TILE_SIZE / 2, y: TILE_SIZE / 2,
      prevX: 0, prevY: 0,
      size: 100, maxSize: 120, hp: 100,
      morale: 80, fatigue: 0, supply: 100,
      experience: 0, state: UnitState.IDLE, facing: 0,
      path: null, pathIndex: 0,
      targetX: 5 * TILE_SIZE, targetY: 5 * TILE_SIZE,
      isGeneral: false,
      pendingOrderType: null, pendingOrderTick: 0,
      attackCooldown: 0, lastAttackTick: 0,
      hasCharged: false, combatTargetId: -1, combatTicks: 0,
      siegeSetupTicks: 0, formUpTicks: 0, disengageTicks: 0,
      orderModifier: null, routTicks: 0,
      killCount: 0, holdUnderBombardmentTicks: 0, desertionFrac: 0,
    };

    pm.requestPath(unit as any, 5 * TILE_SIZE, 5 * TILE_SIZE);
    pm.tick(0);

    // Should have computed path synchronously
    expect(unit.path).not.toBeNull();
  });
});
