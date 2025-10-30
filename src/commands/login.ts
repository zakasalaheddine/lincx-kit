import { intro, outro, text, password as promptPassword, isCancel, cancel, spinner } from '@clack/prompts';
import { login as apiLogin } from '../services/api.ts';
import { saveAuthToken } from '../services/config.ts';
import { AuthError } from '../utils/errors.ts';

export async function loginCommand(): Promise<void> {
  intro('🔐 Login');

  const email = await text({
    message: 'Email:',
    validate: (value) => {
      if (!value || typeof value !== 'string' || !value.includes('@')) return 'Invalid email';
    },
  });
  if (isCancel(email)) {
    cancel('Login cancelled');
    return;
  }

  const passwd = await promptPassword({ message: 'Password:' });
  if (isCancel(passwd)) {
    cancel('Login cancelled');
    return;
  }

  const s = spinner();
  s.start('Logging in...');
  try {
    const token = await apiLogin(String(email), String(passwd));
    await saveAuthToken({
      token,
      user: { email: String(email) },
      createdAt: new Date().toISOString(),
    });
    s.stop('✓ Login successful!');
    outro(`Logged in as: ${email}`);
  } catch (error) {
    s.stop('✗ Login failed');
    if (error instanceof AuthError) {
      outro(error.message);
    } else if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('Failed to login. Please try again.');
    }
  }
}


