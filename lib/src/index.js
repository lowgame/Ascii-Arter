import { AsciiRenderer, FrameBuffer } from './engine.js';
import { ANIMATION_MODES, MODE_BY_ID, sampleMode } from './animations.js';
import { PALETTES, CHARSETS, normalizeProject, createDefaultProject, cloneProject } from './config.js';
import { SUBJECT_FONT_FAMILY_OPTIONS, buildSubjectCanvasFont, getSpacedSubjectLines } from './subject-text.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const fract = (value) => value - Math.floor(value);

function stripRuntimeFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripRuntimeFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const clone = {};
  Object.entries(value).forEach(([key, nextValue]) => {
    if (key.startsWith('_')) return;
    clone[key] = stripRuntimeFields(nextValue);
  });
  return clone;
}

function hexToRgb(hex) {
  const n = parseInt((hex || '#000000').replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r},${g},${b})`;
}

function mixRgb(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

const paletteCache = new Map();
function getPaletteRgb(name) {
  if (!paletteCache.has(name)) {
    paletteCache.set(name, (PALETTES[name] || PALETTES.matrix).map(hexToRgb));
  }
  return paletteCache.get(name);
}

function samplePaletteRgb(name, t, saturation = 1) {
  const stops = getPaletteRgb(name);
  const scaled = clamp01(fract(t)) * (stops.length - 1);
  const index = Math.floor(scaled);
  const factor = scaled - index;
  const a = stops[index];
  const b = stops[Math.min(index + 1, stops.length - 1)];
  const color = mixRgb(a, b, factor);
  if (saturation !== 1) {
    const gray = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
    return {
      r: Math.round(gray + (color.r - gray) * saturation),
      g: Math.round(gray + (color.g - gray) * saturation),
      b: Math.round(gray + (color.b - gray) * saturation),
    };
  }
  return color;
}

function samplePalette(name, t, saturation = 1) {
  return rgbToCss(samplePaletteRgb(name, t, saturation));
}

function blendSample(base, sample, blend) {
  switch (blend) {
    case 'add':
      return clamp01(base + sample * 0.75);
    case 'max':
      return Math.max(base, sample);
    case 'difference':
      return clamp01(Math.abs(base - sample));
    case 'multiply':
      return clamp01((base || 0.5) * (sample * 1.2));
    case 'screen':
    default:
      return 1 - (1 - base) * (1 - sample);
  }
}

function getActiveCharset(project) {
  if (project.charSet === 'custom') {
    const chars = (project.customChars || '').trim();
    return chars.length ? chars : CHARSETS.classic;
  }
  return CHARSETS[project.charSet] || CHARSETS.classic;
}

function applySpacing(text, spacing) {
  const gap = ' '.repeat(Math.max(0, spacing));
  return String(text).split('').join(gap);
}

export function serializeProjectData(project) {
  return stripRuntimeFields(project || {});
}

export function parseProjectData(input) {
  if (input == null) {
    return createDefaultProject();
  }

  if (typeof input === 'string') {
    return JSON.parse(input);
  }

  if (typeof input === 'object') {
    return cloneProject(serializeProjectData(input));
  }

  throw new Error('ascii-arter: unsupported project data input');
}

class AsciiBackground {
  constructor(container, projectData, options = {}) {
    this._container = container;
    this._options = options;
    this._project = normalizeProject(parseProjectData(projectData || createDefaultProject()));
    this._timeline = 0;
    this._lastTick = 0;
    this._playing = true;
    this._rafId = null;
    this._needsRedraw = true;
    this._subjectMask = null;
    this._subjectDirty = true;
    this._svgRasterCache = new Map();
    this._frameValues = new Float32Array(this._project.cols * this._project.rows);

    this._canvas = document.createElement('canvas');
    this._canvas.setAttribute('aria-hidden', 'true');
    this._canvas.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:50%',
      'pointer-events:none',
      'z-index:0',
      'display:block',
      'transform-origin:center center',
      'max-width:none',
      'max-height:none',
    ].join(';');

    const position = getComputedStyle(container).position;
    if (position === 'static') {
      container.style.position = 'relative';
    }
    container.prepend(this._canvas);

    this._renderer = new AsciiRenderer(this._canvas);
    this._buffer = new FrameBuffer(this._project.cols, this._project.rows);

    this._loop = this._loop.bind(this);
    this._resize = this._resize.bind(this);

    this._resize();
    this._ro = new ResizeObserver(this._resize);
    this._ro.observe(container);
    this._rafId = requestAnimationFrame(this._loop);
  }

  _fitCanvasToContainer() {
    const baseWidth = parseFloat(this._canvas.style.width) || this._canvas.clientWidth || 1;
    const baseHeight = parseFloat(this._canvas.style.height) || this._canvas.clientHeight || 1;
    const containerWidth = Math.max(1, this._container.clientWidth || baseWidth);
    const containerHeight = Math.max(1, this._container.clientHeight || baseHeight);
    const scale = Math.max(containerWidth / baseWidth, containerHeight / baseHeight, 1);
    this._canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  _resize() {
    const project = this._project;
    this._renderer.resize(project.cols, project.rows, project.fontSize);
    this._buffer.resize(project.cols, project.rows);
    this._frameValues = new Float32Array(project.cols * project.rows);
    this._subjectDirty = true;
    this._needsRedraw = true;
    this._fitCanvasToContainer();
  }

  _loop(now) {
    this._rafId = requestAnimationFrame(this._loop);
    if (!this._lastTick) this._lastTick = now;

    const dt = now - this._lastTick;
    const fpsCap = Math.max(1, this._project.fpsCap || 30);
    if (dt < 1000 / fpsCap && !this._needsRedraw) {
      return;
    }

    this._lastTick = now;
    if (this._playing) this._timeline += dt / 1000;

    this._renderFrame(this._timeline);
    this._renderer.render(this._buffer, this._project);
    this._needsRedraw = false;
  }

  _renderFrame(time) {
    if (this._subjectDirty) this._buildSubjectMask();

    const project = this._project;
    this._buffer.clear('transparent');
    const backgroundRgb = hexToRgb(project.background);
    const charset = getActiveCharset(project);
    const charLength = Math.max(1, charset.length - 1);
    const layers = project.layers.filter((layer) => layer.enabled);

    for (let y = 0; y < project.rows; y += 1) {
      const ny = project.rows > 1 ? (y / (project.rows - 1)) * 2 - 1 : 0;
      for (let x = 0; x < project.cols; x += 1) {
        const nx = project.cols > 1 ? (x / (project.cols - 1)) * 2 - 1 : 0;
        const index = y * project.cols + x;

        let value = 0;
        let hue = project.hueShift / 360;
        let dominant = 0;
        let paletteName = project.palette;

        layers.forEach((layer) => {
          const mode = MODE_BY_ID[layer.mode] || ANIMATION_MODES[0];
          const sample = sampleMode(mode, nx, ny, time, project, layer);
          value = blendSample(value, sample, layer.blend);
          hue += sample * ((mode.hueBias || 0) + layer.hueShift / 360);
          if (sample >= dominant) {
            dominant = sample;
            paletteName = layer.palette !== 'inherit' ? layer.palette : (mode.palette || project.palette);
          }
        });

        value = clamp01(value + project.brightness);
        value = clamp01((value - 0.5) * project.contrast + 0.5);
        value = clamp01(Math.pow(value, project.gamma));
        value = this._frameValues[index] * project.trail + value * (1 - project.trail);
        this._frameValues[index] = value;
        let shaded = project.invert ? 1 - value : value;
        shaded = clamp01(Math.pow(shaded, 1 / Math.max(0.15, project.density)));

        const charIndex = clamp(Math.floor(shaded * charLength), 0, charLength);
        const colorRgb = samplePaletteRgb(paletteName, fract(shaded + hue), project.saturation);
        const fg = rgbToCss(mixRgb(colorRgb, backgroundRgb, project.backgroundMix * 0.55));
        const char = shaded < 0.12 ? ' ' : charset[charIndex] || charset[charset.length - 1] || '#';

        if (this._subjectMask !== null) {
          const maskValue = this._subjectMask[index];
          if (maskValue < 0.15) {
            const bgIntensity = project.subject?.bgIntensity ?? 0.08;
            const bgValue = clamp01(value * bgIntensity);
            if (bgValue < 0.1) {
              this._buffer.setCell(x, y, ' ', '#000000', 'transparent');
            } else {
              this._buffer.setCell(x, y, char, rgbToCss(mixRgb(colorRgb, backgroundRgb, 0.85)), 'transparent');
            }
          } else {
            const modValue = clamp01(value * (0.4 + maskValue * 0.6) + maskValue * 0.5);
            const modShaded = clamp01(Math.pow(modValue, 1 / Math.max(0.15, project.density)));
            const modCharIndex = clamp(Math.floor(modShaded * charLength), 0, charLength);
            const modColor = samplePaletteRgb(paletteName, fract(modShaded + hue), project.saturation);
            const modChar = modShaded < 0.08 ? ' ' : charset[modCharIndex] || charset[charset.length - 1] || '#';
            this._buffer.setCell(x, y, modChar, rgbToCss(mixRgb(modColor, backgroundRgb, project.backgroundMix * 0.3)), 'transparent');
          }
        } else {
          this._buffer.setCell(x, y, char, fg, 'transparent');
        }
      }
    }

    this._applyTextLayers(time);
    this._applySvgLayers();
  }

  _applyTextLayers(time) {
    const paletteKeys = Object.keys(PALETTES);
    this._project.texts.filter((text) => text.enabled).forEach((text, textIndex) => {
      const lines = String(text.content || '').split('\n').filter(Boolean);
      if (!lines.length) return;

      const { x, y } = this._getTextPosition(text, time, lines);
      const paletteName = paletteKeys[textIndex % paletteKeys.length] || this._project.palette;

      lines.forEach((line, lineIndex) => {
        const spacedLine = applySpacing(line, text.spacing);
        if (!text.repeat) {
          this._drawStyledLine(Math.round(x), Math.round(y + lineIndex), spacedLine, text, paletteName, time);
          return;
        }

        const repeatStep = Math.max(4, spacedLine.length + 4);
        for (let offset = -repeatStep * 2; offset < this._project.cols + repeatStep * 2; offset += repeatStep) {
          this._drawStyledLine(Math.round(x + offset), Math.round(y + lineIndex), spacedLine, text, paletteName, time);
        }
      });
    });
  }

  _drawStyledLine(startX, startY, line, text, paletteName, time) {
    const outlineColor = text.bg !== 'transparent' ? text.bg : '#000000';

    for (let index = 0; index < line.length; index += 1) {
      const glyph = line[index];
      if (!glyph) continue;
      const x = startX + index;
      const yOffset = text.animation === 'wave'
        ? Math.round(Math.sin(time * text.speed * 2 + index * 0.4 + text.phase) * text.amplitude * 0.18)
        : 0;
      const y = startY + yOffset;
      const fg = text.rainbow
        ? samplePalette(paletteName, fract(time * 0.15 + index * 0.05), this._project.saturation)
        : text.color;

      if (text.outline) {
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => this._buffer.setCell(x + ox, y + oy, glyph, outlineColor, 'transparent'));
      }

      this._buffer.setCell(x, y, glyph, fg, text.bg || 'transparent');
    }
  }

  _getTextPosition(text, time, lines) {
    const width = Math.max(...lines.map((line) => applySpacing(line, text.spacing).length));
    const t = time * text.speed + text.phase;
    switch (text.animation) {
      case 'marquee':
        return { x: this._project.cols - ((t * 10) % (this._project.cols + width + 10)), y: text.y };
      case 'bounce':
        return { x: text.x, y: text.y + Math.abs(Math.sin(t)) * text.amplitude };
      case 'orbit':
        return {
          x: this._project.cols * 0.5 + Math.cos(t) * text.amplitude * 2 - width / 2,
          y: this._project.rows * 0.5 + Math.sin(t * 1.2) * text.amplitude - lines.length / 2,
        };
      case 'glitch':
        return {
          x: text.x + Math.round(Math.sin(t * 8.4) * text.amplitude * 0.5),
          y: text.y + Math.round(Math.cos(t * 6.2) * text.amplitude * 0.3),
        };
      case 'pulse':
        return { x: text.x, y: text.y + Math.sin(t * 1.6) * text.amplitude * 0.18 };
      case 'spiral':
        return {
          x: text.x + Math.cos(t * 1.1) * text.amplitude * 1.2,
          y: text.y + Math.sin(t * 1.4) * text.amplitude * 0.8,
        };
      case 'drift':
        return { x: text.x + Math.sin(t * 0.7) * text.amplitude, y: text.y + Math.cos(t * 0.45) * text.amplitude * 0.45 };
      case 'wave':
      case 'static':
      default:
        return { x: text.x, y: text.y };
    }
  }

  _rasterizeSvg(svgLayer) {
    if (!svgLayer.svgContent || !svgLayer._rasterDirty) return;
    const blob = new Blob([svgLayer.svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const offscreen = document.createElement('canvas');
      offscreen.width = this._project.cols;
      offscreen.height = this._project.rows;
      const ctx = offscreen.getContext('2d');
      const scale = svgLayer.svgScale || 1;
      const ox = (svgLayer.svgX || 0) * this._project.cols;
      const oy = (svgLayer.svgY || 0) * this._project.rows;
      ctx.drawImage(img, ox, oy, this._project.cols * scale, this._project.rows * scale);
      this._svgRasterCache.set(svgLayer.id, ctx.getImageData(0, 0, this._project.cols, this._project.rows));
      svgLayer._rasterDirty = false;
      this._needsRedraw = true;
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  _applySvgLayers() {
    if (!this._project.svgLayers || !this._project.svgLayers.length) return;
    this._project.svgLayers.filter((layer) => layer.enabled).forEach((svgLayer) => {
      if (svgLayer._rasterDirty && svgLayer.svgContent) this._rasterizeSvg(svgLayer);
      const imageData = this._svgRasterCache.get(svgLayer.id);
      if (!imageData) return;
      const data = imageData.data;
      for (let y = 0; y < this._project.rows; y += 1) {
        for (let x = 0; x < this._project.cols; x += 1) {
          const idx = (y * this._project.cols + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255 * (a / 255);
          const inShape = svgLayer.invert ? brightness <= 0.3 : brightness > 0.3;
          if (inShape && svgLayer.fgIntensity > 0) {
            const paletteName = svgLayer.fgPalette !== 'inherit' ? svgLayer.fgPalette : this._project.palette;
            const fg = samplePalette(paletteName, brightness, this._project.saturation);
            const charset = svgLayer.fgCharSet !== 'inherit' ? (CHARSETS[svgLayer.fgCharSet] || getActiveCharset(this._project)) : getActiveCharset(this._project);
            const charLength = Math.max(1, charset.length - 1);
            const charIndex = clamp(Math.floor(brightness * charLength), 0, charLength);
            const char = brightness < 0.12 ? ' ' : (charset[charIndex] || charset[charset.length - 1]);
            this._buffer.setCell(x, y, char, fg, 'transparent');
          } else if (!inShape && svgLayer.bgIntensity > 0) {
            const paletteName = svgLayer.bgPalette !== 'inherit' ? svgLayer.bgPalette : this._project.palette;
            const fg = samplePalette(paletteName, brightness, this._project.saturation);
            const cell = this._buffer.getCell(x, y);
            const blended = blendSample(cell ? 0.5 : 0, svgLayer.bgIntensity * 0.5, svgLayer.blend);
            if (blended > 0.05) this._buffer.setCell(x, y, cell?.char || ' ', fg, 'transparent');
          }
        }
      }
    });
  }

  _buildSubjectMask() {
    const { subject } = this._project;
    if (!subject || subject.type === 'none' || (!subject.text && !subject.svgContent)) {
      this._subjectMask = null;
      this._subjectDirty = false;
      return;
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = this._project.cols;
    offscreen.height = this._project.rows;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this._project.cols, this._project.rows);

    if (subject.type === 'text' && subject.text) {
      const padding = subject.padding || 4;
      const maxWidth = this._project.cols - padding * 2;
      let fontSize = this._project.rows * 0.72;
      const fontFamilyKey = subject.textFontFamily || SUBJECT_FONT_FAMILY_OPTIONS[0].value;
      const lines = getSpacedSubjectLines(subject.text, subject.textLetterSpacing ?? 0);
      if (!lines.length) {
        this._subjectMask = null;
        this._subjectDirty = false;
        return;
      }
      ctx.font = buildSubjectCanvasFont({ weight: subject.textFont || 'bold', size: fontSize, familyKey: fontFamilyKey });
      const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
      while (ctx.measureText(longestLine).width > maxWidth && fontSize > 4) {
        fontSize -= 0.5;
        ctx.font = buildSubjectCanvasFont({ weight: subject.textFont || 'bold', size: fontSize, familyKey: fontFamilyKey });
      }
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const lineHeight = fontSize * 1.1;
      const totalHeight = lines.length * lineHeight;
      const startY = (this._project.rows - totalHeight) / 2 + lineHeight / 2;
      lines.forEach((line, index) => {
        ctx.fillText(line, this._project.cols / 2, startY + index * lineHeight);
      });
      const imageData = ctx.getImageData(0, 0, this._project.cols, this._project.rows);
      this._subjectMask = new Float32Array(this._project.cols * this._project.rows);
      for (let i = 0; i < this._subjectMask.length; i += 1) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        this._subjectMask[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      }
      this._subjectDirty = false;
      return;
    }

    if (subject.type === 'svg' && subject.svgContent) {
      this._buildSvgSubjectMask(subject.svgContent, offscreen, ctx);
    }
  }

  async _buildSvgSubjectMask(svgContent, offscreen, ctx) {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      URL.revokeObjectURL(url);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);
      ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
      const imageData = ctx.getImageData(0, 0, this._project.cols, this._project.rows);
      this._subjectMask = new Float32Array(this._project.cols * this._project.rows);
      for (let i = 0; i < this._subjectMask.length; i += 1) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        this._subjectMask[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      }
      this._subjectDirty = false;
      this._needsRedraw = true;
    } catch {
      this._subjectDirty = false;
    }
  }

  play() {
    this._playing = true;
    this._lastTick = 0;
    this._needsRedraw = true;
    return this;
  }

  pause() {
    this._playing = false;
    return this;
  }

  load(projectData) {
    this._project = normalizeProject(parseProjectData(projectData || createDefaultProject()));
    this._svgRasterCache.clear();
    this._subjectMask = null;
    this._subjectDirty = true;
    this._resize();
    return this;
  }

  update(partial) {
    const nextProject = {
      ...cloneProject(this._project),
      ...parseProjectData(partial || {}),
    };
    return this.load(nextProject);
  }

  toJSON(space = 2) {
    return JSON.stringify(serializeProjectData(this._project), null, space);
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._ro) this._ro.disconnect();
    this._canvas.remove();
  }
}

AsciiBackground.mount = function mount(selector, projectData, options = {}) {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!element) throw new Error(`ascii-arter: element not found: ${selector}`);
  return new AsciiBackground(element, projectData, options);
};

AsciiBackground.parseProjectData = parseProjectData;
AsciiBackground.serializeProjectData = serializeProjectData;

export default AsciiBackground;
export { AsciiBackground };
