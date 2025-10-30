# Phase 3: Push Command

This phase implements the `bun run push` command to upload templates to the API.

## Overview

**In this phase, we build:**
1. Add `updateTemplate()` to `src/services/api.ts` (UPDATE existing)
2. Add read functions to `src/services/storage.ts` (UPDATE existing)
3. `src/commands/push.ts` - Push command (CREATE NEW)
4. Update `src/cli.ts` - Wire up push command

**Already built:**
- All types and schemas from Phase 0
- Login and getTemplate from Phases 1-2
- File writing functions from Phase 2

## Goal

The push command should:
1. Read local template files (HTML, CSS, config)
2. Ask for user confirmation
3. Call PUT `/api/templates/{id}` with updated template
4. Parse response and show success
5. Handle errors gracefully

## Prerequisites

**From Phase 0:**
- All types and config functions

**From Phase 1:**
- Login working, authenticated API calls

**From Phase 2:**
- Storage functions, template reading

## API Details

**Endpoint:** PUT `/api/templates/{id}`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```typescript
Template  // Full template object per schema
```

**Key fields to include:**
- `id`: Template ID
- `networkId`: From config
- `publisherId`: From config
- `creativeAssetGroupId`: From config
- `name`: From config
- `html`: From template.html file
- `css`: From styles.css file
- All other fields from config (preserve metadata)

**Response (200):**
```typescript
{
  success: boolean,
  message: string,
  data: Template  // Updated template
}
```

**Error Responses:**
- 400: Bad Request (validation error)
- 401: Unauthorized
- 403: Forbidden
- 404: Template not found
- 500: Internal Server Error

## Files to Create/Modify

### 1. `src/services/api.ts` (update)

**Add Function:**
```typescript
async function updateTemplate(templateId: string, template: Partial<Template>): Promise<Template>

// Implementation:
async function updateTemplate(templateId: string, template: Partial<Template>): Promise<Template> {
  const token = loadAuthToken();
  if (!token) {
    throw new AuthError('Not logged in. Run "bun run login" first.');
  }
  
  const response = await fetchWithAuth<UpdateTemplateResponse>(
    `${apiBaseUrl}/api/templates/${templateId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    },
    token.token
  );
  
  return response.data;
}
```

### 2. `src/services/storage.ts` (update)

**Add Functions:**
```typescript
function readTemplateHtml(filePath: string): string
function readStylesCss(filePath: string): string
function readTemplateConfig(filePath: string): TemplateConfig
```

**Implementation:**
- Use `Bun.file().text()` to read files
- Throw `FileError` if files don't exist
- Handle empty CSS gracefully

### 3. `src/commands/push.ts` (new)

**Purpose:** Push template to API

**Command Arguments:**
- `-t, --template <id>`: Template ID (required)
- `-n, --network <name>`: Network folder name (required)

**Implementation:**
```typescript
import { confirm, intro, outro, spinner, cancel, isCancel } from '@clack/prompts';
import { updateTemplate } from '../services/api';
import { readTemplateHtml, readStylesCss, readTemplateConfig } from '../services/storage';
import { loadProjectConfig } from '../services/config';

export async function pushCommand(args: { template: string; network: string }) {
  intro('⬆️  Pushing Template to API');
  
  const templateDir = `templates/${args.network}/${args.template}`;
  
  try {
    // 1. Read local files
    const s = spinner();
    s.start('Reading local files...');
    
    const config = readTemplateConfig(`${templateDir}/config.json`);
    const html = readTemplateHtml(`${templateDir}/template.html`);
    const css = readStylesCss(`${templateDir}/styles.css`);
    
    s.stop('✓ Files read');
    
    // 2. Confirm with user
    const shouldPush = await confirm({
      message: `Push template "${config.name}" to API?`,
      initialValue: true,
    });
    
    if (isCancel(shouldPush) || !shouldPush) {
      cancel('Push cancelled');
      return;
    }
    
    // 3. Prepare template data
    const templateData: Partial<Template> = {
      id: config.templateId,
      networkId: config.networkId,
      publisherId: config.publisherId,
      creativeAssetGroupId: config.creativeAssetGroupId,
      name: config.name,
      html,
      css,
    };
    
    // 4. Update via API
    s.start('Uploading template...');
    const updated = await updateTemplate(config.templateId, templateData);
    
    s.stop('✓ Template pushed successfully!');
    outro(`Updated at: ${updated.dateUpdated}`);
  } catch (error) {
    s.stop('✗ Push failed');
    outro(error.message);
  }
}
```

### 4. `src/cli.ts` (update)

**Modify:**
```typescript
import { pushCommand } from './commands/push';

program
  .command('push')
  .description('Upload template to API')
  .requiredOption('-t, --template <id>', 'Template ID')
  .requiredOption('-n, --network <name>', 'Network folder name')
  .action(async (args) => {
    await pushCommand(args);
  });
```

## Testing This Phase

**Manual Testing:**
```bash
# Make sure you have a template pulled first
bun run src/cli.ts pull -- -t dvty0b -n production

# Edit template.html or styles.css
nano templates/production/dvty0b/template.html

# Push changes
bun run src/cli.ts push -- -t dvty0b -n production

# Should prompt for confirmation, then push
```

**Error Testing:**
- Test with missing files (should show file error)
- Test with invalid template ID (should show 404)
- Test without login (should prompt to login)
- Test with network error (should show connection error)
- Cancel confirmation (should exit gracefully)

**Success Criteria:**
- [ ] Reads local files correctly
- [ ] Shows confirmation prompt
- [ ] Sends correct data to API
- [ ] Handles PUT correctly
- [ ] Shows success message with timestamp
- [ ] Handles all error cases gracefully

## Safety Features

**Confirmation Prompt:**
- Asks user to confirm before pushing
- Prevents accidental overwrites
- Clear message showing template name

**Data Integrity:**
- Only sends `html` and `css` updates
- Preserves all IDs (networkId, publisherId, etc.)
- Does not alter template metadata unnecessarily

## Blocking Dependencies

- Phase 0: Complete
- Phase 1: Login working
- Phase 2: Pull working

## Next Phase

Once complete, proceed to **Phase 4: Preview and Dev Commands**.

