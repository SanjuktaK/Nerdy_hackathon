"""
Tally Tales voice server: Kokoro-82M (Apache-2.0) on Apple silicon via mlx-audio.

    npm run tts:serve        # http://localhost:8091

POST /tts  {"text": "...", "style": "child" | "bear" | "grownup"}  ->  audio/wav
GET  /health

Runs fully offline once the weights are downloaded. The cartoon voices use
the oldest trick in animation: speak at one speed, play back at another.
A child is generated slower and pitched up; a bear is generated faster and
pitched down. The speaking speed comes out normal; only the pitch moves.
"""

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

RATE = 24000
PORT = 8091

# voice, lang, pitch factor (>1 higher)
STYLES = {
    "child": ("af_sky", "a", 1.22),
    "bear": ("am_michael", "a", 0.82),
    "grownup": ("af_heart", "a", 1.0),
}

model = load_model("prince-canuma/Kokoro-82M")
lock = threading.Lock()  # one generation at a time on the GPU


def synth(text: str, style: str) -> bytes:
    voice, lang, pitch = STYLES.get(style, STYLES["child"])
    with lock:
        # Generate at speed/pitch so that after the pitch shift the pace is natural.
        parts = [np.array(r.audio).reshape(-1) for r in model.generate(text=text, voice=voice, speed=1.0 / pitch, lang_code=lang)]
    audio = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
    if pitch != 1.0:
        # Resample: playing n samples in n/pitch time raises the pitch by `pitch`.
        n = int(len(audio) / pitch)
        audio = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            self._send(200, b'{"status":"ok","model":"Kokoro-82M"}', "application/json")
        else:
            self._send(404, b"", "text/plain")

    def do_POST(self):
        if self.path != "/tts":
            return self._send(404, b"", "text/plain")
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
            text = str(body.get("text", "")).strip()[:400]
            if not text:
                return self._send(400, b"empty", "text/plain")
            self._send(200, synth(text, str(body.get("style", "child"))), "audio/wav")
        except Exception as e:  # never take the server down over one line
            self._send(500, str(e).encode()[:200], "text/plain")

    def _send(self, code, data, ctype):
        self.send_response(code)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    synth("Hello.", "child")  # warm up, so the first real line is fast
    print(f"Kokoro voice server on http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
