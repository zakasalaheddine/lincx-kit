import { loadAuthToken } from './config.ts';
import { AuthError } from '../utils/errors.ts';
import type { AuthToken } from '../types/config.ts';

/**
 * Ensures the user is authenticated and returns the stored auth token.
 *
 * This is the single, canonical place to perform the "is the user logged in?"
 * check. Every command that requires authentication should call this function
 * instead of inlining its own `loadAuthToken()` + null-check.
 *
 * @param cwd  Optional working directory forwarded to `loadAuthToken`.
 * @returns    The validated `AuthToken` (token string, user info, timestamp).
 * @throws     {AuthError} with code `ERR_NOT_AUTHENTICATED` when no token is
 *             found.
 *
 * @example
 * ```ts
 * const auth = await requireAuth();
 * const data = await fetchWithAuth('/templates', { token: auth.token });
 * ```
 */
export async function requireAuth(cwd?: string): Promise<AuthToken> {
  const token = await loadAuthToken(cwd);

  if (!token) {
    throw new AuthError(
      'Not logged in. Run "bun run cli login" first.',
      'ERR_NOT_AUTHENTICATED',
    );
  }

  return token;
}
