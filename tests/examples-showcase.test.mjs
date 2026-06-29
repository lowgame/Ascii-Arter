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

const DEMOS = [
  {
    "slug": "pulseboard",
    "name": "PulseBoard",
    "title": "PulseBoard — Product signals without dashboard chaos",
    "heroText": "See product signals before churn shows up."
  },
  {
    "slug": "vaultflow",
    "name": "Vaultflow",
    "title": "Vaultflow — Treasury automation for lean finance teams",
    "heroText": "Move cash with less dashboard debt."
  },
  {
    "slug": "chromawave",
    "name": "Chromawave",
    "title": "Chromawave — Colorful wave launch page",
    "heroText": "Let color do the first sell."
  },
  {
    "slug": "orbitdeck",
    "name": "OrbitDeck",
    "title": "OrbitDeck — Floating product cards on ASCII ribbons",
    "heroText": "Show the product before the dashboard cliché."
  },
  {
    "slug": "midnightsilk",
    "name": "MidnightSilk",
    "title": "MidnightSilk — Cinematic full-background launch page",
    "heroText": "Let the backdrop carry the tension."
  },
  {
    "slug": "opalgrid",
    "name": "OpalGrid",
    "title": "OpalGrid — Soft white editorial grid with full-page motion",
    "heroText": "Minimal copy. Full-frame atmosphere."
  },
  {
    "slug": "auricnoir",
    "name": "AuricNoir",
    "title": "AuricNoir — Luxury black-and-gold full-background hero",
    "heroText": "A quiet hero that still feels expensive."
  },
  {
    "slug": "seaglass",
    "name": "SeaGlass",
    "title": "SeaGlass — Frosted ocean landing page with full-screen ASCII tide",
    "heroText": "Keep the UI light and let the tide move."
  },
  {
    "slug": "neonveil",
    "name": "NeonVeil",
    "title": "NeonVeil — Minimal poster-style glow background",
    "heroText": "Glow in the background, not the buttons."
  },
  {
    "slug": "papermoon",
    "name": "PaperMoon",
    "title": "PaperMoon — Airy editorial landing page on a living canvas",
    "heroText": "The page stays clean while the field breathes."
  },
  {
    "slug": "embermono",
    "name": "EmberMono",
    "title": "EmberMono — Warm monochrome launch page with ember drift",
    "heroText": "Soft heat, almost no chrome."
  },
  {
    "slug": "fjordmist",
    "name": "FjordMist",
    "title": "FjordMist — Nordic mist product page with full-bleed motion",
    "heroText": "Cold, calm, and deliberately sparse."
  },
  {
    "slug": "signalzero",
    "name": "SignalZero",
    "title": "SignalZero — Minimal monochrome system page with ambient scan",
    "heroText": "Reduce the interface until only the signal remains."
  },
  {
    "slug": "rosezenith",
    "name": "RoseZenith",
    "title": "RoseZenith — Pearl-pink halo page with floating notes",
    "heroText": "A softer full-background look for beauty or fashion brands."
  }
];
const GALLERY_ASSERTIONS = [
  /RelayStack/i,
  /PulseBoard/i,
  /Vaultflow/i,
  /Chromawave/i,
  /OrbitDeck/i,
  /MidnightSilk/i,
  /OpalGrid/i,
  /AuricNoir/i,
  /SeaGlass/i,
  /NeonVeil/i,
  /PaperMoon/i,
  /EmberMono/i,
  /FjordMist/i,
  /SignalZero/i,
  /RoseZenith/i,
  /Apple\-style\ ASCII\ wave\ hero/i,
  /Your\ Company/i,
  /colorful\ wave/i,
  /floating\ product\ cards/i,
  /cinematic\ full\-background\ launch\ page/i,
  /soft\ white\ editorial\ grid/i,
  /black\-and\-gold\ full\-background\ hero/i,
  /full\-screen\ ASCII\ tide/i,
  /poster\-style\ glow\ background/i,
  /living\ canvas/i,
  /ember\ drift/i,
  /full\-bleed\ motion/i,
  /ambient\ scan/i,
  /floating\ notes/i,
];

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
  for (const pattern of GALLERY_ASSERTIONS) assert.match(galleryHtml, pattern);

  for (const asset of [
    'assets/screenshots/relaystack-demo.png',
    'assets/screenshots/pulseboard-demo.png',
    'assets/screenshots/vaultflow-demo.png',
    'assets/screenshots/chromawave-demo.png',
    'assets/screenshots/orbitdeck-demo.png',
    'assets/screenshots/midnightsilk-demo.png',
    'assets/screenshots/opalgrid-demo.png',
    'assets/screenshots/auricnoir-demo.png',
    'assets/screenshots/seaglass-demo.png',
    'assets/screenshots/neonveil-demo.png',
    'assets/screenshots/papermoon-demo.png',
    'assets/screenshots/embermono-demo.png',
    'assets/screenshots/fjordmist-demo.png',
    'assets/screenshots/signalzero-demo.png',
    'assets/screenshots/rosezenith-demo.png',
  ]) {
    assert.equal(existsSync(path.join(rootDir, asset)), true, `${asset} should exist`);
  }
});

test('repo and npm readmes highlight the showcase range from artistic wave heroes to full-background studies', async () => {
  const repoReadme = await readFile(path.join(rootDir, 'README.md'), 'utf8');
  const packageReadme = await readFile(path.join(rootDir, 'lib/README.md'), 'utf8');

  for (const pattern of [
  /Apple\-style\ ASCII\ wave\ hero/i,
  /Your\ Company/i,
  /Chromawave/i,
  /OrbitDeck/i,
  /MidnightSilk/i,
  /OpalGrid/i,
  /AuricNoir/i,
  /SeaGlass/i,
  /NeonVeil/i,
  /PaperMoon/i,
  /EmberMono/i,
  /FjordMist/i,
  /SignalZero/i,
  /RoseZenith/i,
  /full\-background/i,
  /full\-screen/i,
  /full\-bleed/i,
  ]) {
    assert.match(repoReadme, pattern);
    assert.match(packageReadme, pattern);
  }
});

for (const demo of DEMOS) {
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
        await page.waitForTimeout(400);

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
