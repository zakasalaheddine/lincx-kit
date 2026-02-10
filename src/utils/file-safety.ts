import { FileError } from './errors.ts';

/** One megabyte in bytes. */
const MB = 1024 * 1024;

/**
 * Validates that a file does not exceed the given size limit.
 *
 * This guard should be called **before** reading or writing potentially large
 * files to avoid accidentally loading huge payloads into memory or writing
 * oversized blobs to disk.
 *
 * @param filePath   Absolute or relative path to the file.
 * @param maxSizeMB  Maximum allowed file size in megabytes (default: 10 MB).
 * @throws {FileError} If the file does not exist (`ERR_FILE_NOT_FOUND`) or
 *                     exceeds the size limit (`ERR_FILE_TOO_LARGE`).
 *
 * @example
 * ```ts
 * await validateFileSize('templates/network/tpl/template.html');
 * const html = await Bun.file('templates/network/tpl/template.html').text();
 * ```
 */
export async function validateFileSize(
  filePath: string,
  maxSizeMB: number = 10,
): Promise<void> {
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new FileError(`File not found: ${filePath}`, {
      path: filePath,
      code: 'ERR_FILE_NOT_FOUND',
    });
  }

  const sizeBytes = file.size;
  const maxBytes = maxSizeMB * MB;

  if (sizeBytes > maxBytes) {
    const sizeMB = (sizeBytes / MB).toFixed(2);
    throw new FileError(
      `File "${filePath}" is ${sizeMB} MB, which exceeds the ${maxSizeMB} MB limit.`,
      {
        path: filePath,
        code: 'ERR_FILE_TOO_LARGE',
      },
    );
  }
}
