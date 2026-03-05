"""Terrain grid generation — port of TerrainGrid.ts + TerrainGenerator.ts.

For Tier 1 training, we use open_plains template (mostly plains with some
forests/hills). Full terrain gen with simplex noise deferred to Tier 2.
"""
from __future__ import annotations

import numpy as np
from opensimplex import OpenSimplex

from shared.load_constants import map_cfg, terrain_gen_cfg
from env.random import SeededRandom
from env.types import TerrainType

_map = map_cfg()
_tg = terrain_gen_cfg()


class TerrainGrid:
    """2D terrain grid with elevation, moisture, and terrain type arrays."""

    def __init__(
        self,
        width: int,
        height: int,
        seed: int,
        template_id: str,
        terrain: np.ndarray,
        elevation: np.ndarray,
        moisture: np.ndarray,
    ) -> None:
        self.width = width
        self.height = height
        self.seed = seed
        self.template_id = template_id
        self.terrain = terrain      # uint8 [height, width]
        self.elevation = elevation  # float32 [height, width]
        self.moisture = moisture    # float32 [height, width]

    def get_terrain(self, x: int, y: int) -> int:
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return TerrainType.WATER
        return int(self.terrain[y, x])

    def get_elevation(self, x: int, y: int) -> float:
        if x < 0 or x >= self.width or y < 0 or y >= self.height:
            return 0.0
        return float(self.elevation[y, x])


def _fbm(simplex: OpenSimplex, x: float, y: float) -> float:
    """Fractal Brownian Motion with parameters from constants."""
    value = 0.0
    amplitude = 1.0
    frequency = _tg["BASE_FREQUENCY"]
    total_amp = 0.0
    for _ in range(_tg["OCTAVES"]):
        value += amplitude * simplex.noise2(x * frequency, y * frequency)
        total_amp += amplitude
        amplitude *= _tg["PERSISTENCE"]
        frequency *= _tg["LACUNARITY"]
    return value / total_amp


def generate_terrain(
    seed: int,
    template_id: str = "open_plains",
    width: int | None = None,
    height: int | None = None,
) -> TerrainGrid:
    """Generate a terrain grid from seed and template.

    For training, open_plains is the default (mostly passable terrain).
    """
    w = width or _map["DEFAULT_MAP_WIDTH"]
    h = height or _map["DEFAULT_MAP_HEIGHT"]

    rng = SeededRandom(seed)
    elev_seed = seed
    moist_seed = seed + _tg["MOISTURE_SEED_OFFSET"]

    simplex_elev = OpenSimplex(seed=elev_seed)
    simplex_moist = OpenSimplex(seed=moist_seed)

    elevation = np.zeros((h, w), dtype=np.float32)
    moisture = np.zeros((h, w), dtype=np.float32)
    terrain = np.full((h, w), TerrainType.PLAINS, dtype=np.uint8)

    # Generate elevation and moisture maps
    for y in range(h):
        for x in range(w):
            e = _fbm(simplex_elev, float(x), float(y))
            # Normalize from [-1,1] to [0,1]
            e = (e + 1.0) * 0.5
            # Apply power curve
            e = e ** _tg["ELEVATION_POWER"]
            elevation[y, x] = e

            m = _fbm(simplex_moist, float(x), float(y))
            m = (m + 1.0) * 0.5
            moisture[y, x] = m

    # Template-specific adjustments
    if template_id == "open_plains":
        # Flatten terrain — push elevation toward middle range
        elevation = elevation * 0.5 + 0.25
        # Reduce extreme moisture
        moisture = moisture * 0.6 + 0.2

    # Assign biomes
    for y in range(h):
        for x in range(w):
            e = float(elevation[y, x])
            m = float(moisture[y, x])

            if e < _tg["WATER_LEVEL"]:
                terrain[y, x] = TerrainType.WATER
            elif e < _tg["FORD_LEVEL"]:
                terrain[y, x] = TerrainType.FORD
            elif e >= _tg["MOUNTAIN_LEVEL"]:
                terrain[y, x] = TerrainType.MOUNTAINS
            elif e >= _tg["HILLS_LEVEL"]:
                terrain[y, x] = TerrainType.HILLS
            elif m >= _tg["FOREST_MOISTURE"]:
                terrain[y, x] = TerrainType.FOREST
            elif m < _tg["PLAINS_MOISTURE"]:
                # Dry plains — might be road later
                terrain[y, x] = TerrainType.PLAINS
            else:
                terrain[y, x] = TerrainType.PLAINS

    # Edge water border (1 tile)
    terrain[0, :] = TerrainType.WATER
    terrain[h - 1, :] = TerrainType.WATER
    terrain[:, 0] = TerrainType.WATER
    terrain[:, w - 1] = TerrainType.WATER

    return TerrainGrid(w, h, seed, template_id, terrain, elevation, moisture)
