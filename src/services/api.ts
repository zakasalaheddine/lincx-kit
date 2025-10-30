import { AuthResponseSchema } from '../types/api.ts';
import { IDENTITY_SERVER_URL, API_SERVER_URL } from '../utils/constants.ts';
import { AuthError, ApiError } from '../utils/errors.ts';
import { loadProjectConfig } from './config.ts';

function getBaseUrlString(url: unknown): string {
  if (typeof url === 'string') return url;
  if (url instanceof URL) return url.toString().replace(/\/$/, '');
  throw new Error('Invalid apiBaseUrl in config');
}

export interface FetchWithAuthOptions extends RequestInit {
  token?: string;
  baseUrl?: string; // Optional override for the base URL
  useIdentityServer?: boolean; // If true, use IDENTITY_SERVER_URL from constants
}

export async function fetchWithAuth<T>(
  path: string,
  options: FetchWithAuthOptions = {}
): Promise<T> {
  const {
    token,
    baseUrl,
    useIdentityServer = false,
    headers: customHeaders,
    ...restOptions
  } = options;

  let base: string;
  if (baseUrl) {
    base = getBaseUrlString(baseUrl);
  } else if (useIdentityServer) {
    base = IDENTITY_SERVER_URL;
  } else {
    const config = await loadProjectConfig();
    base = getBaseUrlString((config as any).apiBaseUrl ?? API_SERVER_URL);
  }
  const url = `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthError('Unauthorized');
    }
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      // ignore json parse errors
    }
    throw new ApiError(`API error: ${response.status}`, {
      status: response.status,
      details,
    });
  }

  return (await response.json()) as T;
}

export async function login(email: string, password: string): Promise<string> {
  const raw = await fetchWithAuth(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      useIdentityServer: true
    }
  );

  const parsed = AuthResponseSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.data?.authToken) {
    throw new ApiError('Malformed auth response');
  }
  return parsed.data.data.authToken;
}

