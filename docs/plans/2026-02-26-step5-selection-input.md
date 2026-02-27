# Step 5: Selection + Input — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unit selection (click + Ctrl+drag box-select), right-click radial order menu with 7 order types, selection highlighting (pulsing ring), and order visualization (dotted lines + flags).

**Architecture:** Strict simulation/rendering split. `SelectionManager` and `OrderManager` are pure-data simulation systems (no PixiJS). `SelectionRenderer`, `OrderRenderer`, and `RadialMenu` handle display. `InputManager` emits generic input events; listeners in `main.ts` wire them to managers.

**Tech Stack:** TypeScript, PixiJS v8 (Graphics for selection rings/lines, Container for radial menu)

---

## Task 1: Selection Constants + EventBus Events

**Files:**
- Modify: `src/constants.ts` (append after UNIT_TYPE_SHAPE)
- Modify: `src/core/EventBus.ts` (add to GameEvents interface)

**Step 1: Add constants to `src/constants.ts`**

Append after the `UNIT_TYPE_SHAPE` block:

```typescript
// --- Selection (Step 5) ---
export const SELECTION_CLICK_RADIUS = 12; // px screen-space click tolerance
export const SELECTION_RING_RADIUS_PAD = 4; // px added to dot radius for ring
export const SELECTION_RING_COLOR = 0xFFD700; // Gold
export const SELECTION_RING_WIDTH = 1.5;
export const SELECTION_RING_PULSE_SPEED = 3.0; // radians/sec (~2s period)
export const SELECTION_RING_ALPHA_MIN = 0.4;
export const SELECTION_RING_ALPHA_MAX = 1.0;
export const SELECTION_BOX_FILL_COLOR = 0xFFFFFF;
export const SELECTION_BOX_FILL_ALPHA = 0.1;
export const SELECTION_BOX_STROKE_COLOR = 0xFFD700;
export const SELECTION_BOX_STROKE_ALPHA = 0.6;

// --- Orders (Step 5) ---
export const OrderType = {
  MOVE: 0,
  ATTACK: 1,
  HOLD: 2,
  RETREAT: 3,
  FLANK: 4,
  CHARGE: 5,
  FORM_UP: 6,
  DISENGAGE: 7,
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const ORDER_DISPLAY: Record<OrderType, { label: string; chinese: string; color: number }> = {
  [OrderType.MOVE]:       { label: 'Move',       chinese: '移动', color: 0xFFFFFF },
  [OrderType.ATTACK]:     { label: 'Attack',     chinese: '攻击', color: 0xCC3333 },
  [OrderType.HOLD]:       { label: 'Hold',       chinese: '驻守', color: 0x33AA33 },
  [OrderType.RETREAT]:    { label: 'Retreat',     chinese: '撤退', color: 0xAAAA33 },
  [OrderType.FLANK]:      { label: 'Flank',      chinese: '侧击', color: 0xCC8833 },
  [OrderType.CHARGE]:     { label: 'Charge',     chinese: '冲锋', color: 0xDD4444 },
  [OrderType.FORM_UP]:    { label: 'Form Up',    chinese: '列阵', color: 0x4488CC },
  [OrderType.DISENGAGE]:  { label: 'Disengage',  chinese: '脱离', color: 0x888888 },
};

export const ORDER_LINE_DASH = 4;      // px dash length
export const ORDER_LINE_GAP = 4;       // px gap between dashes
export const ORDER_LINE_WIDTH = 1.5;
export const ORDER_LINE_ALPHA = 0.6;
export const ORDER_FLAG_SIZE = 6;      // px half-size of flag marker

export const RADIAL_MENU_RADIUS = 80;       // px from center to wedge center
export const RADIAL_MENU_INNER_RADIUS = 25; // px dead zone in center
export const RADIAL_MENU_WEDGE_COLOR = 0x1A1A2E;
export const RADIAL_MENU_HOVER_COLOR = 0x2A2A4E;
export const RADIAL_MENU_BORDER_COLOR = 0x555555;
export const RADIAL_MENU_FONT_SIZE = 11;
```

**Step 2: Add events to `src/core/EventBus.ts`**

Add these to the `GameEvents` interface after the `units:cleared` line:

