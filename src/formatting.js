import { formatC, formatFallback, buildStyle, formatterReady } from "./core/format.js";

function parentUri(u) {
  if (!u) return null;
  const slash = u.lastIndexOf("/");
  const enc = u.lastIndexOf("%2F");
  const sep = slash >= enc ? "/" : "%2F";
  const idx = Math.max(slash, enc);
  if (idx <= 0 || /^[a-z]+:\/\/?$/i.test(u.slice(0, idx + 1))) return null;
  return { dir: u.slice(0, idx), sep };
}

const cfgCache = new Map(); // dir -> {at, value}

/** Look for a .clang-format in the file's directory and up to 5 parents. Best effort. */
export async function findProjectConfig(fsFactory, uri) {
  if (!fsFactory || !uri) return null;
  let cur = parentUri(uri);
  for (let i = 0; i < 5 && cur; i++) {
    const hit = cfgCache.get(cur.dir);
    if (hit && Date.now() - hit.at < 15000) { if (hit.value) return hit.value; }
    else {
      let value = null;
      try {
        const f = fsFactory(cur.dir + cur.sep + ".clang-format");
        if (await f.exists()) value = await f.readFile("utf-8");
      } catch (_) { /* unreadable: keep looking */ }
      cfgCache.set(cur.dir, { at: Date.now(), value });
      if (value) return value;
    }
    cur = parentUri(cur.dir);
  }
  return null;
}

/**
 * Format the active document (or the selected lines).
 * @returns {Promise<{changed:boolean, engine:string}>}
 */
export async function formatActive({ ops, settings, fsFactory, selectionOnly }) {
  const text = ops.text();
  let style = buildStyle(settings);
  let source = `preset ${settings.style}`;
  if (settings.useProjectConfig) {
    const cfg = await findProjectConfig(fsFactory, ops.fileUri());
    if (cfg && cfg.trim()) { style = cfg; source = ".clang-format"; }
  }
  let next;
  let engine = "clang-format";
  if (formatterReady()) {
    let range;
    const sel = ops.selection();
    if (selectionOnly && sel.from !== sel.to) {
      range = { fromLine: ops.lineOf(sel.from), toLine: ops.lineOf(Math.max(sel.from, sel.to - 1)) };
    }
    try {
      next = formatC(text, style, range);
    } catch (e) {
      // A bad .clang-format must not block formatting: retry with the preset.
      if (source === ".clang-format") {
        next = formatC(text, buildStyle(settings), range);
        source = `preset ${settings.style} (.clang-format was rejected: ${String(e.message || e).split("\n")[0]})`;
      } else throw e;
    }
  } else {
    engine = "built-in re-indenter";
    next = formatFallback(text, settings);
  }
  const changed = ops.replaceAll(next);
  return { changed, engine, source };
}
