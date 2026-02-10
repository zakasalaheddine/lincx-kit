import { AuthError, ApiError, FileError, ValidationError } from './errors.ts';

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ErrorCode = {
  // Auth
  AUTH_FAILED: 'ERR_AUTH_FAILED',
  AUTH_NOT_LOGGED_IN: 'ERR_AUTH_NOT_LOGGED_IN',

  // API – by HTTP status
  API_BAD_REQUEST: 'ERR_BAD_REQUEST',
  API_FORBIDDEN: 'ERR_FORBIDDEN',
  API_NOT_FOUND: 'ERR_NOT_FOUND',
  API_CONFLICT: 'ERR_CONFLICT',
  API_RATE_LIMIT: 'ERR_RATE_LIMIT',
  API_SERVER_ERROR: 'ERR_SERVER_ERROR',
  API_BAD_GATEWAY: 'ERR_BAD_GATEWAY',
  API_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',
  API_GENERIC: 'ERR_API',

  // File
  FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
  FILE_PERMISSION: 'ERR_FILE_PERMISSION',
  FILE_GENERIC: 'ERR_FILE',

  // Validation
  VALIDATION_FAILED: 'ERR_VALIDATION_FAILED',

  // Network
  NETWORK_REFUSED: 'ERR_NETWORK_REFUSED',
  NETWORK_TIMEOUT: 'ERR_NETWORK_TIMEOUT',
  NETWORK_GENERIC: 'ERR_NETWORK',

  // Catch-all
  UNKNOWN: 'ERR_UNKNOWN',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// Verbose mode helper
// ---------------------------------------------------------------------------

/**
 * Returns true when the user passed `--verbose` (or `-v`) on the command line.
 */
export function isVerbose(): boolean {
  return process.argv.includes('--verbose') || process.argv.includes('-v');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface FormattedError {
  code: ErrorCodeValue;
  title: string;
  explanation: string;
  causes: string[];
  steps: string[];
}

function buildOutput(fe: FormattedError, error: Error): string {
  const lines: string[] = [];

  lines.push(`\u2716 ${fe.title}`);
  lines.push('');
  lines.push(fe.explanation);

  if (fe.causes.length > 0) {
    for (const cause of fe.causes) {
      lines.push(`  \u2022 ${cause}`);
    }
  }

  if (fe.steps.length > 0) {
    lines.push('');
    lines.push('Try:');
    fe.steps.forEach((step, i) => {
      lines.push(`  ${i + 1}. ${step}`);
    });
  }

  lines.push('');
  lines.push(`Error code: ${fe.code}`);

  if (isVerbose()) {
    lines.push('');
    lines.push('--- Verbose details ---');
    lines.push(`Name: ${error.name}`);
    lines.push(`Message: ${error.message}`);
    if (error.stack) {
      lines.push('');
      lines.push(error.stack);
    }
    if ((error as any).details) {
      lines.push('');
      lines.push('Raw details:');
      try {
        lines.push(JSON.stringify((error as any).details, null, 2));
      } catch {
        lines.push(String((error as any).details));
      }
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Formatters per error class
// ---------------------------------------------------------------------------

function formatAuthError(error: AuthError): FormattedError {
  // Distinguish "not logged in" from a real 401.
  const isNotLoggedIn =
    error.message.toLowerCase().includes('not logged in') ||
    error.message.toLowerCase().includes('login first');

  if (isNotLoggedIn) {
    return {
      code: ErrorCode.AUTH_NOT_LOGGED_IN,
      title: 'Not logged in',
      explanation:
        'You need to authenticate before running this command.',
      causes: [
        'You have not logged in yet',
        'Your session token may have been deleted',
      ],
      steps: [
        "Run 'bun run cli login' to authenticate",
        'If the issue persists, check that your .auth.json file is accessible',
      ],
    };
  }

  return {
    code: ErrorCode.AUTH_FAILED,
    title: 'Authentication failed',
    explanation:
      'The API returned a 401 Unauthorized error. This usually means:',
    causes: [
      'Your password is incorrect',
      'Your account may be locked',
      'Your session may have expired',
    ],
    steps: [
      'Double-check your email and password',
      "Run 'bun run cli login' to re-authenticate",
      'Contact support if the issue persists',
    ],
  };
}

function httpStatusCode(status: number | undefined): ErrorCodeValue {
  switch (status) {
    case 400:
      return ErrorCode.API_BAD_REQUEST;
    case 403:
      return ErrorCode.API_FORBIDDEN;
    case 404:
      return ErrorCode.API_NOT_FOUND;
    case 409:
      return ErrorCode.API_CONFLICT;
    case 429:
      return ErrorCode.API_RATE_LIMIT;
    case 500:
      return ErrorCode.API_SERVER_ERROR;
    case 502:
      return ErrorCode.API_BAD_GATEWAY;
    case 503:
      return ErrorCode.API_UNAVAILABLE;
    default:
      return ErrorCode.API_GENERIC;
  }
}

function formatApiError(error: ApiError): FormattedError {
  const status = error.status;

  switch (status) {
    case 400:
      return {
        code: ErrorCode.API_BAD_REQUEST,
        title: 'Bad request',
        explanation: `The API rejected the request (HTTP 400). The payload or parameters are invalid.`,
        causes: [
          'The template ID may be malformed',
          'A required field may be missing or incorrectly formatted',
        ],
        steps: [
          'Verify the template and network IDs are correct',
          "Run the command with '--verbose' for more details",
        ],
      };

    case 403:
      return {
        code: ErrorCode.API_FORBIDDEN,
        title: 'Access denied',
        explanation:
          'The API returned a 403 Forbidden error. You do not have permission to access this resource.',
        causes: [
          'Your account may not have access to this template or network',
          'Your role may not allow this operation',
        ],
        steps: [
          'Verify you have the correct permissions for this resource',
          'Contact your admin to request access',
          "Try logging in again with 'bun run cli login'",
        ],
      };

    case 404:
      return {
        code: ErrorCode.API_NOT_FOUND,
        title: 'Resource not found',
        explanation:
          'The API returned a 404 Not Found error. The requested resource does not exist.',
        causes: [
          'The template or zone ID may be incorrect',
          'The resource may have been deleted',
        ],
        steps: [
          'Double-check the template ID and network name',
          "Use 'bun run cli list' to see available templates",
          "Use 'bun run cli search' to find the right template",
        ],
      };

    case 409:
      return {
        code: ErrorCode.API_CONFLICT,
        title: 'Conflict',
        explanation:
          'The API returned a 409 Conflict error. The resource may have been modified by someone else.',
        causes: [
          'Another user may have pushed changes to this template',
          'Your local copy is out of date',
        ],
        steps: [
          "Pull the latest version with 'bun run cli pull -t <id> -n <network>'",
          'Merge your changes and push again',
        ],
      };

    case 429:
      return {
        code: ErrorCode.API_RATE_LIMIT,
        title: 'Rate limited',
        explanation:
          'The API returned a 429 Too Many Requests error. You are sending requests too quickly.',
        causes: ['Too many requests in a short period'],
        steps: [
          'Wait a few minutes before retrying',
          'Reduce the frequency of requests',
        ],
      };

    case 500:
      return {
        code: ErrorCode.API_SERVER_ERROR,
        title: 'Server error',
        explanation:
          'The API returned a 500 Internal Server Error. This is a problem on the server side.',
        causes: [
          'The API server encountered an unexpected error',
          'There may be an ongoing service incident',
        ],
        steps: [
          'Wait a few moments and try again',
          'Check the API status page for incidents',
          'Contact support if the error persists',
        ],
      };

    case 502:
      return {
        code: ErrorCode.API_BAD_GATEWAY,
        title: 'Bad gateway',
        explanation:
          'The API returned a 502 Bad Gateway error. An upstream server is unreachable.',
        causes: [
          'The API backend may be restarting',
          'There may be a temporary network issue',
        ],
        steps: [
          'Wait a minute and try again',
          'Check the API status page for incidents',
        ],
      };

    case 503:
      return {
        code: ErrorCode.API_UNAVAILABLE,
        title: 'Service unavailable',
        explanation:
          'The API returned a 503 Service Unavailable error. The server is temporarily unable to handle requests.',
        causes: [
          'The API is undergoing maintenance',
          'The service is temporarily overloaded',
        ],
        steps: [
          'Wait a few minutes and try again',
          'Check the API status page for planned maintenance',
        ],
      };

    default:
      return {
        code: httpStatusCode(status),
        title: 'API error',
        explanation: status
          ? `The API returned an unexpected HTTP ${status} error.`
          : `An unexpected API error occurred: ${error.message}`,
        causes: [
          'The server may be experiencing issues',
          'The request may be malformed',
        ],
        steps: [
          "Run the command with '--verbose' to see the full error details",
          'Check that your network connection is stable',
          'Contact support if the issue persists',
        ],
      };
  }
}

function formatFileError(error: FileError): FormattedError {
  const filePath = error.path ?? 'unknown';
  const isPermission =
    error.code === 'EACCES' ||
    error.message.toLowerCase().includes('permission');
  const isNotFound =
    error.code === 'ENOENT' ||
    error.message.toLowerCase().includes('no such file') ||
    error.message.toLowerCase().includes('not found');

  if (isNotFound) {
    return {
      code: ErrorCode.FILE_NOT_FOUND,
      title: 'File not found',
      explanation: `Could not find the file at: ${filePath}`,
      causes: [
        'The template may not have been pulled yet',
        'The file path may be incorrect',
        'The file may have been deleted or moved',
      ],
      steps: [
        "Pull the template first with 'bun run cli pull -t <id> -n <network>'",
        'Verify the file exists at the expected path',
        'Check that the network and template names are correct',
      ],
    };
  }

  if (isPermission) {
    return {
      code: ErrorCode.FILE_PERMISSION,
      title: 'Permission denied',
      explanation: `Cannot access the file at: ${filePath}`,
      causes: [
        'You may not have read/write permission for this file',
        'The directory may be read-only',
      ],
      steps: [
        'Check file permissions with ls -la',
        'Try running with appropriate permissions',
        'Verify the templates directory is writable',
      ],
    };
  }

  return {
    code: ErrorCode.FILE_GENERIC,
    title: 'File error',
    explanation: `A file system error occurred: ${error.message}`,
    causes: [
      'The disk may be full',
      'The file may be locked by another process',
    ],
    steps: [
      'Check available disk space',
      'Close any programs that may have the file open',
      "Run the command with '--verbose' for more details",
    ],
  };
}

function formatValidationError(error: ValidationError): FormattedError {
  let fieldsInfo = '';
  if (error.issues) {
    try {
      const issues = Array.isArray(error.issues) ? error.issues : [error.issues];
      const fieldNames = issues
        .map((issue: any) => {
          if (issue.path && Array.isArray(issue.path)) {
            return issue.path.join('.');
          }
          if (typeof issue === 'string') return issue;
          return issue.message ?? JSON.stringify(issue);
        })
        .filter(Boolean);

      if (fieldNames.length > 0) {
        fieldsInfo = ` Fields with issues: ${fieldNames.join(', ')}.`;
      }
    } catch {
      // Ignore formatting issues — fall through to generic message
    }
  }

  return {
    code: ErrorCode.VALIDATION_FAILED,
    title: 'Validation failed',
    explanation: `The data did not pass validation.${fieldsInfo}`,
    causes: [
      'The config.json file may have an incorrect format',
      'Required fields may be missing or have the wrong type',
      'The API response may have changed format',
    ],
    steps: [
      'Check your config.json matches the expected schema',
      "Pull the latest template with 'bun run cli pull' to reset config",
      "Run the command with '--verbose' to see exact validation errors",
    ],
  };
}

function formatNetworkError(error: Error): FormattedError {
  const msg = error.message ?? '';

  if (msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET')) {
    return {
      code: ErrorCode.NETWORK_REFUSED,
      title: 'Connection refused',
      explanation:
        'Could not connect to the API server. The connection was refused.',
      causes: [
        'The API server may be down',
        'Your internet connection may be offline',
        'A firewall or VPN may be blocking the connection',
      ],
      steps: [
        'Check your internet connection',
        'If using a VPN, try disconnecting and reconnecting',
        'Check the API status page for outages',
        'Try again in a few minutes',
      ],
    };
  }

  if (msg.includes('ETIMEDOUT') || msg.includes('ETIME') || msg.includes('timeout')) {
    return {
      code: ErrorCode.NETWORK_TIMEOUT,
      title: 'Connection timed out',
      explanation:
        'The request to the API server timed out before a response was received.',
      causes: [
        'Your internet connection may be slow or unstable',
        'The API server may be under heavy load',
        'A firewall or proxy may be interfering',
      ],
      steps: [
        'Check your internet connection',
        'Try again in a few moments',
        'If behind a proxy, check proxy settings',
        'Contact support if the issue persists',
      ],
    };
  }

  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return {
      code: ErrorCode.NETWORK_GENERIC,
      title: 'DNS resolution failed',
      explanation:
        'Could not resolve the API server hostname. The domain could not be found.',
      causes: [
        'Your internet connection may be offline',
        'DNS resolution may be failing',
        'The API hostname may be misconfigured',
      ],
      steps: [
        'Check your internet connection',
        'Try visiting the API URL in your browser',
        'Check your DNS settings',
        'Verify the API URL in your project config',
      ],
    };
  }

  return {
    code: ErrorCode.NETWORK_GENERIC,
    title: 'Network error',
    explanation: `A network error occurred: ${msg}`,
    causes: [
      'Your internet connection may be unstable',
      'The API server may be unreachable',
    ],
    steps: [
      'Check your internet connection',
      'Try again in a few moments',
      "Run the command with '--verbose' for more details",
    ],
  };
}

// ---------------------------------------------------------------------------
// Check whether an error looks like a network error
// ---------------------------------------------------------------------------

function isNetworkError(error: Error): boolean {
  const msg = error.message ?? '';
  const networkPatterns = [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ETIME',
    'ENOTFOUND',
    'getaddrinfo',
    'fetch failed',
    'network',
    'timeout',
    'socket hang up',
  ];
  return networkPatterns.some((p) => msg.toLowerCase().includes(p.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats an error into a user-friendly, multi-line message with:
 * - A short title
 * - An explanation of what happened
 * - Possible causes
 * - Actionable steps to resolve the issue
 * - An error code for programmatic handling
 *
 * When `--verbose` is on the command line, the raw error details and stack
 * trace are appended.
 */
export function formatError(error: Error): string {
  let formatted: FormattedError;

  if (error instanceof AuthError) {
    formatted = formatAuthError(error);
  } else if (error instanceof ApiError) {
    formatted = formatApiError(error);
  } else if (error instanceof FileError) {
    formatted = formatFileError(error);
  } else if (error instanceof ValidationError) {
    formatted = formatValidationError(error);
  } else if (isNetworkError(error)) {
    formatted = formatNetworkError(error);
  } else {
    formatted = {
      code: ErrorCode.UNKNOWN,
      title: 'Unexpected error',
      explanation: error.message || 'An unknown error occurred.',
      causes: [],
      steps: [
        "Run the command with '--verbose' for more details",
        'If the issue persists, open an issue or contact support',
      ],
    };
  }

  return buildOutput(formatted, error);
}

/**
 * Returns the structured error code for a given Error instance without
 * producing a full formatted message. Useful for programmatic handling.
 */
export function getErrorCode(error: Error): ErrorCodeValue {
  if (error instanceof AuthError) {
    return formatAuthError(error).code;
  }
  if (error instanceof ApiError) {
    return httpStatusCode((error as ApiError).status);
  }
  if (error instanceof FileError) {
    return formatFileError(error).code;
  }
  if (error instanceof ValidationError) {
    return ErrorCode.VALIDATION_FAILED;
  }
  if (isNetworkError(error)) {
    return formatNetworkError(error).code;
  }
  return ErrorCode.UNKNOWN;
}
