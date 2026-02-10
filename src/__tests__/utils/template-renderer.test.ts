import { describe, it, expect } from 'bun:test';
import { renderTemplate, type RenderOptions } from '../../utils/template-renderer.ts';

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('renderTemplate', () => {
  const baseHtml = '<div>{{title}}</div>';
  const baseCss = 'body { margin: 0; }';
  const baseData = { title: 'Hello World' };

  it('produces a valid HTML document', () => {
    const output = renderTemplate(baseHtml, baseCss, baseData);
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html lang="en">');
    expect(output).toContain('</html>');
    expect(output).toContain('<head>');
    expect(output).toContain('</head>');
    expect(output).toContain('<body>');
    expect(output).toContain('</body>');
  });

  it('includes the CSS inside a <style> tag', () => {
    const output = renderTemplate(baseHtml, baseCss, baseData);
    expect(output).toContain(`<style>${baseCss}</style>`);
  });

  it('renders Mustache variables from data', () => {
    const output = renderTemplate(baseHtml, baseCss, baseData);
    expect(output).toContain('<div>Hello World</div>');
    expect(output).not.toContain('{{title}}');
  });

  it('renders Mustache sections (arrays)', () => {
    const html = '{{#items}}<li>{{name}}</li>{{/items}}';
    const data = { items: [{ name: 'A' }, { name: 'B' }] };
    const output = renderTemplate(html, '', data);
    expect(output).toContain('<li>A</li>');
    expect(output).toContain('<li>B</li>');
  });

  it('renders Mustache inverted sections', () => {
    const html = '{{^items}}<p>No items</p>{{/items}}';
    const data = { items: [] };
    const output = renderTemplate(html, '', data);
    expect(output).toContain('<p>No items</p>');
  });

  it('handles empty data object', () => {
    const html = '<span>{{missing}}</span>';
    const output = renderTemplate(html, baseCss, {});
    expect(output).toContain('<span></span>');
  });

  it('handles empty HTML and CSS', () => {
    const output = renderTemplate('', '', {});
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<style></style>');
  });
});

// ---------------------------------------------------------------------------
// Hot-reload script injection
// ---------------------------------------------------------------------------

describe('hot-reload script injection', () => {
  const html = '<p>Test</p>';
  const css = '';
  const data = {};

  it('does NOT inject hot-reload script by default', () => {
    const output = renderTemplate(html, css, data);
    expect(output).not.toContain('EventSource');
    expect(output).not.toContain('/sse');
  });

  it('does NOT inject hot-reload script when hotReload is false', () => {
    const output = renderTemplate(html, css, data, { hotReload: false });
    expect(output).not.toContain('EventSource');
  });

  it('injects hot-reload script when hotReload is true', () => {
    const output = renderTemplate(html, css, data, { hotReload: true });
    expect(output).toContain('<script>');
    expect(output).toContain("new EventSource('/sse')");
    expect(output).toContain("event.data === 'reload'");
    expect(output).toContain('location.reload()');
  });

  it('places hot-reload script inside <body>', () => {
    const output = renderTemplate(html, css, data, { hotReload: true });
    const bodyStart = output.indexOf('<body>');
    const bodyEnd = output.indexOf('</body>');
    const scriptPos = output.indexOf("new EventSource('/sse')");
    expect(scriptPos).toBeGreaterThan(bodyStart);
    expect(scriptPos).toBeLessThan(bodyEnd);
  });
});

// ---------------------------------------------------------------------------
// Zone script injection
// ---------------------------------------------------------------------------

describe('zone script injection', () => {
  const css = '';
  const data = { title: 'Should not render' };

  it('uses zoneScript as body content instead of Mustache rendering', () => {
    const zoneScript = '<script src="https://api.lincx.com/load" data-zone-id="z1"></script>';
    const output = renderTemplate('<div>{{title}}</div>', css, data, { zoneScript });
    expect(output).toContain(zoneScript);
    // Mustache template should NOT be rendered
    expect(output).not.toContain('Should not render');
    expect(output).not.toContain('{{title}}');
  });

  it('still includes CSS when zoneScript is provided', () => {
    const zoneScript = '<script src="zone.js"></script>';
    const customCss = '.widget { color: red; }';
    const output = renderTemplate('', customCss, data, { zoneScript });
    expect(output).toContain(`<style>${customCss}</style>`);
  });

  it('can combine zoneScript with hotReload', () => {
    const zoneScript = '<script src="zone.js"></script>';
    const output = renderTemplate('', css, data, { zoneScript, hotReload: true });
    expect(output).toContain(zoneScript);
    expect(output).toContain("new EventSource('/sse')");
  });
});

// ---------------------------------------------------------------------------
// Mock data banner
// ---------------------------------------------------------------------------

describe('mock data banner', () => {
  const html = '<p>Content</p>';
  const css = '';
  const data = {};

  it('does NOT inject banner by default', () => {
    const output = renderTemplate(html, css, data);
    expect(output).not.toContain('mock-data-banner');
  });

  it('injects mock data banner when mockDataBanner is true', () => {
    const output = renderTemplate(html, css, data, { mockDataBanner: true });
    expect(output).toContain('id="mock-data-banner"');
    expect(output).toContain('Mock Data');
    expect(output).toContain('Zone API was unreachable');
  });

  it('places banner inside <body>', () => {
    const output = renderTemplate(html, css, data, { mockDataBanner: true });
    const bodyStart = output.indexOf('<body>');
    const bodyEnd = output.indexOf('</body>');
    const bannerPos = output.indexOf('mock-data-banner');
    expect(bannerPos).toBeGreaterThan(bodyStart);
    expect(bannerPos).toBeLessThan(bodyEnd);
  });
});
