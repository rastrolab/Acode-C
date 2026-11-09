// Syntax-tree analysis shared by linting, navigation, completion and refactoring.
// All functions take a tree-sitter node and return plain objects (no node retention).

export function walk(node, fn) {
  if (fn(node) === false) return;
  for (let i = 0, n = node.childCount; i < n; i++) walk(node.child(i), fn);
}

const DECL_WRAPPERS = new Set([
  "init_declarator", "pointer_declarator", "array_declarator", "function_declarator",
  "parenthesized_declarator", "attributed_declarator", "abstract_pointer_declarator",
]);

/** Dig through declarator wrappers to the declared identifier node. */
export function declIdent(d) {
  while (d) {
    const t = d.type;
    if (t === "identifier" || t === "type_identifier" || t === "field_identifier") return d;
    if (!DECL_WRAPPERS.has(t)) return null;
    d = d.childForFieldName("declarator") || d.namedChild(0);
  }
  return null;
}

/** True if the declarator chain contains a pointer. */
export function hasIndirection(d) {
  while (d) {
    if (d.type === "pointer_declarator" || d.type === "array_declarator" || d.type === "function_declarator") return true;
    if (!DECL_WRAPPERS.has(d.type)) return false;
    d = d.childForFieldName("declarator") || d.namedChild(0);
  }
  return false;
}

export function isPointerDeclarator(d) {
  while (d) {
    if (d.type === "pointer_declarator") return true;
    if (!DECL_WRAPPERS.has(d.type)) return false;
    d = d.childForFieldName("declarator") || d.namedChild(0);
  }
  return false;
}

const DECLARATOR_LEAVES = new Set(["identifier", "field_identifier", "type_identifier"]);

/**
 * Declarators of a declaration-like node (web-tree-sitter 0.20 has no childrenForFieldName):
 * every named child that is a declarator form, excluding the `type` child.
 */
function fieldChildren(node, field) {
  if (field !== "declarator") return [];
  const type = node.childForFieldName("type");
  const out = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const c = node.namedChild(i);
    if (type && c.startIndex === type.startIndex && c.type === type.type) continue;
    if (DECL_WRAPPERS.has(c.type) || DECLARATOR_LEAVES.has(c.type)) out.push(c);
  }
  return out;
}

function arrayLength(d) {
  // Outermost dimension of a literal-sized array declarator, if any.
  while (d) {
    if (d.type === "array_declarator") {
      const size = d.childForFieldName("size");
      if (size && size.type === "number_literal" && /^\d+$/.test(size.text)) return parseInt(size.text, 10);
      return null;
    }
    if (!DECL_WRAPPERS.has(d.type)) return null;
    d = d.childForFieldName("declarator") || d.namedChild(0);
  }
  return null;
}

function funcDeclaratorOf(d) {
  while (d) {
    if (d.type === "function_declarator") {
      const inner = d.childForFieldName("declarator");
      // `(*fp)(int)` is a function pointer variable, not a function.
      return inner && inner.type === "parenthesized_declarator" ? null : d;
    }
    if (!DECL_WRAPPERS.has(d.type)) return null;
    d = d.childForFieldName("declarator") || d.namedChild(0);
  }
  return null;
}

/**
 * Scope of a declaration node: the smallest enclosing block-like node.
 * Returns {from,to,global} or null when the declaration introduces no usable name
 * (e.g. prototype parameters).
 */
function scopeOf(node) {
  if (node.type === "parameter_declaration") {
    for (let p = node.parent; p; p = p.parent) {
      const t = p.type;
      if (t === "function_definition") return { from: p.startIndex, to: p.endIndex, global: false };
      if (t === "compound_statement" || t === "declaration" || t === "field_declaration" ||
          t === "type_definition" || t === "translation_unit") return null;
    }
    return null;
  }
  for (let p = node.parent; p; p = p.parent) {
    const t = p.type;
    if (t === "compound_statement" || t === "for_statement") {
      return { from: p.startIndex, to: p.endIndex, global: false };
    }
    if (t === "translation_unit") return { from: p.startIndex, to: p.endIndex, global: true };
  }
  return { from: 0, to: Infinity, global: true };
}

