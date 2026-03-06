"""PPO hyperparameters and training configuration."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TrainingConfig:
    """PPO + environment training hyperparameters."""

    # PPO core
    learning_rate: float = 3e-4
    n_steps: int = 2048
    batch_size: int = 64
    n_epochs: int = 10
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip_range: float = 0.2
    ent_coef: float = 0.01
    vf_coef: float = 0.5
    max_grad_norm: float = 0.5

    # Network
    net_arch: list[int] = field(default_factory=lambda: [256, 256])

    # Environment
    n_envs: int = 8
    seed: int = 42

    # Training loop
    total_timesteps: int = 1_000_000
    eval_freq: int = 10_000
    save_freq: int = 50_000
    log_dir: str = "logs"
    save_dir: str = "checkpoints"

    # Device
    device: str = "auto"  # "auto", "cuda", "cpu"
