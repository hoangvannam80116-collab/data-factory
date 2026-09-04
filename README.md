# DataFactory 数据工厂

本地淘宝 / 千牛 KPI 采集工作台。当前版本聚焦一条稳定链路：用 Ego Lite 登录千牛商家后台，按字段规则读取店铺指标，写回本机状态。

当前范围是淘宝 / 千牛，不是内容库、客资池，也不向飞书表格、经营看板或日报喂数。店铺登录必须在 Ego Lite 窗口完成，不连接网站账号。拼多多、京东可以添加，但当前版本不采集、不校准后台规则。

## 当前范围

- 淘宝 / 千牛 KPI：绑定固定 Ego lite Task Space，校验平台、域名、登录状态和店铺名后采集。
- 本地调度按店铺设置的每日同步时间创建任务；未验证店铺不会进入采集。
- 拼多多、京东：后续再做，当前版本关闭自动同步。

## 当前能力

- 独立添加并持久化店铺；Ego lite 离线或登录失效不会删除店铺和历史数据。
- 店铺右键可移入「系统开放 → 回收站」；回收站只能恢复，不提供彻底删除，恢复后需重新校正。
- 给指定淘宝店铺绑定固定 Ego lite Task Space，并校验平台、域名、登录状态和店铺名。
- 配置字段级采集规则，包括页面路径、点击路径、识别说明和标记截图。
- 按店铺设置每日同步时间，由本地执行器自动创建并完成采集任务。
- 每次采集先刷新店铺页面，再校验平台、域名、登录状态和店铺名，校验通过后才允许写入。
- 在仪表盘展示最近同步结果；登录失效、店铺不符、页面异常或超时都会显示可读的失败原因。
- 通过本地 API 持久化平台、规则、采集记录和请求状态。
- 导出当前平台的采集记录 CSV。

允许域名（淘宝店铺）：myseller.taobao.com / sycm.taobao.com / qn.taobao.com。登录页 loginmyseller.taobao.com 不在允许范围内。

## 项目结构

```text
src/App.jsx                前端主界面
src/dataFactoryModel.js    店铺、规则、采集状态与校验
server.mjs                 本地状态 API 与调度
data-factory-state.json    本机状态库（含 Ego 会话，不提交）
tests/                     模型单测（不启动 Ego）
```

## 运行环境

- Windows 10/11 或 macOS 12 及以上
- Node.js 20.19+（推荐 Node.js 22 LTS，项目附带 `.nvmrc`）
- npm 10+
- Ego Lite 已安装并启动，`ego-browser` 命令可用
- Git（从 GitHub 克隆时需要）

这是本地软件，不依赖云端部署。DataFactory、状态库、调度器和 Ego Lite 都运行在同一台电脑；店铺密码和 Cookie 不写入本项目。

## 从 GitHub 安装

Windows PowerShell 和 macOS 终端使用相同命令：

```bash
git clone <你的 GitHub 仓库地址>
cd <仓库目录>
npm ci
npm run release:check
npm run dev
```

浏览器打开 `http://127.0.0.1:5175`。首次使用先启动 Ego Lite，在 Ego Lite 中登录淘宝 / 千牛，再回 DataFactory 添加并校正店铺。

`npm run release:check` 会依次检查 Node.js、项目目录权限、Ego Lite 连接、单元测试和生产构建。任何一步失败都会返回非零退出码，便于用户或 Codex 定位问题。

## 让 Codex 在用户电脑安装

用户可以把下面这段话交给其本机 Codex，并把仓库地址替换为实际地址：

> 请把 `<你的 GitHub 仓库地址>` 克隆到当前用户可写目录，阅读 README，运行 `npm ci` 和 `npm run release:check`。确认 Ego Lite 已安装并启动后，运行 `npm run dev`，检查 DataFactory UI 的 5175 端口和本地 API 的 5181 端口。不要上传、覆盖或删除 `data-factory-state.json`，不要部署到云端。

Codex 可以完成代码下载、依赖安装、环境诊断和本地启动；淘宝账号登录仍由用户本人在 Ego Lite 中完成。

## 本地开发启动

1. 安装依赖：首次克隆使用 `npm ci`；修改依赖时使用 `npm install`
2. 启动前端和本地写回 API：`npm run dev`
3. 完整发布自检：`npm run release:check`

DataFactory 固定使用下面这组本地地址，避免和其他项目串端口：

- 前端 UI：`http://127.0.0.1:5175`
- 本地写回 API：`http://127.0.0.1:5181`
- 构建预览：`http://127.0.0.1:4175`

前端会访问 `http://127.0.0.1:5181` 读取和回写状态。`dev:ui` 和 `preview` 都开启了 `--strictPort`，如果端口被占用会直接报错，不会自动换到其他项目的端口。

如果只想单独启动某一侧服务：

- 本地写回 API：`npm run api`
- 前端 UI：`npm run dev:ui`

## API 说明

