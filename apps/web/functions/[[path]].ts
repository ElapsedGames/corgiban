import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';

// @ts-expect-error Remix generates the server build during `pnpm -C apps/web build`.
import * as build from '../build/server';

export const onRequest = createPagesFunctionHandler({
  build,
  mode: process.env.NODE_ENV,
});