```typescript
'selection:changed': { ids: number[] };
'input:click': { worldX: number; worldY: number; screenX: number; screenY: number; shift: boolean };
'input:boxSelect': { x1: number; y1: number; x2: number; y2: number };
'input:rightClick': { worldX: number; worldY: number; screenX: number; screenY: number };
'order:issued': { unitId: number; type: number };
'order:cleared': { unitId: number };
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: PASS (no code references the new constants/events yet)

---

## Task 2: SelectionManager

**Files:**
- Create: `src/simulation/SelectionManager.ts`
- Create: `src/simulation/__tests__/SelectionManager.test.ts`

**Step 1: Create `src/simulation/SelectionManager.ts`**

```typescript
import { eventBus } from '../core/EventBus';
import { SELECTION_CLICK_RADIUS, UNIT_BASE_DOT_RADIUS } from '../constants';
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

  /**
   * Find the closest unit to a world-space point within click tolerance.
   * Returns the unit ID or -1 if nothing hit.
   * `screenZoom` is needed to convert SELECTION_CLICK_RADIUS from screen to world space.
   */
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

  /**
   * Find all living units within an axis-aligned world-space rectangle.
   * Coordinates are world pixels, min/max ordering not required.
   */
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
```

**Step 2: Create tests `src/simulation/__tests__/SelectionManager.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionManager } from '../SelectionManager';
import type { Unit } from '../units/Unit';
import { UnitState } from '../../constants';

