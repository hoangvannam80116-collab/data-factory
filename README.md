# 数据工厂

一个面向电商店铺数据采集的本地演示项目，用来把「平台店铺指标配置」「Codex/Tabbit 采集请求」「历史记录沉淀」串成一条可演示链路。

## 适合演示的业务场景

- 给电商老板演示如何把淘宝、拼多多、京东后台指标做成统一采集面板。
- 给客户展示如何由 Codex/Tabbit 接手重复的数据抄录动作。
- 给后续飞书表格、经营看板、日报系统提供一层本地采集工作台。

## 当前能力

- 管理多平台店铺与授权状态。
- 配置字段级采集规则，包括页面路径、点击路径、识别说明和标记截图。
- 生成等待 Codex 执行的采集请求。
- 通过本地 API 持久化平台、规则、采集记录和请求状态。
- 导出当前平台的采集记录 CSV。

## 项目结构

```text
src/App.jsx                前端主界面
server.mjs                 本地状态 API
data-factory-state.json    演示状态与采集记录
```

## 本地启动

1. 安装依赖：`npm install`
2. 启动前端和本地写回 API：`npm run dev`
3. 构建验证：`npm run build`

前端默认访问 `http://127.0.0.1:5180` 读取和回写状态。

如果只想单独启动某一侧服务：

- 本地写回 API：`npm run api`
- 前端 UI：`npm run dev:ui`

## API 说明

- `GET /health`：健康检查
- `GET /state`：读取当前状态
- `PUT /state`：整体覆盖状态
- `POST /write-record`：写入一条采集记录，并同步更新已配置字段的最新值
- `GET /runner/next?shopId=taobao`：本地执行器领取下一条等待任务
- `POST /runner/runs/:id/start`：本地执行器标记任务开始
- `POST /runner/runs/:id/complete`：本地执行器提交 Tabbit JSON，DataFactory 校验店铺/域名/字段后写表
- `POST /runner/runs/:id/fail`：本地执行器标记任务失败

`POST /write-record` 示例：

```json
{
  "platformName": "淘宝店铺A (核心)",
  "source": "tabbit",
  "status": "success",
  "evidence": "千牛商家工作台首页，读取店铺数据卡片。",
  "data": {
    "支付金额": "1399.00",
    "访客数": "42"
  }
}
```

## 演示链路

1. 在前端确认店铺和字段规则已配置为 `ready`。
2. 点击“调用 Tabbit 采集”，生成 `waiting_for_codex` 请求。
3. 由 Codex/Tabbit 按规则去目标后台读取数据。
4. 通过 `writeRecord` 或 `POST /write-record` 写回结果。
5. 在表格视图查看最新记录，并导出 CSV。

## Runner 链路

本地 Runner 的最小闭环如下：

1. `POST /collection-runs` 创建采集任务。
2. `GET /runner/next` 领取任务，并取得 `tabbitPrompt`。
3. `POST /runner/runs/:id/start` 标记任务运行中。
4. Runner 把 `tabbitPrompt` 一次性发给 Tabbit Bridge。
5. Tabbit 必须刷新目标页面、校准店铺名、读取页面显示的「数据更新时间」，再返回 JSON。
6. `POST /runner/runs/:id/complete` 写回完整 JSON。

`complete` 接口会拒绝缺少 `dataUpdatedAt`、店铺名不匹配、当前 URL 不在允许域名内、字段名未配置的结果。

## 当前边界

- 这是本地 demo，不包含真实登录托管、权限体系和线上部署。
- 未接入真实 MCP 服务端分发，当前以本地状态文件和 API 演示协同流程。
- 拼多多、京东规则仍是草稿模板，需要按真实后台页面补齐。

## 适合下一步推进的方向

- 增加 README 中的“客户验收清单”和“演示脚本”。
- 把采集结果同步到飞书多维表格或经营日报模板。
- 为不同平台增加规则模板库和错误态回写说明。
