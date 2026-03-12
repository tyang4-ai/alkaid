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
    use_attention: bool = True  # Use attention extractor vs flat MLP

    # Attention params
    attention_embed_dim: int = 64
    attention_heads: int = 4
    attention_layers: int = 2

    # Self-play
    self_play_enabled: bool = True
    self_play_pool_size: int = 20
    self_play_save_interval: int = 50_000  # Save to pool every N steps
    self_play_bot_phase_steps: int = 5_000_000  # Bot curriculum steps before self-play

    # Environment
    n_envs: int = 32
    seed: int = 42

    # Training loop
    total_timesteps: int = 50_000_000
    eval_freq: int = 50_000
    save_freq: int = 100_000
    log_dir: str = "logs"
    save_dir: str = "checkpoints"

    # Learning rate schedule
    use_cosine_lr: bool = True
    lr_warmup_steps: int = 10_000

    # Device
    device: str = "auto"  # "auto", "cuda", "cpu"
