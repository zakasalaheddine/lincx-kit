import { TemplateConfigSchema, type TemplateConfig } from '../types/config.ts';
import { FileError, ValidationError } from '../utils/errors.ts';

export async function ensureDirectory(path: string): Promise<void> {
  try {
    await Bun.$`mkdir -p ${path}`;
  } catch {
    throw new FileError('Failed to create directory', { path });
  }
}

function getParentDirectory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx > 0 ? normalized.slice(0, idx) : '.';
}

async function writeFileEnsuringDir(filePath: string, contents: string) {
  try {
    const dir = getParentDirectory(filePath);
    await ensureDirectory(dir);
    await Bun.write(filePath, contents);
  } catch {
    throw new FileError('Failed to write file', { path: filePath });
  }
}

async function readTextFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new FileError('File not found', { path: filePath });
  }

  try {
    return await file.text();
  } catch {
    throw new FileError('Failed to read file', { path: filePath });
  }
}

export async function writeTemplateHtml(filePath: string, html: string): Promise<void> {
  await writeFileEnsuringDir(filePath, html);
}

export async function writeStylesCss(filePath: string, css: string): Promise<void> {
  await writeFileEnsuringDir(filePath, css);
}

export async function writeTemplateConfig(filePath: string, config: TemplateConfig): Promise<void> {
  const json = JSON.stringify(config, null, 2);
  await writeFileEnsuringDir(filePath, json);
}

export async function readTemplateHtml(filePath: string): Promise<string> {
  return await readTextFile(filePath);
}

export async function readStylesCss(filePath: string): Promise<string> {
  return await readTextFile(filePath);
}

export async function readTemplateConfig(filePath: string): Promise<TemplateConfig> {
  const text = await readTextFile(filePath);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FileError('Failed to read file', { path: filePath });
  }

  const parsed = TemplateConfigSchema.safeParse(data);
  if (!parsed.success) {
    throw new ValidationError('Invalid template config', parsed.error.issues);
  }

  return parsed.data;
}


