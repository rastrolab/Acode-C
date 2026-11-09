import plugin from "../plugin.json";
import { c as cClike } from "@codemirror/legacy-modes/mode/clike";
import { initParser, disposeParser, parserReady } from "./core/parser.js";
import { initFormatter } from "./core/format.js";
import { LIBC } from "./data/libc.js";
import { resolveCM } from "./editor/cm.js";
import { buildExtensions } from "./editor/extensions.js";
import { createOps } from "./editor/ops.js";
import { createUI } from "./ui.js";
import { loadSettings } from "./settings.js";
import { createCommands } from "./commands.js";
import { formatActive } from "./formatting.js";

const MODE_NAME = "c_toolkit";

/** Legacy clike tokenizer + highlighting of standard-library names. */
function enhancedCParser() {
  return {
    ...cClike,
    token(stream, state) {
      const style = cClike.token(stream, state);
      if (style === "variable" || style === null) {
        const e = LIBC.get(stream.current());
        if (e) return e.kind === "macro" ? "atom" : "builtin";
      }
      return style;
    },
  };
}

class CToolkit {
  constructor() {
    this.alive = false;
    this.baseUrl = "";
    this.registeredCommands = [];
    this.timer = null;
    this.unsubs = [];
    this.attachedViews = new WeakSet();
  }

  require(name) {
    return window.acode.require(name);
  }

  async readAsset(name) {
    const url = `${this.baseUrl}assets/${name}`;
    let lastError;
    // 1) Acode's file API (works for the plugin's private storage)
    try {
      const fs = this.require("fs");
      const data = await fs(url).readFile();
      if (data && data.byteLength) return data;
    } catch (e) { lastError = e; }
    // 2) plain fetch
    try {
      const res = await fetch(url);
      if (res.ok) return await res.arrayBuffer();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) { lastError = e; }
    throw new Error(`Cannot load ${name}: ${lastError && lastError.message}`);
  }

  async init(baseUrl) {
    this.alive = true;
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
    const acode = window.acode;

    this.settings = loadSettings();
    this.ui = createUI(acode);
    this.em = this.require("editorManager");
    this.cm = resolveCM((n) => acode.require(n));
    this.ops = createOps(() => this.em, this.cm);
    this.fsFactory = (() => { try { return this.require("fs"); } catch (_) { return null; } })();

    const ctx = { getSettings: () => this.settings, isAlive: () => this.alive };
    this.built = buildExtensions(this.cm, ctx);

    this.registerCommands();
    this.registerFormatter();
    this.registerLanguage();
    this.watchEditor();

    // WASM engines load in the background; features degrade gracefully until ready.
    this.loadEngines();
  }

  async loadEngines() {
    const load = (n) => this.readAsset(n);
    const results = await Promise.allSettled([initParser(load), initFormatter(load)]);
    const names = ["Parser", "Formatter"];
    const failed = results.map((r, i) => (r.status === "rejected" ? `${names[i]}: ${r.reason && r.reason.message}` : null)).filter(Boolean);
    if (failed.length) {
      console.error("[C Toolkit] engine load failed", failed);
      this.ui.toast(`C Toolkit: ${failed[0]} (using fallback)`, 5000);
    }
    this.refreshLint();
  }

  // -------------------------------------------------------------- commands & formatter
  registerCommands() {
    let commands = null;
    try { commands = this.require("commands"); } catch (_) { /* older Acode */ }
    if (!commands || !commands.addCommand) return;
    const defs = createCommands({
      ops: this.ops, ui: this.ui, settings: this.settings, fsFactory: this.fsFactory,
      refreshLint: () => this.refreshLint(), getEditorManager: () => this.em,
    });
    for (const d of defs) {
      try { commands.addCommand(d); this.registeredCommands.push(d.name); } catch (e) { console.warn("[C Toolkit] addCommand", d.name, e); }
    }
    this.commands = commands;
  }

