import initClang, { format as clangFormat, format_line_range } from "@wasm-fmt/clang-format/web";

let ready = null;
let available = false;

export function initFormatter(load) {
  if (ready) return ready;
  ready = (async () => {
    const bytes = await load("clang-format.wasm");
    await initClang(bytes);
    available = true;
    return true;
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

export const formatterReady = () => available;

export const STYLES = ["LLVM", "Google", "Chromium", "Mozilla", "WebKit", "Microsoft", "GNU", "Linux", "Custom"];

export const DEFAULT_FORMAT_OPTIONS = {
  style: "LLVM",
  indentWidth: 4,
  useTab: false,
  columnLimit: 100,
  keepStyleIndent: false, // true: don't override the preset's own indent/column settings
  custom: "", // flow-style YAML or .clang-format file contents when style === "Custom"
};

/** Build the clang-format `style` argument from user options. */
export function buildStyle(o = {}) {
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...o };
  if (opts.style === "Custom") {
    const c = (opts.custom || "").trim();
    return c || "LLVM";
  }
  if (opts.style === "Linux") {
    return "{BasedOnStyle: LLVM, IndentWidth: 8, TabWidth: 8, UseTab: Always, ColumnLimit: 80, " +
      "BreakBeforeBraces: Linux, AllowShortIfStatementsOnASingleLine: Never, " +
      "AllowShortLoopsOnASingleLine: false, AllowShortFunctionsOnASingleLine: None, IndentCaseLabels: false}";
  }
  if (opts.keepStyleIndent) return opts.style;
  const parts = [
    `BasedOnStyle: ${opts.style}`,
    `IndentWidth: ${opts.indentWidth}`,
    `TabWidth: ${opts.indentWidth}`,
    `UseTab: ${opts.useTab ? "ForIndentation" : "Never"}`,
  ];
  if (opts.columnLimit >= 0) parts.push(`ColumnLimit: ${opts.columnLimit}`);
  return `{${parts.join(", ")}}`;
}

/**
 * Format C source. `range` is an optional {fromLine,toLine} (1-based, inclusive).
 * Throws if the formatter is unavailable or rejects the input.
 */
export function formatC(text, style, range) {
  if (!available) throw new Error("clang-format is not loaded");
  if (range) return format_line_range(text, range.fromLine, range.toLine, "main.c", style);
  return clangFormat(text, "main.c", style);
}

/**
 * Fallback used if the WASM formatter cannot load: re-indents by brace depth,
 * trims trailing whitespace and normalises blank lines. It never reflows code.
 */
export function formatFallback(text, o = {}) {
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...o };
  const unit = opts.useTab ? "\t" : " ".repeat(opts.indentWidth);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let depth = 0;
  let paren = 0;
  let inBlock = false;
  let blank = 0;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { if (++blank <= 2 && out.length) out.push(""); continue; }
    blank = 0;
    const t = line.trim();
    if (inBlock) {
      out.push(unit.repeat(depth) + " " + t.replace(/^\*?\s?/, "* ").replace(/^\* \*\//, "*/"));
      if (t.includes("*/")) inBlock = false;
      continue;
    }
    // strip strings/chars/comments to count brackets
    const code = t.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*$/g, "");
    const startsBlockComment = /\/\*/.test(code) && !/\*\//.test(code);
    const stripped = code.replace(/\/\*.*?\*\//g, "");
    let lead = (stripped.match(/^\s*}+/) || [""])[0].replace(/\s/g, "").length;
    let d = depth - lead;
    if (/^(case\b.*|default\s*):/.test(t) && d > 0) d -= 1;
    if (t[0] === "#") d = 0;
    out.push(unit.repeat(Math.max(0, d) + (paren > 0 ? 1 : 0)) + t);
    for (const ch of stripped) {
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (ch === "(") paren++;
      else if (ch === ")") paren = Math.max(0, paren - 1);
    }
    if (startsBlockComment) inBlock = true;
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}
