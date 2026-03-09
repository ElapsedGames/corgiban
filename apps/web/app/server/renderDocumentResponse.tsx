import type { EntryContext } from '@remix-run/server-runtime';
import { RemixServer } from '@remix-run/react';
import { renderToReadableStream } from 'react-dom/server.browser';

const ABORT_DELAY = 5000;

type RenderDocumentResponseArgs = {
  request: Request;
  responseStatusCode: number;
  responseHeaders: Headers;
  remixContext: EntryContext;
};

export async function renderDocumentResponse({
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
}: RenderDocumentResponseArgs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_DELAY);

  try {
    const body = await renderToReadableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        signal: controller.signal,
        onError(error: unknown) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    responseHeaders.set('Content-Type', 'text/html');

    return new Response(body, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
