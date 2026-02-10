import { cancel, confirm, intro, isCancel, log, outro, spinner } from '@clack/prompts';
import { getTemplate, updateTemplate } from '../services/api.ts';
import { readStylesCss, readTemplateConfig, readTemplateHtml } from '../services/storage.ts';
import { generateDiff } from '../utils/diff.ts';

interface PushArgs {
  template: string;
  network: string;
  yes?: boolean;
}

export async function pushCommand(args: PushArgs) {
  intro('⬆️  Pushing Template to API');

  const templateDir = `templates/${args.network}/${args.template}`;
  const s = spinner();

  try {
    s.start('Reading local files...');

    const [config, localHtml, localCss] = await Promise.all([
      readTemplateConfig(`${templateDir}/config.json`),
      readTemplateHtml(`${templateDir}/template.html`),
      readStylesCss(`${templateDir}/styles.css`),
    ]);

    s.stop('✓ Files read');

    // Fetch current server version for diff comparison
    s.start('Fetching server version...');

    let serverTemplate;
    try {
      serverTemplate = await getTemplate(config.templateId);
    } catch (error) {
      s.stop('⚠ Could not fetch server version');
      log.warn('Unable to fetch server version for comparison. Proceeding without diff.');
      serverTemplate = null;
    }

    if (serverTemplate) {
      s.stop('✓ Server version fetched');

      // Warn if server version changed since last pull
      if (
        serverTemplate.version !== undefined &&
        (config as any).version !== undefined &&
        serverTemplate.version !== (config as any).version
      ) {
        log.warn(
          `Server version (${serverTemplate.version}) differs from local version (${(config as any).version}). ` +
          'The template may have been modified on the server since your last pull.'
        );
      }

      // Generate diffs
      const serverHtml = serverTemplate.html ?? '';
      const serverCss = serverTemplate.css ?? '';

      const htmlDiff = generateDiff(serverHtml, localHtml, 'template.html');
      const cssDiff = generateDiff(serverCss, localCss, 'styles.css');

      if (!htmlDiff.hasChanges && !cssDiff.hasChanges) {
        log.info('No changes detected between local and server versions.');
        outro('Nothing to push.');
        return;
      }

      // Display diffs
      if (htmlDiff.hasChanges) {
        log.message(htmlDiff.formatted);
      }
      if (cssDiff.hasChanges) {
        log.message(cssDiff.formatted);
      }

      // Summary
      const totalAdditions = htmlDiff.additions + cssDiff.additions;
      const totalDeletions = htmlDiff.deletions + cssDiff.deletions;
      log.info(
        `Total changes: +${totalAdditions} addition(s), -${totalDeletions} deletion(s)`
      );
    }

    // Skip confirmation if --yes flag is set
    if (!args.yes) {
      const shouldPush = await confirm({
        message: `Push template "${config.name}" to API?`,
        initialValue: true,
      });

      if (isCancel(shouldPush) || !shouldPush) {
        cancel('Push cancelled');
        return;
      }
    }

    s.start('Uploading template...');

    const updatedTemplate = await updateTemplate(config.templateId, {
      html: localHtml,
      css: localCss,
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
