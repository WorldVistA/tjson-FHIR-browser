Vendored from https://github.com/rfanth/tjson-highlight for client-side web highlighting.

Version: 0.3.0 (tag v0.3.0)

- tjson.tmLanguage.json — TextMate grammar
- scope-classes.json — scope → CSS class map (docs/scope-classes.json)
- onig.wasm — from vscode-oniguruma@2.0.1

Tokenizer JS loads lazily from esm.sh (vscode-textmate@9, vscode-oniguruma@2).
See upstream docs/web-highlighting.md.

0.3.0 notes for integrators:
- New CSS class: tjson-invalid (invalid.* scopes)
- classFor must return null on unstyled scopes (stop walk), not continue past them
