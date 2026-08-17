#!/usr/bin/env bash
# Vendor @rfanth/tjson web/ entry (inlined wasm) into vendor/tjson/web/.
# Also rewrites TJSON_VERSION in web/app.js for cache-busting.
#
# Usage: ./scripts/update-vendored-tjson.sh 0.8.0
#        ./scripts/update-vendored-tjson.sh @rfanth/tjson@0.8.0
set -euo pipefail

usage() {
  echo "usage: $0 <npm-version-or-spec>" >&2
  echo "example: $0 0.8.0" >&2
  exit 1
}

SPEC="${1:-}"
[[ -n "$SPEC" ]] || usage

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V="$ROOT/vendor/tjson"
APP="$ROOT/web/app.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ "$SPEC" != @rfanth/tjson@* ]]; then
  SPEC="@rfanth/tjson@$SPEC"
fi

echo "==> npm pack $SPEC"
pushd "$TMP" >/dev/null
npm pack "$SPEC" >/dev/null
TARBALL="$(ls ./*.tgz)"
tar -xzf "$TARBALL"
popd >/dev/null

PKG="$TMP/package"
[[ -f "$PKG/web/index.js" && -f "$PKG/web/tjson.js" ]] || {
  echo "error: $SPEC tarball missing web/index.js or web/tjson.js (need >= 0.6.5)" >&2
  exit 1
}
[[ -d "$PKG/web/snippets" ]] || {
  echo "error: $SPEC tarball missing web/snippets/" >&2
  exit 1
}

VERSION="$(
python3 - <<'PY' "$PKG/package.json"
import json, pathlib, sys
print(json.loads(pathlib.Path(sys.argv[1]).read_text())["version"])
PY
)"

echo "==> vendor @rfanth/tjson $VERSION web/ into $V/web"
rm -rf "$V/web"
mkdir -p "$V/web"
cp "$PKG/web/index.js" "$V/web/index.js"
cp "$PKG/web/tjson.js" "$V/web/tjson.js"
# 0.10+ may ship sibling wasm for direct tjson.js imports; index.js still inlines wasm.
[[ -f "$PKG/web/tjson_bg.wasm" ]] && cp "$PKG/web/tjson_bg.wasm" "$V/web/tjson_bg.wasm"
[[ -f "$PKG/web/tjson_bg.wasm.d.ts" ]] && cp "$PKG/web/tjson_bg.wasm.d.ts" "$V/web/tjson_bg.wasm.d.ts"
# Cache-bust internal ./tjson.js imports so a new index.js cannot pair with a stale tjson.js
sed -i "s|from './tjson.js'|from './tjson.js?v=$VERSION'|g" "$V/web/index.js"
[[ -f "$PKG/web/index.d.ts" ]] && cp "$PKG/web/index.d.ts" "$V/web/index.d.ts"
[[ -f "$PKG/web/tjson.d.ts" ]] && cp "$PKG/web/tjson.d.ts" "$V/web/tjson.d.ts"
cp -a "$PKG/web/snippets" "$V/web/snippets"

printf '%s\n' "$VERSION" >"$V/VERSION"
cat >"$V/README.md" <<EOF
# Vendored @rfanth/tjson $VERSION

Browser entry: **\`web/index.js\`** (\`@rfanth/tjson/web\`) — wasm inlined as
base64; top-level await initializes on import. Also needs sibling
\`web/tjson.js\` and \`web/snippets/\`.

Loaded by \`web/app.js\` as \`../vendor/tjson/web/index.js?v=$VERSION\`.

Refresh: \`./scripts/update-vendored-tjson.sh $VERSION\`
EOF

echo "==> update TJSON_VERSION in web/app.js → $VERSION"
python3 - <<'PY' "$APP" "$VERSION"
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
version = sys.argv[2]
text = path.read_text()
text2, n = re.subn(
    r'const TJSON_VERSION\s*=\s*"[^"]*"',
    f'const TJSON_VERSION = "{version}"',
    text,
    count=1,
)
if n != 1:
    raise SystemExit("error: could not update TJSON_VERSION in web/app.js")
path.write_text(text2)
PY

echo "==> vendored tjson web/ updated to $VERSION"
echo "next: ./scripts/smoke-browser.sh"
