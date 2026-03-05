"""Test terrain generation."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.terrain import generate_terrain
from env.types import TerrainType


def test_generate_terrain_default_size():
    grid = generate_terrain(seed=42, template_id="open_plains")
    assert grid.width == 200
    assert grid.height == 150
    assert grid.terrain.shape == (150, 200)
    assert grid.elevation.shape == (150, 200)


def test_generate_terrain_custom_size():
    grid = generate_terrain(seed=42, template_id="open_plains", width=50, height=40)
    assert grid.width == 50
    assert grid.height == 40


def test_generate_terrain_deterministic():
    g1 = generate_terrain(seed=42, template_id="open_plains", width=50, height=40)
    g2 = generate_terrain(seed=42, template_id="open_plains", width=50, height=40)
    assert (g1.terrain == g2.terrain).all()
    assert (g1.elevation == g2.elevation).all()


def test_generate_terrain_different_seeds():
    g1 = generate_terrain(seed=42, template_id="open_plains", width=50, height=40)
    g2 = generate_terrain(seed=99, template_id="open_plains", width=50, height=40)
    # Elevation maps should differ even if biome assignment is uniform
    assert not (g1.elevation == g2.elevation).all()


def test_terrain_edge_water():
    grid = generate_terrain(seed=42, template_id="open_plains", width=30, height=20)
    # All edges should be water
    for x in range(30):
        assert grid.get_terrain(x, 0) == TerrainType.WATER
        assert grid.get_terrain(x, 19) == TerrainType.WATER
    for y in range(20):
        assert grid.get_terrain(0, y) == TerrainType.WATER
        assert grid.get_terrain(29, y) == TerrainType.WATER


def test_terrain_out_of_bounds():
    grid = generate_terrain(seed=42, template_id="open_plains", width=30, height=20)
    assert grid.get_terrain(-1, 0) == TerrainType.WATER
    assert grid.get_terrain(30, 0) == TerrainType.WATER
    assert grid.get_terrain(0, -1) == TerrainType.WATER
    assert grid.get_terrain(0, 20) == TerrainType.WATER


def test_open_plains_mostly_passable():
    """Open plains template should produce mostly passable terrain."""
    grid = generate_terrain(seed=42, template_id="open_plains", width=100, height=75)
    total = 100 * 75
    passable = 0
    for y in range(75):
        for x in range(100):
            t = grid.get_terrain(x, y)
            if t not in (TerrainType.WATER, TerrainType.RIVER):
                passable += 1
    # At least 70% should be passable for training
    assert passable / total > 0.70


def test_elevation_range():
    grid = generate_terrain(seed=42, template_id="open_plains", width=50, height=40)
    assert grid.elevation.min() >= 0.0
    assert grid.elevation.max() <= 1.0
