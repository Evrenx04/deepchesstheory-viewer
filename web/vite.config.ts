import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { contentPlugin } from "./contentPlugin.ts";
import { NOTICES_FILE } from "./src/lib/sources.ts";

/** The third-party license notices (../THIRD-PARTY-NOTICES) go with the site: served in development, copied into the build. */
function noticesPlugin(): Plugin {
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../THIRD-PARTY-NOTICES");
  return {
    name: "third-party-notices",
    configureServer(server) {
      server.middlewares.use(`${server.config.base}${NOTICES_FILE}`, (_req, res) => {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(readFileSync(source, "utf8"));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: NOTICES_FILE, source: readFileSync(source, "utf8") });
    },
  };
}

export default defineConfig({
  // Study content lives next to web/, in ../content; it is served and copied as separate files.
  plugins: [react(), tailwindcss(), contentPlugin(), noticesPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
