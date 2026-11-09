// Thin adapter over the active editor. Primary target is CodeMirror 6 (current Acode);
// a minimal Ace backend keeps formatting usable on older builds.

export function createOps(getEditorManager, cm) {
  const em = () => getEditorManager();
  const view = () => {
    const e = em() && em().editor;
    return e || null;
  };
  const isCM = (v) => !!(v && v.state && typeof v.dispatch === "function" && v.state.doc);

  const ops = {
    view,
    isCM: () => isCM(view()),
    fileName() {
      const f = em() && em().activeFile;
      return (f && f.name) || "";
    },
    fileUri() {
      const f = em() && em().activeFile;
      return (f && f.uri) || "";
    },
    isCFile() {
      return /\.(c|h)$/i.test(ops.fileName());
    },
    text() {
      const v = view();
      if (!v) return "";
      return isCM(v) ? v.state.doc.toString() : v.getValue();
    },
    /** Cursor offset (CM) or row/col-derived offset (Ace). */
    cursor() {
      const v = view();
      if (!v) return 0;
      if (isCM(v)) return v.state.selection.main.head;
      const p = v.getCursorPosition();
      return v.session.doc.positionToIndex(p);
    },
    selection() {
      const v = view();
      if (!v) return { from: 0, to: 0 };
      if (isCM(v)) { const r = v.state.selection.main; return { from: r.from, to: r.to }; }
      const r = v.getSelectionRange();
      return { from: v.session.doc.positionToIndex(r.start), to: v.session.doc.positionToIndex(r.end) };
    },
    lineOf(offset) {
      const v = view();
      if (isCM(v)) return v.state.doc.lineAt(offset).number;
      return v.session.doc.indexToPosition(offset).row + 1;
    },
    lineStart(lineNumber) {
      const v = view();
      if (isCM(v)) return v.state.doc.line(Math.max(1, Math.min(lineNumber, v.state.doc.lines))).from;
      return v.session.doc.positionToIndex({ row: lineNumber - 1, column: 0 });
    },
    wordAtCursor() {
      const v = view();
      if (!v) return null;
      const t = ops.text();
      const { from, to } = ops.selection();
      if (from !== to) return t.slice(from, to).trim() || null;
      const pos = from;
      let a = pos, b = pos;
      while (a > 0 && /\w/.test(t[a - 1])) a--;
      while (b < t.length && /\w/.test(t[b])) b++;
      return a === b ? null : t.slice(a, b);
    },
    goto(offset, select) {
      const v = view();
      if (!v) return;
      if (isCM(v)) {
        const EditorView = cm && cm.get("EditorView");
        const spec = { selection: select ? { anchor: select.from, head: select.to } : { anchor: offset } };
        if (EditorView) spec.effects = EditorView.scrollIntoView(offset, { y: "center" });
        v.dispatch(spec);
        v.focus();
      } else {
        const p = v.session.doc.indexToPosition(offset);
        v.gotoLine(p.row + 1, p.column, true);
        v.focus();
      }
    },
    /** Apply [{from,to,insert}] atomically. */
    change(changes, selection) {
      const v = view();
      if (!v || !changes.length) return;
      if (isCM(v)) {
        const spec = { changes };
        if (selection != null) spec.selection = { anchor: selection };
        v.dispatch(spec);
      } else {
        const sorted = [...changes].sort((a, b) => b.from - a.from);
        for (const c of sorted) {
          const doc = v.session.doc;
          doc.replace({ start: doc.indexToPosition(c.from), end: doc.indexToPosition(c.to) }, c.insert);
        }
      }
    },
    /** Replace the whole document with `next`, touching only the differing middle. */
    replaceAll(next) {
      const cur = ops.text();
      if (cur === next) return false;
      let a = 0;
      const max = Math.min(cur.length, next.length);
      while (a < max && cur.charCodeAt(a) === next.charCodeAt(a)) a++;
      let b = 0;
      while (b < max - a && cur.charCodeAt(cur.length - 1 - b) === next.charCodeAt(next.length - 1 - b)) b++;
      ops.change([{ from: a, to: cur.length - b, insert: next.slice(a, next.length - b) }]);
      return true;
    },
    /** Insert text at cursor, replacing any selection. If the CM snippet API exists and `snippet` is set, use it. */
    insert(text) {
      const { from, to } = ops.selection();
      ops.change([{ from, to, insert: text }], from + text.length);
    },
    insertSnippet(template) {
      const v = view();
      const snippet = cm && cm.get("snippet");
      if (isCM(v) && snippet) {
        const { from, to } = ops.selection();
        snippet(template)(v, { label: "snippet" }, from, to);
        v.focus();
        return true;
      }
      ops.insert(template.replace(/\$\{([^}]*)\}/g, "$1").replace(/\t/g, "    "));
      return false;
    },
    focus() {
      const v = view();
      if (v && v.focus) v.focus();
    },
  };
  return ops;
}
