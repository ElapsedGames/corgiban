import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { issuesDir, templatePath, todayIsoDate } from './issueTracker.mjs';

const VALID_TYPES = ['bug', 'debt', 'enhancement'];
const VALID_SEVERITIES = ['high', 'medium', 'low'];
const VALID_AREAS = ['ui', 'data', 'worker', 'build', 'solver', 'formats', 'embed', 'lab', 'bench'];

const TYPE_PREFIX = { bug: 'BUG', debt: 'DEBT', enhancement: 'ENH' };

function replaceTemplateToken(template, token, value) {
  const pattern = new RegExp(`\\{\\s*\\{\\s*${token}\\s*\\}\\s*\\}`, 'g');
  return template.replace(pattern, value);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    type: 'bug',
    severity: 'medium',
    area: 'ui',
    regression: false,
    title: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type') result.type = args[++i];
    else if (arg === '--severity') result.severity = args[++i];
    else if (arg === '--area') result.area = args[++i];
    else if (arg === '--title') result.title = args[++i];
    else if (arg === '--regression') result.regression = true;
  }

  return result;
}

function validate(args) {
  const errors = [];
  if (!args.title) errors.push('--title is required');
  if (!VALID_TYPES.includes(args.type))
    errors.push(`--type must be one of: ${VALID_TYPES.join(', ')}`);
  if (!VALID_SEVERITIES.includes(args.severity))
    errors.push(`--severity must be one of: ${VALID_SEVERITIES.join(', ')}`);
  if (!VALID_AREAS.includes(args.area))
    errors.push(`--area must be one of: ${VALID_AREAS.join(', ')}`);
  return errors;
}

function nextId(prefix) {
  let files = [];
  try {
    files = readdirSync(issuesDir);
  } catch {
    // directory does not exist yet
  }

  const pattern = new RegExp(`^${prefix}-(\\d+)\\.md$`);
  let max = 0;
  for (const file of files) {
    const match = file.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  const next = max + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function run() {
  const args = parseArgs(process.argv);
  const errors = validate(args);

  if (errors.length > 0) {
    for (const err of errors) console.error(`Error: ${err}`);
    console.error(
      '\nUsage: node tools/scripts/new-issue.mjs --title "..." [--type bug|debt|enhancement] [--severity high|medium|low] [--area ui|...] [--regression]',
    );
    process.exit(1);
  }

  const prefix = TYPE_PREFIX[args.type];
  const id = nextId(prefix);

  const template = readFileSync(templatePath, 'utf8');
  const content = [
    ['ID', id],
    ['TITLE', args.title],
    ['TYPE', args.type],
    ['SEVERITY', args.severity],
    ['AREA', args.area],
    ['REGRESSION', String(args.regression)],
    ['DATE', todayIsoDate()],
  ].reduce((current, [token, value]) => replaceTemplateToken(current, token, value), template);

  mkdirSync(issuesDir, { recursive: true });
  const outPath = path.join(issuesDir, `${id}.md`);
  writeFileSync(outPath, content, 'utf8');

  console.log(`Created: ${outPath}`);
}

run();
