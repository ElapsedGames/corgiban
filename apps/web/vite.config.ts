import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

function readNodeEnv(): Record<string, string | undefined> {
  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
  );
}

function resolveAppBuildId(): string {
  const env = readNodeEnv();
  const explicit = env.VITE_APP_BUILD_ID?.trim() || env.CORGIBAN_BUILD_ID?.trim();
  if (explicit) {
    return explicit;
  }

  const githubSha = env.GITHUB_SHA?.trim();
  if (githubSha) {
    return githubSha.slice(0, 12);
  }

  return `local-${new Date().toISOString()}`;
}

const appBuildId = resolveAppBuildId();

// Chrome DevTools probes /.well-known/appspecific/com.chrome.devtools.json on every page load.
// Remix has no route for it and logs a 404 error. Intercept it in the dev server before Remix
// sees it so the console stays clean.
function suppressWellKnownProbes(): Plugin {
  return {
    name: 'suppress-well-known-probes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/.well-known/')) {
          res.writeHead(404);
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(appBuildId),
  },
  plugins: [suppressWellKnownProbes(), remix()],
});
