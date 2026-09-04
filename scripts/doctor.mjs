import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';

const minimumNode = [20, 19, 0];
const currentNode = process.versions.node.split('.').map(Number);
const egoBrowserInvocation = process.platform === 'win32'
  ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'ego-browser nodejs'] }
  : { command: 'ego-browser', args: ['nodejs'] };
const checks = [];

const atLeast = (current, minimum) => {
  for (let index = 0; index < minimum.length; index += 1) {
    const currentPart = current[index] ?? 0;
    const minimumPart = minimum[index] ?? 0;
    if (currentPart > minimumPart) return true;
    if (currentPart < minimumPart) return false;
  }
  return true;
};

checks.push({
  name: `Node.js ${process.versions.node}`,
  ok: atLeast(currentNode, minimumNode),
  help: '请安装 Node.js 20.19 或更高版本（推荐 Node.js 22 LTS）。'
});

try {
  await access(process.cwd(), constants.R_OK | constants.W_OK);
  checks.push({ name: '项目目录可读写', ok: true });
} catch {
  checks.push({ name: '项目目录可读写', ok: false, help: '请把项目放在当前用户可写的目录。' });
}

const egoProbe = spawnSync(egoBrowserInvocation.command, egoBrowserInvocation.args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  input: 'cliLog("ego-browser-ready")\n',
  timeout: 15_000,
  windowsHide: true
});
checks.push({
  name: 'Ego Lite / ego-browser 可连接',
  ok: egoProbe.status === 0 && `${egoProbe.stdout || ''}${egoProbe.stderr || ''}`.includes('ego-browser-ready'),
  help: '请先安装并启动 Ego Lite，确认 ego-browser 命令已加入 PATH。'
});

for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.name}`);
  if (!check.ok && check.help) console.log(`  ${check.help}`);
}

if (checks.some(check => !check.ok)) process.exitCode = 1;
else console.log('DataFactory 本地运行环境检查通过。');
