import { intro, outro, spinner, log } from '@clack/prompts';
import { TemplateConfigSchema, type TemplateConfig } from '../types/config.ts';
import { loadProjectConfig } from '../services/config.ts';
import { generateMockData } from '../services/mock-generator.ts';

interface ValidateArgs {
  template?: string;
  network?: string;
  all?: boolean;
}

interface ValidationResult {
  templateId: string;
  network: string;
  errors: string[];
  warnings: string[];
  passes: string[];
}

// ---------------------------------------------------------------------------
// HTML syntax check
// ---------------------------------------------------------------------------
function checkHtmlSyntax(html: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for unclosed tags (self-closing and void elements excluded)
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ]);

  // Strip comments, script contents, and style contents to avoid false positives
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Collect open/close tags (skip self-closing like <br />, void elements, and mustache tags)
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?\/?>/g;
  const stack: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(stripped)) !== null) {
    const fullTag = match[0];
    const tagName = match[1]!.toLowerCase();

    if (voidElements.has(tagName)) continue;
    if (fullTag.endsWith('/>')) continue;

    if (fullTag.startsWith('</')) {
      // Closing tag
      if (stack.length === 0) {
        issues.push(`Unexpected closing tag </${tagName}>`);
      } else if (stack[stack.length - 1] !== tagName) {
        issues.push(`Mismatched tag: expected </${stack[stack.length - 1]}> but found </${tagName}>`);
        // Pop anyway to keep going
        stack.pop();
      } else {
        stack.pop();
      }
    } else {
      // Opening tag
      stack.push(tagName);
    }
  }

  for (const unclosed of stack) {
    issues.push(`Unclosed tag <${unclosed}>`);
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// CSS syntax check
// ---------------------------------------------------------------------------
function checkCssSyntax(css: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Strip comments
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Check brace balance
  let depth = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++;
    if (stripped[i] === '}') depth--;
    if (depth < 0) {
      issues.push('Unexpected closing brace at position ' + i);
      depth = 0;
    }
  }

  if (depth > 0) {
    issues.push(`${depth} unclosed brace(s) in CSS`);
  }

  // Check for unclosed strings
  const stringRegex = /(['"])(?:(?!\1|\\).|\\.)*$/gm;
  if (stringRegex.test(stripped)) {
    issues.push('Possible unclosed string in CSS');
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Extract Mustache variables from template
// ---------------------------------------------------------------------------
function extractMustacheVariables(html: string): Set<string> {
  const variables = new Set<string>();

  // Match {{variable}}, {{{variable}}}, {{#variable}}, {{^variable}}
  // Skip partials ({{> }}) and comments ({{! }})
  const mustacheRegex = /\{\{\{?\s*([#^/]?)\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}?\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = mustacheRegex.exec(html)) !== null) {
    const name = match[2]!;
    // Skip built-in section helpers like "ads" and common loop-injected variables
    if (name !== 'ads') {
      variables.add(name);
    }
  }

  return variables;
}

// ---------------------------------------------------------------------------
// Validate a single template
// ---------------------------------------------------------------------------
async function validateTemplate(
  templateDir: string,
  templateId: string,
  network: string,
): Promise<ValidationResult> {
  const result: ValidationResult = {
    templateId,
    network,
    errors: [],
    warnings: [],
    passes: [],
  };

  // ---- 1. Load and validate config.json ----
  let config: TemplateConfig | null = null;
  try {
    const configFile = Bun.file(`${templateDir}/config.json`);
    if (!(await configFile.exists())) {
      result.errors.push('config.json not found');
      return result;
    }

    const raw = await configFile.json();
    const parsed = TemplateConfigSchema.safeParse(raw);
    if (!parsed.success) {
      const issueMessages = parsed.error.issues.map(
        (i) => `  ${i.path.join('.')}: ${i.message}`,
      );
      result.errors.push(`config.json schema validation failed:\n${issueMessages.join('\n')}`);
      return result;
    }

    config = parsed.data;
    result.passes.push('config.json schema valid');
  } catch (err) {
    result.errors.push(`Failed to read config.json: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  // ---- 2. Load and check HTML ----
  let htmlContent = '';
  try {
    const htmlFile = Bun.file(`${templateDir}/template.html`);
    if (!(await htmlFile.exists())) {
      result.errors.push('template.html not found');
    } else {
      htmlContent = await htmlFile.text();
      const htmlCheck = checkHtmlSyntax(htmlContent);
      if (htmlCheck.valid) {
        result.passes.push('HTML syntax valid');
      } else {
        for (const issue of htmlCheck.issues) {
          result.warnings.push(`HTML: ${issue}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read template.html: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- 3. Load and check CSS ----
  try {
    const cssFile = Bun.file(`${templateDir}/styles.css`);
    if (!(await cssFile.exists())) {
      result.warnings.push('styles.css not found (optional)');
    } else {
      const cssContent = await cssFile.text();
      const cssCheck = checkCssSyntax(cssContent);
      if (cssCheck.valid) {
        result.passes.push('CSS syntax valid');
      } else {
        for (const issue of cssCheck.issues) {
          result.warnings.push(`CSS: ${issue}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Failed to read styles.css: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ---- 4. Mustache variable checking against schema fields ----
  if (config.creativeAssetGroup && htmlContent) {
    const schemaProperties = config.creativeAssetGroup.fields.properties;
    const requiredFields = config.creativeAssetGroup.fields.required ?? [];
    const schemaFieldNames = new Set(Object.keys(schemaProperties));
    const templateVars = extractMustacheVariables(htmlContent);

    // Check required fields are present in template
    const presentRequired: string[] = [];
    const missingRequired: string[] = [];
    for (const field of requiredFields) {
      if (templateVars.has(field)) {
        presentRequired.push(field);
      } else {
        missingRequired.push(field);
      }
    }

    if (missingRequired.length > 0) {
      result.errors.push(
        `Missing required field(s) in template: ${missingRequired.join(', ')}`,
      );
    }

    if (presentRequired.length > 0) {
      result.passes.push(
        `Required fields present: ${presentRequired.join(', ')}`,
      );
    }

    // Check for unused schema fields (in schema but not in template)
    for (const field of schemaFieldNames) {
      if (!templateVars.has(field)) {
        result.warnings.push(
          `Unused field '${field}' defined in schema but not in template`,
        );
      }
    }

    // Check for template variables not in schema (informational)
    // Skip common injected variables (adId, href, url, clickId, creativeId, templateId, id, name)
    const injectedVars = new Set([
      'adId', 'href', 'url', 'clickId', 'creativeId', 'templateId', 'id', 'name',
    ]);
    for (const v of templateVars) {
      if (!schemaFieldNames.has(v) && !injectedVars.has(v)) {
        result.warnings.push(
          `Template variable '${v}' not found in schema fields`,
        );
      }
    }
  } else if (!config.creativeAssetGroup) {
    result.warnings.push('No creativeAssetGroup in config, skipping field validation');
  }

  // ---- 5. Mock data generation check ----
  if (config.creativeAssetGroup) {
    try {
      const mockData = generateMockData(
        config.creativeAssetGroup as any,
        config.mockData ?? {},
        config.templateId,
      );
      if (mockData && Array.isArray(mockData.ads) && mockData.ads.length > 0) {
        result.passes.push('Mock data generates successfully');
      } else {
        result.warnings.push('Mock data generated but produced no ads');
      }
    } catch (err) {
      result.errors.push(
        `Mock data generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Format and print results
// ---------------------------------------------------------------------------
function printResult(result: ValidationResult): void {
  log.info(`Validating ${result.templateId} (network: ${result.network})...`);

  for (const pass of result.passes) {
    log.success(`  \u2713 ${pass}`);
  }
  for (const warning of result.warnings) {
    log.warn(`  \u26A0 Warning: ${warning}`);
  }
  for (const error of result.errors) {
    log.error(`  \u2717 Error: ${error}`);
  }

  const parts: string[] = [];
  if (result.errors.length > 0) {
    parts.push(`${result.errors.length} error(s)`);
  }
  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning(s)`);
  }

  if (result.errors.length > 0) {
    log.error(`  Validation failed with ${parts.join(', ')}`);
  } else if (result.warnings.length > 0) {
    log.warn(`  Validation passed with ${parts.join(', ')}`);
  } else {
    log.success('  Validation passed');
  }
}

// ---------------------------------------------------------------------------
// Collect all template entries from project config
// ---------------------------------------------------------------------------
async function collectAllTemplates(): Promise<{ template: string; network: string }[]> {
  const projectConfig = await loadProjectConfig();
  const entries: { template: string; network: string }[] = [];

  for (const [networkKey, networkConfig] of Object.entries(projectConfig.networks)) {
    for (const tpl of networkConfig.templates) {
      entries.push({ template: tpl.id, network: networkKey });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------
export async function validateCommand(args: ValidateArgs) {
  intro('Validating Templates');

  const s = spinner();

  try {
    let targets: { template: string; network: string }[];

    if (args.all) {
      s.start('Discovering templates...');
      targets = await collectAllTemplates();
      s.stop(`Found ${targets.length} template(s)`);

      if (targets.length === 0) {
        outro('No templates found in project config. Run pull first.');
        return;
      }
    } else {
      if (!args.template || !args.network) {
        outro('Please provide --template and --network, or use --all to validate all templates.');
        process.exit(1);
      }
      targets = [{ template: args.template, network: args.network }];
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    for (const target of targets) {
      const templateDir = `templates/${target.network}/${target.template}`;

      s.start(`Validating ${target.template}...`);
      const result = await validateTemplate(templateDir, target.template, target.network);
      s.stop(`Validated ${target.template}`);

      printResult(result);

      totalErrors += result.errors.length;
      totalWarnings += result.warnings.length;
    }

    // Summary
    if (targets.length > 1) {
      log.info('');
      log.info(`Summary: ${targets.length} template(s) validated`);
    }

    if (totalErrors > 0) {
      outro(`Validation complete: ${totalErrors} error(s), ${totalWarnings} warning(s)`);
      process.exit(1);
    } else if (totalWarnings > 0) {
      outro(`Validation complete with ${totalWarnings} warning(s)`);
    } else {
      outro('All validations passed');
    }
  } catch (error) {
    s.stop('Validation failed');
    if (error instanceof Error) {
      outro(error.message);
    } else {
      outro('An unknown error occurred.');
    }
    process.exit(1);
  }
}
