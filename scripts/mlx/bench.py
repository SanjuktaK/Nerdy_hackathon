"""
Inference benchmark for the on-device stem generator.

Runs the app's real prompts (.models/bench/prompts.json) through each rung:

  bf16          Qwen2.5-1.5B-Instruct as published, the baseline
  8bit          our 8-bit quantization
  4bit          our 4-bit quantization, the one we serve
  4bit+prefix   4-bit, with the shared system prompt prefilled into the KV
                cache once and trimmed back after every request
  4bit+spec     4-bit, speculative decoding with our 4-bit Qwen2.5-0.5B draft

Decoding is greedy so every rung sees the same task, and so speculative
decoding can be checked for identical output rather than assumed.

  npm run llm:bench
"""

import gc
import json
import os
import sys
import time
from pathlib import Path

import mlx.core as mx
from mlx_lm import load, stream_generate
from mlx_lm.models.cache import make_prompt_cache, trim_prompt_cache
from mlx_lm.sample_utils import make_sampler

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / ".models"
MAX_TOKENS = 400
# Each prompt runs this many times and the fastest run is kept, so a
# background process (Spotlight, swap) inflates nothing it happens to hit.
REPEATS = int(os.environ.get("BENCH_REPEATS", 3))


def bf16_path() -> Path:
    # Read the cache directly: snapshot_download(local_files_only=True)
    # rejects a snapshot fetched without its README, which is all we need.
    from huggingface_hub.constants import HF_HUB_CACHE

    snaps = Path(HF_HUB_CACHE) / "models--Qwen--Qwen2.5-1.5B-Instruct" / "snapshots"
    return next(p for p in snaps.iterdir() if (p / "model.safetensors").exists())


def dir_gb(p: Path) -> float:
    return sum(f.resolve().stat().st_size for f in p.glob("*.safetensors")) / 1e9


def token_ids(tokenizer, item) -> list[int]:
    messages = [
        {"role": "system", "content": item["system"]},
        {"role": "user", "content": item["user"]},
    ]
    return tokenizer.apply_chat_template(messages, add_generation_prompt=True)


def shared_prefix(seqs: list[list[int]]) -> int:
    n = min(len(s) for s in seqs)
    for i in range(n):
        if any(s[i] != seqs[0][i] for s in seqs):
            return i
    return n


def run_one(model, tokenizer, prompt, **kw):
    """Time one request. TTFT is the wait before the first token appears."""
    sampler = make_sampler(temp=0.0)
    start = time.perf_counter()
    ttft = None
    text = []
    last = None
    for r in stream_generate(
        model, tokenizer, prompt, max_tokens=MAX_TOKENS, sampler=sampler, **kw
    ):
        if ttft is None:
            ttft = time.perf_counter() - start
        text.append(r.text)
        last = r
    total = time.perf_counter() - start
    return {
        "ttftMs": round(ttft * 1000),
        "totalMs": round(total * 1000),
        "promptTokens": last.prompt_tokens,
        "genTokens": last.generation_tokens,
        "genTps": round(last.generation_tps, 1),
        "peakGb": round(last.peak_memory, 3),
        "text": "".join(text),
    }


def bench(name, path, prompts, mode="cold", draft_path=None):
    gc.collect()
    mx.clear_cache()
    mx.reset_peak_memory()

    t0 = time.perf_counter()
    model, tokenizer = load(str(path))
    draft = load(str(draft_path))[0] if draft_path else None
    load_s = time.perf_counter() - t0

    seqs = [token_ids(tokenizer, p) for p in prompts]
    kw = {"draft_model": draft, "num_draft_tokens": 3} if draft else {}

    # Warm-up: compile Metal kernels so the first measured request is fair.
    run_one(model, tokenizer, seqs[0], **kw)

    extra = {}
    if mode == "prefix":
        n = shared_prefix(seqs)
        cache = make_prompt_cache(model)
        t = time.perf_counter()
        model(mx.array(seqs[0][:n])[None], cache=cache)
        mx.eval([c.state for c in cache])
        extra = {"sharedPrefixTokens": n, "prefixPrefillMs": round((time.perf_counter() - t) * 1000)}

        def one(s):
            r = run_one(model, tokenizer, s[n:], prompt_cache=cache)
            r["promptTokens"] = len(s)
            trim_prompt_cache(cache, cache[0].offset - n)
            return r
    else:

        def one(s):
            return run_one(model, tokenizer, s, **kw)

    passes = [[one(s) for s in seqs] for _ in range(REPEATS)]
    rows = [min(runs, key=lambda r: r["totalMs"]) for runs in zip(*passes)]

    del model, draft
    return {
        "name": name,
        "mode": mode,
        "weightsGb": round(dir_gb(path), 3),
        "loadS": round(load_s, 2),
        "repeats": REPEATS,
        **extra,
        "rows": rows,
    }


def main():
    prompts = json.loads((MODELS / "bench" / "prompts.json").read_text())
    q4 = MODELS / "qwen2.5-1.5b-instruct-4bit"
    q8 = MODELS / "qwen2.5-1.5b-instruct-8bit"
    d4 = MODELS / "qwen2.5-0.5b-instruct-4bit"

    rungs = [
        ("bf16", bf16_path(), "cold", None),
        ("8bit", q8, "cold", None),
        ("4bit", q4, "cold", None),
        ("4bit+prefix", q4, "prefix", None),
        ("4bit+spec", q4, "cold", d4),
    ]
    only = set(sys.argv[1:])
    results = []
    for name, path, mode, draft in rungs:
        if only and name not in only:
            continue
        print(f"… {name}", file=sys.stderr, flush=True)
        results.append(bench(name, path, prompts, mode, draft))

    out = MODELS / "bench" / "results.json"
    out.write_text(json.dumps({"prompts": prompts, "results": results}, indent=2))
    print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
