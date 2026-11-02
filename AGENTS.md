# Wanora 仓库规则

## 测试规则（必须遵守）

- **每次新增或修改代码，交付或汇报前都要跑一遍项目测试。** 失败先修掉本次改动引起的问题；修不掉的，在汇报 / PR 描述中写明失败的测试和输出。
- 改动区域没有测试就补上；每个 PR 必须带上对应改动的测试。
- PR 未通过 CI 不合并。

## 测试命令

| 命令 | 内容 |
| --- | --- |
| `pnpm verify` | 类型检查（`tsc --noEmit`）+ ESLint + Vitest 单元/组件测试。**推送前必跑**，Husky `pre-push` 钩子会自动执行 |
| `pnpm test:e2e` | Playwright E2E（会先 `pnpm build` 再启动服务）；首次需 `pnpm exec playwright install chromium` |
| `pnpm test:watch` | Vitest 监听模式 |

CI（`.github/workflows/ci.yml`）在每个 PR 和 main 推送上运行 `pnpm verify` 和 `pnpm test:e2e`。

## 约定

- 包管理器：pnpm；Node 22+。
- 单元测试与源码同目录，命名 `*.test.ts(x)`；E2E 放在 `e2e/`，命名 `*.spec.ts`。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
