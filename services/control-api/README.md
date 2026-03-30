# control-api

本地控制服务负责给桌面端提供统一的量化控制接口，包括：

- 控制总览 `ControlSnapshot`
- 工作台状态 `WorkspacePreferences`
- 行情、自选、K 线与订单簿数据
- 策略、回测、变更请求、AI 调度、新闻、提醒、交易记录、AI 复盘、审计事件
- OpenClaw 本机配置与健康状态读取

## 启动

```bash
python3 -m pip install -r services/control-api/requirements.txt
python3 services/control-api/main.py
```

默认监听 `http://127.0.0.1:8787`。

## 说明

- 当前版本使用本地 JSON 持久化 mock 状态，文件位于 `services/control-api/.runtime/state.json`。
- 桌面控制端的布局、默认页面、默认模式等工作台状态也通过本地服务持久化，方便后续会话恢复。
- 行情接口当前优先走 Bybit 公共 REST API；若拉取失败，则自动回退到本地 mock 状态。
- 私有账户接口支持从环境变量或 `~/.bybit-control/private-api.json` 读取 Bybit API 配置。
- 仓库内提供了示例文件 [private-api.example.json](/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json)，请在本机自行复制到 `~/.bybit-control/private-api.json` 后再填写新的只读 Key，不要把真实密钥提交到仓库或发送到对话里。
- 当前 `GET /api/account/*` 在未配置只读 Key 时会稳定回退到 mock 数据，保证桌面控制端可继续联调。
- 当前 `GET /api/account/*` 在已配置真实私有 Key 且账户为空时，会返回真实空账户结果，不再错误回退 mock 持仓或委托。
- 当前 `POST /api/trades/manual` 只开放 `paper` 模式，`demo` / `live` 会明确拒绝，直到真实执行引擎接通。
- 当前 `POST /api/integrations/bybit-private/probe-trade` 会向 Bybit 交易接口发送故意无效的下单参数，用来验证签名、认证和交易 POST 链路，不会直接发出可成交订单。
- OpenClaw 集成当前默认只做“本机配置读取 + health/status 探测 + 任务占位记录”，不直接修改 OpenClaw 源码，也不直接驱动 Bybit 交易。
- 真正的量化执行、风控与回测引擎后续可以在保持同一接口契约的前提下替换掉这套 mock 实现。

## 测试

```bash
python3 -m py_compile services/control-api/*.py services/control-api/tests/test_control_api.py
python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v
```
