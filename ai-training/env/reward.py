"""Reward function for RL training.

Per-step shaping rewards + terminal win/loss:
  +0.01  * enemy_casualties_this_step
  -0.01  * own_casualties_this_step
  +0.05  * enemy_squads_routed_this_step
  -0.05  * own_squads_routed_this_step
  +0.3   * enemy_general_killed  (one-time)
  -0.5   * own_general_killed    (one-time)
  +1.0   * win
  -1.0   * loss
  +0.02  * territory_advantage   (per step)
  -0.001 * time_penalty          (per step)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from env.types import UnitState
from env.game import Game


@dataclass
class RewardState:
    """Tracks previous-step metrics for delta computation."""
    prev_own_casualties: int = 0
    prev_enemy_casualties: int = 0
    prev_own_routed: int = 0
    prev_enemy_routed: int = 0
    own_general_killed_rewarded: bool = False
    enemy_general_killed_rewarded: bool = False


def compute_reward(game: Game, team: int, state: RewardState) -> float:
    """Compute reward for the current step."""
    enemy_team = 1 - team
    reward = 0.0

    # Casualty deltas
    own_cas = game.team_casualties.get(team, 0)
    enemy_cas = game.team_casualties.get(enemy_team, 0)
    own_cas_delta = own_cas - state.prev_own_casualties
    enemy_cas_delta = enemy_cas - state.prev_enemy_casualties
    state.prev_own_casualties = own_cas
    state.prev_enemy_casualties = enemy_cas

    reward += 0.01 * enemy_cas_delta
    reward -= 0.01 * own_cas_delta

    # Rout deltas
    own_routed = game.team_squads_routed.get(team, 0)
    enemy_routed = game.team_squads_routed.get(enemy_team, 0)
    own_rout_delta = own_routed - state.prev_own_routed
    enemy_rout_delta = enemy_routed - state.prev_enemy_routed
    state.prev_own_routed = own_routed
    state.prev_enemy_routed = enemy_routed

    reward += 0.05 * enemy_rout_delta
    reward -= 0.05 * own_rout_delta

    # General killed (one-time)
    if game.team_general_killed.get(enemy_team, False) and not state.enemy_general_killed_rewarded:
        reward += 0.3
        state.enemy_general_killed_rewarded = True

    if game.team_general_killed.get(team, False) and not state.own_general_killed_rewarded:
        reward -= 0.5
        state.own_general_killed_rewarded = True

    # Territory advantage (based on centroid positions)
    own_alive = [u for u in game.units if u.team == team and u.state != UnitState.DEAD]
    enemy_alive = [u for u in game.units if u.team != team and u.state != UnitState.DEAD]
    if own_alive and enemy_alive:
        own_soldiers = sum(u.size for u in own_alive)
        enemy_soldiers = sum(u.size for u in enemy_alive)
        total = own_soldiers + enemy_soldiers
        if total > 0:
            advantage = (own_soldiers - enemy_soldiers) / total
            reward += 0.02 * advantage

    # Time penalty
    reward -= 0.001

    # Terminal rewards
    if game.battle_ended and game.battle_result:
        if game.battle_result.winner_team == team:
            reward += 1.0
        else:
            reward -= 1.0

    return reward
