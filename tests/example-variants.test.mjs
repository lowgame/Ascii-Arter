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

const FULL_BACKGROUND_DEMOS = [
  {
    "slug": "midnightsilk",
    "label": "MidnightSilk uses a cinematic silk layout with a true full-screen ASCII backdrop",
    "variant": "midnight-silk-stage",
    "trueSelectors": [
      ".silk-hero",
      ".silk-caption-rail",
      ".silk-column"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".hero-surface",
      ".orbital-cluster"
    ]
  },
  {
    "slug": "opalgrid",
    "label": "OpalGrid uses a bright editorial grid with an airy full-page background",
    "variant": "opal-editorial-grid",
    "trueSelectors": [
      ".opal-hero",
      ".opal-grid-panel",
      ".opal-stat-ribbon"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".orbital-cluster",
      ".wave-card-stack"
    ]
  },
  {
    "slug": "auricnoir",
    "label": "AuricNoir uses a luxury noir layout with a gold full-background stage",
    "variant": "auric-noir-stage",
    "trueSelectors": [
      ".auric-hero",
      ".auric-proof-line",
      ".auric-minimal-stack"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".hero-surface",
      ".pricing-stack"
    ]
  },
  {
    "slug": "seaglass",
    "label": "SeaGlass uses a frosted ocean layout with full-screen ambient tide",
    "variant": "sea-glass-frost",
    "trueSelectors": [
      ".sea-hero",
      ".sea-glass-panel",
      ".sea-note-row"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".orbital-cluster",
      ".hero-wordmark"
    ]
  },
  {
    "slug": "neonveil",
    "label": "NeonVeil uses a poster-like glow layout with floating tags over a full background",
    "variant": "neon-veil-poster",
    "trueSelectors": [
      ".veil-hero",
      ".veil-signal-list",
      ".veil-float-tag"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".pricing-stack",
      ".wave-card-stack"
    ]
  },
  {
    "slug": "papermoon",
    "label": "PaperMoon uses a soft editorial composition with a living canvas behind it",
    "variant": "paper-moon-editorial",
    "trueSelectors": [
      ".paper-hero",
      ".paper-column-quote",
      ".paper-index-list"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".orbital-cluster",
      ".hero-surface"
    ]
  },
  {
    "slug": "embermono",
    "label": "EmberMono uses warm monochrome rails over a full-screen ember field",
    "variant": "ember-mono-stage",
    "trueSelectors": [
      ".ember-hero",
      ".ember-stat-rail",
      ".ember-line-card"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".wave-card-stack",
      ".pricing-stack"
    ]
  },
  {
    "slug": "fjordmist",
    "label": "FjordMist uses a sparse nordic strip layout with full-bleed motion",
    "variant": "fjord-mist-atlas",
    "trueSelectors": [
      ".fjord-hero",
      ".fjord-card-strip",
      ".fjord-proof-grid"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".orbital-cluster",
      ".wave-card-stack"
    ]
  },
  {
    "slug": "signalzero",
    "label": "SignalZero uses a stripped system layout with monochrome ambient scan",
    "variant": "signal-zero-system",
    "trueSelectors": [
      ".signal-hero",
      ".signal-terminal-list",
      ".signal-dot-grid"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".pricing-stack",
      ".hero-wordmark"
    ]
  },
  {
    "slug": "rosezenith",
    "label": "RoseZenith uses a pearl pink halo layout with floating notes and a full background",
    "variant": "rose-zenith-halo",
    "trueSelectors": [
      ".rose-hero",
      ".rose-orbit-notes",
      ".rose-copy-block"
    ],
    "falseSelectors": [
      ".dashboard-shell",
      ".orbital-cluster",
      ".hero-surface"
    ]
  }
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

test('RelayStack uses an artistic apple-style wave layout distinct from the other demos', async () => {
  let browser;
  try {
    await withStaticServer(async (port) => {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
      await page.goto(`http://127.0.0.1:${port}/examples/relaystack/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
      const info = await page.evaluate(() => ({
        variant: document.body.dataset.demoVariant,
        hasAppleHero: !!document.querySelector('.apple-hero'),
        hasWaveStage: !!document.querySelector('.wave-stage'),
        hasHeroWordmark: !!document.querySelector('.hero-wordmark'),
        hasDashboardShell: !!document.querySelector('.dashboard-shell'),
        hasFintechHero: !!document.querySelector('.fintech-hero'),
      }));
      assert.equal(info.variant, 'apple-minimal-wave');
      assert.equal(info.hasAppleHero, true);
      assert.equal(info.hasWaveStage, true);
      assert.equal(info.hasHeroWordmark, true);
      assert.equal(info.hasDashboardShell, false);
      assert.equal(info.hasFintechHero, false);
    });
  } finally { if (browser) await browser.close(); }
});

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
  } finally { if (browser) await browser.close(); }
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
  } finally { if (browser) await browser.close(); }
});

test('Chromawave uses a colorful wave-driven layout with product cards instead of text-mask theatrics', async () => {
  let browser;
  try {
    await withStaticServer(async (port) => {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
      await page.goto(`http://127.0.0.1:${port}/examples/chromawave/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
      const info = await page.evaluate(() => ({
        variant: document.body.dataset.demoVariant,
        hasSpectrumHero: !!document.querySelector('.spectrum-hero'),
        hasWaveCardStack: !!document.querySelector('.wave-card-stack'),
        hasFloatingSwatches: !!document.querySelector('.floating-swatches'),
        hasAppleHero: !!document.querySelector('.apple-hero'),
        hasDashboardShell: !!document.querySelector('.dashboard-shell'),
      }));
      assert.equal(info.variant, 'spectral-colorwaves');
      assert.equal(info.hasSpectrumHero, true);
      assert.equal(info.hasWaveCardStack, true);
      assert.equal(info.hasFloatingSwatches, true);
      assert.equal(info.hasAppleHero, false);
      assert.equal(info.hasDashboardShell, false);
    });
  } finally { if (browser) await browser.close(); }
});

test('OrbitDeck uses an orbital ribbon layout with floating product cards', async () => {
  let browser;
  try {
    await withStaticServer(async (port) => {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
      await page.goto(`http://127.0.0.1:${port}/examples/orbitdeck/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
      const info = await page.evaluate(() => ({
        variant: document.body.dataset.demoVariant,
        hasOrbitHero: !!document.querySelector('.orbit-hero'),
        hasOrbitalCluster: !!document.querySelector('.orbital-cluster'),
        hasOrbitalRibbon: !!document.querySelector('.orbital-ribbon'),
        hasFintechHero: !!document.querySelector('.fintech-hero'),
        hasHeroWordmark: !!document.querySelector('.hero-wordmark'),
      }));
      assert.equal(info.variant, 'orbital-card-ribbons');
      assert.equal(info.hasOrbitHero, true);
      assert.equal(info.hasOrbitalCluster, true);
      assert.equal(info.hasOrbitalRibbon, true);
      assert.equal(info.hasFintechHero, false);
      assert.equal(info.hasHeroWordmark, false);
    });
  } finally { if (browser) await browser.close(); }
});

for (const demo of FULL_BACKGROUND_DEMOS) {
  test(demo.label, async () => {
    let browser;
    try {
      await withStaticServer(async (port) => {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
        await page.goto(`http://127.0.0.1:${port}/examples/${demo.slug}/`, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => document.documentElement.dataset.demoReady === 'true');
        const info = await page.evaluate((currentDemo) => {
          const required = Object.fromEntries(currentDemo.trueSelectors.map((selector) => [selector, !!document.querySelector(selector)]));
          const forbidden = Object.fromEntries(currentDemo.falseSelectors.map((selector) => [selector, !!document.querySelector(selector)]));
          return { variant: document.body.dataset.demoVariant, required, forbidden };
        }, demo);
        assert.equal(info.variant, demo.variant);
        for (const selector of demo.trueSelectors) assert.equal(info.required[selector], true, `${demo.slug} should include ${selector}`);
        for (const selector of demo.falseSelectors) assert.equal(info.forbidden[selector], false, `${demo.slug} should not include ${selector}`);
      });
    } finally { if (browser) await browser.close(); }
  });
}

test('Chromawave, OrbitDeck, and all full-background studies rely on ambient motion instead of subject text masks', async () => {
  const fullBackgroundSlugs = FULL_BACKGROUND_DEMOS.map((demo) => demo.slug);
  for (const slug of ['chromawave', 'orbitdeck', ...fullBackgroundSlugs]) {
    for (const file of ['hero.json', 'cta.json']) {
      const project = JSON.parse(await readFile(path.join(rootDir, `examples/${slug}/${file}`), 'utf8'));
      assert.equal(project.subject?.type, 'none');
      assert.equal(project.subject?.text, '');
      assert.equal(project.subject?.svgContent, '');
    }
  }
});
