export const CHARSETS = {
  classic: ' .:-=+*#%@',
  dense: ' .,:;irsXA253hMHGS#9B&@',
  blocks: ' ▁▂▃▄▅▆▇█',
  technical: " .'`^\",:;Il!i~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  matrix: ' .,:;+xX$#@',
  binary: ' 01',
  hex: ' 0123456789ABCDEF',
  neon: ' .·:+=xX#%@',
  glitch: ' _-=+*#%@',
  wire: ' .oO0#'
};

export const PALETTES = {
  matrix: ['#02140b', '#00a85a', '#00ff88', '#d6ffe8'],
  neon: ['#11001c', '#5b00ff', '#00d4ff', '#ff3cac', '#ffffff'],
  synthwave: ['#090014', '#4b00ff', '#ff00c8', '#ff8a00', '#fff2cc'],
  aurora: ['#03151f', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  fire: ['#120400', '#7f2200', '#ff6b00', '#ffb000', '#fff4d6'],
  ember: ['#120506', '#5a0c1b', '#c41e3a', '#ff7b54', '#ffd56b'],
  sunset: ['#140413', '#5e239d', '#c63fa4', '#ff7f50', '#ffd166'],
  ice: ['#020816', '#1b4965', '#62b6cb', '#bee9e8', '#f1fdff'],
  mono: ['#050505', '#222222', '#666666', '#aaaaaa', '#ffffff'],
  acid: ['#030c00', '#6dfc00', '#d9ff00', '#00ffa3', '#ffffff'],
  ocean: ['#041c32', '#04293a', '#064663', '#47b5ff', '#dff6ff'],
  gold: ['#150e00', '#5c4300', '#b88900', '#ffd166', '#fff4cc'],
  candy: ['#150012', '#7b2cbf', '#ff4d8d', '#ff85a1', '#fff0f6'],
  cyber: ['#050816', '#0f4c75', '#00bbf9', '#00f5d4', '#f5f5f5'],
  radar: ['#010800', '#0a2f00', '#16c60c', '#90ff90', '#f2fff2']
};

export const BLEND_MODES = [
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'max', label: 'Max' },
  { value: 'difference', label: 'Difference' },
  { value: 'multiply', label: 'Multiply' }
];

export const TEXT_ANIMATIONS = [
  { value: 'static', label: 'Static' },
  { value: 'wave', label: 'Wave' },
  { value: 'marquee', label: 'Marquee' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'drift', label: 'Drift' }
];

export const GLOBAL_CONTROL_SECTIONS = [
  {
    title: 'Project',
    controls: [
      { key: 'projectName', label: 'Project Name', type: 'text' },
      { key: 'cols', label: 'Columns', type: 'range', min: 48, max: 180, step: 1 },
      { key: 'rows', label: 'Rows', type: 'range', min: 20, max: 72, step: 1 },
      { key: 'fontSize', label: 'Font Size', type: 'range', min: 8, max: 22, step: 1 },
      { key: 'fpsCap', label: 'FPS Cap', type: 'range', min: 12, max: 60, step: 1 },
      { key: 'palette', label: 'Global Palette', type: 'select', options: Object.keys(PALETTES) },
      { key: 'charSet', label: 'Character Set', type: 'select', options: [...Object.keys(CHARSETS), 'custom'] },
      { key: 'customChars', label: 'Custom Chars', type: 'text', placeholder: 'Used when Character Set is custom' }
    ]
  },
  {
    title: 'Look',
    controls: [
      { key: 'background', label: 'Background', type: 'color' },
      { key: 'brightness', label: 'Brightness', type: 'range', min: -0.5, max: 0.5, step: 0.01 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.25, max: 2.5, step: 0.01 },
      { key: 'gamma', label: 'Gamma', type: 'range', min: 0.35, max: 2.6, step: 0.01 },
      { key: 'saturation', label: 'Saturation', type: 'range', min: 0, max: 2, step: 0.01 },
      { key: 'hueShift', label: 'Hue Shift', type: 'range', min: -180, max: 180, step: 1 },
      { key: 'density', label: 'Density', type: 'range', min: 0.25, max: 2.5, step: 0.01 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 24, step: 0.5 },
      { key: 'trail', label: 'Trail', type: 'range', min: 0, max: 0.96, step: 0.01 },
      { key: 'backgroundMix', label: 'Background Mix', type: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'invert', label: 'Invert', type: 'checkbox' }
    ]
  },
  {
    title: 'Motion',
    controls: [
      { key: 'speed', label: 'Master Speed', type: 'range', min: 0.1, max: 4, step: 0.01 },
      { key: 'zoom', label: 'Zoom', type: 'range', min: 0.3, max: 3, step: 0.01 },
      { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180, step: 1 },
      { key: 'amplitude', label: 'Amplitude', type: 'range', min: 0, max: 4, step: 0.01 },
      { key: 'frequency', label: 'Frequency', type: 'range', min: 0.1, max: 5, step: 0.01 },
      { key: 'turbulence', label: 'Turbulence', type: 'range', min: 0, max: 4, step: 0.01 },
      { key: 'offsetX', label: 'Offset X', type: 'range', min: -2, max: 2, step: 0.01 },
      { key: 'offsetY', label: 'Offset Y', type: 'range', min: -2, max: 2, step: 0.01 },
      { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 9999, step: 1 },
      { key: 'mirrorX', label: 'Mirror X', type: 'checkbox' },
      { key: 'mirrorY', label: 'Mirror Y', type: 'checkbox' }
    ]
  }
];

