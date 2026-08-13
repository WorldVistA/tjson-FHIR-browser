# Technical manual — tjson FHIR Browser

## Architecture

```
sources (URL / file / paste / example)
        → JSON.parse
        → normalize to Bundle
        → resource list (search / type / DR nesting)
        → detail pane
             ↑
        @rfanth/tjson web WASM (vendored)
```

Static SPA only. No Node server, no FHIR proxy, no Mumps.

| Path | Role |
|------|------|
| `web/index.html` | Shell + load controls |
| `web/app.js` | Loaders, list, detail, TJSON/JSON toggle |
| `web/style.css` | Layout / themes |
| `vendor/tjson/web/` | `@rfanth/tjson` browser entry (wasm inlined) |
| `examples/` | Public sample Bundle |
| `scripts/` | Vendor update, serve, smoke |

## Why vendor

Browsers need a stable relative URL for ES modules + wasm. Vendoring `@rfanth/tjson`’s `web/` entry avoids npm CDN drift and keeps GitHub Pages self-contained. Upgrade only via:

```bash
./scripts/update-vendored-tjson.sh <version>
```

That script:

1. `npm pack @rfanth/tjson@<version>`
2. Copies `web/index.js`, `web/tjson.js`, `web/snippets/`, d.ts files
3. Cache-busts internal `./tjson.js` imports with `?v=<version>`
4. Writes `vendor/tjson/VERSION` and README
5. Rewrites `const TJSON_VERSION = "…"` in `web/app.js`

**Do not hand-edit** files under `vendor/tjson/web/` except through the script.

## WASM entry: `fromJson` vs `stringify`

`web/app.js` imports:

```js
import(…/vendor/tjson/web/index.js?v=${TJSON_VERSION})
```

Then prefers `fromJson(jsonString, {})` when present, else falls back to `stringify`. That matches `@rfanth/tjson` ≥ 0.6.5 web API. JSON mode uses `JSON.stringify` only.

## Cache-busting

Two layers:

1. App loads `index.js?v=<VERSION>` so a version bump forces a new module graph.
2. Vendored `index.js` imports `./tjson.js?v=<VERSION>` so stale wasm glue cannot pair with a new index.

`TJSON_VERSION` in `app.js` must match `vendor/tjson/VERSION` (enforced by `scripts/smoke-browser.sh`).

## CORS

URL load is browser `fetch`. Failures are shown in the load panel. Workarounds (documented, not implemented): public CORS-open FHIR, local file, paste. No proxy in this repo.

## Deploy (GitHub Pages)

Workflow `.github/workflows/pages.yml` uploads a static artifact containing `web/`, `vendor/`, `examples/`, and copies of root docs so relative links work. Site root is the artifact root (app at `/`).

Local:

```bash
./scripts/serve.sh 8765
# http://127.0.0.1:8765/web/
```

Repo root must be the HTTP root so `../vendor` and `../examples` resolve from `web/`.

## Deploy (cds1 / Caddy `/browse`)

Use `./scripts/deploy-cds1.sh` to assemble the same site-root tree, rsync to the host, and wire Caddy `handle_path /browse/*`. Full steps, nginx alternative, and troubleshooting: **[DEPLOY.md](DEPLOY.md)**.

## Relation to Codex

WorldVistA Codex keeps its own `vendor/tjson/` and `C0FHIRWS` `BROWSER` for `/fhir?view=browser`. This repo does not rewire that path. Shared ideas only: list UX, TJSON default, `prepareForTjson`.

## Out of scope

- npm package publish
- CORS proxy
- Embedding into VistA/Codex via iframe (future optional)
