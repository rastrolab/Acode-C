// Completion sources. Pure data/logic - the CodeMirror glue lives in editor/extensions.js.
import { LIBC, HEADERS } from "../data/libc.js";
import { KEYWORDS, TYPES, DIRECTIVES, SNIPPETS } from "../data/snippets.js";
import { withTree } from "./parser.js";
import { declarations, memberNames } from "./analyze.js";

/** Split a C parameter list into names. Returns null if the signature cannot be parsed. */
export function paramNames(sig) {
  const open = sig.indexOf("(");
  const close = sig.lastIndexOf(")");
  if (open < 0 || close < open) return null;
  const inner = sig.slice(open + 1, close).trim();
  if (inner === "" || inner === "void") return [];
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of inner) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  const names = [];
  for (const p of parts) {
    const t = p.trim();
    if (t === "..." ) { continue; }
    // function pointer parameter: int (*cb)(int)  -> cb
    const fp = /\(\s*\*\s*(\w+)\s*\)/.exec(t);
    if (fp) { names.push(fp[1]); continue; }
    const m = /(\w+)\s*(?:\[[^\]]*\])*\s*$/.exec(t);
    // a lone type such as "int" has no name: use a placeholder
    const words = t.replace(/[*\s]+/g, " ").trim().split(" ");
    names.push(m && words.length > 1 ? m[1] : "arg");
  }
  return names;
}

/** CodeMirror snippet template for a call, e.g. "memcpy(${dest}, ${src}, ${n})". */
export function callTemplate(name, sig) {
  const ps = paramNames(sig);
  if (!ps) return `${name}(\${})`;
  if (ps.length === 0) return `${name}()`;
  return `${name}(${ps.map((p) => `\${${p}}`).join(", ")})`;
}

/** Cheap static option records (no CodeMirror dependency). */
export function staticOptions() {
  const out = [];
  for (const k of KEYWORDS) out.push({ label: k, type: "keyword", boost: -2 });
  for (const t of TYPES) out.push({ label: t, type: "type", boost: -1 });
  for (const e of LIBC.values()) {
    if (e.kind === "function") {
      out.push({ label: e.name, type: "function", detail: `<${e.headers[0]}>`, info: `${e.sig}\n\n${e.doc}`, template: callTemplate(e.name, e.sig), boost: 0 });
    } else if (e.kind === "type") {
      out.push({ label: e.name, type: "type", detail: `<${e.headers[0]}>`, info: e.doc, boost: -1 });
    } else {
      out.push({ label: e.name, type: "constant", detail: `<${e.headers[0]}>`, info: e.doc, boost: -1 });
    }
  }
  return out;
}

export function snippetOptions() {
  return SNIPPETS.map((s) => ({ label: s.label, type: "text", detail: s.detail, template: s.body, boost: 3, isSnippet: true }));
}

export const headerOptions = () => HEADERS.map((h) => ({ label: h, type: "namespace", boost: 0 }));
export const directiveOptions = () => DIRECTIVES.map((d) => ({ label: d, type: "keyword" }));

const KIND_TYPE = {
  function: "function", prototype: "function", variable: "variable", parameter: "variable",
  typedef: "type", macro: "constant", enumerator: "enum", struct: "type", union: "type", enum: "type", field: "property",
};

let symCache = { text: null, value: null };

/** Symbols from the current document visible at `pos`. */
export function localOptions(text, pos) {
  if (symCache.text !== text) {
    const decls = withTree(text, (root) => declarations(root));
    symCache = { text, value: decls || [] };
  }
  const out = [];
  const seen = new Set();
  for (const d of symCache.value) {
    if (d.kind === "field") continue;
    const visible = pos >= d.scopeFrom && pos <= d.scopeTo && (d.global || d.identFrom <= pos);
    if (!visible) continue;
    if (seen.has(d.name)) continue;
    seen.add(d.name);
    const isFn = d.kind === "function" || d.kind === "prototype";
    out.push({
      label: d.name,
      type: KIND_TYPE[d.kind] || "variable",
      detail: isFn ? d.detail : d.kind,
      template: isFn ? callTemplate(d.name, d.detail || "") : undefined,
      boost: d.global ? 8 : 12,
    });
  }
  return out;
}

export function fieldOptions(text) {
  if (symCache.text !== text) {
    const decls = withTree(text, (root) => declarations(root));
    symCache = { text, value: decls || [] };
  }
  return memberNames(symCache.value).map((n) => ({ label: n, type: "property", boost: 5 }));
}