export const LAYER_CONTROL_SCHEMA = [
  { key: 'name', label: 'Layer Name', type: 'text' },
  { key: 'mode', label: 'Animation', type: 'animation-select' },
  { key: 'enabled', label: 'Enabled', type: 'checkbox' },
  { key: 'palette', label: 'Palette', type: 'select', options: ['inherit', ...Object.keys(PALETTES)] },
  { key: 'blend', label: 'Blend', type: 'select', options: BLEND_MODES.map((item) => item.value) },
  { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 4, step: 0.01 },
  { key: 'scale', label: 'Scale', type: 'range', min: 0.25, max: 4, step: 0.01 },
  { key: 'phase', label: 'Phase', type: 'range', min: -6.28, max: 6.28, step: 0.01 },
  { key: 'offsetX', label: 'Offset X', type: 'range', min: -2, max: 2, step: 0.01 },
  { key: 'offsetY', label: 'Offset Y', type: 'range', min: -2, max: 2, step: 0.01 },
  { key: 'warp', label: 'Warp', type: 'range', min: 0, max: 4, step: 0.01 },
  { key: 'hueShift', label: 'Hue Shift', type: 'range', min: -180, max: 180, step: 1 },
  { key: 'charBias', label: 'Char Bias', type: 'range', min: -1, max: 1, step: 0.01 }
];

export const TEXT_CONTROL_SCHEMA = [
  { key: 'content', label: 'Content', type: 'textarea' },
  { key: 'enabled', label: 'Enabled', type: 'checkbox' },
  { key: 'animation', label: 'Animation', type: 'select', options: TEXT_ANIMATIONS.map((item) => item.value) },
  { key: 'x', label: 'X', type: 'range', min: -40, max: 180, step: 1 },
  { key: 'y', label: 'Y', type: 'range', min: -20, max: 72, step: 1 },
  { key: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 5, step: 0.01 },
  { key: 'amplitude', label: 'Amplitude', type: 'range', min: 0, max: 18, step: 0.1 },
  { key: 'phase', label: 'Phase', type: 'range', min: -6.28, max: 6.28, step: 0.01 },
  { key: 'spacing', label: 'Spacing', type: 'range', min: 0, max: 12, step: 1 },
  { key: 'color', label: 'Text Color', type: 'color' },
  { key: 'bg', label: 'Text Background', type: 'text', placeholder: 'transparent or #000000' },
  { key: 'repeat', label: 'Repeat', type: 'checkbox' },
  { key: 'rainbow', label: 'Rainbow', type: 'checkbox' },
  { key: 'outline', label: 'Outline', type: 'checkbox' },
  { key: 'glow', label: 'Text Glow', type: 'range', min: 0, max: 20, step: 0.5 },
  { key: 'outlineColor', label: 'Outline Color', type: 'color' },
  { key: 'bgOpacity', label: 'BG Opacity', type: 'range', min: 0, max: 1, step: 0.01 },
  { key: 'bgPadding', label: 'BG Padding', type: 'range', min: 0, max: 6, step: 1 },
  { key: 'scale', label: 'Scale', type: 'range', min: 0.5, max: 4, step: 0.1 }
];

