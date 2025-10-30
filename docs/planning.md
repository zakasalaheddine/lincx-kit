# Template Manager CLI - Project Overview

## The Problem We're Solving

You work with HTML/CSS ad templates that use Mustache templating. Currently, you have to:
- Edit templates in a web editor (inconvenient)
- Copy/paste between the app and your IDE (tedious)
- Can't easily preview changes without deploying (slow)
- No local version control (risky)
- Hard to reference other templates (inefficient)

## The Solution

A command-line tool that lets you:
- Edit templates in VS Code (your preferred IDE)
- Preview templates instantly with realistic fake data
- See changes in real-time with auto-reload
- Keep all templates locally in folders organized by client/network
- Sync with the API when ready (push/pull like Git)
- Version control everything with Git

---

## How It Works - The Big Picture

### Workflow Overview

```
API Database (Remote)
        ↕ (pull/push)
Local Files (Your Computer)
        ↕ (edit)
   Your IDE (VS Code)
        ↕ (preview)
  Browser (Live Preview)
```

### Daily Workflow Example

1. **Morning:** Pull latest template from API
2. **Development:** Edit HTML/CSS in VS Code
3. **Preview:** See changes instantly in browser with fake data
4. **Iterate:** Make changes, see updates automatically
5. **Deploy:** Push finished template back to API

---

## Core Concepts

### 1. Networks (Multi-Tenant Organization)

Templates are organized by "networks" (think: clients or environments).

```
templates/
├── production/          ← Production templates
│   ├── template-1/
│   └── template-2/
├── client-abc/          ← Client ABC's templates
│   ├── special-offer/
│   └── seasonal-promo/
└── staging/             ← Test templates
    └── experimental/
```

Each network is a folder. Inside are template folders.

### 2. Templates

Each template is a folder with 3 files:

```
template-id/
├── template.html    ← Your Mustache HTML
├── styles.css       ← Your CSS
└── config.json      ← Mock data configuration
```

**Why 3 files?**
- `template.html` - Clean HTML separate from styles
- `styles.css` - Easy to edit styles without touching HTML
- `config.json` - Controls how many fake ads to generate, what settings to use

### 3. Mock Data

Instead of needing real ads from the API to preview, the tool generates realistic fake data:
- Fake headlines: "Exclusive Deals Just For You"
- Fake images: Random Unsplash photos
- Fake CTAs: "Learn More", "Get Started"
- Configurable: Want 3 ads? 10 ads? Just change config.json

### 4. Live Preview

The tool starts a local web server that:
- Renders your template with Mustache
- Injects your CSS
- Fills in fake ad data
- Opens in your browser
- Watches files for changes
- Auto-reloads browser when you save

---

## Package.json Scripts

All commands are configured as Bun scripts in `package.json`:

```json
{
  "scripts": {
    "cli": "bun run src/cli.ts",
    "login": "bun run src/cli.ts login",
    "init": "bun run src/cli.ts init",
    "pull": "bun run src/cli.ts pull",
    "push": "bun run src/cli.ts push",
    "preview": "bun run src/cli.ts preview",
    "dev": "bun run src/cli.ts dev"
  }
}
```

**Usage:**
- `bun run login` - Runs the login command
- `bun run pull -- -t f94vlg -n production` - Pass arguments with `--`
- `bun src/cli.ts` - Direct execution (also works)

---

## The Commands You'll Use

### `bun run login`

**What it does:** Authenticates you with the API and saves a token locally.

**When to use:** Once at the start, or when your session expires.

**How it works:**
1. Prompts for email/password
2. Sends credentials to API (POST `/api/auth/get-token`)
3. Gets back a bearer token from `{ data: { authToken } }`
4. Saves token to `.auth.json` file (gitignored for security)
5. All future commands use this token

**Interactive prompts:**
```
Email: john@company.com
Password: ********
✓ Login successful!
Logged in as: john@company.com
```

API details:
- Endpoint: `/api/auth/get-token`
- Request body schema: `userCredentials`
- Response: `{ success, message, data: { authToken } }`

---

### `bun run init`

**What it does:** Creates a new template from scratch.

**When to use:** Starting a brand new template.

