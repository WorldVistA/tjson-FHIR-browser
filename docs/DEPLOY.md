# Deploy to a server (cds1-style)

This app is a **static site**. Production hosting is: copy assembled files to a host and serve them under a URL prefix (on cds1: `/browse`).

## Scripts

| Script | Purpose |
|--------|---------|
| `./scripts/serve.sh [port]` | Local HTTP from repo root (`/web/`, `/vendor/`, `/examples/`) |
| `./scripts/smoke-browser.sh` | Contract checks before deploy |
| `./scripts/deploy-cds1.sh [user@host]` | Assemble site, rsync, wire Caddy `/browse`, smoke HTTPS |
| `./scripts/update-vendored-tjson.sh <ver>` | Bump engine before a release (optional) |

## Prerequisites

On your laptop (or CI agent):

- `bash`, `rsync`, `ssh`, `curl`, `python3`, `sed`
- SSH key access to the target as a user that can write the site dir and run Docker Compose (on cds1: `root@cds1.vistaplex.org`)

On the server (cds1 pattern):

- Docker Compose stack with a **Caddy** reverse proxy
- Compose file that already has a volume line like  
  `- ./Caddyfile:/etc/caddy/Caddyfile:ro`  
  (the deploy script inserts the `/srv/browse` mount next to that line)
- A Caddy site block that ends with a recognizable catch-all, e.g.  
  `respond "cds-hooks-on-fhir stage-2" 200`  
  (the script inserts `/browse` handlers immediately before that line)

