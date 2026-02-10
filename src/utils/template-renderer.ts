import Mustache from 'mustache';

export interface RenderOptions {
  hotReload?: boolean;
  zoneScript?: string;
  mockDataBanner?: boolean;
}

function buildHotReloadScript(): string {
  return `
<script>
  const eventSource = new EventSource('/sse');
  eventSource.onmessage = (event) => {
    if (event.data === 'reload') {
      location.reload();
    }
  };
</script>
`.trim();
}

function buildMockDataBanner(): string {
  return `
<div id="mock-data-banner" style="
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999999;
  background: #FEF3C7;
  border-bottom: 2px solid #F59E0B;
  color: #92400E;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
">
  <span style="display: flex; align-items: center; gap: 8px;">
    <span style="font-size: 16px;">&#9888;</span>
    <strong>Mock Data</strong> &mdash; Zone API was unreachable. Displaying generated mock data.
  </span>
  <button onclick="document.getElementById('mock-data-banner').remove()" style="
    background: none;
    border: 1px solid #D97706;
    border-radius: 4px;
    color: #92400E;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 8px;
  ">&times;</button>
</div>
`.trim();
}

export function renderTemplate(
  html: string,
  css: string,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const bodyContent = options.zoneScript ? options.zoneScript : Mustache.render(html, data);

  const hotReloadMarkup = options.hotReload ? `\n${buildHotReloadScript()}` : '';
  const bannerMarkup = options.mockDataBanner ? `\n${buildMockDataBanner()}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Template Preview</title>
  <style>${css}</style>
</head>
<body>
${bannerMarkup}
${bodyContent}
${hotReloadMarkup}
</body>
</html>`;
}




