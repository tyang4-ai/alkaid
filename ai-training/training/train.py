"""Main training script — MaskablePPO with curriculum learning.

Usage:
    python -m training.train
    python -m training.train --timesteps 500000 --n-envs 4 --device cuda
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))


def make_env(curriculum, seed: int, idx: int):
    """Factory for creating AlkaidEnv instances."""
    from env.alkaid_env import AlkaidEnv

    def _init():
        opponent_fn = curriculum.make_opponent_fn()
        env = AlkaidEnv(opponent_fn=opponent_fn, seed=seed + idx)
        return env

    return _init


def main():
    parser = argparse.ArgumentParser(description="Train Alkaid RL agent")
    parser.add_argument("--timesteps", type=int, default=1_000_000)
    parser.add_argument("--n-envs", type=int, default=8)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-dir", type=str, default="checkpoints")
    parser.add_argument("--log-dir", type=str, default="logs")
    parser.add_argument("--resume", type=str, default=None, help="Path to checkpoint to resume from")
    args = parser.parse_args()

    try:
        from sb3_contrib import MaskablePPO
        from sb3_contrib.common.wrappers import ActionMasker
        from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
    except ImportError:
        print("ERROR: sb3_contrib not installed. Install with: pip install sb3-contrib")
        print("Falling back to basic PPO without masking.")
        from stable_baselines3 import PPO as MaskablePPO
        ActionMasker = None
        from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv

    from training.config import TrainingConfig
    from training.curriculum import CurriculumManager
    from training.callbacks import WinrateCallback, PeriodicSaveCallback

    config = TrainingConfig(
        total_timesteps=args.timesteps,
        n_envs=args.n_envs,
        device=args.device,
        seed=args.seed,
        save_dir=args.save_dir,
        log_dir=args.log_dir,
    )

    curriculum = CurriculumManager()
    print(f"Starting curriculum stage: {curriculum.stage_name}")

    # Create vectorized environments
    env_fns = [make_env(curriculum, config.seed, i) for i in range(config.n_envs)]

    if config.n_envs > 1:
        vec_env = SubprocVecEnv(env_fns)
    else:
        vec_env = DummyVecEnv(env_fns)

    # Create or load model
    if args.resume:
        print(f"Resuming from: {args.resume}")
        model = MaskablePPO.load(args.resume, env=vec_env, device=config.device)
    else:
        model = MaskablePPO(
            "MlpPolicy",
            vec_env,
            learning_rate=config.learning_rate,
            n_steps=config.n_steps,
            batch_size=config.batch_size,
            n_epochs=config.n_epochs,
            gamma=config.gamma,
            gae_lambda=config.gae_lambda,
            clip_range=config.clip_range,
            ent_coef=config.ent_coef,
            vf_coef=config.vf_coef,
            max_grad_norm=config.max_grad_norm,
            policy_kwargs={"net_arch": config.net_arch},
            verbose=1,
            seed=config.seed,
            device=config.device,
            tensorboard_log=config.log_dir,
        )

    # Callbacks
    callbacks = [
        WinrateCallback(curriculum, save_dir=config.save_dir),
        PeriodicSaveCallback(config.save_freq, config.save_dir),
    ]

    # Train
    print(f"Training for {config.total_timesteps} timesteps on {config.n_envs} envs")
    print(f"Device: {config.device}, Save dir: {config.save_dir}")

    model.learn(
        total_timesteps=config.total_timesteps,
        callback=callbacks,
    )

    # Final save
    os.makedirs(config.save_dir, exist_ok=True)
    final_path = os.path.join(config.save_dir, "final_model")
    model.save(final_path)
    print(f"Training complete. Final model saved to: {final_path}")

    vec_env.close()


if __name__ == "__main__":
    main()
