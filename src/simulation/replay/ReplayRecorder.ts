import type { Unit } from '../units/Unit';
import type { EnvironmentStateSnapshot, ReplaySnapshot, UnitSnapshot } from '../persistence/SaveTypes';
import type { ReplayFrame } from './ReplayTypes';
import type { OrderType } from '../../constants';
import { REPLAY_VERSION, REPLAY_MAX_FRAMES } from '../../constants';

export class ReplayRecorder {
  private recording = false;
  private terrainSeed = 0;
  private templateId = '';
  private initialUnits: UnitSnapshot[] = [];
  private frames: ReplayFrame[] = [];
  private currentFrame: ReplayFrame | null = null;
  private environmentInit: EnvironmentStateSnapshot | null = null;
  private aiPersonality = 0;
  private aiSeed = 0;

  startRecording(
    terrainSeed: number,
    templateId: string,
    initialUnits: Unit[],
    envState: EnvironmentStateSnapshot,
    aiPersonality: number,
    aiSeed: number,
  ): void {
    this.recording = true;
    this.terrainSeed = terrainSeed;
    this.templateId = templateId;
    this.initialUnits = initialUnits.map(u => this.snapshotUnit(u));
    this.frames = [];
    this.currentFrame = null;
    this.environmentInit = envState;
    this.aiPersonality = aiPersonality;
    this.aiSeed = aiSeed;
  }

  recordOrder(
    tick: number,
    unitId: number,
    orderType: OrderType,
    targetX: number,
    targetY: number,
    targetUnitId: number | undefined,
    team: number,
  ): void {
    if (!this.recording) return;
    if (this.frames.length >= REPLAY_MAX_FRAMES) return;

    // Get or create frame for this tick
    if (!this.currentFrame || this.currentFrame.tick !== tick) {
      this.currentFrame = { tick, orders: [] };
      this.frames.push(this.currentFrame);
    }

    this.currentFrame.orders.push({
      unitId, orderType, targetX, targetY, targetUnitId, team,
    });
  }

  stopRecording(totalTicks: number): ReplaySnapshot {
    this.recording = false;
    return {
      version: REPLAY_VERSION,
      terrainSeed: this.terrainSeed,
      templateId: this.templateId,
      initialUnits: this.initialUnits,
      frames: this.frames.map(f => ({
        tick: f.tick,
        orders: f.orders.map(o => ({
          unitId: o.unitId,
          orderType: o.orderType,
          targetX: o.targetX,
          targetY: o.targetY,
          targetUnitId: o.targetUnitId,
          team: o.team,
        })),
      })),
      totalTicks,
      environmentInit: this.environmentInit!,
      aiPersonality: this.aiPersonality,
      aiSeed: this.aiSeed,
    };
  }

  get isRecording(): boolean {
    return this.recording;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  private snapshotUnit(u: Unit): UnitSnapshot {
    return {
      id: u.id, type: u.type, team: u.team,
      x: u.x, y: u.y, prevX: u.prevX, prevY: u.prevY,
      size: u.size, maxSize: u.maxSize, hp: u.hp,
      morale: u.morale, fatigue: u.fatigue, supply: u.supply,
      experience: u.experience, state: u.state, facing: u.facing,
      path: u.path, pathIndex: u.pathIndex,
      targetX: u.targetX, targetY: u.targetY,
      isGeneral: u.isGeneral,
      pendingOrderType: u.pendingOrderType,
      pendingOrderTick: u.pendingOrderTick,
      attackCooldown: u.attackCooldown,
      lastAttackTick: u.lastAttackTick,
      hasCharged: u.hasCharged,
      combatTargetId: u.combatTargetId,
      combatTicks: u.combatTicks,
      siegeSetupTicks: u.siegeSetupTicks,
      formUpTicks: u.formUpTicks,
      disengageTicks: u.disengageTicks,
      orderModifier: u.orderModifier,
      routTicks: u.routTicks,
      killCount: u.killCount ?? 0,
      holdUnderBombardmentTicks: u.holdUnderBombardmentTicks ?? 0,
      desertionFrac: u.desertionFrac ?? 0,
    };
  }
}
