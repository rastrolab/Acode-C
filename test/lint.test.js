import { test } from "node:test";
import assert from "node:assert/strict";
import { ready } from "./helpers.js";
import { lint, lintFallback, parseFormat } from "../src/core/lint.js";

await ready;
const codes = (src, o) => lint(src, o).map((d) => d.code);
const has = (src, code, o) => assert.ok(codes(src, o).includes(code), `expected ${code} in ${JSON.stringify(lint(src, o).map(d => d.code + ':' + d.message))}`);
const hasNot = (src, code, o) => assert.ok(!codes(src, o).includes(code), `unexpected ${code}`);

test("clean program has no errors or warnings", () => {
  const src = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct { int x; } P;
static int sq(int v) { return v * v; }
int main(int argc, char **argv) {
  char buf[16];
  char *p = malloc(10);
  if (p == NULL) return 1;
  snprintf(buf, sizeof buf, "%d %s %zu", sq(argc), argv[0], strlen(argv[0]));
  printf("%s\\n", buf);
  free(p);
  return 0;
}`;
  const bad = lint(src).filter((d) => d.severity !== "info");
  assert.deepEqual(bad, []);
});

test("syntax errors", () => {
  has("int main(void){ int x = ; return 0 }", "syntax");
  has("int f( { }", "syntax");
});

test("missing include with fix", () => {
  const d = lint("int main(void){ printf(\"hi\\n\"); return 0; }").find((x) => x.code === "missing-include");
  assert.ok(d); assert.match(d.fix.insert, /#include <stdio.h>/);
  hasNot("#include <stdio.h>\nint main(void){ printf(\"hi\\n\"); return 0; }", "missing-include");
});

test("missing include for types and NULL", () => {
  has("int main(void){ uint8_t b = 0; (void)b; return 0; }", "missing-include");
  has("int main(void){ char *p = NULL; (void)p; return 0; }", "missing-include");
  hasNot("#include <stdint.h>\nint main(void){ uint8_t b = 0; (void)b; return 0; }", "missing-include");
  hasNot("#include <string.h>\nint main(void){ char *p = NULL; (void)p; return 0; }", "missing-include");
  hasNot("#include <stdbool.h>\nint main(void){ bool b = true; return b; }", "missing-include");
  hasNot("int main(void){ bool b = true; return b; }", "missing-include", { std: "c23" });
});

test("gets / unsafe", () => {
  has("#include <stdio.h>\nint main(void){ char b[8]; gets(b); return 0; }", "gets");
  has("#include <string.h>\nvoid f(char*d,const char*s){ strcpy(d,s); }", "unsafe-call");
});

test("implicit declaration", () => {
  has("int main(void){ foo(1); return 0; }", "implicit-decl");
  hasNot("static int foo(int x){return x;}\nint main(void){ return foo(1); }", "implicit-decl");
  const d = lint("#include \"mine.h\"\nint main(void){ foo(1); return 0; }").find((x) => x.code === "implicit-decl");
  assert.equal(d.severity, "info");
});

test("function pointer call is not implicit decl", () => {
  hasNot("int run(int (*cb)(int)){ return cb(1); }", "implicit-decl");
});

test("printf format checks", () => {
  const h = "#include <stdio.h>\n";
  has(h + "int main(void){ printf(\"%d %d\\n\", 1); return 0; }", "format-args");
  has(h + "int main(void){ printf(\"%d\\n\", 1, 2); return 0; }", "format-args");
  has(h + "int main(void){ printf(\"%s\\n\", 3); return 0; }", "format-type");
  has(h + "int main(void){ printf(\"%d\\n\", \"x\"); return 0; }", "format-type");
  has(h + "int main(void){ printf(\"%f\\n\", 3); return 0; }", "format-type");
  has(h + "int main(void){ printf(\"%d\\n\", sizeof(int)); return 0; }", "format-type");
  hasNot(h + "int main(void){ printf(\"%zu %5.2f %c %%\\n\", sizeof(int), 1.5, 'a'); return 0; }", "format-type");
  hasNot(h + "int main(void){ printf(\"%*d\\n\", 5, 1); return 0; }", "format-args");
  has(h + "int main(int c,char**v){ printf(v[1]); return 0; }", "format-nonliteral");
});

test("scanf checks", () => {
  const h = "#include <stdio.h>\n";
  has(h + "int main(void){ int x; scanf(\"%d\", x); return 0; }", "scanf-pointer");
});

test("assignment in condition, empty if, string compare", () => {
  has("int f(int a,int b){ if (a = b) return 1; return 0; }", "assign-in-cond");
  hasNot("int f(int a,int b){ if ((a = b)) return 1; return 0; }", "assign-in-cond");
  has("int f(int a){ if (a > 1); return a; }", "empty-body");
  has("int f(const char*s){ return s == \"x\"; }", "string-compare");
});

test("returns", () => {
  has("int f(void){ }", "no-return", {});
  has("int f(int a){ if (a) return 1; return; }", "return-value");
  has("void g(void){ return 1; }", "void-return");
  has("void main(void){ }", "main-return");
  hasNot("#include <stdlib.h>\nint f(void){ exit(1); }", "no-return");
  hasNot("int f(void){ for(;;){} }", "no-return");
});

test("bounds & div zero", () => {
  has("int main(void){ int a[5]; a[5] = 1; return a[0]; }", "bounds");
  hasNot("int main(void){ int a[5]; a[4] = 1; return a[0]; }", "bounds");
  has("int f(int a){ return a / 0; }", "div-zero");
});

test("use after free and unchecked alloc", () => {
  const h = "#include <stdlib.h>\n";
  has(h + "int main(void){ int *p = malloc(4); if (!p) return 1; free(p); *p = 1; return 0; }", "use-after-free");
  hasNot(h + "int main(void){ int *p = malloc(4); if (!p) return 1; free(p); p = NULL; return 0; }", "use-after-free");
  hasNot(h + "int main(void){ int *p = malloc(4); if (!p) return 1; free(p); p = malloc(4); if(!p) return 1; *p = 1; free(p); return 0; }", "use-after-free");
  has(h + "int main(void){ int *p = malloc(4); *p = 1; free(p); return 0; }", "unchecked-alloc");
  hasNot(h + "int main(void){ int *p = malloc(4); if (p == NULL) return 1; *p = 1; free(p); return 0; }", "unchecked-alloc");
});

test("unused & unreachable", () => {
  has("int main(void){ int unused = 3; return 0; }", "unused");
  hasNot("int main(void){ int used = 3; return used; }", "unused");
  hasNot("int f(int p){ int x = p; { int x = 2; return x; } }", "x");
  has("int f(void){ return 1; int y = 2; }", "unreachable");
});

test("scoped resolution does not confuse shadowed names", () => {
  const src = "int g(int a){ return a; }\nint main(void){ int a = 1; { int a = 2; (void)a; } return g(a); }";
  hasNot(src, "unused");
});

test("fallback lint", () => {
  assert.ok(lintFallback("int main( { ").length > 0);
  assert.equal(lintFallback("int main(void){ return 0; }").length, 0);
  assert.ok(lintFallback('char *s = "abc;\n').length > 0);
});

test("parseFormat", () => {
  assert.equal(parseFormat("%d %5.2f %% %-10s %*d %lu %zu").length, 6);
});

test("no unused-variable hints while the file has syntax errors", () => {
  hasNot("int main(void){ int a = 1; return a }", "unused");
});