**How it works:**
1. Asks for template details (ID, name, network, zone)
2. Creates folder structure
3. Generates starter files (HTML/CSS) or blank files
4. Registers template in config
5. Ready to edit!

**Interactive prompts:**
```
Template ID: carousel-offers
Template Name: Carousel Offers Template  
Network: production (or create new)
Zone ID: demo-zone-id
Use default template? Yes
✓ Template created!
Location: templates/production/carousel-offers/
```

**What it creates:**
- `templates/production/carousel-offers/template.html`
- `templates/production/carousel-offers/styles.css`
- `templates/production/carousel-offers/config.json`

---

### `bun run pull`

**What it does:** Downloads a template from the API to your local files.

**When to use:** 
- Getting latest version from production
- Pulling a template someone else created
- Starting work on an existing template

**How it works:**
1. Calls API GET `/api/templates/{id}` with bearer token
2. Parses response `{ data: template }` where `template` matches `#/components/schemas/template`
3. Saves HTML to `template.html` and CSS to `styles.css` (empty if absent)
4. Creates `config.json` including `templateId`, `networkId`, `publisherId`, `creativeAssetGroupId`, `name`
5. Registers in your local config

**Command format:**
```bash
bun run pull -- -t f94vlg -n production
```

**Options:**
- `-t` or `--template`: The template ID from your system
- `-n` or `--network`: Which network/client folder to save in

**What happens:**
```
⬇️  Pulling Template from API
Template ID: f94vlg
Network: production

Fetching template... ✓
Saving to local files... ✓
Template pulled successfully!

Saved to: templates/production/f94vlg/
  - template.html
  - styles.css
  - config.json
```

---

### `bun run push`

**What it does:** Uploads your local template changes back to the API.

**When to use:** 
- Finished editing and ready to deploy
- Want to save work-in-progress to API
- Sharing template with team

**How it works:**
1. Reads your local HTML and CSS files
2. Asks for confirmation
3. Sends to API PUT `/api/templates/{id}` with authentication token
4. Body conforms to `#/components/schemas/template` using stored `networkId`, `publisherId`, `creativeAssetGroupId`, `name`, and updated `html/css`
5. Updates remote template

**Command format:**
```bash
bun run push -- -t f94vlg -n production
```

**What happens:**
```
⬆️  Pushing Template to API
Template ID: f94vlg
Network: production

Push template "Carousel Offers" to API? Yes
Uploading template... ✓
Template pushed successfully!
Updated at: 2025-10-29T10:30:00Z
```

**Safety:** Asks for confirmation before uploading to prevent accidents.

---

### `bun run preview`

**What it does:** Shows your template in a browser. Uses a specific zone when provided, otherwise generates mock data shaped by the CreativeAssetGroup schema.

**When to use:**
- Quick look at current state
- Don't need file watching
- Just want to see how it looks

**How it works:**
1. If `--zone <zoneId>` provided: GET `/api/zones/{id}` → `{ data: zone }`, then resolve `templateId` and (if present) `creativeAssetGroupId`; fetch template via GET `/api/templates/{id}`
2. If no zone provided: generate mock data by inspecting `CreativeAssetGroup.fields.properties` (from stored `creativeAssetGroupId`) and applying per-template `config.json` controls
3. Render HTML with Mustache, inject CSS
4. Start web server on localhost:3000, open browser automatically
5. Keeps running until you stop it (Ctrl+C)

**Command format:**
```bash
bun run preview -- -t f94vlg -n production
# With zone
bun run preview -- -t f94vlg -n production -z abc123
```

**Optional port:**
```bash
bun run preview -- -t f94vlg -n production -p 8080
```

**What happens:**
```
👁️  Starting Preview Server
Template: f94vlg
Network: production
Port: 3000

Loading template... ✓
✓ Preview server running at http://localhost:3000

Press Ctrl+C to stop
```

Browser opens showing your template with 3 fake ads (or however many you configured).

---

### `bun run dev`

**What it does:** Like preview, but with HOT RELOAD. The killer feature!

**When to use:**
- Active development/editing
- Want to see changes instantly
- Iterating on design

**How it works:**
1. Reads your template files
2. Generates fake ad data
3. Starts web server
4. Opens browser
5. **Watches files for changes**
6. When you save a file → browser auto-reloads (no F5 needed!)
7. Runs until you stop it