/**
 * Every declared name with its scope.
 * kind: function | prototype | variable | parameter | typedef | macro | enumerator | field | struct | union | enum
 */
export function declarations(root) {
  const out = [];
  const add = (identNode, kind, scopeNode, extra) => {
    if (!identNode) return;
    const scope = scopeOf(scopeNode);
    if (!scope && kind !== "field") return;
    out.push({
      name: identNode.text,
      kind,
      identFrom: identNode.startIndex,
      identTo: identNode.endIndex,
      row: identNode.startPosition.row,
      scopeFrom: scope ? scope.from : 0,
      scopeTo: scope ? scope.to : Infinity,
      global: scope ? scope.global : true,
      ...extra,
    });
  };

  walk(root, (n) => {
    switch (n.type) {
      case "function_definition": {
        const decl = n.childForFieldName("declarator");
        const fd = funcDeclaratorOf(decl);
        const id = declIdent(decl);
        if (id) {
          out.push({
            name: id.text, kind: "function", identFrom: id.startIndex, identTo: id.endIndex,
            row: id.startPosition.row, scopeFrom: 0, scopeTo: Infinity, global: true,
            defFrom: n.startIndex, defTo: n.endIndex,
            detail: signatureText(n),
          });
        }
        void fd;
        return true;
      }
      case "declaration": {
        const type = n.childForFieldName("type");
        for (const d of fieldChildren(n, "declarator")) {
          const id = declIdent(d);
          if (!id) continue;
          const fd = funcDeclaratorOf(d);
          if (fd) {
            add(id, "prototype", n, { defFrom: n.startIndex, defTo: n.endIndex, detail: oneLine(n.text.replace(/;\s*$/, "")) });
          } else {
            add(id, "variable", n, {
              arrayLen: arrayLength(d),
              isStatic: /\bstatic\b/.test(n.text.slice(0, type ? type.startIndex - n.startIndex + 1 : 0)),
              hasInit: d.type === "init_declarator",
              scalar: !!type && type.type === "primitive_type" && !hasIndirection(d),
              declFrom: n.startIndex,
            });
          }
        }
        return true;
      }
      case "parameter_declaration": {
        const id = declIdent(n.childForFieldName("declarator"));
        if (id) {
          const pt = n.childForFieldName("type");
          add(id, "parameter", n, { arrayLen: null, scalar: !!pt && pt.type === "primitive_type" && !hasIndirection(n.childForFieldName("declarator")) });
        }
        return true;
      }
      case "type_definition": {
        for (const d of fieldChildren(n, "declarator")) add(declIdent(d), "typedef", n, { defFrom: n.startIndex, defTo: n.endIndex, detail: oneLine(n.text) });
        return true;
      }
      case "preproc_def":
      case "preproc_function_def": {
        const name = n.childForFieldName("name");
        if (name) {
          const sig = n.type === "preproc_function_def" ? name.text + (n.childForFieldName("parameters")?.text ?? "") : name.text;
          add(name, "macro", n, { defFrom: n.startIndex, defTo: n.endIndex, detail: `#define ${sig}` });
        }
        return true;
      }
      case "enumerator": {
        add(n.childForFieldName("name"), "enumerator", n, {});
        return true;
      }
      case "field_declaration": {
        for (const d of fieldChildren(n, "declarator")) add(declIdent(d), "field", n, {});
        return true;
      }
      case "struct_specifier":
      case "union_specifier":
      case "enum_specifier": {
        const name = n.childForFieldName("name");
        if (name && n.childForFieldName("body")) {
          const kind = n.type.replace("_specifier", "");
          add(name, kind, n, { defFrom: n.startIndex, defTo: n.endIndex, detail: `${kind} ${name.text}` });
        }
        return true;
      }
      default:
        return true;
    }
  });
  return out;
}

