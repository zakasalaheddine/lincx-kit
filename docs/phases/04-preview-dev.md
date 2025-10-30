# Phase 4: Preview and Dev Commands

This phase implements the `bun run preview` and `bun run dev` commands to view templates locally with zone-based or mock data.

## Overview

**In this phase, we build:**
1. Add `getZone()` and `getCreativeAssetGroup()` to `src/services/api.ts` (UPDATE existing)
2. `src/services/mock-generator.ts` - Generate mock data (CREATE NEW)
3. `src/utils/template-renderer.ts` - Render with Mustache (CREATE NEW)
4. `src/server/preview-server.ts` - Bun HTTP server (CREATE NEW)
5. `src/commands/preview.ts` - Preview command (CREATE NEW)
6. `src/commands/dev.ts` - Dev command with hot reload (CREATE NEW)
7. Update `src/cli.ts` - Wire up preview and dev commands

**Already built:**
- All types and schemas from Phase 0
- Login, pull, push from Phases 1-3
- File I/O functions from Phases 2-3

Both commands serve templates locally with two data modes:
1. **Zone Mode**: Fetches real zone data from API when `--zone <zoneId>` is provided
2. **Mock Mode**: Generates fake data based on `CreativeAssetGroup` schema when no zone is provided

The difference:
- `preview`: Static server, no hot reload
- `dev`: Watch files, auto-reload browser on changes

## Prerequisites

**From Phase 0:**
- All types including `CreativeAssetGroup` schema
- Config management

**From Phase 1:**
- Authenticated API calls

**From Phase 2:**
- Reading template files

## API Details

### Zone Endpoint

**GET `/api/zones/{id}`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```typescript
{
  data: Zone
}
```

**Zone Object includes:**
- `templateId`: The template to use
- `creativeAssetGroupId`: The data schema (if available)
- Other zone metadata

**Workflow with Zone:**
1. Fetch zone → get `templateId` and `creativeAssetGroupId`
2. If zone has its own template, load it via GET `/api/templates/{id}`
3. If zone specifies `creativeAssetGroupId`, fetch it for data shape
4. Generate mock data based on CreativeAssetGroup schema
5. Serve template with that data

### Mock Data Generation

**When no zone provided:**
- Use `creativeAssetGroupId` from template config
- Fetch `CreativeAssetGroup` schema from API (GET `/api/creative-asset-groups/{id}`)
- Parse `fields.properties` to understand data structure
- Generate fake values for each field based on type
- Apply `config.json` mockData settings (count, etc.)

## Files to Create/Modify

### 1. `src/services/api.ts` (update)

**Add Functions:**
```typescript
async function getZone(zoneId: string): Promise<Zone>
async function getCreativeAssetGroup(id: string): Promise<CreativeAssetGroup>
```

### 2. `src/services/mock-generator.ts` (new)

**Purpose:** Generate fake data based on CreativeAssetGroup schema

**Functions:**
```typescript
interface MockDataConfig {
  adsCount?: number;
  ctaListCount?: number;
  useSplitLogic?: boolean;
  declineText?: string;
}

function generateMockData(
  creativeAssetGroup: CreativeAssetGroup,
  config: MockDataConfig
): Record<string, any>

function inferFieldValue(
  fieldName: string,
  fieldSchema: any  // From properties object
): any
```

**Implementation Strategy:**
- Parse `CreativeAssetGroup.fields.properties` object
- For each property, infer type and generate fake value
- Common patterns:
  - `string` → Generate realistic text
  - `number` → Random number in reasonable range
  - `array` → Generate array of items
  - `object` → Recursively generate nested object
- Apply `config.adsCount` to generate multiple items if needed
- Respect `required` fields from schema

**Example:**
```typescript
// If CreativeAssetGroup.fields.properties contains:
{
  headline: { type: 'string' },
  price: { type: 'number' },
  images: { type: 'array', items: { type: 'string' } }
}

// Generate:
{
  headline: "Exclusive Deals Just For You",
  price: 29.99,
  images: ["https://unsplash.com/...", "https://unsplash.com/..."]
}
```

