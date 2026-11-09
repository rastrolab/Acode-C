import { test } from "node:test";
import assert from "node:assert/strict";
import { ready } from "./helpers.js";
import { lint } from "../src/core/lint.js";
import { SAMPLES } from "../src/data/samples.js";
import { SNIPPETS } from "../src/data/snippets.js";
import { LIBC } from "../src/data/libc.js";
import { callTemplate, paramNames } from "../src/core/completion.js";

await ready;

test("every sample program lints without errors or warnings", () => {
  for (const s of SAMPLES) {
    if (s.id === "makefile-note") continue; // two files in one buffer on purpose
    const bad = lint(s.code, { std: "c17" }).filter((d) => d.severity !== "info");
    assert.deepEqual(bad.map((d) => `${d.code}@${d.from}: ${d.message}`), [], s.title);
  }
});

test("snippet templates are well-formed and labels are unique", () => {
  const labels = new Set();
  for (const s of SNIPPETS) {
    assert.ok(!labels.has(s.label), `duplicate label ${s.label}`);
    labels.add(s.label);
    let depth = 0;
    for (const ch of s.body.replace(/\\./g, "")) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      assert.ok(depth >= 0, s.label);
    }
    assert.equal(depth, 0, `${s.label}: unbalanced braces`);
    assert.ok(!LIBC.has(s.label), `${s.label} collides with a libc name`);
  }
});

test("libc table sanity", () => {
  assert.ok(LIBC.size > 300);
  assert.deepEqual(LIBC.get("printf").headers, ["stdio.h"]);
  assert.ok(LIBC.get("strcasecmp").headers.includes("strings.h"));
});

test("call templates", () => {
  assert.equal(callTemplate("memcpy", LIBC.get("memcpy").sig), "memcpy(${dest}, ${src}, ${n})");
  assert.equal(callTemplate("rand", LIBC.get("rand").sig), "rand()");
  assert.deepEqual(paramNames("int printf(const char *format, ...)"), ["format"]);
  assert.deepEqual(paramNames("void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *))"), ["base", "nmemb", "size", "compar"]);
});
