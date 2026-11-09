// Builds the CodeMirror extensions: completion, hover docs, diagnostics, language data.
import { lint, lintFallback } from "../core/lint.js";
import { parserReady, withTree } from "../core/parser.js";
import { declarations } from "../core/analyze.js";
import { LIBC } from "../data/libc.js";
import {
  staticOptions, snippetOptions, headerOptions, directiveOptions, localOptions, fieldOptions, callTemplate,
} from "../core/completion.js";

const MARKER_NAME = "acode-c-toolkit";

export function computeDiagnostics(text, settings) {
  if (!settings.lintEnabled) return [];
  if (text.length > 400_000) return [];
  if (parserReady()) {
    return lint(text, { std: settings.std, semantic: settings.semanticLint, unused: settings.unusedHints, hints: settings.infoHints });
  }
  return lintFallback(text);
}

/**
 * @param {ReturnType<import("./cm.js").resolveCM>} cm
 * @param {{ getSettings: () => any, isAlive: () => boolean }} ctx
 */
export function buildExtensions(cm, ctx) {
  const exts = [];
  const EditorState = cm.get("EditorState");
  const EditorView = cm.get("EditorView");

  // ---- marker so we never attach twice to the same editor state
  const StateField = cm.get("StateField");
  let marker = null;
  if (StateField) {
    marker = StateField.define({ create: () => MARKER_NAME, update: (v) => v });
    exts.push(marker);
  }

  // ---- language data: comment tokens, bracket pairs, autocompletion source
  if (EditorState) {
    exts.push(EditorState.languageData.of(() => [{ commentTokens: { line: "//", block: { open: "/*", close: "*/" } } }]));
    const source = makeCompletionSource(cm, ctx);
    if (source) exts.push(EditorState.languageData.of(() => [{ autocomplete: source }]));
  }

  // ---- diagnostics
  const linter = cm.get("linter");
  const lintGutter = cm.get("lintGutter");
  if (linter) {
    exts.push(
      linter(
        (view) => {
          if (!ctx.isAlive()) return [];
          const s = ctx.getSettings();
          const text = view.state.doc.toString();
          return computeDiagnostics(text, s).map((d) => toCMDiagnostic(d, text.length, s));
        },
        { delay: 500 },
      ),
    );
    if (lintGutter && ctx.getSettings().lintGutter) exts.push(lintGutter());
  } else if (StateField && EditorView && cm.get("Decoration") && cm.get("StateEffect") && cm.get("ViewPlugin")) {
    exts.push(...fallbackSquiggles(cm, ctx));
  }

  // ---- hover documentation
  const hoverTooltip = cm.get("hoverTooltip");
  if (hoverTooltip) {
    exts.push(
      hoverTooltip(
        (view, pos) => {
          if (!ctx.isAlive() || !ctx.getSettings().hoverDocs) return null;
          const word = view.state.wordAt(pos);
          if (!word) return null;
          const name = view.state.sliceDoc(word.from, word.to);
          const info = symbolInfo(view.state.doc.toString(), name, pos);
          if (!info) return null;
          return {
            pos: word.from,
            end: word.to,
            above: true,
            create() {
              const dom = document.createElement("div");
              dom.className = "cm-c-doc";
              const sig = document.createElement("code");
              sig.textContent = info.sig;
              dom.appendChild(sig);
              if (info.doc) {
                const p = document.createElement("div");
                p.textContent = info.doc;
                dom.appendChild(p);
              }
              if (info.header) {
                const h = document.createElement("div");
                h.className = "cm-c-doc-hdr";
                h.textContent = info.header;
                dom.appendChild(h);
              }
              return { dom };
            },
          };
        },
        { hoverTime: 350 },
      ),
    );
  }

  if (EditorView) {
    exts.push(
      EditorView.baseTheme({
        ".cm-c-doc": { padding: "6px 10px", maxWidth: "min(88vw, 520px)", fontSize: "0.92em", lineHeight: "1.4", whiteSpace: "pre-wrap" },
        ".cm-c-doc code": { display: "block", fontFamily: "monospace", fontWeight: "600", marginBottom: "3px" },
        ".cm-c-doc-hdr": { opacity: "0.65", marginTop: "3px", fontSize: "0.9em" },
        ".cm-c-squiggle-error": { textDecoration: "underline wavy #e5484d", textUnderlineOffset: "3px" },
        ".cm-c-squiggle-warning": { textDecoration: "underline wavy #d9a21b", textUnderlineOffset: "3px" },
        ".cm-c-squiggle-info": { textDecoration: "underline dotted #7a8aa0", textUnderlineOffset: "3px" },
      }),
    );
  }

  return { extensions: exts, marker };
}

function toCMDiagnostic(d, docLen, settings) {
  const out = {
    from: Math.min(d.from, docLen),
    to: Math.min(Math.max(d.to, d.from + 1), docLen),
    severity: d.severity,
    message: d.message,
    source: "C",
  };
  if (d.fix) {
    out.actions = [
      {
        name: d.fix.label,
        apply(view, from) {
          // Recompute against the current document so offsets are never stale.
          const text = view.state.doc.toString();
          const fresh = computeDiagnostics(text, settings).find((x) => x.code === d.code && x.message === d.message && x.fix && Math.abs(x.from - from) < 2);
          const fix = (fresh && fresh.fix) || null;
          if (fix) view.dispatch({ changes: { from: fix.from, to: fix.to, insert: fix.insert } });
        },
      },
    ];
  }
  return out;
}

