#!/usr/bin/env bash
# Download Qwen2.5 Instruct in full precision (bf16) and quantize it on this
# Mac with MLX. Nothing is pre-quantized: the 4-bit weights are ours.
#
#   npm run llm:quantize
#
# Produces, under .models/ (hidden, so macOS Storage's "Large Files" cleanup
# does not offer the weights for deletion):
#   qwen2.5-1.5b-instruct-4bit   the served model (~0.9 GB, from 3.1 GB)
#   qwen2.5-1.5b-instruct-8bit   the comparison rung for the benchmark
#   qwen2.5-0.5b-instruct-4bit   draft model for speculative decoding
set -euo pipefail

cd "$(dirname "$0")/../.."
ROOT="$PWD"
VENV="$ROOT/.venv-mlx"

if [ ! -x "$VENV/bin/mlx_lm.convert" ]; then
  uv venv --python 3.12 "$VENV"
  uv pip install --python "$VENV/bin/python" mlx-lm
fi

snapshot() {
  "$VENV/bin/python" -c "
from huggingface_hub import snapshot_download
print(snapshot_download('$1', allow_patterns=['*.json', '*.safetensors', '*.txt', 'LICENSE']))"
}

quantize() { # repo bits out
  local src out="$ROOT/.models/$3"
  if [ -f "$out/model.safetensors" ]; then
    echo "have $3"
    return
  fi
  src="$(snapshot "$1" | tail -1)"
  rm -rf "$out"
  "$VENV/bin/mlx_lm.convert" --hf-path "$src" --mlx-path "$out" \
    -q --q-bits "$2" --q-group-size 64
  # Read-only, like the Hugging Face cache: harder to lose in a disk clean-up.
  chmod 444 "$out"/*.safetensors
}

quantize Qwen/Qwen2.5-1.5B-Instruct 4 qwen2.5-1.5b-instruct-4bit
quantize Qwen/Qwen2.5-1.5B-Instruct 8 qwen2.5-1.5b-instruct-8bit
quantize Qwen/Qwen2.5-0.5B-Instruct 4 qwen2.5-0.5b-instruct-4bit

du -sh "$ROOT"/.models/*/
