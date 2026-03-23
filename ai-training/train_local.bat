@echo off
REM Alkaid RL Training Script — Local GPU (Windows)
REM ================================================
REM Run this when you have time for a 12-24hr training session.
REM
REM Prerequisites (one-time setup):
REM   conda create -n alkaid python=3.10 -y
REM   conda activate alkaid
REM   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
REM   pip install -e ".[dev]"
REM
REM Usage:
REM   train_local.bat              Full 50M steps (~12-24hr)
REM   train_local.bat --quick      Quick 10M steps (~3-5hr)
REM   train_local.bat --smoke      Smoke test 100K steps (~5min)

setlocal enabledelayedexpansion
cd /d "%~dp0"

set TIMESTEPS=50000000
set N_ENVS=16
set MODE=full

if "%1"=="--quick" (
    set TIMESTEPS=10000000
    set MODE=quick
)
if "%1"=="--smoke" (
    set TIMESTEPS=100000
    set N_ENVS=4
    set MODE=smoke
)

echo === Alkaid RL Training (%MODE% mode) ===
echo Timesteps: %TIMESTEPS% ^| Envs: %N_ENVS%
echo.

echo --- Step 1: Verifying GPU ---
python -c "import torch; assert torch.cuda.is_available(), 'No CUDA GPU found!'; print(f'GPU: {torch.cuda.get_device_name(0)}')"
if errorlevel 1 goto :error
echo.

echo --- Step 2: Training ---
python -m training.train --timesteps %TIMESTEPS% --n-envs %N_ENVS% --device cuda --seed 42
if errorlevel 1 goto :error
echo.

echo --- Step 3: Exporting to ONNX ---
python -m training.export_onnx --checkpoint checkpoints/final_model --output models/alkaid_ai.onnx
if errorlevel 1 goto :error
echo.

echo --- Step 4: Quantizing to INT8 ---
python -m training.quantize --input models/alkaid_ai.onnx --output models/alkaid_ai_int8.onnx
if errorlevel 1 goto :error
echo.

echo --- Step 5: Deploying to web app ---
copy /Y models\alkaid_ai_int8.onnx ..\public\models\alkaid_ai.onnx
echo.

echo === Training Complete! ===
echo Start the game: cd .. ^&^& pnpm dev --port 3000
goto :end

:error
echo.
echo ERROR: Training failed at step above. Check output for details.
exit /b 1

:end
endlocal
