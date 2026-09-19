"""
Tally Tales voice server: one child's voice, Qwen3-TTS 1.7B VoiceDesign (6-bit), via mlx-audio.

    npm run tts:serve        # http://localhost:8091

POST /stream {"text": "..."}   -> raw 16-bit mono PCM at 24 kHz, sent as it is made
POST /tts    {"text": "..."}   -> the whole line as WAV (used to prepare lines ahead)
GET  /health

Why it is built this way:
  · One voice. The child's voice is fixed by its description and a seed, so it
    sounds the same on every line and nothing is re-designed per request.
  · Streaming. The first sound is ready in about 0.4 s and the rest is made
    faster than it plays, so a line starts almost at once.
  · Newest wins. A new line stops whatever was still being made, so lines
    never queue up behind each other (that queue was the lag).
  · Remembered. Every finished line is kept on disk, and the app's fixed lines
    ("Your turn.", the hints, the cheers) are made at start-up.
  · A listener that hangs up just stops the work; it never crashes the server.
"""

import hashlib
import re
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import mlx.core as mx
import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

PORT = 8091
RATE = 24000
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-6bit"
SEED = 11
VOICE = (
    "A cheerful young child, about seven years old, with a bright, high, friendly voice. "
    "Speaks clearly and a little slowly, full of wonder."
)
CACHE = Path(__file__).resolve().parents[2] / ".cache" / "tts"
CACHE.mkdir(parents=True, exist_ok=True)

# Lines the app says over and over: made once, then instant.
FIXED = [
    "Your turn.", "Watch me first.", "Last puzzle. Then a break.", "Welcome back.", "Woo hoo!",
    "Count again, slowly. Touch each one once.", "Some go away, so the number gets smaller.",
    "More are coming, so the number gets bigger.", "Tens go on the tens rod. Ones go on the ones rod.",
    "Ten ones make one ten. Look at the ones first.", "More means the bigger pile.", "Fewer means the smaller pile.",
    "Check each rod: hundreds, tens, then ones.", "Look again. Take your time.",
    "First, 5 puzzles. Then, a break.", "First, 3 puzzles. Then, a break.", "First, 8 puzzles. Then, a break.",
    "Hello. I will read the puzzles to you.",
]

model = load_model(MODEL)
gpu = threading.Lock()
latest = 0  # the id of the newest live line; older ones stop when they see it has moved on
latest_lock = threading.Lock()
live = 0  # live lines being spoken right now; background work waits for them


def key(text: str) -> Path:
    return CACHE / (hashlib.sha1(f"{MODEL}|{SEED}|{VOICE}|{text}".encode()).hexdigest() + ".npy")


def cached(text: str):
    p = key(text)
    return np.load(p) if p.exists() else None


def sentences(text: str) -> list[str]:
    """Speech is made one sentence at a time: on longer, multi-sentence text the
    model can stop after a fraction of a second, while single sentences come out
    whole. Short sentences also repeat more, so they are reused from disk more."""
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", text) if p.strip()]
    return parts or [text]


def plausible(audio: np.ndarray, text: str) -> bool:
    """Speech far shorter than its text means the model stopped early."""
    return len(audio) / RATE >= 0.035 * len(text)


def chunks(text: str, still_wanted, seed: int = SEED):
    """Yield float32 audio chunks as they are made; stop early if no longer wanted."""
    with gpu:
        mx.random.seed(seed)
        for r in model.generate_voice_design(text=text, language="English", instruct=VOICE, stream=True, streaming_interval=0.4):
            if not still_wanted():
                return
            yield np.array(r.audio, dtype=np.float32).reshape(-1)


def make_sentence(text: str, still_wanted=lambda: True):
    """One sentence, from disk if made before. None if it was abandoned part-way."""
    audio = cached(text)
    if audio is not None:
        return audio
    for seed in (SEED, SEED + 1):  # one retry if the model stops early
        parts = []
        gen = chunks(text, still_wanted, seed)
        try:
            for c in gen:
                parts.append(c)
        finally:
            gen.close()  # always release the model at once
        if not still_wanted():
            return None
        audio = np.concatenate(parts) if parts else np.zeros(1, np.float32)
        if plausible(audio, text):
            np.save(key(text), audio)
            return audio
    return audio  # still short: play it, but never keep it


def make(text: str, still_wanted=lambda: True):
    """The whole line, sentence by sentence. None if it was abandoned part-way."""
    out = []
    for sentence in sentences(text):
        a = make_sentence(sentence, still_wanted)
        if a is None:
            return None
        out.append(a)
    return np.concatenate(out)


def pcm16(a: np.ndarray) -> bytes:
    return (np.clip(a, -1, 1) * 32767).astype("<i2").tobytes()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/health":
            self._send(200, json.dumps({"status": "ok", "model": MODEL, "voice": "child"}).encode(), "application/json")
        else:
            self._send(404, b"", "text/plain")

    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        except Exception:
            return self._send(400, b"bad json", "text/plain")
        text = " ".join(str(body.get("text", "")).split())[:400]
        if not text:
            return self._send(400, b"empty", "text/plain")
        if self.path == "/stream":
            return self._stream(text)
        if self.path == "/tts":
            # Preparing ahead is the lowest priority: it gives way to any live line.
            mine = latest
            audio = make(text, lambda: latest == mine)
            if audio is None:
                return self._send(409, b"superseded", "text/plain")
            buf = io.BytesIO()
            sf.write(buf, audio, RATE, format="WAV", subtype="PCM_16")
            return self._send(200, buf.getvalue(), "audio/wav")
        self._send(404, b"", "text/plain")

    def _stream(self, text: str):
        global latest, live
        with latest_lock:
            latest += 1
            live += 1
            mine = latest
        gone = False

        def still_wanted():
            return not gone and latest == mine

        try:
            self.send_response(200)
            self.send_header("content-type", "audio/L16; rate=24000; channels=1")
            self.send_header("transfer-encoding", "chunked")
            self.end_headers()
            for sentence in sentences(text):
                if not still_wanted():
                    break
                audio = cached(sentence)
                if audio is not None:
                    self._chunk(pcm16(audio))
                    continue
                parts = []
                gen = chunks(sentence, still_wanted)
                try:
                    for c in gen:
                        parts.append(c)
                        self._chunk(pcm16(c))
                finally:
                    gen.close()  # a listener that hung up must not keep the model busy
                whole = np.concatenate(parts) if parts else np.zeros(1, np.float32)
                if parts and still_wanted() and plausible(whole, sentence):
                    np.save(key(sentence), whole)
            self._chunk(b"")
        except (BrokenPipeError, ConnectionResetError):
            # The app stopped listening (a newer line, or the page moved on). Just stop.
            gone = True
        finally:
            with latest_lock:
                live -= 1

    def _chunk(self, data: bytes):
        self.wfile.write(f"{len(data):X}\r\n".encode() + data + b"\r\n")
        self.wfile.flush()

    def _send(self, code, data, ctype):
        try:
            self.send_response(code)
            self.send_header("content-type", ctype)
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass


def warm_fixed_lines():
    import time
    for line in FIXED:
        # Background work: step aside whenever the child is hearing a live line.
        while make(line, lambda: live == 0) is None:
            time.sleep(2)


if __name__ == "__main__":
    make("Hello.")  # warm up the model before the first real line
    threading.Thread(target=warm_fixed_lines, daemon=True).start()
    print(f"Qwen3-TTS voice server (child voice, streaming) on http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
