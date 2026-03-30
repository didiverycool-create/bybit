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
pnpm build:desktop
pnpm lint:desktop
```

## 当前边界

- 桌面端是控制端，不是交易执行引擎
- 手动交易当前只开放 Paper 路径
- Bybit 私有账户数据必须通过 API Key 读取，不能复用网页登录态
- 已提供“真实交易链路探测”按钮，用于安全验证 Bybit 交易 POST 链路
- 登录、账户设置、API Key 创建的网页入口统一使用 `https://www.bybit-global.com/`
