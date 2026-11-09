import { withTree, parserReady } from "./core/parser.js";
import { outline, declarations, resolve, identifierAt, occurrences, functionAt } from "./core/analyze.js";
import { lint } from "./core/lint.js";
import { computeDiagnostics, symbolInfo } from "./editor/extensions.js";
import { LIBC, HEADERS } from "./data/libc.js";
import { SNIPPETS } from "./data/snippets.js";
import { SAMPLES } from "./data/samples.js";
import { STYLES, buildStyle, formatC, formatterReady } from "./core/format.js";
import { formatActive } from "./formatting.js";
import { saveSettings } from "./settings.js";

const SEV_MARK = { error: "[E]", warning: "[W]", info: "[i]" };

/**
 * @returns {{ name: string, description: string, exec: Function }[]}
 */
export function createCommands({ ops, ui, settings, fsFactory, refreshLint, getEditorManager }) {
  const needCFile = () => {
    if (!ops.view()) { ui.toast("No active editor"); return false; }
    return true;
  };
  const guard = (fn) => async (...a) => {
    try { return await fn(...a); } catch (e) { ui.toast(`C Toolkit: ${e && e.message ? e.message : e}`, 4000); console.error(e); }
  };
  const parse = (fn) => {
    const r = withTree(ops.text(), fn);
    if (r === undefined) { ui.toast("Parser is not available (WASM failed to load)", 3500); }
    return r;
  };

  // ------------------------------------------------------------------ format
  const format = async (selectionOnly) => {
    if (!needCFile()) return;
    const r = await formatActive({ ops, settings, fsFactory, selectionOnly });
    ui.toast(r.changed ? `Formatted (${r.source})` : "Already formatted", 1800);
  };

  // ------------------------------------------------------------------ problems
  const problems = async () => {
    if (!needCFile()) return;
    const text = ops.text();
    const list = computeDiagnostics(text, settings);
    if (!list.length) { ui.toast("No problems found"); return; }
    const opts = list.map((d, i) => [i, `${SEV_MARK[d.severity] || ""} L${ops.lineOf(d.from)}  ${d.message}`]);
    const pick = await ui.select(`Problems (${list.length})`, opts);
    if (pick === undefined) return;
    const d = list[pick];
    ops.goto(d.from, { from: d.from, to: Math.max(d.to, d.from) });
  };

  const addAllIncludes = async () => {
    if (!needCFile()) return;
    const diags = lint(ops.text(), { std: settings.std });
    const seen = new Set();
    const fixes = [];
    for (const d of diags) {
      if (d.code === "missing-include" && d.fix && !seen.has(d.fix.insert)) { seen.add(d.fix.insert); fixes.push(d.fix); }
    }
    if (!fixes.length) { ui.toast("No missing #includes found"); return; }
    const at = fixes[0].from;
    ops.change([{ from: at, to: at, insert: fixes.map((f) => f.insert).join("") }]);
    ui.toast(`Added ${fixes.length} #include${fixes.length === 1 ? "" : "s"}`);
  };

  // ------------------------------------------------------------------ navigation
  const gotoSymbol = async () => {
    if (!needCFile()) return;
    const items = parse((root) => outline(root));
    if (!items) return;
    if (!items.length) { ui.toast("No symbols found"); return; }
    const opts = items.map((s, i) => [i, `${s.kind.padEnd(9, " ")} ${s.detail.length > 70 ? s.detail.slice(0, 67) + "..." : s.detail}   :${s.row + 1}`]);
    const pick = await ui.select(`Symbols (${items.length})`, opts);
    if (pick !== undefined) ops.goto(items[pick].from);
  };

  const gotoDefinition = async () => {
    if (!needCFile()) return;
    const pos = ops.cursor();
    const res = parse((root) => {
      const id = identifierAt(root, pos);
      if (!id) return null;
      const decls = declarations(root);
      const d = resolve(decls, id.name, pos);
      return d ? { from: d.identFrom, name: id.name, kind: d.kind, atDef: pos >= d.identFrom && pos <= d.identTo } : { name: id.name, missing: true };
    });
    if (res === undefined) return;
    if (!res || res.missing) {
      const lib = res && LIBC.get(res.name);
      ui.toast(lib ? `'${res.name}' is in <${lib.headers[0]}>` : res ? `No definition of '${res.name}' in this file` : "Place the cursor on an identifier", 2500);
      return;
    }
    ops.goto(res.from);
  };

  const rename = async () => {
    if (!needCFile()) return;
    const pos = ops.cursor();
    const info = parse((root) => {
      const id = identifierAt(root, pos);
      if (!id) return null;
      const decls = declarations(root);
      const d = resolve(decls, id.name, pos);
      if (!d) return { name: id.name, unresolved: true };
      // every occurrence that resolves to the same declaration
      const hits = occurrences(root, id.name).filter((o) => o.type !== "field_identifier" || d.kind === "field").filter((o) => {
        const r = resolve(decls, id.name, o.from);
        return r && r.identFrom === d.identFrom;
      });
      return { name: id.name, kind: d.kind, hits, global: d.global };
    });
    if (info === undefined) return;
    if (!info) { ui.toast("Place the cursor on an identifier to rename"); return; }
    if (info.unresolved) { ui.toast(`'${info.name}' is not declared in this file (library symbol or macro from another file)`, 3500); return; }
    const next = await ui.prompt(`Rename ${info.kind} '${info.name}' (${info.hits.length} occurrence${info.hits.length === 1 ? "" : "s"})`, info.name);
    if (next === undefined || next === info.name) return;
    if (!/^[A-Za-z_]\w*$/.test(next)) { ui.toast("Not a valid C identifier", 3000); return; }
    ops.change(info.hits.map((h) => ({ from: h.from, to: h.to, insert: next })));
    if (info.global) ui.toast("Renamed in this file only. Check other files that use it.", 3500);
  };

  const showDocs = async () => {
    if (!needCFile()) return;
    let word = ops.wordAtCursor();
    if (!word) word = await ui.prompt("Look up symbol", "");
    if (!word) return;
    const info = symbolInfo(ops.text(), word, ops.cursor());
    if (!info) { ui.toast(`No documentation for '${word}'`, 2500); return; }
    await ui.alert(word, [info.sig, info.doc, info.header].filter(Boolean).join("\n\n"));
  };

  // ------------------------------------------------------------------ insertion
  const addInclude = async () => {
    if (!needCFile()) return;
    const w = ops.wordAtCursor();
    let header;
    const e = w && LIBC.get(w);
    if (e) header = e.headers[0];
    else {
      header = await ui.select("Add #include", HEADERS.map((h) => [h, `<${h}>`]));
      if (header === undefined) return;
    }
    const text = ops.text();
    if (new RegExp(`#\\s*include\\s*<${header.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}>`).test(text)) {
      ui.toast(`<${header}> is already included`);
      return;
    }
    let at = 0;
    const re = /^[ \t]*#[ \t]*include[^\n]*\n/gm;
    let m, last = -1;
    while ((m = re.exec(text))) last = m.index + m[0].length;
    if (last >= 0) at = last;
    else {
      const lead = /^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*/.exec(text);
      at = lead ? lead[0].length : 0;
    }
    ops.change([{ from: at, to: at, insert: `#include <${header}>\n` }]);
    ui.toast(`Added #include <${header}>`);
  };

  const includeGuard = async () => {
    if (!needCFile()) return;
    const base = (ops.fileName() || "header.h").replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
    const g = base.endsWith("_H") ? base : base + "_H";
    const text = ops.text();
    if (/^\s*#\s*(ifndef|pragma\s+once)/m.test(text)) { ui.toast("This file already has an include guard"); return; }
    ops.change([
      { from: 0, to: 0, insert: `#ifndef ${g}\n#define ${g}\n\n` },
      { from: text.length, to: text.length, insert: `${text.endsWith("\n") ? "" : "\n"}\n#endif /* ${g} */\n` },
    ]);
  };

  const doxygen = async () => {
    if (!needCFile()) return;
    const fn = parse((root) => functionAt(root, ops.cursor()));
    if (fn === undefined) return;
    if (!fn) { ui.toast("Place the cursor inside a function"); return; }
    const lines = ["/**", ` * @brief ${fn.name}`, " *"];
    for (const p of fn.params) lines.push(` * @param ${p}`);
    if (!fn.returnsVoid) lines.push(" * @return");
    lines.push(" */");
    ops.change([{ from: fn.from, to: fn.from, insert: lines.join("\n") + "\n" }]);
  };

  const insertSnippet = async () => {
    if (!needCFile()) return;
    const pick = await ui.select("Insert snippet", SNIPPETS.map((s, i) => [i, `${s.label.padEnd(10, " ")} ${s.detail}`]));
    if (pick !== undefined) ops.insertSnippet(SNIPPETS[pick].body);
  };

  const insertSample = async () => {
    if (!needCFile()) return;
    const pick = await ui.select("Insert code sample", SAMPLES.map((s, i) => [i, `${s.group}: ${s.title}`]));
    if (pick === undefined) return;
    let code = SAMPLES[pick].code;
    if (formatterReady()) {
      try { code = formatC(code, buildStyle(settings)); } catch (_) { /* keep original */ }
    }
    const empty = ops.text().trim() === "";
    if (!empty && !(await ui.confirm("Insert sample", "The file is not empty. Insert the sample at the cursor?"))) return;
    ops.insert(code);
  };

  const compileCommand = async () => {
    if (!needCFile()) return;
    const name = ops.fileName() || "main.c";
    const out = name.replace(/\.[^.]+$/, "");
    const text = ops.text();
    const libs = [];
    if (/#\s*include\s*<math\.h>/.test(text)) libs.push("-lm");
    if (/#\s*include\s*<pthread\.h>/.test(text)) libs.push("-pthread");
    const std = settings.std === "c23" ? "c2x" : settings.std;
    const cmd = `gcc -std=${std} -Wall -Wextra -Wpedantic -g ${name} -o ${out}${libs.length ? " " + libs.join(" ") : ""}`;
    const ok = await ui.copy(cmd);
    await ui.alert(ok ? "Compile command copied" : "Compile command", `${cmd}\n\nRun in Termux (pkg install clang) from the file's folder, then ./${out}`);
  };

  // ------------------------------------------------------------------ settings
  const bool = (v) => (v ? "on" : "off");
  const settingsDialog = async () => {
    for (;;) {
      const s = settings;
      const items = [
        ["style", `Format style: ${s.style}`],
        ["indent", `Indent width: ${s.indentWidth}`],
        ["tabs", `Indent with tabs: ${bool(s.useTab)}`],
        ["col", `Column limit: ${s.columnLimit || "none"}`],
        ["custom", `Custom clang-format style${s.style === "Custom" ? " (active)" : ""}`],
        ["project", `Use project .clang-format: ${bool(s.useProjectConfig)}`],
        ["lint", `Linting: ${bool(s.lintEnabled)}`],
        ["semantic", `Semantic checks: ${bool(s.semanticLint)}`],
        ["unused", `Unused variable hints: ${bool(s.unusedHints)}`],
        ["info", `Info-level hints: ${bool(s.infoHints)}`],
        ["gutter", `Lint gutter markers: ${bool(s.lintGutter)} (applies after restart)`],
        ["std", `C standard: ${s.std}`],
        ["completion", `Completion: ${bool(s.completion)}`],
        ["hover", `Hover documentation: ${bool(s.hoverDocs)}`],
      ];
      const k = await ui.select("C Toolkit settings", items);
      if (k === undefined) break;
      switch (k) {
        case "style": {
          const v = await ui.select("Format style", STYLES.map((x) => [x, x]));
          if (v !== undefined) s.style = v;
          break;
        }
        case "indent": {
          const v = await ui.select("Indent width", [2, 3, 4, 8].map((n) => [n, String(n)]));
          if (v !== undefined) s.indentWidth = Number(v);
          break;
        }
        case "tabs": s.useTab = !s.useTab; break;
        case "col": {
          const v = await ui.select("Column limit", [[0, "No limit"], [80, "80"], [100, "100"], [120, "120"]]);
          if (v !== undefined) s.columnLimit = Number(v);
          break;
        }
        case "custom": {
          const v = await ui.prompt("clang-format style: a preset name, {Key: value, ...} or .clang-format contents", s.custom || "{BasedOnStyle: LLVM, IndentWidth: 4}", "textarea");
          if (v !== undefined) {
            if (formatterReady()) {
              try { formatC("int a;\n", v); s.custom = v; s.style = "Custom"; ui.toast("Custom style saved"); } catch (e) { ui.toast("Rejected: " + String(e.message || e).split("\n")[0], 4500); }
            } else { s.custom = v; s.style = "Custom"; }
          }
          break;
        }
        case "project": s.useProjectConfig = !s.useProjectConfig; break;
        case "lint": s.lintEnabled = !s.lintEnabled; break;
        case "semantic": s.semanticLint = !s.semanticLint; break;
        case "unused": s.unusedHints = !s.unusedHints; break;
        case "info": s.infoHints = !s.infoHints; break;
        case "gutter": s.lintGutter = !s.lintGutter; break;
        case "std": {
          const v = await ui.select("C standard", ["c99", "c11", "c17", "c23"].map((x) => [x, x]));
          if (v !== undefined) s.std = v;
          break;
        }
        case "completion": s.completion = !s.completion; break;
        case "hover": s.hoverDocs = !s.hoverDocs; break;
        default:
      }
      saveSettings(s);
      refreshLint();
    }
  };

  const toggleLint = async () => {
    settings.lintEnabled = !settings.lintEnabled;
    saveSettings(settings);
    refreshLint();
    ui.toast(`Linting ${bool(settings.lintEnabled)}`);
  };

  const status = async () => {
    const lines = [
      `Parser (tree-sitter): ${parserReady() ? "ready" : "NOT loaded - using lexical fallback"}`,
      `Formatter (clang-format WASM): ${formatterReady() ? "ready" : "NOT loaded - using built-in re-indenter"}`,
      `Editor: ${ops.isCM() ? "CodeMirror" : ops.view() ? "legacy (Ace)" : "none"}`,
      `Style: ${settings.style}${settings.useProjectConfig ? " (+ project .clang-format)" : ""}`,
    ];
    await ui.alert("C Toolkit status", lines.join("\n"));
  };

  const defs = [
    ["format", "C: Format document", () => format(false)],
    ["format-selection", "C: Format selection", () => format(true)],
    ["problems", "C: Show problems", problems],
    ["add-includes", "C: Add all missing #includes", addAllIncludes],
    ["symbols", "C: Go to symbol (outline)", gotoSymbol],
    ["definition", "C: Go to definition", gotoDefinition],
    ["rename", "C: Rename symbol", rename],
    ["docs", "C: Show documentation for symbol", showDocs],
    ["include", "C: Add #include", addInclude],
    ["guard", "C: Insert include guard", includeGuard],
    ["doxygen", "C: Insert Doxygen comment for function", doxygen],
    ["snippet", "C: Insert snippet", insertSnippet],
    ["sample", "C: Insert code sample", insertSample],
    ["compile", "C: Copy gcc compile command", compileCommand],
    ["toggle-lint", "C: Toggle linting", toggleLint],
    ["settings", "C: Settings", settingsDialog],
    ["status", "C: Toolkit status", status],
  ];
  void getEditorManager;
  return defs.map(([id, description, fn]) => ({ name: `c-toolkit:${id}`, description, exec: guard(fn) }));
}
