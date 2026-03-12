"""Main training script — MaskablePPO with curriculum learning and self-play.

Usage:
    python -m training.train
    python -m training.train --timesteps 500000 --n-envs 4 --device cuda
    python -m training.train --no-attention --no-self-play
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))


def make_env(opponent_fn, seed: int, idx: int):
    """Factory for creating AlkaidEnv instances with a specific opponent function."""
    from env.alkaid_env import AlkaidEnv

    def _init():
        env = AlkaidEnv(opponent_fn=opponent_fn, seed=seed + idx)
        return env

    return _init


def make_curriculum_env(curriculum, seed: int, idx: int):
    """Factory for creating AlkaidEnv instances with curriculum opponents."""
    from env.alkaid_env import AlkaidEnv

    def _init():
        opponent_fn = curriculum.make_opponent_fn()
        env = AlkaidEnv(opponent_fn=opponent_fn, seed=seed + idx)
        return env

    return _init


def build_vec_env(env_fns, n_envs: int):
    """Build a vectorized environment from a list of env factories."""
    from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv

    if n_envs > 1:
        return SubprocVecEnv(env_fns)
    else:
        return DummyVecEnv(env_fns)


def cosine_lr_schedule(config):
    """Create a cosine LR schedule with linear warmup for SB3.

    SB3 calls the schedule with ``progress_remaining`` which goes from 1.0 -> 0.0
    over the course of training.

    Args:
        config: TrainingConfig with learning_rate, total_timesteps, lr_warmup_steps.

    Returns:
        Callable that maps progress_remaining -> learning rate.
    """
    base_lr = config.learning_rate
    total_steps = config.total_timesteps
    warmup_steps = config.lr_warmup_steps

    def _schedule(progress_remaining: float) -> float:
        current_step = total_steps * (1 - progress_remaining)

        # Linear warmup
        if current_step < warmup_steps:
            return base_lr * (current_step / max(warmup_steps, 1))

        # Cosine decay after warmup
        progress = (current_step - warmup_steps) / max(
            total_steps - warmup_steps, 1
        )
        return base_lr * (0.5 * (1 + math.cos(math.pi * progress)))

    return _schedule


def main():
    parser = argparse.ArgumentParser(description="Train Alkaid RL agent")
    parser.add_argument("--timesteps", type=int, default=None)
    parser.add_argument("--n-envs", type=int, default=None)
    parser.add_argument("--device", type=str, default="auto")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-dir", type=str, default="checkpoints")
    parser.add_argument("--log-dir", type=str, default="logs")
    parser.add_argument(
        "--resume", type=str, default=None, help="Path to checkpoint to resume from"
    )
    parser.add_argument(
        "--no-attention",
        action="store_true",
        help="Use flat MLP instead of attention extractor",
    )
    parser.add_argument(
        "--no-self-play",
        action="store_true",
        help="Disable self-play phase (bot curriculum only)",
    )
    parser.add_argument(
        "--self-play-pool-size",
        type=int,
        default=None,
        help="Max checkpoints in self-play pool",
    )
    parser.add_argument(
        "--bot-phase-steps",
        type=int,
        default=None,
        help="Bot curriculum steps before self-play transition",
    )
    parser.add_argument(
        "--no-cosine-lr",
        action="store_true",
        help="Disable cosine LR schedule (use constant LR)",
    )
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
    from training.callbacks import (
        WinrateCallback,
        PeriodicSaveCallback,
        SelfPlayCallback,
    )
    from training.self_play import SelfPlayManager

    # Build config, applying CLI overrides
    config = TrainingConfig(
        device=args.device,
        seed=args.seed,
        save_dir=args.save_dir,
        log_dir=args.log_dir,
    )

    # Apply CLI overrides (use defaults from TrainingConfig if not specified)
    if args.timesteps is not None:
        config.total_timesteps = args.timesteps
    if args.n_envs is not None:
        config.n_envs = args.n_envs
    if args.no_attention:
        config.use_attention = False
    if args.no_self_play:
        config.self_play_enabled = False
    if args.self_play_pool_size is not None:
        config.self_play_pool_size = args.self_play_pool_size
    if args.bot_phase_steps is not None:
        config.self_play_bot_phase_steps = args.bot_phase_steps
    if args.no_cosine_lr:
        config.use_cosine_lr = False

    # Build policy_kwargs
    if config.use_attention:
        from training.attention_policy import UnitAttentionExtractor

        policy_kwargs = {
            "net_arch": config.net_arch,
            "features_extractor_class": UnitAttentionExtractor,
            "features_extractor_kwargs": {
                "embed_dim": config.attention_embed_dim,
                "num_heads": config.attention_heads,
                "num_layers": config.attention_layers,
            },
        }
        print("[Config] Using attention feature extractor")
    else:
        policy_kwargs = {"net_arch": config.net_arch}
        print("[Config] Using flat MLP policy")

    # Learning rate: cosine schedule with warmup or constant
    if config.use_cosine_lr:
        lr = cosine_lr_schedule(config)
        print(
            f"[Config] Cosine LR schedule: base={config.learning_rate}, "
            f"warmup={config.lr_warmup_steps} steps"
        )
    else:
        lr = config.learning_rate
        print(f"[Config] Constant LR: {config.learning_rate}")

    # Curriculum and self-play managers
    curriculum = CurriculumManager()
    self_play_mgr = SelfPlayManager(max_pool_size=config.self_play_pool_size)

    print(f"Starting curriculum stage: {curriculum.stage_name}")

    # Create vectorized environments (bot curriculum phase)
    env_fns = [
        make_curriculum_env(curriculum, config.seed, i)
        for i in range(config.n_envs)
    ]
    vec_env = build_vec_env(env_fns, config.n_envs)

    # Create or load model
    if args.resume:
        print(f"Resuming from: {args.resume}")
        model = MaskablePPO.load(args.resume, env=vec_env, device=config.device)
    else:
        model = MaskablePPO(
            "MlpPolicy",
            vec_env,
            learning_rate=lr,
            n_steps=config.n_steps,
            batch_size=config.batch_size,
            n_epochs=config.n_epochs,
            gamma=config.gamma,
            gae_lambda=config.gae_lambda,
            clip_range=config.clip_range,
            ent_coef=config.ent_coef,
            vf_coef=config.vf_coef,
            max_grad_norm=config.max_grad_norm,
            policy_kwargs=policy_kwargs,
            verbose=1,
            seed=config.seed,
            device=config.device,
            tensorboard_log=config.log_dir,
        )

    # Helper to create a new vec_env for self-play opponent swapping
    def make_self_play_vec_env(opponent_fn):
        fns = [
            make_env(opponent_fn, config.seed, i) for i in range(config.n_envs)
        ]
        return build_vec_env(fns, config.n_envs)

    # Callbacks
    callbacks = [
        WinrateCallback(curriculum, save_dir=config.save_dir),
        PeriodicSaveCallback(config.save_freq, config.save_dir),
    ]

    if config.self_play_enabled:
        self_play_cb = SelfPlayCallback(
            config=config,
            curriculum=curriculum,
            self_play_manager=self_play_mgr,
            make_env_fn=make_self_play_vec_env,
            save_dir=config.save_dir,
        )
        callbacks.append(self_play_cb)
        print(
            f"[Config] Self-play enabled: pool_size={config.self_play_pool_size}, "
            f"bot_phase={config.self_play_bot_phase_steps} steps, "
            f"save_interval={config.self_play_save_interval} steps"
        )
    else:
        print("[Config] Self-play disabled (bot curriculum only)")

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
