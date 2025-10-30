import type { TemplateConfig } from '../types/config.ts';
import { FileError } from '../utils/errors.ts';

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