function makeUnit(id: number, x: number, y: number, state = UnitState.IDLE): Unit {
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
```

**Step 3: Run tests**

```bash
pnpm test
```

Expected: All tests pass including ~12 new SelectionManager tests.

---

## Task 3: OrderManager

**Files:**
- Create: `src/simulation/OrderManager.ts`
- Create: `src/simulation/__tests__/OrderManager.test.ts`

**Step 1: Create `src/simulation/OrderManager.ts`**

```typescript
import { eventBus } from '../core/EventBus';
import type { OrderType } from '../constants';

export interface Order {
  type: OrderType;
  unitId: number;
  targetX?: number;
  targetY?: number;
  targetUnitId?: number;
}

export class OrderManager {
  private orders = new Map<number, Order>();

  setOrder(unitId: number, order: Order): void {
    this.orders.set(unitId, order);
    eventBus.emit('order:issued', { unitId, type: order.type });
  }

  getOrder(unitId: number): Order | undefined {
    return this.orders.get(unitId);
  }

  clearOrder(unitId: number): boolean {
    const had = this.orders.delete(unitId);
    if (had) eventBus.emit('order:cleared', { unitId });
    return had;
  }

  getAll(): IterableIterator<Order> {
    return this.orders.values();
  }

  clear(): void {
    this.orders.clear();
  }
}
```

**Step 2: Create tests `src/simulation/__tests__/OrderManager.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { OrderManager } from '../OrderManager';
import { OrderType } from '../../constants';

describe('OrderManager', () => {
  let mgr: OrderManager;
  beforeEach(() => { mgr = new OrderManager(); });

  it('stores and retrieves an order', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 200 });
    const order = mgr.getOrder(1);
    expect(order).toBeDefined();
    expect(order!.type).toBe(OrderType.MOVE);
    expect(order!.targetX).toBe(100);
  });

  it('replaces existing order', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1, targetX: 100, targetY: 200 });
    mgr.setOrder(1, { type: OrderType.HOLD, unitId: 1 });
    expect(mgr.getOrder(1)!.type).toBe(OrderType.HOLD);
  });

  it('returns undefined for missing unit', () => {
    expect(mgr.getOrder(999)).toBeUndefined();
  });

  it('clearOrder removes and returns true', () => {
    mgr.setOrder(1, { type: OrderType.ATTACK, unitId: 1, targetUnitId: 5 });
    expect(mgr.clearOrder(1)).toBe(true);
    expect(mgr.getOrder(1)).toBeUndefined();
  });

  it('clearOrder returns false for missing', () => {
    expect(mgr.clearOrder(999)).toBe(false);
  });

  it('clear removes all orders', () => {
    mgr.setOrder(1, { type: OrderType.MOVE, unitId: 1 });
    mgr.setOrder(2, { type: OrderType.HOLD, unitId: 2 });
    mgr.clear();
    expect(mgr.getOrder(1)).toBeUndefined();
    expect(mgr.getOrder(2)).toBeUndefined();
  });
});
```

**Step 3: Run tests**

```bash
pnpm test
```

Expected: All pass.

---

## Task 4: InputManager — Selection + Right-click Events

**Files:**
- Modify: `src/core/InputManager.ts`

Refactor InputManager to emit input events and support Ctrl+drag box-select, Shift+click, right-click, and ESC.

**Key changes:**
1. Add `ctrlDragging` state (separate from `leftDragging` which stays as camera pan)
2. On left mousedown: if Ctrl held, enter box-select mode instead of pan mode
3. On left mouseup without drag: emit `input:click` with world coords + shift state
4. On Ctrl+drag release: emit `input:boxSelect` with world-space rect
5. On right mouseup: emit `input:rightClick` with world coords
6. On ESC keydown: emit `selection:changed { ids: [] }` (deselect signal)
7. Accept `camera` reference for `screenToWorld` conversion

**Full replacement of InputManager:**

The InputManager needs the camera for screen-to-world conversion. It already has `this.camera`. Add box-select state tracking, modify `onMouseDown`, `onMouseMove`, `onMouseUp`, add ESC handling.

New private fields:
```typescript
private ctrlBoxSelecting = false;
private boxStartScreenX = 0;
private boxStartScreenY = 0;
// Expose box rect for renderer to draw
private _boxRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
```

New public getter:
```typescript
get boxSelectRect() { return this._boxRect; }
```

Modify `onMouseDown` (button 0): if `e.ctrlKey`, set `ctrlBoxSelecting = true` and store start point instead of starting left-drag pan.

Modify `onMouseMove`: if `ctrlBoxSelecting && leftButtonDown`, update `_boxRect` with screen coords (for renderer) instead of panning.

Modify `onMouseUp` (button 0):
- If `ctrlBoxSelecting`: convert box corners to world coords, emit `input:boxSelect`, clear state.
- Else if `!leftDragging`: this was a click — convert to world coords, emit `input:click` with `shift: e.shiftKey`.
- Reset all states.

Add right-click handling in `onMouseUp` (button 2): convert to world, emit `input:rightClick`.

Add ESC to `onKeyDown`: emit deselect signal.

---

## Task 5: SelectionRenderer

**Files:**
- Create: `src/rendering/SelectionRenderer.ts`

**Step 1: Create `src/rendering/SelectionRenderer.ts`**

Draws:
1. Pulsing gold ring around each selected unit
2. Box-select rectangle when Ctrl+dragging

Uses PixiJS `Graphics` redrawn every frame (selection state changes frequently, no point caching textures).

```typescript
import { Container, Graphics } from 'pixi.js';
import type { Unit } from '../simulation/units/Unit';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { Camera } from '../core/Camera';
import {
  SELECTION_RING_COLOR, SELECTION_RING_WIDTH,
  SELECTION_RING_PULSE_SPEED, SELECTION_RING_ALPHA_MIN, SELECTION_RING_ALPHA_MAX,
  SELECTION_RING_RADIUS_PAD, UNIT_BASE_DOT_RADIUS, UNIT_MIN_DOT_RADIUS,
  SELECTION_BOX_FILL_COLOR, SELECTION_BOX_FILL_ALPHA,
  SELECTION_BOX_STROKE_COLOR, SELECTION_BOX_STROKE_ALPHA,
} from '../constants';

export class SelectionRenderer {
  private worldGraphics: Graphics;  // rings in world space (inside worldContainer)
  private screenGraphics: Graphics; // box-select rect in screen space (inside uiLayer)
  private elapsed = 0;

  constructor(worldLayer: Container, uiLayer: Container) {
    this.worldGraphics = new Graphics();
    worldLayer.addChild(this.worldGraphics);
    this.screenGraphics = new Graphics();
    uiLayer.addChild(this.screenGraphics);
  }

