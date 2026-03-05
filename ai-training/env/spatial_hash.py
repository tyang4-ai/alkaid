"""Grid-based spatial hash for O(1) neighbor queries — port of SpatialHash.ts."""
from __future__ import annotations

import math
from typing import Sequence

from shared.load_constants import pathfinding_cfg

_CELL_SIZE = pathfinding_cfg()["SPATIAL_HASH_CELL_SIZE"]


class SpatialHash:
    """Grid-based spatial hash supporting 9-cell and radius queries."""

    def __init__(self, cell_size: int = _CELL_SIZE) -> None:
        self.cell_size = cell_size
        # cell_key -> set of unit ids
        self._cells: dict[int, set[int]] = {}
        # unit_id -> cell_key
        self._unit_cells: dict[int, int] = {}

    def _key(self, cx: int, cy: int) -> int:
        return cy * 10000 + cx

    def clear(self) -> None:
        self._cells.clear()
        self._unit_cells.clear()

    def insert(self, uid: int, x: float, y: float) -> None:
        cx = int(math.floor(x / self.cell_size))
        cy = int(math.floor(y / self.cell_size))
        k = self._key(cx, cy)
        if k not in self._cells:
            self._cells[k] = set()
        self._cells[k].add(uid)
        self._unit_cells[uid] = k

    def remove(self, uid: int) -> None:
        k = self._unit_cells.pop(uid, None)
        if k is not None and k in self._cells:
            self._cells[k].discard(uid)
            if not self._cells[k]:
                del self._cells[k]

    def update(self, uid: int, x: float, y: float) -> None:
        cx = int(math.floor(x / self.cell_size))
        cy = int(math.floor(y / self.cell_size))
        new_key = self._key(cx, cy)
        old_key = self._unit_cells.get(uid)
        if old_key == new_key:
            return
        self.remove(uid)
        self.insert(uid, x, y)

    def query_near(self, x: float, y: float) -> list[int]:
        """9-cell neighborhood query."""
        cx = int(math.floor(x / self.cell_size))
        cy = int(math.floor(y / self.cell_size))
        result: list[int] = []
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                k = self._key(cx + dx, cy + dy)
                cell = self._cells.get(k)
                if cell:
                    result.extend(cell)
        return result

    def query_radius(
        self,
        x: float,
        y: float,
        radius: float,
        positions: dict[int, tuple[float, float]],
    ) -> list[int]:
        """Query near + post-filter by distance."""
        r2 = radius * radius
        result: list[int] = []
        for uid in self.query_near(x, y):
            pos = positions.get(uid)
            if pos is None:
                continue
            dx = pos[0] - x
            dy = pos[1] - y
            if dx * dx + dy * dy <= r2:
                result.append(uid)
        return result

    def query_radius_wide(
        self,
        x: float,
        y: float,
        radius: float,
        positions: dict[int, tuple[float, float]],
    ) -> list[int]:
        """Query cells in a larger radius — for long-range units."""
        r2 = radius * radius
        cx = int(math.floor(x / self.cell_size))
        cy = int(math.floor(y / self.cell_size))
        cell_radius = math.ceil(radius / self.cell_size)
        result: list[int] = []
        for dy in range(-cell_radius, cell_radius + 1):
            for dx in range(-cell_radius, cell_radius + 1):
                k = self._key(cx + dx, cy + dy)
                cell = self._cells.get(k)
                if not cell:
                    continue
                for uid in cell:
                    pos = positions.get(uid)
                    if pos is None:
                        continue
                    ddx = pos[0] - x
                    ddy = pos[1] - y
                    if ddx * ddx + ddy * ddy <= r2:
                        result.append(uid)
        return result

    def rebuild(self, units: Sequence) -> None:
        """Rebuild the entire hash from a list of units (must have .id, .x, .y, .state)."""
        self.clear()
        for u in units:
            if u.state != 5:  # UnitState.DEAD
                self.insert(u.id, u.x, u.y)