function oneLine(s) {
  return s.replace(/\s+/g, " ").trim();
}

function signatureText(fn) {
  const body = fn.childForFieldName("body");
  const end = body ? body.startIndex : fn.endIndex;
  return oneLine(fn.text.slice(0, end - fn.startIndex));
}

/** Find the declaration `name` refers to at `pos`, or null. */
export function resolve(decls, name, pos) {
  let best = null;
  for (const d of decls) {
    if (d.name !== name || d.kind === "field") continue;
    if (pos < d.scopeFrom || pos > d.scopeTo) continue;
    if (!d.global && d.identFrom > pos) continue;
    if (!best) { best = d; continue; }
    const dSize = d.scopeTo - d.scopeFrom;
    const bSize = best.scopeTo - best.scopeFrom;
    // Innermost scope wins; a definition beats a prototype at equal scope.
    if (dSize < bSize || (dSize === bSize && best.kind === "prototype" && d.kind !== "prototype")) best = d;
  }
  return best;
}

/** Outline entries for top-level navigation. */
export function outline(root) {
  const keep = new Set(["function", "prototype", "typedef", "macro", "struct", "union", "enum", "variable"]);
  return declarations(root)
    .filter((d) => d.global && keep.has(d.kind) && (d.kind !== "variable" || d.scopeFrom === 0))
    .map((d) => ({ name: d.name, kind: d.kind, row: d.row, from: d.identFrom, detail: d.detail || d.name }))
    .sort((a, b) => a.from - b.from);
}

/** Identifier occurrences (any naming node) with the given text. */
export function occurrences(root, name) {
  const out = [];
  walk(root, (n) => {
    if (n.childCount === 0 && (n.type === "identifier" || n.type === "type_identifier" || n.type === "field_identifier") && n.text === name) {
      out.push({ from: n.startIndex, to: n.endIndex, type: n.type });
    }
    return true;
  });
  return out;
}

/** Identifier (or field/type identifier) at a document offset. */
export function identifierAt(root, pos) {
  let n = root.descendantForIndex(pos, pos);
  if (n && n.startIndex === pos && pos > 0) {
    // On a boundary, prefer the token that ends here if it is an identifier.
    const prev = root.descendantForIndex(pos - 1, pos - 1);
    if (prev && /identifier$/.test(prev.type) && !(n.type.endsWith("identifier"))) n = prev;
  }
  if (n && /identifier$/.test(n.type)) return { name: n.text, from: n.startIndex, to: n.endIndex, type: n.type };
  return null;
}

/** All struct/union member names (used for `.`/`->` completion). */
export function memberNames(decls) {
  return [...new Set(decls.filter((d) => d.kind === "field").map((d) => d.name))];
}

/** Doxygen-style comment skeleton for the function containing `pos`. */
export function functionAt(root, pos) {
  let n = root.descendantForIndex(pos, pos);
  while (n && n.type !== "function_definition") n = n.parent;
  if (!n) return null;
  const decl = n.childForFieldName("declarator");
  const id = declIdent(decl);
  const fd = funcDeclaratorOf(decl);
  const params = [];
  const plist = fd && fd.childForFieldName("parameters");
  if (plist) {
    for (let i = 0; i < plist.namedChildCount; i++) {
      const p = plist.namedChild(i);
      if (p.type === "parameter_declaration") {
        const pid = declIdent(p.childForFieldName("declarator"));
        if (pid) params.push(pid.text);
      }
    }
  }
  const type = n.childForFieldName("type");
  const returnsVoid = !!type && type.text === "void" && !isPointerDeclarator(decl);
  return { name: id ? id.text : "", params, returnsVoid, from: n.startIndex, row: n.startPosition.row };
}
