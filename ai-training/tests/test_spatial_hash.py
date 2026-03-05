"""Test SpatialHash grid-based neighbor queries."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.spatial_hash import SpatialHash


def test_insert_and_query_near():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 100.0, 100.0)
    sh.insert(2, 110.0, 110.0)
    sh.insert(3, 500.0, 500.0)  # far away

    near = sh.query_near(105.0, 105.0)
    assert 1 in near
    assert 2 in near
    assert 3 not in near


def test_update():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 10.0, 10.0)
    # Move to a different cell
    sh.update(1, 200.0, 200.0)
    # Should not be near origin anymore
    near = sh.query_near(10.0, 10.0)
    assert 1 not in near
    # Should be near new position
    near = sh.query_near(200.0, 200.0)
    assert 1 in near


def test_remove():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 100.0, 100.0)
    sh.remove(1)
    near = sh.query_near(100.0, 100.0)
    assert 1 not in near


def test_query_radius():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 100.0, 100.0)
    sh.insert(2, 110.0, 100.0)
    sh.insert(3, 200.0, 100.0)

    positions = {1: (100.0, 100.0), 2: (110.0, 100.0), 3: (200.0, 100.0)}
    # Radius 20 from (100, 100) — should include 1, 2 but not 3
    result = sh.query_radius(100.0, 100.0, 20.0, positions)
    assert 1 in result
    assert 2 in result
    assert 3 not in result


def test_query_radius_wide():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 100.0, 100.0)
    sh.insert(2, 300.0, 100.0)  # 200px away, > 1 cell

    positions = {1: (100.0, 100.0), 2: (300.0, 100.0)}
    # Wide query with radius 250 — should find both
    result = sh.query_radius_wide(100.0, 100.0, 250.0, positions)
    assert 1 in result
    assert 2 in result

    # Smaller radius — only first
    result = sh.query_radius_wide(100.0, 100.0, 50.0, positions)
    assert 1 in result
    assert 2 not in result


def test_clear():
    sh = SpatialHash(cell_size=64)
    sh.insert(1, 100.0, 100.0)
    sh.clear()
    assert sh.query_near(100.0, 100.0) == []
