"""Export trained model to ONNX format for inference in the browser.

Usage:
    python -m training.export_onnx --checkpoint checkpoints/final_model --output models/alkaid_ai.onnx
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))


def export_to_onnx(checkpoint_path: str, output_path: str, opset: int = 14) -> None:
    """Export a trained MaskablePPO model to ONNX."""
    import torch
    import numpy as np

    try:
        from sb3_contrib import MaskablePPO
    except ImportError:
        from stable_baselines3 import PPO as MaskablePPO

    from env.obs_builder import OBS_SIZE

    print(f"Loading model from: {checkpoint_path}")
    model = MaskablePPO.load(checkpoint_path)

    # Extract the policy network
    policy = model.policy
    policy.eval()

    # Create dummy input
    dummy_obs = torch.zeros(1, OBS_SIZE, dtype=torch.float32)

    # Export just the actor (action prediction)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    class PolicyWrapper(torch.nn.Module):
        def __init__(self, policy):
            super().__init__()
            self.features_extractor = policy.features_extractor
            self.mlp_extractor = policy.mlp_extractor
            self.action_net = policy.action_net

        def forward(self, obs):
            features = self.features_extractor(obs)
            latent_pi, _ = self.mlp_extractor(features)
            action_logits = self.action_net(latent_pi)
            return action_logits

    wrapper = PolicyWrapper(policy)
    wrapper.eval()

    torch.onnx.export(
        wrapper,
        dummy_obs,
        output_path,
        opset_version=opset,
        input_names=["observations"],
        output_names=["action_logits"],
        dynamic_axes={
            "observations": {0: "batch"},
            "action_logits": {0: "batch"},
        },
    )

    # Verify
    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)

    file_size_kb = os.path.getsize(output_path) / 1024
    print(f"Exported to: {output_path} ({file_size_kb:.1f} KB)")
    print(f"Input shape: (batch, {OBS_SIZE})")
    print("ONNX model verified successfully.")


def main():
    parser = argparse.ArgumentParser(description="Export trained model to ONNX")
    parser.add_argument("--checkpoint", required=True, help="Path to SB3 checkpoint")
    parser.add_argument("--output", default="models/alkaid_ai.onnx", help="Output ONNX path")
    parser.add_argument("--opset", type=int, default=14, help="ONNX opset version")
    args = parser.parse_args()

    export_to_onnx(args.checkpoint, args.output, args.opset)


if __name__ == "__main__":
    main()
