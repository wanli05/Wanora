import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "..");

export default defineConfig({
  root: path.join(root, "slot-grid-layout-harness"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.join(repo, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4177,
    strictPort: true,
  },
});
