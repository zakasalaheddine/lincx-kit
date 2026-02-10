import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import {
  loadProjectConfig,
  saveProjectConfig,
  loadAuthToken,
  loadTemplateConfig,
} from '../../services/config.ts';
import { FileError, ValidationError } from '../../utils/errors.ts';
import type { ProjectConfig } from '../../types/config.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers - create real temp directories for each test to avoid mock issues
// ---------------------------------------------------------------------------

let tmpDir: string;

function writeTmpJson(relativePath: string, data: unknown): void {
  const fullPath = path.join(tmpDir, relativePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

function readTmpJson(relativePath: string): unknown {
  const fullPath = path.join(tmpDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-config-test-'));
});

// ---------------------------------------------------------------------------
// loadProjectConfig
// ---------------------------------------------------------------------------

describe('loadProjectConfig', () => {
  it('loads a valid project config', async () => {
    writeTmpJson('config.json', {
      networks: {
        net1: {
          id: 'net1id',
          name: 'Network 1',
          templates: [{ id: 'tpl1', name: 'Template 1' }],
        },
      },
    });

    const config = await loadProjectConfig(tmpDir);
    expect(config.networks).toBeDefined();
    expect(config.networks['net1']).toBeDefined();
    expect(config.networks['net1']!.templates).toHaveLength(1);
  });

  it('returns default config when file is missing', async () => {
    // No file written -- tmpDir is empty
    const config = await loadProjectConfig(tmpDir);
    expect(config).toBeDefined();
    expect(config.networks).toEqual({});
  });

  it('throws ValidationError for invalid config structure', async () => {
    writeTmpJson('config.json', {
      networks: 'not-an-object',
    });

    await expect(loadProjectConfig(tmpDir)).rejects.toThrow(ValidationError);
  });

  it('returns default config when config.json is not valid JSON', async () => {
    const fullPath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(fullPath, '{ broken json', 'utf-8');

    // readJsonFile catches JSON parse error and throws FileError, which loadProjectConfig handles
    const config = await loadProjectConfig(tmpDir);
    expect(config.networks).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// saveProjectConfig
// ---------------------------------------------------------------------------

describe('saveProjectConfig', () => {
  it('writes a valid project config to disk', async () => {
    const config: ProjectConfig = {
      networks: {
        abc123: {
          id: 'abc123',
          name: 'Test Network',
          templates: [{ id: 'tpl1', name: 'Template 1' }],
        },
      },
    };

    await saveProjectConfig(config, tmpDir);

    const written = readTmpJson('config.json') as ProjectConfig;
    expect(written.networks['abc123']).toBeDefined();
    expect(written.networks['abc123']!.templates).toHaveLength(1);
  });

  it('throws when config fails validation', async () => {
    const badConfig = {
      networks: {
        abc123: {
          templates: [{ id: '', name: '' }], // min(1) violation
        },
      },
    } as unknown as ProjectConfig;

    await expect(saveProjectConfig(badConfig, tmpDir)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadAuthToken
// ---------------------------------------------------------------------------

describe('loadAuthToken', () => {
  it('returns auth token when .auth.json exists and is valid', async () => {
    writeTmpJson('.auth.json', {
      token: 'abc-token-123',
      user: { email: 'test@example.com' },
      createdAt: '2025-01-01T00:00:00.000Z',
    });

    const auth = await loadAuthToken(tmpDir);
    expect(auth).not.toBeNull();
    expect(auth!.token).toBe('abc-token-123');
    expect(auth!.user.email).toBe('test@example.com');
  });

  it('returns null when .auth.json is missing', async () => {
    const auth = await loadAuthToken(tmpDir);
    expect(auth).toBeNull();
  });

  it('throws ValidationError for invalid auth structure', async () => {
    writeTmpJson('.auth.json', {
      token: '', // min(1) violation
      user: { email: 'not-an-email' },
      createdAt: '2025-01-01',
    });

    await expect(loadAuthToken(tmpDir)).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// loadTemplateConfig
// ---------------------------------------------------------------------------

describe('loadTemplateConfig', () => {
  it('loads a valid template config', async () => {
    const templateDir = path.join(tmpDir, 'templates', 'net1', 'tpl1');
    fs.mkdirSync(templateDir, { recursive: true });

    const validConfig = {
      templateId: 'tpl123',
      networkId: 'net456',
      publisherId: 'pub789',
      creativeAssetGroupId: 'cag012',
      name: 'My Template',
    };

    const configPath = path.join(templateDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(validConfig), 'utf-8');

    const config = await loadTemplateConfig(templateDir);
    expect(config.templateId).toBe('tpl123');
    expect(config.name).toBe('My Template');
  });

  it('throws FileError when config.json is missing', async () => {
    const emptyDir = path.join(tmpDir, 'empty-template');
    fs.mkdirSync(emptyDir, { recursive: true });

    await expect(loadTemplateConfig(emptyDir)).rejects.toThrow(FileError);
  });

  it('throws ValidationError for invalid template config', async () => {
    const templateDir = path.join(tmpDir, 'templates', 'bad');
    fs.mkdirSync(templateDir, { recursive: true });

    const badConfig = {
      templateId: '', // min(1) violation
      networkId: '',
      publisherId: '',
      creativeAssetGroupId: '',
      name: '',
    };

    const configPath = path.join(templateDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(badConfig), 'utf-8');

    await expect(loadTemplateConfig(templateDir)).rejects.toThrow(ValidationError);
  });

  it('throws FileError when config.json is not valid JSON', async () => {
    const templateDir = path.join(tmpDir, 'templates', 'broken');
    fs.mkdirSync(templateDir, { recursive: true });

    const configPath = path.join(templateDir, 'config.json');
    fs.writeFileSync(configPath, '{ broken }', 'utf-8');

    await expect(loadTemplateConfig(templateDir)).rejects.toThrow(FileError);
  });
});
