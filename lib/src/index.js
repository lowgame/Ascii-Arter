import { AsciiRenderer, FrameBuffer } from './engine.js';
import { ANIMATION_MODES, MODE_BY_ID, sampleMode } from './animations.js';
import { PALETTES, CHARSETS, BLEND_MODES, normalizeProject, createDefaultProject } from './config.js';

// ── helpers ──
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const fract = v => v - Math.floor(v);

function hexToRgb(hex) {
  const n = parseInt((hex || '#000000').replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToCss({ r, g, b }) { return `rgb(${r},${g},${b})`; }
function mixRgb(a, b, t) {
  return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
}
const paletteCache = new Map();
function getPaletteRgb(name) {
  if (!paletteCache.has(name)) paletteCache.set(name, (PALETTES[name] || PALETTES.matrix).map(hexToRgb));
  return paletteCache.get(name);
}
function samplePaletteRgb(name, t, sat = 1, hue = 0) {
  const stops = getPaletteRgb(name);
  const scaled = clamp01(fract(t)) * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  const c = mixRgb(a, b, f);
  if (sat !== 1) {
    const gray = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    return { r: Math.round(gray + (c.r - gray) * sat), g: Math.round(gray + (c.g - gray) * sat), b: Math.round(gray + (c.b - gray) * sat) };
  }
  return c;
}
function blendSample(a, b, mode) {
  switch (mode) {
    case 'add': return clamp01(a + b);
    case 'screen': return 1 - (1 - a) * (1 - b);
    case 'max': return Math.max(a, b);
    case 'difference': return Math.abs(a - b);
    case 'multiply': return a * b;
    default: return clamp01(a + b);
  }
}
function getActiveCharset(project) {
  if (project.charSet === 'custom' && project.customChars) return project.customChars;
  return CHARSETS[project.charSet] || CHARSETS.dense;
}

class AsciiBackground {
  constructor(container, projectData, options = {}) {
    this._project = normalizeProject(projectData || createDefaultProject());
    this._options = options;
    this._timeline = 0;
    this._lastTick = 0;
    this._frameValues = new Float32Array(this._project.cols * this._project.rows);
    this._playing = true;
    this._rafId = null;

    // Create and mount canvas
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';

    // Make sure container is positioned
    const pos = getComputedStyle(container).position;
    if (pos === 'static') container.style.position = 'relative';
    container.prepend(this._canvas);

    this._renderer = new AsciiRenderer(this._canvas);
    this._buffer = new FrameBuffer(this._project.cols, this._project.rows);

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);

    this._loop = this._loop.bind(this);
    this._rafId = requestAnimationFrame(this._loop);
  }

  _resize() {
    const p = this._project;
    this._renderer.resize(p.cols, p.rows, p.fontSize);
    this._buffer.resize(p.cols, p.rows);
    this._frameValues = new Float32Array(p.cols * p.rows);
  }

  _loop(now) {
    this._rafId = requestAnimationFrame(this._loop);
    if (!this._lastTick) this._lastTick = now;
    const dt = now - this._lastTick;
    const cap = Math.max(1, this._project.fpsCap || 30);
    if (dt < 1000 / cap) return;
    this._lastTick = now;
    if (this._playing) this._timeline += dt / 1000;
    this._renderFrame();
    this._renderer.render(this._buffer, this._project);
  }

  _renderFrame() {
    const p = this._project;
    this._buffer.clear('transparent');
    const bgRgb = hexToRgb(p.background);
    const charset = getActiveCharset(p);
    const charLen = Math.max(1, charset.length - 1);
    const layers = p.layers.filter(l => l.enabled);

    for (let y = 0; y < p.rows; y++) {
      const ny = p.rows > 1 ? (y / (p.rows - 1)) * 2 - 1 : 0;
      for (let x = 0; x < p.cols; x++) {
        const nx = p.cols > 1 ? (x / (p.cols - 1)) * 2 - 1 : 0;
        const idx = y * p.cols + x;
        let value = 0, hue = p.hueShift / 360, dominant = 0, palName = p.palette;
        layers.forEach(layer => {
          const mode = MODE_BY_ID[layer.mode] || ANIMATION_MODES[0];
          const s = sampleMode(mode, nx, ny, this._timeline, p, layer);
          value = blendSample(value, s, layer.blend);
          hue += s * ((mode.hueBias || 0) + layer.hueShift / 360);
          if (s >= dominant) { dominant = s; palName = layer.palette !== 'inherit' ? layer.palette : (mode.palette || p.palette); }
        });
        value = clamp01(value + p.brightness);
        value = clamp01((value - 0.5) * p.contrast + 0.5);
        value = clamp01(Math.pow(value, p.gamma));
        value = this._frameValues[idx] * p.trail + value * (1 - p.trail);
        this._frameValues[idx] = value;
        let shaded = p.invert ? 1 - value : value;
        shaded = clamp01(Math.pow(shaded, 1 / Math.max(0.15, p.density)));
        const ci = clamp(Math.floor(shaded * charLen), 0, charLen);
        const col = samplePaletteRgb(palName, fract(shaded + hue), p.saturation, p.hueShift);
        const fg = rgbToCss(mixRgb(col, bgRgb, p.backgroundMix * 0.55));
        const ch = shaded < 0.12 ? ' ' : charset[ci] || charset[charset.length - 1] || '#';
        this._buffer.setCell(x, y, ch, fg, 'transparent');
      }
    }
  }

  play()  { this._playing = true; return this; }
  pause() { this._playing = false; return this; }
  update(partial) {
    Object.assign(this._project, partial);
    this._resize();
    return this;
  }
  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._ro.disconnect();
    this._canvas.remove();
  }
}

// Static factory
AsciiBackground.mount = function(selector, projectData, options = {}) {
  const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!el) throw new Error(`ascii-bg: element not found: ${selector}`);
  return new AsciiBackground(el, projectData, options);
};

export default AsciiBackground;
export { AsciiBackground };
