"""Export trained model to ONNX format for inference in the browser.

Exports BOTH action logits and state value heads for use with browser-side MCTS.

Usage:
    python -m training.export_onnx --checkpoint checkpoints/final_model --output models/alkaid_ai.onnx
    python -m training.export_onnx --checkpoint checkpoints/final_model --no-attention
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))


def export_to_onnx(
    checkpoint_path: str,
    output_path: str,
    opset: int = 14,
    use_attention: bool = True,
) -> None:
    """Export a trained MaskablePPO model to ONNX with both policy and value heads.

    Args:
        checkpoint_path: Path to an SB3/sb3-contrib saved model zip.
        output_path: Destination .onnx file path.
        opset: ONNX opset version (minimum 14 for attention ops).
        use_attention: If True, import and register the attention extractor
                       custom objects so the checkpoint loads correctly.
    """
    import numpy as np
    import torch

    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        from stable_baselines3 import PPO as MaskablePPO

    from env.obs_builder import OBS_SIZE

    # If the checkpoint was trained with the attention extractor we need to
    # make the custom class available so SB3 can deserialise it.
    if use_attention:
        from training.attention_policy import UnitAttentionExtractor  # noqa: F401

    print(f"Loading model from: {checkpoint_path}")
    model = MaskablePPO.load(checkpoint_path)

    # Extract the policy network
    policy = model.policy
    policy.eval()

    # Create dummy input
    dummy_obs = torch.zeros(1, OBS_SIZE, dtype=torch.float32)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    class PolicyValueWrapper(torch.nn.Module):
        """Wraps an SB3 policy to export both action logits and state value."""

        def __init__(self, policy):
            super().__init__()
            self.features_extractor = policy.features_extractor
            self.mlp_extractor = policy.mlp_extractor
            self.action_net = policy.action_net
            self.value_net = policy.value_net

        def forward(self, obs):
            features = self.features_extractor(obs)
            latent_pi, latent_vf = self.mlp_extractor(features)
            action_logits = self.action_net(latent_pi)
            state_value = self.value_net(latent_vf)
            return action_logits, state_value

    wrapper = PolicyValueWrapper(policy)
    wrapper.eval()

    torch.onnx.export(
        wrapper,
        dummy_obs,
        output_path,
        opset_version=opset,
        input_names=["observations"],
        output_names=["action_logits", "state_value"],
        dynamic_axes={
            "observations": {0: "batch"},
            "action_logits": {0: "batch"},
            "state_value": {0: "batch"},
        },
    )

    # Verify with onnx checker
    import onnx

    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    # Verify with onnxruntime
    import onnxruntime as ort

    sess = ort.InferenceSession(output_path)
    dummy_input = np.random.randn(1, OBS_SIZE).astype(np.float32)
    results = sess.run(None, {"observations": dummy_input})

    logits_shape = results[0].shape
    value_shape = results[1].shape
    print(f"ONNX verification passed:")
    print(f"  action_logits shape: {logits_shape}")
    print(f"  state_value shape:   {value_shape}")

    assert logits_shape[0] == 1, f"Expected batch dim 1, got {logits_shape[0]}"
    assert value_shape == (1, 1), f"Expected value shape (1, 1), got {value_shape}"

    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"Exported to: {output_path} ({file_size_kb:.1f} KB)")
    print(f"Input shape: (batch, {OBS_SIZE})")
    print("ONNX model verified successfully.")


def main():
    parser = argparse.ArgumentParser(description="Export trained model to ONNX")
    parser.add_argument("--checkpoint", required=True, help="Path to SB3 checkpoint")
    parser.add_argument(
        "--output", default="models/alkaid_ai.onnx", help="Output ONNX path"
    )
    parser.add_argument("--opset", type=int, default=14, help="ONNX opset version")
    parser.add_argument(
        "--attention",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Use attention extractor (default: on). --no-attention to disable.",
    )
    args = parser.parse_args()

    export_to_onnx(args.checkpoint, args.output, args.opset, args.attention)


if __name__ == "__main__":
    main()
