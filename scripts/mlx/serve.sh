#!/usr/bin/env bash
# Serve our quantized Qwen on http://localhost:8080 (OpenAI-compatible).
#
#   npm run llm:serve                          # 4-bit
#   MLX_MODEL=qwen2.5-1.5b-instruct-8bit npm run llm:serve
#   MLX_DRAFT=qwen2.5-0.5b-instruct-4bit npm run llm:serve   # speculative
set -euo pipefail

cd "$(dirname "$0")/../.."
MODEL="${MLX_MODEL:-qwen2.5-1.5b-instruct-4bit}"
ARGS=(--model "$PWD/.models/$MODEL" --port "${MLX_PORT:-8080}")
if [ -n "${MLX_DRAFT:-}" ]; then
  ARGS+=(--draft-model "$PWD/.models/$MLX_DRAFT" --num-draft-tokens "${MLX_DRAFT_TOKENS:-3}")
fi

exec "$PWD/.venv-mlx/bin/mlx_lm.server" "${ARGS[@]}"
