# Third-party notices

This plugin bundles the following open-source components.

| Component | Use | License |
|---|---|---|
| [web-tree-sitter](https://github.com/tree-sitter/tree-sitter) 0.20.8 | Incremental parser runtime (`assets/tree-sitter.wasm`) | MIT |
| [tree-sitter-c](https://github.com/tree-sitter/tree-sitter-c) (prebuilt via [tree-sitter-wasms](https://github.com/Gregoor/tree-sitter-wasms)) | C grammar (`assets/tree-sitter-c.wasm`) | MIT |
| [@wasm-fmt/clang-format](https://github.com/wasm-fmt/clang-format) | clang-format compiled to WebAssembly (`assets/clang-format.wasm`) | Apache-2.0 WITH LLVM-exception (LLVM project) / MIT wrapper |
| [@codemirror/legacy-modes](https://github.com/codemirror/legacy-modes) | `clike` tokenizer used for the "C (Toolkit)" highlighting mode | MIT |

The standard-library reference text in `src/data/libc.js` is original summary text written for this project.
