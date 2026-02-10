# Product Requirements Document: Template CLI Improvements

## Executive Summary

The Template CLI is a command-line tool for managing ad templates. While it provides core functionality for pulling, pushing, and previewing templates, it lacks essential features for a complete template management workflow. This PRD outlines improvements to make the CLI more robust, user-friendly, and production-ready.

---

## Current State Analysis

### What Works Well
- Basic CRUD operations (pull, push) with the API
- Hot-reload preview with SSE
- Mock data generation from JSON schema
- Mustache template rendering
- Port fallback for preview server

### Critical Gaps
1. **No template discovery** - Users can't list or search templates
2. **Silent overwrites** - Pull command overwrites local changes without warning
3. **No pre-push validation** - Invalid templates can be pushed to production
4. **Hardcoded configuration** - Can't use staging/dev APIs without code changes
5. **Poor error feedback** - Generic messages without actionable guidance
6. **No offline workflow** - Can't create templates locally first

---

## User Personas

### Template Developer
- Creates and maintains ad templates
- Needs rapid iteration with live preview
- Wants to validate templates before pushing
- Works across multiple networks/projects

### Template Manager
- Oversees template library across networks
- Needs to audit, search, and organize templates
- Requires visibility into template status and versions

---

## Feature Requirements

### P0 - Critical (Must Have)

#### 1. Template Listing & Discovery
**Problem:** Users must manually check config.json to see available templates.

**Solution:**
```bash
cli list                           # List all templates across networks
cli list --network <name>          # List templates for specific network
cli list --format json             # Machine-readable output
```

**Output:**
```
Network: acme-corp
├── hero-banner (id: abc123) - Last pulled: 2024-02-10
├── sidebar-ad (id: def456) - Last pulled: 2024-02-08
└── footer-widget (id: ghi789) - Modified locally

Network: beta-inc
└── product-card (id: jkl012) - Last pulled: 2024-02-09
```

**Acceptance Criteria:**
- Shows all pulled templates with metadata
- Indicates local modification status
- Supports filtering by network
- Supports JSON output for scripting

---

#### 2. Conflict Detection on Pull
**Problem:** Pull silently overwrites local changes without warning.

**Solution:**
```bash
cli pull -t <id> -n <network>
# If local changes exist:
# ⚠ Local changes detected in template.html
#   - 15 lines added, 3 lines removed
#
# ? How do you want to proceed?
#   ○ Overwrite local changes
#   ○ Backup local files first (creates .backup/)
#   ○ Skip this template
#   ○ Cancel
```

**Acceptance Criteria:**
- Detect if local files differ from last pulled state
- Show summary of changes (lines added/removed)
- Offer backup option before overwriting
- Store last-pulled hash for comparison

---

#### 3. Template Validation Command
**Problem:** Invalid templates can be pushed, causing production issues.

**Solution:**
```bash
cli validate -t <id> -n <network>   # Validate specific template
cli validate --all                   # Validate all templates
```

**Validations:**
- HTML syntax check
- Required Mustache variables present (from schema)
- CSS syntax check
- Config.json schema validation
- Mock data generates successfully

**Output:**
```
Validating hero-banner...
✓ HTML syntax valid
✓ CSS syntax valid
✓ Required fields present: title, image, href, cta
✓ Mock data generates successfully
⚠ Warning: Unused field 'subtitle' defined in schema but not in template

Validation passed with 1 warning
```

**Acceptance Criteria:**
- Validates HTML/CSS syntax
- Checks Mustache variables against schema
- Reports warnings for unused fields
- Returns non-zero exit code on errors (for CI)

---

#### 4. Environment Configuration
**Problem:** API URLs are hardcoded; can't use staging without code changes.

**Solution:**
Support configuration via (in order of precedence):
1. CLI flags: `--api-url`, `--identity-url`
2. Environment variables: `TEMPLATE_CLI_API_URL`, `TEMPLATE_CLI_IDENTITY_URL`
3. Config file: `.template-cli.json` or `~/.template-cli/config.json`
4. Default values (current behavior)

**Config file format:**
```json
{
  "apiUrl": "https://staging-api.example.com/api",
  "identityUrl": "https://staging-id.example.com",
  "defaultNetwork": "acme-corp",
  "defaultPort": 3000
}
```

**Acceptance Criteria:**
- All API URLs configurable without code changes
- Clear precedence order documented
- `cli config` command to manage settings
- Works with staging, production, and local dev servers

---

#### 5. Improved Error Messages
**Problem:** Generic errors like "Failed to login" provide no actionable guidance.

**Solution:** Structured error messages with:
- What happened
- Why it might have happened
- How to fix it

