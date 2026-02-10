# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool for managing ad templates. It allows developers to pull templates from an API, preview them locally with hot reload, generate mock data for development, and push updates back to the server.

## Common Commands

```bash
# Install dependencies
bun install

# Run the CLI
bun run cli                    # or: bun run src/cli.ts

# CLI commands
bun run cli login              # Authenticate with API
bun run cli pull -t <id> -n <network>   # Download template
bun run cli push -t <id> -n <network>   # Upload template changes
bun run cli preview -t <id> -n <network> [-z <zoneId>]  # Preview with mock or real ads
bun run cli dev -t <id> -n <network>    # Dev mode (mock data only, no zone)

# Run tests
bun test                       # Run all tests
bun test <file>                # Run specific test file
```

## Technology Stack

- **Runtime:** Bun (use `bun` instead of `node`, `npm`, or `pnpm`)
- **CLI Framework:** Commander.js
- **Prompts:** @clack/prompts
- **Validation:** Zod
- **Templating:** Mustache.js

Refer to `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` for Bun-specific APIs and patterns.

## Architecture

```
CLI Commands (cli.ts)
    ↓
Services Layer (business logic)
    ↓
Utilities & Types (Zod schemas, rendering, errors)
```

### Key Modules

- **`src/cli.ts`** - Entry point, defines 5 commands (login, pull, push, preview, dev)
- **`src/services/api.ts`** - All API communication with `fetchWithAuth()` wrapper
- **`src/services/config.ts`** - Manages config.json, .auth.json, and template configs
- **`src/services/storage.ts`** - File I/O for template.html, styles.css
- **`src/services/mock-generator.ts`** - Generates synthetic ad data from JSON schema
- **`src/utils/template-renderer.ts`** - Mustache rendering with hot-reload injection
- **`src/server/preview-server.ts`** - Bun HTTP server with SSE for hot reload
- **`src/types/api.ts`** - Zod schemas for API responses
- **`src/types/config.ts`** - Zod schemas for local config files

### Data Flow

**Preview/Dev mode:**
1. Load template files (HTML, CSS, config)
2. Generate mock data from schema OR fetch real ads (preview with zone)
3. Render with Mustache
4. Start server on port 5000 (or next available)
5. Watch files → re-render → broadcast via SSE → browser reloads

### File Structure

Templates are stored in `templates/{network}/{template}/`:
- `template.html` - Mustache template
- `styles.css` - Template styles
- `config.json` - Template metadata, schema, and mock config

Project-level `config.json` tracks all networks/templates.

### Mock Data Generation

`mock-generator.ts` infers field types from names:
- Fields containing "image", "logo", "icon" → placeholder image URLs
- Fields containing "url", "href", "link" → URLs
- Fields containing "price", "cost" → currency values
- Fields containing "date" → ISO dates
- Fields containing "color" → hex colors

Custom values can be specified in template `config.json` under `mockData.fieldsOptions`.

## Zod Validation Pattern

API responses and config files are validated with Zod. The codebase uses flexible parsers that handle multiple response formats. When adding new API endpoints, follow the pattern in `src/types/api.ts`.
