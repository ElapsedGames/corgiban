import { RemixBrowser } from '@remix-run/react';
import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

type PwaStatusWindow = Window & {
  __corgibanPwaRegistrationError?: string;
};

function reportPwaRegistrationError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  (window as PwaStatusWindow).__corgibanPwaRegistrationError = message;
  console.error('[PWA] Failed to bootstrap service worker registration.', error);
}

const enablePwaInDev = import.meta.env?.VITE_ENABLE_PWA_DEV === '1';
const shouldRegisterServiceWorker = import.meta.env?.PROD || enablePwaInDev;

if (shouldRegisterServiceWorker && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onRegisterError: reportPwaRegistrationError,
      });
    })
    .catch((error: unknown) => {
      reportPwaRegistrationError(error);
    });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
