// Resolve CodeMirror 6 modules from Acode at runtime. Acode exposes the packages it was built
// with through acode.require("codemirror") / acode.require("@codemirror/..."); we never bundle
// our own copies, because duplicate @codemirror/state instances break facet identity.

const PACKAGES = [
  "@codemirror/state",
  "@codemirror/view",
  "@codemirror/language",
  "@codemirror/autocomplete",
  "@codemirror/lint",
  "@codemirror/commands",
  "@lezer/highlight",
];

/**
 * @param {(name: string) => any} requireFn  acode.require
 */
export function resolveCM(requireFn) {
  const sources = [];
  const tryRequire = (name) => {
    try {
      const m = requireFn(name);
      if (m && typeof m === "object") sources.push(m);
      return m;
    } catch (_) {
      return undefined;
    }
  };
  const bundle = tryRequire("codemirror");
  for (const pkg of PACKAGES) tryRequire(pkg);

  // The "codemirror" bundle may be flat or keyed by package / short name.
  if (bundle) {
    for (const v of Object.values(bundle)) {
      if (v && typeof v === "object" && !sources.includes(v)) sources.push(v);
    }
  }

  const cache = new Map();
  return {
    /** Look up a named export in any resolved module. */
    get(name) {
      if (cache.has(name)) return cache.get(name);
      let found;
      for (const s of sources) {
        try {
          if (s[name] !== undefined) { found = s[name]; break; }
        } catch (_) { /* ignore getters that throw */ }
      }
      cache.set(name, found);
      return found;
    },
    has(...names) {
      return names.every((n) => this.get(n) !== undefined);
    },
    sources,
  };
}
