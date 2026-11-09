// Standard C / POSIX library reference.
// Line formats (inside a "#header" section):
//   fn|<full signature>|<description>
//   T |<type name>|<description>
//   M |<macro or constant>|<description>
// Multiple headers may be given: "#string.h,strings.h".

const RAW = `
#stdio.h
fn|int printf(const char *format, ...)|Write formatted output to stdout. Returns characters written or a negative value on error.
fn|int fprintf(FILE *stream, const char *format, ...)|Write formatted output to a stream.
fn|int sprintf(char *buf, const char *format, ...)|Write formatted output into buf. Unbounded: prefer snprintf.
fn|int snprintf(char *buf, size_t size, const char *format, ...)|Write at most size bytes (including NUL) of formatted output into buf.
fn|int dprintf(int fd, const char *format, ...)|Write formatted output to a file descriptor.
fn|int vprintf(const char *format, va_list ap)|printf taking a va_list.
fn|int vfprintf(FILE *stream, const char *format, va_list ap)|fprintf taking a va_list.
fn|int vsnprintf(char *buf, size_t size, const char *format, va_list ap)|snprintf taking a va_list.
fn|int vsprintf(char *buf, const char *format, va_list ap)|sprintf taking a va_list. Unbounded: prefer vsnprintf.
fn|int scanf(const char *format, ...)|Read formatted input from stdin. Returns the number of items assigned or EOF.
fn|int fscanf(FILE *stream, const char *format, ...)|Read formatted input from a stream.
fn|int sscanf(const char *str, const char *format, ...)|Read formatted input from a string.
fn|int puts(const char *s)|Write s and a trailing newline to stdout.
fn|int fputs(const char *s, FILE *stream)|Write s to a stream (no newline added).
fn|int putchar(int c)|Write one character to stdout.
fn|int putc(int c, FILE *stream)|Write one character to a stream (may be a macro).
fn|int fputc(int c, FILE *stream)|Write one character to a stream.
fn|int getchar(void)|Read one character from stdin. Returns an int so EOF can be detected.
fn|int getc(FILE *stream)|Read one character from a stream (may be a macro).
fn|int fgetc(FILE *stream)|Read one character from a stream.
fn|int ungetc(int c, FILE *stream)|Push a character back onto an input stream.
fn|char *fgets(char *s, int size, FILE *stream)|Read at most size-1 characters, stopping after a newline. Returns NULL on EOF/error.
fn|char *gets(char *s)|REMOVED in C11. Cannot be used safely: use fgets.
fn|ssize_t getline(char **lineptr, size_t *n, FILE *stream)|POSIX. Read a whole line into a malloc'd buffer. Caller frees *lineptr.
fn|FILE *fopen(const char *path, const char *mode)|Open a file. Modes: r, w, a, r+, w+, a+ (add b for binary). Returns NULL on failure.
fn|FILE *freopen(const char *path, const char *mode, FILE *stream)|Reopen a stream on a different file.
fn|FILE *fdopen(int fd, const char *mode)|POSIX. Associate a stream with a file descriptor.
fn|FILE *tmpfile(void)|Create a temporary binary file removed on close.
fn|int fclose(FILE *stream)|Flush and close a stream.
fn|int fflush(FILE *stream)|Flush buffered output. fflush(NULL) flushes all output streams.
fn|size_t fread(void *ptr, size_t size, size_t nmemb, FILE *stream)|Read nmemb items of size bytes. Returns the number of items read.
fn|size_t fwrite(const void *ptr, size_t size, size_t nmemb, FILE *stream)|Write nmemb items of size bytes. Returns the number of items written.
fn|int fseek(FILE *stream, long offset, int whence)|Reposition a stream. whence: SEEK_SET, SEEK_CUR, SEEK_END.
fn|long ftell(FILE *stream)|Current position of a stream, or -1 on error.
fn|void rewind(FILE *stream)|Reset the stream position to the start.
fn|int fgetpos(FILE *stream, fpos_t *pos)|Store the current position.
fn|int fsetpos(FILE *stream, const fpos_t *pos)|Restore a stored position.
fn|int feof(FILE *stream)|Nonzero if the end-of-file indicator is set.
fn|int ferror(FILE *stream)|Nonzero if the error indicator is set.
fn|void clearerr(FILE *stream)|Clear the EOF and error indicators.
fn|void perror(const char *s)|Print s and the message for the current errno to stderr.
fn|int remove(const char *path)|Delete a file.
fn|int rename(const char *old, const char *new)|Rename or move a file.
fn|int setvbuf(FILE *stream, char *buf, int mode, size_t size)|Set stream buffering (_IOFBF, _IOLBF, _IONBF).
fn|void setbuf(FILE *stream, char *buf)|Set stream buffer.
fn|int fileno(FILE *stream)|POSIX. File descriptor of a stream.
fn|FILE *popen(const char *command, const char *type)|POSIX. Run a command and open a pipe to it.
fn|int pclose(FILE *stream)|POSIX. Close a popen stream and wait for the command.
T |FILE|Opaque stream type.
T |fpos_t|Stream position type.
M |stdin|Standard input stream.
M |stdout|Standard output stream.
M |stderr|Standard error stream.
M |EOF|End-of-file / error return value (negative int).
M |BUFSIZ|Default stream buffer size.
M |SEEK_SET|fseek origin: start of file.
M |SEEK_CUR|fseek origin: current position.
M |SEEK_END|fseek origin: end of file.
M |FILENAME_MAX|Maximum length of a file name.
M |FOPEN_MAX|Minimum number of files that can be open at once.

#stdlib.h
fn|void *malloc(size_t size)|Allocate size uninitialised bytes. Returns NULL on failure; release with free.
fn|void *calloc(size_t nmemb, size_t size)|Allocate zero-initialised memory for nmemb elements.
fn|void *realloc(void *ptr, size_t size)|Resize an allocation. Assign to a temporary: on failure the original block is still valid.
fn|void free(void *ptr)|Release memory from malloc/calloc/realloc. free(NULL) is a no-op.
fn|void exit(int status)|Terminate the program after running atexit handlers and flushing streams.
fn|void _Exit(int status)|Terminate immediately without cleanup.
fn|void abort(void)|Abnormal termination (SIGABRT).
fn|int atexit(void (*func)(void))|Register a function to run at normal exit.
fn|int abs(int j)|Absolute value of an int.
fn|long labs(long j)|Absolute value of a long.
fn|long long llabs(long long j)|Absolute value of a long long.
fn|div_t div(int numerator, int denominator)|Quotient and remainder in one call.
fn|ldiv_t ldiv(long numerator, long denominator)|Quotient and remainder for long.
fn|int rand(void)|Pseudo-random int in [0, RAND_MAX]. Seed with srand.
fn|void srand(unsigned int seed)|Seed rand().
fn|int atoi(const char *nptr)|Convert string to int. No error detection: prefer strtol.
fn|long atol(const char *nptr)|Convert string to long. No error detection: prefer strtol.
fn|double atof(const char *nptr)|Convert string to double. No error detection: prefer strtod.
fn|long strtol(const char *nptr, char **endptr, int base)|Convert string to long with error checking via endptr and errno.
fn|unsigned long strtoul(const char *nptr, char **endptr, int base)|Convert string to unsigned long.
fn|long long strtoll(const char *nptr, char **endptr, int base)|Convert string to long long.
fn|unsigned long long strtoull(const char *nptr, char **endptr, int base)|Convert string to unsigned long long.
fn|double strtod(const char *nptr, char **endptr)|Convert string to double with error checking.
fn|float strtof(const char *nptr, char **endptr)|Convert string to float.
fn|void qsort(void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *))|Sort an array in place with a comparison callback.
fn|void *bsearch(const void *key, const void *base, size_t nmemb, size_t size, int (*compar)(const void *, const void *))|Binary search a sorted array.
fn|char *getenv(const char *name)|Value of an environment variable, or NULL.
fn|int setenv(const char *name, const char *value, int overwrite)|POSIX. Set an environment variable.
fn|int system(const char *command)|Run a shell command. Avoid with untrusted input.
fn|int mkstemp(char *template)|POSIX. Create a unique temporary file from a template ending in XXXXXX.
fn|long long atoll(const char *nptr)|Convert string to long long. No error detection: prefer strtoll.
fn|long random(void)|POSIX. Pseudo-random long in [0, 2^31).
fn|void srandom(unsigned int seed)|POSIX. Seed random().
fn|int rand_r(unsigned int *seedp)|POSIX. Re-entrant rand() with caller-supplied seed.
fn|double drand48(void)|POSIX. Uniform double in [0.0, 1.0).
fn|int unsetenv(const char *name)|POSIX. Remove an environment variable.
fn|char *mkdtemp(char *template)|POSIX. Create a unique temporary directory from a template ending in XXXXXX.
fn|char *realpath(const char *path, char *resolved_path)|POSIX. Canonicalise a path.
fn|int posix_memalign(void **memptr, size_t alignment, size_t size)|POSIX. Aligned allocation.
fn|void *aligned_alloc(size_t alignment, size_t size)|C11. Aligned allocation.
T |div_t|Result of div().
T |size_t|Unsigned type of sizeof results (also in stddef.h, string.h, stdio.h).
M |NULL|Null pointer constant.
M |EXIT_SUCCESS|Successful termination status (0).
M |EXIT_FAILURE|Unsuccessful termination status.
M |RAND_MAX|Maximum value returned by rand().

#string.h
fn|size_t strlen(const char *s)|Length of s excluding the terminating NUL.
fn|size_t strnlen(const char *s, size_t maxlen)|POSIX. Length of s, at most maxlen.
fn|char *strcpy(char *dest, const char *src)|Copy src into dest including NUL. Unbounded: prefer snprintf/memcpy with a length check.
fn|char *strncpy(char *dest, const char *src, size_t n)|Copy at most n bytes. Does NOT NUL-terminate if src is n or longer.
fn|char *strcat(char *dest, const char *src)|Append src to dest. Unbounded.
fn|char *strncat(char *dest, const char *src, size_t n)|Append at most n bytes of src, always NUL-terminating.
fn|int strcmp(const char *s1, const char *s2)|Compare two strings. Returns 0 when equal.
fn|int strncmp(const char *s1, const char *s2, size_t n)|Compare at most n bytes.
fn|int strcoll(const char *s1, const char *s2)|Compare using the current locale.
fn|char *strchr(const char *s, int c)|First occurrence of c in s, or NULL.
fn|char *strrchr(const char *s, int c)|Last occurrence of c in s, or NULL.
fn|char *strstr(const char *haystack, const char *needle)|First occurrence of needle in haystack, or NULL.
fn|size_t strspn(const char *s, const char *accept)|Length of the initial segment made only of accept characters.
fn|size_t strcspn(const char *s, const char *reject)|Length of the initial segment containing no reject characters.
fn|char *strpbrk(const char *s, const char *accept)|First character of s that is in accept.
fn|char *strtok(char *str, const char *delim)|Split a string into tokens. Not thread-safe, modifies str.
fn|char *strtok_r(char *str, const char *delim, char **saveptr)|POSIX. Re-entrant strtok.
fn|char *strsep(char **stringp, const char *delim)|BSD/POSIX. Split a string in place; replaces strtok.
fn|void *memccpy(void *dest, const void *src, int c, size_t n)|POSIX/C23. Copy until byte c is found or n bytes are copied.
fn|char *strsignal(int sig)|POSIX. Description of a signal number.
fn|char *strdup(const char *s)|POSIX/C23. Duplicate a string with malloc. Caller frees.
fn|char *strndup(const char *s, size_t n)|POSIX/C23. Duplicate at most n bytes with malloc.
fn|char *strerror(int errnum)|Message text for an errno value.
fn|void *memcpy(void *dest, const void *src, size_t n)|Copy n bytes. Regions must not overlap.
fn|void *memmove(void *dest, const void *src, size_t n)|Copy n bytes; regions may overlap.
fn|void *memset(void *s, int c, size_t n)|Fill n bytes with the byte c.
fn|int memcmp(const void *s1, const void *s2, size_t n)|Compare n bytes.
fn|void *memchr(const void *s, int c, size_t n)|Find byte c in the first n bytes.
#strings.h
fn|int strcasecmp(const char *s1, const char *s2)|POSIX. Case-insensitive strcmp.
fn|int strncasecmp(const char *s1, const char *s2, size_t n)|POSIX. Case-insensitive strncmp.

#math.h
fn|double sqrt(double x)|Square root. Link with -lm.
fn|double cbrt(double x)|Cube root.
fn|double pow(double x, double y)|x raised to the power y.
fn|double exp(double x)|e raised to x.
fn|double exp2(double x)|2 raised to x.
fn|double log(double x)|Natural logarithm.
fn|double log2(double x)|Base-2 logarithm.
fn|double log10(double x)|Base-10 logarithm.
fn|double sin(double x)|Sine (radians).
fn|double cos(double x)|Cosine (radians).
fn|double tan(double x)|Tangent (radians).
fn|double asin(double x)|Arc sine.
fn|double acos(double x)|Arc cosine.
fn|double atan(double x)|Arc tangent.
fn|double atan2(double y, double x)|Arc tangent of y/x using signs to pick the quadrant.
fn|double sinh(double x)|Hyperbolic sine.
fn|double cosh(double x)|Hyperbolic cosine.
fn|double tanh(double x)|Hyperbolic tangent.
fn|double ceil(double x)|Smallest integer not less than x.
fn|double floor(double x)|Largest integer not greater than x.
fn|double round(double x)|Round to nearest, halves away from zero.
fn|double trunc(double x)|Round toward zero.
fn|double fabs(double x)|Absolute value of a double.
fn|double fmod(double x, double y)|Floating-point remainder.
fn|double hypot(double x, double y)|sqrt(x*x + y*y) without overflow.
fn|double fmax(double x, double y)|Larger of two values.
fn|double fmin(double x, double y)|Smaller of two values.
fn|double copysign(double x, double y)|Magnitude of x with the sign of y.
fn|double frexp(double x, int *exp)|Split into normalised fraction and power of two.
fn|double ldexp(double x, int exp)|x times 2 to the exp.
fn|double modf(double x, double *iptr)|Split into integer and fractional parts.
fn|float sqrtf(float x)|float square root.
fn|float powf(float x, float y)|float pow.
fn|float fabsf(float x)|float absolute value.
fn|int isnan(double x)|Nonzero if x is NaN (macro).
fn|int isinf(double x)|Nonzero if x is infinite (macro).
M |M_PI|pi (POSIX / GNU extension).
M |M_E|e (POSIX / GNU extension).
M |HUGE_VAL|Positive overflow value for double.
M |INFINITY|Positive infinity (float).
M |NAN|Quiet NaN (float).

#ctype.h
fn|int isalpha(int c)|Nonzero if c is a letter.
fn|int isdigit(int c)|Nonzero if c is 0-9.
fn|int isalnum(int c)|Nonzero if c is a letter or digit.
fn|int isspace(int c)|Nonzero if c is whitespace.
fn|int isupper(int c)|Nonzero if c is upper case.
fn|int islower(int c)|Nonzero if c is lower case.
fn|int ispunct(int c)|Nonzero if c is punctuation.
fn|int isprint(int c)|Nonzero if c is printable (including space).
fn|int isgraph(int c)|Nonzero if c is printable and not space.
fn|int iscntrl(int c)|Nonzero if c is a control character.
fn|int isxdigit(int c)|Nonzero if c is a hex digit.
fn|int toupper(int c)|Convert to upper case.
fn|int tolower(int c)|Convert to lower case.

#time.h
fn|time_t time(time_t *tloc)|Current calendar time in seconds since the epoch.
fn|clock_t clock(void)|Processor time used. Divide by CLOCKS_PER_SEC.
fn|double difftime(time_t end, time_t beginning)|Seconds between two times.
fn|time_t mktime(struct tm *tm)|Convert broken-down local time to time_t.
fn|struct tm *localtime(const time_t *timer)|Convert to local broken-down time (static storage).
fn|struct tm *localtime_r(const time_t *timer, struct tm *result)|POSIX. Re-entrant localtime.
fn|struct tm *gmtime(const time_t *timer)|Convert to UTC broken-down time (static storage).
fn|struct tm *gmtime_r(const time_t *timer, struct tm *result)|POSIX. Re-entrant gmtime.
fn|size_t strftime(char *s, size_t max, const char *format, const struct tm *tm)|Format a broken-down time.
fn|char *asctime(const struct tm *tm)|Convert broken-down time to a string.
fn|char *ctime(const time_t *timer)|Convert time_t to a string.
fn|int clock_gettime(clockid_t clk_id, struct timespec *tp)|POSIX. Read a clock (CLOCK_REALTIME, CLOCK_MONOTONIC).
fn|int nanosleep(const struct timespec *req, struct timespec *rem)|POSIX. High-resolution sleep.
T |time_t|Calendar time type.
T |clock_t|Processor time type.
T |struct tm|Broken-down time.
M |CLOCKS_PER_SEC|clock() ticks per second.
M |CLOCK_MONOTONIC|Monotonic clock id.
M |CLOCK_REALTIME|Wall-clock id.

#stdint.h
T |int8_t|Exactly 8-bit signed integer.
T |int16_t|Exactly 16-bit signed integer.
T |int32_t|Exactly 32-bit signed integer.
T |int64_t|Exactly 64-bit signed integer.
T |uint8_t|Exactly 8-bit unsigned integer.
T |uint16_t|Exactly 16-bit unsigned integer.
T |uint32_t|Exactly 32-bit unsigned integer.
T |uint64_t|Exactly 64-bit unsigned integer.
T |intptr_t|Signed integer able to hold a pointer.
T |uintptr_t|Unsigned integer able to hold a pointer.
T |intmax_t|Largest signed integer type.
T |uintmax_t|Largest unsigned integer type.
M |INT32_MAX|Maximum int32_t.
M |INT32_MIN|Minimum int32_t.
M |INT64_MAX|Maximum int64_t.
M |UINT32_MAX|Maximum uint32_t.
M |UINT64_MAX|Maximum uint64_t.
M |SIZE_MAX|Maximum size_t.

#inttypes.h
M |PRId32|printf conversion for int32_t.
M |PRId64|printf conversion for int64_t.
M |PRIu32|printf conversion for uint32_t.
M |PRIu64|printf conversion for uint64_t.
M |PRIx64|printf hex conversion for uint64_t.
fn|intmax_t strtoimax(const char *nptr, char **endptr, int base)|Convert string to intmax_t.

#stdbool.h
T |bool|Boolean type (a keyword in C23).
M |true|Boolean true (1).
M |false|Boolean false (0).

#stddef.h
T |size_t|Unsigned type of sizeof results.
T |ptrdiff_t|Signed type of pointer subtraction.
T |wchar_t|Wide character type.
M |NULL|Null pointer constant.
fn|size_t offsetof(type, member)|Byte offset of member within type (macro).

#limits.h
M |INT_MAX|Maximum int.
M |INT_MIN|Minimum int.
M |UINT_MAX|Maximum unsigned int.
M |LONG_MAX|Maximum long.
M |LONG_MIN|Minimum long.
M |ULONG_MAX|Maximum unsigned long.
M |LLONG_MAX|Maximum long long.
M |LLONG_MIN|Minimum long long.
M |CHAR_BIT|Bits in a char.
M |CHAR_MAX|Maximum char.
M |SHRT_MAX|Maximum short.
M |PATH_MAX|Maximum path length (POSIX).

#float.h
M |DBL_MAX|Maximum finite double.
M |DBL_MIN|Minimum positive normalised double.
M |DBL_EPSILON|Difference between 1.0 and the next double.
M |FLT_MAX|Maximum finite float.
M |FLT_EPSILON|Difference between 1.0f and the next float.

#errno.h
M |errno|Thread-local error code set by failing library calls.
M |EINVAL|Invalid argument.
M |ENOENT|No such file or directory.
M |ENOMEM|Out of memory.
M |EACCES|Permission denied.
M |EEXIST|File exists.
M |EINTR|Interrupted system call.
M |EAGAIN|Resource temporarily unavailable.
M |ERANGE|Result out of range.

#assert.h
fn|void assert(scalar expression)|Abort with a diagnostic if the expression is false. Disabled by -DNDEBUG.

#signal.h
fn|sighandler_t signal(int signum, sighandler_t handler)|Install a signal handler. Prefer sigaction.
fn|int raise(int sig)|Send a signal to the calling process.
fn|int kill(pid_t pid, int sig)|POSIX. Send a signal to a process.
fn|int sigaction(int signum, const struct sigaction *act, struct sigaction *oldact)|POSIX. Examine or change a signal action.
fn|int sigemptyset(sigset_t *set)|POSIX. Initialise an empty signal set.
fn|int sigaddset(sigset_t *set, int signum)|POSIX. Add a signal to a set.
M |SIGINT|Interactive attention (Ctrl-C).
M |SIGTERM|Termination request.
M |SIGKILL|Kill (cannot be caught).
M |SIGSEGV|Invalid memory access.
M |SIGALRM|Timer expired.
M |SIGCHLD|Child stopped or terminated.
M |SIG_IGN|Ignore the signal.
M |SIG_DFL|Default action.

#setjmp.h
fn|int setjmp(jmp_buf env)|Save the calling environment. Returns 0, or nonzero after longjmp.
fn|void longjmp(jmp_buf env, int val)|Restore the environment saved by setjmp.
T |jmp_buf|Saved execution context.

#stdarg.h
fn|void va_start(va_list ap, last)|Start iterating variadic arguments (macro).
fn|type va_arg(va_list ap, type)|Fetch the next variadic argument (macro).
fn|void va_end(va_list ap)|End variadic iteration (macro).
fn|void va_copy(va_list dest, va_list src)|Copy a va_list (macro).
T |va_list|Variadic argument cursor.

#locale.h
fn|char *setlocale(int category, const char *locale)|Set or query the program locale.
M |LC_ALL|All locale categories.

#unistd.h
fn|ssize_t read(int fd, void *buf, size_t count)|Read up to count bytes from a descriptor.
fn|ssize_t write(int fd, const void *buf, size_t count)|Write up to count bytes to a descriptor.
fn|int close(int fd)|Close a file descriptor.
fn|off_t lseek(int fd, off_t offset, int whence)|Reposition a descriptor.
fn|int pipe(int pipefd[2])|Create a pipe: pipefd[0] reads, pipefd[1] writes.
fn|int dup(int oldfd)|Duplicate a descriptor.
fn|int dup2(int oldfd, int newfd)|Duplicate onto a specific descriptor.
fn|pid_t fork(void)|Create a child process. Returns 0 in the child.
fn|int execvp(const char *file, char *const argv[])|Replace the process image, searching PATH.
fn|int execl(const char *path, const char *arg, ...)|Replace the process image.
fn|int execlp(const char *file, const char *arg, ...)|Replace the process image, searching PATH. The argument list must end with (char *)NULL.
fn|int execv(const char *path, char *const argv[])|Replace the process image using an argument vector.
fn|int execve(const char *path, char *const argv[], char *const envp[])|Replace the process image with an explicit environment.
fn|void _exit(int status)|Terminate immediately without running atexit handlers or flushing stdio (use in a child after fork).
fn|unsigned int alarm(unsigned int seconds)|Deliver SIGALRM after the given number of seconds.
fn|int pause(void)|Sleep until a signal is delivered.
fn|int gethostname(char *name, size_t len)|Host name of the machine.
fn|uid_t getuid(void)|Real user id.
fn|uid_t geteuid(void)|Effective user id.
fn|gid_t getgid(void)|Real group id.
fn|int fsync(int fd)|Flush a descriptor's data to storage.
fn|int ftruncate(int fd, off_t length)|Set a file's length.
fn|int link(const char *oldpath, const char *newpath)|Create a hard link.
fn|int symlink(const char *target, const char *linkpath)|Create a symbolic link.
fn|pid_t setsid(void)|Create a new session.
fn|int chown(const char *path, uid_t owner, gid_t group)|Change file owner and group.
fn|pid_t getpid(void)|Process id.
fn|pid_t getppid(void)|Parent process id.
fn|unsigned int sleep(unsigned int seconds)|Sleep for seconds.
fn|int usleep(useconds_t usec)|Sleep for microseconds (obsolete: use nanosleep).
fn|int access(const char *path, int mode)|Check file accessibility (R_OK, W_OK, X_OK, F_OK).
fn|int unlink(const char *path)|Remove a name from the filesystem.
fn|int chdir(const char *path)|Change working directory.
fn|char *getcwd(char *buf, size_t size)|Current working directory.
fn|int isatty(int fd)|Nonzero if fd refers to a terminal.
fn|int getopt(int argc, char *const argv[], const char *optstring)|Parse short command-line options.
fn|long sysconf(int name)|Query system configuration.
fn|int rmdir(const char *path)|Remove an empty directory.
fn|ssize_t readlink(const char *path, char *buf, size_t bufsiz)|Read a symbolic link.
M |STDIN_FILENO|Descriptor 0.
M |STDOUT_FILENO|Descriptor 1.
M |STDERR_FILENO|Descriptor 2.
M |optarg|Argument of the current getopt option.
M |optind|Index of the next argv element for getopt.

#sys/wait.h
fn|pid_t wait(int *wstatus)|Wait for any child to change state.
fn|pid_t waitpid(pid_t pid, int *wstatus, int options)|Wait for a specific child.
M |WIFEXITED|True if the child exited normally.
M |WEXITSTATUS|Exit status of the child.

#fcntl.h
fn|int open(const char *path, int flags, ...)|Open a file and return a descriptor. Flags: O_RDONLY, O_WRONLY, O_RDWR, O_CREAT...
fn|int fcntl(int fd, int cmd, ...)|Manipulate a descriptor.
M |O_RDONLY|Open read-only.
M |O_WRONLY|Open write-only.
M |O_RDWR|Open read-write.
M |O_CREAT|Create the file if it does not exist.
M |O_TRUNC|Truncate to zero length.
M |O_APPEND|Append on each write.
M |O_NONBLOCK|Non-blocking mode.

#sys/stat.h
fn|int stat(const char *path, struct stat *buf)|Get file status.
fn|int fstat(int fd, struct stat *buf)|Get file status from a descriptor.
fn|int mkdir(const char *path, mode_t mode)|Create a directory.
fn|int chmod(const char *path, mode_t mode)|Change file permissions.

#dirent.h
fn|DIR *opendir(const char *name)|Open a directory stream.
fn|struct dirent *readdir(DIR *dirp)|Read the next directory entry.
fn|int closedir(DIR *dirp)|Close a directory stream.

#sys/time.h
fn|int gettimeofday(struct timeval *tv, struct timezone *tz)|POSIX (obsolescent). Wall-clock time with microseconds; prefer clock_gettime.
T |struct timeval|Seconds and microseconds.

#sys/select.h
fn|int select(int nfds, fd_set *readfds, fd_set *writefds, fd_set *exceptfds, struct timeval *timeout)|Wait until descriptors are ready.
M |FD_SET|Add a descriptor to an fd_set.
M |FD_ISSET|Test a descriptor in an fd_set.
M |FD_ZERO|Clear an fd_set.

#sys/mman.h
fn|void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset)|Map a file or anonymous memory.
fn|int munmap(void *addr, size_t length)|Unmap memory.
M |PROT_READ|Pages may be read.
M |PROT_WRITE|Pages may be written.
M |MAP_PRIVATE|Private copy-on-write mapping.
M |MAP_SHARED|Shared mapping.
M |MAP_FAILED|Value returned by mmap on failure.

#pthread.h
fn|int pthread_create(pthread_t *thread, const pthread_attr_t *attr, void *(*start_routine)(void *), void *arg)|Start a new thread. Link with -pthread.
fn|int pthread_join(pthread_t thread, void **retval)|Wait for a thread to finish.
fn|int pthread_detach(pthread_t thread)|Mark a thread as detached.
fn|pthread_t pthread_self(void)|Calling thread id.
fn|void pthread_exit(void *retval)|Terminate the calling thread.
fn|int pthread_mutex_init(pthread_mutex_t *mutex, const pthread_mutexattr_t *attr)|Initialise a mutex.
fn|int pthread_mutex_lock(pthread_mutex_t *mutex)|Lock a mutex.
fn|int pthread_mutex_trylock(pthread_mutex_t *mutex)|Lock a mutex without blocking.
fn|int pthread_mutex_unlock(pthread_mutex_t *mutex)|Unlock a mutex.
fn|int pthread_mutex_destroy(pthread_mutex_t *mutex)|Destroy a mutex.
fn|int pthread_cond_init(pthread_cond_t *cond, const pthread_condattr_t *attr)|Initialise a condition variable.
fn|int pthread_cond_wait(pthread_cond_t *cond, pthread_mutex_t *mutex)|Wait on a condition variable.
fn|int pthread_cond_signal(pthread_cond_t *cond)|Wake one waiter.
fn|int pthread_cond_broadcast(pthread_cond_t *cond)|Wake all waiters.
fn|int pthread_cond_destroy(pthread_cond_t *cond)|Destroy a condition variable.
T |pthread_t|Thread handle.
T |pthread_mutex_t|Mutex.
T |pthread_cond_t|Condition variable.
M |PTHREAD_MUTEX_INITIALIZER|Static mutex initialiser.
M |PTHREAD_COND_INITIALIZER|Static condition variable initialiser.

#sys/socket.h
fn|int socket(int domain, int type, int protocol)|Create a socket.
fn|int bind(int sockfd, const struct sockaddr *addr, socklen_t addrlen)|Bind an address to a socket.
fn|int listen(int sockfd, int backlog)|Mark a socket as passive.
fn|int accept(int sockfd, struct sockaddr *addr, socklen_t *addrlen)|Accept a connection.
fn|int connect(int sockfd, const struct sockaddr *addr, socklen_t addrlen)|Connect a socket.
fn|ssize_t send(int sockfd, const void *buf, size_t len, int flags)|Send on a connected socket.
fn|ssize_t recv(int sockfd, void *buf, size_t len, int flags)|Receive from a connected socket.
fn|ssize_t sendto(int sockfd, const void *buf, size_t len, int flags, const struct sockaddr *dest_addr, socklen_t addrlen)|Send a datagram.
fn|ssize_t recvfrom(int sockfd, void *buf, size_t len, int flags, struct sockaddr *src_addr, socklen_t *addrlen)|Receive a datagram.
fn|int setsockopt(int sockfd, int level, int optname, const void *optval, socklen_t optlen)|Set a socket option.
fn|int shutdown(int sockfd, int how)|Shut down part of a connection.
M |AF_INET|IPv4 address family.
M |AF_INET6|IPv6 address family.
M |SOCK_STREAM|TCP socket type.
M |SOCK_DGRAM|UDP socket type.
M |SOL_SOCKET|Socket-level option level.
M |SO_REUSEADDR|Allow address reuse.

#netinet/in.h
fn|uint16_t htons(uint16_t hostshort)|Host to network byte order (16-bit).
fn|uint32_t htonl(uint32_t hostlong)|Host to network byte order (32-bit).
fn|uint16_t ntohs(uint16_t netshort)|Network to host byte order (16-bit).
fn|uint32_t ntohl(uint32_t netlong)|Network to host byte order (32-bit).
T |struct sockaddr_in|IPv4 socket address.
M |INADDR_ANY|Bind to all interfaces.

#arpa/inet.h
fn|int inet_pton(int af, const char *src, void *dst)|Parse a text address into binary form.
fn|const char *inet_ntop(int af, const void *src, char *dst, socklen_t size)|Format a binary address as text.

#netdb.h
fn|int getaddrinfo(const char *node, const char *service, const struct addrinfo *hints, struct addrinfo **res)|Resolve a host and service name.
fn|void freeaddrinfo(struct addrinfo *res)|Free getaddrinfo results.
fn|const char *gai_strerror(int errcode)|Message for a getaddrinfo error.

#poll.h
fn|int poll(struct pollfd *fds, nfds_t nfds, int timeout)|Wait for events on descriptors.
`;

