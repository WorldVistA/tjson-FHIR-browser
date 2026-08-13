# User guide — tjson FHIR Browser

## What you see

- **Header**: title, theme toggle, and a **folder+** icon that opens/closes the Load Bundle dialog (URL, file, paste, example). After a successful load the dialog closes so the list and detail panes fill the window. Errors reopen it.
- **Left**: list of resources in the Bundle. Search box + type filter.
- **Right**: selected resource as **TJSON** (default) or **JSON**.

TJSON is a typed, human-readable encoding of JSON (and FHIR) that keeps types and structure clear. Toggle to JSON anytime to compare.

## Load methods

### URL

1. Paste a URL that returns FHIR JSON (`Bundle`, or a single resource).
2. Click **Load URL**.

The browser uses `fetch()`. The FHIR server must send CORS headers that allow your origin (GitHub Pages or `http://127.0.0.1:…`). If the server blocks CORS, you will see a clear error — use **file** or **paste** instead. There is no backend proxy in this app.

Good candidates: public sandbox FHIR servers, or a Bundle you host with open CORS.

### File

Choose a `.json` / FHIR JSON file. It is read entirely in the browser (never uploaded to a server).

### Paste

Paste Bundle (or resource) JSON into the textarea and click **Load paste**.

### Example

**Load example** (or open `web/?example=1`) loads `examples/sample-bundle.json` — a small synthetic Bundle (Patient, Encounter, Observation, DiagnosticReport, DocumentReference). No real PHI.

## Search and filter

- **Search text**: substring match on the resource summary line (type, id, name/code text).
- **Type filter**: restrict the list to one FHIR resource type (`all` shows everything).
- **DiagnosticReport nesting**: related Observations listed under a DiagnosticReport when references resolve inside the Bundle.

## TJSON vs JSON

| Mode | Use when |
|------|----------|
| **TJSON** | Reading structure, types, and note text (default) |
| **JSON** | Copying into another tool, comparing wire format |

For DocumentReference / DiagnosticReport attachments with `contentType` `text/plain` and base64 `data`, the browser decodes the text before TJSON so notes are readable.

## Large bundles

Very large Bundles (tens of thousands of entries) may make the list slow to filter. Prefer a focused Bundle or `$everything` slice when possible. Rendering one selected resource as TJSON is usually fine even when the list is large.

## Themes

Use **Theme** in the header to toggle light / dark.

## Privacy

All parsing and TJSON conversion run in your browser. Nothing is sent to WorldVistA or GitHub except what your browser already loads as static assets (HTML/JS/WASM). Do not paste real PHI into public demos unless your policy allows it.
