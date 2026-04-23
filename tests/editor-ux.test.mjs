import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

  throw new Error('Playwright module could not be resolved for UI tests');
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

async function openPage(viewport = { width: 1440, height: 1024 }) {
  const page = await browser.newPage({ viewport });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });
  await page.goto(baseUrl, { waitUntil: 'load' });
  await page.waitForSelector('#subjectTextInput');
  return { page, pageErrors };
}

test.before(async () => {
  ({ server, baseUrl } = await startStaticServer(rootDir));
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('subject text helpers support configurable spacing and three font families', async () => {
  const helpersUrl = pathToFileURL(path.join(rootDir, 'js/core/subject-text.js')).href;
  const {
    applySubjectLetterSpacing,
    SUBJECT_FONT_FAMILY_OPTIONS,
    buildSubjectCanvasFont,
    getSubjectFontStack,
  } = await import(helpersUrl);

  assert.equal(applySubjectLetterSpacing('AB', 0), 'AB');
  assert.equal(applySubjectLetterSpacing('AB', 2), 'A  B');
  assert.equal(applySubjectLetterSpacing('A B', 1), 'A   B');
  assert.equal(SUBJECT_FONT_FAMILY_OPTIONS.length, 3);
  assert.deepEqual(
    [...new Set(SUBJECT_FONT_FAMILY_OPTIONS.map((option) => option.value))],
    SUBJECT_FONT_FAMILY_OPTIONS.map((option) => option.value),
  );

  const familyKey = SUBJECT_FONT_FAMILY_OPTIONS[1].value;
  assert.equal(getSubjectFontStack(familyKey), SUBJECT_FONT_FAMILY_OPTIONS[1].stack);
  assert.equal(
    buildSubjectCanvasFont({ weight: '900', size: 18, familyKey }),
    `900 18px ${SUBJECT_FONT_FAMILY_OPTIONS[1].stack}`,
  );
});

test('editor exposes subject spacing, three-font selection, and fullscreen controls', async () => {
  const { page, pageErrors } = await openPage();

  assert.equal(await page.locator('#subjectLetterSpacing').count(), 1, 'subject spacing control should exist');
  assert.equal(await page.locator('#subjectFontFamily').count(), 1, 'subject font family control should exist');
  assert.equal(await page.locator('#subjectFontFamily option').count(), 3, 'exactly three font options should exist');
  assert.equal(await page.locator('#fullscreenBtn').count(), 1, 'fullscreen button should exist');

  await page.fill('#subjectTextInput', 'LOW');
  await page.locator('#subjectLetterSpacing').fill('3');
  await page.selectOption('#subjectFontFamily', { index: 2 });

  assert.equal(await page.locator('#subjectLetterSpacing').inputValue(), '3');
  assert.ok((await page.locator('#subjectFontFamily').inputValue()).length > 0);
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('layers panel content becomes scrollable when many animation layers exist', async () => {
  const { page, pageErrors } = await openPage();

  await page.click('[data-accordion-trigger="layers"]');
  await page.evaluate(() => {
    for (let i = 0; i < 24; i += 1) {
      document.querySelector('#addLayerBtn')?.click();
    }
  });

  const scrollInfo = await page.evaluate(() => {
    const scroller = document.querySelector('[data-scroll-panel="layers-animation"]');
    if (!scroller) {
      return { exists: false };
    }
    scroller.scrollTop = 260;
    return {
      exists: true,
      scrollTop: scroller.scrollTop,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      overflowY: getComputedStyle(scroller).overflowY,
    };
  });

  assert.equal(scrollInfo.exists, true, 'layers animation section should have a dedicated scroll container');
  assert.match(scrollInfo.overflowY, /auto|scroll/);
  assert.ok(scrollInfo.scrollHeight > scrollInfo.clientHeight, 'scroll container should actually overflow with many layers');
  assert.ok(scrollInfo.scrollTop > 0, 'scrollTop should change when scrolling the layers container');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('fullscreen button uses the real Fullscreen API for the preview area', async () => {
  const { page, pageErrors } = await openPage();

  await page.click('#fullscreenBtn');
  await page.waitForFunction(() => Boolean(document.fullscreenElement));

  const entered = await page.evaluate(() => ({
    hasFullscreenElement: Boolean(document.fullscreenElement),
    fullscreenId: document.fullscreenElement?.id || null,
    fullscreenClass: document.fullscreenElement?.className || '',
  }));

  assert.equal(entered.hasFullscreenElement, true, 'clicking fullscreen should call requestFullscreen');
  assert.ok(
    entered.fullscreenId === 'previewCard' || entered.fullscreenClass.includes('preview-card') || entered.fullscreenClass.includes('stage-area'),
    'fullscreen should target the live preview area',
  );

  await page.click('#fullscreenBtn');
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.evaluate(() => Boolean(document.fullscreenElement)), false, 'clicking again should exit fullscreen');
  assert.deepEqual(pageErrors, []);

  await page.close();
});
