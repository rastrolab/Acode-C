// Dialog helpers around Acode's UI modules, with plain-browser fallbacks.

export function createUI(acode) {
  const get = (name) => {
    try { return acode.require(name); } catch (_) { return null; }
  };

  return {
    toast(message, ms = 2500) {
      const t = get("toast");
      if (typeof t === "function") t(message, ms);
      else console.log("[C Toolkit]", message);
    },

    /** options: [[value, label], ...]; resolves to the chosen value or undefined. */
    async select(title, options, config) {
      const sel = get("select");
      if (typeof sel === "function") {
        try {
          const v = await sel(title, options, { textTransform: false, ...(config || {}) });
          return v === null ? undefined : v;
        } catch (_) { return undefined; }
      }
      const list = options.map((o, i) => `${i + 1}. ${Array.isArray(o) ? o[1] : o}`).join("\n");
      const n = parseInt(window.prompt(`${title}\n${list}`, "1") || "", 10);
      const o = options[n - 1];
      return o === undefined ? undefined : Array.isArray(o) ? o[0] : o;
    },

    async prompt(message, defaultValue = "", type = "text", opts) {
      const p = get("prompt");
      if (typeof p === "function") {
        try {
          const v = await p(message, defaultValue, type, opts);
          return v === null || v === undefined ? undefined : String(v);
        } catch (_) { return undefined; }
      }
      const v = window.prompt(message, defaultValue);
      return v === null ? undefined : v;
    },

    async alert(title, message) {
      const a = get("alert");
      if (typeof a === "function") { try { await a(title, message); return; } catch (_) { /* fall through */ } }
      window.alert(`${title}\n\n${message}`);
    },

    async confirm(title, message) {
      const c = get("confirm");
      if (typeof c === "function") { try { return !!(await c(title, message)); } catch (_) { return false; } }
      return window.confirm(`${title}\n\n${message}`);
    },

    async copy(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
      } catch (_) { /* fall through */ }
      const cordovaCb = window.cordova && window.cordova.plugins && window.cordova.plugins.clipboard;
      if (cordovaCb && cordovaCb.copy) { cordovaCb.copy(text); return true; }
      return false;
    },
  };
}
