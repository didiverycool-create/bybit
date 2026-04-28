# 项目说明

## Bybit 网页入口

- 本项目默认使用 `https://www.bybit-global.com/` 作为网页登录与网页交易入口。
- 除非用户明确要求，否则不要引导用户通过 `bybit.com` 登录。
- 只要涉及登录、账户设置、API Key 创建、网页端手动交易等浏览器内操作，都以 `bybit-global.com` 为准。

## 域名说明

- `bybit-global.com` 是本项目约定的网页端与账户入口主域名。
- 官方 API 文档可能仍位于 `bybit-exchange.github.io`。
- 程序调用的 API 接口域名在适用时仍可能使用 `api.bybit.com` 或区域专用 API 域名。
- 当回答里同时出现网页域名和 API 域名时，必须主动说明两者用途不同，避免混淆。

## 语言约定

- 本项目后续新增的 Markdown 文档默认使用中文。
- 本项目面向用户的沟通默认使用中文。
- 为保证准确性，代码、API 字段名、URL、库名及其他技术标识在必要时保留原文。

## 交付约定

- 后续开发必须遵循“先实现、再测试、测试通过后再交付”的节奏。
- 任何功能改动在交付前，至少应完成与改动范围对应的构建检查、启动检查、接口检查或关键流程验证。
- 如果受环境限制无法完成某项测试，必须明确记录“哪些测试没跑、为什么没跑、当前剩余风险是什么”。
- 后续新的 Codex / AI 会话进入本项目时，默认把“测试验证”视为交付的一部分，而不是可选步骤。

## 架构文档入口

- 仓库级总入口见 `README.md`
- 架构说明见 `docs/架构总览.md`
- 接口说明见 `docs/接口契约.md`
- 开发约定见 `docs/开发约定.md`
- 当前实施路线与接手清单见 `docs/实施路线与接手清单.md`
- 后续新的 Codex / AI 会话进入本项目时，除本文件外，默认先阅读上述文档再继续开发。

## 主线权威来源

- 如果子代理、旧线程、历史计划和当前仓库实现之间出现冲突，以当前仓库代码和上述文档为准。
- 未经同步到仓库文档的口头计划、临时草案或子代理建议，不能直接视为当前主线事实。


<claude-mem-context>
# Memory Context

# [bybit] recent context, 2026-04-19 12:34am GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (26,351t read) | 1,344,971t work | 98% savings

