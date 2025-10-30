# Implementation Phases

This directory contains detailed phase-by-phase implementation guides for the Template Manager CLI. Each phase builds on the previous ones and delivers a complete, testable feature.

## Phase Overview

### Phase 0: Dependencies and Foundation
**Goal:** Set up ALL TypeScript types, Zod schemas, error handling, and configuration management.

**Status:** Ready to implement  
**Estimated Time:** 2-3 hours  
**Deliverable:** Compiling TypeScript project with ALL types matching Swagger schemas

**Files:** Create all type files, config functions, error classes, basic CLI structure

**[Read Full Phase 0 Details →](./00-dependencies.md)**

---

### Phase 1: Login Command
**Goal:** Implement `bun run login` to authenticate users and store tokens.

**Status:** Pending Phase 0  
**Estimated Time:** 1-2 hours  
**Deliverable:** Working login command that saves `.auth.json`

**Files:** Create `api.ts` with login(), `commands/login.ts`, update CLI

**[Read Full Phase 1 Details →](./01-login.md)**

---

### Phase 2: Pull Command
**Goal:** Implement `bun run pull` to download templates from API.

**Status:** Pending Phase 1  
**Estimated Time:** 2-3 hours  
**Deliverable:** Working pull command that creates local template structure

**Files:** Add getTemplate() to api.ts, create `storage.ts`, `commands/pull.ts`, update CLI

**[Read Full Phase 2 Details →](./02-pull.md)**

---

### Phase 3: Push Command
**Goal:** Implement `bun run push` to upload templates to API.

**Status:** Pending Phase 2  
**Estimated Time:** 1-2 hours  
**Deliverable:** Working push command with confirmation and error handling

**Files:** Add updateTemplate() to api.ts, add read functions to storage.ts, create `commands/push.ts`, update CLI

**[Read Full Phase 3 Details →](./03-push.md)**

---

### Phase 4: Preview and Dev Commands
**Goal:** Implement `bun run preview` and `bun run dev` with mock/zone data.

**Status:** Pending Phase 3  
**Estimated Time:** 3-4 hours  
**Deliverable:** Working preview server with hot reload and CreativeAssetGroup-based mocks

**Files:** Add getZone() and getCreativeAssetGroup() to api.ts, create mock-generator.ts, template-renderer.ts, preview-server.ts, `commands/preview.ts`, `commands/dev.ts`, update CLI

**[Read Full Phase 4 Details →](./04-preview-dev.md)**

---

## Quick Start

1. **Read the main planning document** at `../planning.md`
2. **Review the Swagger spec** at `../swagger.json` to understand API contracts
3. **Start with Phase 0** - Build ALL types and config functions up front
4. **Work sequentially** - Each phase adds specific files/functions
5. **Test each phase** before moving to the next
6. **Follow the "Testing" sections** in each phase document

**Important:** Phase 0 builds foundational types/schemas. Later phases build command-specific functions. See each phase's "Overview" section for what's new vs. already built.

## Phase Implementation Checklist

For each phase:

- [ ] Read the phase document thoroughly
- [ ] Understand API endpoints and schemas
- [ ] Review prerequisites from previous phases
- [ ] Create/update files as specified
- [ ] Run manual tests from "Testing This Phase" section
- [ ] Verify success criteria
- [ ] Fix any errors before proceeding

## Architecture Decisions

### Why Bun?
- Native TypeScript support (no build step)
- Faster than Node.js
- Built-in fetch, HTTP server, file watching
- Fewer dependencies

### Why Zod?
- Runtime validation of API responses
- Type inference
- Clear error messages
- Type-safe schemas

### Why Phase-by-Phase?
- Each phase is independently testable
- Clear blocking dependencies
- Can stop at any phase with working features
- Easier to debug and understand

## Common Patterns

### API Calls
```typescript
// All API calls follow this pattern:
try {
  const token = loadAuthToken();
  if (!token) throw new AuthError('Not logged in');
  
  const response = await fetchWithAuth(url, options, token.token);
  return ZodSchema.parse(response);
} catch (error) {
  if (error instanceof ApiError) {
    // Handle API errors
  }
  throw error;
}
```

### File Operations
```typescript
// Read files:
const content = await Bun.file(path).text();

// Write files:
await Bun.write(path, content);

// Check existence:
const exists = await Bun.file(path).exists();
```

### CLI UX
```typescript
// Use @clack/prompts for input
const value = await text({ message: 'Enter value:' });

// Use @clack/core for spinners
const s = spinner();
s.start('Processing...');
// ... do work ...
s.stop('✓ Done');

// Use intro/outro for structure
intro('📋 Command Name');
// ... work ...
outro('Success!');
```

## Swagger Integration

All API schemas match Swagger specifications at `../swagger.json`. Key schemas:

- `#/components/schemas/template` - Template object
- `#/components/schemas/zone` - Zone object
- `#/components/schemas/creativeAssetGroup` - Data structure for mocks
- `#/components/schemas/network` - Network object
- `#/components/schemas/userCredentials` - Login credentials
- `AuthorizationResponse` - Auth response

Always validate responses against these schemas using Zod.

## Testing Strategy

Each phase includes manual testing instructions. As you build:

1. Test happy paths first
2. Test error cases (network failures, invalid data)
3. Test edge cases (empty files, missing fields)
4. Verify with actual API calls when possible

## Troubleshooting

### Common Issues

**Issue:** "Cannot find module"  
**Solution:** Check package.json dependencies and run `bun install`

**Issue:** "Zod validation error"  
**Solution:** Compare actual API response to schema in swagger.json

**Issue:** "File not found"  
**Solution:** Check file paths are relative to project root

**Issue:** "Authentication failed"  
**Solution:** Verify token in `.auth.json` and API base URL

## Next Steps

1. Start with [Phase 0: Dependencies](./00-dependencies.md)
2. Test thoroughly at each phase
3. Don't skip ahead - dependencies matter
4. Reference main planning doc for context

Ready to build? Let's start with Phase 0! 🚀

