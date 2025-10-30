# Phase 0: Dependencies and Foundation

This phase establishes the foundational TypeScript types, Zod schemas, and utilities that all other phases depend on.

## Overview

Before implementing any commands, we need:
1. Type definitions matching Swagger schemas
2. Zod schemas for runtime validation
3. Configuration management functions
4. Error handling infrastructure
5. Basic CLI structure

**Note:** In this phase, we create ALL types and config functions up front. Command-specific functions (API calls, storage operations) are built in later phases.

## Files to Create

### 1. `src/types/api.ts`

**Purpose:** TypeScript types and Zod schemas for API requests/responses

**Contents:**
- `UserCredentials` type and Zod schema (email, password)
- `AuthResponse` type and Zod schema (success, message, data: { authToken })
- `Template` type and Zod schema (full `#/components/schemas/template`)
- `Zone` type and Zod schema (full `#/components/schemas/zone`)
- `CreativeAssetGroup` type and Zod schema (full `#/components/schemas/creativeAssetGroup`)
- `Network` type and Zod schema (full `#/components/schemas/network`)
- Response wrapper types: `SingleTemplateResponse`, `AuthResponse`, etc.
- Error response types

**Key Properties (from Swagger):**

```typescript
// Template (required fields)
- id: string (pattern: ^[a-z0-9]{6}$)
- networkId: string (pattern: ^[a-z0-9]{6}$)
- publisherId: string (pattern: ^[a-z0-9]{6}$)
- creativeAssetGroupId: string (pattern: ^[a-z0-9]{6}$)
- name: string
- html: string (minLength: 1)
- css?: string
- notes?: object
- version?: number
- archived?: boolean
- timestamps (dateCreated, dateUpdated, etc.)

// Zone (required fields)
- id: string
- name: string
- siteId: string
- publisherId: string
- channelId: string
- networkId: string
- templateId?: string
- creativeAssetGroupId?: string
- type?: string
- adFeedCount?: number

// CreativeAssetGroup (required fields)
- id?: string
- networkId: string
- name: string
- fields: {
    properties: object
    required?: string[]
  }
```

### 2. `src/types/config.ts`

**Purpose:** TypeScript types and Zod schemas for local configuration files

**Contents:**
- Project-level `config.json` schema
  - `apiBaseUrl: string`
  - `networks: Record<string, NetworkConfig>` where each network has templates
- Template-level `config.json` schema (in template folder)
  - `templateId: string`
  - `networkId: string`
  - `publisherId: string`
  - `creativeAssetGroupId: string`
  - `name: string`
  - `mockData?: MockDataConfig`
- `.auth.json` schema
  - `token: string`
  - `user: { email: string }`
  - `createdAt: string`

### 3. `src/utils/errors.ts`

**Purpose:** Custom error classes for better error handling

**Contents:**
- `AuthError` - Login/authentication failures
- `ApiError` - API call failures (with status codes, messages)
- `FileError` - File read/write errors
- `ValidationError` - Zod validation failures
- Each error should have clear messages and optional error codes

### 4. `src/services/config.ts` (optional, or part of storage)

**Purpose:** Load and save configuration files with validation

**Functions:**
```typescript
function loadProjectConfig(): ProjectConfig
function saveProjectConfig(config: ProjectConfig): void
function loadAuthToken(): AuthToken | null
function saveAuthToken(auth: AuthToken): void
function loadTemplateConfig(templatePath: string): TemplateConfig
function saveTemplateConfig(templatePath: string, config: TemplateConfig): void
```

All functions should:
- Use Zod validation
- Handle file not found gracefully
- Throw typed errors on validation failure

### 5. `package.json`

**Install dependencies:**
```bash
bun add @clack/core @clack/prompts commander mustache open zod
bun add -d @types/mustache @types/node typescript
```

**Scripts:**
```json
{
  "scripts": {
    "cli": "bun run src/cli.ts"
  }
}
```

### 6. `src/cli.ts` (minimal structure)

**Purpose:** Main CLI entry point with Commander setup

**Contents:**
- Import Commander
- Define command structure (empty handlers for now)
- Parse arguments
- Route to handlers
- Handle errors globally

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();

program
  .name('template-cli')
  .description('CLI tool for managing ad templates')
  .version('0.1.0');

// Commands will be added in later phases
program
  .command('login')
  .description('Login to API')
  .action(() => {
    console.log('Login command - coming soon!');
  });

// ... more commands

program.parse(process.argv);
```

## Testing This Phase

**Success Criteria:**
- [ ] All TypeScript types compile without errors
- [ ] All Zod schemas validate against Swagger spec
- [ ] Can load and save config files with validation
- [ ] Custom errors are caught and displayed properly
- [ ] `bun run src/cli.ts --help` shows command structure

**Manual Testing:**
```bash
# Compile check
bun run src/cli.ts --version

# Should show help
bun run src/cli.ts --help

# All commands should exist (even if not implemented)
bun run src/cli.ts login
```

## Blocking Dependencies

None - this is the foundation.

## Next Phase

Once complete, proceed to **Phase 1: Login Command**.

