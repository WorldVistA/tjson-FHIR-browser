/**
 * tjson FHIR Browser — standalone port of the WorldVistA C0FHIR browser
 * (C0FHIRWS.m BROWSER) with URL / file / paste loaders.
 *
 * Vendored engine: ../vendor/tjson/web/index.js (@rfanth/tjson).
 * Bump version via: ../scripts/update-vendored-tjson.sh <version>
 */

// Keep in sync with vendor/tjson/VERSION (update-vendored-tjson.sh rewrites this).
const TJSON_VERSION = "0.8.0";
const TJSON_PKG = new URL(
  `../vendor/tjson/web/index.js?v=${TJSON_VERSION}`,
  import.meta.url
).href;

const EXAMPLE_URL = new URL("../examples/sample-bundle.json", import.meta.url).href;

const st = {
  all: [],
  rows: [],
  tree: [],
  visible: [],
  pick: null,
  q: "",
  type: "all",
  fmt: "tjson",
  sourceLabel: "no bundle loaded",
};

try {
  const x = sessionStorage.getItem("tjsonFhirBrowserFmt");
  if (x === "json" || x === "tjson") st.fmt = x;
} catch (_) {
  /* ignore */
}

let tjsonMod = null;

async function ensureTjson() {
  if (tjsonMod) return tjsonMod;
  tjsonMod = await import(TJSON_PKG);
  return tjsonMod;
}

const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const rtype = (e) => ((e || {}).resource || {}).resourceType || "Unknown";
const rid = (e) => ((e || {}).resource || {}).id || "";
const ref = (e) => (e || {}).fullUrl || "";

function isLoadDialogOpen() {
  const d = el("loadDialog");
  return d && !d.hidden;
}

function setLoadDialogOpen(open) {
  const dialog = el("loadDialog");
  const backdrop = el("loadBackdrop");
  const toggle = el("btnLoadToggle");
  if (!dialog || !backdrop || !toggle) return;
  dialog.hidden = !open;
  backdrop.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.title = open ? "Close load dialog" : "Load Bundle";
  toggle.setAttribute("aria-label", open ? "Close load dialog" : "Load Bundle");
  if (open) {
    const url = el("urlInput");
    if (url) setTimeout(() => url.focus(), 0);
  }
}

function showLoadError(msg) {
  const n = el("loadError");
  if (!msg) {
    n.hidden = true;
    n.textContent = "";
    return;
  }
  n.hidden = false;
  n.textContent = msg;
  setLoadDialogOpen(true);
}

function isPlainTextMime(ct) {
  const s = String(ct || "").toLowerCase();
  return (
    s.indexOf("text/plain") === 0 ||
    s.indexOf("plain/text") === 0 ||
    s.indexOf("text/markdown") === 0
  );
}

function decodeBase64Utf8(b64) {
  try {
    const bin = atob(String(b64 || "").replace(/\s+/g, ""));
    if (typeof TextDecoder !== "function") return bin;
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch (_) {
    return null;
  }
}

function prepareForTjson(obj) {
  const r = obj || {};
  if (r.resourceType !== "DocumentReference" && r.resourceType !== "DiagnosticReport") {
    return r;
  }
  const out = JSON.parse(JSON.stringify(r));
  let changed = false;
  if (out.resourceType === "DiagnosticReport" && Array.isArray(out.presentedForm)) {
    out.presentedForm.forEach((a) => {
      if (!a || !isPlainTextMime(a.contentType) || !a.data) return;
      const txt = decodeBase64Utf8(a.data);
      if (txt === null) return;
      a.data = txt;
      changed = true;
    });
  }
  if (!Array.isArray(out.content)) return changed ? out : r;
  out.content.forEach((x) => {
    const a = (x || {}).attachment || null;
    if (!a || !isPlainTextMime(a.contentType) || !a.data) return;
    const txt = decodeBase64Utf8(a.data);
    if (txt === null) return;
    a.data = txt;
    changed = true;
  });
  return changed ? out : r;
}

function titleOf(e) {
  const r = (e || {}).resource || {};
  if (r.code && r.code.text) return r.code.text;
  if (r.name && r.name[0] && r.name[0].text) return r.name[0].text;
  if (typeof r.name === "string") return r.name;
  if (r.description) return r.description;
  return rtype(e) + " " + rid(e);
}

function reportKids(e, byRef) {
  const r = (e || {}).resource || {};
  if (rtype(e) !== "DiagnosticReport" || !Array.isArray(r.result)) return [];
  const out = [];
  const seen = new Set();
  r.result.forEach((x) => {
    const u = (x && x.reference) || "";
    if (!u || seen.has(u)) return;
    seen.add(u);
    if (byRef.has(u)) out.push(byRef.get(u));
  });
  return out;
}

function refillTypes() {
  const s = el("type");
  const set = new Set(st.all.map(rtype));
  s.innerHTML = "<option value='all'>All resource types</option>";
  Array.from(set)
    .sort()
    .forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      s.appendChild(o);
    });
  s.value = st.type;
}

