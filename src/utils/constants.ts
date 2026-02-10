// Default URLs used as fallback when no overrides are configured.
// These can be overridden via CLI flags, environment variables, or .template-cli.json config file.
export const DEFAULT_IDENTITY_SERVER_URL = 'https://ix-id.lincx.la';
export const DEFAULT_API_SERVER_URL = 'https://api.lincx.com/api';
export const DEFAULT_GEOMETER_API_URL = 'https://api.lincx.com/geometer/api';
export const DEFAULT_PORT = 5000;

// Re-export under original names for backward compatibility.
// Consumers that need dynamic config should use resolveConfig() from env-config.ts instead.
export const IDENTITY_SERVER_URL = DEFAULT_IDENTITY_SERVER_URL;
export const API_SERVER_URL = DEFAULT_API_SERVER_URL;
export const GEOMETER_API_URL = DEFAULT_GEOMETER_API_URL;