  registerFormatter() {
    const acode = window.acode;
    if (!acode.registerFormatter) return;
    acode.registerFormatter(
      plugin.id,
      ["c", "h"],
      async () => {
        try {
          const r = await formatActive({ ops: this.ops, settings: this.settings, fsFactory: this.fsFactory, selectionOnly: false });
          if (r.engine !== "clang-format") this.ui.toast("clang-format unavailable: used the built-in re-indenter", 3000);
        } catch (e) {
          this.ui.toast(`Format failed: ${String(e && e.message ? e.message : e).split("\n")[0]}`, 4000);
        }
      },
      "C (clang-format)",
    );
  }

  registerLanguage() {
    let langs = null;
    try { langs = this.require("editorLanguages"); } catch (_) { /* not available */ }
    const StreamLanguage = this.cm.get("StreamLanguage");
    if (!langs || !langs.register || !StreamLanguage) return;
    try {
      langs.register(MODE_NAME, ["c", "h"], "C (Toolkit)", async () => [
        StreamLanguage.define(enhancedCParser()),
        ...this.built.extensions,
      ]);
      this.langRegistered = langs;
    } catch (e) { console.warn("[C Toolkit] language registration failed", e); }
  }

  // -------------------------------------------------------------- attach extensions
  /**
   * Attach our extensions to the active editor state when it holds a C file. Idempotent via
   * the marker field. This is independent of which language mode Acode picked for the file.
   */
  attach() {
    if (!this.alive) return;
    try {
      const view = this.ops.view();
      if (!view || !this.ops.isCM() || !this.ops.isCFile()) return;
      const marker = this.built.marker;
      const StateEffect = this.cm.get("StateEffect");
      const Compartment = this.cm.get("Compartment");
      if (!StateEffect) return;
      if (marker && view.state.field(marker, false)) return;
      if (!marker && this.attachedViews.has(view.state)) return;
      const payload = Compartment ? (this.compartment = this.compartment || new Compartment()).of(this.built.extensions) : this.built.extensions;
      view.dispatch({ effects: StateEffect.appendConfig.of(payload) });
      this.attachedViews.add(view.state);
    } catch (e) {
      // A failed attach should never break editing; commands and formatter still work.
      if (!this.attachWarned) { this.attachWarned = true; console.warn("[C Toolkit] attach failed", e); }
    }
  }

  watchEditor() {
    const em = this.em;
    const handler = () => setTimeout(() => this.attach(), 50);
    for (const ev of ["switch-file", "file-loaded", "init-open-file", "new-file", "rename-file"]) {
      try {
        if (em && em.on) { em.on(ev, handler); this.unsubs.push(() => em.off && em.off(ev, handler)); }
      } catch (_) { /* event not supported */ }
    }
    // Safety net: some builds swap editor state without emitting the events above.
    this.timer = setInterval(() => this.attach(), 2500);
    handler();
  }

  refreshLint() {
    try {
      const view = this.ops.view();
      const force = this.cm.get("forceLinting");
      if (view && force && this.ops.isCM()) force(view);
    } catch (_) { /* ignore */ }
  }

  async destroy() {
    this.alive = false;
    clearInterval(this.timer);
    for (const u of this.unsubs) { try { u(); } catch (_) { /* ignore */ } }
    this.unsubs = [];
    for (const name of this.registeredCommands) { try { this.commands.removeCommand(name); } catch (_) { /* ignore */ } }
    this.registeredCommands = [];
    try { window.acode.unregisterFormatter && window.acode.unregisterFormatter(plugin.id); } catch (_) { /* ignore */ }
    try {
      if (this.langRegistered) {
        const l = this.langRegistered;
        (l.unregister || l.remove || (() => {})).call(l, MODE_NAME);
      }
    } catch (_) { /* ignore */ }
    try {
      const view = this.ops && this.ops.view();
      if (view && this.compartment && this.ops.isCM()) view.dispatch({ effects: this.compartment.reconfigure([]) });
    } catch (_) { /* ignore */ }
    if (parserReady()) disposeParser();
  }
}

if (window.acode) {
  const toolkit = new CToolkit();
  window.acode.setPluginInit(plugin.id, async (baseUrl) => {
    await toolkit.init(baseUrl);
  });
  window.acode.setPluginUnmount(plugin.id, () => toolkit.destroy());
}

export { CToolkit };
