# 桌面控制端说明

`apps/desktop` 是 Bybit 量化交易控制端的桌面应用层，当前采用：

- `React + TypeScript + Vite` 负责渲染进程
- `Electron` 负责桌面壳、主进程与 preload

## 目录职责

- `src/App.tsx`
  - 中文控制端主界面
  - 总览、行情、策略、回测、AI 调度、新闻事件、提醒中心、交易记录、AI 复盘、系统日志/审计
  - 已包含控制总览卡组、行情脉冲区、账户链路状态区等更完整的控制台布局
- `src/api.ts`
  - 本地控制服务 API 调用层
  - 提供 fallback 数据，保证本地服务异常时界面仍可用
- `src/types.ts`
  - 前端使用的主要类型契约
- `src/main/main.ts`
  - Electron 主进程入口
- `src/preload.ts`
  - Electron preload 入口

## 开发命令

```bash
pnpm dev:desktop
pnpm dev:desktop:repair
pnpm build:desktop
pnpm lint:desktop
```

`verify / smoke / report` 的统一入口、详细 runbook、运行产物与历史基线只看仓库根 [README](../../README.md) 和 [docs/实施路线与接手清单](../../docs/实施路线与接手清单.md#4-已验证命令)；这里仅保留桌面端常用命令。
