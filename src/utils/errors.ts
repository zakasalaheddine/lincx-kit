export class AuthError extends Error {
  public readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: unknown;
  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.code = options?.code;
    this.details = options?.details;
  }
}

export class FileError extends Error {
  public readonly path?: string;
  public readonly code?: string;
  constructor(message: string, options?: { path?: string; code?: string }) {
    super(message);
    this.name = 'FileError';
    this.path = options?.path;
    this.code = options?.code;
  }
}

export class ValidationError extends Error {
  public readonly issues?: unknown;
  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}


