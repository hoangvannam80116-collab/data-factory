import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const auditorSource = await readFile(new URL('../src/buttonContractAuditor.js', import.meta.url), 'utf8');
const buttonTags = [...appSource.matchAll(/<button\b[\s\S]*?>/g)].map((match, index) => ({
  number: index + 1,
  line: appSource.slice(0, match.index).split('\n').length,
  source: match[0]
}));
const missingHandlers = buttonTags.filter(button => !button.source.includes('onClick='));
const checks = [
  {
    name: `${buttonTags.length} 个 JSX 按钮都有点击处理器`,
    ok: buttonTags.length > 0 && missingHandlers.length === 0,
    help: missingHandlers.length > 0
      ? `缺少 onClick：${missingHandlers.map(button => `#${button.number} 第 ${button.line} 行`).join('、')}`
      : ''
  },
  {
    name: '运行时按钮审计类已接入页面',
    ok: appSource.includes('ButtonContractAuditor')
      && appSource.includes('__DATA_FACTORY_BUTTON_AUDIT__')
      && auditorSource.includes('class ButtonContractAuditor'),
    help: '请保留 ButtonContractAuditor 的导入、页面挂载和 inspect() 实现。'
  },
  {
    name: '店铺列表不显示直接删除按钮',
    ok: appSource.includes('onContextMenu=')
      && appSource.includes('移入回收站')
      && appSource.includes('shopContextMenu'),
    help: '店铺只能通过右键菜单移入回收站。'
  }
];

for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.name}`);
  if (!check.ok && check.help) console.log(`  ${check.help}`);
}

if (checks.some(check => !check.ok)) process.exitCode = 1;
else console.log('按钮静态契约检查通过；真实点击仍由 Ego Lite 发布验收覆盖。');
