
# Part 1: AI Agent Design

This part outlines the design for a conversational AI agent that acts as a client for managing templates.

## 1. Vision & Executive Summary

The goal is to create a conversational AI agent that empowers users to create, edit, and manage ad templates through natural language. The agent will act as a headless client to a central template repository (MCP), translating high-level user requests ("add a red border to the images") into API calls that modify the template's HTML, CSS, and JSON configuration.

This will dramatically speed up the template development lifecycle, ensure a single source of truth for all templates, and enable a collaborative, scalable workflow.

## 2. Core Concepts & Architecture (API-Driven)

A **Template** is a bundle of content (`html`, `css`, `config.json`) that exists on a remote server and is accessed via an API.

The **AI Agent** will be composed of four main components:
1.  **Natural Language Understanding (NLU) Core**: The central LLM that interprets user intent, maintains an in-memory representation of the template being edited, and formulates a plan of action.
2.  **API Client (`src/services/api.ts`)**: A dedicated module for all communication with the remote template server (MCP). It will be responsible for fetching, creating, and updating templates, and handling authentication.
3.  **Agent Tools**: A set of functions that allow the NLU core to interact with the API Client. These tools will replace direct filesystem access. Key tools will include `getTemplate`, `updateTemplate`, and `createTemplate`.
4.  **Knowledge Base**: A conceptual understanding of the template structure, HTML, CSS, JavaScript, and the project's available tools (like the `preview-server.ts`).

## 3. API Dependencies

The agent's functionality relies on the existence of a robust back-end API (the MCP), as detailed in Part 2 of this document. The essential endpoints are:

*   `GET /api/templates/{templateId}`
*   `PUT /api/templates/{templateId}`
*   `POST /api/templates`

## 4. User Interaction Workflow (Pull -> Edit -> Push)

This workflow mirrors modern development practices like Git.

1.  **Initiation & Pull:** The user invokes a command like `your-cli edit <template-id>`. The agent's first action is to call the `getTemplate` tool to fetch the latest version from the server.
2.  **Interactive Editing:** The user gives commands ("change the color," "add a field"). The agent modifies its in-memory copy of the template files.
3.  **Verification & Preview:** After each change, the agent should use a local preview server by feeding it the **in-memory** template content. This provides an instant live preview.
4.  **Commit & Push:** When the user is satisfied, they give a final command like "save" or "publish." The agent calls the `updateTemplate` tool, sending the complete, modified content bundle to the server.

## 5. Concise Agent Implementation Steps

1.  **Build API Client:** In the agent's project, implement the client-side functions (`getTemplate`, `updateTemplate`) with authentication.
2.  **Create Agent Tools:** Wrap the API client functions into tools for the AI.
3.  **Develop In-Memory Logic:** Enable the agent to edit template content in its memory.
4.  **Integrate Preview Server:** Adapt or create a preview server that can render the agent's in-memory content.
5.  **Enable Core Editing:** Connect all pieces to handle basic style and schema edits.
6.  **Implement Creation:** Build the `createTemplate` tool and its interactive workflow.
7.  **Add Advanced Capabilities:** Layer on complex HTML and JavaScript modification abilities.

---

# Part 2: MCP Server Implementation Plan

This section outlines the plan for building the standalone MCP (Multi-Channel Publisher) server. This server will act as the central repository and source of truth for all templates, managed via a RESTful API.

## 1. Objective
To create a backend server that provides a RESTful API for creating, reading, updating, and deleting template bundles (HTML, CSS, and config files).

## 2. Technology Stack
*   **Runtime/Framework:** Node.js with Express.js (using TypeScript).
*   **Data Storage (Prototype):** Local filesystem. A `data/` directory will house template bundles, with each template stored in a subdirectory named after its unique ID.
*   **Core Dependencies:** `express`, `cors`, `body-parser`, `uuid` (for generating template IDs).
*   **Development Dependencies:** `typescript`, `ts-node`, `nodemon`, `@types/node`, `@types/express`, `@types/cors`, `@types/uuid`.

## 3. Project Structure
A new project directory named `mcp-server` will be created with the following structure:

```
mcp-server/
├── data/
│   └── [template-id]/
│       ├── template.html
│       ├── styles.css
│       └── config.json
├── src/
│   ├── routes/
│   │   └── templates.ts  // API route handlers
│   ├── services/
│   │   └── storage.ts    // Logic for reading/writing to the filesystem
│   └── index.ts          // Main server entrypoint
├── package.json
└── tsconfig.json
```

## 4. Detailed Server Implementation Steps

### Step 1: Project Scaffolding
1.  Create the `mcp-server` directory.
2.  Run `npm init -y` to create `package.json`.
3.  Install dependencies: `npm install express cors body-parser uuid`.
4.  Install dev dependencies: `npm install -D typescript ts-node nodemon @types/node @types/express @types/cors @types/uuid`.
5.  Create `tsconfig.json` with appropriate settings for a Node.js/Express project.
6.  Add `start` and `dev` scripts to `package.json` for running the server.

### Step 2: Storage Service (`src/services/storage.ts`)
1.  Implement `createTemplate(data)`: Creates a new directory with a unique ID, and writes the `html`, `css`, and `config.json` files.
2.  Implement `getTemplate(id)`: Reads the files from the corresponding directory and returns their content.
3.  Implement `updateTemplate(id, data)`: Overwrites the files in the corresponding directory with new content.
4.  Implement `listTemplates()`: Scans the `data/` directory and returns a list of all template IDs and their names.
5.  Implement `deleteTemplate(id)`: Deletes the template's directory.

### Step 3: API Routes (`src/routes/templates.ts`)
1.  Create an Express router.
2.  Define the `POST /` route to call `storage.createTemplate`.
3.  Define the `GET /:id` route to call `storage.getTemplate`.
4.  Define the `PUT /:id` route to call `storage.updateTemplate`.
5.  Define the `GET /` route to call `storage.listTemplates`.
6.  Define the `DELETE /:id` route to call `storage.deleteTemplate`.
7.  Include robust error handling for each route (e.g., 404 for not found).

### Step 4: Server Entrypoint (`src/index.ts`)
1.  Import Express and other middleware.
2.  Create the Express app instance.
3.  Configure middleware: `cors`, `body-parser`.
4.  Mount the template routes under the `/api/templates` path.
5.  Start the server, making it listen on a configurable port (e.g., 3000).
