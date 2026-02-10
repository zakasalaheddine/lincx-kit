import { describe, it, expect } from 'bun:test';
import {
  AuthError,
  ApiError,
  FileError,
  ValidationError,
} from '../../utils/errors.ts';

// ---------------------------------------------------------------------------
// AuthError
// ---------------------------------------------------------------------------

describe('AuthError', () => {
  it('creates an instance with the correct name', () => {
    const err = new AuthError('not authenticated');
    expect(err.name).toBe('AuthError');
  });

  it('stores the message', () => {
    const err = new AuthError('token expired');
    expect(err.message).toBe('token expired');
  });

  it('stores an optional code', () => {
    const err = new AuthError('forbidden', 'AUTH_FORBIDDEN');
    expect(err.code).toBe('AUTH_FORBIDDEN');
  });

  it('defaults code to undefined', () => {
    const err = new AuthError('missing');
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new AuthError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('creates an instance with the correct name', () => {
    const err = new ApiError('server error');
    expect(err.name).toBe('ApiError');
  });

  it('stores the message', () => {
    const err = new ApiError('not found');
    expect(err.message).toBe('not found');
  });

  it('stores optional status', () => {
    const err = new ApiError('bad request', { status: 400 });
    expect(err.status).toBe(400);
  });

  it('stores optional code', () => {
    const err = new ApiError('conflict', { code: 'CONFLICT' });
    expect(err.code).toBe('CONFLICT');
  });

  it('stores optional details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new ApiError('validation failed', { details });
    expect(err.details).toEqual(details);
  });

  it('defaults all optional properties to undefined', () => {
    const err = new ApiError('generic');
    expect(err.status).toBeUndefined();
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new ApiError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });

  it('supports all options together', () => {
    const err = new ApiError('all options', {
      status: 500,
      code: 'INTERNAL',
      details: { trace: '...' },
    });
    expect(err.status).toBe(500);
    expect(err.code).toBe('INTERNAL');
    expect(err.details).toEqual({ trace: '...' });
  });
});

// ---------------------------------------------------------------------------
// FileError
// ---------------------------------------------------------------------------

describe('FileError', () => {
  it('creates an instance with the correct name', () => {
    const err = new FileError('read failed');
    expect(err.name).toBe('FileError');
  });

  it('stores the message', () => {
    const err = new FileError('not found');
    expect(err.message).toBe('not found');
  });

  it('stores optional path', () => {
    const err = new FileError('missing', { path: '/tmp/config.json' });
    expect(err.path).toBe('/tmp/config.json');
  });

  it('stores optional code', () => {
    const err = new FileError('permission denied', { code: 'EACCES' });
    expect(err.code).toBe('EACCES');
  });

  it('defaults optional properties to undefined', () => {
    const err = new FileError('generic');
    expect(err.path).toBeUndefined();
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new FileError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(FileError);
  });

  it('supports path and code together', () => {
    const err = new FileError('write failed', { path: '/a/b.json', code: 'ENOENT' });
    expect(err.path).toBe('/a/b.json');
    expect(err.code).toBe('ENOENT');
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  it('creates an instance with the correct name', () => {
    const err = new ValidationError('invalid data');
    expect(err.name).toBe('ValidationError');
  });

  it('stores the message', () => {
    const err = new ValidationError('schema mismatch');
    expect(err.message).toBe('schema mismatch');
  });

  it('stores optional issues', () => {
    const issues = [{ path: ['name'], message: 'required' }];
    const err = new ValidationError('bad input', issues);
    expect(err.issues).toEqual(issues);
  });

  it('defaults issues to undefined', () => {
    const err = new ValidationError('generic');
    expect(err.issues).toBeUndefined();
  });

  it('is an instance of Error', () => {
    const err = new ValidationError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('accepts any type as issues', () => {
    const err1 = new ValidationError('err', 'string issue');
    expect(err1.issues).toBe('string issue');

    const err2 = new ValidationError('err', 42);
    expect(err2.issues).toBe(42);

    const err3 = new ValidationError('err', null);
    expect(err3.issues).toBeNull();
  });
});
