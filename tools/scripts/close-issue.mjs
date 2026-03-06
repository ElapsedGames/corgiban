import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { closeIssueContent, issueFilePath, repoRoot, todayIsoDate } from './issueTracker.mjs';

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    id: null,
    fixedAt: todayIsoDate(),
    fixedBy: null,
    branch: undefined,
    pr: undefined,
    commit: undefined,
    resolution: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--id') result.id = args[++index];
    else if (arg === '--fixed-at') result.fixedAt = args[++index];
    else if (arg === '--fixed-by') result.fixedBy = args[++index];
    else if (arg === '--branch') result.branch = args[++index];
    else if (arg === '--pr') result.pr = args[++index];
    else if (arg === '--commit') result.commit = args[++index];
    else if (arg === '--resolution') result.resolution = args[++index];
  }

  return result;
}

function validate(args) {
  const errors = [];
  if (!args.id) errors.push('--id is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.fixedAt)) {
    errors.push('--fixed-at must use YYYY-MM-DD');
  }
  return errors;
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    return null;
  }

  const value = result.stdout.trim();
  return value === '' ? null : value;
}

function detectFixedBy() {
  return runGit(['config', 'user.name']);
}

function detectBranch() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  return branch === 'HEAD' ? null : branch;
}

function run() {
  const args = parseArgs(process.argv);
  const errors = validate(args);
  const fixedBy = args.fixedBy ?? detectFixedBy();
  const detectedBranch = detectBranch();
  const branch = args.branch !== undefined ? args.branch : (detectedBranch ?? undefined);

  if (!fixedBy) {
    errors.push('--fixed-by is required when git user.name is unavailable');
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Error: ${error}`);
    }
    console.error(
      '\nUsage: node tools/scripts/close-issue.mjs --id BUG-001 [--fixed-by "Your Name"] [--fixed-at YYYY-MM-DD] [--branch feature/foo] [--pr 123] [--commit abc1234] [--resolution "What changed"]',
    );
    process.exit(1);
  }

  const filePath = issueFilePath(args.id);
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    console.error(`Error: issue file not found for ${args.id}`);
    process.exit(1);
  }

  const updatedContent = closeIssueContent(content, {
    fixedAt: args.fixedAt,
    fixedBy,
    branch,
    pr: args.pr,
    commit: args.commit,
    resolution: args.resolution,
  });

  writeFileSync(filePath, updatedContent, 'utf8');
  console.log(`Closed: ${filePath}`);
}

run();
