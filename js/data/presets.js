import { cloneProject, createDefaultLayer, createDefaultProject, createDefaultText } from './config.js';

function projectWith(overrides) {
  return { ...createDefaultProject(), ...overrides };
}

export const BUILTIN_PRESETS = [
  {
    id: 'matrix-cathedral',
    name: 'Matrix Cathedral',
    project: projectWith({
      projectName: 'Matrix Cathedral',
      palette: 'matrix',
      charSet: 'matrix',
      background: '#030806',
      trail: 0.28,
      glow: 12,
      speed: 1.1,
      layers: [
        createDefaultLayer({ name: 'Matrix Rain', mode: 'matrix-rain', palette: 'matrix', blend: 'screen', intensity: 1.1, scale: 1 }),
        createDefaultLayer({ name: 'Circuit Bloom', mode: 'circuit-bloom', palette: 'radar', blend: 'add', intensity: 0.55, scale: 1.4, speed: 0.7, warp: 1.4 })
      ],
      texts: [createDefaultText({ content: '', animation: 'pulse', x: 10, y: 4, color: '#d7ffe9' })]
    })
  },
  {
    id: 'synthwave-core',
    name: 'Synthwave Core',
    project: projectWith({
      projectName: 'Synthwave Core',
      palette: 'synthwave',
      charSet: 'blocks',
      background: '#0a0411',
      trail: 0.16,
      glow: 14,
      hueShift: 18,
      layers: [
        createDefaultLayer({ name: 'Tunnel', mode: 'neon-tunnel', palette: 'synthwave', blend: 'screen', intensity: 1.1 }),
        createDefaultLayer({ name: 'Pulse', mode: 'pulse-vortex', palette: 'candy', blend: 'add', intensity: 0.58, speed: 0.8, scale: 1.35 })
      ],
      texts: [createDefaultText({ content: '', animation: 'marquee', x: 8, y: 6, color: '#fff2cc', outline: true })]
    })
  },
  {
    id: 'aurora-terminal',
    name: 'Aurora Terminal',
    project: projectWith({
      projectName: 'Aurora Terminal',
      palette: 'aurora',
      charSet: 'dense',
      background: '#020911',
      saturation: 1.3,
      brightness: 0.04,
      layers: [
        createDefaultLayer({ name: 'Aurora', mode: 'aurora-noise', palette: 'aurora', blend: 'screen', intensity: 1.05, scale: 1.1 }),
        createDefaultLayer({ name: 'Tidal', mode: 'tidepool', palette: 'ocean', blend: 'max', intensity: 0.65, speed: 0.75, scale: 1.5 })
      ],
      texts: [createDefaultText({ content: '', animation: 'wave', x: 6, y: 5, color: '#caf0f8' })]
    })
  },
  {
    id: 'frost-grid',
    name: 'Frost Grid',
    project: projectWith({
      projectName: 'Frost Grid',
      palette: 'ice',
      charSet: 'technical',
      background: '#020817',
      trail: 0.09,
      layers: [
        createDefaultLayer({ name: 'Crystals', mode: 'frost-crystal', palette: 'ice', blend: 'screen', intensity: 1, scale: 1.25 }),
        createDefaultLayer({ name: 'Lattice', mode: 'moire-lattice', palette: 'mono', blend: 'difference', intensity: 0.5, speed: 0.55, scale: 1.8 })
      ],
      texts: [createDefaultText({ content: '', animation: 'drift', x: 12, y: 7, color: '#f1fdff' })]
    })
  },
  {
    id: 'solar-breach',
    name: 'Solar Breach',
    project: projectWith({
      projectName: 'Solar Breach',
      palette: 'fire',
      charSet: 'blocks',
      background: '#110400',
      trail: 0.22,
      glow: 16,
      layers: [
        createDefaultLayer({ name: 'Fire Column', mode: 'fire-column', palette: 'fire', blend: 'screen', intensity: 1.2, scale: 0.95 }),
        createDefaultLayer({ name: 'Sunflare', mode: 'sunflare', palette: 'gold', blend: 'add', intensity: 0.65, speed: 0.7, scale: 1.6 })
      ],
      texts: [createDefaultText({ content: '', animation: 'pulse', x: 7, y: 4, color: '#fff4cc' })]
    })
  },
  {
    id: 'radar-dream',
    name: 'Radar Dream',
    project: projectWith({
      projectName: 'Radar Dream',
      palette: 'radar',
      charSet: 'wire',
      background: '#020800',
      trail: 0.34,
      layers: [
        createDefaultLayer({ name: 'Sweep', mode: 'radar-sweep', palette: 'radar', blend: 'screen', intensity: 0.95, scale: 1 }),
        createDefaultLayer({ name: 'Bloom', mode: 'sonar-bloom', palette: 'matrix', blend: 'add', intensity: 0.52, speed: 0.82, scale: 1.45 })
      ],
      texts: [createDefaultText({ content: '', animation: 'orbit', x: 22, y: 11, color: '#f2fff2', outline: false })]
    })
  },
  {
    id: 'byte-storm',
    name: 'Byte Storm',
    project: projectWith({
      projectName: 'Byte Storm',
      palette: 'cyber',
      charSet: 'binary',
      background: '#030511',
      density: 1.3,
      speed: 1.25,
      layers: [
        createDefaultLayer({ name: 'Bytefall', mode: 'bytefall', palette: 'cyber', blend: 'screen', intensity: 1.1 }),
        createDefaultLayer({ name: 'Static', mode: 'signal-loss', palette: 'mono', blend: 'difference', intensity: 0.5, speed: 1.6, scale: 1.8 })
      ],
      texts: [createDefaultText({ content: '', animation: 'marquee', x: 4, y: 3, color: '#f5f5f5', outline: false })]
    })
  },
  {
    id: 'liquid-gold',
    name: 'Liquid Gold',
    project: projectWith({
      projectName: 'Liquid Gold',
      palette: 'gold',
      charSet: 'dense',
      background: '#120d02',
      brightness: 0.05,
      contrast: 1.28,
      layers: [
        createDefaultLayer({ name: 'Caustic', mode: 'caustic-net', palette: 'gold', blend: 'screen', intensity: 1.05, scale: 1.1 }),
        createDefaultLayer({ name: 'Bloom', mode: 'fractal-bloom', palette: 'sunset', blend: 'add', intensity: 0.45, speed: 0.62, scale: 1.7 })
      ],
      texts: [createDefaultText({ content: '', animation: 'bounce', x: 14, y: 8, color: '#fff4cc' })]
    })
  },
  {
    id: 'dream-candy',
    name: 'Dream Candy',
    project: projectWith({
      projectName: 'Dream Candy',
      palette: 'candy',
      charSet: 'classic',
      background: '#130012',
      saturation: 1.45,
      layers: [
        createDefaultLayer({ name: 'Kaleido', mode: 'kaleido', palette: 'candy', blend: 'screen', intensity: 1.1, scale: 1 }),
        createDefaultLayer({ name: 'Orbit', mode: 'orbital-weave', palette: 'synthwave', blend: 'add', intensity: 0.42, speed: 0.86, scale: 1.42 })
      ],
      texts: [createDefaultText({ content: '', animation: 'wave', x: 20, y: 9, color: '#fff0f6', rainbow: true })]
    })
  },
  {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    project: projectWith({
      projectName: 'Deep Ocean',
      palette: 'ocean',
      charSet: 'dense',
      background: '#02101b',
      trail: 0.24,
      layers: [
        createDefaultLayer({ name: 'Moon Tide', mode: 'moon-tide', palette: 'ocean', blend: 'screen', intensity: 0.96, scale: 1.1 }),
        createDefaultLayer({ name: 'Ripple Pond', mode: 'ripple-pond', palette: 'aurora', blend: 'add', intensity: 0.6, speed: 0.92, scale: 1.55 })
      ],
      texts: [createDefaultText({ content: '', animation: 'drift', x: 18, y: 5, color: '#dff6ff' })]
    })
  },
  {
    id: 'terminal-monolith',
    name: 'Terminal Monolith',
    project: projectWith({
      projectName: 'Terminal Monolith',
      palette: 'mono',
      charSet: 'technical',
      background: '#040404',
      trail: 0.1,
      glow: 6,
      layers: [
        createDefaultLayer({ name: 'Monolith', mode: 'monolith', palette: 'mono', blend: 'screen', intensity: 1.1, scale: 1.25 }),
        createDefaultLayer({ name: 'Vector', mode: 'vector-scan', palette: 'mono', blend: 'difference', intensity: 0.35, speed: 0.7, scale: 1.8 })
      ],
      texts: [createDefaultText({ content: '', animation: 'static', x: 14, y: 5, color: '#ffffff', outline: false })]
    })
  }
];

export function getPresetById(id) {
  const preset = BUILTIN_PRESETS.find((item) => item.id === id);
  return preset ? cloneProject(preset.project) : null;
}
