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
      if (candidate === 'playwright') return require(candidate);
      if (existsSync(candidate)) return require(candidate);
    } catch {
      // next
    }
  }

  throw new Error('Playwright module could not be resolved for JSON workflow tests');
}

const { chromium } = loadPlaywright();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
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
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
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

test('JSON exporter strips transient runtime fields and parser accepts string/object inputs', async () => {
  const exportersUrl = pathToFileURL(path.join(rootDir, 'js/core/exporters.js')).href;
  const { exportProjectJSON, parseProjectJSONInput } = await import(exportersUrl);

  const project = {
    projectName: 'Roundtrip Test',
    layers: [{ id: 'layer-1', enabled: true }],
    svgLayers: [{ id: 'svg-1', svgContent: '<svg></svg>', _rasterDirty: true, _rasterCache: { foo: 'bar' } }],
    subject: { type: 'text', text: 'HELLO' },
  };

  const json = exportProjectJSON(project);
  assert.equal(json.includes('_rasterDirty'), false, 'exported JSON should not leak transient raster flags');
  assert.equal(json.includes('_rasterCache'), false, 'exported JSON should not leak runtime caches');

  const parsedFromString = await parseProjectJSONInput(json);
  assert.equal(parsedFromString.projectName, 'Roundtrip Test');
  assert.equal(parsedFromString.svgLayers[0]._rasterDirty, undefined);

  const parsedFromObject = await parseProjectJSONInput(project);
  assert.equal(parsedFromObject.projectName, 'Roundtrip Test');
  assert.equal(parsedFromObject.svgLayers[0]._rasterCache, undefined);
});

test('JSON Test flow exists in the app and can apply pasted JSON back into the editor', async () => {
  const { page, pageErrors } = await openPage();

  assert.equal(await page.locator('#jsonTestBtn').count(), 1, 'topbar JSON Test button should exist');
  await page.click('#jsonTestBtn');
  await page.waitForSelector('#embedModal:not([hidden])');

  assert.equal(await page.locator('#embedPresetJsonSelect').count(), 1, 'existing JSON selector should exist');
  assert.equal(await page.locator('#embedPasteJsonTextarea').count(), 1, 'editable JSON paste area should exist');
  assert.equal(await page.locator('#embedApplyJsonBtn').count(), 1, 'apply pasted JSON button should exist');
  assert.equal(await page.locator('#embedExportTesterJsonBtn').count(), 1, 'export tested JSON button should exist');

  const currentJson = await page.locator('#embedJsonTextarea').inputValue();
  const nextJson = JSON.stringify({
    ...JSON.parse(currentJson),
    projectName: 'JSON TEST OK',
    subject: {
      ...(JSON.parse(currentJson).subject || {}),
      type: 'text',
      text: 'JSON TEST OK',
    },
  }, null, 2);

  await page.fill('#embedPasteJsonTextarea', nextJson);
  await page.click('#embedApplyJsonBtn');
  await page.waitForTimeout(160);

  assert.equal(await page.locator('#projectTitleLabel').innerText(), 'JSON TEST OK');
  assert.match(await page.locator('#statusStat').innerText(), /Pasted JSON applied|applied/i);
  assert.deepEqual(pageErrors, []);

  await page.close();
});
