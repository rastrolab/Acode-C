# C Language Toolkit for Acode

Full-featured C support for the [Acode](https://acode.app) editor on Android, with no Termux, language server or network connection required. Everything runs on-device in WebAssembly.

| Feature | How it works |
|---|---|
| **Syntax highlighting** | A "C (Toolkit)" mode that extends CodeMirror's C tokenizer by highlighting standard-library names |
| **Linting** | A real C parser ([tree-sitter-c](https://github.com/tree-sitter/tree-sitter-c)) for syntax errors, plus semantic checks (see below) |
| **Formatting** | The real [clang-format](https://clang.llvm.org/docs/ClangFormat.html) compiled to WebAssembly: LLVM, Google, Chromium, Mozilla, WebKit, Microsoft, GNU, Linux-kernel, or your own style |
| **Completion** | Keywords, about 400 libc/POSIX functions, types and macros (with signature placeholders), symbols from your file, `.`/`->` members, `#include` headers |
| **Hover docs** | Signature, description and required header for libc symbols and your own functions |
| **Snippets** | 63 (`main`, `for`, `mallocchk`, `readline`, `pthread`, `getoptloop`...) |
| **Code samples** | 18 complete programs: linked list, hash table, BST, vector, sorting, TCP echo server, fork/exec, threads, ... |
| **Navigation** | Outline, go to definition, scope-aware rename |
| **Helpers** | Include guards, Doxygen comments, add missing `#include`s, copy a `gcc` command for Termux |

## Install

1. Download [`release/acode-c.zip`](release/acode-c.zip) to your phone.
2. In Acode: **Settings > Plugins > (install from storage)** and pick the zip.
3. Open a `.c` or `.h` file. Linting, completion and hover attach automatically.

Format with Acode's normal "Format" action, or from the command palette (**C: Format document**).

## Commands

Open the command palette and type `C:`.

`Format document` / `Format selection` / `Show problems` / `Add all missing #includes` / `Go to symbol (outline)` / `Go to definition` / `Rename symbol` / `Show documentation for symbol` / `Add #include` / `Insert include guard` / `Insert Doxygen comment for function` / `Insert snippet` / `Insert code sample` / `Copy gcc compile command` / `Toggle linting` / `Settings` / `Toolkit status`

Bind any of them to a key in Acode's keybinding settings (command names start with `c-toolkit:`).

## What the linter catches

* Syntax errors and missing tokens
* Missing `#include` for functions, types and macros (with a one-tap fix)
* `gets()` and other unsafe calls (`strcpy`, `sprintf`, `scanf("%s")` without width, ...)
* `printf`/`scanf` argument count and type mismatches, non-literal format strings
* `if (a = b)`, `if (x);`, comparing strings with `==`, division by zero
* Constant array index out of bounds
* Use after `free`, unchecked `malloc`/`fopen` results
* Non-void function that never returns a value, `void main`, unreachable code
* Calls to undeclared functions, unused variables (scope-aware)

It is a fast, parser-based linter, not a compiler: it has no type checker and does not follow `#include`d files. When your file includes a project header (`#include "x.h"`), "undeclared" findings are downgraded to hints.

## Settings

**C: Settings** lets you choose the format preset, indent width, tabs vs spaces, column limit, custom clang-format YAML, the C standard (affects `bool`/`true`/`false` under C23), and each lint category. A `.clang-format` file in the file's folder or up to five parents is used automatically when available.

## Building from source

```sh
npm install
npm test          # unit tests (parser, linter, formatter, data)
npm run build     # dist/main.js
npm run pack      # release/acode-c.zip
node scripts/make-icon.mjs   # regenerate icon.png
```

The `assets/*.wasm` files are copied from `node_modules` (`web-tree-sitter`, `tree-sitter-wasms`, `@wasm-fmt/clang-format`). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Compatibility notes

Current Acode builds use CodeMirror 6. The plugin reaches CodeMirror through `acode.require("codemirror")` and feature-detects every module it uses. If a part is missing it degrades instead of failing: no `@codemirror/lint` gives built-in squiggles, and a WASM load failure gives a lexical linter and a brace-based re-indenter. **C: Toolkit status** reports what loaded.

If Acode keeps using its built-in C mode for a file, highlighting stays the built-in one. Pick **C (Toolkit)** from the mode picker to get the extended highlighting. Linting, completion and hover do not depend on this.

## License

MIT. Bundled components keep their own licenses.
