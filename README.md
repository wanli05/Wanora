# Wanora

在日本求职者用的投递进度管理 Web 应用（Next.js + TypeScript）。

## 开发

```bash
pnpm install
cp .env.example .env.local   # 填写 DATABASE_URL、AUTH_SECRET
pnpm db:migrate
pnpm dev            # http://localhost:3000
```

本地 Postgres 可以用 `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wanora -p 5432:5432 postgres:17-alpine`。

## 测试

```bash
pnpm verify         # 类型检查 + ESLint + Vitest（pre-push 钩子自动执行）
pnpm test:integration  # 集成测试（Testcontainers，需要 Docker）
pnpm test:e2e       # Playwright E2E；需要 DATABASE_URL；首次需 pnpm exec playwright install chromium
```

仓库规则见 [AGENTS.md](./AGENTS.md)。
