"""Tests for UnitAttentionExtractor."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pytest
import torch
import gymnasium as gym

from training.attention_policy import (
    UnitAttentionExtractor,
    OBS_SIZE,
    UNIT_OBS_SIZE,
    GLOBAL_FEATURES,
    TENDENCY_FEATURES,
    TOTAL_UNITS,
    UNIT_FEATURES,
    EMBED_DIM,
)


@pytest.fixture
def obs_space() -> gym.spaces.Box:
    """Create observation space matching the expected flat input."""
    return gym.spaces.Box(low=-1.0, high=1.0, shape=(OBS_SIZE,), dtype=np.float32)


@pytest.fixture
def extractor(obs_space: gym.spaces.Box) -> UnitAttentionExtractor:
    """Create an extractor instance."""
    return UnitAttentionExtractor(obs_space)


def _make_obs(batch_size: int, num_alive_own: int = 8, num_alive_enemy: int = 8) -> torch.Tensor:
    """Create a synthetic observation tensor with specified alive units.

    Args:
        batch_size: Batch dimension.
        num_alive_own: Number of alive own units (out of 32).
        num_alive_enemy: Number of alive enemy units (out of 32).

    Returns:
        (B, 2596) observation tensor.
    """
    obs = torch.zeros(batch_size, OBS_SIZE)

    # Fill alive own units with random features
    for i in range(num_alive_own):
        start = i * UNIT_FEATURES
        obs[:, start:start + UNIT_FEATURES] = torch.rand(batch_size, UNIT_FEATURES)

    # Fill alive enemy units
    enemy_offset = 32 * UNIT_FEATURES
    for i in range(num_alive_enemy):
        start = enemy_offset + i * UNIT_FEATURES
        obs[:, start:start + UNIT_FEATURES] = torch.rand(batch_size, UNIT_FEATURES)

    # Fill global features
    obs[:, UNIT_OBS_SIZE:UNIT_OBS_SIZE + GLOBAL_FEATURES] = torch.rand(batch_size, GLOBAL_FEATURES)

    # Fill tendency features
    obs[:, UNIT_OBS_SIZE + GLOBAL_FEATURES:] = torch.rand(batch_size, TENDENCY_FEATURES)

    return obs


class TestForwardShapes:
    """Test that forward pass produces correct output shapes."""

    def test_single_batch(self, extractor: UnitAttentionExtractor) -> None:
        obs = _make_obs(1)
        out = extractor(obs)
        assert out.shape == (1, 100), f"Expected (1, 100), got {out.shape}"

    def test_multi_batch(self, extractor: UnitAttentionExtractor) -> None:
        obs = _make_obs(16)
        out = extractor(obs)
        assert out.shape == (16, 100), f"Expected (16, 100), got {out.shape}"

    def test_large_batch(self, extractor: UnitAttentionExtractor) -> None:
        obs = _make_obs(64)
        out = extractor(obs)
        assert out.shape == (64, 100), f"Expected (64, 100), got {out.shape}"

    def test_features_dim_attribute(self, extractor: UnitAttentionExtractor) -> None:
        assert extractor.features_dim == 100

    def test_output_is_float32(self, extractor: UnitAttentionExtractor) -> None:
        obs = _make_obs(4)
        out = extractor(obs)
        assert out.dtype == torch.float32


class TestDeadMasking:
    """Test that dead (zero) unit slots produce zero contribution."""

    def test_all_dead_units_produce_zero_pooled(self, extractor: UnitAttentionExtractor) -> None:
        """When all units are dead, pooled output should be all zeros."""
        obs = torch.zeros(1, OBS_SIZE)
        # Only set global and tendency features
        obs[:, UNIT_OBS_SIZE:UNIT_OBS_SIZE + GLOBAL_FEATURES] = torch.rand(1, GLOBAL_FEATURES)
        obs[:, UNIT_OBS_SIZE + GLOBAL_FEATURES:] = torch.rand(1, TENDENCY_FEATURES)

        out = extractor(obs)
        # First 64 dims (pooled units) should be zero
        pooled = out[:, :EMBED_DIM]
        assert torch.allclose(pooled, torch.zeros_like(pooled), atol=1e-6), \
            f"Pooled should be zero for all-dead units, got max={pooled.abs().max().item()}"

    def test_dead_units_dont_affect_output(self, extractor: UnitAttentionExtractor) -> None:
        """Adding dead (zero) units shouldn't change output vs. same alive units."""
        torch.manual_seed(42)
        # Observation with 4 alive own units
        obs_4 = _make_obs(1, num_alive_own=4, num_alive_enemy=0)
        # Clone and ensure dead slots remain zero
        obs_4_copy = obs_4.clone()

        out1 = extractor(obs_4)
        out2 = extractor(obs_4_copy)
        assert torch.allclose(out1, out2, atol=1e-6), "Same input should produce same output"

    def test_global_and_tendency_pass_through(self, extractor: UnitAttentionExtractor) -> None:
        """Global and tendency features should appear unchanged in output."""
        obs = torch.zeros(1, OBS_SIZE)
        global_vals = torch.rand(1, GLOBAL_FEATURES)
        tendency_vals = torch.rand(1, TENDENCY_FEATURES)
        obs[:, UNIT_OBS_SIZE:UNIT_OBS_SIZE + GLOBAL_FEATURES] = global_vals
        obs[:, UNIT_OBS_SIZE + GLOBAL_FEATURES:] = tendency_vals

        out = extractor(obs)
        # Global features: indices 64..86
        out_global = out[:, EMBED_DIM:EMBED_DIM + GLOBAL_FEATURES]
        assert torch.allclose(out_global, global_vals, atol=1e-6), \
            "Global features should pass through unchanged"
        # Tendency features: indices 86..100
        out_tendency = out[:, EMBED_DIM + GLOBAL_FEATURES:]
        assert torch.allclose(out_tendency, tendency_vals, atol=1e-6), \
            "Tendency features should pass through unchanged"

    def test_single_alive_unit(self, extractor: UnitAttentionExtractor) -> None:
        """A single alive unit should produce non-zero pooled output."""
        obs = _make_obs(1, num_alive_own=1, num_alive_enemy=0)
        out = extractor(obs)
        pooled = out[:, :EMBED_DIM]
        assert pooled.abs().sum() > 0, "Single alive unit should produce non-zero pooled features"


