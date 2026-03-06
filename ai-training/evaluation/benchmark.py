"""Benchmark agent against all bots.

Usage:
    python -m evaluation.benchmark --checkpoint checkpoints/final_model --episodes 100
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

from env.alkaid_env import AlkaidEnv
from bots.rush_bot import RushBot
from bots.defensive_bot import DefensiveBot
from bots.flanker_bot import FlankerBot
from bots.balanced_bot import BalancedBot


def run_benchmark(checkpoint_path: str, episodes: int = 100) -> dict:
    """Run agent against all bot types and report winrates."""
    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        from stable_baselines3 import PPO as MaskablePPO

    model = MaskablePPO.load(checkpoint_path)

    bots = {
        "rush": RushBot,
        "defensive": DefensiveBot,
        "flanker": FlankerBot,
        "balanced": BalancedBot,
    }

    results = {}

    for bot_name, bot_cls in bots.items():
        wins = 0
        for ep in range(episodes):
            bot = bot_cls()

            def opponent_fn(game, team):
                return bot.decide(game, team)

            env = AlkaidEnv(opponent_fn=opponent_fn, seed=ep * 1000)
            obs, info = env.reset()

            done = False
            while not done:
                action, _ = model.predict(obs, deterministic=True)
                obs, reward, terminated, truncated, info = env.step(action)
                done = terminated or truncated

            if info.get("winner") == 0:
                wins += 1

        winrate = wins / episodes
        results[bot_name] = {"wins": wins, "total": episodes, "winrate": winrate}
        print(f"  vs {bot_name}: {winrate:.1%} ({wins}/{episodes})")

    return results


def main():
    parser = argparse.ArgumentParser(description="Benchmark agent vs bots")
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--episodes", type=int, default=100)
    args = parser.parse_args()

    print(f"Benchmarking: {args.checkpoint}")
    results = run_benchmark(args.checkpoint, args.episodes)

    avg_winrate = sum(r["winrate"] for r in results.values()) / len(results)
    print(f"\nAverage winrate: {avg_winrate:.1%}")


if __name__ == "__main__":
    main()
