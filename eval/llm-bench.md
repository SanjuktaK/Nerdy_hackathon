# On-device inference benchmark

Qwen2.5-1.5B-Instruct, quantized on this machine with MLX (`npm run llm:quantize`),
measured on the app's real stem-generation prompts (7 tasks, 5 stems each,
greedy decoding, fastest of 3 runs per prompt). "Stems accepted" is the app's own validator (`lib/ai/validate.ts`).

Machine: Apple M4, 16 GB · regenerate with `npm run llm:bench`

| Rung | Weights | Peak RAM | Load | TTFT p50 | Decode tok/s | Request p50 | Speed-up | Valid JSON | Stems accepted |
|---|---|---|---|---|---|---|---|---|---|
| bf16 | 3.09 GB | 3.40 GB | 1.6 s | 897 ms | 25.0 | 5.97 s | 1.00× | 7/7 | 30/35 (86%) |
| 8bit | 1.64 GB | 2.18 GB | 1.1 s | 1943 ms | 36.3 | 5.43 s | 1.10× | 7/7 | 33/35 (94%) |
| 4bit | 0.87 GB | 1.52 GB | 0.8 s | 2053 ms | 65.0 | 3.91 s | 1.53× | 7/7 | 27/35 (77%) |
| 4bit+prefix | 0.87 GB | 1.50 GB | 0.9 s | 864 ms | 58.0 | 2.93 s | 2.04× | 7/7 | 27/35 (77%) |
| 4bit+spec | 0.87 GB | 1.77 GB | 1.4 s | 2602 ms | 55.7 | 4.86 s | 1.23× | 7/7 | 26/35 (74%) |

- **Prefix cache**: the 388 tokens every request shares (system prompt + chat template) are prefilled once in 1439 ms, then the KV cache is trimmed back to that point after each request.
- **4bit+prefix** matches plain 4-bit token-for-token on 3/7 prompts. The rest differ because a different computation order shifts float rounding, which flips near-tied tokens in a 4-bit model; compare the accept rates, not the text.
- **4bit+spec** matches plain 4-bit token-for-token on 2/7 prompts. The rest differ because a different computation order shifts float rounding, which flips near-tied tokens in a 4-bit model; compare the accept rates, not the text.