  update(
    selectionManager: SelectionManager,
    getUnit: (id: number) => Unit | undefined,
    alpha: number,
    dtMs: number,
    boxRect: { x1: number; y1: number; x2: number; y2: number } | null,
  ): void {
    this.elapsed += dtMs / 1000;
    this.worldGraphics.clear();
    this.screenGraphics.clear();

    // --- Selection rings (world space) ---
    const pulse = Math.sin(this.elapsed * SELECTION_RING_PULSE_SPEED);
    const ringAlpha = SELECTION_RING_ALPHA_MIN +
      (SELECTION_RING_ALPHA_MAX - SELECTION_RING_ALPHA_MIN) * (pulse * 0.5 + 0.5);

    for (const id of selectionManager.selectedIds) {
      const unit = getUnit(id);
      if (!unit || unit.state === 5) continue;

      const renderX = unit.prevX + (unit.x - unit.prevX) * alpha;
      const renderY = unit.prevY + (unit.y - unit.prevY) * alpha;
      const strengthRatio = unit.size / unit.maxSize;
      const dotRadius = Math.max(UNIT_MIN_DOT_RADIUS, UNIT_BASE_DOT_RADIUS * Math.sqrt(strengthRatio));
      const ringRadius = dotRadius + SELECTION_RING_RADIUS_PAD;

      this.worldGraphics.circle(renderX, renderY, ringRadius);
      this.worldGraphics.stroke({
        width: SELECTION_RING_WIDTH,
        color: SELECTION_RING_COLOR,
        alpha: ringAlpha,
      });
    }

    // --- Box-select rectangle (screen space) ---
    if (boxRect) {
      const x = Math.min(boxRect.x1, boxRect.x2);
      const y = Math.min(boxRect.y1, boxRect.y2);
      const w = Math.abs(boxRect.x2 - boxRect.x1);
      const h = Math.abs(boxRect.y2 - boxRect.y1);

      this.screenGraphics.rect(x, y, w, h);
      this.screenGraphics.fill({ color: SELECTION_BOX_FILL_COLOR, alpha: SELECTION_BOX_FILL_ALPHA });
      this.screenGraphics.stroke({
        width: 1,
        color: SELECTION_BOX_STROKE_COLOR,
        alpha: SELECTION_BOX_STROKE_ALPHA,
      });
    }
  }

  destroy(): void {
    this.worldGraphics.destroy();
    this.screenGraphics.destroy();
  }
}
```

---

## Task 6: OrderRenderer

**Files:**
- Create: `src/rendering/OrderRenderer.ts`

Draws dotted lines from selected units to their order targets, plus a flag marker at the destination.

```typescript
import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { OrderManager, Order } from '../simulation/OrderManager';
import type { SelectionManager } from '../simulation/SelectionManager';
import type { Unit } from '../simulation/units/Unit';
import {
  ORDER_DISPLAY, ORDER_LINE_WIDTH, ORDER_LINE_ALPHA,
  ORDER_LINE_DASH, ORDER_LINE_GAP, ORDER_FLAG_SIZE,
} from '../constants';

export class OrderRenderer {
  private graphics: Graphics;

  constructor(worldLayer: Container) {
    this.graphics = new Graphics();
    worldLayer.addChild(this.graphics);
  }

  update(
    orderManager: OrderManager,
    selectionManager: SelectionManager,
    getUnit: (id: number) => Unit | undefined,
    alpha: number,
  ): void {
    this.graphics.clear();

    // Only draw order indicators for selected units
    for (const id of selectionManager.selectedIds) {
      const order = orderManager.getOrder(id);
      if (!order || order.targetX === undefined || order.targetY === undefined) continue;

      const unit = getUnit(id);
      if (!unit || unit.state === 5) continue;

      const ux = unit.prevX + (unit.x - unit.prevX) * alpha;
      const uy = unit.prevY + (unit.y - unit.prevY) * alpha;
      const tx = order.targetX;
      const ty = order.targetY;
      const color = ORDER_DISPLAY[order.type].color;

      // Dotted line
      this.drawDashedLine(ux, uy, tx, ty, color);

      // Flag at destination
      this.drawFlag(tx, ty, color);
    }
  }

  private drawDashedLine(
    x1: number, y1: number, x2: number, y2: number, color: number,
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const segLen = ORDER_LINE_DASH + ORDER_LINE_GAP;
    let pos = 0;

    while (pos < dist) {
      const dashEnd = Math.min(pos + ORDER_LINE_DASH, dist);
      this.graphics
        .moveTo(x1 + nx * pos, y1 + ny * pos)
        .lineTo(x1 + nx * dashEnd, y1 + ny * dashEnd)
        .stroke({ width: ORDER_LINE_WIDTH, color, alpha: ORDER_LINE_ALPHA });
      pos += segLen;
    }
  }

