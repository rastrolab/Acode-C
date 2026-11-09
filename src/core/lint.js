import { withTree } from "./parser.js";
import { walk, declarations, resolve, declIdent, isPointerDeclarator } from "./analyze.js";
import { LIBC, HEADER_PROVIDES, ALWAYS_KNOWN } from "../data/libc.js";

/** Extra headers that also provide a commonly shared name. */
const SHARED = ["stdio.h", "stdlib.h", "string.h", "stddef.h", "time.h", "wchar.h", "locale.h"];
const ALT_HEADERS = {
  size_t: SHARED, NULL: SHARED,
  ssize_t: ["unistd.h", "sys/types.h", "stdio.h", "sys/socket.h"],
  off_t: ["unistd.h", "sys/types.h", "sys/stat.h", "stdio.h", "fcntl.h"],
  pid_t: ["unistd.h", "sys/types.h", "sys/wait.h", "signal.h", "fcntl.h", "pthread.h"],
  time_t: ["time.h", "sys/types.h", "sys/stat.h"],
  va_list: ["stdarg.h", "stdio.h", "stdlib.h"],
  intptr_t: ["stdint.h", "inttypes.h", "unistd.h"],
  uint8_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  uint16_t: ["stdint.h", "inttypes.h", "sys/types.h", "arpa/inet.h", "netinet/in.h"],
  uint32_t: ["stdint.h", "inttypes.h", "sys/types.h", "arpa/inet.h", "netinet/in.h"],
  uint64_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  int8_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  int16_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  int32_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  int64_t: ["stdint.h", "inttypes.h", "sys/types.h"],
  PATH_MAX: ["limits.h", "linux/limits.h", "sys/syslimits.h"],
  errno: ["errno.h"],
};
const C23_KEYWORDS = new Set(["bool", "true", "false", "nullptr"]);

const NORETURN = new Set(["exit", "abort", "_Exit", "quick_exit", "longjmp", "pthread_exit", "__builtin_unreachable", "execv", "execvp", "execl", "execlp", "execve"]);
const ALLOC_FUNCS = new Set(["malloc", "calloc", "realloc", "strdup", "strndup", "fopen", "fdopen", "popen", "opendir", "tmpfile", "aligned_alloc"]);

const UNSAFE = {
  strcpy: ["warning", "strcpy() does not check bounds; use snprintf() or memcpy() with an explicit length"],
  strcat: ["warning", "strcat() does not check bounds; track the length and use snprintf()/memcpy()"],
  sprintf: ["warning", "sprintf() cannot bound its output; use snprintf()"],
  vsprintf: ["warning", "vsprintf() cannot bound its output; use vsnprintf()"],
  tmpnam: ["warning", "tmpnam() is race-prone; use mkstemp()"],
  mktemp: ["warning", "mktemp() is race-prone; use mkstemp()"],
  atoi: ["info", "atoi() cannot report errors; use strtol()"],
  atol: ["info", "atol() cannot report errors; use strtol()"],
  atof: ["info", "atof() cannot report errors; use strtod()"],
  strncpy: ["info", "strncpy() does not NUL-terminate when the source fills the buffer"],
  alloca: ["info", "alloca() can overflow the stack silently; prefer a fixed array or malloc()"],
};

const PRINTF_FMT_ARG = { printf: 0, fprintf: 1, sprintf: 1, snprintf: 2, dprintf: 1, vprintf: 0, vfprintf: 1, vsnprintf: 2, vsprintf: 1 };
const SCANF_FMT_ARG = { scanf: 0, fscanf: 1, sscanf: 1 };
const VA_VARIANTS = new Set(["vprintf", "vfprintf", "vsnprintf", "vsprintf"]);

export const DEFAULT_LINT_OPTIONS = {
  std: "c17", // c99 | c11 | c17 | c23
  semantic: true,
  unused: true,
  hints: true, // "info"-level diagnostics
};

