# Agent working agreement — tjson-FHIR-browser

Principles: don’t assume; minimum code; touch only what you must; verify with smoke.

This repo is a **static FHIR Bundle browser**. It is not VistA, not `%wd`, not `tjson-tools`.

## Do not touch

- Hand-edit `vendor/tjson/web/*` (use the update script)
- Copy in `mumps/`, `incoming/`, VistA deploy scripts, or private ops notes
- Rewire WorldVistA Codex `/fhir?view=browser` from this repo
- Push Docker Hub images (N/A here)
- Submit Connectathon session forms unless a human explicitly asks

## Job 1 — Bump TJSON

**Goal:** `vendor/tjson/VERSION` matches the requested npm version; app cache-bust matches; smoke passes.

```bash
./scripts/update-vendored-tjson.sh <version>   # e.g. 0.8.0 or 0.9.0
./scripts/smoke-browser.sh
```

**Verify:**

1. `cat vendor/tjson/VERSION` equals `<version>`
2. `web/app.js` contains `const TJSON_VERSION = "<version>"`
3. `vendor/tjson/web/index.js` imports `./tjson.js?v=<version>`
4. Smoke prints `SMOKE OK`

**Commit message** (when asked to commit): name the version, e.g. `Bump vendored @rfanth/tjson to 0.9.0`.

## Job 2 — Change the browser UI

**Edit only:** `web/index.html`, `web/app.js`, `web/style.css`, `web/tjson-highlight.js`.

Optional: `examples/*`, docs under `docs/`, `README.md`, `vendor/tjson-highlight/` (grammar / scopes / onig.wasm from rfanth/tjson-highlight).

**Do not** change vendored tjson wasm except via Job 1.

```bash
./scripts/smoke-browser.sh
./scripts/serve.sh   # manual check: URL / file / paste / example
```

**Verify:**

1. Smoke OK
2. Example Bundle loads (`?example=1` or Load example)
3. TJSON and JSON toggles both render
4. Load error path still shows CORS / parse failures clearly

## Job 3 — Deploy to cds1 `/browse`

Only when a human asks to deploy.

```bash
./scripts/smoke-browser.sh
./scripts/deploy-cds1.sh
```

**Verify:** script prints `DEPLOY OK` and `https://cds1.vistaplex.org/browse/` returns 200. Details: [docs/DEPLOY.md](docs/DEPLOY.md). Do not hand-edit `/opt/tjson-FHIR-browser/site` on the server.

## Layout map

| Path | Owner |
|------|--------|
| `web/*` | UI agents |
| `vendor/tjson/` | update script only |
| `scripts/update-vendored-tjson.sh` | maintain carefully |
| `scripts/deploy-cds1.sh` | cds1 / similar Caddy hosts |
| `scripts/smoke-browser.sh` | extend when adding UI contracts |
| `docs/*`, `AGENTS.md` | keep in sync with behavior |

## Success criteria

- Anyone opens Pages or `./scripts/serve.sh`, loads a Bundle three ways, sees TJSON
- Only upgrade path for tjson is `./scripts/update-vendored-tjson.sh`
- Docs exist for humans and LLM agents
