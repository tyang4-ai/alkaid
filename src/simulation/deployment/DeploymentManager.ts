import {
  DeploymentPhase, TILE_SIZE, DEPLOYMENT_RESERVE_DELAY_TICKS,
  DEPLOYMENT_COUNTDOWN_SECONDS, SIM_TICK_RATE,
  UNIT_TYPE_CONFIGS,
} from '../../constants';
import type { UnitType, FormationType } from '../../constants';
import type { UnitManager } from '../units/UnitManager';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { RosterEntry } from './RosterEntry';
import { DeploymentZone } from './DeploymentZone';
import { assignFormation } from './FormationTemplates';
import { eventBus } from '../../core/EventBus';

export interface RosterInput {
  type: UnitType;
  size: number;
  experience: number;
  isGeneral?: boolean;
}

export class DeploymentManager {
  private _phase: DeploymentPhase = DeploymentPhase.INACTIVE;
  private roster: RosterEntry[] = [];
  private zone: DeploymentZone | null = null;
  private countdownTicks = 0;
  private battleTicks = 0;
  private reservesSpawned = false;
  private terrainGrid: TerrainGrid | null = null;

  get phase(): DeploymentPhase {
    return this._phase;
  }

  startDeployment(
    squads: RosterInput[],
    terrainGrid: TerrainGrid,
    templateId: string,
  ): void {
    this.terrainGrid = terrainGrid;
    this.zone = new DeploymentZone(terrainGrid, templateId, 0);
    this.roster = squads.map((s, i) => {
      const config = UNIT_TYPE_CONFIGS[s.type];
      return {
        rosterId: i,
        type: s.type,
        size: s.size,
        maxSize: config.maxSize,
        experience: s.experience,
        morale: s.isGeneral ? 85 : 70,
        placed: false,
        unitId: null,
        isGeneral: s.isGeneral ?? false,
      };
    });
    this._phase = DeploymentPhase.DEPLOYING;
    this.countdownTicks = 0;
    this.battleTicks = 0;
    this.reservesSpawned = false;
    eventBus.emit('deployment:started', { rosterCount: this.roster.length });
  }

  placeUnit(
    rosterId: number,
    worldX: number,
    worldY: number,
    unitManager: UnitManager,
  ): number | null {
    if (this._phase !== DeploymentPhase.DEPLOYING) return null;
    const entry = this.roster.find(e => e.rosterId === rosterId);
    if (!entry || entry.placed) return null;
    if (!this.zone || !this.zone.isInZone(worldX, worldY)) return null;

    const unit = unitManager.spawn({
      type: entry.type,
      team: 0,
      x: worldX,
      y: worldY,
      size: entry.size,
      experience: entry.experience,
      morale: entry.morale,
    });

    entry.placed = true;
    entry.unitId = unit.id;
    eventBus.emit('deployment:unitPlaced', {
      rosterId, unitId: unit.id, x: worldX, y: worldY,
    });
    return unit.id;
  }

  moveUnit(
    rosterId: number,
    worldX: number,
    worldY: number,
    unitManager: UnitManager,
  ): boolean {
    if (this._phase !== DeploymentPhase.DEPLOYING) return false;
    const entry = this.roster.find(e => e.rosterId === rosterId);
    if (!entry || !entry.placed || entry.unitId === null) return false;
    if (!this.zone || !this.zone.isInZone(worldX, worldY)) return false;

    const unit = unitManager.get(entry.unitId);
    if (!unit) return false;

    unit.x = worldX;
    unit.y = worldY;
    unit.prevX = worldX;
    unit.prevY = worldY;
    return true;
  }

  removeUnit(rosterId: number, unitManager: UnitManager): boolean {
    if (this._phase !== DeploymentPhase.DEPLOYING) return false;
    const entry = this.roster.find(e => e.rosterId === rosterId);
    if (!entry || !entry.placed || entry.unitId === null) return false;

    unitManager.destroy(entry.unitId);
    entry.placed = false;
    entry.unitId = null;
    eventBus.emit('deployment:unitRemoved', { rosterId });
    return true;
  }

  applyFormation(formation: FormationType, unitManager: UnitManager): void {
    if (this._phase !== DeploymentPhase.DEPLOYING || !this.zone) return;

    // Remove all currently placed units
    for (const entry of this.roster) {
      if (entry.placed && entry.unitId !== null) {
        unitManager.destroy(entry.unitId);
        entry.placed = false;
        entry.unitId = null;
      }
    }

    const zoneCenter = this.zone.getCenter();
    const assignments = assignFormation(this.roster, formation, zoneCenter, this.zone);

    for (const a of assignments) {
      this.placeUnit(a.rosterId, a.worldX, a.worldY, unitManager);
    }

    eventBus.emit('deployment:formationApplied', { formation });
  }

