// Snippet bodies use CodeMirror snippet syntax: ${1:placeholder}, ${} (empty field).
// Leading tabs are converted to the editor's indent unit when applied.

export const KEYWORDS = [
  "auto", "break", "case", "const", "continue", "default", "do", "else", "enum", "extern",
  "for", "goto", "if", "inline", "register", "restrict", "return", "sizeof", "static",
  "struct", "switch", "typedef", "union", "volatile", "while", "_Alignas", "_Alignof",
  "_Atomic", "_Generic", "_Noreturn", "_Static_assert", "_Thread_local", "constexpr",
  "typeof", "nullptr", "static_assert", "thread_local", "alignas", "alignof",
];

export const TYPES = [
  "void", "char", "short", "int", "long", "float", "double", "signed", "unsigned",
  "_Bool", "_Complex", "_Imaginary", "bool", "size_t", "ssize_t", "ptrdiff_t",
  "int8_t", "int16_t", "int32_t", "int64_t", "uint8_t", "uint16_t", "uint32_t", "uint64_t",
  "intptr_t", "uintptr_t", "off_t", "pid_t", "FILE",
];

export const DIRECTIVES = [
  "include", "define", "undef", "if", "ifdef", "ifndef", "elif", "elifdef", "elifndef",
  "else", "endif", "error", "warning", "pragma", "line", "embed",
];