  private drawFlag(x: number, y: number, color: number): void {
    const s = ORDER_FLAG_SIZE;
    // Small pennant shape: pole + triangle flag
    this.graphics
      .moveTo(x, y)
      .lineTo(x, y - s * 2)
      .stroke({ width: 1.5, color, alpha: 0.8 });
    this.graphics
      .poly([x, y - s * 2, x + s, y - s * 1.5, x, y - s])
      .fill({ color, alpha: 0.7 });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
```

---

## Task 7: RadialMenu

**Files:**
- Create: `src/rendering/RadialMenu.ts`

A PixiJS Container that renders 7 order wedges in a circle. Shows on right-click, hides on selection or ESC.

The radial menu renders in **screen space** (uiLayer) so it's not affected by camera zoom. It needs:
- `show(screenX, screenY)` — position and make visible
- `hide()` — make invisible
- `getWedgeAtPoint(screenX, screenY): OrderType | -1` — hit test
- Each wedge: filled arc sector + Chinese label text

Implementation: draw 7 equal wedges (360/7 ≈ 51.4° each) using `Graphics.arc()`. On hover, highlight the wedge under cursor. On click, return the order type.

The menu is event-driven: InputManager detects right-click → shows menu. Next click/ESC → reads which wedge was hit → issues order or closes.

```typescript
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  OrderType, ORDER_DISPLAY,
  RADIAL_MENU_RADIUS, RADIAL_MENU_INNER_RADIUS,
  RADIAL_MENU_WEDGE_COLOR, RADIAL_MENU_HOVER_COLOR,
  RADIAL_MENU_BORDER_COLOR, RADIAL_MENU_FONT_SIZE,
} from '../constants';

const ORDER_TYPES: OrderType[] = [
  OrderType.MOVE, OrderType.ATTACK, OrderType.HOLD, OrderType.RETREAT,
  OrderType.FLANK, OrderType.CHARGE, OrderType.FORM_UP, OrderType.DISENGAGE,
];
const WEDGE_COUNT = ORDER_TYPES.length; // 8
const WEDGE_ANGLE = (Math.PI * 2) / WEDGE_COUNT;

export class RadialMenu {
  readonly container: Container;
  private wedgeGraphics: Graphics;
  private labels: Text[] = [];
  private hoveredIndex = -1;
  private _visible = false;
  private _worldX = 0; // world-space coords of the right-click target
  private _worldY = 0;

  get visible(): boolean { return this._visible; }
  get worldX(): number { return this._worldX; }
  get worldY(): number { return this._worldY; }

  constructor(uiLayer: Container) {
    this.container = new Container();
    this.container.visible = false;
    uiLayer.addChild(this.container);

    this.wedgeGraphics = new Graphics();
    this.container.addChild(this.wedgeGraphics);

    // Create labels
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: RADIAL_MENU_FONT_SIZE,
      fill: 0xDDDDDD,
      stroke: { color: 0x000000, width: 2 },
    });

