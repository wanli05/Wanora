# Wanora

在日本求职者用的投递进度管理 Web 应用（Next.js + TypeScript）。

## 开发

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## 测试

```bash
pnpm verify         # 类型检查 + ESLint + Vitest（pre-push 钩子自动执行）
pnpm test:e2e       # Playwright E2E；首次需 pnpm exec playwright install chromium
```

仓库规则见 [AGENTS.md](./AGENTS.md)。
