import { intro, outro } from '@clack/prompts';
import { unlink } from 'node:fs/promises';

export async function logoutCommand(): Promise<void> {
  intro('🔓 Logout');

  const authPath = `${process.cwd()}/.auth.json`;
  const file = Bun.file(authPath);

  if (await file.exists()) {
    await unlink(authPath);
    outro('✓ Logged out successfully. Auth token removed.');
  } else {
    outro('Already logged out. No auth token found.');
  }
}