**Command format:**
```bash
bun run dev -- -t f94vlg -n production
```

**What happens:**
```
🚀 Starting Development Server
Template: f94vlg
Network: production
Port: 3000

Loading template... ✓
✓ Dev server running at http://localhost:3000

👀 Watching for file changes...
Press Ctrl+C to stop
```

**Then while it's running:**
```
You edit template.html in VS Code
📝 template.html changed, reloading...
✓ Template reloaded
(Browser automatically refreshes)

You edit styles.css in VS Code
📝 styles.css changed, reloading...
✓ Template reloaded
(Browser automatically refreshes)
```

**Technical detail:** Uses Server-Sent Events (SSE) via Bun's native HTTP server to notify browser of changes. No browser extension needed! Bun's native server is faster than Express for this use case.

---

## File Structure

### Project Root

```
template-manager/
├── src/                    ← All CLI tool code (TypeScript!)
│   ├── commands/          ← Command implementations
│   ├── services/          ← Business logic
│   ├── types/             ← Zod schemas and TypeScript types
│   ├── utils/             ← Helper functions
│   ├── server/            ← Bun HTTP server implementation
│   └── cli.ts             ← Main entry point
├── templates/              ← YOUR TEMPLATES (commit to Git)
│   └── [network]/
│       └── [template-id]/
├── node_modules/           ← Dependencies (don't commit)
├── .auth.json             ← Your login token (don't commit)
├── config.json            ← Project config (commit to Git)
├── package.json           ← Dependencies list
├── tsconfig.json          ← TypeScript configuration
├── .gitignore             ← Git ignore rules
└── README.md              ← Documentation
```

### Source Code Structure (TypeScript with Modern Architecture)

```
src/
├── cli.ts                 ← Main entry, routes commands
├── commands/
│   ├── login.ts          ← Handles `bun run login`
│   ├── init.ts           ← Handles `bun run init`
│   ├── pull.ts           ← Handles `bun run pull`
│   ├── push.ts           ← Handles `bun run push`
│   ├── preview.ts        ← Handles `bun run preview`
│   └── dev.ts            ← Handles `bun run dev`
├── services/
│   ├── api.ts            ← Talks to your API (using Bun fetch)
│   ├── storage.ts        ← Reads/writes local files
│   └── mock-generator.ts ← Creates fake ad data
├── types/
│   ├── config.ts         ← Zod schemas and TypeScript types
│   ├── template.ts       ← Template data structures
│   └── api.ts            ← API response types
├── utils/
│   ├── template-renderer.ts ← Mustache rendering
│   ├── errors.ts          ← Custom error classes
│   └── logger.ts          ← Structured logging
└── server/
    └── preview-server.ts  ← Bun HTTP server for preview/dev
```

**Role of each file:**

**cli.ts**
- Defines all available commands using Commander
- Parses command-line arguments with type safety
- Routes to appropriate command handler
- Shows help text
- Handles top-level errors gracefully

**commands/login.ts**
- Shows email/password prompts with @clack/prompts
- Calls API service to authenticate
- Validates response with Zod
- Saves token locally with type safety
- Shows success/error messages with @clack/core

**commands/init.ts**
- Interactive prompts with @clack/prompts (multi-select, confirm)
- Creates folder structure using Bun APIs
- Generates starter files from templates
- Validates input with Zod
- Updates config to track new template

**commands/pull.ts**
- Calls API using Bun's native fetch
- Validates API response with Zod schemas
- Saves HTML and CSS to files
- Creates config.json with defaults
- Shows progress with @clack/core spinners

**commands/push.ts**
- Reads local template files
- Validates files exist and are valid
- Confirms with user using @clack/prompts
- Sends to API with proper error handling
- Shows success confirmation

**commands/preview.ts**
- Loads template files
- Generates mock data
- Renders with Mustache
- Starts Bun HTTP server (native, fast!)
- Opens browser with open package

**commands/dev.ts**
- Everything preview does, plus:
- Watches files with Bun's native watch API
- Sets up SSE endpoint on Bun server
- Notifies browser on changes
- Hot reloads automatically
- Better performance than Express!

**services/api.ts**
- Uses Bun's native fetch (no axios needed!)
- Adds authentication headers
- Validates responses with Zod
- Type-safe error handling
- Currently has mock responses (replace with real API)
- Returns typed results

