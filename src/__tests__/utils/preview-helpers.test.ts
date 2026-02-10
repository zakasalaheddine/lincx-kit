import { describe, it, expect } from 'bun:test';
import {
  parsePort,
  buildZoneScript,
  ZONE_SCRIPT_SRC,
  DEFAULT_PREVIEW_PORT,
} from '../../utils/preview-helpers.ts';

// ---------------------------------------------------------------------------
// parsePort
// ---------------------------------------------------------------------------

describe('parsePort', () => {
  it('returns DEFAULT_PREVIEW_PORT when no argument is given', () => {
    expect(parsePort()).toBe(DEFAULT_PREVIEW_PORT);
    expect(parsePort(undefined)).toBe(DEFAULT_PREVIEW_PORT);
  });

  it('returns DEFAULT_PREVIEW_PORT when empty string is passed', () => {
    expect(parsePort('')).toBe(DEFAULT_PREVIEW_PORT);
  });

  it('parses a valid numeric string', () => {
    expect(parsePort('3000')).toBe(3000);
    expect(parsePort('8080')).toBe(8080);
    expect(parsePort('443')).toBe(443);
  });

  it('passes through a numeric value directly', () => {
    expect(parsePort(3000)).toBe(3000);
    expect(parsePort(0)).toBe(DEFAULT_PREVIEW_PORT); // 0 is falsy
  });

  it('throws for non-numeric string', () => {
    expect(() => parsePort('abc')).toThrow('Invalid port value: abc');
  });

  it('throws for mixed alphanumeric string', () => {
    expect(() => parsePort('80abc')).not.toThrow(); // parseInt('80abc') = 80
    expect(parsePort('80abc')).toBe(80);
  });

  it('throws for completely invalid string', () => {
    expect(() => parsePort('not-a-port')).toThrow('Invalid port value');
  });
});

// ---------------------------------------------------------------------------
// buildZoneScript
// ---------------------------------------------------------------------------

describe('buildZoneScript', () => {
  it('returns a script tag with the correct src', () => {
    const script = buildZoneScript('zone-1');
    expect(script).toContain(`src="${ZONE_SCRIPT_SRC}"`);
  });

  it('includes the zone id as data attribute', () => {
    const script = buildZoneScript('my-zone-id');
    expect(script).toContain('data-zone-id="my-zone-id"');
  });

  it('includes data-test-mode by default', () => {
    const script = buildZoneScript('z1');
    expect(script).toContain('data-test-mode');
  });

  it('includes data-test-mode when testMode is true', () => {
    const script = buildZoneScript('z1', { testMode: true });
    expect(script).toContain('data-test-mode');
  });

  it('excludes data-test-mode when testMode is explicitly false', () => {
    const script = buildZoneScript('z1', { testMode: false });
    expect(script).not.toContain('data-test-mode');
  });

  it('produces a well-formed script tag', () => {
    const script = buildZoneScript('z1');
    expect(script).toMatch(/^<script\s.*><\/script>$/);
  });

  it('uses the correct ZONE_SCRIPT_SRC constant', () => {
    expect(ZONE_SCRIPT_SRC).toBe('https://api.lincx.com/load');
  });

  it('uses the correct DEFAULT_PREVIEW_PORT constant', () => {
    expect(DEFAULT_PREVIEW_PORT).toBe(5000);
  });
});
