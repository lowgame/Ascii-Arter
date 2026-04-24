import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm, writeFile as writeFsFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(process.cwd());
const libDir = path.join(rootDir, 'lib');
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

  throw new Error('Playwright module could not be resolved for npm package tests');
}

const { chromium } = loadPlaywright();

async function npmPackInstall() {
  await execFileAsync('npm', ['run', 'build'], { cwd: libDir });
  const { stdout: tarballStdout } = await execFileAsync('npm', ['pack', '--silent'], { cwd: libDir });
  const tarballName = tarballStdout.trim().split('\n').pop();
  const tarballPath = path.join(libDir, tarballName);
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ascii-arter-pack-'));
  await execFileAsync('npm', ['init', '-y'], { cwd: tempDir });
  await execFileAsync('npm', ['install', tarballPath], { cwd: tempDir });
  return { tempDir, tarballPath };
}

async function runNode(code, cwd, extraArgs = []) {
  const { stdout } = await execFileAsync('node', [...extraArgs, '-e', code], { cwd });
  return stdout.trim();
}

test('packed npm package exposes helpers for import/export in both CJS and ESM', async () => {
  const { tempDir, tarballPath } = await npmPackInstall();
  try {
    const cjsOut = await runNode(
      "const m=require('ascii-arter'); console.log(JSON.stringify(Object.keys(m).sort()));",
      tempDir,
    );
    const esmOut = await runNode(
      "import('ascii-arter').then(m=>console.log(JSON.stringify(Object.keys(m).sort())))",
      tempDir,
      ['--input-type=module'],
    );

    const cjsKeys = JSON.parse(cjsOut);
    const esmKeys = JSON.parse(esmOut);
    for (const required of ['AsciiBackground', 'default', 'parseProjectData', 'serializeProjectData']) {
      assert.equal(cjsKeys.includes(required), true, `CJS export should include ${required}`);
      assert.equal(esmKeys.includes(required), true, `ESM export should include ${required}`);
    }
    assert.equal(existsSync(tarballPath), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('npm package can render exported text-only JSON as a real animated background', async () => {
  const { tempDir } = await npmPackInstall();
  let browser;
  let server;
  try {
    const project = {
      projectName: 'Package Smoke',
      cols: 88,
      rows: 30,
      fontSize: 14,
      fpsCap: 30,
      palette: 'matrix',
      charSet: 'dense',
      customChars: ' .:-=+*#%@',
      background: '#000000',
      brightness: 0,
      contrast: 1.1,
      gamma: 1,
      saturation: 1,
      hueShift: 0,
      density: 1,
      glow: 0,
      trail: 0,
      backgroundMix: 0,
      invert: false,
      speed: 1,
      zoom: 1,
      rotation: 0,
      amplitude: 1,
      frequency: 1,
      turbulence: 1,
      offsetX: 0,
      offsetY: 0,
      seed: 1337,
      mirrorX: false,
      mirrorY: false,
      layers: [{ id: 'layer-1', name: 'Disabled', mode: 'matrix-rain', enabled: false, palette: 'inherit', blend: 'screen', intensity: 1, speed: 1, scale: 1, phase: 0, offsetX: 0, offsetY: 0, warp: 1, hueShift: 0, charBias: 0 }],
      texts: [{ id: 'text-1', content: 'HELLO', enabled: true, animation: 'static', x: 8, y: 10, speed: 1, amplitude: 0, phase: 0, spacing: 0, color: '#ffffff', bg: 'transparent', repeat: false, rainbow: false, outline: false, glow: 0, outlineColor: '#000000', bgOpacity: 1, bgPadding: 0, scale: 1 }],
      svgLayers: [],
      subject: { type: 'none', text: '', svgContent: '' },
    };

    await writeFsFile(path.join(tempDir, 'project.json'), JSON.stringify(project, null, 2), 'utf8');
    await writeFsFile(path.join(tempDir, 'index.html'), `<!doctype html>
<html>
<body style="margin:0;background:#111;">
  <section id="hero" style="position:relative;width:720px;height:420px;overflow:hidden"></section>
  <script type="module">
    import AsciiBackground from './node_modules/ascii-arter/dist/ascii-arter.esm.js';
    const project = ${JSON.stringify(project)};
    const bg = AsciiBackground.mount('#hero', project);
    window.__asciiBg = bg;
  </script>
</body>
</html>`, 'utf8');

    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
        const filePath = path.join(tempDir, relativePath);
        const content = await readFile(filePath);
        const ext = path.extname(filePath);
        const mime = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.cjs': 'application/javascript; charset=utf-8',
        };
        res.writeHead(200, { 'content-type': mime[ext] || 'application/octet-stream' });
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
    const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const info = await page.evaluate(() => {
      const canvas = document.querySelector('#hero canvas');
      if (!canvas) return { hasCanvas: false };
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
          colored += 1;
          if (colored > 25) break;
        }
      }
      return {
        hasCanvas: true,
        colored,
        methods: {
          play: typeof window.__asciiBg?.play,
          pause: typeof window.__asciiBg?.pause,
          update: typeof window.__asciiBg?.update,
          destroy: typeof window.__asciiBg?.destroy,
        },
      };
    });

    assert.equal(info.hasCanvas, true, 'mounted package should inject a canvas');
    assert.ok(info.colored > 25, 'text-only exported JSON should produce visible non-black pixels');
    assert.deepEqual(info.methods, { play: 'function', pause: 'function', update: 'function', destroy: 'function' });
    assert.deepEqual(pageErrors, []);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  }
});
