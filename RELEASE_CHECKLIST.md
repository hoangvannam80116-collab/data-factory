# DataFactory 发布核对单

## 自动检查

发布前在项目根目录执行：

```bash
npm ci
npm run release:check
npm audit --audit-level=high
```

`release:check` 包含运行环境诊断、JSX 按钮点击处理器检查、数据模型测试和生产构建。只有全部返回成功才可以发布。

## 页面按钮回归

使用 Ego Lite 在 `http://127.0.0.1:5175` 依次核对：

- 顶栏：返回仪表盘、全局搜索回车、运营提醒、本机工作区信息。
- 店铺栏：切换每家店铺、添加店铺、校正当前店铺、API、回收站、偏好设置。
- 添加店铺：平台、显示名称、真实店铺名、入口地址、允许域名、同步时间、取消、添加。
- 明细表：明细/仪表盘切换、Ego 校正、筛选/清除、排序、勾选、删除确认/取消、导出、立即采集、增加一行、添加一列。
- 字段编辑：预设字段、截图上传/粘贴/移除、单列测试、保存、删除确认/取消、关闭。
- 仪表盘：Ego 校正、立即采集、异常提示、指标卡、查看明细。
- API：基础地址和每个接口的复制按钮，点击后必须出现成功勾。
- 回收站：只允许恢复；页面和店铺列表都不能出现永久删除入口。
- 偏好设置：自动同步开关、同步时间启用/禁用和自动保存。
- 弹窗：关闭、取消、校验失败提示；不能确认删除现有生产数据。

页面内置 `ButtonContractAuditor`，可在浏览器控制台执行：

```js
window.__DATA_FACTORY_BUTTON_AUDIT__.inspect()
```

结果中的 `problems` 必须为空。`disabled` 按钮需要与当前前置条件一致，例如店铺未校正时“立即采集”必须禁用。

## 首次安装

- 删除或移开本机 `data-factory-state.json` 后启动，页面应显示空工作区，不应出现演示店铺或虚假成功记录。
- 添加第一家店铺后应成为当前店铺；登录失效时店铺与历史数据仍保留。
- 店铺通过右键菜单移入回收站，恢复后必须重新校正。

## 跨平台

- macOS：Node.js 22 LTS、`npm ci`、`npm run release:check`、`npm run dev`。
- Windows PowerShell：Node.js 22 LTS、`npm ci`、`npm run release:check`、`npm run dev`。
- 两个平台都确认 `http://127.0.0.1:5175` 和 `http://127.0.0.1:5181/health` 可访问。
- Ego Lite 命令从 PATH 可执行；Windows 由 `cmd.exe` 调用，macOS 直接调用 `ego-browser`。

## GitHub 发布

- `data-factory-state.json`、`.env`、账号、Cookie、截图和本机绝对路径没有进入 Git。
- `npm audit --audit-level=high` 返回 0 项漏洞。
- 根据发布意图添加许可证；没有许可证时，他人虽然能下载，但复用和修改权限并不明确。
- 打标签前最后运行一次本核对单，并记录 Windows/macOS 的实机结果。
