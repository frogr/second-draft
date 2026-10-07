// Take UI screenshots with Playwright against the production build.
// Usage: npm run build && npm run screenshots (runs with tsx)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { SAMPLES } from '../src/web/samples.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const PORT = 3217;
const BASE = `http://localhost:${PORT}`;
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

// start without any API key so the screenshots show the default demo mode
const env = { ...process.env, PORT: String(PORT), ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' };
const server = spawn('node', ['dist/server/index.js'], { env, stdio: 'inherit' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function coach(page: Page) {
  await page.click('#run');
  await page.waitForSelector('#review:not([hidden])');
  await page.waitForSelector('.fix-card');
}

try {
  await waitForServer();
  const browser = await chromium.launch();

  // desktop
  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desk.goto(BASE);
  await desk.waitForSelector('.chip');
  await desk.screenshot({ path: `${OUT}/01-empty-desk.png` });

  await desk.click('#sample-fiction');
  await desk.screenshot({ path: `${OUT}/02-fiction-draft.png` });
  await coach(desk);
  await desk.screenshot({ path: `${OUT}/03-coached.png` });

  await desk.locator('#rendered .seg.hl').nth(3).click();
  await desk.waitForSelector('#inspector:not([hidden])');
  await desk.screenshot({ path: `${OUT}/04-inspector.png` });
  await desk.keyboard.press('Escape');

  // second draft: the revised text, coached again, so progress has two drafts
  await desk.click('#revise');
  await desk.fill('#draft', SAMPLES.fictionRevised.text);
  await coach(desk);
  await desk.screenshot({ path: `${OUT}/05-second-draft.png` });
  await desk.locator('#metrics').scrollIntoViewIfNeeded();
  await desk.evaluate(() => document.querySelector('.panel')?.scrollIntoView({ block: 'start' }));
  await desk.screenshot({ path: `${OUT}/06-progress-metrics.png` });

  // cover letter with the "sounds like me" goal
  await desk.click('#revise');
  await desk.click('#sample-cover');
  await coach(desk);
  await desk.evaluate(() => window.scrollTo(0, 0));
  await desk.screenshot({ path: `${OUT}/07-cover-letter.png` });

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await phone.goto(BASE);
  await phone.waitForSelector('.chip');
  await phone.click('#sample-fiction');
  await coach(phone);
  await phone.evaluate(() => document.querySelector('#fixes')?.scrollIntoView({ block: 'start' }));
  await phone.screenshot({ path: `${OUT}/08-phone.png` });

  await browser.close();
  console.log(`screenshots saved to ${OUT}`);
} finally {
  stop();
}
