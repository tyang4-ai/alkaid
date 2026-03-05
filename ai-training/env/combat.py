"""DamageCalculator + CombatSystem — port of DamageCalculator.ts + CombatSystem.ts."""
from __future__ import annotations

import math
from dataclasses import dataclass

from shared.load_constants import (
    combat_cfg, supply_cfg, map_cfg, weather_modifiers, time_of_day_modifiers,
)
from env.types import (
    Unit, UnitType, UnitState, OrderType, EnvironmentState,
    UNIT_TYPE_CONFIGS, TERRAIN_STATS,
    get_type_matchup, is_ranged_unit, can_fire_while_moving,
)
from env.spatial_hash import SpatialHash
from env.terrain import TerrainGrid

_cc = combat_cfg()
_mc = map_cfg()
_SIM_TICK_RATE = 20
_TILE_SIZE = _mc["TILE_SIZE"]


@dataclass
class DamageResult:
    final_damage: float
    soldiers_killed: int
    is_ranged: bool
    was_charge: bool


def calculate_damage(
    attacker: Unit,
    defender: Unit,
    defender_terrain: int,
    attacker_moving: bool,
    supply_combat_mult: float = 1.0,
    env: EnvironmentState | None = None,
) -> DamageResult:
    """Pure damage calculation — exact port of DamageCalculator.ts:37-147."""
    a_cfg = UNIT_TYPE_CONFIGS[attacker.type]
    d_cfg = UNIT_TYPE_CONFIGS[defender.type]
    ranged = is_ranged_unit(attacker.type)

    # Base damage scaled by squad strength
    base_damage = a_cfg.damage * (attacker.size / attacker.max_size)

    # Crossbow volley: only 1/3 fires per tick
    if attacker.type == UnitType.NU_CROSSBOWMEN:
        base_damage /= _cc["CROSSBOW_VOLLEY_RANKS"]

    # Can't fire while moving (except Horse Archers at full, Gong Archers at -30%)
    if ranged and attacker_moving:
        if not can_fire_while_moving(attacker.type):
            return DamageResult(0.0, 0, True, False)
        if attacker.type == UnitType.GONG_ARCHERS:
            base_damage *= (1 - _cc["FIRE_WHILE_MOVING_PENALTY"])

    # Type matchup
    type_mult = get_type_matchup(attacker.type, defender.type)

    # Terrain defense bonus for defender
    terrain_def = TERRAIN_STATS[defender_terrain].def_bonus
    terrain_mult = 1.0 / (1.0 + terrain_def)

    # Armor reduction
    armor_reduction = max(0, d_cfg.armor - a_cfg.armor_pen)
    armor_factor = 1 - armor_reduction / 20

    # Fatigue: 50% fatigue = 75% damage
    fatigue_mult = 1 - (attacker.fatigue / 200)

    # Experience: +-15% at 0/100 exp
    exp_mult = 1 + (attacker.experience - 50) * 0.003

    # Cavalry charge bonus
    charge_bonus = 1.0
    was_charge = False
    if not attacker.has_charged and attacker.combat_ticks == 0:
        if attacker.type == UnitType.LIGHT_CAVALRY:
            charge_bonus = _cc["CAVALRY_CHARGE_BONUS_LIGHT"]
            was_charge = True
        elif attacker.type == UnitType.HEAVY_CAVALRY:
            charge_bonus = _cc["CAVALRY_CHARGE_BONUS_HEAVY"]
            was_charge = True

    # Dao shield: -30% from ranged attacks
    shield_reduction = 1.0
    if ranged and defender.type == UnitType.DAO_SWORDSMEN:
        shield_reduction = 1 - _cc["DAO_SHIELD_ARROW_REDUCTION"]

    # Routing defender takes extra damage
    routing_mult = 1.0
    if defender.state == UnitState.ROUTING:
        routing_mult = _cc["ROUT_DAMAGE_TAKEN_MULT"]

    # Weather + time-of-day multipliers
    weather_mult = 1.0
    if env is not None and ranged:
        _wm = weather_modifiers()
        wm = _wm.get(str(env.weather))
        if wm:
            if attacker.type == UnitType.NU_CROSSBOWMEN:
                weather_mult *= wm["crossbowMult"]
            elif attacker.type == UnitType.SIEGE_ENGINEERS:
                weather_mult *= wm["siegeAccuracyMult"]
            else:
                weather_mult *= wm["rangedMult"]
        _todm = time_of_day_modifiers()
        tm = _todm.get(str(env.time_of_day))
        if tm:
            weather_mult *= tm["rangedAccuracyMult"]

    final_damage = (
        base_damage * type_mult * terrain_mult * armor_factor
        * fatigue_mult * exp_mult * charge_bonus * shield_reduction
        * routing_mult * supply_combat_mult * weather_mult
    )

    soldiers_killed = int(math.floor(final_damage / d_cfg.hp_per_soldier))

    return DamageResult(final_damage, soldiers_killed, ranged, was_charge)