class TestGradientFlow:
    """Test that gradients flow correctly through the model."""

    def test_backward_succeeds(self, extractor: UnitAttentionExtractor) -> None:
        """loss.backward() should succeed without errors."""
        obs = _make_obs(4)
        obs.requires_grad_(False)
        out = extractor(obs)
        loss = out.sum()
        loss.backward()

        # Check that parameters have gradients
        for name, param in extractor.named_parameters():
            assert param.grad is not None, f"No gradient for {name}"

    def test_no_nan_gradients(self, extractor: UnitAttentionExtractor) -> None:
        """Gradients should not contain NaN values."""
        obs = _make_obs(8)
        out = extractor(obs)
        loss = out.mean()
        loss.backward()

        for name, param in extractor.named_parameters():
            if param.grad is not None:
                assert not torch.isnan(param.grad).any(), f"NaN gradient in {name}"
                assert not torch.isinf(param.grad).any(), f"Inf gradient in {name}"

    def test_no_nan_output(self, extractor: UnitAttentionExtractor) -> None:
        """Output should not contain NaN values."""
        obs = _make_obs(4)
        out = extractor(obs)
        assert not torch.isnan(out).any(), "Output contains NaN"
        assert not torch.isinf(out).any(), "Output contains Inf"

    def test_gradient_with_all_dead(self, extractor: UnitAttentionExtractor) -> None:
        """Backward should work even when all units are dead."""
        obs = torch.zeros(2, OBS_SIZE)
        obs[:, UNIT_OBS_SIZE:] = torch.rand(2, GLOBAL_FEATURES + TENDENCY_FEATURES)
        out = extractor(obs)
        loss = out.sum()
        loss.backward()
        # Should not crash

    def test_gradient_with_mixed_alive(self, extractor: UnitAttentionExtractor) -> None:
        """Backward works with different alive counts across batch."""
        obs = torch.zeros(3, OBS_SIZE)
        # Batch item 0: 2 alive own
        obs[0, :2 * UNIT_FEATURES] = torch.rand(2 * UNIT_FEATURES)
        # Batch item 1: 10 alive own
        obs[1, :10 * UNIT_FEATURES] = torch.rand(10 * UNIT_FEATURES)
        # Batch item 2: 0 alive
        obs[:, UNIT_OBS_SIZE:] = torch.rand(3, GLOBAL_FEATURES + TENDENCY_FEATURES)

        out = extractor(obs)
        loss = out.mean()
        loss.backward()

        for name, param in extractor.named_parameters():
            if param.grad is not None:
                assert not torch.isnan(param.grad).any(), f"NaN gradient in {name}"