- `GET /health`：健康检查
- `GET /state`：读取当前状态
- `PUT /state`：整体覆盖状态
- `POST /shops`：添加店铺
- `DELETE /shops/:id`：将店铺移入回收站
- `GET /trash`：读取回收站
- `POST /trash/:id/restore`：恢复店铺
- `POST /write-record`：写入一条采集记录，并同步更新已配置字段的最新值
- `GET /runner/next?shopId=taobao`：本地执行器领取下一条等待任务
- `GET /collection-runs/:id`：查询一次采集任务的状态和写回结果
- `GET /runner/ego-shops`：扫描 Ego lite Task Space，并返回可识别的店铺页面与窗口绑定
- `POST /runner/ego-bind`：为指定 DataFactory 店铺创建或复用固定 Ego Task Space，并执行完整身份校验
- `POST /runner/runs/:id/start`：本地执行器标记任务开始
- `POST /runner/runs/:id/complete`：本地执行器提交 Ego lite 采集 JSON，DataFactory 校验店铺/域名/字段后写表
- `POST /runner/runs/:id/fail`：本地执行器标记任务失败

`POST /write-record` 示例：

```json
{
  "platformName": "淘宝店铺A (核心)",
  "source": "ego-lite",
  "status": "success",
  "evidence": "千牛商家工作台首页，读取店铺数据卡片。",
  "data": {
    "支付金额": "1399.00",
    "访客数": "42"
  }
}
```

## 采集链路

1. 在 DataFactory 添加店铺，保存平台、实际店铺名、入口地址、允许域名和同步时间。
2. 进入该店铺点击“绑定/校验 Ego”，创建或复用这个店铺固定的 Ego Task Space（Ego lite 登录，不是 nansuai.com SSO）。
3. 如登录失效，在 Ego 专属窗口完成登录，再回到 DataFactory 重新校验。
4. 确认店铺身份和字段规则已配置为 `ready`。
5. 到达店铺设置的每日同步时间后，调度器自动创建采集任务；也可以点击“立即采集”手动触发。
6. 本地执行器进入绑定的 Ego Task Space，刷新页面、重新校验店铺并一次读取全部字段。
7. 校验通过后自动写回 DataFactory，在仪表盘查看同步状态，在明细表查看和导出记录。

## Runner 链路

本地 Runner 的最小闭环如下：

1. `POST /collection-runs` 创建采集任务。
2. `GET /runner/next` 领取任务，并取得 `egoPrompt` 和 `egoBinding`。
3. `POST /runner/runs/:id/start` 标记任务运行中。
4. Runner 根据 `egoBinding.taskSpaceId` 和 `egoBinding.targetId` 进入指定 Ego lite 窗口与标签页。
5. Ego lite 执行器必须刷新目标页面、校准店铺名、读取页面显示的「数据更新时间」，再返回 JSON。
6. `POST /runner/runs/:id/complete` 写回完整 JSON。

`complete` 接口会拒绝缺少 `dataUpdatedAt`、店铺名不匹配、当前 URL 不在允许域名内、字段名未配置的结果。

## 运营使用

日常无需让 Codex 参与。保持本机 DataFactory 服务和 Ego lite 运行，系统会按淘宝店铺设置的时间自动同步。运营只需要关注仪表盘：

- “最近一次同步成功”表示数据已写入明细表。
- “同步失败”会直接显示原因；点击“校正店铺”重新验证登录和店铺身份。
- 新平台或新页面需要补字段规则、页面改版导致识别失败时，再由开发人员或 Codex 协助调整。

## 当前边界

- 当前是单机版：本地 API、调度器和 Ego Lite 必须在同一台电脑运行。
- 店铺账号仍由用户在 Ego Lite 中登录；不连接网站单点登录，DataFactory 不保存账号、密码或 Cookie。
- 当前版本只跑通淘宝 / 千牛首页店铺数据。拼多多、京东规则仍是草稿，暂不采集。
- `data-factory-state.json` 是本机状态库，含 Ego 会话，不要提交到 git。

## 发布到 GitHub 前

1. 运行 `npm ci` 和 `npm run release:check`，确认依赖安装、测试和构建全部通过。
2. 确认 `git status` 中没有 `data-factory-state.json`、`.env`、Cookie、账号或本机绝对路径。
3. 在 Windows 与 macOS 各做一次 `npm run dev` 冒烟测试；至少检查添加店铺、校正店铺、立即采集、导出、右键移入回收站和恢复。
4. 根据你希望他人如何使用和修改代码，发布前选择并添加合适的开源许可证；项目目前不会替你默认授权。

## 常见问题

- `Ego Lite / ego-browser 可连接`失败：先启动 Ego Lite，并确认 `ego-browser` 已加入系统 PATH。
- 5175 或 5181 端口被占用：先关闭占用端口的旧 DataFactory 进程，再重新运行 `npm run dev`。项目使用严格端口，不会悄悄切换到其他端口。
- 淘宝页面回到登录页：这是登录态失效，不一定是风控。先在 Ego Lite 完成登录，再点“校正当前店铺”；只有页面明确显示验证、限制或处罚时才按风控处理。
- 样式异常：不要直接双击 `index.html`，应通过 `npm run dev` 启动。Tailwind 样式已经随项目本地构建，不依赖外网 CDN。