**services/storage.ts**
- Loads/saves config.json with Zod validation
- Loads/saves .auth.json with type safety
- Reads/writes template files using Bun APIs
- Creates directories
- Manages file paths
- All operations typed

**services/mock-generator.ts**
- Generates fake headlines, images, CTAs
- Respects config (how many ads, split logic, etc.)
- Returns typed data structures
- Produces realistic test data
- Fully typed with TypeScript

**types/config.ts**
- Zod schemas for config.json
- Zod schemas for template config.json
- Inferred TypeScript types
- Runtime validation

**types/template.ts**
- TypeScript interfaces for templates
- Mock data structures
- Template metadata types

**types/api.ts**
- API request/response types
- Zod schemas for API validation
- Error response types

**utils/template-renderer.ts**
- Takes HTML template + typed data
- Renders with Mustache
- Injects CSS into full HTML document
- Adds browser auto-reload script (for dev mode)
- Returns complete HTML page
- Fully typed

**utils/errors.ts**
- Custom error classes (AuthError, FileError, APIError)
- Better error messages
- Error codes for programmatic handling

**server/preview-server.ts**
- Bun HTTP server implementation
- SSE endpoint for hot reload
- Serves HTML with correct headers
- Fast and lightweight (native Bun!)

---

## Configuration Files

### config.json (Project Configuration)

**Location:** Root of project

**Purpose:** Tracks all your networks and templates

**Structure:**
```
{
  "apiBaseUrl": "https://api.example.com",
  "defaultZoneId": "demo-zone-id",
  "networks": {
    "production": {
      "name": "Production",
      "templates": [
        {
          "id": "f94vlg",
          "name": "Carousel Offers"
        }
      ]
    },
    "client-abc": {
      "name": "Client ABC",
      "templates": [
        {
          "id": "special-offer",
          "name": "Special Offer Template"
        }
      ]
    }
  }
}
```

**When it changes:**
- You run `init` → adds new template
- You run `pull` → adds pulled template
- You manually update API URL

**Should you commit to Git?** YES - tracks project structure

---

### .auth.json (Authentication Token)

**Location:** Root of project

**Purpose:** Stores your login session

**Structure:**
```
{
  "token": "bearer-token-abc123...",
  "user": {
    "email": "john@company.com"
  },
  "createdAt": "2025-10-29T10:00:00Z"
}
```

**When it changes:**
- You run `login` → creates/updates this file

**Should you commit to Git?** NO - contains sensitive token, in .gitignore

**What happens if deleted?** Just run `login` again

---

### Template config.json (Per Template)

**Location:** Inside each template folder

**Purpose:** Controls mock data generation for that specific template

**Structure:**
```
{
  "templateId": "dvty0b",
  "networkId": "abc123",
  "publisherId": "def456",
  "creativeAssetGroupId": "ghi789",
  "name": "Carousel Offers Template",
  "mockData": {
    "adsCount": 3,
    "ctaListCount": 5,
    "useSplitLogic": true,
    "declineText": "Skip This Offer"
  }
}
```

**Fields explained:**
- `templateId`: Matches folder name and API ID (pattern `^[a-z0-9]{6}$`)
- `networkId`: Owning network (pattern `^[a-z0-9]{6}$`)
- `publisherId`: Publisher that owns the template (pattern `^[a-z0-9]{6}$`)
- `creativeAssetGroupId`: Drives data shape for mocks and preview (pattern `^[a-z0-9]{6}$`)
- `name`: Human-readable name
- `mockData.adsCount`: How many ads to generate (3 = 3 fake ads)
- `mockData.ctaListCount`: How many CTA buttons per ad
- `mockData.useSplitLogic`: Whether CTAs use "Text|URL" format
- `mockData.declineText`: Text for skip button

**When to edit:**
- Want more/fewer fake ads in preview
- Template uses split logic for CTAs
- Want to test different scenarios

**Should you commit to Git?** YES - documents template settings

---

## Data Flow

### Preview/Dev Mode Flow