  beginCountdown(): void {
    if (this._phase !== DeploymentPhase.DEPLOYING || !this.zone) return;

    // Auto-place general if not placed
    const general = this.roster.find(e => e.isGeneral && !e.placed);
    if (general) {
      const rearPos = this.zone.getCenterRear();
      // Don't call placeUnit since we need to temporarily store — will be placed on battle start
      // Actually, just mark as "will be auto-placed"
      this._generalAutoPlacePos = rearPos;
      this._generalRosterId = general.rosterId;
    }

    this._phase = DeploymentPhase.COUNTDOWN;
    this.countdownTicks = DEPLOYMENT_COUNTDOWN_SECONDS * SIM_TICK_RATE;
    eventBus.emit('deployment:countdownStarted', undefined);
    eventBus.emit('deployment:countdownTick', { remaining: DEPLOYMENT_COUNTDOWN_SECONDS });
  }

  private _generalAutoPlacePos: { x: number; y: number } | null = null;
  private _generalRosterId: number | null = null;

  tick(_dt: number, unitManager: UnitManager): void {
    if (this._phase === DeploymentPhase.COUNTDOWN) {
      this.countdownTicks--;
      const remaining = Math.ceil(this.countdownTicks / SIM_TICK_RATE);
      eventBus.emit('deployment:countdownTick', { remaining });

      if (this.countdownTicks <= 0) {
        // Auto-place general if needed
        if (this._generalAutoPlacePos && this._generalRosterId !== null) {
          this.placeUnitForce(
            this._generalRosterId,
            this._generalAutoPlacePos.x,
            this._generalAutoPlacePos.y,
            unitManager,
          );
          this._generalAutoPlacePos = null;
          this._generalRosterId = null;
        }

        this._phase = DeploymentPhase.BATTLE;
        this.battleTicks = 0;
        this.reservesSpawned = false;
        eventBus.emit('deployment:battleStarted', undefined);
      }
    } else if (this._phase === DeploymentPhase.BATTLE) {
      this.battleTicks++;

      if (!this.reservesSpawned && this.battleTicks >= DEPLOYMENT_RESERVE_DELAY_TICKS) {
        this.spawnReserves(unitManager);
        this.reservesSpawned = true;
      }
    }
  }

  /** Force-place a unit (used for auto-placement, bypasses phase check for countdown→battle transition). */
  private placeUnitForce(
    rosterId: number,
    worldX: number,
    worldY: number,
    unitManager: UnitManager,
  ): void {
    const entry = this.roster.find(e => e.rosterId === rosterId);
    if (!entry || entry.placed) return;

    const unit = unitManager.spawn({
      type: entry.type,
      team: 0,
      x: worldX,
      y: worldY,
      size: entry.size,
      experience: entry.experience,
      morale: entry.morale,
    });

    entry.placed = true;
    entry.unitId = unit.id;
  }

  private spawnReserves(unitManager: UnitManager): void {
    const unplaced = this.roster.filter(e => !e.placed);
    if (unplaced.length === 0 || !this.terrainGrid) return;

    const grid = this.terrainGrid;
    const blockedSet = new Set([0, 5, 6]); // WATER, MOUNTAINS, RIVER
    let ySpacing = Math.floor(grid.height / (unplaced.length + 1));
    if (ySpacing < 2) ySpacing = 2;

    for (let i = 0; i < unplaced.length; i++) {
      const entry = unplaced[i];
      const targetY = Math.floor((i + 1) * ySpacing);
      // Find walkable tile on left edge
      let spawnX = 1;
      let spawnY = targetY;

      // Spiral search from (1, targetY)
      let found = false;
      for (let radius = 0; radius < 20 && !found; radius++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          for (let dy = -radius; dy <= radius && !found; dy++) {
            if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
            const tx = 1 + dx;
            const ty = targetY + dy;
            if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) continue;
            if (!blockedSet.has(grid.getTerrain(tx, ty) as number)) {
              spawnX = tx;
              spawnY = ty;
              found = true;
            }
          }
        }
      }

      const worldX = spawnX * TILE_SIZE + TILE_SIZE / 2;
      const worldY = spawnY * TILE_SIZE + TILE_SIZE / 2;

      const unit = unitManager.spawn({
        type: entry.type,
        team: 0,
        x: worldX,
        y: worldY,
        size: entry.size,
        experience: entry.experience,
        morale: entry.morale,
      });

      entry.placed = true;
      entry.unitId = unit.id;
    }
  }

  getRoster(): readonly RosterEntry[] {
    return this.roster;
  }

  getZone(): DeploymentZone | null {
    return this.zone;
  }

  /** Find roster entry by placed unit ID (for right-click removal). */
  getRosterByUnitId(unitId: number): RosterEntry | undefined {
    return this.roster.find(e => e.unitId === unitId);
  }
}
