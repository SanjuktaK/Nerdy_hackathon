#!/usr/bin/env bash
# Serve our quantized Qwen on http://localhost:8080 (OpenAI-compatible).
#
#   npm run llm:serve
#
# mlx_lm.server keeps an LRU cache of prompt KV state, so the system prompt
# every request shares is read once and reused.
set -euo pipefail

cd "$(dirname "$0")/../.."
MODEL="${MLX_MODEL:-qwen2.5-1.5b-instruct-4bit}"
ARGS=(--model "$PWD/.models/$MODEL" --port "${MLX_PORT:-8080}")

exec "$PWD/.venv-mlx/bin/mlx_lm.server" "${ARGS[@]}"
