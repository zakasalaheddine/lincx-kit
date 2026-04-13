# Plan: Natural-Language Agent System for Ad Template CLI

## Context

The repo at `/Users/salaheddinezaka/Documents/work/cli` is a Bun/TypeScript CLI for managing ad templates (`templates/{network}/{template}/{template.html,styles.css,config.json}`). Today all workflows — pull, push, preview, validate, mock, scaffold — are driven by Commander commands in `src/cli.ts`. The user wants to drive the same workflows via natural language through a coordinated set of Claude Code agents (one orchestrator + task-specialized sub-agents + skills + a thin MCP layer that wraps `src/services/*`). Four concrete workflows must be first-class: **validate a template, add functionality, fix CSS, build a template from scratch.**

Decisions locked in with user:
- Delivery: **Claude Code plugin in this repo + a new MCP server wrapping `src/services/*`** (no Bash shelling for core ops).
- Visual tooling: **Playwright MCP** against the existing preview server.
- Build-from-scratch mode: **Schema-first** — draft `creativeAssetGroup.fields` JSON schema, then derive `template.html` Mustache bindings and `styles.css` from it.

This plan is scoped to **agent schema + workflow design**. Implementation details of individual tools/prompts are deliberately thin.

---

## 1. Agent Topology (Schema)

```
┌─ template-orchestrator (root agent) ─────────────────────────────┐
│   Dispatches by intent; owns the template id + network context.  │
├──────────────────────────────────────────────────────────────────┤
│  ├── template-validator     (workflow: validate)                 │
│  ├── schema-architect       (workflow: build-from-scratch, step 1│
│  │                           add-field during add-functionality) │
│  ├── template-author        (workflow: build-from-scratch, step 2│
│  │                           mustache + HTML edits)              │
│  ├── css-stylist            (workflow: fix-css, visual polish)   │
│  ├── preview-inspector      (shared: Playwright-driven visual QA │
│  │                           for validator, stylist, author)     │
│  └── publisher              (shared: pull/push + conflict/diff)  │
└──────────────────────────────────────────────────────────────────┘
```

Orchestrator frontmatter (`.claude/agents/template-orchestrator.md`) keeps `description` triggers on phrases like "validate template", "fix the CSS on…", "add a CTA button to…", "create a new template for network X". It only holds coordination state (current `{networkId, templateId}`, active sub-agent, ExitCriteria); real work is delegated.

Each sub-agent:
- Owns a **narrow tool allowlist** (see §3).
- Returns a structured summary (`{changedFiles[], openIssues[], nextSuggestedAgent?}`) so the orchestrator can chain them.
- Is single-purpose — no sub-agent both mutates schema and mutates HTML.

---

## 2. Skills

Skills are reusable prompt+doc bundles under `.claude/skills/`. They encode conventions so agents don't re-derive them:

| Skill | Consumed by | Purpose |
|---|---|---|
| `template-schema` | schema-architect, validator | Canonical rules for `config.json` → `creativeAssetGroup.fields` (types: `string`/`image`/`array`/`object`, `required[]`, `mockData.fieldsOptions` overrides). Mirrors `src/types/config.ts:35-54` and the inference heuristics in `src/services/mock-generator.ts:113-223`. |
| `mustache-conventions` | template-author, validator | Injected fields (`adId, href, url, clickId, creativeId, templateId, id, name` — see `src/commands/validate.ts`), `{{#ads}}` iteration, `{{ }}` vs `{{{ }}}`, `data-content`/`data-show` attribute patterns observed in existing templates. |
| `ad-css-guidelines` | css-stylist | Size constraints, safe selectors, hot-reload awareness (injected `<style>` + SSE reload script from `src/utils/template-renderer.ts:9-19,58-83`). |
| `validation-checklist` | validator | Steps: HTML tag-stack, CSS brace balance, Mustache var ↔ schema cross-check, mock smoke-render. Reuses existing logic — does not reimplement. |
| `template-scaffold` | schema-architect, author | Schema-first build order; references `src/commands/init.ts` STARTER_HTML/STARTER_CSS and placeholder identity pattern. |
| `preview-playwright` | preview-inspector | How to start preview server (`mcp__template__start_preview`), await port, snapshot, diff against acceptance criteria. |

Each skill is ≤200 lines, with concrete examples pulled from existing templates (e.g. `templates/301ylr/edh0k4/`).

---

## 3. MCP Server: `mcp-template-ops`