// ---------------------------------------------------------------- fallback squiggles
function fallbackSquiggles(cm, ctx) {
  const StateField = cm.get("StateField");
  const StateEffect = cm.get("StateEffect");
  const Decoration = cm.get("Decoration");
  const EditorView = cm.get("EditorView");
  const ViewPlugin = cm.get("ViewPlugin");
  const setMarks = StateEffect.define();
  const field = StateField.define({
    create: () => Decoration.none,
    update(deco, tr) {
      deco = deco.map(tr.changes);
      for (const e of tr.effects) if (e.is(setMarks)) deco = e.value;
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) { this.view = view; this.timer = null; this.schedule(); }
      update(u) { if (u.docChanged) this.schedule(); }
      schedule() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.run(), 600);
      }
      run() {
        if (!ctx.isAlive()) return;
        const text = this.view.state.doc.toString();
        const marks = computeDiagnostics(text, ctx.getSettings())
          .filter((d) => d.severity !== "info" || ctx.getSettings().infoHints)
          .map((d) => Decoration.mark({ class: `cm-c-squiggle-${d.severity}`, attributes: { title: d.message } }).range(Math.min(d.from, text.length), Math.min(Math.max(d.to, d.from + 1), text.length)))
          .sort((a, b) => a.from - b.from);
        this.view.dispatch({ effects: setMarks.of(Decoration.set(marks, true)) });
      }
      destroy() { clearTimeout(this.timer); }
    },
  );
  return [field, plugin];
}

// ---------------------------------------------------------------- completion
function makeCompletionSource(cm, ctx) {
  const snippetCompletion = cm.get("snippetCompletion");
  const syntaxTree = cm.get("syntaxTree");
  const statics = staticOptions();
  const snippets = snippetOptions();
  const headers = headerOptions();
  const directives = directiveOptions();

  const toCompletion = (o) => {
    const c = { label: o.label, type: o.type, detail: o.detail, info: o.info, boost: o.boost };
    if (o.template) {
      return snippetCompletion
        ? snippetCompletion(o.template, c)
        : { ...c, apply: o.template.replace(/\$\{([^}]*)\}/g, "$1").replace(/\t/g, "  ") };
    }
    return c;
  };
  // Precompute once: most options are static.
  const staticCompletions = statics.map(toCompletion);
  const snippetCompletions = snippets.map(toCompletion);
  const headerCompletions = headers.map(toCompletion);
  const directiveCompletions = directives.map(toCompletion);

  const inStringOrComment = (state, pos) => {
    if (!syntaxTree) return false;
    try {
      const node = syntaxTree(state).resolveInner(pos, -1);
      return /comment|string/i.test(node.name) || /comment|string/i.test(node.parent ? node.parent.name : "");
    } catch (_) { return false; }
  };

  return (context) => {
    if (!ctx.isAlive()) return null;
    const s = ctx.getSettings();
    if (!s.completion) return null;
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    // #include <...> / "..."
    const inc = /^\s*#\s*include\s*([<"])([\w/.\-]*)$/.exec(before);
    if (inc) {
      const closer = inc[1] === "<" ? ">" : '"';
      const after = state.sliceDoc(pos, pos + 1);
      const from = pos - inc[2].length;
      return {
        from,
        options: headerCompletions.map((c) => ({ ...c, apply: after === closer ? c.label : c.label + closer })),
        validFor: /^[\w/.\-]*$/,
      };
    }
    // #directive
    const dir = /^\s*#\s*(\w*)$/.exec(before);
    if (dir) return { from: pos - dir[1].length, options: directiveCompletions, validFor: /^\w*$/ };

    if (inStringOrComment(state, pos)) return null;

    // struct member access
    const mem = /(?:->|(?<![\d.])\.)(\w*)$/.exec(before);
    if (mem) {
      const opts = fieldOptions(state.doc.toString());
      if (opts.length) return { from: pos - mem[1].length, options: opts, validFor: /^\w*$/ };
      return null;
    }

    const word = context.matchBefore(/\w+/);
    if (!word && !context.explicit) return null;
    if (word && word.to - word.from < (s.minChars || 2) && !context.explicit) return null;
    const from = word ? word.from : pos;

    const text = state.doc.toString();
    const locals = localOptions(text, pos).map(toCompletion);
    return { from, options: [...locals, ...snippetCompletions, ...staticCompletions], validFor: /^\w*$/ };
  };
}

// ---------------------------------------------------------------- hover/doc lookup
/** Documentation for a symbol at `pos`: local declaration first, then the C library. */
export function symbolInfo(text, name, pos) {
  const local = withTree(text, (root) => {
    const decls = declarations(root);
    let best = null;
    for (const d of decls) {
      if (d.name !== name || d.kind === "field") continue;
      if (!d.global && (pos < d.scopeFrom || pos > d.scopeTo)) continue;
      if (!best || (!d.global && best.global) || (d.kind === "function" && best.kind !== "function")) best = d;
    }
    if (!best) return null;
    const sig = best.detail || `${best.kind} ${best.name}`;
    return { sig: best.kind === "variable" || best.kind === "parameter" ? `${best.kind}: ${best.name}` : sig, doc: "", header: `defined at line ${best.row + 1}` };
  });
  if (local) return local;
  const e = LIBC.get(name);
  if (!e) return null;
  return { sig: e.sig, doc: e.doc, header: `#include <${e.headers[0]}>` };
}

export { callTemplate };
