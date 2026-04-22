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
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
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
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#subjectTextInput', { timeout: 15000 });
  return { page, pageErrors };
}

async function isVisible(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden;
  });
}

async function topElementInside(page, selector, xRatio = 0.3, yRatio = 0.3) {
  return page.evaluate(({ selector, xRatio, yRatio }) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 4, Math.max(4, rect.left + rect.width * xRatio));
    const y = Math.min(window.innerHeight - 4, Math.max(4, rect.top + rect.height * yRatio));
    const top = document.elementFromPoint(x, y);
    return top ? {
      id: top.id,
      className: top.className,
      inside: Boolean(top.closest(selector)),
      tagName: top.tagName,
    } : null;
  }, { selector, xRatio, yRatio });
}

async function readComboState(page) {
  return page.evaluate(() => {
    const value = (selector) => document.querySelector(selector)?.value ?? null;
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const randomizeBtn = document.querySelector('#randomizeBtn');
    return {
      randomizeLabel: text('#randomizeBtn'),
      randomizeProfile: randomizeBtn?.dataset.randomizeProfile ?? null,
      status: text('#statusStat'),
      subject: {
        fontWeight: value('#subjectFontWeight'),
        bgIntensity: value('#subjectBgIntensity'),
        padding: value('#subjectPadding'),
      },
      scene: {
        palette: document.querySelector('[data-control-key="palette"]')?.value ?? null,
        charSet: document.querySelector('[data-control-key="charSet"]')?.value ?? null,
        seed: document.querySelector('[data-control-key="seed"]')?.value ?? null,
      },
    };
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
    return {
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      editorRail: rect('.editor-rail'),
      stage: rect('.stage-area'),
      subject: rect('#subjectTextInput'),
    };
  });

  assert.ok(metrics.editorRail, 'editor rail should exist');
  assert.ok(metrics.stage, 'preview stage should exist');
  assert.ok(metrics.subject, 'subject input should exist');
  assert.ok(metrics.scrollHeight <= metrics.innerHeight + 2, 'desktop layout should fit in one viewport without page scrolling');
  assert.ok(metrics.editorRail.right < metrics.stage.left, 'left rail should stay beside the preview');
  assert.ok(metrics.stage.top < 220, 'preview should start near the top of the workspace');
  assert.ok(metrics.stage.bottom <= metrics.innerHeight - 16, 'preview should remain fully visible while editing');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('left rail behaves like a single-open accordion and contains presets', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });
  await page.waitForTimeout(120);

  for (const key of ['subject', 'presets', 'controls', 'layers']) {
    assert.equal(await page.locator(`[data-accordion-trigger="${key}"]`).count(), 1, `${key} accordion trigger should exist`);
  }

  assert.equal(await isVisible(page, '#subjectAccordionBody'), true, 'subject panel should be open by default');
  assert.equal(await isVisible(page, '#presetsAccordionBody'), false, 'presets panel should be closed by default');
  assert.equal(await isVisible(page, '#controlsAccordionBody'), false, 'controls panel should be closed by default');
  assert.equal(await isVisible(page, '#layersAccordionBody'), false, 'layers panel should be closed by default');

  await page.click('[data-accordion-trigger="presets"]');
  await page.waitForTimeout(120);
  assert.equal(await isVisible(page, '#subjectAccordionBody'), false, 'opening presets should close subject');
  assert.equal(await isVisible(page, '#presetsAccordionBody'), true, 'presets should open after clicking its header');
  assert.equal(await page.locator('#presetSelect').isVisible(), true, 'preset selector should live inside the presets accordion');
  assert.equal(await page.locator('#presetsGalleryBtn').isVisible(), true, 'preset gallery button should live inside the presets accordion');

  await page.click('[data-accordion-trigger="controls"]');
  await page.waitForTimeout(120);
  assert.equal(await isVisible(page, '#presetsAccordionBody'), false, 'opening controls should close presets');
  assert.equal(await isVisible(page, '#controlsAccordionBody'), true, 'controls should open after clicking its header');
  assert.equal(await isVisible(page, '#layersAccordionBody'), false, 'opening controls should keep layers closed');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('selecting a preset keeps typed subject text alive and themed', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.fill('#subjectTextInput', 'LOW GAME');
  await page.click('[data-accordion-trigger="presets"]');
  await page.waitForTimeout(120);
  await page.selectOption('#presetSelect', 'builtin:matrix-cathedral');
  await page.waitForTimeout(160);

  assert.equal(await page.locator('#subjectTextInput').inputValue(), 'LOW GAME', 'preset changes should not wipe the main subject text');
  assert.equal(await page.locator('#activateTextBtn').evaluate((element) => element.classList.contains('active')), true, 'text mode should stay active after preset changes');
  assert.equal(await page.locator('#subjectTextInput').evaluate((element) => element.classList.contains('active-subject')), true, 'text input should stay visually active after preset changes');
  assert.equal(await page.locator('#subjectTextInput').evaluate((element) => element.value.length > 0), true, 'subject text should still exist after loading a preset');
  assert.equal(await page.locator('#subjectFontWeight').inputValue(), '900', 'preset selection should push subject styling toward the preset look');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('randomize without subject only changes the background scene', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.click('[data-accordion-trigger="controls"]');
  await page.waitForTimeout(120);
  const before = await readComboState(page);

  await page.click('#randomizeBtn');
  await page.waitForTimeout(160);
  const after = await readComboState(page);

  assert.equal(await page.locator('#subjectTextInput').inputValue(), '', 'empty subject should stay empty after randomize');
  assert.equal(before.subject.fontWeight, after.subject.fontWeight, 'no subject means text styling should not be remixed');
  assert.equal(before.subject.bgIntensity, after.subject.bgIntensity, 'no subject means subject background intensity should stay put');
  assert.equal(before.subject.padding, after.subject.padding, 'no subject means subject padding should stay put');
  assert.equal(after.randomizeLabel, 'BG Randomize', 'empty state should expose background-only randomize intent');
  assert.ok(after.randomizeProfile, 'background randomize should expose a curated profile tag');
  assert.notEqual(after.status, before.status, 'background randomize should announce a new mood/status');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('randomize with subject creates a fresh text plus background combo', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.fill('#subjectTextInput', 'LOW GAME');
  await page.waitForTimeout(80);
  await page.click('[data-accordion-trigger="controls"]');
  await page.waitForTimeout(120);
  const before = await readComboState(page);

  await page.click('#randomizeBtn');
  await page.waitForTimeout(180);
  const after = await readComboState(page);

  assert.equal(await page.locator('#subjectTextInput').inputValue(), 'LOW GAME', 'randomize should still preserve the typed subject');
  assert.equal(await page.locator('#activateTextBtn').evaluate((element) => element.classList.contains('active')), true, 'typed subject should remain in text mode after randomize');
  assert.equal(after.randomizeLabel, 'Combo Randomize', 'subject-present state should expose combo randomize intent');
  assert.ok(after.randomizeProfile, 'combo randomize should expose a curated profile tag');
  assert.notEqual(after.status, before.status, 'combo randomize should announce the selected mood');
  assert.equal(before.subject.fontWeight === after.subject.fontWeight && before.subject.bgIntensity === after.subject.bgIntensity && before.subject.padding === after.subject.padding, false, 'subject styling should remix when a subject exists');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('combo randomize keeps svg active when svg subject is the current mode', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.fill('#subjectTextInput', 'LOW GAME');
  await page.click('#activateSvgBtn');
  await page.fill('#subjectSvgInput', '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="10" fill="white"/></svg>');
  await page.waitForTimeout(100);

  const before = await page.evaluate(() => ({
    type: document.querySelector('#activateSvgBtn')?.classList.contains('active') ? 'svg' : 'text',
    svg: document.querySelector('#subjectSvgInput')?.value || '',
    text: document.querySelector('#subjectTextInput')?.value || '',
  }));

  await page.click('#randomizeBtn');
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({
    type: document.querySelector('#activateSvgBtn')?.classList.contains('active') ? 'svg' : 'text',
    svg: document.querySelector('#subjectSvgInput')?.value || '',
    text: document.querySelector('#subjectTextInput')?.value || '',
    svgVisible: !document.querySelector('#subjectSvgArea')?.hidden,
    textVisible: !document.querySelector('#subjectTextArea')?.hidden,
  }));

  assert.equal(before.type, 'svg', 'setup should switch subject mode to svg');
  assert.equal(after.type, 'svg', 'combo randomize should keep the active svg mode instead of forcing text');
  assert.equal(after.svgVisible, true, 'svg panel should stay visible after combo randomize');
  assert.equal(after.textVisible, false, 'text panel should stay hidden while svg mode is active');
  assert.equal(after.svg, before.svg, 'svg content should be preserved during combo randomize');
  assert.equal(after.text, before.text, 'background randomization should not wipe the text field either');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('main randomize cycles through different curated moods across repeated clicks', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.fill('#subjectTextInput', 'LOW GAME');
  await page.waitForTimeout(80);

  const profiles = new Set();
  const statuses = new Set();
  for (let i = 0; i < 6; i += 1) {
    await page.click('#randomizeBtn');
    await page.waitForTimeout(180);
    const state = await readComboState(page);
    profiles.add(state.randomizeProfile);
    statuses.add(state.status);
  }

  assert.ok(profiles.size >= 3, 'main randomize should surface several distinct curated mood profiles');
  assert.ok(statuses.size >= 3, 'main randomize should produce clearly different mood labels');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('stage background animation fills the preview div instead of behaving like a fixed backdrop', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });
  await page.waitForTimeout(140);

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector('.stage-area');
    const bgCanvas = document.getElementById('bgCanvas');
    const stageRect = stage?.getBoundingClientRect();
    const bgRect = bgCanvas?.getBoundingClientRect();
    return {
      stageRect: stageRect ? { width: stageRect.width, height: stageRect.height, left: stageRect.left, top: stageRect.top } : null,
      bgRect: bgRect ? { width: bgRect.width, height: bgRect.height, left: bgRect.left, top: bgRect.top } : null,
      position: bgCanvas ? getComputedStyle(bgCanvas).position : null,
      inset: bgCanvas ? getComputedStyle(bgCanvas).inset : null,
    };
  });

  assert.ok(metrics.stageRect, 'stage rect should exist');
  assert.ok(metrics.bgRect, 'background canvas rect should exist');
  assert.equal(metrics.position, 'absolute', 'background canvas should stay inside the preview stage');
  assert.equal(metrics.inset, '0px', 'background canvas should be anchored to the stage edges');
  assert.ok(Math.abs(metrics.stageRect.width - metrics.bgRect.width) < 1, 'background canvas width should match the preview div');
  assert.ok(Math.abs(metrics.stageRect.height - metrics.bgRect.height) < 1, 'background canvas height should match the preview div');
  assert.ok(Math.abs(metrics.stageRect.left - metrics.bgRect.left) < 1, 'background canvas should align to the left edge of the preview div');
  assert.ok(Math.abs(metrics.stageRect.top - metrics.bgRect.top) < 1, 'background canvas should align to the top edge of the preview div');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('stage uses the ASCII background itself without a separate static backdrop', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });
  await page.waitForTimeout(120);

  const visuals = await page.evaluate(() => {
    const stage = document.querySelector('.stage-area');
    const bgCanvas = document.getElementById('bgCanvas');
    const stageStyle = window.getComputedStyle(stage);
    const bgStyle = window.getComputedStyle(bgCanvas);
    return {
      stageBackgroundImage: stageStyle.backgroundImage,
      stageBackgroundColor: stageStyle.backgroundColor,
      bgCanvasPosition: bgStyle.position,
      bgCanvasInset: bgStyle.inset,
      bgCanvasOpacity: bgStyle.opacity,
    };
  });

  assert.equal(visuals.stageBackgroundImage, 'none', 'stage area should not add a separate static gradient behind the ASCII background');
  assert.equal(visuals.stageBackgroundColor, 'rgba(0, 0, 0, 0)', 'stage area should not paint a flat fallback background');
  assert.equal(visuals.bgCanvasPosition, 'absolute', 'ASCII background should be rendered by the dedicated canvas layer');
  assert.equal(visuals.bgCanvasInset, '0px', 'ASCII background canvas should fill the game area exactly');
  assert.notEqual(visuals.bgCanvasOpacity, '0', 'ASCII background canvas should remain visible');
  assert.deepEqual(pageErrors, []);

  await page.close();
});

test('export menu opens above the game area instead of behind it', async () => {
  const { page, pageErrors } = await openPage({ width: 1440, height: 960 });

  await page.click('#exportMenuBtn');
  await page.waitForTimeout(120);

  const topElement = await topElementInside(page, '#exportDropdown', 0.8, 0.55);
  assert.ok(topElement, 'should find a hit-tested element inside the export dropdown');
  assert.equal(topElement.inside, true, 'export dropdown should sit above the stage and receive pointer hits');
  assert.deepEqual(pageErrors, []);

  await page.close();
});
