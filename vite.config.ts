import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const base = process.env.ATLAS_BASE_PATH ?? "/research/business-investment-atlas/";
if (!base.startsWith("/") || !base.endsWith("/") || base.startsWith("//") || /[?#\\]/.test(base)) throw new Error("ATLAS_BASE_PATH must be an absolute same-origin path with trailing slash.");
export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
