# Bybit 量化交易控制端

这是一个中文桌面端优先的 Bybit 量化交易控制端项目。

当前阶段的目标不是做“人工交易工作台”，而是做一个让你统一看行情、控策略、看回测、管 AI 调度、查审计和历史记录的桌面控制中枢。自动交易最终仍由量化层负责，OpenClaw 只做本地编排、复盘、调参与状态回写。

## 文档入口

- [架构总览](./docs/架构总览.md)
- [接口契约](./docs/接口契约.md)
- [开发约定](./docs/开发约定.md)
- [实施路线与接手清单](./docs/实施路线与接手清单.md)

## 当前目录

```text
.
├── AGENTS.md
├── README.md
├── apps
│   └── desktop
│       ├── src
│       └── dist-electron
├── docs
│   ├── 开发约定.md
│   ├── 实施路线与接手清单.md
│   ├── 接口契约.md
│   └── 架构总览.md
├── package.json
├── pnpm-workspace.yaml
└── services
    └── control-api
```

## 当前已实现

- `apps/desktop` 已有中文桌面控制端界面
- 已有总览、行情、策略、回测、AI 调度、新闻事件、提醒中心、交易记录、AI 复盘、系统日志/审计页面
- 已有控制总览卡组、市场脉冲卡组、行情洞察侧栏和账户链路状态卡等更完整的桌面控制台视觉结构
- 已有 `ChangeRequest`、`Backtest`、`SchedulerCommand`、`AgentJob`、`ManualOrder` 等控制链路
- 已有工作台布局、默认页面、默认模式、卡片顺序的本地持久化和服务端同步
- `services/control-api` 已有 FastAPI 本地控制服务
- 行情接口已优先接入 Bybit 公共 REST API，失败时自动回退 mock
- 已有 Bybit 私有 API 的只读账户视图接入与本地配置入口
- 已可通过真实 Bybit 私有 API 返回账户总览、空持仓、空委托等真实账户状态
- 已有真实交易链路安全探测接口，用于验证 POST 签名链路与交易权限，不会直接放开真实下单
- 已有 OpenClaw 本机配置读取与健康状态探测
- 已有 `control-api` 集成测试，覆盖健康检查、工作台同步、私有 API mock 回退、调度开关、ChangeRequest / Backtest / AgentJob / 手动交易边界

## 边界约定

- 桌面端是量化交易控制端，不是交易执行引擎
- 最终交易执行必须由量化层完成，不能绕过风控直接打到 Bybit
- OpenClaw 只接受结构化任务，不直接执行交易
- 浏览器网页登录、账户设置、API Key 创建统一使用 `https://www.bybit-global.com/`
- 程序侧行情、交易、公告接口继续使用 `api.bybit.com` 或其他 API 域名
- 网页入口和 API 入口用途不同，文档和代码里必须主动区分

## 快速启动

### 1. 安装前端依赖

```bash
pnpm install
```

### 2. 安装本地控制服务依赖

```bash
python3 -m pip install -r services/control-api/requirements.txt
```

### 3. 启动本地控制服务

```bash
python3 services/control-api/main.py
```

默认监听 `http://127.0.0.1:8787`。

### 4. 启动桌面控制端开发环境

```bash
pnpm dev:desktop
```

这条命令会同时启动本地控制服务、Vite 渲染进程和 Electron 桌面壳。

### 5. 执行验证命令

```bash
pnpm build:desktop
pnpm lint:desktop
pnpm test:control-api
pnpm verify:backend
```

## 测试与交付原则

- 后续开发默认采用“先实现、再测试、测试通过后再交付”
- 每次交付前，至少执行与改动范围对应的验证，例如前端构建、后端启动、接口联调、关键交互回归
- 如果环境限制导致某些测试无法执行，交付时必须明确说明缺失项和剩余风险

## 当前验证结果

- `pnpm --dir apps/desktop build` 已通过
- `pnpm --dir apps/desktop lint` 已通过
- `python3 -m py_compile services/control-api/*.py` 已通过
- `python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v` 已通过
- `python3 services/control-api/main.py` 已可在 Python 3.9 环境启动
- `GET /api/market/watchlist`、`GET /api/market/{symbol}` 已验证能返回 Bybit 公共行情
- `GET /api/account/overview`、`GET /api/account/positions`、`GET /api/account/orders` 已验证在未配置私有 Key 时稳定回退到 mock
- `GET /api/account/overview`、`GET /api/account/positions`、`GET /api/account/orders` 已验证可返回真实 Bybit 空账户状态，不再错误回退 mock
- `POST /api/integrations/bybit-private/probe-trade` 已验证命中真实 Bybit 交易 POST 链路，并返回参数校验拒绝结果
- `GET /api/workspace/preferences`、`POST /api/workspace/preferences` 已验证可用
- `POST /api/change-requests`、`POST /api/ai/scheduler/commands`、`POST /api/trades/manual` 已验证可用
