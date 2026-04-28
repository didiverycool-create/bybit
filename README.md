# Bybit 量化交易控制端

这是一个中文桌面端优先的 Bybit 量化交易控制端项目。

当前阶段的目标不是做“人工交易工作台”，而是做一个让你统一看行情、控策略、看回测、管 AI 调度、查审计和历史记录的桌面控制中枢。自动交易最终仍由量化层负责，OpenClaw 只做本地编排、复盘、调参与状态回写。

当前项目不再为 Web 端排期，后续优先把桌面端背后的真实量化内核、真实执行风控和编排闭环做实。

## 文档入口

- [架构总览](./docs/架构总览.md)
- [接口契约](./docs/接口契约.md)
- [开发约定](./docs/开发约定.md)
- [实施路线与接手清单](./docs/实施路线与接手清单.md)

## 关键回归命令

README 这里只保留常用入口，详细验证口径、产物和当前状态统一维护在 [docs/实施路线与接手清单](./docs/实施路线与接手清单.md#4-已验证命令)。

- 行情主图：`pnpm verify:market-switch`、`pnpm smoke:market-switch`
- 策略活动：`pnpm verify:strategy-activity`、`pnpm smoke:strategy-activity`
- 详细报告：`pnpm report:market-switch`、`pnpm report:verify-market-switch`、`pnpm report:strategy-activity`、`pnpm report:verify-strategy-activity`

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

README 这里只保留高层概览，详细功能清单、实施进度、接手注意事项与验证口径统一以 [docs/实施路线与接手清单](./docs/实施路线与接手清单.md) 为准，避免双份维护。

- 已形成桌面端优先的控制中枢：总览、行情、策略、回测、AI 调度、提醒、交易记录、AI 复盘、系统日志/审计等主页面均已落地。
- 行情、AI、ops、账户与策略运行态已经完成本地聚合接口和 SSE 主链路，桌面端以近实时快照为主，REST 负责首帧与兜底。
- 工作台状态、布局偏好、主盯盘周期、回测/复盘/调度焦点和策略编辑草稿已支持本地持久化与服务端同步恢复。
- 策略链路已经打通从运行态、执行预检、手动/自动执行，到提醒、审计、AI 跟踪复盘和 ChangeRequest/Backtest 的基础闭环。
- 账户与交易链路已覆盖 `paper` 本地账本、Bybit 私有只读视图、真实委托/改单/撤单/平仓，以及统一执行预检入口。
- 设置页、桌面通知、托盘、链路诊断和 OpenClaw 本地编排入口已接入桌面壳，日常排障可直接在客户端完成。

## 边界约定

- 桌面端是量化交易控制端，不是交易执行引擎。
- 最终交易执行必须由量化层完成，不能绕过风控直接打到 Bybit。
- OpenClaw 只接受结构化任务，不直接执行交易。
- 浏览器网页登录、账户设置、API Key 创建统一使用 `https://www.bybit-global.com/`。
- 程序侧行情、交易、公告接口继续使用 `api.bybit.com` 或其他 API 域名。
- 网页入口和 API 入口用途不同，文档和代码里必须主动区分。

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
pnpm dev:desktop:repair
```

`pnpm dev:desktop` 会同时启动本地控制服务、Vite 渲染进程和 Electron 桌面壳；若 `127.0.0.1:8787` 已被不健康的旧 `control-api` 进程占住，可改用 `pnpm dev:desktop:repair`。

### 5. 执行验证命令

```bash
pnpm build:desktop
pnpm lint:desktop
pnpm test:control-api
pnpm verify:backend
```

## 测试与交付原则

- 后续开发默认采用“先实现、再测试、测试通过后再交付”。
- 每次交付前，至少执行与改动范围对应的验证，例如前端构建、后端启动、接口联调、关键交互回归。
- 如果环境限制导致某些测试无法执行，交付时必须明确说明缺失项和剩余风险。

## 当前验证结果

- `pnpm --dir apps/desktop build` 已通过。
- `pnpm --dir apps/desktop lint` 已通过。
- `python3 -m py_compile services/control-api/*.py` 已通过。
- `python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v` 已通过。
- `python3 services/control-api/main.py` 已可在 Python 3.9 环境启动。
- 其余接口、SSE、桌面端与回归产物的最新状态统一以 [docs/实施路线与接手清单](./docs/实施路线与接手清单.md#4-已验证命令) 为准。