```
1. You run: bun run dev -- -t f94vlg -n production

2. CLI loads:
   - templates/production/f94vlg/template.html
   - templates/production/f94vlg/styles.css
   - templates/production/f94vlg/config.json

3. Mock Generator reads config:
   - adsCount: 3
   - ctaListCount: 5
   - useSplitLogic: true

4. Mock Generator creates:
   {
     zoneId: "joc8dj",
     ads: [
       {
         headline: "Exclusive Deals Just For You",
         sub_headline: "Click below to explore",
         cta_list: [
           "Learn More|https://example.com/1",
           "Get Started|https://example.com/2",
           ...
         ],
         ...
       },
       ... (2 more ads)
     ]
   }

5. Template Renderer:
   - Takes HTML template
   - Takes mock data
   - Renders with Mustache
   - Injects CSS
   - Returns complete HTML

6. Bun HTTP Server (Native, Fast!):
   - Serves HTML on localhost:3000
   - Browser shows rendered template
   - Lower latency than Express

7. File Watcher (dev mode only):
   - Monitors template.html for changes (Bun's native watch)
   - Monitors styles.css for changes
   - Monitors config.json for changes
   - Faster than chokidar!

8. You save template.html in VS Code

9. File Watcher detects change

10. Server re-renders template

11. Server sends "reload" event to browser

12. Browser automatically refreshes

13. You see updated template instantly!
```

### Pull Flow

```
1. You run: bun run pull -- -t f94vlg -n production

2. CLI reads .auth.json for token

3. API Service calls:
   GET /api/templates/f94vlg
   Headers: Authorization: Bearer <token>

4. API returns:
   {
     data: {
       id: "f94vlg",
       networkId: "abc123",
       publisherId: "def456",
       creativeAssetGroupId: "ghi789",
       name: "Carousel Offers",
       html: "<div>...</div>",
       css: "body { ... }"
     }
   }

5. Storage Service creates:
   - templates/production/f94vlg/ (folder)
   - template.html (from response.html)
   - styles.css (from response.css)
   - config.json (generated with defaults)

6. Updates config.json to register template

7. Shows success message
```

### Push Flow

```
1. You run: bun run push -- -t f94vlg -n production

2. Storage Service reads:
   - templates/production/f94vlg/template.html
   - templates/production/f94vlg/styles.css
   - templates/production/f94vlg/config.json

3. Shows confirmation prompt:
   "Push template 'Carousel Offers' to API? (Y/n)"

4. You confirm: Y

5. CLI reads .auth.json for token

6. API Service calls:
   PUT /api/templates/f94vlg
   Headers: Authorization: Bearer <token>
   Body: template (per `#/components/schemas/template`)

7. API returns:
   {
     success: true,
     message: "Updated",
     data: { /* template */ }
   }