### Apr 18, 2026
26 7:13p 🔄 Bybit Desktop App.tsx God Component Decomposition Progress Summary
27 " 🔵 Bybit Desktop Verified Baseline: lint + build + 2 verify scripts all passing
31 7:16p 🔵 strategyActivitySelector* System: 3-Source Priority Resolution Architecture
32 " 🔵 AppShell Named-Variable Refactor Survey: All Remaining Targets Already Clean
33 7:17p 🔵 Explorer Agent Laplace: 3 Next-Round Refactor Targets After App.tsx Is Fully Lean
34 " ⚖️ Explorer Agent Avicenna: Audit #6 Minimal Landing — Remove Flat-Field Fallbacks in Selector Layer
35 " 🔵 buildAppCompositionStrategyWorkspaceDerivedStateInputGroups Already Exists and Is Already Decomposed
41 7:18p 🔵 Presentation Layer Assembly Chain Fully Decomposed — No Further Named-Variable Targets Found
42 7:19p 🔄 App.tsx God Component Progressive Slimming — 2686→2298 Lines via Hook Extraction
43 " 🟣 Four Parallel Claude Subagent Section Extractions Completed (Tasks A–D)
44 " 🔴 Fixed "reviewsQuery is not defined" and "strategies is not defined" After useControlDataQueryModel Extraction
45 " 🔵 Bybit Desktop Refactor Audit: Remaining Open Items After This Round
46 " ⚖️ Verification Baseline: Four Commands Must Pass Before Any Delivery
47 7:21p 🔵 Bybit Desktop App Presentation Model Composition Architecture — Full Layer Map
48 7:23p 🔄 Bybit Desktop App.tsx Continuous Decomposition — 2298-Line Milestone
49 " 🟣 Four Parallel Subagent Tasks A–D Completed: UI Section Decomposition
50 " 🔴 Fixed "reviewsQuery is not defined" and "strategies is not defined" During Hook Extraction
51 " 🔵 Bybit Desktop Verification Baseline: All Four Checks Green
52 " ⚖️ Code Review Audit #6, #10, #11, #14, #16, #3, #23, #24, #25 Still Open
53 " ⚖️ Session Handoff Constraints: bybit-global.com Domain, Sequential Electron Tests, No Re-doing Tasks A–D
57 7:30p 🔄 App.tsx Progressive Slimming: 2686 → 2298 Lines Across Multiple Rounds
58 " 🔴 useControlDataQueryModel: reviewsQuery and strategies Undefined Errors Fixed
59 " 🔵 Bybit Desktop Verification Suite Baseline: All Four Scripts Green as of Apr 18 ~7:25pm
60 " ⚖️ Next-Round Priority Order: App.tsx → Audit #10 K-Line TTL → Audit #6 StrategyActivitySnapshot
61 " 🔵 executionContext Input Chain Identified as Heaviest Remaining Refactor Target in App.tsx
64 7:34p 🔄 App.tsx God Component Continued Reduction — 2686 → 2298 Lines via Hook Extraction
65 " 🔴 Fixed "reviewsQuery is not defined" and "strategies is not defined" After Hook Extraction
66 " 🟣 Parallel Subagent UI Component Splits A–D Completed
67 " 🔵 Bybit Desktop Regression Baseline — All Four Checks Green as of Apr 18 7:25pm
68 " ⚖️ Remaining Audit Items Prioritized for Next Session
69 7:37p ⚖️ New Thread Handoff: Bybit Desktop App.tsx Refactor Continuation Plan
70 7:39p 🔵 Strategy Workspace Component Architecture Fully Mapped — Container/Section/Panel Chain
74 7:42p 🔵 App.tsx Full Model Chain Architecture — Post-Refactor Baseline Survey
75 7:45p 🔵 App.tsx Next Refactor Targets: buildAppPresentationModelsArgs Flat-Spread and Preset Wiring
76 7:46p 🔄 buildAppPresentationModelsSourceGroups Helper Extracted from buildAppPresentationModelsArgs
77 7:47p 🔵 K-Line Cache TTL #10 — Full Architecture Audit (Read-Only)
78 7:49p 🔵 StrategyActivitySnapshot #6 — Full Field-Blast Audit: Root Causes and Minimum Cut Identified
79 7:53p 🔄 StrategyCurrentPanel Section View-Model Grouping — 7th Batch Complete
80 " 🔄 useAppShellModel Source Groups Extracted to buildAppShellModelSourceGroups.ts
81 " 🔵 Audit #10 K-Line Cache TTL Already Fully Implemented in bybit_public_client.py
82 " 🔵 App.tsx Already at Single-Responsibility Limit — Next Targets Are Source Group Layers Below
84 7:59p 🔵 Read-Only Audit: Frontend StrategyActivitySnapshot Flat Ops Field Consumers Not Yet Migrated to latest_ops
93 8:14p 🔵 Audit #16: build_strategy_activity_payload Multi-Traversal Analysis — Full Call Chain Mapped
97 8:21p 🔵 Audit #10: K-Line Cache TTL Definitions Located in bybit_public_client.py
98 8:24p 🔵 Audit #10 Full Read-Only Audit: K-Line Cache TTL Call Chain and Minimum-Risk Landing Plan
99 8:28p 🔵 buildWorkspaceOpsSectionActions.ts Architecture Survey — Pre-Split Baseline
100 8:30p 🔄 buildWorkspaceOpsSectionActions.ts Split into 8 Per-Section Helper Files
101 8:32p 🔄 Workspace Strategy Action Bus Split into Three Independent Builders
106 8:40p 🔄 useRuntimeAndSettingsModel Split: Derived State and Draft Sync Extracted
107 " 🔵 runtime/settings Derived State Cluster — Full Consumer Map and Next Split Candidates

Access 1345k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>