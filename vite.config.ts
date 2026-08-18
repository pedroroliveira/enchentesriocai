import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";





import { formatOverridesPlugin } from "./export-plugins/format-overrides-plugin.ts";
import { contentPlugin } from "./export-plugins/content-plugin/index.ts";

function extractHostname(value: string): string {
  try {
    if (value.includes("://")) {
      return new URL(value).hostname;
    }
    return value;
  } catch {
    return value;
  }
}

function apiDevPlugin(): Plugin {
  return {
    name: "api-dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api")) return next();
        try {
          const mod = await server.ssrLoadModule("/src/server/entry.ts");
          const handler = mod.default;
          handler(req, res, next);
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err);
          next(err);
        }
      });
    }
  };
}

/**
 * Serves the pre-built output of an automation worktree when the
 * X-Worktree-Root header is present. Enables automation scan tools to
 * verify rendered HTML without affecting the user's live preview.
 *
 * Flow: dev-supervisor injects the header on requests carrying X-Base-Dir.
 * When the worktree has been built (dist/client/index.html exists), this
 * plugin serves the production build. Otherwise returns 503 so the
 * automation knows a build is needed first.
 */
const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json"
};

function worktreePreviewPlugin(): Plugin {
  const serverBundleCache = new Map<string, {app: unknown;mtimeMs: number;}>();

  return {
    name: "worktree-preview",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const worktreeRoot = req.headers["x-worktree-root"] as string | undefined;
        if (!worktreeRoot) return next();

        const clientDir = path.join(worktreeRoot, "dist", "client");
        const indexPath = path.join(clientDir, "index.html");

        if (!existsSync(indexPath)) {
          res.setHeader("X-Worktree-Status", "not-built");
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "Worktree build not found. Run vite build first." }));
          return;
        }

        const url = req.url || "/";

        const ext = path.extname(url.split("?")[0] || "");
        if (ext && ext !== ".html") {
          const assetPath = path.resolve(clientDir, "." + (url.split("?")[0] || ""));
          if (assetPath.startsWith(clientDir + path.sep) && existsSync(assetPath)) {
            res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
            res.end(await readFile(assetPath));
            return;
          }
        }

        const bundlePath = path.join(worktreeRoot, "dist", "server.bundle.mjs");
        if (!existsSync(bundlePath)) {
          res.setHeader("Content-Type", "text/html");
          res.end(await readFile(indexPath, "utf-8"));
          return;
        }

        try {
          const bundleMtime: number = statSync(bundlePath).mtimeMs;
          let cached = serverBundleCache.get(worktreeRoot);
          if (!cached || cached.mtimeMs < bundleMtime) {
            const cacheBuster: string = `?t=${bundleMtime}`;
            const mod = await import(/* @vite-ignore */`${bundlePath}${cacheBuster}`);
            cached = { app: mod.default, mtimeMs: bundleMtime };
            serverBundleCache.set(worktreeRoot, cached);
          }

          const app = cached.app as (
          req: IncomingMessage,
          res: ServerResponse,
          next: () => void)
          => void;

          app(req, res, () => {
            readFile(indexPath, "utf-8").then((html) => {
              res.setHeader("Content-Type", "text/html");
              res.end(html);
            }).catch(() => {
              res.statusCode = 500;
              res.end("Failed to read index.html");
            });
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: `Worktree server bundle failed: ${message}` }));
        }
      });
    }
  };
}

const allowedHosts: string[] = [];
const corsOrigins: string[] = [];

if (process.env.FRONTEND_DOMAIN) {
  const frontendHost = extractHostname(process.env.FRONTEND_DOMAIN);
  allowedHosts.push(frontendHost);
  corsOrigins.push(`http://${frontendHost}`, `https://${frontendHost}`);
}
if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(",");
  allowedHosts.push(...origins.map(extractHostname));
  corsOrigins.push(...origins);
}
if (process.env.VITE_PARENT_ORIGIN) {
  allowedHosts.push(extractHostname(process.env.VITE_PARENT_ORIGIN));
  corsOrigins.push(process.env.VITE_PARENT_ORIGIN);
}
if (allowedHosts.length === 0) {
  allowedHosts.push("*");
}
if (corsOrigins.length === 0) {
  corsOrigins.push("*");
}

export default defineConfig(({ isSsrBuild }) => ({
  envPrefix: ["VITE_", "SITE_"],

  plugins: [
  react({
    babel: {
      plugins: []
    }
  }),
  worktreePreviewPlugin(),
  apiDevPlugin(),
  formatOverridesPlugin(__dirname),
  contentPlugin()],










  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    alias: {
      nothing: "/src/fallbacks/missingModule.ts",
      "@/api": path.resolve(__dirname, "./src/server/api"),
      "@": path.resolve(__dirname, "./src")
    }
  },

  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "motion/react"], exclude: ["drizzle-orm", "pg"]
  },

  ssr: {
    noExternal: isSsrBuild ? true : undefined
  },

  server: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    },
    hmr: {
      overlay: false
    },
    watch: {
      ignored: ["**/dist/**"]
    },
    // Pre-transform the entry chain on dev-server start so the FIRST iframe
    // request doesn't pay the full cold on-demand transpile cost. Paired with
    // the container's pre-start `vite optimize` (container-scripts/preview/
    // nomad_setup.sh), this shrinks the mount→IFRAME_READY window that the
    // builder's recovery logic waits on.
    warmup: {
      clientFiles: ["./src/main.tsx", "./src/App.tsx"]
    }
  },

  preview: {
    host: process.env.HOST || "0.0.0.0",
    port: parseInt(process.env.PORT || "5173"),
    strictPort: !!process.env.PORT,
    allowedHosts,
    cors: {
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "User-Agent"]
    }
  },

  build: isSsrBuild ?
  {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    ssr: "src/server/entry.ts",
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "server.bundle.mjs",
        chunkFileNames: "bin/[name]-[hash].js",
        banner: "import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);"
      }
    }
  } :
  {
    outDir: "dist/client",
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // "react-dom" sozinho não capturava react-dom/client nem o
          // jsx-runtime, então quase todo o React caía no chunk da aplicação e
          // era reinvalidado a cada deploy. Listando os entrypoints reais o
          // vendor fica estável entre builds.
          "react-vendor": [
          "react",
          "react/jsx-runtime",
          "react-dom",
          "react-dom/client"],

          // Sem chunk manual para @radix-ui: o único pacote que a aplicação
          // realmente alcança é react-slot, via <Button>, usado só pelo
          // CookieBanner (que já é lazy). Forçar o agrupamento criava uma
          // dependência circular entre chunks e tirava esse código do chunk
          // sob demanda, trazendo-o para o carregamento inicial.
        }
      }
    }
  }
}));