### 3. `src/utils/template-renderer.ts` (new)

**Purpose:** Render templates with Mustache

**Functions:**
```typescript
interface RenderOptions {
  hotReload?: boolean;  // Add SSE script for dev mode
}

function renderTemplate(
  html: string,
  css: string,
  data: Record<string, any>,
  options?: RenderOptions
): string
```

**Implementation:**
```typescript
import * as Mustache from 'mustache';

export function renderTemplate(
  html: string,
  css: string,
  data: Record<string, any>,
  options?: RenderOptions
): string {
  // Render HTML with Mustache
  const renderedHtml = Mustache.render(html, data);
  
  // Wrap in full HTML document
  const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Preview</title>
  <style>${css}</style>
  ${options?.hotReload ? hotReloadScript() : ''}
</head>
<body>
  ${renderedHtml}
</body>
</html>
  `;
  
  return fullHtml;
}

function hotReloadScript(): string {
  return `
<script>
  const eventSource = new EventSource('/sse');
  eventSource.onmessage = (event) => {
    if (event.data === 'reload') {
      location.reload();
    }
  };
</script>
  `;
}
```

### 4. `src/server/preview-server.ts` (new)

**Purpose:** Bun HTTP server for preview/dev

**Implementation:**
```typescript
interface ServerOptions {
  port: number;
  html: string;
  onReload?: () => void;  // Called when file changes
}

export function createServer(options: ServerOptions): {
  close: () => void;
  reload: () => void;
}
```

**Basic Server:**
```typescript
import { Server } from 'bun';

export function createServer({ port, html, onReload }: ServerOptions) {
  let currentHtml = html;
  
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      
      // SSE endpoint for hot reload
      if (url.pathname === '/sse') {
        return new Response(null, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }
      
      // Serve HTML
      return new Response(currentHtml, {
        headers: { 'Content-Type': 'text/html' },
      });
    },
  });
  
  const reload = () => {
    if (onReload) {
      onReload();
    }
    // Send SSE event to all clients
    // (Simplified - in reality need to track connections)
  };
  
  return {
    close: () => server.stop(),
    reload,
  };
}
```

### 5. `src/commands/preview.ts` (new)

**Purpose:** Preview template in browser

**Command Arguments:**
- `-t, --template <id>`: Template ID (required)
- `-n, --network <name>`: Network folder name (required)
- `-z, --zone <zoneId>`: Zone ID (optional)
- `-p, --port <port>`: Port number (optional, default 3000)

**Implementation:**
```typescript
import { intro, outro, spinner } from '@clack/prompts';
import { readTemplateHtml, readStylesCss, readTemplateConfig } from '../services/storage';
import { getZone, getCreativeAssetGroup } from '../services/api';
import { generateMockData } from '../services/mock-generator';
import { renderTemplate } from '../utils/template-renderer';
import { createServer } from '../server/preview-server';
import open from 'open';

export async function previewCommand(args: {
  template: string;
  network: string;
  zone?: string;
  port?: number;
}) {
  intro('👁️  Starting Preview Server');
  
  const s = spinner();
  s.start('Loading template...');
  
  try {
    // 1. Read local files
    const templateDir = `templates/${args.network}/${args.template}`;
    const html = readTemplateHtml(`${templateDir}/template.html`);
    const css = readStylesCss(`${templateDir}/styles.css`);
    const config = readTemplateConfig(`${templateDir}/config.json`);
    
    // 2. Generate or fetch data
    let data: Record<string, any>;
    
    if (args.zone) {
      // Zone mode
      const zone = await getZone(args.zone);
      const cag = await getCreativeAssetGroup(zone.creativeAssetGroupId || config.creativeAssetGroupId);
      data = generateMockData(cag, config.mockData || {});
    } else {
      // Mock mode
      const cag = await getCreativeAssetGroup(config.creativeAssetGroupId);
      data = generateMockData(cag, config.mockData || {});
    }
    
    // 3. Render template
    const renderedHtml = renderTemplate(html, css, data);
    
    // 4. Start server
    const port = args.port || 3000;
    const server = createServer({ port, html: renderedHtml });
    
    s.stop('✓ Preview server running');
    outro(`Preview: http://localhost:${port}\nPress Ctrl+C to stop`);
    
    // 5. Open browser
    await open(`http://localhost:${port}`);
    
    // Keep server running until interrupted
    process.on('SIGINT', () => {
      server.close();
      outro('Preview stopped');
      process.exit(0);
    });
  } catch (error) {
    s.stop('✗ Failed to start preview');
    outro(error.message);
  }
}
```

### 6. `src/commands/dev.ts` (new)

**Purpose:** Dev mode with hot reload

**Similar to preview, but adds:**
- File watching
- Auto-reload on changes
- SSE for browser refresh

**Implementation:**
```typescript
import { watch } from 'bun';

