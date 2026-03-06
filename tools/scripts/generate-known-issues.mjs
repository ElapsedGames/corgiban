import { readFileSync, writeFileSync } from 'node:fs';

import { buildKnownIssuesContent, knownIssuesPath, loadIssues } from './issueTracker.mjs';

function parseArgs(argv) {
  return {
    check: argv.slice(2).includes('--check'),
  };
}

function run() {
  const args = parseArgs(process.argv);
  const issues = loadIssues((filePath) => readFileSync(filePath, 'utf8'));
  const output = buildKnownIssuesContent(issues);

  if (args.check) {
    let existingOutput = null;
    try {
      existingOutput = readFileSync(knownIssuesPath, 'utf8');
    } catch {
      // Missing output should fail the check below.
    }

    if (existingOutput !== output) {
      console.error(
        'KNOWN_ISSUES.md is out of date. Run `pnpm issue:generate` after editing .tracker/issues.',
      );
      process.exit(1);
    }

    console.log(`Verified: ${knownIssuesPath}`);
    return;
  }

  writeFileSync(knownIssuesPath, output, 'utf8');
  console.log(`Written: ${knownIssuesPath}`);
}

run();
