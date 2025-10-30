# Phase 2: Pull Command

This phase implements the `bun run pull` command to download templates from the API.

## Overview

**In this phase, we build:**
1. Add `getTemplate()` to `src/services/api.ts` (UPDATE existing)
2. `src/services/storage.ts` - File writing functions (CREATE NEW)
3. `src/commands/pull.ts` - Pull command (CREATE NEW)
4. Update `src/cli.ts` - Wire up pull command

**Already built:**
- All types and schemas from Phase 0
- `login()` function from Phase 1

## Goal

The pull command should:
1. Read authentication token from `.auth.json`
2. Call GET `/api/templates/{id}` with token
3. Parse template response
4. Create local folder structure
5. Save HTML, CSS, and config files
6. Update project config to track the template

## Prerequisites

**From Phase 0 (already complete):**
- `src/types/api.ts` with `Template`, `SingleTemplateResponse` schemas
- `src/utils/errors.ts` with `FileError`, `ApiError`
- `src/services/config.ts` with all config functions

**From Phase 1 (already complete):**
- `src/services/api.ts` with authenticated fetch helper
- `loadAuthToken()` working

## API Details

**Endpoint:** GET `/api/templates/{id}`

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```typescript
{
  data: Template  // Full template object
}
```

**Template Object:**
```typescript
{
  id: string,  // pattern: ^[a-z0-9]{6}$
  networkId: string,
  publisherId: string,
  creativeAssetGroupId: string,
  name: string,
  html: string,
  css?: string,  // may be undefined
  notes?: object,
  version?: number,
  archived?: boolean,
  dateCreated: string,
  dateUpdated: string,
  // ... other fields
}
```

**Error Responses:**
- 401: Unauthorized
- 403: Forbidden
- 404: Template not found
- 500: Internal Server Error

## Files to Create/Modify in This Phase

### 1. `src/services/api.ts` (UPDATE EXISTING FILE)

**Add this function to the api.ts file created in Phase 1:**
```typescript
async function getTemplate(templateId: string): Promise<Template>

// Implementation:
async function getTemplate(templateId: string): Promise<Template> {
  const token = loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run login" first.');
  }
  
  const response = await fetchWithAuth<SingleTemplateResponse>(
    `${apiBaseUrl}/api/templates/${templateId}`,
    { method: 'GET' },
    token.token
  );
  
  return response.data;
}
```

### 2. `src/services/storage.ts` (CREATE NEW FILE)

**Purpose:** File system operations for template files

**Functions to implement in this new file:**
```typescript
function ensureDirectory(path: string): void
function writeTemplateHtml(filePath: string, html: string): void
function writeStylesCss(filePath: string, css: string): void
function writeTemplateConfig(filePath: string, config: TemplateConfig): void
```

**Implementation:**
- Use Bun's file APIs (`Bun.write()`, `Bun.file()`)
- Create directories if they don't exist
- Throw `FileError` on write failures

### 3. `src/commands/pull.ts` (new)

**Purpose:** Pull template from API

**Command Arguments:**
- `-t, --template <id>`: Template ID (required)
- `-n, --network <name>`: Network folder name (required)

**Implementation Flow:**
```typescript
import { text, option, intro, outro, spinner, cancel, isCancel } from '@clack/prompts';
import { getTemplate } from '../services/api';
import { writeTemplateHtml, writeStylesCss, writeTemplateConfig } from '../services/storage';
import { loadProjectConfig, saveProjectConfig } from '../services/config';

export async function pullCommand(args: { template: string; network: string }) {
  intro('⬇️  Pulling Template from API');
  
  const s = spinner();
  s.start('Fetching template...');
  
  try {
    // 1. Get template from API
    const template = await getTemplate(args.template);
    
    s.stop('✓ Template fetched');
    
    // 2. Determine local paths
    const templateDir = `templates/${args.network}/${args.template}`;
    
    // 3. Create directory
    ensureDirectory(templateDir);
    
    // 4. Write files
    s.start('Saving to local files...');
    writeTemplateHtml(`${templateDir}/template.html`, template.html);
    writeStylesCss(`${templateDir}/styles.css`, template.css || '');
    
    // 5. Create config.json
    writeTemplateConfig(`${templateDir}/config.json`, {
      templateId: template.id,
      networkId: template.networkId,
      publisherId: template.publisherId,
      creativeAssetGroupId: template.creativeAssetGroupId,
      name: template.name,
      mockData: {
        adsCount: 3,
        ctaListCount: 5,
        useSplitLogic: true,
        declineText: 'Skip This Offer',
      },
    });
    
    s.stop('✓ Files saved');
    
    // 6. Update project config
    const projectConfig = loadProjectConfig();
    if (!projectConfig.networks[args.network]) {
      projectConfig.networks[args.network] = {
        name: args.network,
        templates: [],
      };
    }
    
    // Add or update template entry
    const existingIndex = projectConfig.networks[args.network].templates.findIndex(
      (t) => t.id === args.template
    );
    
    if (existingIndex >= 0) {
      projectConfig.networks[args.network].templates[existingIndex] = {
        id: template.id,
        name: template.name,
      };
    } else {
      projectConfig.networks[args.network].templates.push({
        id: template.id,
        name: template.name,
      });
    }
    
    saveProjectConfig(projectConfig);
    
    outro(`Template pulled successfully!\n\nSaved to: ${templateDir}/\n  - template.html\n  - styles.css\n  - config.json`);
  } catch (error) {
    s.stop('✗ Pull failed');
    outro(error.message);
  }
}
```

### 4. `src/cli.ts` (update)

**Modify:**
```typescript
import { pullCommand } from './commands/pull';

program
  .command('pull')
  .description('Download template from API')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .action(async (args) => {
    await pullCommand(args);
  });
```

## Testing This Phase

**Manual Testing:**
```bash
# First, login
bun run src/cli.ts login

# Then pull a template
bun run src/cli.ts pull -- -t dvty0b -n production

# Check files created
ls -la templates/production/dvty0b/
cat templates/production/dvty0b/template.html
cat templates/production/dvty0b/styles.css
cat templates/production/dvty0b/config.json

# Check project config updated
cat config.json
```

**Error Testing:**
- Test without login (should prompt to login first)
- Test with invalid template ID (should show 404)
- Test with malformed response (should show validation error)

**Success Criteria:**
- [ ] Fetches template from API with authentication
- [ ] Creates folder structure correctly
- [ ] Saves HTML and CSS files
- [ ] Creates config.json with all required fields
- [ ] Updates project config to track template
- [ ] Shows progress with spinners
- [ ] Handles errors gracefully

## File Structure Created

```
templates/
└── production/
    └── dvty0b/
        ├── template.html  (from API)
        ├── styles.css     (from API, or empty if missing)
        └── config.json    (generated with metadata)
```

## Blocking Dependencies

- Phase 0: Complete
- Phase 1: Login command must work

## Next Phase

Once complete, proceed to **Phase 3: Push Command**.

