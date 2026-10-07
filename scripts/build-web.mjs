// Bundle the browser code and copy static files into dist/web.
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const out = 'dist/web';
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ['src/web/main.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  outfile: `${out}/app.js`,
  logLevel: 'warning',
});
cpSync('src/web/index.html', `${out}/index.html`);
cpSync('src/web/styles.css', `${out}/styles.css`);
cpSync('public', out, { recursive: true });
console.log(`built ${out}`);
