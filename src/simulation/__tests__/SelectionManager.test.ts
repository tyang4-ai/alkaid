import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../SelectionManager';
import type { Unit } from '../units/Unit';
import { UnitState } from '../../constants';
import type { UnitState as UnitStateType } from '../../constants';

function makeUnit(id: number, x: number, y: number, state: UnitStateType = UnitState.IDLE): Unit {
  return {
    id, type: 0, team: 0, x, y, prevX: x, prevY: y,
    size: 100, maxSize: 100, hp: 10000, morale: 70, fatigue: 0,
    supply: 100, experience: 0, state, facing: 0,
  };
}

describe('SelectionManager', () => {
  let sel: SelectionManager;
  beforeEach(() => { sel = new SelectionManager(); });

  it('starts with empty selection', () => {
    expect(sel.count).toBe(0);
    expect(sel.isSelected(1)).toBe(false);
  });

  it('select replaces previous selection', () => {
    sel.select(1);
    sel.select(2);
    expect(sel.count).toBe(1);
    expect(sel.isSelected(1)).toBe(false);
    expect(sel.isSelected(2)).toBe(true);
  });

  it('addToSelection appends', () => {
    sel.select(1);
    sel.addToSelection(2);
    expect(sel.count).toBe(2);
    expect(sel.isSelected(1)).toBe(true);
    expect(sel.isSelected(2)).toBe(true);
  });

  it('toggleSelection adds and removes', () => {
    sel.toggleSelection(1);
    expect(sel.isSelected(1)).toBe(true);
    sel.toggleSelection(1);
    expect(sel.isSelected(1)).toBe(false);
  });

  it('selectMultiple replaces all', () => {
    sel.select(1);
    sel.selectMultiple([2, 3, 4]);
    expect(sel.count).toBe(3);
    expect(sel.isSelected(1)).toBe(false);
  });

  it('deselectAll clears', () => {
    sel.selectMultiple([1, 2, 3]);
    sel.deselectAll();
    expect(sel.count).toBe(0);
  });

  it('deselectAll is no-op when empty', () => {
    // Should not throw or emit
    sel.deselectAll();
    expect(sel.count).toBe(0);
  });

  it('getUnitAtPoint finds closest unit within radius', () => {
    const units = [makeUnit(1, 100, 100), makeUnit(2, 200, 200)];
    const id = sel.getUnitAtPoint(105, 105, units.values(), 1.0);
    expect(id).toBe(1);
  });

  it('getUnitAtPoint returns -1 when nothing in range', () => {
    const units = [makeUnit(1, 100, 100)];
    const id = sel.getUnitAtPoint(500, 500, units.values(), 1.0);
    expect(id).toBe(-1);
  });

  it('getUnitAtPoint skips dead units', () => {
    const units = [makeUnit(1, 100, 100, UnitState.DEAD), makeUnit(2, 105, 105)];
    const id = sel.getUnitAtPoint(100, 100, units.values(), 1.0);
    expect(id).toBe(2);
  });

  it('getUnitAtPoint accounts for zoom', () => {
    const units = [makeUnit(1, 100, 100)];
    // At zoom 2.0, click radius in world space is halved (12/2 = 6px)
    const hitClose = sel.getUnitAtPoint(104, 100, units.values(), 2.0);
    expect(hitClose).toBe(1); // 4px away, within 6px
    const missFar = sel.getUnitAtPoint(108, 100, units.values(), 2.0);
    expect(missFar).toBe(-1); // 8px away, outside 6px
  });

  it('getUnitsInRect finds units in box', () => {
    const units = [makeUnit(1, 50, 50), makeUnit(2, 150, 150), makeUnit(3, 250, 250)];
    const ids = sel.getUnitsInRect(0, 0, 200, 200, units.values());
    expect(ids).toEqual([1, 2]);
  });

  it('getUnitsInRect handles inverted coords', () => {
    const units = [makeUnit(1, 50, 50)];
    const ids = sel.getUnitsInRect(200, 200, 0, 0, units.values());
    expect(ids).toEqual([1]);
  });

  it('getUnitsInRect skips dead units', () => {
    const units = [makeUnit(1, 50, 50, UnitState.DEAD), makeUnit(2, 60, 60)];
    const ids = sel.getUnitsInRect(0, 0, 200, 200, units.values());
    expect(ids).toEqual([2]);
  });
});
