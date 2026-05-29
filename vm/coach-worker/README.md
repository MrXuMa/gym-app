# Coach worker (VM deploy)

Copy **the entire contents** of this folder (`vm/coach-worker/` from the repo) into `/opt/coach-stack/coach-api/` on your VM — not individual files into random paths. The directory on the VM must contain `Dockerfile`, `package.json`, and all `.js` files before you build.

```bash
# On the VM — verify before build (must list server.js + Dockerfile)
ls -la /opt/coach-stack/coach-api/

cd /opt/coach-stack
docker compose build coach-api --no-cache
docker compose up -d coach-api
docker compose logs -f coach-api
```

### `Cannot find module '/app/server.js'`

Node starts but `/app` has no `server.js`. Common causes:

1. **Volume mount hides the image** — if `docker-compose.yml` has `volumes: - ./coach-api:/app`, the **host** folder must contain `server.js`. An empty or partial host dir replaces the built image and causes this error. Either put all files in that host folder or remove the bind mount for production.
2. **Build context is wrong** — `build:` must point at the directory that contains `Dockerfile` and `server.js` (usually `./coach-api` under `/opt/coach-stack`).
3. **Partial copy** — copying only `server.js` into a parent directory while Compose builds from `./coach-api` leaves the build context without `server.js`.

Fix: sync the full `vm/coach-worker/` tree to `/opt/coach-stack/coach-api/`, confirm `ls` shows `server.js`, then `docker compose build coach-api --no-cache`.

## Layout

| Path | Purpose |
|------|---------|
| `server.js` | Thin entry: health routes + bootstrap + queue pollers |
| `config.js` | Central env (Ollama, Supabase, poll intervals) |
| `lib/` | `supabase.js`, `ollama.js`, `jobQueue.js`, `dates.js` |
| `context/` | Context rebuild: `merge.js`, `nutrition.js`, `snapshot.js`, `sessions.js`, … |
| `coach/` | Prompts: `prompt.js`, `adviceMode.js`, `knowledge.js`, `formatInstructions.js` |
| `jobs/` | `advice.js`, `template.js`, `contextSync.js` |
| `trainingSignals.js`, `trainingSplit.js` | Recovery + weekly split from sessions |
| `coachTemplate.js`, `coachCatalogCache.js` | Template JSON + catalog TTL cache |

Copy the **entire** `vm/coach-worker/` tree (including subfolders). `Dockerfile` uses `COPY . .`.

> Remove any legacy stray files on the VM (`loggedPerformance.js`, `weightTrend.js`, `exerciseCatalog.js`, `contextMerge.js`, `athleteSnapshot.js`, `contextHelpers.js`, `coachContextLimits.js`, `coachPromptPack.js`, `coachGeneralKnowledge.js`) before rebuilding — they were merged into `context/` and `coach/`.

## Env (docker-compose)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OLLAMA_HOST` (default `http://ollama:11434`)
- `MODEL_NAME` (default `llama3.1:8b`)
- `COACH_NUM_CTX` (default `8192`) — Ollama context window
- `COACH_NUM_PREDICT` (default `350`) — max tokens for **session-plan** advice (Focus + exercise list)
- `COACH_NUM_PREDICT_REASONING` (default `520`) — max tokens for **reasoning / education** answers (how many sets, optimal frequency, why, should I, etc.)
- `COACH_CATALOG_TTL_MS` (default `600000` = 10 min) — exercise catalog cache TTL. Lower for faster reflection of new exercises added via SQL; higher for less Supabase traffic.

## Context token budget (RTX 2060 Super 8GB, llama3.1:8b Q4)

| Setting | Value | Notes |
|---------|-------|-------|
| **num_ctx** | **8192** (default) | Safe on 8GB VRAM with Q4 8B. Lower to 6144 if OOM; avoid 16k+ on this GPU. |
| General knowledge | ~1.4–1.8k tokens | Fixed for every advice job |
| Athlete JSON + summaries | ~1.5–3.5k tokens | Grows with session history |
| Question + rules | ~0.3–0.5k tokens | |
| **Output (num_predict)** | **350** | Forces concise answers (~250 words max). Raise via `COACH_NUM_PREDICT` for full program outlines. |
| **Headroom** | ~2–3k tokens | KV cache + safety margin |

Ollama’s default `num_ctx` is often **2048**, which truncates long prompts and causes vague answers. This worker sets **8192** explicitly.

After deploy, logs show: `prompt budget ~NNNN tokens (general ~MMMM, num_ctx=8192)`.

If advice jobs fail with CUDA OOM, set `COACH_NUM_CTX=6144` in compose.

## Coach context storage

- **Source of truth:** `coach_context.context` JSON in Supabase (one row per user).
- **Rebuild:** context-sync queue → `context/merge.js` (bounded queries; limits in `context/limits.js`).
- **Advice jobs:** read context from Supabase, build prompt in memory, write response back to Supabase — no per-user JSON on the VM.
- **Legacy:** `COACH_DATA_DIR` / `/data/coach/users/*.json` removed; remove any bind mount that only existed for those files.

## Prompt layers

1. **General knowledge** — volume, recovery, RPE, exercise hierarchy, “what to train tomorrow” protocol
2. **Athlete context** — goals, sessions, `training_signals` (muscles ready vs avoid)
3. **Prior summaries** — long-term coach memory