If your Caddyfile or compose layout differs, do the first-time Caddy wiring by hand (see [Manual first-time setup](#manual-first-time-setup-any-similar-host)), then keep using rsync for content updates.

## What `deploy-cds1.sh` does

1. **Assemble** a Pages-style tree in a temp dir:
   - copies `web/*` to the site root
   - copies `vendor/`, `examples/`, `docs/`, plus README/LICENSE/AGENTS
   - rewrites `../vendor` → `./vendor` and `../examples` → `./examples` in `app.js`
   - rewrites `../vendor/tjson-highlight/` → `./vendor/tjson-highlight/` in `tjson-highlight.js`
   - rewrites doc links in `index.html` to `./docs/…`
2. **rsync** that tree to `/opt/tjson-FHIR-browser/site` on the host (`--delete`).
3. **Idempotent Caddy wiring** (first run only):
   - insert `/browse` → `/browse/` redirect and `handle_path /browse/*` → `file_server` under `/srv/browse`
   - bind-mount the site dir into the `caddy` service as `/srv/browse:ro`
   - `docker compose up -d caddy` and `caddy reload`
4. **Smoke** HTTPS paths on `https://cds1.vistaplex.org/browse/…` (index, `app.js`, `tjson-highlight.js`, vendored tjson + highlight grammar/wasm, example Bundle).

Local `web/` keeps `../vendor` paths for `./scripts/serve.sh`. Only the assembled deploy tree uses `./vendor`.

## Deploy to cds1 (default)

```bash
cd tjson-FHIR-browser
./scripts/smoke-browser.sh          # optional but recommended
./scripts/deploy-cds1.sh            # defaults to root@cds1.vistaplex.org
```

Live URLs after a successful run:

- https://cds1.vistaplex.org/browse/
- https://cds1.vistaplex.org/browse/?example=1

Override the SSH target:

```bash
./scripts/deploy-cds1.sh root@other-host.example.org
```

Note: the script’s **smoke URLs stay on `cds1.vistaplex.org`**. For another hostname, either edit the smoke block at the bottom of `scripts/deploy-cds1.sh`, or rsync + smoke manually after the first Caddy setup.

## Redeploy after UI or tjson changes

```bash
# optional: bump engine
./scripts/update-vendored-tjson.sh 0.8.0
./scripts/smoke-browser.sh

# content + Caddy (no-op if already wired)
./scripts/deploy-cds1.sh
```

Rsync always refreshes files. Caddyfile / compose edits run only when `/browse` is missing.

## Manual first-time setup (any similar host)

Use this when the auto-edit needles do not match your compose/Caddy layout.

### 1. Assemble and copy files

```bash
./scripts/deploy-cds1.sh user@host   # fails at Caddy edit? stop after rsync, or:
```

Or assemble locally the same way the script does, then:

```bash
rsync -az --delete /path/to/assembled/ user@host:/opt/tjson-FHIR-browser/site/
```

### 2. Mount into Caddy

In the compose file for the Caddy service:

```yaml
volumes:
  - ./Caddyfile:/etc/caddy/Caddyfile:ro
  - /opt/tjson-FHIR-browser/site:/srv/browse:ro
```

### 3. Serve under `/browse`

Inside the site block for your hostname:

```caddy
handle /browse {
    redir * /browse/ permanent
}
handle_path /browse/* {
    root * /srv/browse
    file_server
}
```

Place these **before** any catch-all `respond` / reverse_proxy default.

Reload:

```bash
cd /path/to/compose
docker compose up -d caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
```

### 4. Verify

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR_HOST/browse/
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR_HOST/browse/app.js
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR_HOST/browse/vendor/tjson/web/index.js
curl -sS -o /dev/null -w '%{http_code}\n' https://YOUR_HOST/browse/examples/sample-bundle.json
# expect 200; app.js must import ./vendor/tjson/… not ../vendor
curl -sS https://YOUR_HOST/browse/app.js | grep './vendor/tjson/web/index.js'
```

Also confirm existing APIs still work (on cds1: `/healthz`, `/analyze`, `/quality/…`).

## nginx alternative (no Caddy)

If the edge proxy is nginx instead of Caddy:

```nginx
location = /browse { return 301 /browse/; }
location /browse/ {
    alias /opt/tjson-FHIR-browser/site/;
    try_files $uri $uri/ =404;
}
```

Keep the same assembled tree (site-root `index.html` + `./vendor` + `./examples`). You can still use the assemble/rsync half of `deploy-cds1.sh` and skip the Caddy auto-edit.

## Layout on disk (cds1)

| Host path | Role |
|-----------|------|
| `/opt/tjson-FHIR-browser/site/` | Assembled static files |
| `/opt/cds-hooks-on-fhir/stage-2/Caddyfile` | Edge routes including `/browse` |
| `/opt/cds-hooks-on-fhir/stage-2/docker-compose.yml` | Mounts site → `/srv/browse` in `caddy` |

Backups: on first wiring the script writes timestamped `*.bak-*` next to Caddyfile and compose.

## GitHub Pages vs cds1

| | GitHub Pages | cds1 `/browse` |
|--|--------------|----------------|
| Trigger | `.github/workflows/pages.yml` on `main` | `./scripts/deploy-cds1.sh` |
| URL | `https://worldvista.github.io/tjson-FHIR-browser/` | `https://cds1.vistaplex.org/browse/` |
| Path rewrite | Workflow `sed` into `_site/` | Same rewrites in deploy script |
| Auth | Public | Public HTTPS via Caddy |

Both need **site-root** asset paths (`./vendor`, `./examples`). Local `./scripts/serve.sh` keeps repo-relative `../vendor` under `/web/`.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Caddyfile: cannot insert /browse` | Catch-all line differs; insert handlers manually |
| `unexpected docker-compose volumes` | Caddy volume stanza differs; add `/srv/browse` mount by hand |
| 404 on `/browse/vendor/…` | Mount missing or rsync to wrong dir; check `/srv/browse` inside the container |
| Blank page / failed TJSON import | Deployed `app.js` still has `../vendor` (assemble step skipped) |
| CORS errors on Load URL | Unrelated to static hosting; use file/paste or a CORS-open FHIR server |

## Agent / CI note

For LLM agents: after UI or vendored-tjson changes, run `./scripts/smoke-browser.sh`, then `./scripts/deploy-cds1.sh`, and require all smoke lines to print `200` / `DEPLOY OK`. Do not hand-edit files under `/opt/tjson-FHIR-browser/site` on the server—redeploy from git.
