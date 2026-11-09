// Complete, compilable sample programs (C11). Inserted via "C: Insert code sample".
// They are re-formatted with the user's clang-format style at insert time.

export const SAMPLES = [
  {
    id: "hello",
    title: "Hello, world",
    group: "Basics",
    code: `#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}
`,
  },
  {
    id: "args",
    title: "Command-line arguments (getopt)",
    group: "Basics",
    code: `#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static void usage(const char *prog) {
    fprintf(stderr, "usage: %s [-v] [-n count] file...\\n", prog);
}

int main(int argc, char *argv[]) {
    int verbose = 0;
    long count = 1;
    int opt;

    while ((opt = getopt(argc, argv, "vn:h")) != -1) {
        switch (opt) {
        case 'v':
            verbose = 1;
            break;
        case 'n':
            count = strtol(optarg, NULL, 10);
            break;
        case 'h':
        default:
            usage(argv[0]);
            return opt == 'h' ? 0 : 2;
        }
    }

    for (int i = optind; i < argc; i++) {
        if (verbose) printf("processing %s (x%ld)\\n", argv[i], count);
    }
    return 0;
}
`,
  },
  {
    id: "fizzbuzz",
    title: "FizzBuzz",
    group: "Basics",
    code: `#include <stdio.h>

int main(void) {
    for (int i = 1; i <= 100; i++) {
        if (i % 15 == 0)
            puts("FizzBuzz");
        else if (i % 3 == 0)
            puts("Fizz");
        else if (i % 5 == 0)
            puts("Buzz");
        else
            printf("%d\\n", i);
    }
    return 0;
}
`,
  },
  {
    id: "vector",
    title: "Dynamic array (vector of int)",
    group: "Data structures",
    code: `#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int *data;
    size_t len;
    size_t cap;
} Vec;

static void vec_init(Vec *v) {
    v->data = NULL;
    v->len = 0;
    v->cap = 0;
}

static int vec_push(Vec *v, int value) {
    if (v->len == v->cap) {
        size_t new_cap = v->cap ? v->cap * 2 : 8;
        int *tmp = realloc(v->data, new_cap * sizeof *tmp);
        if (tmp == NULL) return -1;
        v->data = tmp;
        v->cap = new_cap;
    }
    v->data[v->len++] = value;
    return 0;
}

static void vec_free(Vec *v) {
    free(v->data);
    vec_init(v);
}

int main(void) {
    Vec v;
    vec_init(&v);
    for (int i = 0; i < 20; i++) {
        if (vec_push(&v, i * i) != 0) {
            perror("vec_push");
            vec_free(&v);
            return 1;
        }
    }
    for (size_t i = 0; i < v.len; i++) printf("%d ", v.data[i]);
    putchar('\\n');
    vec_free(&v);
    return 0;
}
`,
  },
  {
    id: "linkedlist",
    title: "Singly linked list",
    group: "Data structures",
    code: `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *next;
} Node;

static Node *push_front(Node *head, int value) {
    Node *n = malloc(sizeof *n);
    if (n == NULL) return head;
    n->value = value;
    n->next = head;
    return n;
}

static Node *reverse(Node *head) {
    Node *prev = NULL;
    while (head != NULL) {
        Node *next = head->next;
        head->next = prev;
        prev = head;
        head = next;
    }
    return prev;
}

static void print_list(const Node *n) {
    for (; n != NULL; n = n->next) printf("%d -> ", n->value);
    puts("NULL");
}

static void free_list(Node *n) {
    while (n != NULL) {
        Node *next = n->next;
        free(n);
        n = next;
    }
}

int main(void) {
    Node *list = NULL;
    for (int i = 1; i <= 5; i++) list = push_front(list, i);
    print_list(list);
    list = reverse(list);
    print_list(list);
    free_list(list);
    return 0;
}
`,
  },
  {
    id: "stack",
    title: "Fixed-size stack and queue (ring buffer)",
    group: "Data structures",
    code: `#include <stdbool.h>
#include <stdio.h>

#define CAPACITY 8

typedef struct {
    int items[CAPACITY];
    size_t head;
    size_t count;
} Queue;

static bool queue_push(Queue *q, int v) {
    if (q->count == CAPACITY) return false;
    q->items[(q->head + q->count) % CAPACITY] = v;
    q->count++;
    return true;
}

static bool queue_pop(Queue *q, int *out) {
    if (q->count == 0) return false;
    *out = q->items[q->head];
    q->head = (q->head + 1) % CAPACITY;
    q->count--;
    return true;
}

int main(void) {
    Queue q = {0};
    for (int i = 0; i < 10; i++) {
        if (!queue_push(&q, i)) printf("full at %d\\n", i);
    }
    int v;
    while (queue_pop(&q, &v)) printf("%d ", v);
    putchar('\\n');
    return 0;
}
`,
  },
  {
    id: "hashtable",
    title: "Hash table (string to int, open addressing)",
    group: "Data structures",
    code: `#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *key;
    int value;
    int used;
} Entry;

typedef struct {
    Entry *entries;
    size_t cap;
    size_t len;
} Table;

/* FNV-1a */
static uint64_t hash_str(const char *s) {
    uint64_t h = 1469598103934665603ULL;
    for (; *s; s++) {
        h ^= (unsigned char)*s;
        h *= 1099511628211ULL;
    }
    return h;
}

static int table_init(Table *t, size_t cap) {
    t->entries = calloc(cap, sizeof *t->entries);
    t->cap = cap;
    t->len = 0;
    return t->entries ? 0 : -1;
}

static int table_set(Table *t, const char *key, int value) {
    if (t->len * 2 >= t->cap) return -1; /* keep load factor under 50% */
    size_t i = hash_str(key) % t->cap;
    while (t->entries[i].used) {
        if (strcmp(t->entries[i].key, key) == 0) {
            t->entries[i].value = value;
            return 0;
        }
        i = (i + 1) % t->cap;
    }
    t->entries[i].key = strdup(key);
    if (t->entries[i].key == NULL) return -1;
    t->entries[i].value = value;
    t->entries[i].used = 1;
    t->len++;
    return 0;
}

static int *table_get(Table *t, const char *key) {
    size_t i = hash_str(key) % t->cap;
    while (t->entries[i].used) {
        if (strcmp(t->entries[i].key, key) == 0) return &t->entries[i].value;
        i = (i + 1) % t->cap;
    }
    return NULL;
}

static void table_free(Table *t) {
    for (size_t i = 0; i < t->cap; i++) free(t->entries[i].key);
    free(t->entries);
}

int main(void) {
    Table t;
    if (table_init(&t, 64) != 0) return 1;
    table_set(&t, "apple", 3);
    table_set(&t, "pear", 5);
    int *v = table_get(&t, "pear");
    printf("pear = %d\\n", v ? *v : -1);
    table_free(&t);
    return 0;
}
`,
  },
  {
    id: "bst",
    title: "Binary search tree",
    group: "Data structures",
    code: `#include <stdio.h>
#include <stdlib.h>

typedef struct Tree {
    int key;
    struct Tree *left;
    struct Tree *right;
} Tree;

static Tree *insert(Tree *t, int key) {
    if (t == NULL) {
        Tree *n = calloc(1, sizeof *n);
        if (n != NULL) n->key = key;
        return n;
    }
    if (key < t->key)
        t->left = insert(t->left, key);
    else if (key > t->key)
        t->right = insert(t->right, key);
    return t;
}

static void inorder(const Tree *t) {
    if (t == NULL) return;
    inorder(t->left);
    printf("%d ", t->key);
    inorder(t->right);
}

static void destroy(Tree *t) {
    if (t == NULL) return;
    destroy(t->left);
    destroy(t->right);
    free(t);
}

int main(void) {
    Tree *root = NULL;
    int keys[] = {50, 30, 70, 20, 40, 60, 80};
    for (size_t i = 0; i < sizeof keys / sizeof keys[0]; i++) root = insert(root, keys[i]);
    inorder(root);
    putchar('\\n');
    destroy(root);
    return 0;
}
`,
  },
  {
    id: "sorts",
    title: "Sorting: quicksort and qsort()",
    group: "Algorithms",
    code: `#include <stdio.h>
#include <stdlib.h>

static void swap(int *a, int *b) {
    int t = *a;
    *a = *b;
    *b = t;
}

static void quicksort(int *a, int lo, int hi) {
    if (lo >= hi) return;
    int pivot = a[lo + (hi - lo) / 2];
    int i = lo, j = hi;
    while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) swap(&a[i++], &a[j--]);
    }
    quicksort(a, lo, j);
    quicksort(a, i, hi);
}

static int cmp_int(const void *a, const void *b) {
    int x = *(const int *)a, y = *(const int *)b;
    return (x > y) - (x < y);
}

int main(void) {
    int a[] = {9, 4, 7, 1, 8, 2, 6, 3, 5, 0};
    int n = (int)(sizeof a / sizeof a[0]);
    quicksort(a, 0, n - 1);
    for (int i = 0; i < n; i++) printf("%d ", a[i]);
    putchar('\\n');

    int b[] = {3, 1, 2};
    qsort(b, 3, sizeof b[0], cmp_int);
    printf("%d %d %d\\n", b[0], b[1], b[2]);
    return 0;
}
`,
  },
  {
    id: "primes",
    title: "Sieve of Eratosthenes",
    group: "Algorithms",
    code: `#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    const size_t n = 100;
    bool *composite = calloc(n + 1, sizeof *composite);
    if (composite == NULL) return 1;
    for (size_t i = 2; i * i <= n; i++) {
        if (composite[i]) continue;
        for (size_t j = i * i; j <= n; j += i) composite[j] = true;
    }
    for (size_t i = 2; i <= n; i++) {
        if (!composite[i]) printf("%zu ", i);
    }
    putchar('\\n');
    free(composite);
    return 0;
}
`,
  },
  {
    id: "strings",
    title: "String utilities (reverse, trim, split)",
    group: "Algorithms",
    code: `#include <ctype.h>
#include <stdio.h>
#include <string.h>

static void reverse(char *s) {
    for (size_t i = 0, j = strlen(s); i + 1 < j; i++, j--) {
        char t = s[i];
        s[i] = s[j - 1];
        s[j - 1] = t;
    }
}

static char *trim(char *s) {
    while (isspace((unsigned char)*s)) s++;
    char *end = s + strlen(s);
    while (end > s && isspace((unsigned char)end[-1])) end--;
    *end = '\\0';
    return s;
}

int main(void) {
    char buf[] = "  hello, c world  ";
    char *t = trim(buf);
    printf("[%s]\\n", t);
    reverse(t);
    printf("[%s]\\n", t);

    char csv[] = "a,b,c";
    char *save = NULL;
    for (char *tok = strtok_r(csv, ",", &save); tok; tok = strtok_r(NULL, ",", &save))
        printf("token: %s\\n", tok);
    return 0;
}
`,
  },
  {
    id: "filecopy",
    title: "Copy a file",
    group: "Files & system",
    code: `#include <stdio.h>

int main(int argc, char *argv[]) {
    if (argc != 3) {
        fprintf(stderr, "usage: %s src dst\\n", argv[0]);
        return 2;
    }
    FILE *in = fopen(argv[1], "rb");
    if (in == NULL) {
        perror(argv[1]);
        return 1;
    }
    FILE *out = fopen(argv[2], "wb");
    if (out == NULL) {
        perror(argv[2]);
        fclose(in);
        return 1;
    }
    char buf[4096];
    size_t n;
    while ((n = fread(buf, 1, sizeof buf, in)) > 0) {
        if (fwrite(buf, 1, n, out) != n) {
            perror("write");
            fclose(in);
            fclose(out);
            return 1;
        }
    }
    fclose(in);
    return fclose(out) == 0 ? 0 : 1;
}
`,
  },
  {
    id: "wc",
    title: "Word count (wc clone)",
    group: "Files & system",
    code: `#include <ctype.h>
#include <stdio.h>

int main(void) {
    unsigned long lines = 0, words = 0, chars = 0;
    int c, in_word = 0;
    while ((c = getchar()) != EOF) {
        chars++;
        if (c == '\\n') lines++;
        if (isspace(c)) {
            in_word = 0;
        } else if (!in_word) {
            in_word = 1;
            words++;
        }
    }
    printf("%lu %lu %lu\\n", lines, words, chars);
    return 0;
}
`,
  },
  {
    id: "fork",
    title: "fork / exec / wait",
    group: "Files & system",
    code: `#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
        return 1;
    }
    if (pid == 0) {
        execlp("echo", "echo", "hello from child", (char *)NULL);
        perror("execlp");
        _exit(127);
    }
    int status;
    if (waitpid(pid, &status, 0) < 0) {
        perror("waitpid");
        return 1;
    }
    if (WIFEXITED(status)) printf("child exited with %d\\n", WEXITSTATUS(status));
    return 0;
}
`,
  },
  {
    id: "threads",
    title: "Threads with a mutex (pthread)",
    group: "Files & system",
    code: `#include <pthread.h>
#include <stdio.h>

#define THREADS 4
#define ITERATIONS 100000

static long counter = 0;
static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

static void *worker(void *arg) {
    (void)arg;
    for (int i = 0; i < ITERATIONS; i++) {
        pthread_mutex_lock(&lock);
        counter++;
        pthread_mutex_unlock(&lock);
    }
    return NULL;
}

int main(void) {
    pthread_t tid[THREADS];
    for (int i = 0; i < THREADS; i++) pthread_create(&tid[i], NULL, worker, NULL);
    for (int i = 0; i < THREADS; i++) pthread_join(tid[i], NULL);
    printf("counter = %ld (expected %d)\\n", counter, THREADS * ITERATIONS);
    return 0;
}
`,
  },
  {
    id: "tcpecho",
    title: "TCP echo server",
    group: "Files & system",
    code: `#include <arpa/inet.h>
#include <netinet/in.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

int main(void) {
    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) {
        perror("socket");
        return 1;
    }
    int yes = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof addr);
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(8080);

    if (bind(srv, (struct sockaddr *)&addr, sizeof addr) < 0 || listen(srv, 16) < 0) {
        perror("bind/listen");
        close(srv);
        return 1;
    }
    puts("listening on :8080");

    for (;;) {
        int cli = accept(srv, NULL, NULL);
        if (cli < 0) {
            perror("accept");
            continue;
        }
        char buf[1024];
        ssize_t n;
        while ((n = recv(cli, buf, sizeof buf, 0)) > 0) send(cli, buf, (size_t)n, 0);
        close(cli);
    }
}
`,
  },
  {
    id: "matrix",
    title: "Matrix multiply",
    group: "Algorithms",
    code: `#include <stdio.h>

#define N 3

static void matmul(const double a[N][N], const double b[N][N], double out[N][N]) {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            double sum = 0.0;
            for (int k = 0; k < N; k++) sum += a[i][k] * b[k][j];
            out[i][j] = sum;
        }
    }
}

int main(void) {
    double a[N][N] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
    double id[N][N] = {{1, 0, 0}, {0, 1, 0}, {0, 0, 1}};
    double r[N][N];
    matmul(a, id, r);
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) printf("%6.1f", r[i][j]);
        putchar('\\n');
    }
    return 0;
}
`,
  },
  {
    id: "makefile-note",
    title: "Header + implementation pair (module skeleton)",
    group: "Basics",
    code: `/* ---- counter.h ---- */
#ifndef COUNTER_H
#define COUNTER_H

#include <stddef.h>

typedef struct Counter Counter;

Counter *counter_new(void);
void counter_inc(Counter *c);
size_t counter_get(const Counter *c);
void counter_free(Counter *c);

#endif /* COUNTER_H */

/* ---- counter.c ---- */
#include "counter.h"

#include <stdlib.h>

struct Counter {
    size_t value;
};

Counter *counter_new(void) {
    return calloc(1, sizeof(Counter));
}

void counter_inc(Counter *c) {
    c->value++;
}

size_t counter_get(const Counter *c) {
    return c->value;
}

void counter_free(Counter *c) {
    free(c);
}
`,
  },
];
