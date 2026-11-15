# Wanora 仓库规则

## 产品边界

Wanora 是面向日本市场的 AI 职业管理与求职辅助 SaaS。实现时分清三块，**不要做成用户可见的「四层导航」**：

| 产品面 | 路由 / 职责 | AI 上下文层（内部） |
| --- | --- | --- |
| **Applications（応募進捗）** | `/` 看板与抽屉 | L2 求人/応募、L3 会社、L4 面接反馈 |
| **My Career** | `/profile` 档案、履历、项目、技能、目标、时间线、書類出力 | L1 Personal Career Profile |
| **AI Assistant（全站侧栏）** | 顶栏开闭的全局侧栏；按场景装配上下文 | 按任务组合 L1→L2→L3→L4 |

- 进度板**不要**再塞 L1 履历表单；My Career **不要**承担投递阶段状态。
- AI 的用户主入口是**全站侧栏**（字段旁 / 面接準備等只负责「打开侧栏并设置 Target」）；禁止平行再造多套聊天壳或独立 AI 微服务。
- 设计权威在 Project 资料；实现以已合并代码与获批 PR 为准。
- **优先复用**现有 Next.js App Router、Server Actions、`src/lib/data/*`、`src/lib/domain/*`、Better Auth、Drizzle；不新起微服务、不引入云厂商专有 SDK。
- `AGENTS.md` 只写**长期**仓库规范。阶段性功能范围与里程碑写在 Project 计划文档，不要把某一期任务永久写死在本文件。

## 测试规则（必须遵守）

- **每次新增或修改代码，交付或汇报前都要跑一遍项目测试。** 失败先修掉本次改动引起的问题；修不掉的，在汇报 / PR 描述中写明失败的测试和输出。
- 改动区域没有测试就补上；每个 PR 必须带上对应改动的测试。
- PR 未通过 CI 不合并。
- 涉及 AI 编排、Provider、draft Zod、usage 记账的改动：至少单元测试；数据访问 / 迁移改动跑 `pnpm test:integration`。

## 测试命令

| 命令 | 内容 |
| --- | --- |
| `pnpm verify` | 类型检查（`tsc --noEmit`）+ ESLint + Vitest 单元/组件测试。**推送前必跑**，Husky `pre-push` 钩子会自动执行 |
| `pnpm test:integration` | Vitest 集成测试（`*.int.test.ts`），用 Testcontainers 自动启动真实 Postgres 并执行迁移；**需要 Docker**。改动数据库、认证、数据访问层时推送前必跑 |
| `pnpm test:e2e` | Playwright E2E（会先 `pnpm db:migrate`、`pnpm build` 再启动服务）；需要 `DATABASE_URL` 指向可写的 Postgres；首次需 `pnpm exec playwright install chromium` |
| `pnpm test:watch` | Vitest 监听模式 |

CI（`.github/workflows/ci.yml`）在每个 PR 和 main 推送上运行 `pnpm verify`、`pnpm test:integration` 和 `pnpm test:e2e`。

## 工具无关（可随时迁移到 Claude Code / Codex）

本项目目前用 Cursor 开发，但必须能随时切换到 Claude Code 或 Codex 继续开发。

- **`AGENTS.md` 是 agent 规则的唯一来源。** 新增或修改规则只改这个文件。
- 不要把 Cursor 专用配置（`.cursor/rules`、`.cursorrules` 等）当作存放规则的地方；其他工具的入口文件只能指向本文件，不能另写规则。
  - `CLAUDE.md` 只包含 `@AGENTS.md`，让 Claude Code 读到同一份规则。
  - Codex 原生读取 `AGENTS.md`，无需额外文件。
- 构建、测试、运行不依赖任何工具专有功能：一律通过 `package.json` 中的 pnpm 脚本完成，相关文档放在仓库里（`AGENTS.md`、`README.md`）。
- 产品设计长文、架构图、可点 demo 放在仓库外的 Project / 资料夹；**不要**把大段产品稿提交进 git，除非用户明确要求。

## Git 提交

- **每次 commit 都必须写清楚改动内容**：subject 一行概要；必要时用正文列出主要变更。
- **不允许**空 subject，也不允许纯占位说明（如 `update`、`fix`、`wip`、`changes`）。
- Husky `commit-msg` 钩子会校验 subject；推送前仍会跑 `pre-push` → `pnpm verify`。

## 约定

- 包管理器：pnpm；Node 22+。
- 单元测试与源码同目录，命名 `*.test.ts(x)`；集成测试同目录，命名 `*.int.test.ts`（共用工具在 `test/integration/`）；E2E 放在 `e2e/`，命名 `*.spec.ts`。
- 配置只通过环境变量注入（见 `.env.example`），在 `src/lib/env.ts` 用 Zod 校验；不使用云厂商专有 SDK。
- 数据库：Drizzle schema 在 `src/db/schema.ts`；改 schema 后用 `pnpm db:generate --name <描述>` 生成迁移（`drizzle/`，提交进仓库），不要手改已提交的迁移。`pnpm db:migrate` 执行迁移。
- 用户数据隔离：用户 ID 只能来自会话（`src/lib/session.ts` 的 `getSessionUser`），不能取自请求参数或 body；数据访问函数（`src/lib/data/`）显式接收 `userId` 并按它过滤。
- AI 相关代码默认放在 `src/lib/ai/`；UI 在 `src/components/ai/`；对外 HTTP 入口仅限服务端 Route Handlers（如 `src/app/api/ai/**`），可经现有 Server Actions 触发，但**不得**在客户端持有供应商 SDK 或 API Key。业务模块只依赖 `src/lib/ai` 统一抽象，**不直接**调用某一家供应商 SDK。

