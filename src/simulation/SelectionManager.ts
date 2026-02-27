import { eventBus } from '../core/EventBus';
import { SELECTION_CLICK_RADIUS } from '../constants';
import type { Unit } from './units/Unit';

export class SelectionManager {
  private _selectedIds = new Set<number>();

  get selectedIds(): ReadonlySet<number> {
    return this._selectedIds;
  }

  get count(): number {
    return this._selectedIds.size;
  }

  isSelected(id: number): boolean {
    return this._selectedIds.has(id);
  }

  select(id: number): void {
    this._selectedIds.clear();
    this._selectedIds.add(id);
    this.emitChanged();
  }

  addToSelection(id: number): void {
    this._selectedIds.add(id);
    this.emitChanged();
  }

  toggleSelection(id: number): void {
    if (this._selectedIds.has(id)) {
      this._selectedIds.delete(id);
    } else {
      this._selectedIds.add(id);
    }
    this.emitChanged();
  }

  selectMultiple(ids: number[]): void {
    this._selectedIds.clear();
    for (const id of ids) this._selectedIds.add(id);
    this.emitChanged();
  }

  deselectAll(): void {
    if (this._selectedIds.size === 0) return;
    this._selectedIds.clear();
    this.emitChanged();
  }

  getUnitAtPoint(
    worldX: number, worldY: number, units: IterableIterator<Unit>, screenZoom: number,
  ): number {
    const maxDist = SELECTION_CLICK_RADIUS / screenZoom;
    let closestId = -1;
    let closestDist = Infinity;

    for (const unit of units) {
      if (unit.state === 5) continue; // DEAD
      const dx = unit.x - worldX;
      const dy = unit.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < maxDist && dist < closestDist) {
        closestDist = dist;
        closestId = unit.id;
      }
    }
    return closestId;
  }

  getUnitsInRect(
    x1: number, y1: number, x2: number, y2: number, units: IterableIterator<Unit>,
  ): number[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const result: number[] = [];

    for (const unit of units) {
      if (unit.state === 5) continue; // DEAD
      if (unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY) {
        result.push(unit.id);
      }
    }
    return result;
  }

  private emitChanged(): void {
    eventBus.emit('selection:changed', { ids: [...this._selectedIds] });
  }
}
