import { formatError } from './error-messages.ts';
import { AuthError, ApiError, FileError, ValidationError } from './errors.ts';

/**
 * Maps known error classes to exit codes.
 *
 * - 0  success (never used here, but documented for completeness)
 * - 1  general / unknown error
 * - 2  auth error (not logged in, unauthorized)
 * - 3  API error (server-side / HTTP)
 * - 4  file-system error
 * - 5  validation error
 */
function exitCodeForError(error: unknown): number {
  if (error instanceof AuthError) return 2;
  if (error instanceof ApiError) return 3;
  if (error instanceof FileError) return 4;
  if (error instanceof ValidationError) return 5;
  return 1;
}

/**
 * Central handler invoked when a command throws.
 *
 * 1. Formats the error into a user-friendly message via `formatError`.
 * 2. Logs it to stderr with the command name for context.
 * 3. Exits the process with an appropriate non-zero code.
 */
function handleCommandError(commandName: string, error: unknown): never {
  const err = error instanceof Error ? error : new Error(String(error));

  const formatted = formatError(err);
  console.error(`\n[${commandName}] ${formatted}\n`);

  process.exit(exitCodeForError(error));
}

/**
 * Wraps an async command function with centralised error handling and SIGINT
 * support.
 *
 * Usage:
 * ```ts
 * program
 *   .command('pull')
 *   .action(withErrorHandling('pull', async (args) => {
 *     // command implementation — just throw on errors
 *   }));
 * ```
 *
 * Behaviours:
 * - Catches **any** error thrown by `fn`, formats it via `formatError`, logs
 *   it to stderr with the command name as context, and exits with an
 *   appropriate exit code.
 * - Registers a one-time `SIGINT` handler so that pressing Ctrl-C during a
 *   command results in a clean exit (code 130, the UNIX convention for
 *   SIGINT).
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<void>>(
  commandName: string,
  fn: T,
): T {
  return (async (...args: any[]) => {
    // Register a one-time SIGINT handler for graceful Ctrl-C handling.
    const sigintHandler = () => {
      console.error(`\n[${commandName}] Interrupted.`);
      process.exit(130); // 128 + SIGINT (2)
    };
    process.once('SIGINT', sigintHandler);

    try {
      await fn(...args);
    } catch (error) {
      handleCommandError(commandName, error);
    } finally {
      // Clean up the handler so it doesn't leak if the command completes
      // normally before SIGINT fires.
      process.removeListener('SIGINT', sigintHandler);
    }
  }) as T;
}
