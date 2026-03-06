import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
const pwaDevEnabled = readNodeEnv().VITE_ENABLE_PWA_DEV === '1';

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
  resolve: {
    // Keep a single React dispatcher in dev. Without this, Remix/Vite can load
    // both versioned and unversioned optimized React chunks and trip invalid hook calls.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  plugins: [
    suppressWellKnownProbes(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Corgiban',
        short_name: 'Corgiban',
        description: 'Deterministic Sokoban game, solver, and benchmark suite.',
        start_url: '/play',
        scope: '/',
        display: 'standalone',
        background_color: '#0d1218',
        theme_color: '#0d1218',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'corgiban-pages',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: pwaDevEnabled,
        suppressWarnings: true,
        type: 'module',
      },
    }),
    remix(),
  ],
});
