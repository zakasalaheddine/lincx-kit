# Template CLI

A command-line tool for managing ad templates. Pull templates from the API, preview them locally with hot reload, generate mock data, validate before pushing, and manage templates across multiple networks.

## Prerequisites

- [Bun](https://bun.sh) (v1.3.0 or later)

## Getting Started

```bash
# Install dependencies
bun install

# Authenticate with the API
bun run cli login

# Pull a template
bun run cli pull -t <template-id> -n <network>

# Start dev mode with hot reload
bun run cli dev -t <template-id> -n <network>
```

## Commands

### Authentication

```bash
# Login (interactive email/password prompt)
bun run cli login

# Logout (removes stored auth token)
bun run cli logout
```

### Template Operations

```bash
# Pull a template from the API
bun run cli pull -t <id> -n <network>
bun run cli pull -t <id> -n <network> --force    # Skip conflict detection

# Push local changes to the API (shows diff before confirmation)
bun run cli push -t <id> -n <network>
bun run cli push -t <id> -n <network> --yes       # Skip diff/confirmation

# Initialize a new template locally
bun run cli init                                   # Interactive mode
bun run cli init my-template -n my-network         # Direct mode
bun run cli init my-template -n my-network --from <template-id>  # Clone existing
```

### Preview & Development

```bash
# Preview with real ads from a zone
bun run cli preview -t <id> -n <network> -z <zone-id>
bun run cli preview -t <id> -n <network> -z <zone-id> --no-fallback

# Dev mode with mock data and hot reload
bun run cli dev -t <id> -n <network>
bun run cli dev -t <id> -n <network> -p 3000                       # Custom port
bun run cli dev -t <id> -n <network> --ads-count 10                 # Override ad count
bun run cli dev -t <id> -n <network> --mock-file ./custom-data.json # External mock data
bun run cli dev -t <id> -n <network> --watch "**/*.{html,css,json}" # Custom watch patterns
```

Both `preview` and `dev` start a local server on port 5000 (or next available) with Server-Sent Events for hot reload. The browser opens automatically.

### Discovery & Search

```bash
# List all templates across networks
bun run cli list
bun run cli list -n <network>          # Filter by network
bun run cli list -f json               # JSON output for scripting

# Search templates
bun run cli search "banner"            # Fuzzy search by name
bun run cli search --field "price"     # Search by schema field
bun run cli search --modified          # Show locally modified templates

# Show template status (local vs server)
bun run cli status -t <id> -n <network>
```

### Validation

```bash
# Validate a specific template
bun run cli validate -t <id> -n <network>

# Validate all templates
bun run cli validate --all
```

Validation checks:
- HTML syntax (unclosed/mismatched tags)
- CSS syntax (unclosed braces/strings)
- Mustache variables against schema fields
- config.json against the expected schema
- Mock data generation

Returns exit code 1 on errors (CI-friendly).

### Bulk Operations

```bash
# Sync all templates for a network (pull new, skip unchanged, warn on modified)
bun run cli sync -n <network>
bun run cli sync -n <network> --dry-run   # Preview without executing
```

### Version History

```bash
# View template version history
bun run cli history -t <id> -n <network>

# Rollback to a specific version
bun run cli history -t <id> -n <network> --rollback <version>
```

### Schema Management

```bash
# Force-refresh cached creative asset group schema from API
bun run cli refresh-schema -t <id> -n <network>
```

Schemas are cached locally with a 24-hour TTL. They refresh automatically on pull.

### Export & Import

```bash
# Export a single template
bun run cli export -t <id> -n <network> -o ./backup.tar.gz

# Export all templates in a network
bun run cli export -n <network> -o ./network-backup.tar.gz

# Export everything
bun run cli export --all -o ./full-backup.tar.gz

# Import from archive
bun run cli import ./backup.tar.gz
```

### Configuration

API URLs and defaults can be configured without code changes. Precedence order: CLI flags > environment variables > config file > defaults.

```bash
# Manage configuration
bun run cli config list                          # Show all values with sources
bun run cli config get apiUrl                    # Get a specific value
bun run cli config set apiUrl https://staging-api.example.com/api
bun run cli config reset                         # Reset to defaults
```

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `TEMPLATE_CLI_API_URL` | API server URL |
| `TEMPLATE_CLI_IDENTITY_URL` | Identity/auth server URL |
| `TEMPLATE_CLI_GEOMETER_URL` | Geometer API URL |
| `TEMPLATE_CLI_DEFAULT_NETWORK` | Default network name |
| `TEMPLATE_CLI_DEFAULT_PORT` | Default preview port |

**Config file** (`.template-cli.json` in project root):

```json
{
  "apiUrl": "https://api.lincx.com/api",
  "identityUrl": "https://ix-id.lincx.la",
  "geometerUrl": "https://api.lincx.com/geometer/api",
  "defaultNetwork": "my-network",
  "defaultPort": 3000
}
```

## Project Structure

```
src/
  cli.ts                     # Entry point, command registration
  commands/                  # CLI command implementations
    login.ts                 #   Authentication
    logout.ts                #   Remove auth token
    pull.ts                  #   Download template (with conflict detection)
    push.ts                  #   Upload template (with pre-push diff)
    preview.ts               #   Preview with real/mock ads (with fallback)
    dev.ts                   #   Dev mode with hot reload
    list.ts                  #   List templates across networks
    search.ts                #   Search templates by name/field/status
    init.ts                  #   Initialize new template locally
    validate.ts              #   Validate HTML/CSS/schema/mock data
    status.ts                #   Show local vs server sync status
    history.ts               #   Version history and rollback
    sync.ts                  #   Bulk sync for a network
    export.ts                #   Export templates to tar.gz
    import-cmd.ts            #   Import templates from tar.gz
    config-cmd.ts            #   Manage CLI configuration
    refresh-schema.ts        #   Force-refresh cached schema
  services/                  # Business logic layer
    api.ts                   #   API communication (fetchWithAuth wrapper)
    config.ts                #   Config file management (project, auth, template)
    storage.ts               #   File I/O for template files
    mock-generator.ts        #   Mock ad data generation from JSON schema
    env-config.ts            #   Environment/config file resolution
    hash.ts                  #   SHA-256 file hashing for conflict detection
    schema-cache.ts          #   Creative asset group schema caching
    auth-guard.ts            #   Centralized auth token check
  types/                     # Zod schemas and TypeScript types
    api.ts                   #   API response schemas
    config.ts                #   Config file schemas
  utils/                     # Utility modules
    constants.ts             #   API URL defaults
    errors.ts                #   Custom error classes
    error-messages.ts        #   Structured error formatting
    diff.ts                  #   Line-by-line diff utility
    bulk-helpers.ts          #   Helpers for multi-template operations
    command-wrapper.ts       #   Centralized command error handling
    file-safety.ts           #   File size validation
    template-renderer.ts     #   Mustache rendering with hot reload
    preview-helpers.ts       #   Port parsing, zone script building
  server/
    preview-server.ts        #   Bun HTTP server with SSE for hot reload
  __tests__/                 # Unit tests
    services/
      mock-generator.test.ts
      config.test.ts
    utils/
      template-renderer.test.ts
      preview-helpers.test.ts
      errors.test.ts
templates/                   # Template files (gitignored per network)
  {network}/
    {template-id}/
      template.html          # Mustache template
      styles.css             # Template styles
      config.json            # Template metadata, schema, mock config
config.json                  # Project config tracking networks/templates
.auth.json                   # Auth token (not committed)
.template-cli.json           # CLI configuration overrides (optional)
```

## Template File Structure

Each template lives in `templates/{network}/{template-id}/` with three files:

- **template.html** -- Mustache template for rendering ads
- **styles.css** -- CSS styles for the template
- **config.json** -- Metadata including:
  - Template and network identifiers
  - Creative asset group schema (field definitions)
  - Mock data configuration (ad count, field overrides)

## Mock Data Generation

The CLI generates realistic mock data based on the creative asset group schema. Field names are used to infer appropriate values:

| Field name contains | Generated value |
|---------------------|----------------|
| `image`, `logo`, `icon`, `thumbnail` | Placeholder image URL |
| `url`, `href`, `link` | Example URL |
| `price`, `cost`, `amount` | Currency value |
| `title`, `headline` | Generated sentence |
| `date` | ISO datetime |
| `color` | Hex color code |
| `cta` (with split logic) | `"Text\|URL"` format |

Custom values can be specified in `config.json` under `mockData.fieldsOptions`.

## Error Messages

All errors include structured context with:
- What happened
- Possible causes
- Steps to fix

Use `--verbose` on any command for stack traces and raw error details.

## Running Tests

```bash
# Run all tests
bun test

# Run a specific test file
bun test src/__tests__/services/mock-generator.test.ts

# Run tests matching a pattern
bun test --grep "generateMockData"
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **CLI Framework:** [Commander.js](https://github.com/tj/commander.js)
- **Interactive Prompts:** [@clack/prompts](https://github.com/bombshell-dev/clack)
- **Validation:** [Zod](https://zod.dev)
- **Templating:** [Mustache.js](https://github.com/janl/mustache.js)
