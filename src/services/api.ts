import { AuthResponseSchema, TemplateSchema, CreativeAssetGroupSchema, ZoneSchema, LookupResponseSchema, AdsResponseSchema, type Template, type Zone, type LookupResponse, type AdsResponse } from '../types/api.ts';
import { IDENTITY_SERVER_URL, API_SERVER_URL, GEOMETER_API_URL } from '../utils/constants.ts';
import { AuthError, ApiError } from '../utils/errors.ts';
import { loadProjectConfig } from './config.ts';
import { loadAuthToken } from './config.ts';
import { z } from 'zod';

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

// Accepts either { data: { template: Template } } or { data: Template }
const SingleTemplateResponseA = z.object({ data: z.object({ template: TemplateSchema }) });
const SingleTemplateResponseB = z.object({ data: TemplateSchema });

function parseTemplateResponse(raw: unknown): Template {
  const parsedA = SingleTemplateResponseA.safeParse(raw);
  if (parsedA.success) return parsedA.data.data.template;

  const parsedB = SingleTemplateResponseB.safeParse(raw);
  if (parsedB.success) return parsedB.data.data;

  throw new ApiError('Malformed template response');
}

export async function getTemplate(templateId: string): Promise<Template> {
  const token = await loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run src/cli.ts login" first.');
  }

  const raw = await fetchWithAuth(`/templates/${templateId}`, {
    method: 'GET',
    token: token.token,
    baseUrl: API_SERVER_URL,
  });

  return parseTemplateResponse(raw);
}

const SingleCreativeAssetGroupResponseA = z.object({ data: z.object({ creativeAssetGroup: CreativeAssetGroupSchema }) });
const SingleCreativeAssetGroupResponseB = z.object({ data: CreativeAssetGroupSchema });

function parseCreativeAssetGroupResponse(raw: unknown) {
  const parsedA = SingleCreativeAssetGroupResponseA.safeParse(raw);
  if (parsedA.success) return parsedA.data.data.creativeAssetGroup;
  const parsedB = SingleCreativeAssetGroupResponseB.safeParse(raw);
  if (parsedB.success) return parsedB.data.data;
  throw new ApiError('Malformed creative asset group response');
}

export async function getCreativeAssetGroup(creativeAssetGroupId: string) {
  const token = await loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run src/cli.ts login" first.');
  }

  const raw = await fetchWithAuth(`/creative-asset-groups/${creativeAssetGroupId}`, {
    method: 'GET',
    token: token.token,
    baseUrl: API_SERVER_URL,
  });

  return parseCreativeAssetGroupResponse(raw);
}

const SingleZoneResponseA = z.object({ data: z.object({ zone: ZoneSchema }) });
const SingleZoneResponseB = z.object({ data: ZoneSchema });

function parseZoneResponse(raw: unknown): Zone {
  const parsedA = SingleZoneResponseA.safeParse(raw);
  if (parsedA.success) return parsedA.data.data.zone;
  const parsedB = SingleZoneResponseB.safeParse(raw);
  if (parsedB.success) return parsedB.data.data;
  throw new ApiError('Malformed zone response');
}

export async function getZone(zoneId: string): Promise<Zone> {
  const token = await loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run src/cli.ts login" first.');
  }

  const raw = await fetchWithAuth(`/zones/${zoneId}`, {
    method: 'GET',
    token: token.token,
    baseUrl: API_SERVER_URL,
  });

  return parseZoneResponse(raw);
}

export type TemplateUpdateInput = Pick<Template, 'html' | 'css'>;

export async function updateTemplate(templateId: string, updates: TemplateUpdateInput): Promise<Template> {
  const token = await loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run src/cli.ts login" first.');
  }

  const latestRaw = await fetchWithAuth(`/templates/${templateId}`, {
    method: 'GET',
    token: token.token,
    baseUrl: API_SERVER_URL,
  });
  const latestTemplate = parseTemplateResponse(latestRaw);

  const payload: Template = {
    ...latestTemplate,
    html: updates.html,
    css: updates.css ?? latestTemplate.css ?? '',
  };

  const updatedRaw = await fetchWithAuth(`/templates/${templateId}`, {
    method: 'PUT',
    token: token.token,
    baseUrl: API_SERVER_URL,
    body: JSON.stringify(payload),
  });

  return parseTemplateResponse(updatedRaw);
}

/**
 * Fetches user geo location from the lookup API
 */
export async function getLookupGeo(): Promise<LookupResponse> {
  const response = await fetch(`${GEOMETER_API_URL}/lookup`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'origin': 'https://poweredbylincx.com',
    },
  });

  if (!response.ok) {
    throw new ApiError(`Lookup API error: ${response.status}`, {
      status: response.status,
    });
  }

  const raw = await response.json();
  const parsed = LookupResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('Malformed lookup response');
  }
  return parsed.data;
}

/**
 * Fetches ads for a zone with geo parameters
 */
export async function getAdsForZone(
  zoneId: string,
  options: {
    href: string;
    geoCity?: string;
    geoRegion?: string;
    geoState?: string;
    geoIP?: string;
    geoPostal?: string;
    geoCountry?: string;
    geoCountryName?: string;
    timestamp?: string;
    zoneLoadEventId?: string;
    testMode?: boolean;
  }
): Promise<AdsResponse> {
  const params = new URLSearchParams();
  params.set('zoneId', zoneId);
  params.set('href', options.href);
  
  if (options.geoCity) params.set('geoCity', options.geoCity);
  if (options.geoRegion) params.set('geoRegion', options.geoRegion);
  if (options.geoState) params.set('geoState', options.geoState);
  if (options.geoIP) params.set('geoIP', options.geoIP);
  if (options.geoPostal) params.set('geoPostal', options.geoPostal);
  if (options.geoCountry) params.set('geoCountry', options.geoCountry);
  if (options.geoCountryName) params.set('geoCountryName', options.geoCountryName);
  if (options.timestamp) params.set('timestamp', options.timestamp);
  if (options.zoneLoadEventId) params.set('zoneLoadEventId', options.zoneLoadEventId);
  if (options.testMode !== false) {
    params.set('test-mode', '');
  }

  const response = await fetch(`${API_SERVER_URL}/a?${params.toString()}`, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'origin': 'https://poweredbylincx.com',
    },
  });

  if (!response.ok) {
    throw new ApiError(`Ads API error: ${response.status}`, {
      status: response.status,
    });
  }

  const raw = await response.json() as Record<string, unknown>;
  
  // Ads will always be available in the response
  return {
    ads: (raw.ads as AdsResponse['ads']) || [],
    template: raw.template as AdsResponse['template'],
    remoteFeedSetId: raw.remoteFeedSetId as AdsResponse['remoteFeedSetId'],
    remoteFeedSetName: raw.remoteFeedSetName as AdsResponse['remoteFeedSetName'],
    segmentId: raw.segmentId as AdsResponse['segmentId'],
    segmentName: raw.segmentName as AdsResponse['segmentName'],
    dataAttributesDefault: raw.dataAttributesDefault as AdsResponse['dataAttributesDefault'],
  };
}

