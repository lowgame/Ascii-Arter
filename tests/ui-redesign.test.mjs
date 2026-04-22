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

async function topElementInsideDrawer(page) {
  return page.evaluate(() => {
    const drawer = document.getElementById('settingsDrawer');
    if (!drawer) return null;
    const rect = drawer.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 4, Math.max(4, rect.left + Math.min(rect.width * 0.5, 48)));
    const y = Math.min(window.innerHeight - 4, Math.max(4, rect.top + Math.min(rect.height * 0.25, 120)));
    const top = document.elementFromPoint(x, y);
    return top ? {
      id: top.id,
      className: top.className,
      tagName: top.tagName,
      insideDrawer: Boolean(top.closest('#settingsDrawer')),
    } : null;
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

test('desktop starts in a brutally simple mode with settings closed', async () => {
  const { page, pageErrors } = await openPage();
  await page.waitForTimeout(100);

  assert.equal(await page.locator('#settingsToggleBtn').count(), 1, 'single settings toggle should exist');
  assert.equal(await page.locator('#appShell').evaluate((element) => element.classList.contains('settings-open')), false, 'settings should be closed by default');
  assert.equal(await isVisible(page, '#controlsPanel'), false, 'global controls panel should be hidden by default');
  assert.equal(await isVisible(page, '#layersPanel'), false, 'layers panel should be hidden by default');
  assert.equal(await isVisible(page, '#controlsTab'), false, 'legacy controls tab should not be exposed');
  assert.equal(await isVisible(page, '#layersTab'), false, 'legacy layers tab should not be exposed');
  assert.equal(await page.locator('#subjectTextInput').isVisible(), true, 'main text input should stay visible');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('settings toggle opens the advanced drawer without breaking legacy panels', async () => {
  const { page, pageErrors } = await openPage();

  await page.click('#settingsToggleBtn');
  await page.waitForTimeout(150);

  assert.equal(await page.locator('#appShell').evaluate((element) => element.classList.contains('settings-open')), true, 'settings shell should open after clicking the toggle');
  assert.equal(await isVisible(page, '#controlsPanel'), true, 'controls panel should become visible inside settings shell');
  assert.equal(await isVisible(page, '#layersPanel'), true, 'layers panel should become visible inside settings shell');
  assert.equal(await page.locator('#settingsToggleBtn').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#settingsToggleBtn').innerText(), /gizle|hide/i);
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('settings drawer stays above the blur backdrop so its contents remain visible and clickable', async () => {
  const { page, pageErrors } = await openPage({ width: 390, height: 844 });

  await page.click('#settingsToggleBtn');
  await page.waitForTimeout(150);

  const topElement = await topElementInsideDrawer(page);
  assert.ok(topElement, 'should find a hit-tested element inside the drawer');
  assert.notEqual(topElement.id, 'settingsBackdrop', 'blur backdrop must not sit above the drawer');
  assert.equal(topElement.insideDrawer, true, 'hit-tested content inside the drawer should belong to the drawer itself');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('typing into the main text field auto-activates text mode and survives randomize', async () => {
  const { page, pageErrors } = await openPage();

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