function buildTree() {
  const byRef = new Map();
  st.all.forEach((e) => {
    const u = ref(e);
    if (u) byRef.set(u, e);
    const t = rtype(e);
    const id = rid(e);
    if (t && id) {
      byRef.set(t + "/" + id, e);
      byRef.set("urn:uuid:" + id, e);
    }
  });
  const childSet = new Set();
  st.rows.forEach((e) => {
    if (rtype(e) !== "DiagnosticReport") return;
    reportKids(e, byRef).forEach((c) => childSet.add(c));
  });
  st.tree = [];
  st.visible = [];
  st.rows.forEach((e) => {
    if (childSet.has(e)) return;
    if (rtype(e) === "DiagnosticReport") {
      const kids = reportKids(e, byRef);
      st.tree.push({ entry: e, children: kids });
      st.visible.push(e);
      kids.forEach((c) => st.visible.push(c));
      return;
    }
    st.tree.push({ entry: e, children: [] });
    st.visible.push(e);
  });
}

function apply() {
  const q = st.q.toLowerCase();
  st.rows = st.all.filter((e) => {
    const t = rtype(e);
    if (st.type !== "all" && t !== st.type) return false;
    if (!q) return true;
    return JSON.stringify((e || {}).resource || {})
      .toLowerCase()
      .includes(q);
  });
  buildTree();
  if (!st.visible.length) {
    st.pick = null;
    return;
  }
  if (st.pick && st.visible.indexOf(st.pick) > -1) return;
  st.pick = st.visible[0];
}

function itemHtml(e, i, isChild) {
  const a = st.pick === e ? " active" : "";
  const cls = isChild ? " child" : " parent";
  const tag = isChild ? rtype(e) + " in report" : rtype(e);
  return (
    "<div class='item" +
    cls +
    a +
    "' data-i='" +
    i +
    "'><div class='rt'>" +
    esc(tag) +
    "</div><div class='nm'>" +
    esc(titleOf(e)) +
    "</div><div class='id'>id: " +
    esc(rid(e)) +
    "</div></div>"
  );
}

function drawList() {
  const n = el("list");
  let h = "";
  const flat = [];
  st.tree.forEach((nod) => {
    h += itemHtml(nod.entry, flat.length, 0);
    flat.push(nod.entry);
    nod.children.forEach((ch) => {
      h += itemHtml(ch, flat.length, 1);
      flat.push(ch);
    });
  });
  if (!h) h = "<div class='item'>No resources match.</div>";
  n.innerHTML = h;
  n.querySelectorAll(".item[data-i]").forEach((x) => {
    x.onclick = () => {
      st.pick = flat[+x.dataset.i];
      draw();
    };
  });
}

function updateFmtButtons() {
  el("btnTjson").classList.toggle("active", st.fmt === "tjson");
  el("btnJson").classList.toggle("active", st.fmt === "json");
}

function setFmt(f) {
  st.fmt = f;
  try {
    sessionStorage.setItem("tjsonFhirBrowserFmt", f);
  } catch (_) {
    /* ignore */
  }
  updateFmtButtons();
  draw();
}

async function drawDetailAsync() {
  el("meta").textContent =
    st.sourceLabel +
    ": " +
    st.visible.length +
    " visible resources in " +
    st.tree.length +
    " top-level rows (" +
    st.all.length +
    " total)";
  if (!st.pick) {
    el("detail").textContent = st.all.length
      ? "Select a resource"
      : "Load a Bundle via URL, file, or paste";
    return;
  }
  const obj = (st.pick || {}).resource || {};
  if (st.fmt === "json") {
    el("detail").textContent = JSON.stringify(obj, null, 2);
    return;
  }
  el("detail").textContent = "Loading TJSON...";
  try {
    const m = await ensureTjson();
    const tobj = prepareForTjson(obj);
    const js = JSON.stringify(tobj);
    el("detail").textContent =
      typeof m.fromJson === "function" ? m.fromJson(js, {}) : m.stringify(js, {});
  } catch (err) {
    el("detail").textContent =
      "TJSON failed (check vendor/tjson/web; run scripts/update-vendored-tjson.sh; hard-refresh): " +
      String(err);
  }
}

function draw() {
  drawList();
  updateFmtButtons();
  drawDetailAsync();
}

/** Normalize Bundle | resource | Parameters-ish JSON into Bundle.entry[]. */
function toBundleEntries(j) {
  if (!j || typeof j !== "object") {
    throw new Error("JSON root must be an object");
  }
  if (j.resourceType === "Bundle") {
    if (!Array.isArray(j.entry)) {
      throw new Error("Bundle has no entry[] array");
    }
    return j.entry.filter((e) => e && e.resource && e.resource.resourceType);
  }
  if (j.resourceType) {
    return [
      {
        fullUrl: j.resourceType + "/" + (j.id || "1"),
        resource: j,
      },
    ];
  }
  throw new Error(
    "Expected FHIR Bundle or a single resource (resourceType required)"
  );
}