class CombatSystem:
    """Detects engagements and processes combat — port of CombatSystem.ts."""

    def __init__(self, terrain_grid: TerrainGrid) -> None:
        self._terrain = terrain_grid

    def tick(
        self,
        current_tick: int,
        units: list[Unit],
        spatial_hash: SpatialHash,
        morale_system,  # MoraleSystem
        army_food_percents: dict[int, float] | None = None,
        env: EnvironmentState | None = None,
    ) -> list[dict]:
        """Run one tick of combat. Returns list of events."""
        events: list[dict] = []

        # Build position map
        positions: dict[int, tuple[float, float]] = {}
        for u in units:
            if u.state != UnitState.DEAD:
                positions[u.id] = (u.x, u.y)

        unit_map: dict[int, Unit] = {u.id: u for u in units}

        # Detection every 2 ticks
        if current_tick % _cc["COMBAT_DETECT_INTERVAL_TICKS"] == 0:
            self._detect_engagements(units, spatial_hash, positions, unit_map, events)

        # Process active combats
        self._process_active_combats(
            current_tick, units, unit_map, morale_system,
            army_food_percents, env, events,
        )

        return events

    def _detect_engagements(
        self,
        units: list[Unit],
        spatial_hash: SpatialHash,
        positions: dict[int, tuple[float, float]],
        unit_map: dict[int, Unit],
        events: list[dict],
    ) -> None:
        for unit in units:
            if unit.state in (UnitState.DEAD, UnitState.ROUTING):
                continue
            if unit.type == UnitType.GENERAL:
                continue
            if unit.combat_target_id != -1:
                continue

            cfg = UNIT_TYPE_CONFIGS[unit.type]
            range_px = cfg.range * _TILE_SIZE

            if range_px > _TILE_SIZE * 2:
                candidates = spatial_hash.query_radius_wide(
                    unit.x, unit.y, range_px, positions
                )
            else:
                candidates = spatial_hash.query_near(unit.x, unit.y)

            best_target = None
            best_dist = float("inf")

            for cid in candidates:
                if cid == unit.id:
                    continue
                candidate = unit_map.get(cid)
                if not candidate or candidate.team == unit.team or candidate.state == UnitState.DEAD:
                    continue
                dx = unit.x - candidate.x
                dy = unit.y - candidate.y
                dist = math.sqrt(dx * dx + dy * dy)
                if dist <= range_px and dist < best_dist:
                    best_target = candidate
                    best_dist = dist

            if best_target:
                unit.combat_target_id = best_target.id
                unit.state = UnitState.ATTACKING
                unit.combat_ticks = 0
                events.append({
                    "type": "combat:engaged",
                    "attacker_id": unit.id,
                    "target_id": best_target.id,
                })

    def _process_active_combats(
        self,
        current_tick: int,
        units: list[Unit],
        unit_map: dict[int, Unit],
        morale_system,
        army_food_percents: dict[int, float] | None,
        env: EnvironmentState | None,
        events: list[dict],
    ) -> None:
        from env.supply import SupplySystem  # avoid circular

        for unit in units:
            if unit.state == UnitState.DEAD:
                continue
            if unit.combat_target_id == -1:
                continue

            target = unit_map.get(unit.combat_target_id)

            # Target gone
            if not target or target.state == UnitState.DEAD:
                unit.combat_target_id = -1
                unit.combat_ticks = 0
                if unit.state == UnitState.ATTACKING:
                    unit.state = UnitState.IDLE
                continue

            # Check range
            cfg = UNIT_TYPE_CONFIGS[unit.type]
            range_px = cfg.range * _TILE_SIZE * _cc["COMBAT_DISENGAGE_RANGE_MULT"]
            dx = unit.x - target.x
            dy = unit.y - target.y
            dist = math.sqrt(dx * dx + dy * dy)

            if dist > range_px:
                unit.combat_target_id = -1
                unit.combat_ticks = 0
                if unit.state == UnitState.ATTACKING:
                    unit.state = UnitState.IDLE
                continue

            # Cooldown check
            if unit.attack_cooldown > 0:
                unit.attack_cooldown -= 1
                unit.combat_ticks += 1
                continue

            # Siege setup
            if unit.type == UnitType.SIEGE_ENGINEERS:
                if unit.siege_setup_ticks < _cc["SIEGE_SETUP_TICKS"]:
                    unit.siege_setup_ticks += 1
                    continue

            is_moving = unit.state == UnitState.MOVING

            # Face target
            unit.facing = math.atan2(target.y - unit.y, target.x - unit.x)

            # Calculate damage
            tx = int(math.floor(target.x / _TILE_SIZE))
            ty_tile = int(math.floor(target.y / _TILE_SIZE))
            def_terrain = self._terrain.get_terrain(tx, ty_tile)

            supply_mult = 1.0
            if army_food_percents:
                food_pct = army_food_percents.get(unit.team, 100)
                supply_mult = SupplySystem.get_combat_multiplier(food_pct)

            result = calculate_damage(
                unit, target, def_terrain, is_moving, supply_mult, env
            )

            if result.final_damage <= 0:
                unit.combat_ticks += 1
                continue

            # Hold defense bonus
            if target.order_modifier == OrderType.HOLD:
                result.final_damage *= (1 - _cc["HOLD_DEFENSE_BONUS"])

            # Apply damage to HP
            target.hp -= result.final_damage
            if target.hp < 0:
                target.hp = 0

            # Derive casualties
            d_cfg = UNIT_TYPE_CONFIGS[target.type]
            expected_size = math.ceil(target.hp / d_cfg.hp_per_soldier) if target.hp > 0 else 0
            prev_size = target.size
            killed = prev_size - expected_size
            killed = max(0, min(killed, target.size))
            target.size -= killed

            # Set attack cooldown
            ticks_per_attack = round(_SIM_TICK_RATE / cfg.attack_speed) if cfg.attack_speed > 0 else 9999
            unit.attack_cooldown = ticks_per_attack
            unit.last_attack_tick = current_tick

            # Cavalry charge: mark as used
            if result.was_charge:
                unit.has_charged = True
                if unit.type == UnitType.HEAVY_CAVALRY:
                    target.morale = max(0, target.morale + _cc["CAVALRY_CHARGE_MORALE_SHOCK"])

            # Morale loss from casualties
            if killed > 0:
                events.append({
                    "type": "combat:damage",
                    "attacker_id": unit.id,
                    "target_id": target.id,
                    "killed": killed,
                })
                percent_lost = (killed / prev_size) * 100
                morale_system.apply_casualty_morale(target, percent_lost)

            unit.combat_ticks += 1

            # Siege splash
            if unit.type == UnitType.SIEGE_ENGINEERS and killed > 0:
                self._apply_siege_splash(unit, target, units, unit_map, morale_system, events)

            # Death check
            if target.size <= 0:
                target.state = UnitState.DEAD
                events.append({
                    "type": "combat:unitDestroyed",
                    "unit_id": target.id,
                    "killer_id": unit.id,
                })
                unit.combat_target_id = -1
                unit.combat_ticks = 0
                if unit.state == UnitState.ATTACKING:
                    unit.state = UnitState.IDLE

    def _apply_siege_splash(
        self,
        siege: Unit,
        primary_target: Unit,
        units: list[Unit],
        unit_map: dict[int, Unit],
        morale_system,
        events: list[dict],
    ) -> None:
        splash_radius_px = _cc["SIEGE_AREA_RADIUS_TILES"] * _TILE_SIZE
        splash_radius_sq = splash_radius_px * splash_radius_px
        siege_cfg = UNIT_TYPE_CONFIGS[siege.type]

        for other in units:
            if other.id == primary_target.id or other.team == siege.team or other.state == UnitState.DEAD:
                continue
            dx = other.x - primary_target.x
            dy = other.y - primary_target.y
            if dx * dx + dy * dy > splash_radius_sq:
                continue

            splash_damage = siege_cfg.damage * 0.5
            other_cfg = UNIT_TYPE_CONFIGS[other.type]
            splash_killed = int(math.floor(splash_damage / other_cfg.hp_per_soldier))
            actual_killed = min(splash_killed, other.size)

            if actual_killed > 0:
                prev_size = other.size
                other.size -= actual_killed
                other.hp = other.size * other_cfg.hp_per_soldier
                percent_lost = (actual_killed / prev_size) * 100
                morale_system.apply_casualty_morale(other, percent_lost)

                if other.size <= 0:
                    other.state = UnitState.DEAD
                    events.append({
                        "type": "combat:unitDestroyed",
                        "unit_id": other.id,
                        "killer_id": siege.id,
                    })
