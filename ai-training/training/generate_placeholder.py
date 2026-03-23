"""Generate a placeholder ONNX model with random weights for browser development.

Creates a minimal MLP with the correct input/output interface so the RL AI path
works in the browser before training is complete. The model produces random but
structurally valid actions.

Usage:
    python -m training.generate_placeholder
    python -m training.generate_placeholder --output ../public/models/alkaid_ai.onnx
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper

# Add parent dirs so shared imports work when run as module
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))

# Constants matching the game
OBS_SIZE = 2596
ACTION_LOGITS_SIZE = 1440  # 32 units * (10 order_types + 20 x_bins + 15 y_bins)
HIDDEN_DIM = 256


def _make_initializer(name: str, shape: list[int], *, scale: float = 1.0) -> onnx.TensorProto:
    """Create a random Xavier-initialized weight tensor."""
    fan_in = shape[0] if len(shape) > 1 else shape[0]
    fan_out = shape[1] if len(shape) > 1 else shape[0]
    limit = scale * np.sqrt(6.0 / (fan_in + fan_out))
    data = np.random.default_rng(42).uniform(-limit, limit, shape).astype(np.float32)
    return helper.make_tensor(name, TensorProto.FLOAT, shape, data.flatten().tolist())


def _make_bias(name: str, size: int) -> onnx.TensorProto:
    """Create a zero bias tensor."""
    return helper.make_tensor(name, TensorProto.FLOAT, [size], [0.0] * size)


def build_placeholder_model() -> onnx.ModelProto:
    """Build a 2-layer MLP ONNX model: obs(2596) -> 256 -> 256 -> logits(1440) + value(1)."""

    # --- Initializers (weights + biases) ---
    w1 = _make_initializer("w1", [OBS_SIZE, HIDDEN_DIM])
    b1 = _make_bias("b1", HIDDEN_DIM)
    w2 = _make_initializer("w2", [HIDDEN_DIM, HIDDEN_DIM])
    b2 = _make_bias("b2", HIDDEN_DIM)
    w_logits = _make_initializer("w_logits", [HIDDEN_DIM, ACTION_LOGITS_SIZE])
    b_logits = _make_bias("b_logits", ACTION_LOGITS_SIZE)
    w_value = _make_initializer("w_value", [HIDDEN_DIM, 1])
    b_value = _make_bias("b_value", 1)

    # --- Nodes ---
    # Layer 1: MatMul + Add + Relu
    n1_mm = helper.make_node("MatMul", ["observations", "w1"], ["h1_mm"])
    n1_add = helper.make_node("Add", ["h1_mm", "b1"], ["h1_add"])
    n1_relu = helper.make_node("Relu", ["h1_add"], ["h1"])

    # Layer 2: MatMul + Add + Relu
    n2_mm = helper.make_node("MatMul", ["h1", "w2"], ["h2_mm"])
    n2_add = helper.make_node("Add", ["h2_mm", "b2"], ["h2_add"])
    n2_relu = helper.make_node("Relu", ["h2_add"], ["h2"])

    # Action logits head
    n_logits_mm = helper.make_node("MatMul", ["h2", "w_logits"], ["logits_mm"])
    n_logits_add = helper.make_node("Add", ["logits_mm", "b_logits"], ["action_logits"])

    # Value head
    n_value_mm = helper.make_node("MatMul", ["h2", "w_value"], ["value_mm"])
    n_value_add = helper.make_node("Add", ["value_mm", "b_value"], ["state_value"])

    # --- Graph ---
    obs_input = helper.make_tensor_value_info("observations", TensorProto.FLOAT, ["batch", OBS_SIZE])
    logits_output = helper.make_tensor_value_info("action_logits", TensorProto.FLOAT, ["batch", ACTION_LOGITS_SIZE])
    value_output = helper.make_tensor_value_info("state_value", TensorProto.FLOAT, ["batch", 1])

    graph = helper.make_graph(
        nodes=[n1_mm, n1_add, n1_relu, n2_mm, n2_add, n2_relu, n_logits_mm, n_logits_add, n_value_mm, n_value_add],
        name="alkaid_placeholder",
        inputs=[obs_input],
        outputs=[logits_output, value_output],
        initializer=[w1, b1, w2, b2, w_logits, b_logits, w_value, b_value],
    )

    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 14)])
    model.ir_version = 8
    onnx.checker.check_model(model)
    return model


def main():
    parser = argparse.ArgumentParser(description="Generate placeholder ONNX model")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent.parent.parent / "public" / "models" / "alkaid_ai.onnx"),
        help="Output path for the ONNX model",
    )
    args = parser.parse_args()

    print("Building placeholder ONNX model...")
    model = build_placeholder_model()

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    onnx.save(model, args.output)

    # Verify with onnxruntime
    import onnxruntime as ort

    sess = ort.InferenceSession(args.output)
    dummy = np.random.randn(1, OBS_SIZE).astype(np.float32)
    results = sess.run(None, {sess.get_inputs()[0].name: dummy})

    logits_shape = results[0].shape
    value_shape = results[1].shape

    file_size_kb = os.path.getsize(args.output) / 1024
    print(f"Saved to: {args.output} ({file_size_kb:.1f} KB)")
    print(f"Input:  observations {(1, OBS_SIZE)}")
    print(f"Output: action_logits {logits_shape}, state_value {value_shape}")
    print("Verification passed!")


if __name__ == "__main__":
    main()
