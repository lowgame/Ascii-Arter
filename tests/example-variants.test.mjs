import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
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

  throw new Error('Playwright module could not be resolved for example variant tests');
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

test('PulseBoard uses a dark dashboard-style showcase layout distinct from the other demos', async () => {
  let browser;
  try {
    await withStaticServer(async (port) => {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
      await page.goto(`http://127.0.0.1:${port}/examples/pulseboard/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
      const info = await page.evaluate(() => ({
        variant: document.body.dataset.demoVariant,
        hasDashboardShell: !!document.querySelector('.dashboard-shell'),
        hasBentoGrid: !!document.querySelector('.bento-grid'),
        hasSignalFeed: !!document.querySelector('.signal-feed'),
        hasLedgerStrip: !!document.querySelector('.ledger-strip'),
      }));

      assert.equal(info.variant, 'linear-dark-dashboard');
      assert.equal(info.hasDashboardShell, true);
      assert.equal(info.hasBentoGrid, true);
      assert.equal(info.hasSignalFeed, true);
      assert.equal(info.hasLedgerStrip, false);
    });
  } finally {
    if (browser) await browser.close();
  }
});

test('Vaultflow uses a light fintech/editorial layout distinct from the dashboard demo', async () => {
  let browser;
  try {
    await withStaticServer(async (port) => {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
      await page.goto(`http://127.0.0.1:${port}/examples/vaultflow/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
      const info = await page.evaluate(() => ({
        variant: document.body.dataset.demoVariant,
        hasFintechHero: !!document.querySelector('.fintech-hero'),
        hasLedgerStrip: !!document.querySelector('.ledger-strip'),
        hasPricingStack: !!document.querySelector('.pricing-stack'),
        hasDashboardShell: !!document.querySelector('.dashboard-shell'),
      }));

      assert.equal(info.variant, 'stripe-light-fintech');
      assert.equal(info.hasFintechHero, true);
      assert.equal(info.hasLedgerStrip, true);
      assert.equal(info.hasPricingStack, true);
      assert.equal(info.hasDashboardShell, false);
    });
  } finally {
    if (browser) await browser.close();
  }
});
