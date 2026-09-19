#!/usr/bin/env bash
# Natural, offline voices for Tally Tales: Qwen3-TTS VoiceDesign via mlx-audio.
# First run creates .venv-tts and downloads the weights (~2.7 GB).
set -euo pipefail
cd "$(dirname "$0")/../.."
VENV="$PWD/.venv-tts"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c "import mlx_audio, soundfile" 2>/dev/null; then
  uv venv --python 3.12 "$VENV"
  VIRTUAL_ENV="$VENV" uv pip install --python "$VENV/bin/python" mlx-audio soundfile
fi
exec "$VENV/bin/python" scripts/tts/serve.py
