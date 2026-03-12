"""Attention-based feature extractor for SB3 policies.

Replaces the flat MLP extractor with a unit-level attention mechanism
that reasons about individual units and their interactions before pooling
into a fixed-size feature vector.

Architecture:
    Input: (B, 2596) flat observation
      -> reshape into unit_obs (B, 64, 40), global_obs (B, 22), tendency_obs (B, 14)
      -> shared unit encoder MLP (40 -> 64 -> 64)
      -> dead masking (alive = unit_obs.abs().sum(-1) > 0)
      -> 2x Pre-LayerNorm Transformer layers (4 heads, dim=64)
      -> masked mean pool -> (B, 64)
      -> concat [pooled(64), global(22), tendency(14)] -> (B, 100)
"""
from __future__ import annotations

import gymnasium as gym
import torch
import torch.nn as nn
from stable_baselines3.common.torch_layers import BaseFeaturesExtractor

# Observation layout constants
MAX_UNITS_PER_TEAM: int = 32
UNIT_FEATURES: int = 40
GLOBAL_FEATURES: int = 22
TENDENCY_FEATURES: int = 14
TOTAL_UNITS: int = MAX_UNITS_PER_TEAM * 2  # 64 (own + enemy)

UNIT_OBS_SIZE: int = TOTAL_UNITS * UNIT_FEATURES  # 2560
OBS_SIZE: int = UNIT_OBS_SIZE + GLOBAL_FEATURES + TENDENCY_FEATURES  # 2596

# Transformer hyperparameters
EMBED_DIM: int = 64
NUM_HEADS: int = 4
NUM_LAYERS: int = 2
FFN_DIM: int = 128


class PreNormTransformerLayer(nn.Module):
    """Pre-LayerNorm Transformer encoder layer.

    Pre-norm pattern: LayerNorm -> MHA -> residual, LayerNorm -> FFN -> residual.
    This is more stable for training than post-norm.
    """

    def __init__(self, embed_dim: int, num_heads: int, ffn_dim: int) -> None:
        super().__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attn = nn.MultiheadAttention(
            embed_dim, num_heads, batch_first=True
        )
        self.norm2 = nn.LayerNorm(embed_dim)
        self.ffn = nn.Sequential(
            nn.Linear(embed_dim, ffn_dim),
            nn.ReLU(),
            nn.Linear(ffn_dim, embed_dim),
        )

    def forward(
        self, x: torch.Tensor, key_padding_mask: torch.Tensor | None = None
    ) -> torch.Tensor:
        """Forward pass with optional key padding mask.

        Args:
            x: (B, N, D) unit embeddings.
            key_padding_mask: (B, N) bool tensor where True = ignore (dead unit).

        Returns:
            (B, N, D) transformed embeddings.
        """
        # Pre-norm self-attention with residual
        normed = self.norm1(x)
        attn_out, _ = self.attn(
            normed, normed, normed, key_padding_mask=key_padding_mask
        )
        x = x + attn_out

        # Pre-norm FFN with residual
        normed = self.norm2(x)
        x = x + self.ffn(normed)

        return x


class UnitAttentionExtractor(BaseFeaturesExtractor):
    """SB3 feature extractor using unit-level self-attention.

    Takes a flat (B, 2596) observation and produces a (B, 100) feature vector
    by encoding each unit independently, applying self-attention across all
    units, and then pooling with a dead-unit mask.

    Usage with SB3:
        policy_kwargs={"features_extractor_class": UnitAttentionExtractor}
    """

    def __init__(
        self,
        observation_space: gym.spaces.Space,
        embed_dim: int = EMBED_DIM,
        num_heads: int = NUM_HEADS,
        num_layers: int = NUM_LAYERS,
        ffn_dim: int = FFN_DIM,
    ) -> None:
        features_dim = embed_dim + GLOBAL_FEATURES + TENDENCY_FEATURES  # 100
        super().__init__(observation_space, features_dim=features_dim)

        # Shared unit encoder: 40 -> 64 -> 64
        self.unit_encoder = nn.Sequential(
            nn.Linear(UNIT_FEATURES, embed_dim),
            nn.ReLU(),
            nn.Linear(embed_dim, embed_dim),
            nn.ReLU(),
        )

        # Transformer layers
        self.transformer_layers = nn.ModuleList(
            [
                PreNormTransformerLayer(embed_dim, num_heads, ffn_dim)
                for _ in range(num_layers)
            ]
        )

        # Final layer norm after transformer (common in pre-norm architectures)
        self.final_norm = nn.LayerNorm(embed_dim)

    def forward(self, observations: torch.Tensor) -> torch.Tensor:
        """Extract features from flat observations.

        Args:
            observations: (B, 2596) flat observation tensor.

        Returns:
            (B, 100) feature vector: [pooled_units(64), global(22), tendency(14)].
        """
        batch_size = observations.shape[0]

        # Split observation into unit, global, and tendency parts
        unit_flat = observations[:, :UNIT_OBS_SIZE]  # (B, 2560)
        global_obs = observations[:, UNIT_OBS_SIZE:UNIT_OBS_SIZE + GLOBAL_FEATURES]  # (B, 22)
        tendency_obs = observations[:, UNIT_OBS_SIZE + GLOBAL_FEATURES:]  # (B, 14)

        # Reshape unit observations: (B, 64, 40)
        unit_obs = unit_flat.view(batch_size, TOTAL_UNITS, UNIT_FEATURES)

        # Dead mask: alive units have non-zero features
        # alive: (B, 64), True if unit is alive
        alive = unit_obs.abs().sum(dim=-1) > 0  # (B, 64)

        # key_padding_mask for MHA: True = ignore (dead), so invert alive.
        # IMPORTANT: MHA produces NaN when ALL positions are masked (softmax
        # over all -inf). To prevent this, force at least position 0 unmasked
        # in the attention mask. The actual unit embedding at position 0 is
        # still zero (from alive_expanded masking), so it contributes nothing
        # meaningful, but it prevents NaN in softmax.
        dead_mask = ~alive  # (B, 64)
        all_dead = ~alive.any(dim=-1, keepdim=True)  # (B, 1) True if entire row dead
        # Unmask position 0 for all-dead rows to avoid NaN in MHA
        safe_dead_mask = dead_mask.clone()
        safe_dead_mask[:, 0] = safe_dead_mask[:, 0] & ~all_dead.squeeze(-1)

        # Encode each unit with shared MLP: (B, 64, 40) -> (B, 64, 64)
        unit_embeds = self.unit_encoder(unit_obs)

        # Zero out dead unit embeddings to ensure no contribution
        # alive_expanded: (B, 64, 1) for broadcasting
        alive_expanded = alive.unsqueeze(-1).float()
        unit_embeds = unit_embeds * alive_expanded

        # Apply transformer layers with safe dead-unit masking
        x = unit_embeds
        for layer in self.transformer_layers:
            x = layer(x, key_padding_mask=safe_dead_mask)

        # Apply final layer norm
        x = self.final_norm(x)

        # Zero out dead units after attention (attention residuals may leak,
        # and LayerNorm on zero inputs produces non-zero bias terms)
        x = x * alive_expanded

        # Masked mean pool: average over alive units only
        # sum_embeds: (B, 64) after summing over unit dim
        alive_count = alive.sum(dim=-1, keepdim=True).clamp(min=1).float()  # (B, 1)
        pooled = (x.sum(dim=1)) / alive_count  # (B, 64)

        # Concatenate with global and tendency features
        features = torch.cat([pooled, global_obs, tendency_obs], dim=-1)  # (B, 100)

        return features
