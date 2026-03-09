import type { HandleDocumentRequestFunction } from '@remix-run/server-runtime';

import { renderDocumentResponse } from './server/renderDocumentResponse';

const handleRequest: HandleDocumentRequestFunction = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext,
  _loadContext,
) =>
  renderDocumentResponse({
    request,
    responseStatusCode,
    responseHeaders,
    remixContext,
  });

export default handleRequest;
