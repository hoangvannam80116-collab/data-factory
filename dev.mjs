import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const children = [];
let shuttingDown = false;
const projectRoot = dirname(fileURLToPath(import.meta.url));

const run = (name, command, args) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });

  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code === 0 || signal) return;
    console.error(`${name} exited with code ${code}. Stopping DataFactory dev services.`);
    shutdown(code || 1);
  });
};

const shutdown = (code = 0) => {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 150);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('DataFactory API', process.execPath, [join(projectRoot, 'server.mjs')]);
run('DataFactory UI', process.execPath, [
  join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host', '127.0.0.1',
  '--port', '5175',
  '--strictPort'
]);