export const SVG_CONTROL_SCHEMA = [
  { key: 'svgContent', label: 'SVG Code', type: 'textarea', placeholder: '<svg>...</svg>' },
  { key: 'enabled', label: 'Enabled', type: 'checkbox' },
  { key: 'fgPalette', label: 'Shape Palette', type: 'select', options: ['inherit', ...Object.keys(PALETTES)] },
  { key: 'fgColor', label: 'Shape Color', type: 'color' },
  { key: 'fgIntensity', label: 'Shape Intensity', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'fgGlow', label: 'Shape Glow', type: 'range', min: 0, max: 20, step: 0.5 },
  { key: 'fgCharSet', label: 'Shape Charset', type: 'select', options: ['inherit', ...Object.keys(CHARSETS)] },
  { key: 'bgPalette', label: 'Background Palette', type: 'select', options: ['inherit', ...Object.keys(PALETTES)] },
  { key: 'bgColor', label: 'Background Color', type: 'color' },
  { key: 'bgIntensity', label: 'BG Intensity', type: 'range', min: 0, max: 2, step: 0.01 },
  { key: 'svgScale', label: 'SVG Scale', type: 'range', min: 0.25, max: 4, step: 0.01 },
  { key: 'svgX', label: 'SVG Offset X', type: 'range', min: -1, max: 1, step: 0.01 },
  { key: 'svgY', label: 'SVG Offset Y', type: 'range', min: -1, max: 1, step: 0.01 },
  { key: 'invert', label: 'Invert Shape', type: 'checkbox' },
  { key: 'blend', label: 'Blend Mode', type: 'select', options: ['add', 'screen', 'max', 'difference', 'multiply', 'overlay'] },
];

let idCounter = 1;
const nextId = (prefix) => `${prefix}-${idCounter++}`;

export function createDefaultSvgLayer(overrides = {}) {
  return {
    id: nextId('svg'),
    type: 'svg',
    svgContent: '',
    enabled: true,
    fgPalette: 'inherit',
    fgColor: '#ffffff',
    fgIntensity: 1,
    fgGlow: 0,
    fgCharSet: 'inherit',
    bgPalette: 'inherit',
    bgColor: '#000000',
    bgIntensity: 0,
    svgScale: 1,
    svgX: 0,
    svgY: 0,
    invert: false,
    blend: 'screen',
    _rasterCache: null,
    _rasterDirty: true,
    ...overrides,
  };
}

export function createDefaultLayer(overrides = {}) {
  return {
    id: nextId('layer'),
    name: 'Primary Layer',
    mode: 'matrix-rain',
    enabled: true,
    palette: 'inherit',
    blend: 'screen',
    intensity: 1,
    speed: 1,
    scale: 1,
    phase: 0,
    offsetX: 0,
    offsetY: 0,
    warp: 1,
    hueShift: 0,
    charBias: 0,
    ...overrides
  };
}

export function createDefaultText(overrides = {}) {
  return {
    id: nextId('text'),
    content: '',
    enabled: true,
    animation: 'pulse',
    x: 8,
    y: 4,
    speed: 1,
    amplitude: 2,
    phase: 0,
    spacing: 0,
    color: '#ffffff',
    bg: 'transparent',
    repeat: false,
    rainbow: false,
    outline: true,
    glow: 0,
    outlineColor: '#000000',
    bgOpacity: 1,
    bgPadding: 0,
    scale: 1,
    ...overrides
  };
}

export function createDefaultProject() {
  return {
    projectName: 'Ascii Arter',
    cols: 88,
    rows: 30,
    fontSize: 14,
    fpsCap: 30,
    palette: 'matrix',
    charSet: 'dense',
    customChars: ' .:-=+*#%@',
    background: '#05070d',
    brightness: 0,
    contrast: 1.15,
    gamma: 1,
    saturation: 1,
    hueShift: 0,
    density: 1,
    glow: 3,
    trail: 0.12,
    backgroundMix: 0.08,
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
    layers: [createDefaultLayer()],
    texts: [createDefaultText()],
    svgLayers: [],
    subject: {
      type: 'none',   // 'none' | 'text' | 'svg'
      text: '',
      svgContent: '',
      fgPalette: 'inherit',
      fgCharSet: 'inherit',
      bgIntensity: 0.08,
      textFont: 'bold',
      textLetterSpacing: 0,
      padding: 4,
    }
  };
}

export function cloneProject(project) {
  return JSON.parse(JSON.stringify(project));
}

export function normalizeProject(raw) {
  const base = createDefaultProject();
  const project = {
    ...base,
    ...raw,
    layers: Array.isArray(raw?.layers) && raw.layers.length
      ? raw.layers.map((layer, index) => createDefaultLayer({ ...layer, id: layer.id || nextId('layer'), name: layer.name || `Layer ${index + 1}` }))
      : base.layers,
    texts: Array.isArray(raw?.texts) && raw.texts.length
      ? raw.texts.map((text, index) => createDefaultText({ ...text, id: text.id || nextId('text'), content: text.content || `TEXT ${index + 1}` }))
      : base.texts,
    svgLayers: Array.isArray(raw?.svgLayers)
      ? raw.svgLayers.map((svg) => createDefaultSvgLayer({ ...svg, id: svg.id || nextId('svg'), _rasterDirty: true }))
      : [],
    subject: raw?.subject ? { ...base.subject, ...raw.subject } : base.subject
  };
  return project;
}
