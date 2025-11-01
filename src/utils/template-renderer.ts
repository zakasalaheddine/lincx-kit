import Mustache from 'mustache';

export interface RenderOptions {
  hotReload?: boolean;
  zoneScript?: string;
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

export function renderTemplate(
  html: string,
  css: string,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const bodyContent = options.zoneScript ? options.zoneScript : Mustache.render(html, data);

  const hotReloadMarkup = options.hotReload ? `\n${buildHotReloadScript()}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Template Preview</title>
  <style>${css}</style>
</head>
<body>
${bodyContent}
${hotReloadMarkup}
</body>
</html>`;
}