8. Shows success message
```

---

## Dependencies Explained

### Why Each Package Is Needed (Modern Stack)

**@clack/prompts** (Interactive prompts - MODERN)
- Beautiful, accessible prompt UI
- Built-in validation
- Multi-select, confirm, input, password prompts
- Better UX than inquirer
- Part of @clack/core ecosystem
- Zero dependencies, fast

**@clack/core** (Terminal UI primitives)
- Spinners, progress bars, styled output
- Consistent design system
- Replaces chalk + ora combo
- Cross-platform support

**commander** (CLI framework)
- Mature and reliable argument parsing
- TypeScript support
- Generates help text automatically
- Example: `--template f94vlg` parsing

**mustache** (Template rendering)
- Renders your Mustache templates
- Handles `{{variable}}` and `{{#loop}}` syntax
- Produces final HTML
- This is what you already use!

**⚠️ NO axios** - Using Bun's Native Fetch
- Bun has built-in fetch API (faster than Node's)
- Native TypeScript support
- Better performance
- One less dependency!

**⚠️ NO express** - Using Bun's Native HTTP Server
- Bun has built-in HTTP server (extremely fast)
- Native WebSocket/SSE support
- Lower latency
- One less dependency!

**open** (Browser opener)
- Opens localhost:3000 in browser automatically
- Cross-platform (works on Mac/Linux/Windows)
- Convenient UX

**zod** (Runtime validation)
- Validates API responses
- Validates config files
- Type-safe schemas
- Generates TypeScript types
- Critical for data integrity

**⚠️ NO chokidar initially** - Using Bun's Native Watch
- Bun has built-in file watching
- Faster startup
- Try native first, fallback to chokidar if needed

**tsx or ts-node** - NOT NEEDED
- Bun runs TypeScript natively!
- Zero build step
- Instant execution

---

## Why Bun Instead of Node.js? (Updated 2025)

**Speed:**
- `bun install` is 6x faster than `npm install`
- Startup time is 4x faster
- File operations are faster
- Hot reload is more responsive
- **Native HTTP server is faster than Express**
- **Native fetch is faster than axios**

**Developer Experience:**
- Built-in package manager (no need for npm)
- **Native TypeScript support - NO build step needed!**
- **Native file watching - no chokidar needed**
- **Native HTTP server - no Express needed**
- **Native fetch - no axios needed**
- Modern JavaScript features
- Better error messages
- Better debugging support

**Architecture Benefits:**
- **Zero build step** - Bun runs TypeScript directly
- **Fewer dependencies** - Use native APIs where possible
- **Type safety** - TypeScript + Zod for runtime validation
- **Better performance** - Native implementations are faster

**The Catch:**
- Newer tool (less mature than Node.js)
- Windows support is production-ready in 2025
- Some corporate environments may not allow it

**Verdict:** Perfect for this project. Fast, modern, compatible, and requires fewer dependencies!

---

## Why NOT Vite?

**What Vite does:**
- Bundles JavaScript modules
- Compiles/transforms code
- Hot module replacement for web apps
- Dev server for frontend frameworks

**Why we don't need it:**
- ❌ This is a CLI tool, not a web app
- ❌ No bundling needed - Bun runs JS directly
- ❌ No compilation needed - ES modules work natively
- ❌ No framework - using plain HTML/CSS/JS
- ❌ Adds build step - slower, not faster
- ❌ Adds complexity - harder to understand

**What we do instead:**
- ✅ Bun executes JavaScript directly
- ✅ Zero build time - instant startup
- ✅ Simple file watching with Chokidar
- ✅ Plain HTML/CSS/JS in templates
- ✅ Mustache rendering server-side

**The right tool:** Vite is amazing for React/Vue apps. This isn't that.

---

## Development Workflow Examples

### Scenario 1: New Template from Scratch

```bash
# Step 1: Create template
bun run init
  > Template ID: holiday-special
  > Name: Holiday Special Offer
  > Network: client-abc
  > Zone: special-zone
  > Use default? Yes

# Step 2: Start dev mode
bun run dev -- -t holiday-special -n client-abc

# Step 3: Edit in VS Code
code templates/client-abc/holiday-special/

# Step 4: Make changes
# - Edit template.html
# - Edit styles.css
# - See changes instantly in browser

# Step 5: Happy with it? Push to API
bun run push -- -t holiday-special -n client-abc
```

### Scenario 2: Edit Existing Template

```bash
# Step 1: Get latest from API
bun run pull -- -t carousel-v2 -n production

# Step 2: Dev mode
bun run dev -- -t carousel-v2 -n production

# Step 3: Edit files
code templates/production/carousel-v2/

# Step 4: Changes show instantly

# Step 5: Done? Push back
bun run push -- -t carousel-v2 -n production
```

### Scenario 3: Test with Different Ad Counts

```bash
# Step 1: Open config
code templates/production/f94vlg/config.json

# Step 2: Change adsCount from 3 to 10
{
  "mockData": {
    "adsCount": 10,
    ...
  }
}

# Step 3: Save config.json

# Step 4: Browser auto-reloads with 10 ads!

# Step 5: Test layout with many ads
```

### Scenario 4: Work on Multiple Templates

```bash
# Terminal 1
bun run dev -- -t template-1 -n production -p 3000

# Terminal 2
bun run dev -- -t template-2 -n production -p 3001

# Terminal 3
bun run dev -- -t template-3 -n staging -p 3002

# Three browser windows, three templates!
```

### Scenario 5: Copy Template Between Networks

```bash
# Step 1: Pull from production
bun run pull -- -t winning-template -n production

# Step 2: Copy folder
cp -r templates/production/winning-template templates/client-xyz/new-template

# Step 3: Edit config in new location
code templates/client-xyz/new-template/config.json
# Change templateId, network, name

# Step 4: Preview
bun run dev -- -t new-template -n client-xyz

# Step 5: Customize for client

# Step 6: Push to API
bun run push -- -t new-template -n client-xyz
```

---

## Team Collaboration

### Setup for New Team Member

```bash
# 1. Clone repository
git clone <repo-url>
cd template-manager

# 2. Install Bun
curl -fsSL https://bun.sh/install | bash

# 3. Install dependencies
bun install

# 4. Login
bun run login
  > Email: newperson@company.com
  > Password: ********

# 5. Pull a template to start
bun run pull -- -t <template-id> -n <network>

# 6. Start working
bun run dev -- -t <template-id> -n <network>
```

### What to Commit to Git

**DO commit:**
- ✅ All files in `src/`
- ✅ All files in `templates/`
- ✅ `package.json`
- ✅ `README.md`
- ✅ `config.json`
- ✅ `.gitignore`

**DON'T commit:**
- ❌ `.auth.json` (sensitive token)
- ❌ `node_modules/` (dependencies)
- ❌ `bun.lockb` (lock file, can regenerate)
- ❌ `.DS_Store` (Mac OS files)

### Git Workflow

```bash
# Pull latest templates
git pull origin main

# Create branch for your work
git checkout -b feature/update-carousel

# Make changes
# Edit template files
bun run dev -- -t carousel -n production

# Commit changes
git add templates/production/carousel/
git commit -m "Update carousel template styling"

# Push branch
git push origin feature/update-carousel

# Create pull request
# Team reviews
# Merge to main

# Push to API when ready
bun run push -- -t carousel -n production
```

---

## When You're Ready for Real API

### Current State: Mock API

Right now, `src/services/api.js` has fake responses:

```
login() → Returns fake token
getTemplate() → Returns fake HTML/CSS
updateTemplate() → Pretends to save
```

This lets you develop and test without a working API.

### Transitioning to Real API

**Step 1: Get API Documentation**
- What's the login endpoint?
- What's the get template endpoint?
- What's the update template endpoint?
- What format do they expect?

**Step 2: Update api.ts**
- Replace MOCK_API functions with real Bun fetch calls
- Add proper headers (Bun fetch supports everything axios does)
- Update Zod schemas to match real API responses
- Handle real error responses with typed errors
- Test each endpoint

**Step 3: Update config.json**
- Change `apiBaseUrl` to real URL

**Step 4: Test Thoroughly**
- Test login with real credentials
- Test pull with known template ID
- Test push with non-critical template first
- Verify data integrity

**Step 5: Document**
- Update README with real API info
- Note any API quirks
- Document required permissions

**Timeline:** 1-2 hours once you have API docs

---

## Success Criteria

Your project is complete when:

**Functionality:**
- [ ] Can login and store token
- [ ] Can create new template with init
- [ ] Can pull existing template from API
- [ ] Can preview template with fake data
- [ ] Can edit template and see changes in dev mode
- [ ] Dev mode auto-reloads on file save
- [ ] Can push template back to API
- [ ] Multiple networks supported
- [ ] Your actual carousel template works

**Quality:**
- [ ] Error messages are clear
- [ ] Commands feel responsive
- [ ] File watching is reliable
- [ ] Browser opens automatically
- [ ] No race conditions or crashes

**Documentation:**
- [ ] README explains all commands
- [ ] Examples are provided
- [ ] Team can onboard in 10 minutes

**Usability:**
- [ ] Faster than web editor workflow
- [ ] Saves time on every template edit
- [ ] Templates are version controlled
- [ ] Easy to reference other templates

---

## Estimated Timeline

**Day 1 (4-5 hours):**
- Project setup (30 min)
- Storage service (1 hour)
- Mock generator (1 hour)
- Template renderer (1 hour)
- CLI setup + init command (1.5 hours)

**Day 2 (4-5 hours):**
- Preview command (1 hour)
- Dev command with hot reload (2 hours)
- Login/pull/push commands (2 hours)

**Day 3 (3-4 hours):**
- Testing all workflows (2 hours)
- Documentation (1 hour)
- Polish and bug fixes (1 hour)

**Total: 12-14 hours of focused work over 2-3 days**

---

## Modern Implementation Stack Summary

### Technology Choices

**Runtime:** Bun (native TypeScript, fast)
**Language:** TypeScript (strict mode, type-safe)
**CLI Framework:** Commander (mature, TypeScript support)
**Prompts/UI:** @clack/prompts + @clack/core (modern, beautiful)
**HTTP:** Bun's native fetch + HTTP server (faster than axios/Express)
**Validation:** Zod (runtime validation + type inference)
**Templating:** Mustache (your existing system)
**File Watching:** Bun's native watch API (try first, chokidar fallback)
**Browser:** open (cross-platform)

### Key Improvements Over Original Plan

1. ✅ **TypeScript throughout** - Type safety everywhere
2. ✅ **Zod validation** - Runtime + compile-time safety
3. ✅ **Native Bun APIs** - Fewer dependencies, better performance
4. ✅ **Modern CLI UX** - @clack/prompts (better than inquirer)
5. ✅ **Better error handling** - Custom error classes, typed errors
6. ✅ **Structured architecture** - Clear separation of concerns
7. ✅ **No build step** - Bun runs TypeScript directly
8. ✅ **Faster dev server** - Native Bun HTTP is faster than Express

### Package.json Dependencies

```json
{
  "dependencies": {
    "@clack/core": "^0.3.0",
    "@clack/prompts": "^0.8.0",
    "commander": "^11.0.0",
    "mustache": "^4.2.0",
    "open": "^10.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/mustache": "^4.2.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Note:** No axios, express, chokidar, chalk, ora, or inquirer needed - we use Bun's native features!

---

## Bun-Specific Implementation Details

### Using Bun's Native Fetch

```typescript
// services/api.ts
const response = await fetch(`${apiBaseUrl}/templates/${templateId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

**Benefits:**
- No axios dependency
- Native TypeScript support
- Faster than Node's fetch
- Built-in request/response streaming

### Using Bun's Native HTTP Server

```typescript
// server/preview-server.ts
Bun.serve({
  port: 3000,
  fetch(request) {
    if (request.url.endsWith('/sse')) {
      return new Response(null, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
});
```

**Benefits:**
- Faster than Express
- Lower memory usage
- Native WebSocket/SSE support
- Built-in request/response handling

### Using Bun's Native File Watching

```typescript
// commands/dev.ts
import { watch } from 'bun';

const watcher = watch('.', {
  recursive: true,
  ignore: ['node_modules'],
});

for await (const event of watcher) {
  if (event.path.endsWith('template.html')) {
    // Reload template
  }
}
```

**Benefits:**
- Faster than chokidar
- Native implementation
- Better performance on macOS/Linux
- Simple API

**Fallback:** If Bun's watch doesn't work well, fall back to `chokidar` (it's still fast, just not as fast).

### TypeScript Without Build Step

```bash
# Direct TypeScript execution
bun src/cli.ts

# Works in package.json scripts
bun run src/cli.ts login
```

**Benefits:**
- Zero build time
- Instant startup
- Full TypeScript support
- No ts-node or tsx needed

### Bun File System APIs

```typescript
// Modern file operations
await Bun.write('path/to/file', content);
const content = await Bun.file('path/to/file').text();
await Bun.file('path/to/file').arrayBuffer();
```

**Benefits:**
- Async by default
- Type-safe
- Fast implementation
- Simple API

---

## Implementation Phases

**Detailed phase-by-phase implementation guides are available in `docs/phases/`:**

- **[Phase 0: Dependencies and Foundation](phases/00-dependencies.md)** - Types, Zod schemas, config management
- **[Phase 1: Login Command](phases/01-login.md)** - Authentication flow
- **[Phase 2: Pull Command](phases/02-pull.md)** - Download templates from API
- **[Phase 3: Push Command](phases/03-push.md)** - Upload templates to API
- **[Phase 4: Preview and Dev Commands](phases/04-preview-dev.md)** - Local preview with zone/mock data

**See [phases/README.md](phases/README.md) for overview and quick start.**

## Next Steps

1. **Read the phases documentation** in `docs/phases/README.md`
2. **Start with Phase 0** and implement sequentially
3. **Test each phase** before moving to the next
4. **Follow the phase guides** which include exact file structures and code examples
5. **Reference this planning doc** for overall architecture and concepts

Ready to start building? Begin with Phase 0! 🚀