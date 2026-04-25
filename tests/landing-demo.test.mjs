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

  throw new Error('Playwright module could not be resolved for landing demo tests');
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

test('landing demo server blocks path traversal outside the repo root', () => {
  assert.throws(() => resolveRequestPath(rootDir, '/..%2f..%2fetc/passwd'), /Path traversal/);
  assert.match(resolveRequestPath(rootDir, '/examples/relaystack/hero.json'), /examples\/relaystack\/hero\.json$/);
});

test('relaystack landing demo mounts ascii-arter backgrounds without console errors', async () => {
  let browser;
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

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/examples/relaystack/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
    await page.waitForTimeout(700);

    const info = await page.evaluate(() => ({
      title: document.title,
      variant: document.body.dataset.demoVariant,
      heroCanvas: !!document.querySelector('#heroBg canvas'),
      ctaCanvas: !!document.querySelector('#ctaBg canvas'),
      heroText: document.querySelector('h1')?.textContent?.trim(),
      hasAppleHero: !!document.querySelector('.apple-hero'),
      hasWaveStage: !!document.querySelector('.wave-stage'),
      hasOrb: !!document.querySelector('.hero-orb'),
      hasWindowInstances: !!window.__relayDemo?.hero && !!window.__relayDemo?.cta,
      methods: {
        heroPlay: typeof window.__relayDemo?.hero?.play,
        heroPause: typeof window.__relayDemo?.hero?.pause,
        ctaDestroy: typeof window.__relayDemo?.cta?.destroy,
      }
    }));

    assert.equal(info.title, 'RelayStack — Apple-style ASCII wave hero');
    assert.equal(info.variant, 'apple-minimal-wave');
    assert.equal(info.heroCanvas, true);
    assert.equal(info.ctaCanvas, true);
    assert.equal(info.hasWindowInstances, true);
    assert.equal(info.heroText, 'Your Company');
    assert.equal(info.hasAppleHero, true);
    assert.equal(info.hasWaveStage, true);
    assert.equal(info.hasOrb, true);
    assert.deepEqual(info.methods, {
      heroPlay: 'function',
      heroPause: 'function',
      ctaDestroy: 'function',
    });
    assert.deepEqual(pageErrors, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(path.join(rootDir, 'playwright-report'), { recursive: true, force: true });
  }
});