/** @typedef {{name:string, sig:string, doc:string, headers:string[], kind:'function'|'type'|'macro'}} LibcEntry */

/** @type {Map<string, LibcEntry>} */
export const LIBC = new Map();
/** @type {string[]} */
export const HEADERS = [];

(function parse() {
  let headers = [];
  for (const raw of RAW.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === "#") {
      headers = line.slice(1).split(",");
      for (const h of headers) if (!HEADERS.includes(h)) HEADERS.push(h);
      continue;
    }
    const [tag, a, ...rest] = line.split("|");
    const doc = rest.join("|");
    let entry;
    if (tag === "fn") {
      const m = /([A-Za-z_]\w*)\s*\(/.exec(a);
      if (!m) continue;
      entry = { name: m[1], sig: a, doc, headers: [...headers], kind: "function" };
    } else if (tag === "T ") {
      entry = { name: a, sig: a, doc, headers: [...headers], kind: "type" };
    } else if (tag === "M ") {
      entry = { name: a, sig: a, doc, headers: [...headers], kind: "macro" };
    } else continue;
    const prev = LIBC.get(entry.name);
    if (prev) {
      for (const h of entry.headers) if (!prev.headers.includes(h)) prev.headers.push(h);
    } else LIBC.set(entry.name, entry);
  }
  HEADERS.sort();
})();

/** Headers that transitively provide another header's declarations. */
export const HEADER_PROVIDES = {
  "inttypes.h": ["stdint.h"],
  "pthread.h": ["time.h"],
  "sys/socket.h": [],
  "netinet/in.h": ["sys/socket.h"],
  "arpa/inet.h": ["netinet/in.h", "sys/socket.h"],
  "netdb.h": ["netinet/in.h", "sys/socket.h"],
  "dirent.h": [],
};

/** Names a function-call check must never flag as undeclared. */
export const ALWAYS_KNOWN = new Set([
  "sizeof", "alignof", "_Alignof", "_Static_assert", "static_assert", "_Generic",
  "__attribute__", "__asm__", "asm", "typeof", "__typeof__", "defined",
  "__builtin_expect", "__builtin_unreachable", "__builtin_trap",
]);

export function libc(name) {
  return LIBC.get(name);
}
