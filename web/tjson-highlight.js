/**
 * Client-side TJSON highlighting (TextMate + oniguruma), per
 * https://github.com/rfanth/tjson-highlight/blob/master/docs/web-highlighting.md
 *
 * Grammar + scope map + onig.wasm: ../vendor/tjson-highlight/
 * vscode-textmate / vscode-oniguruma: lazy from esm.sh (only when highlighting).
 */

import scopeMap from "../vendor/tjson-highlight/scope-classes.json" with { type: "json" };

const GRAMMAR_URL = new URL("../vendor/tjson-highlight/tjson.tmLanguage.json", import.meta.url).href;
const ONIG_WASM_URL = new URL("../vendor/tjson-highlight/onig.wasm", import.meta.url).href;

const TEXTMATE_URL = "https://esm.sh/vscode-textmate@9.0.0";
const ONIGURUMA_URL = "https://esm.sh/vscode-oniguruma@2.0.1";

const mapping = {
  classes: scopeMap.classes,
  unstyled: scopeMap.unstyled?.prefixes || ["meta", "punctuation.whitespace.indent"],
};

let engine = null;

const isScope = (scope, prefix) => scope === prefix || scope.startsWith(prefix + ".");

function classFor(scopes, map) {
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (map.unstyled.some((p) => isScope(scopes[i], p))) continue;
    for (const [prefix, cls] of map.classes) {
      if (isScope(scopes[i], prefix)) return cls;
    }
  }
  return null;
}

/** esm.sh wraps CJS textmate as { default: { Registry, ... } }. */
function unwrapTm(mod) {
  const tm = mod?.default ?? mod;
  if (typeof tm?.Registry !== "function") {
    throw new Error("vscode-textmate: Registry missing after import");
  }
  return tm;
}

function loadEngine() {
  if (engine) return engine;
  engine = (async () => {
    const [oniguruma, textmateMod] = await Promise.all([
      import(/* webpackIgnore: true */ ONIGURUMA_URL),
      import(/* webpackIgnore: true */ TEXTMATE_URL),
    ]);
    const textmate = unwrapTm(textmateMod);
    await oniguruma.loadWASM(await (await fetch(ONIG_WASM_URL)).arrayBuffer());

    const registry = new textmate.Registry({
      onigLib: Promise.resolve({
        createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
        createOnigString: (str) => new oniguruma.OnigString(str),
      }),
      loadGrammar: async (scopeName) =>
        scopeName === "source.tjson"
          ? textmate.parseRawGrammar(
              await (await fetch(GRAMMAR_URL)).text(),
              "tjson.tmLanguage.json"
            )
          : null,
    });

    return { textmate, grammar: await registry.loadGrammar("source.tjson") };
  })();
  return engine;
}

const escapeHtml = (s) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

/**
 * @param {string} tjson
 * @returns {Promise<string>} HTML fragment (spans), no outer <pre>
 */
export async function highlightTjson(tjson) {
  const { textmate, grammar } = await loadEngine();

  const eol = tjson.includes("\r\n") ? "\r\n" : "\n";
  let stack = textmate.INITIAL;
  const out = [];

  for (const line of tjson.split(eol)) {
    const { tokens, ruleStack } = grammar.tokenizeLine(line, stack);
    stack = ruleStack;

    let html = "";
    let runClass = null;
    let run = "";
    const flush = () => {
      if (!run) return;
      html += runClass
        ? `<span class="${runClass}">${escapeHtml(run)}</span>`
        : escapeHtml(run);
    };

    for (const token of tokens) {
      const text = line.slice(token.startIndex, token.endIndex);
      const cls = classFor(token.scopes, mapping);
      if (cls === runClass) {
        run += text;
        continue;
      }
      flush();
      runClass = cls;
      run = text;
    }
    flush();
    out.push(html);
  }

  return out.join("\n");
}
