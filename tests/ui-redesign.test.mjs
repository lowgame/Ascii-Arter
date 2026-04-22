import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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
  ];

  for (const candidate of candidates) {
    try {
      if (candidate === 'playwright') {
        return require(candidate);
      }
      if (existsSync(candidate)) {
        return require(candidate);
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('Playwright module could not be resolved for UI smoke tests');
}

const { chromium } = loadPlaywright();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const filePath = path.join(root, relativePath);
        const ext = path.extname(filePath);
        const content = await readFile(filePath);
        res.writeHead(200, { 'content-type': mimeTypes[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });

    server.on('error', reject);
  });
}

let browser;
let server;
let baseUrl;

async function openPage(viewport = { width: 1440, height: 960 }) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('#subjectTextInput');
  return { page, pageErrors };
}

async function isVisible(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden;
  });
}

test.before(async () => {
  ({ server, baseUrl } = await startStaticServer(rootDir));
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('desktop keeps settings and preview visible side by side without page scroll', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });
  await page.waitForTimeout(120);

  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON() || null;
    const styleVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden;
    };

    return {
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      controls: rect('#controlsPanel'),
      layers: rect('#layersPanel'),
      stage: rect('.stage-area'),
      subject: rect('#subjectTextInput'),
      backdropVisible: styleVisible('#settingsBackdrop'),
      settingsToggleVisible: styleVisible('#settingsToggleBtn'),
      inlineSettingsVisible: styleVisible('#openSettingsInlineBtn'),
    };
  });

  assert.ok(metrics.controls, 'controls panel should exist');
  assert.ok(metrics.layers, 'layers panel should exist');
  assert.ok(metrics.stage, 'preview stage should exist');
  assert.ok(metrics.subject, 'subject input should exist');
  assert.ok(metrics.scrollHeight <= metrics.innerHeight + 2, 'desktop layout should fit in one viewport without page scrolling');
  assert.ok(metrics.controls.right < metrics.stage.left, 'controls should stay beside the preview, not above it');
  assert.ok(metrics.layers.right < metrics.stage.left, 'layers panel should stay beside the preview, not below it');
  assert.ok(metrics.stage.top < 220, 'preview should start near the top of the workspace');
  assert.ok(metrics.stage.bottom <= metrics.innerHeight - 16, 'preview should remain fully visible while editing');
  assert.equal(metrics.backdropVisible, false, 'desktop editing should not use a blur backdrop');
  assert.equal(metrics.settingsToggleVisible, false, 'desktop editing should not depend on a settings drawer toggle');
  assert.equal(metrics.inlineSettingsVisible, false, 'desktop editing should not require a second inline settings CTA');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('desktop shows core editing controls immediately', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });
  await page.waitForTimeout(120);

  assert.equal(await isVisible(page, '#controlsPanel'), true, 'scene controls should be visible immediately');
  assert.equal(await isVisible(page, '#layersPanel'), true, 'layer controls should be visible immediately');
  assert.equal(await page.locator('#subjectTextInput').isVisible(), true, 'main text input should be visible immediately');
  assert.equal(await page.locator('#stageCanvas').isVisible(), true, 'preview canvas should be visible immediately');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('typing into the main text field auto-activates text mode and survives randomize', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.fill('#subjectTextInput', 'LOW GAME');
  await page.waitForTimeout(100);

  assert.equal(await page.locator('#activateTextBtn').evaluate((element) => element.classList.contains('active')), true, 'typing should automatically switch subject mode to text');
  assert.equal(await page.locator('#subjectTextInput').evaluate((element) => element.classList.contains('active-subject')), true, 'text input should be visibly active after typing');

  await page.click('#randomizeBtn');
  await page.waitForTimeout(100);

  assert.equal(await page.locator('#subjectTextInput').inputValue(), 'LOW GAME', 'randomize should not wipe the main text');
  assert.equal(await page.locator('#activateTextBtn').evaluate((element) => element.classList.contains('active')), true, 'text mode should stay active after randomize');
  assert.deepEqual(pageErrors, []);

  await page.close();
});
