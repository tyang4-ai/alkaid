#!/bin/bash
# Alkaid RL Training Script — Local GPU
# ======================================
# Run this when you have time for a 12-24hr training session.
#
# Prerequisites (one-time setup):
#   conda create -n alkaid python=3.10 -y
#   conda activate alkaid
#   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
#   pip install -e ".[dev]"
#
# Usage:
#   ./train_local.sh              # Full 50M steps (~12-24hr)
#   ./train_local.sh --quick      # Quick 10M steps (~3-5hr)
#   ./train_local.sh --smoke      # Smoke test 100K steps (~5min)

set -e
cd "$(dirname "$0")"

# Parse args
TIMESTEPS=50000000
N_ENVS=16
MODE="full"

if [ "$1" = "--quick" ]; then
    TIMESTEPS=10000000
    MODE="quick"
elif [ "$1" = "--smoke" ]; then
    TIMESTEPS=100000
    N_ENVS=4
    MODE="smoke"
fi

echo "=== Alkaid RL Training ($MODE mode) ==="
echo "Timesteps: $TIMESTEPS | Envs: $N_ENVS"
echo ""

# 1. Verify GPU
echo "--- Step 1: Verifying GPU ---"
python -c "import torch; assert torch.cuda.is_available(), 'No CUDA GPU found!'; print(f'GPU: {torch.cuda.get_device_name(0)}, VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB')"
echo ""

# 2. Train
echo "--- Step 2: Training ---"
python -m training.train \
    --timesteps $TIMESTEPS \
    --n-envs $N_ENVS \
    --device cuda \
    --seed 42
echo ""

# 3. Find the latest checkpoint
CHECKPOINT="checkpoints/final_model"
if [ ! -f "${CHECKPOINT}.zip" ] && [ ! -d "$CHECKPOINT" ]; then
    # Try to find the latest checkpoint
    CHECKPOINT=$(ls -t checkpoints/stage_* 2>/dev/null | head -1 | sed 's/\.zip$//')
    if [ -z "$CHECKPOINT" ]; then
        echo "ERROR: No checkpoint found in checkpoints/"
        exit 1
    fi
    echo "Using latest checkpoint: $CHECKPOINT"
fi

# 4. Export to ONNX
echo "--- Step 3: Exporting to ONNX ---"
python -m training.export_onnx \
    --checkpoint "$CHECKPOINT" \
    --output models/alkaid_ai.onnx
echo ""

# 5. Quantize to INT8
echo "--- Step 4: Quantizing to INT8 ---"
python -m training.quantize \
    --input models/alkaid_ai.onnx \
    --output models/alkaid_ai_int8.onnx
echo ""

# 6. Copy to web app
echo "--- Step 5: Deploying to web app ---"
cp models/alkaid_ai_int8.onnx "../public/models/alkaid_ai.onnx"
echo "Copied to public/models/alkaid_ai.onnx"
echo ""

echo "=== Training Complete! ==="
echo "Start the game: cd .. && pnpm dev --port 3000"
echo "Monitor training: tensorboard --logdir logs"
