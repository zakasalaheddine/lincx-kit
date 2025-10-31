import { cancel, confirm, intro, isCancel, outro, spinner } from '@clack/prompts';
import { updateTemplate } from '../services/api.ts';
import { readStylesCss, readTemplateConfig, readTemplateHtml } from '../services/storage.ts';

interface PushArgs {
  template: string;
  network: string;
}

export async function pushCommand(args: PushArgs) {
  intro('⬆️  Pushing Template to API');

  const templateDir = `templates/${args.network}/${args.template}`;
  const s = spinner();

  try {
    s.start('Reading local files...');

    const [config, html, css] = await Promise.all([
      readTemplateConfig(`${templateDir}/config.json`),
      readTemplateHtml(`${templateDir}/template.html`),
      readStylesCss(`${templateDir}/styles.css`),
    ]);

    s.stop('✓ Files read');

    const shouldPush = await confirm({
      message: `Push template "${config.name}" to API?`,
      initialValue: true,
    });

    if (isCancel(shouldPush) || !shouldPush) {
      cancel('Push cancelled');
      return;
    }

    s.start('Uploading template...');

    const updatedTemplate = await updateTemplate(config.templateId, {
      html,
      css,
    });

    s.stop('✓ Template pushed successfully!');

    const updatedAt = updatedTemplate.dateUpdated ?? new Date().toISOString();
    outro(`Updated at: ${updatedAt}`);
  } catch (error) {
    s.stop('✗ Push failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}

