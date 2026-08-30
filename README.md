# tjson FHIR Browser

Static, open-source FHIR Bundle browser that renders resources as **[TJSON](https://github.com/rfanth/tjson)** (default) or JSON.

Inspired by / extracted from the C0FHIR TJSON browser in [WorldVistA Codex](https://github.com/WorldVistA/VistA-FHIR-Server-Codex). The TJSON engine is [`@rfanth/tjson`](https://www.npmjs.com/package/@rfanth/tjson) (Apache-2.0), vendored under `vendor/tjson/`.

This repository is a **standalone Connectathon showcase**. It does not ship VistA/%wd tooling and is not a fork dump of the maintainer `tjson-tools` tree.

## 60-second try

```bash
git clone https://github.com/WorldVistA/tjson-FHIR-browser.git
cd tjson-FHIR-browser
./scripts/serve.sh
# open http://127.0.0.1:8765/web/?example=1
```

Or open the GitHub Pages build (after deploy):  
`https://worldvista.github.io/tjson-FHIR-browser/`

Load a Bundle three ways:

1. **URL** — FHIR Bundle or `$everything` endpoint (CORS must allow the browser)
2. **File** — upload a `.json` Bundle
3. **Paste** — paste JSON into the textarea

A single resource is wrapped as a one-entry Bundle automatically.

## Features

- Left list: search, resource-type filter, DiagnosticReport nesting
- Right pane: **TJSON** (default, syntax-highlighted) / **JSON** toggle
- DocumentReference / DiagnosticReport `text/plain` base64 decoded for readable TJSON (`prepareForTjson`)
- Dark / light theme
- Agent-friendly upgrade path: `./scripts/update-vendored-tjson.sh <version>`

## Docs

| Doc | Audience |
|-----|----------|
| [User guide](docs/USER_GUIDE.md) | Clinicians / FHIR developers using the UI |
| [Technical manual](docs/TECHNICAL_MANUAL.md) | Maintainers: architecture, WASM, vendoring |
| [Deploy (cds1 / Caddy)](docs/DEPLOY.md) | Host under `/browse` with `deploy-cds1.sh` |
| [AGENTS.md](AGENTS.md) | LLM agents + humans: bump tjson / change UI |
| [Connectathon draft](docs/CONNECTATHON.md) | September demo script + session proposal (draft) |

**Hosted demo (cds1):** https://cds1.vistaplex.org/browse/?example=1 — see [docs/DEPLOY.md](docs/DEPLOY.md).

## License

Apache License 2.0 — see [LICENSE](LICENSE).

`@rfanth/tjson` remains Apache-2.0 under its own copyright.

## Credits

- TJSON engine: [@rfanth/tjson](https://github.com/rfanth/tjson) / [npm](https://www.npmjs.com/package/@rfanth/tjson)
- Browser UX extracted from WorldVistA C0FHIR (`C0FHIRWS` BROWSER)
- Sample Bundle is synthetic (no real PHI)
