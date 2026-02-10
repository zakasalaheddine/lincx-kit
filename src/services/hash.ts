import { FileError } from '../utils/errors.ts';

const PULL_HASHES_FILE = '.pull-hashes.json';

/**
 * Compute SHA-256 hash of a file's content.
 * Returns empty string if file does not exist.
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return '';
  }

  try {
    const content = await file.arrayBuffer();
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(content);
    return hasher.digest('hex');
  } catch {
    throw new FileError('Failed to compute file hash', { path: filePath });
  }
}

/**
 * Load saved pull hashes from .pull-hashes.json in the template directory.
 * Returns an empty record if the file does not exist.
 */
export async function loadPullHashes(templateDir: string): Promise<Record<string, string>> {
  const hashFilePath = `${templateDir}/${PULL_HASHES_FILE}`;
  const file = Bun.file(hashFilePath);

  if (!(await file.exists())) {
    return {};
  }

  try {
    const text = await file.text();
    return JSON.parse(text) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Save pull hashes to .pull-hashes.json in the template directory.
 */
export async function savePullHashes(templateDir: string, hashes: Record<string, string>): Promise<void> {
  const hashFilePath = `${templateDir}/${PULL_HASHES_FILE}`;
  try {
    await Bun.write(hashFilePath, JSON.stringify(hashes, null, 2));
  } catch {
    throw new FileError('Failed to save pull hashes', { path: hashFilePath });
  }
}