**Examples:**
```
✖ Authentication failed

The API returned a 401 Unauthorized error. This usually means:
  • Your password is incorrect
  • Your account may be locked after too many attempts
  • Your session may have expired

Try:
  1. Double-check your email and password
  2. Run 'cli login' to re-authenticate
  3. Contact support if the issue persists
```

```
✖ Template not found

Template 'abc123' was not found in network 'acme-corp'.

This could mean:
  • The template ID is incorrect
  • The template was deleted from the server
  • You don't have access to this template

Try:
  1. Check the template ID in your config.json
  2. Run 'cli list --network acme-corp' to see available templates
```

**Acceptance Criteria:**
- All error messages include context, cause, and resolution steps
- Error codes for programmatic handling
- `--verbose` flag for debug output

---

### P1 - High Priority (Should Have)

#### 6. Pre-Push Diff Display
**Problem:** Users don't see what they're pushing; easy to push wrong changes.

**Solution:**
```bash
cli push -t <id> -n <network>

Comparing local changes with server version...

template.html:
  - <h1>{{title}}</h1>
  + <h1 class="headline">{{title}}</h1>
  + <p class="subtitle">{{subtitle}}</p>

styles.css:
  + .headline { font-size: 2rem; }
  + .subtitle { color: #666; }

? Push these changes? (y/N)
```

**Acceptance Criteria:**
- Shows unified diff before push confirmation
- Highlights additions/deletions
- Option to skip diff with `--yes` flag
- Warns if server version changed since pull

---

#### 7. Template Initialization
**Problem:** Can't create templates locally; must pull from API first.

**Solution:**
```bash
cli init <template-name> --network <network>
# or interactive:
cli init
```

**Creates:**
```
templates/acme-corp/my-template/
├── template.html    # Starter template with common patterns
├── styles.css       # Empty stylesheet
└── config.json      # Minimal config with placeholders
```

**Acceptance Criteria:**
- Creates folder structure with starter files
- Optional `--from <template-id>` to clone existing template
- Interactive mode asks for template name and network
- Validates template name (no special characters)

---

#### 8. Bulk Operations
**Problem:** Managing many templates requires running commands repeatedly.

**Solution:**
```bash
cli pull --network <network>        # Pull all templates for network
cli push --network <network>        # Push all modified templates
cli validate --network <network>    # Validate all templates
cli sync --network <network>        # Pull new, skip unchanged, warn modified
```

**Acceptance Criteria:**
- Progress indicator for bulk operations
- Summary at end (X pulled, Y skipped, Z failed)
- `--dry-run` flag to preview actions
- Parallel execution where possible

---

#### 9. Creative Asset Group Caching
**Problem:** Dev/preview fetches schema from API on every reload, slowing iteration.

**Solution:**
- Cache creative asset groups locally with TTL
- Refresh cache on pull
- Manual refresh: `cli refresh-schema -t <id> -n <network>`

**Acceptance Criteria:**
- Schema cached in template's config.json
- Cache expires after configurable TTL (default: 24h)
- `--no-cache` flag to force fresh fetch
- Warning when using stale cache

---

#### 10. Preview Fallback on API Failure
**Problem:** If zone API fails during preview, entire command fails.

**Solution:**
```
⚠ Failed to fetch ads from zone 'xyz123'
  Error: Network timeout after 5000ms

Falling back to mock data...
✓ Preview started at http://localhost:5000
```

**Acceptance Criteria:**
- Automatic fallback to mock data on API failure
- Clear indication that mock data is being used
- Option to disable fallback: `--no-fallback`
- Retry logic with configurable timeout

---

### P2 - Medium Priority (Nice to Have)

#### 11. Template Search
**Problem:** Finding templates across many networks is tedious.

**Solution:**
```bash
cli search "banner"                  # Search by name
cli search --field "price"           # Search by schema field
cli search --modified                # Show locally modified templates
```

**Acceptance Criteria:**
- Fuzzy search by template name
- Filter by schema fields
- Filter by modification status
- Search across all networks

---

#### 12. Logout Command
**Problem:** No way to clear credentials; must manually delete .auth.json.

**Solution:**
```bash
cli logout
# ✓ Logged out successfully. Auth token removed.
```

**Acceptance Criteria:**
- Removes .auth.json
- Confirmation message
- Works even if already logged out

---

#### 13. Template Status Command
**Problem:** No quick way to see template state without opening files.

**Solution:**
```bash
cli status -t <id> -n <network>

Template: hero-banner
Network: acme-corp
ID: abc123

Local Status:
  ├── template.html: Modified (15 lines changed)
  ├── styles.css: Unchanged
  └── config.json: Unchanged

Server Status:
  ├── Version: 42
  ├── Last Updated: 2024-02-10 14:30:00
  └── Updated By: user@example.com

⚠ Local changes not pushed
```