/** @type {{label:string, detail:string, body:string}[]} */
export const SNIPPETS = [
  // --- program skeletons
  { label: "main", detail: "int main(void)", body: "int main(void) {\n\t${}\n\treturn 0;\n}" },
  { label: "maina", detail: "int main(argc, argv)", body: "int main(int argc, char *argv[]) {\n\t${}\n\treturn 0;\n}" },
  { label: "inc", detail: "#include <...>", body: "#include <${stdio.h}>" },
  { label: "incl", detail: "#include \"...\"", body: "#include \"${header.h}\"" },
  { label: "stdhdr", detail: "common standard headers", body: "#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdint.h>\n#include <stdbool.h>\n" },
  { label: "def", detail: "#define", body: "#define ${NAME} ${value}" },
  { label: "defm", detail: "function-like macro", body: "#define ${NAME}(${x}) (${x})" },
  { label: "ifdef", detail: "#ifdef ... #endif", body: "#ifdef ${MACRO}\n${}\n#endif /* ${MACRO} */" },
  { label: "ifndef", detail: "#ifndef ... #endif", body: "#ifndef ${MACRO}\n${}\n#endif /* ${MACRO} */" },
  { label: "guard", detail: "include guard", body: "#ifndef ${HEADER_H}\n#define ${HEADER_H}\n\n${}\n\n#endif /* ${HEADER_H} */" },
  { label: "once", detail: "#pragma once", body: "#pragma once\n" },
  { label: "cpp", detail: "extern \"C\" wrapper for headers", body: "#ifdef __cplusplus\nextern \"C\" {\n#endif\n\n${}\n\n#ifdef __cplusplus\n}\n#endif" },

  // --- control flow
  { label: "if", detail: "if", body: "if (${cond}) {\n\t${}\n}" },
  { label: "ife", detail: "if / else", body: "if (${cond}) {\n\t${}\n} else {\n\t${}\n}" },
  { label: "elif", detail: "else if", body: "else if (${cond}) {\n\t${}\n}" },
  { label: "for", detail: "for (int i...)", body: "for (${size_t} ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}" },
  { label: "forr", detail: "reverse for loop", body: "for (${int} ${i} = ${n} - 1; ${i} >= 0; ${i}--) {\n\t${}\n}" },
  { label: "fore", detail: "for over array", body: "for (size_t ${i} = 0; ${i} < sizeof(${arr}) / sizeof((${arr})[0]); ${i}++) {\n\t${}\n}" },
  { label: "while", detail: "while", body: "while (${cond}) {\n\t${}\n}" },
  { label: "do", detail: "do ... while", body: "do {\n\t${}\n} while (${cond});" },
  { label: "switch", detail: "switch", body: "switch (${expr}) {\ncase ${value}:\n\t${}\n\tbreak;\ndefault:\n\tbreak;\n}" },
  { label: "case", detail: "case ...: break;", body: "case ${value}:\n\t${}\n\tbreak;" },

  // --- declarations
  { label: "fn", detail: "function", body: "${void} ${name}(${void}) {\n\t${}\n}" },
  { label: "sfn", detail: "static function", body: "static ${void} ${name}(${void}) {\n\t${}\n}" },
  { label: "struct", detail: "struct", body: "struct ${name} {\n\t${int} ${field};\n};" },
  { label: "tdstruct", detail: "typedef struct", body: "typedef struct ${name} {\n\t${int} ${field};\n} ${name}_t;" },
  { label: "enum", detail: "enum", body: "enum ${name} {\n\t${NAME_A},\n\t${NAME_B},\n};" },
  { label: "tdenum", detail: "typedef enum", body: "typedef enum {\n\t${NAME_A},\n\t${NAME_B},\n} ${name}_t;" },
  { label: "union", detail: "union", body: "union ${name} {\n\t${int} ${a};\n\t${float} ${b};\n};" },
  { label: "tdfn", detail: "function pointer typedef", body: "typedef ${int} (*${name}_fn)(${void});" },
  { label: "arr", detail: "array with length", body: "${int} ${name}[${N}] = {${0}};" },
  { label: "sassert", detail: "_Static_assert", body: "_Static_assert(${cond}, \"${message}\");" },

  // --- I/O
  { label: "pf", detail: "printf", body: "printf(\"${%d}\\n\", ${value});" },
  { label: "epf", detail: "fprintf(stderr, ...)", body: "fprintf(stderr, \"${message}\\n\"${});" },
  { label: "sc", detail: "scanf with check", body: "if (scanf(\"${%d}\", &${var}) != 1) {\n\tfprintf(stderr, \"invalid input\\n\");\n\treturn 1;\n}" },
  { label: "readline", detail: "read a line with fgets", body: "char ${line}[${256}];\nif (fgets(${line}, sizeof ${line}, ${stdin}) == NULL) {\n\t${}\n}\n${line}[strcspn(${line}, \"\\n\")] = '\\0';" },
  { label: "getlineloop", detail: "POSIX getline loop", body: "char *${line} = NULL;\nsize_t ${cap} = 0;\nssize_t ${len};\nwhile ((${len} = getline(&${line}, &${cap}, ${stdin})) != -1) {\n\t${}\n}\nfree(${line});" },
  { label: "freadfile", detail: "open, read, close file", body: "FILE *${fp} = fopen(${\"path\"}, \"r\");\nif (${fp} == NULL) {\n\tperror(\"fopen\");\n\treturn 1;\n}\n${}\nfclose(${fp});" },
  { label: "fwritefile", detail: "open for writing", body: "FILE *${fp} = fopen(${\"path\"}, \"w\");\nif (${fp} == NULL) {\n\tperror(\"fopen\");\n\treturn 1;\n}\nfprintf(${fp}, \"${}\");\nfclose(${fp});" },
  { label: "slurp", detail: "read whole file into memory", body: "static char *read_file(const char *path, size_t *out_len) {\n\tFILE *f = fopen(path, \"rb\");\n\tif (!f) return NULL;\n\tfseek(f, 0, SEEK_END);\n\tlong n = ftell(f);\n\trewind(f);\n\tchar *buf = malloc((size_t)n + 1);\n\tif (!buf) { fclose(f); return NULL; }\n\tsize_t got = fread(buf, 1, (size_t)n, f);\n\tbuf[got] = '\\0';\n\tfclose(f);\n\tif (out_len) *out_len = got;\n\treturn buf;\n}" },

  // --- memory
  { label: "mallocchk", detail: "malloc with NULL check", body: "${int} *${p} = malloc(${n} * sizeof *${p});\nif (${p} == NULL) {\n\tperror(\"malloc\");\n\treturn ${1};\n}\n${}" },
  { label: "callocchk", detail: "calloc with NULL check", body: "${int} *${p} = calloc(${n}, sizeof *${p});\nif (${p} == NULL) {\n\tperror(\"calloc\");\n\treturn ${1};\n}\n${}" },
  { label: "reallocsafe", detail: "safe realloc", body: "${int} *${tmp} = realloc(${p}, ${n} * sizeof *${p});\nif (${tmp} == NULL) {\n\tfree(${p});\n\treturn ${1};\n}\n${p} = ${tmp};" },
  { label: "freen", detail: "free and NULL", body: "free(${p});\n${p} = NULL;" },
  { label: "memzero", detail: "memset to zero", body: "memset(${p}, 0, sizeof *${p});" },
  { label: "swap", detail: "swap two variables", body: "${int} ${tmp} = ${a};\n${a} = ${b};\n${b} = ${tmp};" },
  { label: "countof", detail: "array length macro", body: "#define COUNT_OF(a) (sizeof(a) / sizeof((a)[0]))" },
  { label: "minmax", detail: "MIN / MAX macros", body: "#define MIN(a, b) ((a) < (b) ? (a) : (b))\n#define MAX(a, b) ((a) > (b) ? (a) : (b))" },

  // --- error handling / utilities
  { label: "perr", detail: "perror and return", body: "perror(\"${msg}\");\nreturn ${1};" },
  { label: "errnomsg", detail: "report errno", body: "fprintf(stderr, \"${msg}: %s\\n\", strerror(errno));" },
  { label: "assertx", detail: "assert", body: "assert(${cond});" },
  { label: "goto", detail: "goto cleanup pattern", body: "int rc = -1;\n${}\n\ncleanup:\n\treturn rc;" },
  { label: "qsortcmp", detail: "qsort comparator", body: "static int cmp_${int}(const void *a, const void *b) {\n\tconst ${int} x = *(const ${int} *)a;\n\tconst ${int} y = *(const ${int} *)b;\n\treturn (x > y) - (x < y);\n}" },
  { label: "bsearchcall", detail: "bsearch call", body: "${int} *${hit} = bsearch(&${key}, ${arr}, ${n}, sizeof ${arr}[0], ${cmp});" },
  { label: "strtolchk", detail: "checked strtol", body: "char *end;\nerrno = 0;\nlong ${v} = strtol(${str}, &end, 10);\nif (errno != 0 || end == ${str} || *end != '\\0') {\n\tfprintf(stderr, \"invalid number: %s\\n\", ${str});\n\treturn 1;\n}" },
  { label: "timeit", detail: "measure elapsed time", body: "struct timespec t0, t1;\nclock_gettime(CLOCK_MONOTONIC, &t0);\n${}\nclock_gettime(CLOCK_MONOTONIC, &t1);\ndouble ms = (t1.tv_sec - t0.tv_sec) * 1e3 + (t1.tv_nsec - t0.tv_nsec) / 1e6;\nprintf(\"elapsed: %.3f ms\\n\", ms);" },
  { label: "getoptloop", detail: "getopt option loop", body: "int opt;\nwhile ((opt = getopt(argc, argv, \"${ho:v}\")) != -1) {\n\tswitch (opt) {\n\tcase 'h':\n\t\t${}\n\t\tbreak;\n\tdefault:\n\t\tfprintf(stderr, \"usage: %s [-h]\\n\", argv[0]);\n\t\treturn 1;\n\t}\n}" },
  { label: "sigint", detail: "SIGINT handler", body: "static volatile sig_atomic_t ${stop} = 0;\nstatic void on_signal(int sig) { (void)sig; ${stop} = 1; }\n/* in main: */\nsignal(SIGINT, on_signal);" },

  // --- threads
  { label: "pthread", detail: "create and join a thread", body: "static void *${worker}(void *arg) {\n\t${}\n\treturn NULL;\n}\n\npthread_t ${tid};\npthread_create(&${tid}, NULL, ${worker}, NULL);\npthread_join(${tid}, NULL);" },
  { label: "mutex", detail: "lock / unlock", body: "pthread_mutex_lock(&${mu});\n${}\npthread_mutex_unlock(&${mu});" },

  // --- docs
  { label: "doc", detail: "Doxygen function comment", body: "/**\n * @brief ${Summary.}\n *\n * @param ${name} ${description}\n * @return ${description}\n */" },
  { label: "fileh", detail: "file header comment", body: "/**\n * @file ${file.c}\n * @brief ${Summary.}\n */" },
  { label: "todo", detail: "TODO comment", body: "/* TODO: ${} */" },
];