## 安全与数据隔离（含 AI）

调用 LLM 或读写用户职业数据前，按顺序满足：

1. **身份认证**：用 `getSessionUser`（或等价会话 API）校验登录态；未登录返回 401 / `unauthenticated`，不发起模型请求、不写库。
2. **资源归属**：只使用会话中的 `userId` 查询与写入；校验 projectId / applicationId 等属于该用户。禁止信任客户端传来的「完整档案 JSON」作为唯一权威数据源（客户端输入仅可作为「用户本轮笔记」）。
3. **限流**：按用户 / 功能做速率限制；超限拒绝调用并返回可展示错误。
4. **预算检查**：发起模型请求前检查**用户日预算**与**全站日费用上限**（如 `AI_DAILY_COST_BUDGET_USD`、`AI_GLOBAL_DAILY_COST_BUDGET_USD`）；须用预留/行锁等机制避免并发请求共同读到旧累计后超额放行。超预算不调用。无计量与预算挂钩时不得默认敞开无限调用。

其他硬约束：

- **API Key / 密钥仅存服务端环境变量**（如 `AI_*_API_KEY`），禁止 `NEXT_PUBLIC_*`、禁止下发到浏览器、禁止写入仓库或 demo HTML。
- **最小必要上下文**：只发送完成当前任务所需的字段；**默认排除**任务不需要的敏感信息（如完整住址、电话、邮件、在留资格细节、薪资、扶养/配偶者、証明写真等），除非该功能明确需要且已获产品批准。
- **禁止编造**：不得编造或静默补全经历、公司、职位、技能、资格/证书、成果、年限、薪资、数字或面试事实。缺块对用户**明示**；不确定字段留空 / `null`。
- **Zod = 结构校验，不代替事实准确性**：模型输出必须经 Zod（或同等）结构化校验后再使用；校验只保证形状与类型，**不**证明内容属实。事实约束靠 prompt、最小上下文、用户确认门与产品规则共同保证。校验失败则报错或安全降级，不得部分脏写正式表。
- **用户确认前不得写入正式职业档案**。持久化修改遵循 Propose → Preview → Confirm → Apply；AI **不得**直接执行 SQL。确认前结果只进草稿/提案；确认后再经 `src/lib/data/*` 白名单字段写入。
- 预留并写入 **token / 成本估算 / 调用统计**（按 user、feature、provider、model）；限额与计费策略可迭代，记账点与表结构要先有。
- Provider / 模型必须可配置替换（env + 单一 Gateway 抽象）。**只实现当前启用的适配器**（如 Mock + 一家真实）；不要为未接入厂商提交无实际用途的空 Provider 文件。禁止自动模型路由算法（直至产品另行批准）。
- 出站发送个人履历到第三方 LLM 时，遵守产品隐私与获批供应商列表；未获批不得私自接入。

## AI 服务层

- 统一入口：`src/lib/ai` 的 Provider / Gateway（`complete` / `completeStream`），由 env 选择供应商与默认模型；无 Key / feature flag 关闭时必须安全降级，不得抛出密钥或半写入。
- **三上下文**：Conversation（聊天线程）、PageContext（随路由的弱提示）、TargetContext（业务操作目标）。页面导航可更新 PageContext，**不得**静默改变 TargetContext；切换 Target 须明确提示用户。
- **AIContextResolver** 通过可扩展的 **ContextSource** 装配数据；初期仅注册 My Career 只读源，后续可增 Application / Interview 等。禁止为当前任务无差别倾倒全部用户数据。
- Feature / Task 编排放在 `src/lib/ai` 下（如 `features/*` 或 `tasks/*`）：拼 prompt、调 Gateway、Zod 校验、触发 draft/提案；Route Handler 保持瘦。
- Prompt 与输出 schema 按版本管理；默认重组与润色用户已提供信息，不添加用户未提及的事实。
- 流式经 Gateway；客户端可安全重试；失败不半写入正式表。
- 聊天**硬删**由外部调度器触发受保护的清理入口完成；**不要**挂在 Next.js 进程启动路径上。usage / 业务审计表与聊天软删解耦，按产品规则保留。
- 单测使用 mock Provider；无 Key 的环境必须能关闭 AI 并测试降级路径。
- AI 面向用户文案默认日语，放在 next-intl 的 `Ai`（或等价）命名空间；**不破坏**站点既有多语言架构（chrome 仍可随 `NEXT_LOCALE`）。

## 个人资料与导出（内容语言）

- **界面语言**（`NEXT_LOCALE` / 语言切换器）：只影响 chrome（导航、按钮、标签等），不影响用户录入的履历正文字段。
- **履历录入**：用户在个人资料 / 学歴 / 職歴 / 免許表单中**只填日语**；数据库仍用 `LocalizedText` jsonb，当前写入 `{ "ja": "…" }` 即可。不要在表单里要求中/英三语并列输入。
- **导出（履歴書 / 職務経歴書）**：导出时可选择 ja / zh-CN / en；非日语内容由后端从日语**自动翻译**生成。未接入获批的翻译 API 前，使用 `src/lib/domain/export-translation.ts` 的 stub（原样返回日语并保留 TODO），不要私自调用外部翻译服务。
- 导出版式以产品已锁定的样张 / export-final 为准；未经确认不得改栏目、顺序或備考区布局。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
