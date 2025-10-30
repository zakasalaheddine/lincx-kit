# Phase 1: Login Command

This phase implements the `bun run login` command to authenticate users and store tokens.

## Overview

**In this phase, we build:**
1. `src/services/api.ts` - API client with `login()` function
2. `src/commands/login.ts` - Login command implementation
3. Update `src/cli.ts` - Wire up login command

**Already built in Phase 0:**
- All types and schemas (UserCredentials, AuthResponse, etc.)
- Error classes (AuthError, ApiError)
- Config functions (saveAuthToken, loadAuthToken)
- CLI structure

## Goal

The login command should:
1. Prompt for email and password
2. Call POST `/api/auth/get-token` with credentials
3. Parse response and extract `authToken`
4. Save token to `.auth.json`
5. Display success message

## Prerequisites

**From Phase 0 (already complete):**
- `src/types/api.ts` with `UserCredentials`, `AuthResponse` Zod schemas
- `src/utils/errors.ts` with `AuthError`, `ApiError`
- `src/services/config.ts` with `saveAuthToken()` function
- `src/cli.ts` with basic Commander setup

## API Details

**Endpoint:** POST `/api/auth/get-token`

**Request Body:**
```typescript
{
  email: string,  // format: email
  password: string // minLength: 6
}
```

**Response (200):**
```typescript
{
  success: boolean,
  message: string,
  data: {
    authToken: string
  }
}
```

**Error Responses:**
- 401: Unauthorized
  ```typescript
  {
    error: string,
    details: string
  }
  ```
- 500: Internal Server Error

## Files to Create in This Phase

### 1. `src/services/api.ts` (CREATE NEW FILE)

**Purpose:** API client using Bun's native fetch

**Functions to implement in this file:**
```typescript
async function login(email: string, password: string): Promise<string>

// Helper function
async function fetchWithAuth<T>(
  url: string,
  options?: RequestInit,
  token?: string
): Promise<T>
```

**Implementation Details:**
- Use `fetch()` from Bun (not axios)
- Add Content-Type headers
- Parse JSON responses
- Validate responses with Zod schemas
- Throw `ApiError` with status codes on failure
- Throw `AuthError` on 401 responses

**Example:**
```typescript
const response = await fetch(`${apiBaseUrl}/api/auth/get-token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});

if (!response.ok) {
  if (response.status === 401) {
    throw new AuthError('Invalid credentials');
  }
  throw new ApiError(`API error: ${response.status}`);
}

const parsed = AuthResponseSchema.parse(await response.json());
return parsed.data.authToken;
```

### 2. `src/commands/login.ts` (CREATE NEW FILE)

**Purpose:** Interactive login command

**This is a new file you create in this phase.**

**Implementation:**
```typescript
import { text, password, intro, outro, isCancel, cancel } from '@clack/prompts';
import { login as apiLogin } from '../services/api';
import { saveAuthToken } from '../services/config';
import { spinner } from '@clack/core';

export async function loginCommand() {
  intro('🔐 Login');
  
  // Prompt for credentials
  const email = await text({
    message: 'Email:',
    validate: (value) => {
      if (!value.includes('@')) return 'Invalid email';
    },
  });
  
  if (isCancel(email)) {
    cancel('Login cancelled');
    return;
  }
  
  const passwd = await password({
    message: 'Password:',
  });
  
  if (isCancel(passwd)) {
    cancel('Login cancelled');
    return;
  }
  
  // Show spinner during API call
  const s = spinner();
  s.start('Logging in...');
  
  try {
    const token = await apiLogin(email as string, passwd as string);
    
    // Save token
    saveAuthToken({
      token,
      user: { email: email as string },
      createdAt: new Date().toISOString(),
    });
    
    s.stop('✓ Login successful!');
    outro(`Logged in as: ${email}`);
  } catch (error) {
    s.stop('✗ Login failed');
    if (error instanceof AuthError) {
      outro(error.message);
    } else {
      outro('Failed to login. Please check your credentials and try again.');
    }
  }
}
```

### 3. `src/cli.ts` (UPDATE EXISTING FILE)

**Modify the existing CLI file:**
```typescript
import { loginCommand } from './commands/login';

// Replace the stub command handler with real implementation
program
  .command('login')
  .description('Login to API')
  .action(async () => {
    await loginCommand();
  });
```

**You're updating the file that was created in Phase 0.**

## Testing This Phase

**Manual Testing:**
```bash
# Run login command
bun run src/cli.ts login

# Should prompt for email and password
# Enter test credentials

# Check .auth.json created
cat .auth.json

# Should show:
# {
#   "token": "...",
#   "user": { "email": "test@example.com" },
#   "createdAt": "2025-..."
# }
```

**Error Testing:**
- Test with invalid credentials (should show 401 error)
- Test with missing API base URL (should show connection error)
- Test cancelling prompts (should exit gracefully)

**Success Criteria:**
- [ ] Prompts for email and password with validation
- [ ] Calls correct API endpoint with correct body
- [ ] Parses response correctly
- [ ] Saves token to `.auth.json`
- [ ] Shows success message
- [ ] Handles errors gracefully
- [ ] Uses spinner for better UX

## Configuration

**Add to `config.json`:**
```json
{
  "apiBaseUrl": "https://api.example.com"
}
```

## Blocking Dependencies

- Phase 0 must be complete

## Next Phase

Once complete, proceed to **Phase 2: Pull Command**.

