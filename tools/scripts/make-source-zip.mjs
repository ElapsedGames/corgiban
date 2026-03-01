import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    if (stderr) {
      console.error(stderr);
    }
    process.exit(result.status ?? 1);
  }

  return (result.stdout ?? '').trim();
}

function sanitizeName(value) {
  const normalized = value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'repo';
}

function parseArgs(argv) {
  const options = {
    ref: 'HEAD',
    out: null,
    prefix: null,
    dryRun: false,
    includeWorktree: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--ref') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --ref.');
        process.exit(1);
      }
      options.ref = value;
      index += 1;
      continue;
    }

    if (arg === '--out') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --out.');
        process.exit(1);
      }
      options.out = value;
      index += 1;
      continue;
    }

    if (arg === '--prefix') {
      const value = argv[index + 1];
      if (!value) {
        console.error('Missing value for --prefix.');
        process.exit(1);
      }
      options.prefix = value;
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--no-worktree') {
      options.includeWorktree = false;
      continue;
    }

    if (arg === '--worktree') {
      options.includeWorktree = true;
      continue;
    }

    console.error(`Unknown arg: ${arg}`);
    process.exit(1);
  }

  return options;
}

function getFileCount(ref, cwd) {
  const output = runGit(['ls-tree', '-r', '--name-only', ref], { cwd });
  if (!output) {
    return { files: [], count: 0 };
  }
  const files = output.split(/\r?\n/).filter(Boolean);
  return { files, count: files.length };
}

function createWorktreeTree(repoRoot) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corgiban-source-zip-'));
  const tempIndex = path.join(tempDir, 'index');
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };

  process.on('exit', () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  runGit(['add', '-A'], { cwd: repoRoot, env });
  const tree = runGit(['write-tree'], { cwd: repoRoot, env });

  return { tree };
}

function findForbiddenPaths(files) {
  const forbidden = [];

  files.forEach((filePath) => {
    const normalized = filePath.replace(/\\/g, '/');

    if (
      normalized.startsWith('node_modules/') ||
      normalized.includes('/node_modules/') ||
      normalized.startsWith('dist/') ||
      normalized.includes('/dist/') ||
      normalized.startsWith('build/') ||
      normalized.includes('/build/') ||
      normalized.startsWith('dist-types/') ||
      normalized.includes('/dist-types/') ||
      normalized.startsWith('coverage/') ||
      normalized.includes('/coverage/') ||
      normalized.startsWith('.git/') ||
      normalized.endsWith('.tsbuildinfo')
    ) {
      forbidden.push(filePath);
    }
  });

  return forbidden;
}

const options = parseArgs(process.argv.slice(2));
const repoRoot = runGit(['rev-parse', '--show-toplevel']);
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const repoName = sanitizeName(packageJson.name ?? path.basename(repoRoot));
const prefixName = sanitizeName(options.prefix ?? repoName);
const prefix = `${prefixName}/`;
const shortSha = runGit(['rev-parse', '--short', options.ref], { cwd: repoRoot });
const outputDir = path.join(repoRoot, 'artifacts');
const defaultOutput = path.join(outputDir, `${repoName}-source-${shortSha}.zip`);
const outputPath = path.resolve(repoRoot, options.out ?? defaultOutput);

const dirtyStatus = runGit(['status', '--porcelain'], { cwd: repoRoot });
if (dirtyStatus) {
  const warningDetail = options.includeWorktree
    ? 'Archive includes the current worktree.'
    : 'Archive is built from the git ref only.';
  console.warn(`Warning: working tree is dirty. ${warningDetail}`);
}

const treeRef = options.includeWorktree ? createWorktreeTree(repoRoot).tree : options.ref;

const { files, count } = getFileCount(treeRef, repoRoot);

if (options.dryRun) {
  console.log('Dry run: no zip file will be written.');
}

console.log(`Ref: ${options.ref}`);
console.log(`Worktree: ${options.includeWorktree ? 'included' : 'excluded'}`);
console.log(`Output: ${outputPath}`);
console.log(`Files: ${count}`);

if (!options.dryRun) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  runGit(['archive', '--format=zip', `--prefix=${prefix}`, `--output=${outputPath}`, treeRef], {
    cwd: repoRoot,
  });

  const stats = fs.statSync(outputPath);
  if (!stats.isFile() || stats.size <= 0) {
    console.error('Archive was not created or is empty.');
    process.exit(1);
  }
}

const forbidden = findForbiddenPaths(files);
if (forbidden.length > 0) {
  const sourceLabel = options.includeWorktree ? 'working tree' : 'requested ref';
  console.error(`Forbidden tracked paths detected in the ${sourceLabel}:`);
  forbidden.forEach((filePath) => {
    console.error(`- ${filePath}`);
  });
  process.exit(1);
}
