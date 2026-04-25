import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(process.cwd());
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [
    'playwright',
    path.resolve(rootDir, 'node_modules/playwright'),
    path.resolve(rootDir, '../node_modules/playwright'),
    path.resolve(rootDir, '../../node_modules/playwright'),
    path.resolve(rootDir, '../../../node_modules/playwright'),
    path.resolve(rootDir, '../../../../node_modules/playwright'),
    path.resolve(rootDir, '../../../../../hermes-agent/node_modules/playwright'),
    path.resolve(here, '../../../../../hermes-agent/node_modules/playwright'),
    '/root/.hermes/hermes-agent/node_modules/playwright',
  ];

  for (const candidate of candidates) {
    try {
      if (candidate === 'playwright') return require(candidate);
      if (existsSync(candidate)) return require(candidate);
    } catch {
      // continue
    }
  }

  throw new Error('Playwright module could not be resolved for showcase tests');
}

const { chromium } = loadPlaywright();

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.cjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
  }[ext] || 'application/octet-stream';
}

function resolveRequestPath(rootDir, requestUrl) {
  const url = new URL(requestUrl || '/', 'http://127.0.0.1');
  let relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  if (relativePath.endsWith('/')) relativePath += 'index.html';
  if (!path.extname(relativePath)) relativePath = path.join(relativePath, 'index.html');

  const repoRoot = path.resolve(rootDir);
  const filePath = path.resolve(repoRoot, relativePath);
  const relativeToRoot = path.relative(repoRoot, filePath);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Path traversal blocked: ${requestUrl}`);
  }
  return filePath;
}

async function withStaticServer(run) {
  let server;
  try {
    server = http.createServer(async (req, res) => {
      try {
        const filePath = resolveRequestPath(rootDir, req.url || '/');
        const content = await readFile(filePath);
        res.writeHead(200, { 'content-type': contentType(filePath) });
        res.end(content);
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
    });
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve);
      server.on('error', reject);
    });
    const port = server.address().port;
    await run(port);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
  }
}

test('examples gallery lists all showcase demos and screenshot assets exist', async () => {
  const galleryHtml = await readFile(path.join(rootDir, 'examples/index.html'), 'utf8');
  assert.match(galleryHtml, /RelayStack/);
  assert.match(galleryHtml, /PulseBoard/);
  assert.match(galleryHtml, /Vaultflow/);

  for (const asset of [
    'assets/screenshots/relaystack-demo.png',
    'assets/screenshots/pulseboard-demo.png',
    'assets/screenshots/vaultflow-demo.png',
  ]) {
    assert.equal(existsSync(path.join(rootDir, asset)), true, `${asset} should exist`);
  }
});

for (const demo of [
  {
    slug: 'pulseboard',
    title: 'PulseBoard — Product signals without dashboard chaos',
    heroText: 'See product signals before churn shows up.',
  },
  {
    slug: 'vaultflow',
    title: 'Vaultflow — Treasury automation for lean finance teams',
    heroText: 'Move cash with less dashboard debt.',
  },
]) {
  test(`${demo.slug} demo mounts ascii-arter backgrounds without console errors`, async () => {
    let browser;
    try {
      await withStaticServer(async (port) => {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (msg) => {
          if (msg.type() === 'error') pageErrors.push(msg.text());
        });

        await page.goto(`http://127.0.0.1:${port}/examples/${demo.slug}/`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
        await page.waitForTimeout(700);

        const info = await page.evaluate(() => ({
          title: document.title,
          heroCanvas: !!document.querySelector('#heroBg canvas'),
          ctaCanvas: !!document.querySelector('#ctaBg canvas'),
          heroText: document.querySelector('h1')?.textContent?.trim(),
          hasWindowInstances: !!window.__demoInstances?.hero && !!window.__demoInstances?.cta,
        }));

        assert.equal(info.title, demo.title);
        assert.equal(info.heroCanvas, true);
        assert.equal(info.ctaCanvas, true);
        assert.equal(info.hasWindowInstances, true);
        assert.equal(info.heroText, demo.heroText);
        assert.deepEqual(pageErrors, []);
      });
    } finally {
      if (browser) await browser.close();
      await rm(path.join(rootDir, 'playwright-report'), { recursive: true, force: true });
    }
  });
}
