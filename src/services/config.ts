import { ProjectConfigSchema, type ProjectConfig, TemplateConfigSchema, type TemplateConfig, AuthTokenSchema, type AuthToken } from '../types/config.ts';
import { FileError, ValidationError } from '../utils/errors.ts';


const PROJECT_CONFIG_PATH = 'config.json';
const AUTH_PATH = '.auth.json';

async function readJsonFile<T>(path: string): Promise<T> {
  try {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new FileError('File not found', { path });
    }
    const text = await file.text();
    return JSON.parse(text) as T;
  } catch (err: unknown) {
    if (err instanceof FileError) throw err;
    throw new FileError('Failed to read file', { path });
  }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
  try {
    await Bun.write(path, JSON.stringify(data, null, 2));
  } catch {
    throw new FileError('Failed to write file', { path });
  }
}

export async function loadProjectConfig(cwd: string = process.cwd()): Promise<ProjectConfig> {
  const path = `${cwd}/${PROJECT_CONFIG_PATH}`;
  try {
    const json = await readJsonFile<unknown>(path);
    const parsed = ProjectConfigSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('Invalid project config', parsed.error.issues);
    }
    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof FileError) {
      // return a minimal default if file is missing
      return ProjectConfigSchema.parse({ networks: {} } as unknown);
    }
    throw err;
  }
}

export async function saveProjectConfig(config: ProjectConfig, cwd: string = process.cwd()): Promise<void> {
  const path = `${cwd}/${PROJECT_CONFIG_PATH}`;
  const validated = ProjectConfigSchema.parse(config);
  await writeJsonFile(path, validated);
}

export async function loadAuthToken(cwd: string = process.cwd()): Promise<AuthToken | null> {
  const path = `${cwd}/${AUTH_PATH}`;
  try {
    const json = await readJsonFile<unknown>(path);
    const parsed = AuthTokenSchema.safeParse(json);
    if (!parsed.success) {
      throw new ValidationError('Invalid auth token', parsed.error.issues);
    }
    return parsed.data;
  } catch (err: unknown) {
    if (err instanceof FileError) return null;
    throw err;
  }
}

export async function saveAuthToken(auth: AuthToken, cwd: string = process.cwd()): Promise<void> {
  const path = `${cwd}/${AUTH_PATH}`;
  const validated = AuthTokenSchema.parse(auth);
  await writeJsonFile(path, validated);
}

export async function loadTemplateConfig(templatePath: string): Promise<TemplateConfig> {
  const path = `${templatePath}/config.json`;
  const json = await readJsonFile<unknown>(path);
  const parsed = TemplateConfigSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError('Invalid template config', parsed.error.issues);
  }
  return parsed.data;
}

export async function saveTemplateConfig(templatePath: string, config: TemplateConfig): Promise<void> {
  const path = `${templatePath}/config.json`;
  const validated = TemplateConfigSchema.parse(config);
  await writeJsonFile(path, validated);
}


