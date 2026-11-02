# Wanora

在日本求职者用的投递进度管理 Web 应用（Next.js + TypeScript）。

## 开发

```bash
pnpm install
cp .env.example .env.local   # 填写 DATABASE_URL、AUTH_SECRET
pnpm db:migrate
pnpm dev            # http://localhost:3000
```

本地 Postgres 可以用 `docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=wanora -p 5432:5432 postgres:17-alpine`，或：

```bash
docker compose up -d   # Postgres + MinIO（S3 兼容，控制台 http://localhost:9001）
```

`.env.local` 中 `DATABASE_URL=postgres://postgres:postgres@localhost:5432/wanora` 即可对接 compose 里的 Postgres。

## 容器与部署

```bash
docker build -t wanora:local .
docker run --rm -p 8080:8080 -e DATABASE_URL=... -e AUTH_SECRET=... -e AUTH_URL=http://localhost:8080 wanora:local
```

生产镜像内含 Chromium 与 Noto CJK 字体，供后续 PDF 导出使用。合并到 `main` 后 GitHub Actions 的 [Deploy workflow](.github/workflows/deploy.yml) 会构建镜像；Cloud Run 部署步骤已写好但默认关闭，配置 GCP 密钥后再启用。

## 测试

```bash
pnpm verify         # 类型检查 + ESLint + Vitest（pre-push 钩子自动执行）
pnpm test:integration  # 集成测试（Testcontainers，需要 Docker）
pnpm test:e2e       # Playwright E2E；需要 DATABASE_URL；首次需 pnpm exec playwright install chromium
```

仓库规则见 [AGENTS.md](./AGENTS.md)。