**Acceptance Criteria:**
- Shows local modification status
- Shows server version info
- Indicates sync status
- Works offline (shows local info only)

---

#### 14. Watch Additional Files
**Problem:** Dev mode only watches 3 specific files; ignores images, fonts, subdirectories.

**Solution:**
```bash
cli dev -t <id> -n <network> --watch "**/*.{html,css,json}"
```

**Config option:**
```json
{
  "watch": {
    "patterns": ["**/*.html", "**/*.css", "**/*.json"],
    "ignore": ["node_modules/**", ".git/**"]
  }
}
```

**Acceptance Criteria:**
- Configurable watch patterns
- Support for glob patterns
- Ignore patterns for node_modules, .git, etc.
- Shows which file triggered reload

---

#### 15. Mock Data CLI Overrides
**Problem:** Must edit config.json to change mock data settings.

**Solution:**
```bash
cli dev -t <id> -n <network> --ads-count 10
cli dev -t <id> -n <network> --field "title=Custom Title"
cli preview -t <id> -n <network> --mock-file ./custom-mock.json
```

**Acceptance Criteria:**
- Override ads count via CLI
- Override specific fields via CLI
- Load mock data from external JSON file
- CLI overrides take precedence over config

---

#### 16. Export/Backup Command
**Problem:** No way to backup templates or export for sharing.

**Solution:**
```bash
cli export -t <id> -n <network> -o ./backup.zip
cli export --network <network> -o ./network-backup.zip
cli export --all -o ./full-backup.zip
```

**Acceptance Criteria:**
- Exports template files to zip/tar archive
- Includes config.json with metadata
- Option to include/exclude mock data
- Import command to restore: `cli import ./backup.zip`

---

#### 17. Version History
**Problem:** No visibility into template version history; can't rollback.

**Solution:**
```bash
cli history -t <id> -n <network>

Version  Date                 Author              Changes
───────  ───────────────────  ──────────────────  ────────────────
v42      2024-02-10 14:30:00  user@example.com    Updated headline
v41      2024-02-09 10:15:00  user@example.com    Added CTA button
v40      2024-02-08 09:00:00  other@example.com   Initial version

cli rollback -t <id> -n <network> --version 41
```

**Acceptance Criteria:**
- Shows version history from API
- Displays change summary if available
- Rollback to specific version
- Confirmation before rollback

---

### P3 - Low Priority (Future Consideration)

#### 18. Plugin System for Mock Generators
Custom mock data generators for domain-specific fields.

#### 19. Responsive Preview Modes
Preview templates at different viewport sizes (mobile, tablet, desktop).

#### 20. Template Dependencies Graph
Visualize which templates share creative asset groups.

#### 21. CI/CD Integration
GitHub Actions, pre-commit hooks for validation.

#### 22. Template Analytics Dashboard
View template performance metrics from CLI.

---

## Technical Requirements

### Code Quality
- Remove all `as any` type casts
- Replace `z.any()` with proper Zod schemas
- Centralize authentication checks
- Implement consistent error handling pattern
- Add size limits for file operations
- Implement atomic writes for config files

### Testing
- Unit tests for all services
- Integration tests for CLI commands
- Mock API responses for offline testing
- Test coverage target: 80%

### Documentation
- README with getting started guide
- Command reference with examples
- Configuration reference
- Troubleshooting guide

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Commands available | 5 | 12+ |
| Error messages with resolution steps | 0% | 100% |
| Template operations requiring manual file edits | 40% | 5% |
| API URL configurability | Hardcoded | Full env/config support |
| Pre-push validation | None | HTML, CSS, schema |

---

## Implementation Phases

### Phase 1: Foundation (P0 items)
1. Environment configuration system
2. Template listing command
3. Improved error messages
4. Conflict detection on pull
5. Validation command

### Phase 2: Workflow Enhancement (P1 items)
1. Pre-push diff display
2. Template initialization
3. Bulk operations
4. Schema caching
5. Preview fallback

### Phase 3: Power Features (P2 items)
1. Search functionality
2. Status command
3. Export/backup
4. Watch configuration
5. Mock data overrides

### Phase 4: Advanced Features (P3 items)
1. Plugin system
2. Responsive preview
3. CI/CD integration
4. Version history & rollback

---

## Appendix: Current Command Reference

| Command | Description | Issues |
|---------|-------------|--------|
| `login` | Authenticate with API | Basic validation, no logout |
| `pull` | Download template | Silent overwrite, no conflict detection |
| `push` | Upload changes | No diff, no validation |
| `preview` | Live preview with zone | Complex flow, no fallback |
| `dev` | Local development | Limited file watching |
