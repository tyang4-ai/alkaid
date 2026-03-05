"""ExperienceSystem — port of ExperienceSystem.ts."""
from __future__ import annotations

import math

from shared.load_constants import experience_cfg, map_cfg
from env.types import Unit, UnitState

_ec = experience_cfg()
_TILE_SIZE = map_cfg()["TILE_SIZE"]


def get_tier(experience: float) -> int:
    """Get experience tier (0-4)."""
    if experience >= 80:
        return 4
    if experience >= 60:
        return 3
    if experience >= 40:
        return 2
    if experience >= 20:
        return 1
    return 0


class ExperienceSystem:
    """Kill-based XP, bombardment bonus, rout bonus, tier-up."""

    def __init__(self) -> None:
        self._pending_kills: list[tuple[int, int]] = []  # (attacker_id, killed_count)
        self._pending_routs: list[int] = []  # routed unit ids

    def record_kills(self, attacker_id: int, killed: int) -> None:
        self._pending_kills.append((attacker_id, killed))

    def record_rout(self, routed_unit_id: int) -> None:
        self._pending_routs.append(routed_unit_id)

    def tick(self, units: list[Unit]) -> list[dict]:
        events: list[dict] = []
        unit_map = {u.id: u for u in units}

        # Process kills
        for attacker_id, killed in self._pending_kills:
            u = unit_map.get(attacker_id)
            if u and u.state != UnitState.DEAD:
                u.kill_count += killed
        self._pending_kills.clear()

        # Process routs (bonus to enemies in radius)
        route_radius_px = _ec["EXP_ROUTE_RADIUS_TILES"] * _TILE_SIZE
        route_radius_sq = route_radius_px * route_radius_px
        for rid in self._pending_routs:
            routed = unit_map.get(rid)
            if not routed:
                continue
            for u in units:
                if u.state == UnitState.DEAD or u.team == routed.team:
                    continue
                dx = u.x - routed.x
                dy = u.y - routed.y
                if dx * dx + dy * dy <= route_radius_sq:
                    old_tier = get_tier(u.experience)
                    u.experience = min(100, u.experience + _ec["EXP_ROUTE_ENEMY"])
                    new_tier = get_tier(u.experience)
                    if new_tier > old_tier:
                        events.append({
                            "type": "experience:tierUp",
                            "unit_id": u.id,
                            "tier": new_tier,
                        })
        self._pending_routs.clear()

        # Per-unit experience processing
        for u in units:
            if u.state == UnitState.DEAD:
                continue
            old_tier = get_tier(u.experience)

            # Kill batches
            if u.kill_count >= _ec["EXP_KILL_THRESHOLD"]:
                batches = u.kill_count // _ec["EXP_KILL_THRESHOLD"]
                gain = batches * _ec["EXP_PER_KILL_BATCH"]
                u.experience = min(100, u.experience + gain)
                u.kill_count -= batches * _ec["EXP_KILL_THRESHOLD"]

            # Bombardment bonus
            if u.hold_under_bombardment_ticks >= _ec["EXP_HOLD_BOMBARDMENT_TICKS"]:
                batches = u.hold_under_bombardment_ticks // _ec["EXP_HOLD_BOMBARDMENT_TICKS"]
                gain = batches * _ec["EXP_HOLD_UNDER_BOMBARDMENT"]
                u.experience = min(100, u.experience + gain)
                u.hold_under_bombardment_ticks -= batches * _ec["EXP_HOLD_BOMBARDMENT_TICKS"]

            new_tier = get_tier(u.experience)
            if new_tier > old_tier:
                events.append({
                    "type": "experience:tierUp",
                    "unit_id": u.id,
                    "tier": new_tier,
                })

        return events
