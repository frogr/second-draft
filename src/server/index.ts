import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Context } from 'hono';
import { createApp } from './app.js';

const app = createApp({
  env: process.env,
  remoteAddr: (c) => {
    try {
      return getConnInfo(c as Context).remote.address;
    } catch {
      return undefined;
    }
  },
});

const root = process.env.WEB_DIR ?? './dist/web';
app.use('/*', serveStatic({ root }));
app.get('/', serveStatic({ path: `${root}/index.html` }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  const mode = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ? 'model mode available' : 'deterministic mode (no API key)';
  console.log(`Second Draft on http://localhost:${info.port} (${mode})`);
});