export async function devCommand(args: {
  template: string;
  network: string;
  zone?: string;
  port?: number;
}) {
  // Similar setup to preview
  
  let currentServer = createServer({ port, html, onReload: () => reloadServer() });
  
  // Watch files
  const watcher = watch([`${templateDir}/*.html`, `${templateDir}/*.css`, `${templateDir}/config.json`], {
    ignore: [],
  });
  
  for await (const event of watcher) {
    if (event.op === 'change') {
      console.log(`📝 ${event.path} changed, reloading...`);
      
      // Re-read files
      const newHtml = readTemplateHtml(/*...*/);
      const newCss = readStylesCss(/*...*/);
      const newData = /*...*/;
      
      // Re-render
      const renderedHtml = renderTemplate(newHtml, newCss, newData, { hotReload: true });
      
      // Update server
      currentServer.close();
      currentServer = createServer({ port, html: renderedHtml });
      
      console.log('✓ Template reloaded');
    }
  }
}
```

### 7. `src/cli.ts` (update)

**Add Commands:**
```typescript
import { previewCommand } from './commands/preview';
import { devCommand } from './commands/dev';

program
  .command('preview')
  .description('Preview template in browser')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (args) => {
    await previewCommand(args);
  });

program
  .command('dev')
  .description('Dev mode with hot reload')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .option('-z, --zone <id>', 'Zone ID (optional)')
  .option('-p, --port <port>', 'Port number', '3000')
  .action(async (args) => {
    await devCommand(args);
  });
```

## Testing This Phase

**Manual Testing:**

```bash
# Preview with mock data
bun run src/cli.ts preview -- -t dvty0b -n production

# Preview with zone
bun run src/cli.ts preview -- -t dvty0b -n production -z abc123

# Dev mode
bun run src/cli.ts dev -- -t dvty0b -n production

# In dev mode, edit template.html and see browser auto-reload
```

**Success Criteria:**
- [ ] Loads template files correctly
- [ ] Generates mock data based on CreativeAssetGroup
- [ ] Renders HTML with Mustache
- [ ] Serves on specified port
- [ ] Opens browser automatically
- [ ] Dev mode watches files
- [ ] Dev mode auto-reloads browser
- [ ] Shows spinner for loading states
- [ ] Handles errors gracefully

## Configuration

**template config.json mockData options:**
```json
{
  "mockData": {
    "adsCount": 3,          // How many items to generate
    "ctaListCount": 5,      // CTAs per item (if applicable)
    "useSplitLogic": true,  // Whether CTAs use "Text|URL" format
    "declineText": "Skip"   // Decline button text
  }
}
```

## File Structure

```
src/
├── services/
│   ├── api.ts              (updated)
│   └── mock-generator.ts   (new)
├── utils/
│   └── template-renderer.ts (new)
├── server/
│   └── preview-server.ts   (new)
└── commands/
    ├── preview.ts          (new)
    └── dev.ts              (new)
```

## Blocking Dependencies

- Phase 0: Complete
- Phase 1: Login working
- Phase 2: Pull working
- Need to understand CreativeAssetGroup schema structure

## Next Phase

Once complete, the CLI is **fully functional**! Additional phases could include:
- `init` command for creating new templates
- Template validation
- Better error recovery
- Batch operations

