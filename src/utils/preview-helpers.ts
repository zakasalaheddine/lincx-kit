export const ZONE_SCRIPT_SRC = 'https://api.lincx.com/load';

export const DEFAULT_PREVIEW_PORT = 5000;

export function parsePort(port?: string | number): number {
  if (!port) return DEFAULT_PREVIEW_PORT;
  if (typeof port === 'number') return port;
  const parsed = Number.parseInt(port, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid port value: ${port}`);
  }
  return parsed;
}

export function buildZoneScript(zoneId: string, options?: { testMode?: boolean }): string {
  const attrs = [`data-zone-id="${zoneId}"`];
  if (options?.testMode !== false) {
    attrs.push('data-test-mode');
  }
  return `<script src="${ZONE_SCRIPT_SRC}" ${attrs.join(' ')}></script>`;
}