function ingestJson(j, sourceLabel) {
  const entries = toBundleEntries(j);
  st.all = entries;
  st.type = "all";
  st.pick = null;
  st.sourceLabel = sourceLabel || "loaded bundle";
  showLoadError("");
  refillTypes();
  apply();
  draw();
  setLoadDialogOpen(false);
}

async function loadFromUrl(url, label) {
  const u = String(url || "").trim();
  if (!u) throw new Error("URL is empty");
  showLoadError("");
  el("meta").textContent = "Fetching…";
  el("detail").textContent = "Loading " + u;
  let r;
  try {
    r = await fetch(u, { credentials: "omit" });
  } catch (err) {
    throw new Error(
      "Network/CORS failure fetching " +
        u +
        " — " +
        String(err) +
        ". If this is a cross-origin FHIR server, the host must send Access-Control-Allow-Origin, or use File / Paste instead."
    );
  }
  if (!r.ok) throw new Error("HTTP " + r.status + " loading " + u);
  const j = await r.json();
  ingestJson(j, label || u);
}

async function loadFromText(text, label) {
  let j;
  try {
    j = JSON.parse(text);
  } catch (err) {
    throw new Error("Invalid JSON: " + String(err));
  }
  ingestJson(j, label || "paste");
}

function wireLoadDialog() {
  const toggle = () => setLoadDialogOpen(!isLoadDialogOpen());
  el("btnLoadToggle").addEventListener("click", toggle);
  el("btnLoadClose").addEventListener("click", () => setLoadDialogOpen(false));
  el("loadBackdrop").addEventListener("click", () => setLoadDialogOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isLoadDialogOpen()) {
      e.preventDefault();
      setLoadDialogOpen(false);
    }
  });
}

function wireLoaders() {
  wireLoadDialog();
  el("btnLoadUrl").addEventListener("click", () => {
    loadFromUrl(el("urlInput").value).catch((e) => showLoadError(String(e)));
  });
  el("urlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el("btnLoadUrl").click();
    }
  });
  el("btnLoadExample").addEventListener("click", () => {
    loadFromUrl(EXAMPLE_URL, "example Bundle").catch((e) =>
      showLoadError(String(e))
    );
  });
  el("fileInput").addEventListener("change", async () => {
    const f = el("fileInput").files && el("fileInput").files[0];
    if (!f) return;
    try {
      const text = await f.text();
      await loadFromText(text, "file:" + f.name);
    } catch (e) {
      showLoadError(String(e));
    }
  });
  el("btnLoadPaste").addEventListener("click", () => {
    loadFromText(el("pasteInput").value, "paste").catch((e) =>
      showLoadError(String(e))
    );
  });
  el("btnClearPaste").addEventListener("click", () => {
    el("pasteInput").value = "";
    const n = el("loadError");
    n.hidden = true;
    n.textContent = "";
  });
}

function wireTheme() {
  const key = "tjsonFhirBrowserTheme";
  try {
    const t = sessionStorage.getItem(key);
    if (t === "theme-light" || t === "theme-dark") {
      document.body.className = t;
    }
  } catch (_) {
    /* ignore */
  }
  el("btnTheme").addEventListener("click", () => {
    const next =
      document.body.classList.contains("theme-dark") ? "theme-light" : "theme-dark";
    document.body.className = next;
    try {
      sessionStorage.setItem(key, next);
    } catch (_) {
      /* ignore */
    }
  });
}

function wireBrowser() {
  el("q").addEventListener("input", (e) => {
    st.q = e.target.value || "";
    apply();
    draw();
  });
  el("type").addEventListener("change", (e) => {
    st.type = e.target.value || "all";
    apply();
    draw();
  });
  el("btnTjson").addEventListener("click", () => setFmt("tjson"));
  el("btnJson").addEventListener("click", () => setFmt("json"));
}

async function boot() {
  wireTheme();
  wireLoaders();
  wireBrowser();
  updateFmtButtons();
  ensureTjson().catch(() => null);
  // Optional: ?url=… deep link
  const params = new URLSearchParams(location.search);
  const u = params.get("url");
  if (u) {
    el("urlInput").value = u;
    try {
      await loadFromUrl(u);
    } catch (e) {
      showLoadError(String(e));
    }
  } else if (params.get("example") === "1") {
    try {
      await loadFromUrl(EXAMPLE_URL, "example Bundle");
    } catch (e) {
      showLoadError(String(e));
    }
  } else {
    // Empty start: open load dialog once so URL/file/paste are discoverable.
    setLoadDialogOpen(true);
  }
}

boot();
