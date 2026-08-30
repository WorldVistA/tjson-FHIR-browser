#!/usr/bin/env bash
# Static contract checks for tjson-FHIR-browser (no headless browser required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
pass() { echo "  PASS  $1"; }
bad()  { echo "  FAIL  $1" >&2; fail=1; }

echo "==> smoke-browser ($ROOT)"

[[ -f web/index.html ]] && pass "web/index.html" || bad "missing web/index.html"
[[ -f web/app.js ]] && pass "web/app.js" || bad "missing web/app.js"
[[ -f web/style.css ]] && pass "web/style.css" || bad "missing web/style.css"
[[ -f web/tjson-highlight.js ]] && pass "web/tjson-highlight.js" || bad "missing tjson-highlight.js"
[[ -f vendor/tjson/web/index.js ]] && pass "vendor/tjson/web/index.js" || bad "missing vendored tjson"
[[ -f vendor/tjson/VERSION ]] && pass "vendor/tjson/VERSION" || bad "missing VERSION"
[[ -f vendor/tjson-highlight/tjson.tmLanguage.json ]] && pass "vendor/tjson-highlight grammar" || bad "missing tjson.tmLanguage.json"
[[ -f vendor/tjson-highlight/scope-classes.json ]] && pass "vendor/tjson-highlight scopes" || bad "missing scope-classes.json"
[[ -f vendor/tjson-highlight/onig.wasm ]] && pass "vendor/tjson-highlight onig.wasm" || bad "missing onig.wasm"
[[ -f examples/sample-bundle.json ]] && pass "examples/sample-bundle.json" || bad "missing example"

VER="$(tr -d '[:space:]' < vendor/tjson/VERSION)"
if grep -q "const TJSON_VERSION = \"$VER\"" web/app.js; then
  pass "app.js TJSON_VERSION matches vendor ($VER)"
else
  bad "app.js TJSON_VERSION does not match vendor/tjson/VERSION ($VER)"
fi

grep -q "fromJson" web/app.js && pass "app.js uses fromJson" || bad "app.js missing fromJson"
grep -q "highlightTjson\|tjson-highlight.js" web/app.js && pass "app.js loads client TJSON highlight" || bad "app.js missing highlight import"
grep -q "tjson-hl" web/style.css && pass "style.css has tjson-hl palette" || bad "style.css missing tjson-hl"
grep -q 'chkTjsonHl:not(:checked)' web/style.css && pass "style.css highlight-off via CSS" || bad "missing highlight-off CSS"
grep -q 'id="chkTjsonHl"' web/index.html && pass "highlight checkbox in index" || bad "missing chkTjsonHl"
grep -q "btnLoadUrl" web/index.html && pass "URL loader control" || bad "missing URL loader"
grep -q "fileInput" web/index.html && pass "file loader control" || bad "missing file loader"
grep -q "pasteInput" web/index.html && pass "paste loader control" || bad "missing paste loader"
grep -q "Load example" web/index.html && pass "example button" || bad "missing example button"

python3 - <<'PY' || fail=1
import json
from pathlib import Path
b = json.loads(Path("examples/sample-bundle.json").read_text())
assert b.get("resourceType") == "Bundle", b.get("resourceType")
assert isinstance(b.get("entry"), list) and len(b["entry"]) >= 1
types = {e["resource"]["resourceType"] for e in b["entry"]}
assert "Patient" in types and "Observation" in types
print("  PASS  example Bundle parses with Patient+Observation")
PY

# Live HTTP smoke: serve briefly and fetch key assets
PORT=18765
python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/tjson-fhir-browser-smoke.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT
sleep 0.4
for path in \
  "/web/index.html" \
  "/web/app.js" \
  "/web/style.css" \
  "/vendor/tjson/web/index.js" \
  "/examples/sample-bundle.json"
do
  code=$(curl -sS -o /tmp/tjson-smoke.body -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT$path" || echo 000)
  if [[ "$code" == "200" ]]; then
    pass "HTTP 200 $path"
  else
    bad "HTTP $code $path"
  fi
done

IDX_BYTES=$(wc -c < vendor/tjson/web/index.js | tr -d ' ')
if [[ "${IDX_BYTES:-0}" -gt 1000 ]] && grep -q "fromJson\|stringify\|tjson" vendor/tjson/web/index.js; then
  pass "vendored index.js non-empty ($IDX_BYTES bytes)"
else
  bad "vendored index.js empty/unreadable"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "SMOKE FAIL" >&2
  exit 1
fi
echo "SMOKE OK: tjson-FHIR-browser"
