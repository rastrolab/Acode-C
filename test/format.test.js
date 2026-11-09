import { test, before } from "node:test";
import assert from "node:assert/strict";
import { loadAsset } from "./helpers.js";
import { initFormatter, formatC, buildStyle, formatFallback, STYLES } from "../src/core/format.js";

before(async () => { await initFormatter(loadAsset); });

const ugly = "#include <stdio.h>\nint main(){int x=1;if(x){printf(\"hi\\n\");}\nreturn 0;}\n";

test("clang-format with indent override", () => {
  const out = formatC(ugly, buildStyle({ style: "LLVM", indentWidth: 2 }));
  assert.match(out, /\n  int x = 1;/);
});

test("all styles produce output", () => {
  for (const s of STYLES.filter((s) => s !== "Custom")) {
    const out = formatC(ugly, buildStyle({ style: s }));
    assert.match(out, /main\s*\(\)/, s);
  }
});

test("linux style uses tabs", () => {
  assert.match(formatC(ugly, buildStyle({ style: "Linux" })), /\n\tint x = 1;/);
});

test("custom style", () => {
  const out = formatC(ugly, buildStyle({ style: "Custom", custom: "BasedOnStyle: Google\nIndentWidth: 3" }));
  assert.match(out, /\n   int x = 1;/);
});

test("line range", () => {
  const src = "int  a  =  1;\nint  b  =  2;\nint  c  =  3;\n";
  const out = formatC(src, "LLVM", { fromLine: 2, toLine: 2 });
  assert.equal(out, "int  a  =  1;\nint b = 2;\nint  c  =  3;\n");
});

test("fallback formatter indents by braces", () => {
  const out = formatFallback("int main(){\nif(1){\nreturn 0;\n}\n}\n", { indentWidth: 2 });
  assert.equal(out, "int main(){\n  if(1){\n    return 0;\n  }\n}\n");
});

test("syntax errors do not throw", () => {
  assert.equal(typeof formatC("int main( {", "LLVM"), "string");
});