    for (let i = 0; i < WEDGE_COUNT; i++) {
      const angle = WEDGE_ANGLE * i - Math.PI / 2; // start from top
      const midAngle = angle + WEDGE_ANGLE / 2;
      const labelR = (RADIAL_MENU_RADIUS + RADIAL_MENU_INNER_RADIUS) / 2 + 8;
      const lx = Math.cos(midAngle) * labelR;
      const ly = Math.sin(midAngle) * labelR;

      const info = ORDER_DISPLAY[ORDER_TYPES[i]];
      const text = new Text({ text: info.chinese, style });
      text.anchor.set(0.5);
      text.position.set(lx, ly);
      this.container.addChild(text);
      this.labels.push(text);
    }
  }

  show(screenX: number, screenY: number, worldX: number, worldY: number): void {
    this.container.position.set(screenX, screenY);
    this.container.visible = true;
    this._visible = true;
    this._worldX = worldX;
    this._worldY = worldY;
    this.hoveredIndex = -1;
    this.redraw();
  }

  hide(): void {
    this.container.visible = false;
    this._visible = false;
    this.hoveredIndex = -1;
  }

  /**
   * Update hover state based on cursor position (screen coords).
   */
  updateHover(screenX: number, screenY: number): void {
    if (!this._visible) return;
    const idx = this.getWedgeIndex(screenX, screenY);
    if (idx !== this.hoveredIndex) {
      this.hoveredIndex = idx;
      this.redraw();
    }
  }

  /**
   * Get the OrderType at a screen position, or -1 if none.
   */
  getOrderAtPoint(screenX: number, screenY: number): OrderType | -1 {
    const idx = this.getWedgeIndex(screenX, screenY);
    if (idx === -1) return -1;
    return ORDER_TYPES[idx];
  }

  private getWedgeIndex(screenX: number, screenY: number): number {
    const cx = this.container.x;
    const cy = this.container.y;
    const dx = screenX - cx;
    const dy = screenY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < RADIAL_MENU_INNER_RADIUS || dist > RADIAL_MENU_RADIUS + 20) return -1;

    let angle = Math.atan2(dy, dx) + Math.PI / 2; // offset to match top-start
    if (angle < 0) angle += Math.PI * 2;
    return Math.floor(angle / WEDGE_ANGLE) % WEDGE_COUNT;
  }

  private redraw(): void {
    this.wedgeGraphics.clear();

    for (let i = 0; i < WEDGE_COUNT; i++) {
      const startAngle = WEDGE_ANGLE * i - Math.PI / 2;
      const endAngle = startAngle + WEDGE_ANGLE;
      const isHovered = i === this.hoveredIndex;
      const fillColor = isHovered ? RADIAL_MENU_HOVER_COLOR : RADIAL_MENU_WEDGE_COLOR;
      const orderColor = ORDER_DISPLAY[ORDER_TYPES[i]].color;

      // Outer arc wedge
      const r = RADIAL_MENU_RADIUS;
      const ir = RADIAL_MENU_INNER_RADIUS;

      this.wedgeGraphics
        .moveTo(Math.cos(startAngle) * ir, Math.sin(startAngle) * ir)
        .lineTo(Math.cos(startAngle) * r, Math.sin(startAngle) * r)
        .arc(0, 0, r, startAngle, endAngle)
        .lineTo(Math.cos(endAngle) * ir, Math.sin(endAngle) * ir)
        .arc(0, 0, ir, endAngle, startAngle, true)
        .fill({ color: fillColor, alpha: 0.85 })
        .stroke({ width: 1, color: RADIAL_MENU_BORDER_COLOR, alpha: 0.5 });

      // Color indicator dot
      const midAngle = startAngle + WEDGE_ANGLE / 2;
      const dotR = (r + ir) / 2 - 5;
      this.wedgeGraphics
        .circle(Math.cos(midAngle) * dotR, Math.sin(midAngle) * dotR, 3)
        .fill({ color: orderColor, alpha: 0.9 });

      // Update label color on hover
      this.labels[i].style.fill = isHovered ? 0xFFFFFF : 0xDDDDDD;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
```

---

## Task 8: Wire Everything into main.ts + InputManager Modifications

**Files:**
- Modify: `src/core/InputManager.ts` — add Ctrl+drag, right-click, ESC, emit events
- Modify: `src/main.ts` — instantiate managers/renderers, wire events
- Modify: `src/rendering/Renderer.ts` — no changes needed (unitLayer/effectLayer already exist)

**InputManager changes (summary of modifications):**

Add new fields:
```typescript
private ctrlBoxSelecting = false;
private boxStartScreenX = 0;
private boxStartScreenY = 0;
private _boxRect: { x1: number; y1: number; x2: number; y2: number } | null = null;
```

Add getter:
```typescript
get boxSelectRect() { return this._boxRect; }
```

Modify `onMouseDown` (button 0): check `e.ctrlKey` — if true, enter box-select mode.
Modify `onMouseMove`: if `ctrlBoxSelecting`, update `_boxRect` instead of panning.
Modify `onMouseUp` (button 0): emit `input:click` or `input:boxSelect`.
Add `onMouseUp` (button 2): emit `input:rightClick`.
Add ESC in `onKeyDown`.

**main.ts wiring:**

```typescript
import { SelectionManager } from './simulation/SelectionManager';
import { OrderManager } from './simulation/OrderManager';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { OrderRenderer } from './rendering/OrderRenderer';
import { RadialMenu } from './rendering/RadialMenu';

// After unitManager:
const selectionManager = new SelectionManager();
const orderManager = new OrderManager();
const selectionRenderer = new SelectionRenderer(renderer.unitLayer, renderer.uiLayer);
const orderRenderer = new OrderRenderer(renderer.effectLayer);
const radialMenu = new RadialMenu(renderer.uiLayer);

// In render loop (after unitRenderer.update):
selectionRenderer.update(
  selectionManager, (id) => unitManager.get(id), alpha, frameDt,
  inputManager.boxSelectRect,
);
orderRenderer.update(orderManager, selectionManager, (id) => unitManager.get(id), alpha);
radialMenu.updateHover(inputManager.getMouseScreenPos().x, inputManager.getMouseScreenPos().y);

// Event wiring:
eventBus.on('input:click', ({ worldX, worldY, shift }) => {
  if (radialMenu.visible) {
    const mouse = inputManager.getMouseScreenPos();
    const orderType = radialMenu.getOrderAtPoint(mouse.x, mouse.y);
    if (orderType !== -1) {
      for (const id of selectionManager.selectedIds) {
        orderManager.setOrder(id, {
          type: orderType, unitId: id,
          targetX: radialMenu.worldX, targetY: radialMenu.worldY,
        });
      }
    }
    radialMenu.hide();
    return;
  }

  const hitId = selectionManager.getUnitAtPoint(worldX, worldY, unitManager.getAll(), camera.zoom);
  if (hitId !== -1) {
    if (shift) selectionManager.toggleSelection(hitId);
    else selectionManager.select(hitId);
  } else {
    selectionManager.deselectAll();
  }
});

eventBus.on('input:boxSelect', ({ x1, y1, x2, y2 }) => {
  const ids = selectionManager.getUnitsInRect(x1, y1, x2, y2, unitManager.getAll());
  selectionManager.selectMultiple(ids);
});

eventBus.on('input:rightClick', ({ worldX, worldY, screenX, screenY }) => {
  if (radialMenu.visible) { radialMenu.hide(); return; }
  if (selectionManager.count > 0) {
    radialMenu.show(screenX, screenY, worldX, worldY);
  }
});
```

---

## Task 9: Tests + Type Check

**Files:**
- Already created: `SelectionManager.test.ts`, `OrderManager.test.ts`
- Create: `src/core/__tests__/InputManager.test.ts` additions (new tests for Ctrl+drag, right-click, ESC events)

**Step 1: Run full test suite + type check**

```bash
pnpm test && npx tsc --noEmit
```

---

## Task 10: Visual Verification via Chrome MCP

Start dev server: `pkill -f "vite" || true && pnpm dev --port 3000`

| Check | Expected |
|-------|----------|
| Left-click a unit | Gold pulsing ring appears around it |
| Shift+click another | Both selected with rings |
| Click empty ground | Deselects all, rings disappear |
| Ctrl+drag a box over units | Gold box rect drawn during drag, units selected on release |
| Right-click with selection | Radial menu appears with 8 wedges and Chinese labels |
| Hover over wedges | Wedge highlights on hover |
| Click a wedge (Move) | Dotted line + flag from unit to right-click point |
| ESC | Deselects all, closes radial menu |
| `__alkaid.selectionManager.select(1)` | Console selection works |
| Console clean | No errors |

Stop dev server after testing: `pkill -f "vite"`

---

## Task 11: Update Progress + Git Commit

- Update `progress.md` — mark Step 5 as DONE
- Git commit

---

## Files Summary

| File | Action |
|------|--------|
| `src/constants.ts` | MODIFY — selection + order constants, OrderType enum |
| `src/core/EventBus.ts` | MODIFY — 6 new event types |
| `src/core/InputManager.ts` | MODIFY — Ctrl+drag box-select, right-click, ESC, event emission |
| `src/simulation/SelectionManager.ts` | CREATE — selection state + hit detection |
| `src/simulation/OrderManager.ts` | CREATE — order storage |
| `src/simulation/__tests__/SelectionManager.test.ts` | CREATE — ~12 tests |
| `src/simulation/__tests__/OrderManager.test.ts` | CREATE — ~6 tests |
| `src/rendering/SelectionRenderer.ts` | CREATE — pulsing rings + box rect |
| `src/rendering/OrderRenderer.ts` | CREATE — dotted lines + flags |
| `src/rendering/RadialMenu.ts` | CREATE — 8-wedge order menu |
| `src/main.ts` | MODIFY — wire all new systems + event handlers |
