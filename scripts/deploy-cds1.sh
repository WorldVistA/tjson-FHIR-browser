#!/usr/bin/env bash
# Assemble static site (Pages-style paths) and deploy to cds1 under /browse.
# Usage: ./scripts/deploy-cds1.sh [host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${1:-root@cds1.vistaplex.org}"
REMOTE_DIR="/opt/tjson-FHIR-browser/site"
STAGE2="/opt/cds-hooks-on-fhir/stage-2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> assemble site into $TMP"
mkdir -p "$TMP/vendor" "$TMP/examples" "$TMP/docs"
cp -a "$ROOT/web/." "$TMP/"
cp -a "$ROOT/vendor/." "$TMP/vendor/"
cp -a "$ROOT/examples/." "$TMP/examples/"
cp -a "$ROOT/docs/." "$TMP/docs/"
cp "$ROOT/README.md" "$ROOT/LICENSE" "$ROOT/AGENTS.md" "$TMP/" 2>/dev/null || true
sed -i 's|../vendor/tjson/|./vendor/tjson/|g' "$TMP/app.js"
sed -i 's|../examples/|./examples/|g' "$TMP/app.js"
sed -i 's|href="../docs/|href="./docs/|g' "$TMP/index.html"
sed -i 's|href="../README.md"|href="./README.md"|g' "$TMP/index.html"
test -f "$TMP/index.html"
test -f "$TMP/vendor/tjson/web/index.js"
test -f "$TMP/examples/sample-bundle.json"

echo "==> rsync → $HOST:$REMOTE_DIR"
ssh -o BatchMode=yes "$HOST" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete "$TMP/" "$HOST:$REMOTE_DIR/"

echo "==> ensure Caddy serves /browse and mounts site"
ssh -o BatchMode=yes "$HOST" bash -s -- "$REMOTE_DIR" "$STAGE2" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
STAGE2="$2"
CADDY="$STAGE2/Caddyfile"
COMPOSE="$STAGE2/docker-compose.yml"
STAMP="$(date +%Y%m%d%H%M%S)"

if ! grep -q 'handle_path /browse/\*' "$CADDY"; then
  cp -a "$CADDY" "$CADDY.bak-$STAMP"
  python3 - <<'PY' "$CADDY"
from pathlib import Path
import sys
path = Path(sys.argv[1])
text = path.read_text()
block = """
    # tjson FHIR Browser (static)
    handle /browse {
        redir * /browse/ permanent
    }
    handle_path /browse/* {
        root * /srv/browse
        file_server
    }

"""
needle = '    respond "cds-hooks-on-fhir stage-2" 200\n'
if needle not in text:
    raise SystemExit("error: unexpected Caddyfile; cannot insert /browse block")
if "handle_path /browse/*" in text:
    raise SystemExit("already configured")
path.write_text(text.replace(needle, block + needle, 1))
print("Caddyfile: inserted /browse handlers")
PY
else
  echo "Caddyfile: /browse already present"
fi

if ! grep -q '/srv/browse' "$COMPOSE"; then
  cp -a "$COMPOSE" "$COMPOSE.bak-$STAMP"
  python3 - <<'PY' "$COMPOSE" "$REMOTE_DIR"
from pathlib import Path
import sys
path = Path(sys.argv[1])
remote = sys.argv[2]
text = path.read_text()
old = "      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n"
new = (
    "      - ./Caddyfile:/etc/caddy/Caddyfile:ro\n"
    f"      - {remote}:/srv/browse:ro\n"
)
if old not in text:
    raise SystemExit("error: unexpected docker-compose volumes; cannot mount /srv/browse")
if "/srv/browse" in text:
    raise SystemExit("already mounted")
path.write_text(text.replace(old, new, 1))
print("docker-compose: mounted", remote, "→ /srv/browse")
PY
else
  echo "docker-compose: /srv/browse already mounted"
fi

cd "$STAGE2"
docker compose up -d caddy
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
echo "caddy reloaded"
REMOTE

echo "==> smoke https://cds1.vistaplex.org/browse/"
for path in \
  "/browse/" \
  "/browse/app.js" \
  "/browse/vendor/tjson/web/index.js" \
  "/browse/examples/sample-bundle.json"
do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://cds1.vistaplex.org$path" || echo 000)
  echo "  $code  $path"
  [[ "$code" == "200" ]] || { echo "FAIL: $path → $code" >&2; exit 1; }
done
# Confirm Pages-style relative vendor path on deployed app.js
curl -sS --max-time 20 "https://cds1.vistaplex.org/browse/app.js" | grep -q './vendor/tjson/web/index.js'
echo "DEPLOY OK: https://cds1.vistaplex.org/browse/?example=1"