class TestONNXExport:
    """Test ONNX export compatibility."""

    def test_onnx_export_succeeds(self, extractor: UnitAttentionExtractor, tmp_path) -> None:
        """torch.onnx.export should succeed with opset 14+."""
        extractor.eval()
        dummy_input = _make_obs(1)
        output_path = str(tmp_path / "test_extractor.onnx")

        torch.onnx.export(
            extractor,
            dummy_input,
            output_path,
            opset_version=14,
            input_names=["observations"],
            output_names=["features"],
            dynamic_axes={
                "observations": {0: "batch"},
                "features": {0: "batch"},
            },
        )

        import os
        assert os.path.exists(output_path), "ONNX file was not created"
        assert os.path.getsize(output_path) > 0, "ONNX file is empty"

    def test_onnx_model_valid(self, extractor: UnitAttentionExtractor, tmp_path) -> None:
        """Exported ONNX model should pass onnx.checker."""
        import onnx

        extractor.eval()
        dummy_input = _make_obs(1)
        output_path = str(tmp_path / "test_extractor.onnx")

        torch.onnx.export(
            extractor,
            dummy_input,
            output_path,
            opset_version=14,
            input_names=["observations"],
            output_names=["features"],
            dynamic_axes={
                "observations": {0: "batch"},
                "features": {0: "batch"},
            },
        )

        onnx_model = onnx.load(output_path)
        onnx.checker.check_model(onnx_model)

    def test_onnx_inference_matches_pytorch(
        self, extractor: UnitAttentionExtractor, tmp_path
    ) -> None:
        """ONNX runtime output should closely match PyTorch output."""
        import onnxruntime as ort

        extractor.eval()
        dummy_input = _make_obs(2)
        output_path = str(tmp_path / "test_extractor.onnx")

        torch.onnx.export(
            extractor,
            dummy_input,
            output_path,
            opset_version=14,
            input_names=["observations"],
            output_names=["features"],
            dynamic_axes={
                "observations": {0: "batch"},
                "features": {0: "batch"},
            },
        )

        # PyTorch reference
        with torch.no_grad():
            pt_out = extractor(dummy_input).numpy()

        # ONNX runtime inference
        sess = ort.InferenceSession(output_path)
        ort_out = sess.run(None, {"observations": dummy_input.numpy()})[0]

        np.testing.assert_allclose(pt_out, ort_out, rtol=1e-4, atol=1e-5)


class TestParameterCount:
    """Test that the model has approximately the expected parameter count."""

    def test_extractor_params_reasonable(self, extractor: UnitAttentionExtractor) -> None:
        """Extractor should have a reasonable number of parameters.

        Expected breakdown (approximate):
        - Unit encoder: 40*64 + 64 + 64*64 + 64 = 6,848
        - 2x Transformer layers: 2 * (
            LayerNorm: 2*64 = 128
            MHA: 4 * 64 * 64 + 64 = ~16,640  (Q,K,V,O projections)
            LayerNorm: 2*64 = 128
            FFN: 64*128 + 128 + 128*64 + 64 = 16,576
          ) = ~66,944
        - Final LayerNorm: 128
        Total: ~73,920
        """
        total_params = sum(p.numel() for p in extractor.parameters())
        # Should be in the range of 50K-150K for the extractor alone
        assert 30_000 < total_params < 200_000, \
            f"Extractor has {total_params} params, expected 50K-150K"

    def test_all_params_trainable(self, extractor: UnitAttentionExtractor) -> None:
        """All parameters should be trainable."""
        total = sum(p.numel() for p in extractor.parameters())
        trainable = sum(p.numel() for p in extractor.parameters() if p.requires_grad)
        assert total == trainable, "Some parameters are not trainable"
