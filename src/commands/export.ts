import { intro, outro, spinner, log } from '@clack/prompts';
import { loadProjectConfig } from '../services/config.ts';
import { FileError } from '../utils/errors.ts';

interface ExportArgs {
  template?: string;
  network?: string;
  all?: boolean;
  output: string;
}

export async function exportCommand(args: ExportArgs) {
  intro('Exporting templates');

  const s = spinner();

  try {
    const projectConfig = await loadProjectConfig();
    const networks = projectConfig.networks;

    // Determine which template directories to include
    let paths: string[] = [];
    let description = '';

    if (args.template && args.network) {
      // Single template export
      const network = networks[args.network];
      if (!network) {
        throw new FileError(`Network "${args.network}" not found in project config.`);
      }
      const templateEntry = network.templates.find((t) => t.id === args.template);
      if (!templateEntry) {
        throw new FileError(`Template "${args.template}" not found in network "${args.network}".`);
      }

      const templateDir = `templates/${args.network}/${args.template}`;
      const dirExists = await Bun.file(`${templateDir}/template.html`).exists();
      if (!dirExists) {
        throw new FileError(`Template directory not found at ${templateDir}`);
      }

      paths = [`${args.network}/${args.template}`];
      description = `template "${templateEntry.name}" (${args.template})`;
    } else if (args.network) {
      // Network export
      const network = networks[args.network];
      if (!network) {
        throw new FileError(`Network "${args.network}" not found in project config.`);
      }

      const networkDir = `templates/${args.network}`;
      const dirFile = Bun.file(`${networkDir}`);
      // Check that the network directory has at least one template
      if (network.templates.length === 0) {
        throw new FileError(`Network "${args.network}" has no templates.`);
      }

      paths = [args.network];
      description = `network "${args.network}" (${network.templates.length} template(s))`;
    } else if (args.all) {
      // Full export
      const networkKeys = Object.keys(networks);
      if (networkKeys.length === 0) {
        throw new FileError('No templates found in project config.');
      }

      paths = ['.'];
      description = `all templates (${networkKeys.length} network(s))`;
    } else {
      throw new FileError('Specify --template/-t with --network/-n, --network/-n alone, or --all.');
    }

    // Ensure output ends with .tar.gz
    let outputPath = args.output;
    if (!outputPath.endsWith('.tar.gz') && !outputPath.endsWith('.tgz')) {
      outputPath = `${outputPath}.tar.gz`;
    }

    s.start(`Creating archive: ${outputPath}`);

    // Build the tar command based on paths
    if (args.all) {
      // Export everything under templates/
      await Bun.$`tar -czf ${outputPath} -C templates .`.quiet();
    } else {
      // Export specific paths under templates/
      await Bun.$`tar -czf ${outputPath} -C templates ${paths}`.quiet();
    }

    s.stop('Archive created');

    // Show summary
    const file = Bun.file(outputPath);
    const stat = await file.stat();
    const sizeKb = stat ? Math.ceil(stat.size / 1024) : 0;

    log.success(`Exported ${description}`);
    log.info(`Archive: ${outputPath} (${sizeKb} KB)`);

    outro('Export complete!');
  } catch (error) {
    s.stop('Export failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
  }
}