New Bun service at `mcp-server/` (per `docs/ai-agent-plan.md` structure, but as an MCP server — not REST). Registered in plugin's `.mcp.json`. Exposes `src/services/*` as typed MCP tools so agents never touch raw FS/network for core ops.

### Tool surface (grouped by workflow)

**Read (safe, auto-approved):**
- `template.list` → root `config.json` networks/templates
- `template.read({networkId, templateId})` → `{html, css, config}` (reuses `src/services/storage.ts`)
- `template.getRemote({templateId})` → server version (reuses `api.ts:getTemplate`, `getCreativeAssetGroup`)
- `template.validate({networkId, templateId})` → reuses `src/commands/validate.ts` logic, returns structured `{errors[], warnings[], mustacheVars[], schemaFields[]}`
- `template.mock({networkId, templateId, adsCount?, fieldsOptionsOverride?})` → reuses `mock-generator.ts`
- `template.render({networkId, templateId, data})` → reuses `template-renderer.ts`

**Write (gated, require confirmation):**
- `template.writeHtml / writeCss / writeConfig({networkId, templateId, content})` — writes via `storage.ts`, updates `.pull-hashes.json`
- `template.patchSchema({networkId, templateId, op, path, value})` — structured JSONPatch-style mutation of `creativeAssetGroup.fields` + `required[]` + `mockData.fieldsOptions`
- `template.scaffold({networkId, name, fromTemplateId?})` — wraps `init.ts`

**Preview (long-lived):**
- `preview.start({networkId, templateId, useZone?, zoneId?})` → starts server, returns `{port, url}`. Internally runs `preview.ts`/`dev.ts` paths.
- `preview.reload()` / `preview.stop()`

**Remote (confirmation-gated):**
- `template.pull({templateId, networkId, force?})`
- `template.push({templateId, networkId})` → returns diff first, requires explicit confirm arg

All write/remote tools return a dry-run diff when `confirm:false` so the orchestrator can show changes before applying.

---

## 4. Workflows (what the user types → what happens)

### Workflow A — Validate (`"check the validity of template edh0k4"`)

1. Orchestrator resolves `{networkId, templateId}` (asks if ambiguous).
2. Delegates to **template-validator**.
3. Validator calls `template.validate` (static) → if warnings reference visual issues, hands off to **preview-inspector**.
4. preview-inspector: `preview.start` → Playwright `browser_navigate` + `browser_snapshot` + `browser_console_messages` → reports visual/JS errors.
5. Validator assembles final report `{pass/fail, errors, warnings, screenshots, unusedFields, missingFields}`.

### Workflow B — Add functionality (`"add a price badge that shows when discounted is true"`)

1. Orchestrator → **schema-architect**: decides new field(s) (`price: string`, `discounted: boolean`) + required flags + `mockData.fieldsOptions` examples. Emits `template.patchSchema` ops.
2. → **template-author**: reads current `template.html`, inserts Mustache markup honoring `mustache-conventions` skill (`{{#discounted}}<span class="badge">{{price}}</span>{{/discounted}}`). Uses `template.writeHtml`.
3. → **css-stylist**: adds `.badge` rule to `styles.css` via `template.writeCss`.
4. → **preview-inspector**: starts preview with mock data crafted to exercise both branches; screenshots both; confirms.
5. → **template-validator**: final pass. Orchestrator reports diff; user says "push" → **publisher** runs `template.push`.

### Workflow C — Fix CSS (`"the CTA button is overflowing on mobile"`)

1. Orchestrator → **preview-inspector** first (not stylist). Playwright: load preview, `browser_resize` to mobile, snapshot, measure overflow via `browser_evaluate`.
2. → **css-stylist**: receives concrete defect (element + computed styles + box dimensions). Patches `styles.css` via `template.writeCss`. Explicitly **does not** touch HTML or schema (tool allowlist enforces this).
3. → **preview-inspector** re-verifies at same viewport. Loop up to N=3 iterations before asking user.
4. → **template-validator** runs CSS brace/string check.

### Workflow D — Build from scratch (`"create a new retail banner template for network u5dr9f"`)

Schema-first, per user's choice:

1. Orchestrator → **schema-architect**: interviews user for fields (title, cta, image, etc.) OR proposes a default retail-banner schema; produces a full `config.json.creativeAssetGroup.fields` draft + `mockData.fieldsOptions` sample values. Uses `template-schema` skill.
2. Calls `template.scaffold({networkId, name})` (wraps `init.ts`) to create the directory with placeholder IDs, then overwrites `config.json` with the drafted schema via `template.writeConfig`.
3. → **template-author**: generates `template.html` strictly from the schema — every `required` field gets a Mustache binding; arrays become `{{#items}}...{{/items}}` loops; `image` type becomes `<img src="{{ url }}">`. Applies `mustache-conventions` skill.
4. → **css-stylist**: generates baseline `styles.css` matching the HTML structure.
5. → **preview-inspector**: Playwright-verifies against mocks at desktop + mobile.
6. → **template-validator**: ensures schema ↔ template ↔ mocks are consistent (zero unused/missing fields).
7. Orchestrator instructs user on replacing placeholder identity fields and running `template.push` once remote template is created.

---

## 5. Schema Contracts Between Agents

To keep sub-agents composable, each returns JSON-shaped output the orchestrator can route on:

```ts
type AgentResult = {
  agent: string;
  status: "done" | "needs_input" | "failed";
  changedFiles: Array<{ path: string; op: "create" | "update"; bytesDelta: number }>;
  diagnostics: Array<{ level: "error" | "warn" | "info"; message: string; ref?: string }>;
  artifacts?: { screenshots?: string[]; diff?: string; };
  nextSuggestedAgent?: string;
};
```

Schema mutations always go through a single typed payload:

```ts
type SchemaPatch =
  | { op: "addField"; name: string; type: "string"|"image"|"array"|"object"; required?: boolean; items?: SchemaPatch[]; mockOptions?: unknown[] }
  | { op: "removeField"; name: string }
  | { op: "setRequired"; name: string; required: boolean }
  | { op: "setMockOptions"; name: string; options: unknown[] };
```

This is the **only** way `creativeAssetGroup.fields` is mutated — enforced by giving only `schema-architect` the `template.patchSchema` tool.

---

## 6. Critical Files to Create / Modify

**New (plugin surface):**
- `.claude/plugin.json`
- `.claude/.mcp.json` (registers `mcp-template-ops`)
- `.claude/agents/{template-orchestrator,template-validator,schema-architect,template-author,css-stylist,preview-inspector,publisher}.md`
- `.claude/skills/{template-schema,mustache-conventions,ad-css-guidelines,validation-checklist,template-scaffold,preview-playwright}/SKILL.md`

**New (MCP server):**
- `mcp-server/src/index.ts` — MCP stdio server bootstrap
- `mcp-server/src/tools/{template,preview,remote}.ts` — tool adapters, all calling existing `src/services/*`
- `mcp-server/src/schema.ts` — Zod schemas for tool inputs (reuse `src/types/config.ts` + `src/types/api.ts` where possible)

**Reused without modification:**
- `src/services/api.ts` — all remote calls
- `src/services/storage.ts` — FS I/O
- `src/services/mock-generator.ts` — mocks (incl. `resolveFieldOption` at `:23-64`)
- `src/services/config.ts` — config management
- `src/utils/template-renderer.ts` — render + hot reload
- `src/server/preview-server.ts` — SSE server
- `src/commands/validate.ts` — validation logic (extract core into `src/services/validate.ts` so MCP can call it without Commander)
- `src/commands/init.ts` — scaffolding (same extraction)

**Light refactor only:** pull the function bodies of `validateCommand` and `initCommand` into service modules; CLI commands become thin wrappers. No behavior change.

---

## 7. Verification

1. **Unit**: add tests under `mcp-server/__tests__/` for each MCP tool adapter — mirror existing `src/__tests__/` style. Verify tool outputs equal direct service calls on fixture templates (e.g. `templates/301ylr/edh0k4`).
2. **Validate workflow**: run orchestrator on an intentionally-broken copy of a template (missing required field, extra Mustache var, unbalanced CSS brace). Expect structured errors matching `bun run cli validate`.
3. **CSS workflow**: introduce a known overflow on a known template; ask "fix the overflow"; expect css-stylist to emit a `styles.css` diff and Playwright re-snapshot to pass at mobile viewport.
4. **Add-functionality workflow**: on a fixture template, ask "add a subtitle field"; assert schema patch + HTML patch + CSS patch + mock regeneration + validator pass, all without leaving the plugin.
5. **Build-from-scratch workflow**: ask for "a new 300x250 retail banner for network u5dr9f"; assert final directory matches `templates/{networkId}/{slug}/` with schema-derived HTML, non-empty `fieldsOptions`, and `bun run cli validate -t <id> -n u5dr9f` passing.
6. **End-to-end**: keep `bun run cli` fully functional in parallel — every MCP tool round-trips through the same services used by Commander, so existing tests (`src/__tests__/*`) must stay green.
