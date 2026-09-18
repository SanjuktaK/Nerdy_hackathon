#!/usr/bin/env bash
# Natural, offline voices for Tally Tales: Kokoro-82M via mlx-audio.
# First run creates .venv-tts and downloads the weights (~330 MB).
set -euo pipefail
cd "$(dirname "$0")/../.."
VENV="$PWD/.venv-tts"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c "import mlx_audio, misaki, soundfile, en_core_web_sm" 2>/dev/null; then
  uv venv --python 3.12 "$VENV"
  VIRTUAL_ENV="$VENV" uv pip install --python "$VENV/bin/python" mlx-audio "misaki[en]" soundfile \
    "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
fi
exec "$VENV/bin/python" scripts/tts/serve.py
