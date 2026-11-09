import Parser from "web-tree-sitter";

let parser = null;
let initPromise = null;
let cached = { text: null, tree: null };

/**
 * Initialise tree-sitter. `load(name)` must resolve to an ArrayBuffer/Uint8Array for
 * "tree-sitter.wasm" and "tree-sitter-c.wasm".
 */
export function initParser(load) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const core = new Uint8Array(await load("tree-sitter.wasm"));
    await Parser.init({ wasmBinary: core });
    const lang = await Parser.Language.load(new Uint8Array(await load("tree-sitter-c.wasm")));
    parser = new Parser();
    parser.setLanguage(lang);
    return true;
  })().catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}

export const parserReady = () => parser !== null;

/**
 * Parse `text` and run `fn(rootNode)` synchronously. Nodes are backed by WASM memory and
 * must not be retained after `fn` returns, so `fn` must return plain data.
 * Returns undefined if the parser is not initialised.
 */
export function withTree(text, fn) {
  if (!parser) return undefined;
  if (cached.text !== text) {
    if (cached.tree) cached.tree.delete();
    cached = { text, tree: parser.parse(text) };
  }
  return fn(cached.tree.rootNode);
}

export function disposeParser() {
  if (cached.tree) cached.tree.delete();
  cached = { text: null, tree: null };
  if (parser) parser.delete();
  parser = null;
  initPromise = null;
}
