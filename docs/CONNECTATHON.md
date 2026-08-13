# Connectathon — tjson FHIR Browser (draft)

**Status:** draft for WorldVistA / September FHIR Connectathon planning.  
**Do not submit** to HL7 forms until a human explicitly asks.

## Pitch (one paragraph)

tjson FHIR Browser is a zero-install, open-source static app that loads a FHIR Bundle from URL, file, or paste and renders each resource as **TJSON** (typed JSON) or wire JSON. It showcases `@rfanth/tjson` WASM in the browser and an agent-friendly upgrade path (`./scripts/update-vendored-tjson.sh`) without requiring a VistA stack.

## Demo script (~10 minutes)

1. Open GitHub Pages (or local `./scripts/serve.sh`).
2. **Load example** — show Patient + nested DiagnosticReport + decoded DocumentReference note in TJSON.
3. Toggle **JSON** / **TJSON** on the same Observation.
4. **File** load a Synthea or site Bundle from disk.
5. Optional: **URL** load against a CORS-open sandbox (or explain paste workaround).
6. Show repo: `web/` vs `vendor/tjson/`, run or cite `smoke-browser.sh` and the agent jobs in `AGENTS.md`.

## Draft session proposal

**Title:** Browse FHIR Bundles as TJSON in the browser (WorldVistA open-source)

**Format:** 15–20 minute demo + Q&A  

**Audience:** FHIR implementers, EHR/open-source communities, Connectathon track participants interested in human-readable FHIR and WASM tooling.

**Abstract (draft):**  
We present tjson FHIR Browser, a static open-source app that loads FHIR Bundles via URL, file upload, or paste and renders resources using the `@rfanth/tjson` WebAssembly engine. Attendees will see TJSON vs JSON side by side, note decoding for DocumentReference text, and a maintainer workflow designed for AI-assisted dependency bumps. No server or EHR required to try it.

**Outline:**

| Minutes | Topic |
|--------:|-------|
| 0–3 | Problem: dense FHIR JSON; what TJSON adds |
| 3–10 | Live demo (example, toggle, file/paste) |
| 10–14 | Architecture: vendored WASM, no proxy, Pages |
| 14–18 | Agent-updatable contract (`AGENTS.md`) |
| 18–20 | Q&A / how to contribute |

**Links:**

- Repo: https://github.com/WorldVistA/tjson-FHIR-browser
- Pages: https://worldvista.github.io/tjson-FHIR-browser/
- Engine: https://www.npmjs.com/package/@rfanth/tjson

## What we will not claim

- Official HL7 endorsement
- Production PHI hosting
- Full Inferno or server certification via this UI alone
