import { DEFAULT_FORMAT_OPTIONS } from "./core/format.js";

const KEY = "acode-c-toolkit.settings.v1";

export const DEFAULTS = {
  ...DEFAULT_FORMAT_OPTIONS,
  useProjectConfig: true, // honour a .clang-format found next to / above the file
  lintEnabled: true,
  semanticLint: true,
  unusedHints: true,
  infoHints: true,
  lintGutter: true,
  std: "c17",
  completion: true,
  hoverDocs: true,
  minChars: 2,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) { /* storage unavailable */ }
  return { ...DEFAULTS };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* ignore */ }
}
