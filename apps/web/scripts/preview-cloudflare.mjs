import { spawn } from 'node:child_process';

const port = process.env.PORT?.trim() || '8788';
const extraArgs = process.argv.slice(2);

const command =
  process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', 'pnpm', 'exec', 'wrangler']]
    : ['pnpm', ['exec', 'wrangler']];

const [bin, prefixArgs] = command;

const child = spawn(
  bin,
  [
    ...prefixArgs,
    'pages',
    'dev',
    './build/client',
    '--compatibility-date=2026-03-09',
    '--ip=127.0.0.1',
    `--port=${port}`,
    ...extraArgs,
  ],
  {
    stdio: 'inherit',
    shell: false,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
