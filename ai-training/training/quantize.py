"""Quantize ONNX model with INT8 weights for browser deployment.

Applies dynamic INT8 quantization to reduce model size while maintaining
near-identical action predictions (argmax agreement target: >95%).

Usage:
    python -m training.quantize --input models/alkaid_ai.onnx --output models/alkaid_ai_int8.onnx
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent))


def quantize_model(input_path: str, output_path: str, n_tests: int = 100) -> None:
    """Quantize an ONNX model to INT8 and verify quality.

    Args:
        input_path: Path to the FP32 ONNX model.
        output_path: Destination path for the INT8 ONNX model.
        n_tests: Number of random inputs for argmax agreement testing.
    """
    import numpy as np
    import onnxruntime as ort
    from onnxruntime.quantization import QuantType, quantize_dynamic

    from env.obs_builder import OBS_SIZE

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    print(f"Quantizing: {input_path} -> {output_path}")
    quantize_dynamic(
        input_path,
        output_path,
        weight_type=QuantType.QInt8,
    )

    # Verify both models can run
    sess_fp32 = ort.InferenceSession(input_path)
    sess_int8 = ort.InferenceSession(output_path)

    # Quick smoke test
    dummy = np.random.randn(1, OBS_SIZE).astype(np.float32)
    fp32_out = sess_fp32.run(None, {"observations": dummy})
    int8_out = sess_int8.run(None, {"observations": dummy})

    print(f"FP32 outputs: action_logits {fp32_out[0].shape}, state_value {fp32_out[1].shape}")
    print(f"INT8 outputs: action_logits {int8_out[0].shape}, state_value {int8_out[1].shape}")

    # Argmax agreement test on action logits
    agree = 0
    for _ in range(n_tests):
        dummy = np.random.randn(1, OBS_SIZE).astype(np.float32)
        fp32_logits = sess_fp32.run(None, {"observations": dummy})[0]
        int8_logits = sess_int8.run(None, {"observations": dummy})[0]
        if np.argmax(fp32_logits) == np.argmax(int8_logits):
            agree += 1

    agreement_pct = agree / n_tests * 100

    # Value head agreement (mean absolute error)
    value_errors = []
    for _ in range(n_tests):
        dummy = np.random.randn(1, OBS_SIZE).astype(np.float32)
        fp32_value = sess_fp32.run(None, {"observations": dummy})[1]
        int8_value = sess_int8.run(None, {"observations": dummy})[1]
        value_errors.append(abs(fp32_value[0, 0] - int8_value[0, 0]))

    mean_value_err = np.mean(value_errors)

    # Report file sizes
    fp32_size = os.path.getsize(input_path) / 1024
    int8_size = os.path.getsize(output_path) / 1024

    print(f"\n--- Quantization Report ---")
    print(f"FP32: {fp32_size:.1f} KB, INT8: {int8_size:.1f} KB ({int8_size/fp32_size*100:.0f}%)")
    print(f"Argmax agreement: {agreement_pct:.0f}% (target: >95%)")
    print(f"Value head MAE:   {mean_value_err:.6f}")

    if agreement_pct < 95:
        print("WARNING: Argmax agreement below 95% — quantized model may behave differently.")


def main():
    parser = argparse.ArgumentParser(
        description="Quantize ONNX model to INT8 for browser deployment"
    )
    parser.add_argument(
        "--input", required=True, help="Path to FP32 ONNX model"
    )
    parser.add_argument(
        "--output", required=True, help="Output path for INT8 ONNX model"
    )
    parser.add_argument(
        "--n-tests",
        type=int,
        default=100,
        help="Number of random inputs for agreement testing (default: 100)",
    )
    args = parser.parse_args()

    quantize_model(args.input, args.output, args.n_tests)


if __name__ == "__main__":
    main()
