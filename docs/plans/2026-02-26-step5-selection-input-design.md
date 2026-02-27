# Step 5: Selection + Input — Design Document

## User Decisions

- **Left-click drag**: stays as camera pan. **Ctrl+left-drag** = box-select.
- **Right-click**: full radial order menu with all 7 orders from Step 7 spec (stored, not executed until Steps 6-7).
- **Selection highlight**: pulsing white/gold ring around selected unit dots.
- **Order visualization**: dotted line from unit to target + small team-colored flag at destination.
- **Orders available**: Advance, Hold, Retreat, Flank, Charge, Form Up, Disengage (all 7).

## Architecture: Option A — Separate Systems

Follows existing simulation/rendering separation. Each system is independently testable.

### Selection System

**`SelectionManager`** (`src/simulation/SelectionManager.ts`):
- `selectedIds: Set<number>`
- `select(id)`, `addToSelection(id)`, `toggleSelection(id)`, `selectMultiple(ids)`, `deselectAll()`, `isSelected(id)`
- `getUnitAtPoint(worldX, worldY, units)` — distance check, returns closest within click radius
- `getUnitsInRect(x1, y1, x2, y2, units)` — AABB test
- Emits `selection:changed { ids: number[] }`

**`SelectionRenderer`** (`src/rendering/SelectionRenderer.ts`):
- Pulsing white/gold ring around selected units (sine-wave alpha, ~2s period)
- Box-select rectangle: dashed border + semi-transparent fill during Ctrl+drag
- Updated every render frame

### Order System

**`OrderType`** enum: MOVE=0, ATTACK=1, HOLD=2, RETREAT=3, FLANK=4, CHARGE=5, FORM_UP=6, DISENGAGE=7

**`Order`** interface: `{ type, unitId, targetX?, targetY?, targetUnitId? }`

**`OrderManager`** (`src/simulation/OrderManager.ts`):
- `Map<number, Order>` — one current order per unit
- `setOrder(unitId, order)`, `getOrder(unitId)`, `clearOrder(unitId)`
- Emits `order:issued`, `order:cleared`

**`RadialMenu`** (`src/rendering/RadialMenu.ts`):
- PixiJS Container, 7 wedges in a circle
- Each wedge: icon area + Chinese label
- Appears on right-click when units selected
- Closes on wedge click, click outside, or ESC

**`OrderRenderer`** (`src/rendering/OrderRenderer.ts`):
- Dotted line from unit to order target position
- Small flag marker at destination (team-colored)
- Line color varies by order type

### InputManager Changes

- Left-click (no drag, no Ctrl): select unit at point (screen→world conversion)
- Shift+click: toggle unit in selection
- Ctrl+left-drag: box-select (draw rect, on release query units in rect)
- Right-click with selection: open RadialMenu
- ESC: deselect all + close radial menu
- InputManager emits generic input events, doesn't call managers directly

### New EventBus Events

```
'selection:changed': { ids: number[] }
'input:click': { worldX, worldY, screenX, screenY, shift: boolean }
'input:boxSelect': { x1, y1, x2, y2 }
'input:rightClick': { worldX, worldY, screenX, screenY }
'order:issued': { unitId: number, order: Order }
'order:cleared': { unitId: number }
'radialMenu:opened': { screenX, screenY }
'radialMenu:closed': undefined
```

### Files

| File | Action |
|------|--------|
| `src/constants.ts` | MODIFY — OrderType enum, selection constants |
| `src/core/EventBus.ts` | MODIFY — new event types |
| `src/core/InputManager.ts` | MODIFY — Ctrl+drag, right-click, shift+click, ESC |
| `src/simulation/SelectionManager.ts` | CREATE |
| `src/simulation/OrderManager.ts` | CREATE |
| `src/rendering/SelectionRenderer.ts` | CREATE |
| `src/rendering/OrderRenderer.ts` | CREATE |
| `src/rendering/RadialMenu.ts` | CREATE |
| `src/main.ts` | MODIFY — wire new systems |
