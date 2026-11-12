# Wanora 仓库规则

## 测试规则（必须遵守）

- **每次新增或修改代码，交付或汇报前都要跑一遍项目测试。** 失败先修掉本次改动引起的问题；修不掉的，在汇报 / PR 描述中写明失败的测试和输出。
- 改动区域没有测试就补上；每个 PR 必须带上对应改动的测试。
- PR 未通过 CI 不合并。

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

## 个人资料与导出（内容语言）

- **界面语言**（`NEXT_LOCALE` / 语言切换器）：只影响 chrome（导航、按钮、标签等），不影响用户录入的履历正文字段。
- **履历录入**：用户在个人资料 / 学歴 / 職歴 / 免許表单中**只填日语**；数据库仍用 `LocalizedText` jsonb，当前写入 `{ "ja": "…" }` 即可。不要在表单里要求中/英三语并列输入。
- **导出（履歴書 / 職務経歴書，后续里程碑）**：导出时可选择 ja / zh-CN / en；非日语内容由后端从日语**自动翻译**生成。未接入获批的翻译 API 前，使用 `src/lib/domain/export-translation.ts` 的 stub（原样返回日语并保留 TODO），不要私自调用外部翻译服务。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
