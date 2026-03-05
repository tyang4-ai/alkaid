"""A* pathfinding — simplified port of Pathfinding.ts for training env.

Uses binary min-heap, octile heuristic, terrain costs.
Simplified: no flow fields, no caching (env runs headless at max speed).
"""
from __future__ import annotations

import heapq
import math

from shared.load_constants import pathfinding_cfg, map_cfg
from env.types import get_move_cost
from env.terrain import TerrainGrid

_pc = pathfinding_cfg()
_TILE_SIZE = map_cfg()["TILE_SIZE"]
_DIAG_COST = _pc["PATH_DIAGONAL_COST"]
_MAX_LENGTH = _pc["PATH_MAX_LENGTH"]
_ARRIVAL_THRESHOLD = _pc["PATH_ARRIVAL_THRESHOLD"]

# 8-directional neighbors: (dx, dy, is_diagonal)
_DIRS = [
    (1, 0, False), (-1, 0, False), (0, 1, False), (0, -1, False),
    (1, 1, True), (-1, 1, True), (1, -1, True), (-1, -1, True),
]


def _octile_heuristic(ax: int, ay: int, bx: int, by: int) -> float:
    dx = abs(ax - bx)
    dy = abs(ay - by)
    return max(dx, dy) + (_DIAG_COST - 1) * min(dx, dy)


def find_path(
    terrain: TerrainGrid,
    unit_type: int,
    start_x: float,
    start_y: float,
    goal_x: float,
    goal_y: float,
) -> list[tuple[float, float]] | None:
    """Find path from start to goal in world pixels. Returns list of waypoints or None."""
    sx = int(math.floor(start_x / _TILE_SIZE))
    sy = int(math.floor(start_y / _TILE_SIZE))
    gx = int(math.floor(goal_x / _TILE_SIZE))
    gy = int(math.floor(goal_y / _TILE_SIZE))

    # Clamp to map bounds
    sx = max(0, min(terrain.width - 1, sx))
    sy = max(0, min(terrain.height - 1, sy))
    gx = max(0, min(terrain.width - 1, gx))
    gy = max(0, min(terrain.height - 1, gy))

    if sx == gx and sy == gy:
        return [(goal_x, goal_y)]

    # Check goal is passable
    goal_cost = get_move_cost(unit_type, terrain.get_terrain(gx, gy))
    if goal_cost < 0:
        return None

    # A* with binary min-heap
    # Node: (f_score, g_score, x, y)
    open_set: list[tuple[float, float, int, int]] = []
    g_score: dict[tuple[int, int], float] = {(sx, sy): 0}
    came_from: dict[tuple[int, int], tuple[int, int]] = {}
    closed: set[tuple[int, int]] = set()

    h = _octile_heuristic(sx, sy, gx, gy)
    heapq.heappush(open_set, (h, 0.0, sx, sy))

    explored = 0

    while open_set and explored < _MAX_LENGTH:
        f, g, cx, cy = heapq.heappop(open_set)
        explored += 1

        if cx == gx and cy == gy:
            # Reconstruct path
            path: list[tuple[int, int]] = [(gx, gy)]
            node = (gx, gy)
            while node in came_from:
                node = came_from[node]
                path.append(node)
            path.reverse()

            # Convert to world pixels (center of tile)
            return [
                (tx * _TILE_SIZE + _TILE_SIZE * 0.5, ty * _TILE_SIZE + _TILE_SIZE * 0.5)
                for tx, ty in path
            ]

        key = (cx, cy)
        if key in closed:
            continue
        closed.add(key)

        for dx, dy, is_diag in _DIRS:
            nx, ny = cx + dx, cy + dy
            if nx < 0 or nx >= terrain.width or ny < 0 or ny >= terrain.height:
                continue
            nkey = (nx, ny)
            if nkey in closed:
                continue

            # Corner-cutting prevention
            if is_diag:
                c1 = get_move_cost(unit_type, terrain.get_terrain(cx + dx, cy))
                c2 = get_move_cost(unit_type, terrain.get_terrain(cx, cy + dy))
                if c1 < 0 or c2 < 0:
                    continue

            move_cost = get_move_cost(unit_type, terrain.get_terrain(nx, ny))
            if move_cost < 0:
                continue

            step = _DIAG_COST * move_cost if is_diag else move_cost
            new_g = g + step

            if new_g < g_score.get(nkey, float("inf")):
                g_score[nkey] = new_g
                came_from[nkey] = (cx, cy)
                new_f = new_g + _octile_heuristic(nx, ny, gx, gy)
                heapq.heappush(open_set, (new_f, new_g, nx, ny))

    return None  # No path found


def get_movement_vector(
    unit_x: float,
    unit_y: float,
    path: list[tuple[float, float]],
    path_index: int,
) -> tuple[float, float, int] | None:
    """Get normalized movement direction toward next waypoint.

    Returns (dx, dy, new_path_index) or None if path is exhausted.
    """
    while path_index < len(path):
        wx, wy = path[path_index]
        dx = wx - unit_x
        dy = wy - unit_y
        dist = math.sqrt(dx * dx + dy * dy)
        if dist < _ARRIVAL_THRESHOLD:
            path_index += 1
            continue
        return (dx / dist, dy / dist, path_index)
    return None