/** Parse printf/scanf conversions. */
export function parseFormat(fmt, scanf = false) {
  const re = scanf
    ? /%(\*?)([-+ #0']*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|j|z|t|L)?([diouxXeEfFgGaAcspn%]|\[[^\]]*\])/g
    : /%()([-+ #0']*)(\*|\d+)?(?:\.(\*|\d+))?(hh|h|ll|l|j|z|t|L)?([diouxXeEfFgGaAcspn%]|\[[^\]]*\])/g;
  const specs = [];
  let m;
  while ((m = re.exec(fmt))) {
    const conv = m[6][0] === "[" ? "[" : m[6];
    if (conv === "%") continue;
    const stars = (m[3] === "*" ? 1 : 0) + (m[4] === "*" ? 1 : 0);
    specs.push({ conv, length: m[5] || "", suppressed: m[1] === "*", stars, width: m[3] && m[3] !== "*" ? m[3] : null, text: m[0] });
  }
  return specs;
}

function stringValue(n) {
  if (!n) return null;
  if (n.type === "string_literal") return n.text.replace(/^[LuU8]*"/, "").replace(/"$/, "");
  if (n.type === "concatenated_string") {
    let s = "";
    for (let i = 0; i < n.namedChildCount; i++) {
      const v = stringValue(n.namedChild(i));
      if (v === null) return null;
      s += v;
    }
    return s;
  }
  return null;
}

function argKind(n) {
  switch (n.type) {
    case "string_literal":
    case "concatenated_string": return "string";
    case "char_literal": return "char";
    case "number_literal":
      return /^0[xX]/.test(n.text) ? "int" : /[.eE]|[fF]$/.test(n.text) ? "float" : "int";
    case "sizeof_expression": return "size_t";
    case "call_expression": {
      const f = n.childForFieldName("function");
      if (f && (f.text === "strlen" || f.text === "fread" || f.text === "fwrite")) return "size_t";
      return null;
    }
    case "parenthesized_expression": return n.namedChild(0) ? argKind(n.namedChild(0)) : null;
    default: return null;
  }
}

function callArgs(call) {
  const args = call.childForFieldName("arguments");
  const out = [];
  if (!args) return out;
  for (let i = 0; i < args.namedChildCount; i++) {
    const c = args.namedChild(i);
    if (c.type !== "comment") out.push(c);
  }
  return out;
}

function includeInfo(root) {
  const system = new Set();
  let hasUser = false;
  let lastIncludeEnd = -1;
  walk(root, (n) => {
    if (n.type === "preproc_include") {
      const p = n.childForFieldName("path");
      if (p) {
        const t = p.text;
        if (t[0] === "<") system.add(t.slice(1, -1));
        else hasUser = true;
      }
      lastIncludeEnd = n.endIndex;
      return false;
    }
    // includes may sit inside include guards / extern "C" blocks
    return n.type === "translation_unit" || n.type.startsWith("preproc_if") || n.type === "preproc_else" || n.type === "preproc_elif";
  });
  // closure
  let changed = true;
  while (changed) {
    changed = false;
    for (const h of [...system]) {
      for (const p of HEADER_PROVIDES[h] || []) if (!system.has(p)) { system.add(p); changed = true; }
    }
  }
  return { system, hasUser, lastIncludeEnd };
}

function includeInsertion(root, text, info) {
  if (info.lastIncludeEnd >= 0) {
    const nl = text.indexOf("\n", info.lastIncludeEnd);
    return nl === -1 ? text.length : nl + 1;
  }
  // after a leading comment block / include guard head
  let pos = 0;
  const m = /^(?:\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*/.exec(text);
  if (m) pos = m[0].length;
  // keep after '#ifndef X / #define X' guards
  const g = /^(\s*#ifndef\s+\w+\s*\n\s*#define\s+\w+[^\n]*\n)/.exec(text.slice(pos));
  if (g) pos += g[0].length;
  return pos;
}

/**
 * Lint C source. Returns diagnostics: {from,to,severity,message,code,fix?}
 * severity: error | warning | info.   fix: {label, from, to, insert}
 */
export function lint(text, options = {}) {
  const opts = { ...DEFAULT_LINT_OPTIONS, ...options };
  const res = withTree(text, (root) => run(root, text, opts));
  return res || [];
}

function run(root, text, opts) {
  /** @type {any[]} */
  const diags = [];
  const push = (n, severity, message, code, fix, rangeOverride) => {
    if (!opts.hints && severity === "info") return;
    const from = rangeOverride ? rangeOverride[0] : n.startIndex;
    let to = rangeOverride ? rangeOverride[1] : n.endIndex;
    if (to <= from) to = Math.min(from + 1, text.length);
    diags.push({ from, to, severity, message, code, fix });
  };

  // ---- syntax errors
  if (root.hasError()) {
    const visit = (n) => {
      if (n.isMissing()) {
        let from = n.startIndex;
        // anchor on the previous character when the missing token is at a line end
        if (from > 0 && (text[from] === "\n" || text[from] === "\r" || from >= text.length)) from -= 1;
        diags.push({ from, to: from + 1, severity: "error", message: `Syntax error: missing '${n.type}'`, code: "syntax" });
        return;
      }
      if (n.type === "ERROR") {
        const firstLineEnd = text.indexOf("\n", n.startIndex);
        const to = firstLineEnd === -1 ? n.endIndex : Math.min(n.endIndex, firstLineEnd);
        const snippet = text.slice(n.startIndex, to).trim().slice(0, 24);
        diags.push({ from: n.startIndex, to: Math.max(to, n.startIndex + 1), severity: "error", message: `Syntax error near '${snippet}'`, code: "syntax" });
        // A MISSING node may still live inside an ERROR; do not descend to avoid duplicates.
        return;
      }
      if (n.hasError()) for (let i = 0; i < n.childCount; i++) visit(n.child(i));
    };
    visit(root);
  }
  if (!opts.semantic) return finish(diags);

  const inc = includeInfo(root);
  const decls = declarations(root);
  const declaredNames = new Set(decls.map((d) => d.name));
  const identDeclPositions = new Set(decls.map((d) => d.identFrom));
  const usedDecls = new Set();
  const c23 = opts.std === "c23";
  const sev = inc.hasUser ? "info" : "warning";
  const reportedHeaders = new Set();

  const missingHeaderCheck = (n, name) => {
    const e = LIBC.get(name);
    if (!e || declaredNames.has(name)) return;
    if (c23 && C23_KEYWORDS.has(name)) return;
    const hs = new Set([...e.headers, ...(ALT_HEADERS[name] || [])]);
    for (const h of hs) if (inc.system.has(h)) return;
    const want = e.headers[0];
    const key = name + "@" + n.startIndex;
    if (reportedHeaders.has(key)) return;
    reportedHeaders.add(key);
    const at = includeInsertion(root, text, inc);
    push(n, sev, `'${name}' is declared in <${want}>, which is not included`, "missing-include", {
      label: `Add #include <${want}>`, from: at, to: at, insert: `#include <${want}>\n`,
    });
  };

  const skipSubtree = (n) => n.hasError();

  walk(root, (n) => {
    if (n !== root && skipSubtree(n)) return false;
    switch (n.type) {
      case "identifier":
      case "type_identifier": {
        if (identDeclPositions.has(n.startIndex)) break;
        const e = LIBC.get(n.text);
        if (e && e.kind !== "function") missingHeaderCheck(n, n.text);
        if (n.type === "identifier") {
          const d = resolve(decls, n.text, n.startIndex);
          if (d) usedDecls.add(d);
        }
        break;
      }
      case "primitive_type": {
        // This grammar parses size_t, uint8_t, ssize_t, ... as primitive types.
        const e = LIBC.get(n.text);
        if (e && e.kind === "type") missingHeaderCheck(n, n.text);
        break;
      }
      case "null":
      case "true":
      case "false":
        missingHeaderCheck(n, n.type === "null" ? "NULL" : n.type);
        break;
      case "call_expression":
        checkCall(n);
        break;
      case "if_statement":
      case "while_statement":
      case "do_statement":
        checkCondition(n);
        if (n.type === "if_statement") checkEmptyBody(n.childForFieldName("consequence"), "if");
        break;
      case "binary_expression":
        checkBinary(n);
        break;
      case "subscript_expression":
        checkSubscript(n);
        break;
      case "function_definition":
        checkFunction(n);
        break;
      case "compound_statement":
        checkBlock(n);
        break;
      default:
    }
    return true;
  });

  // ---- unused locals
  if (opts.unused && !root.hasError()) {
    for (const d of decls) {
      if (d.kind === "variable" && !d.global && !usedDecls.has(d) && !d.name.startsWith("_")) {
        diags.push({ from: d.identFrom, to: d.identTo, severity: "info", message: `Unused variable '${d.name}'`, code: "unused" });
      }
    }
    for (const d of decls) {
      if (d.kind === "variable" && d.global && d.isStatic && !usedDecls.has(d)) {
        diags.push({ from: d.identFrom, to: d.identTo, severity: "info", message: `Unused static variable '${d.name}'`, code: "unused" });
      }
    }
    if (!opts.hints) { /* push() filters; here we pushed directly */ for (let i = diags.length - 1; i >= 0; i--) if (diags[i].severity === "info") diags.splice(i, 1); }
  }
  return finish(diags);

  // ------------------------------------------------------------------ checks
  function checkCall(n) {
    const f = n.childForFieldName("function");
    if (!f || f.type !== "identifier") return;
    const name = f.text;
    const args = callArgs(n);

    const d = resolve(decls, name, f.startIndex);
    if (d) usedDecls.add(d);

    if (name === "gets") {
      push(f, "error", "gets() was removed in C11 and cannot be used safely; use fgets()", "gets");
    } else if (UNSAFE[name] && !d) {
      const [s, m] = UNSAFE[name];
      push(f, s, m, "unsafe-call");
    }

    if (!d) {
      const e = LIBC.get(name);
      if (e) missingHeaderCheck(f, name);
      else if (!ALWAYS_KNOWN.has(name) && !name.startsWith("__") && !/^[A-Z][A-Z0-9_]*$/.test(name)) {
        push(f, inc.hasUser ? "info" : "warning", `Call to undeclared function '${name}' (implicit declaration is invalid since C99)`, "implicit-decl");
      }
    }

    if (!d && name in PRINTF_FMT_ARG && !VA_VARIANTS.has(name)) checkPrintf(n, name, args);
    else if (!d && name in SCANF_FMT_ARG) checkScanf(n, name, args);

    if (!d && (name === "malloc" || name === "calloc") && args.length === 1 && name === "malloc") {
      const a = args[0];
      if (a.type === "number_literal" && a.text === "0") push(a, "info", "malloc(0) returns an implementation-defined result", "malloc-zero");
    }
  }

  function checkPrintf(call, name, args) {
    const idx = PRINTF_FMT_ARG[name];
    const fmtNode = args[idx];
    if (!fmtNode) return;
    const fmt = stringValue(fmtNode);
    if (fmt === null) {
      if (args.length === idx + 1 && (fmtNode.type === "identifier" || fmtNode.type === "call_expression" || fmtNode.type === "subscript_expression" || fmtNode.type === "field_expression")) {
        push(fmtNode, "warning", `Format string is not a literal and no arguments follow; use ${name}(${"\"%s\""}, ...) to avoid format-string injection`, "format-nonliteral");
      }
      return;
    }
    const specs = parseFormat(fmt);
    const need = specs.reduce((a, s) => a + 1 + s.stars, 0);
    const have = args.length - idx - 1;
    if (have < need) {
      push(fmtNode, "error", `Format string expects ${need} argument${need === 1 ? "" : "s"} but ${have} ${have === 1 ? "was" : "were"} given`, "format-args");
    } else if (have > need) {
      push(args[idx + 1 + need], "warning", `Format string consumes ${need} argument${need === 1 ? "" : "s"} but ${have} given`, "format-args");
    }
    let ai = idx + 1;
    for (const s of specs) {
      ai += s.stars;
      const a = args[ai++];
      if (!a) break;
      const kind = argKind(a);
      if (!kind) continue;
      const k = a;
      if (s.conv === "s" && kind !== "string") {
        push(k, "warning", `'%s' expects a string but the argument is ${kind === "size_t" ? "a size" : "a " + kind}`, "format-type");
      } else if ("diuoxXc".includes(s.conv)) {
        if (kind === "string") push(k, "warning", `'%${s.conv}' expects an integer but the argument is a string`, "format-type");
        else if (kind === "float") push(k, "warning", `'%${s.conv}' expects an integer but the argument is floating-point`, "format-type");
        else if (kind === "size_t" && "diu".includes(s.conv) && !s.length) push(k, "warning", `'%${s.conv}' expects int but the argument is size_t; use %zu`, "format-type");
      } else if ("eEfFgGaA".includes(s.conv)) {
        if (kind === "string" || kind === "int" || kind === "char" || kind === "size_t") {
          push(k, "warning", `'%${s.conv}' expects a double but the argument is ${kind === "int" ? "an integer" : "a " + kind}`, "format-type");
        }
      }
    }
  }

  function checkScanf(call, name, args) {
    const idx = SCANF_FMT_ARG[name];
    const fmtNode = args[idx];
    const fmt = stringValue(fmtNode);
    if (fmt === null || fmt === undefined) return;
    const specs = parseFormat(fmt, true).filter((s) => !s.suppressed);
    const need = specs.length;
    const have = args.length - idx - 1;
    if (have < need) push(fmtNode, "error", `Format string expects ${need} pointer argument${need === 1 ? "" : "s"} but ${have} given`, "format-args");
    else if (have > need) push(args[idx + 1 + need], "warning", `Format string consumes ${need} argument${need === 1 ? "" : "s"} but ${have} given`, "format-args");
    for (const s of specs) {
      if (s.conv === "s" && !s.width) {
        push(fmtNode, "warning", "scanf '%s' without a field width can overflow the buffer (e.g. \"%63s\")", "scanf-width");
        break;
      }
    }
    for (let i = idx + 1; i < args.length; i++) {
      const a = args[i];
      const k = argKind(a);
      if (k && k !== "string") push(a, "error", "scanf needs a pointer argument (did you forget '&'?)", "scanf-pointer");
      else if (a.type === "identifier") {
        const d = resolve(decls, a.text, a.startIndex);
        if (d && d.scalar) push(a, "error", `scanf needs a pointer: use &${a.text}`, "scanf-pointer", { label: `Use &${a.text}`, from: a.startIndex, to: a.startIndex, insert: "&" });
      }
    }
  }

  function checkCondition(n) {
    const cond = n.childForFieldName("condition");
    if (!cond || cond.type !== "parenthesized_expression") return;
    const inner = cond.namedChild(0);
    if (inner && inner.type === "assignment_expression") {
      const op = inner.childForFieldName("operator");
      if (op && op.text === "=") {
        push(inner, "warning", "Assignment used as a condition; did you mean '=='? (add extra parentheses if intended)", "assign-in-cond");
      }
    }
  }

  function checkEmptyBody(body, what) {
    if (body && body.type === "expression_statement" && body.namedChildCount === 0) {
      push(body, "warning", `Empty body after '${what}' - stray semicolon?`, "empty-body");
    }
  }

  function checkBinary(n) {
    const op = n.childForFieldName("operator");
    const l = n.childForFieldName("left");
    const r = n.childForFieldName("right");
    if (!op || !l || !r) return;
    if ((op.text === "==" || op.text === "!=") && (isStr(l) || isStr(r))) {
      push(n, "warning", "Comparing a string literal with '" + op.text + "' compares pointers; use strcmp()", "string-compare");
    }
    if ((op.text === "/" || op.text === "%") && r.type === "number_literal" && /^0+$/.test(r.text)) {
      push(r, "error", "Division by zero", "div-zero");
    }
  }
  function isStr(x) { return x.type === "string_literal" || x.type === "concatenated_string"; }

  function checkSubscript(n) {
    const arr = n.childForFieldName("argument");
    const idx = n.childForFieldName("index");
    if (!arr || !idx || arr.type !== "identifier" || idx.type !== "number_literal") return;
    if (!/^\d+$/.test(idx.text)) return;
    const d = resolve(decls, arr.text, arr.startIndex);
    if (d && d.arrayLen != null && parseInt(idx.text, 10) >= d.arrayLen) {
      push(idx, "error", `Index ${idx.text} is out of bounds for '${arr.text}' (size ${d.arrayLen})`, "bounds");
    }
  }

  function checkFunction(fn) {
    const typeNode = fn.childForFieldName("type");
    const declNode = fn.childForFieldName("declarator");
    const body = fn.childForFieldName("body");
    const id = declIdent(declNode);
    if (!typeNode || !id || !body) return;
    const isVoid = typeNode.text === "void" && !isPointerDeclarator(declNode);
    const name = id.text;
    if (name === "main") {
      if (isVoid) push(typeNode, "warning", "'main' must return int", "main-return");
    }
    let hasReturnValue = false;
    let hasBareReturn = false;
    let noreturnCall = false;
    walk(body, (x) => {
      if (x.type === "return_statement") {
        if (x.namedChildCount > 0 && x.namedChild(0).type !== "comment") {
          hasReturnValue = true;
          if (isVoid) push(x, "error", `Void function '${name}' should not return a value`, "void-return");
        } else {
          hasBareReturn = true;
          if (!isVoid) push(x, "warning", `Non-void function '${name}' returns without a value`, "return-value");
        }
      } else if (x.type === "call_expression") {
        const f = x.childForFieldName("function");
        if (f && NORETURN.has(f.text)) noreturnCall = true;
      } else if (x.type === "function_definition") return false;
      return true;
    });
    void hasBareReturn;
    if (!isVoid && name !== "main" && !hasReturnValue && !noreturnCall ) {
      const infinite = /\bwhile\s*\(\s*(?:1|true)\s*\)|\bfor\s*\(\s*;\s*;\s*\)|__asm__|\basm\b/.test(body.text);
      if (!infinite) push(id, "warning", `Non-void function '${name}' never returns a value`, "no-return");
    }
  }

  function checkBlock(block) {
    const kids = [];
    for (let i = 0; i < block.namedChildCount; i++) {
      const c = block.namedChild(i);
      if (c.type !== "comment") kids.push(c);
    }
    for (let i = 0; i < kids.length; i++) {
      const s = kids[i];
      const next = kids[i + 1];
      // unreachable code
      if (next && (s.type === "return_statement" || s.type === "break_statement" || s.type === "continue_statement" || s.type === "goto_statement") &&
          next.type !== "labeled_statement" && next.type !== "case_statement" && next.type !== "preproc_call") {
        push(next, "info", "Unreachable code", "unreachable");
      }
      // use after free
      if (s.type === "expression_statement") {
        const call = s.namedChild(0);
        if (call && call.type === "call_expression") {
          const f = call.childForFieldName("function");
          const a = callArgs(call);
          if (f && f.text === "free" && a.length === 1 && a[0].type === "identifier") {
            const ptr = a[0].text;
            for (let j = i + 1; j < kids.length; j++) {
              const r = classifyAfterFree(kids[j], ptr);
              if (r === "reassigned") break;
              if (r) { push(r, "warning", `'${ptr}' is used after it was freed`, "use-after-free"); break; }
            }
          }
        }
      }
      // unchecked allocation / fopen
      const alloc = allocTarget(s);
      if (alloc) {
        const nxt = kids[i + 1];
        const checked = nxt && ((nxt.type === "if_statement" && mentions(nxt.childForFieldName("condition"), alloc.name)) ||
          (nxt.type === "expression_statement" && /assert/.test(nxt.text) && nxt.text.includes(alloc.name)));
        if (!checked && nxt) {
          push(alloc.node, "info", `Result of ${alloc.fn}() is not checked for NULL before use`, "unchecked-alloc");
        }
      }
    }
  }

  function allocTarget(s) {
    let init = null, name = null;
    if (s.type === "declaration") {
      const decl = s.namedChild(1);
      for (let i = 0; i < s.namedChildCount; i++) {
        const c = s.namedChild(i);
        if (c.type === "init_declarator") { init = c.childForFieldName("value"); name = declIdent(c.childForFieldName("declarator")); }
      }
      void decl;
    } else if (s.type === "expression_statement") {
      const e = s.namedChild(0);
      if (e && e.type === "assignment_expression") {
        const l = e.childForFieldName("left");
        if (l && l.type === "identifier") { name = l; init = e.childForFieldName("right"); }
      }
    }
    if (!init || !name) return null;
    while (init.type === "cast_expression") init = init.childForFieldName("value");
    if (init && init.type === "call_expression") {
      const f = init.childForFieldName("function");
      if (f && ALLOC_FUNCS.has(f.text) && !resolve(decls, f.text, f.startIndex)) return { name: name.text, fn: f.text, node: init };
    }
    return null;
  }

  function mentions(n, name) {
    if (!n) return false;
    let found = false;
    walk(n, (x) => { if (x.type === "identifier" && x.text === name) found = true; return !found; });
    return found;
  }

  /** returns "reassigned", a node using `ptr`, or null */
  function classifyAfterFree(stmt, ptr) {
    if (stmt.type === "expression_statement") {
      const e = stmt.namedChild(0);
      if (e && e.type === "assignment_expression") {
        const l = e.childForFieldName("left");
        if (l && l.type === "identifier" && l.text === ptr) return "reassigned";
      }
    }
    if (stmt.type === "labeled_statement" || stmt.type === "return_statement" && !mentions(stmt, ptr)) return null;
    let hit = null;
    walk(stmt, (x) => {
      if (hit) return false;
      if (x.type === "assignment_expression") {
        const l = x.childForFieldName("left");
        if (l && l.type === "identifier" && l.text === ptr) { hit = hit || "reassigned-inner"; return false; }
      }
      if (x.type === "identifier" && x.text === ptr) { hit = x; return false; }
      return true;
    });
    if (hit === "reassigned-inner") return "reassigned";
    return hit;
  }
}

function finish(diags) {
  const seen = new Set();
  const out = [];
  for (const d of diags) {
    const k = `${d.from}:${d.to}:${d.code}:${d.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  out.sort((a, b) => a.from - b.from);
  return out;
}

/**
 * Minimal lexical checks used when the WASM parser cannot be loaded:
 * bracket balance, unterminated strings/comments, a few unsafe calls.
 */
export function lintFallback(text) {
  const diags = [];
  const stack = [];
  const pairs = { ")": "(", "]": "[", "}": "{" };
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const c2 = text[i + 1];
    if (c === "/" && c2 === "/") { while (i < n && text[i] !== "\n") i++; continue; }
    if (c === "/" && c2 === "*") {
      const e = text.indexOf("*/", i + 2);
      if (e === -1) { diags.push({ from: i, to: i + 2, severity: "error", message: "Unterminated comment", code: "syntax" }); break; }
      i = e + 2; continue;
    }
    if (c === '"' || c === "'") {
      const start = i++;
      while (i < n && text[i] !== c && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
      if (text[i] !== c) diags.push({ from: start, to: start + 1, severity: "error", message: `Unterminated ${c === '"' ? "string" : "character"} literal`, code: "syntax" });
      i++; continue;
    }
    if (c === "(" || c === "[" || c === "{") stack.push({ c, i });
    else if (pairs[c]) {
      const top = stack.pop();
      if (!top || top.c !== pairs[c]) diags.push({ from: i, to: i + 1, severity: "error", message: `Unmatched '${c}'`, code: "syntax" });
    }
    i++;
  }
  for (const s of stack) diags.push({ from: s.i, to: s.i + 1, severity: "error", message: `Unclosed '${s.c}'`, code: "syntax" });
  const re = /\b(gets|strcpy|strcat|sprintf)\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const bad = m[1] === "gets";
    diags.push({ from: m.index, to: m.index + m[1].length, severity: bad ? "error" : "warning", message: bad ? "gets() was removed in C11; use fgets()" : `${m[1]}() does not check bounds`, code: "unsafe-call" });
  }
  return diags.sort((a, b) => a.from - b.from);
}
