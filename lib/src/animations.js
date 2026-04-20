const TAU = Math.PI * 2;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const fract = (value) => value - Math.floor(value);
const smoothstep = (value) => value * value * (3 - 2 * value);

function rotatePoint(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

function hash2(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;

  const h00 = hash2(x0, y0, seed);
  const h10 = hash2(x0 + 1, y0, seed);
  const h01 = hash2(x0, y0 + 1, seed);
  const h11 = hash2(x0 + 1, y0 + 1, seed);

  const u = smoothstep(xf);
  const v = smoothstep(yf);

  const xA = h00 + (h10 - h00) * u;
  const xB = h01 + (h11 - h01) * u;
  return xA + (xB - xA) * v;
}

function fbm(x, y, seed, octaves = 4) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 19) * amplitude;
    normalizer += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / normalizer;
}

function mode(id, name, family, options = {}) {
  return { id, name, family, ...options };
}

export const ANIMATION_MODES = [
  mode('matrix-rain', 'Matrix Rain', 'rain', { a: 1.2, b: 4.5, c: 1.4, hueBias: 0.02, palette: 'matrix' }),
  mode('bytefall', 'Bytefall', 'rain', { a: 1.4, b: 6.2, c: 1.1, hueBias: 0.12, palette: 'cyber' }),
  mode('code-cascade', 'Code Cascade', 'rain', { a: 0.9, b: 5.4, c: 1.7, hueBias: 0.18, palette: 'matrix' }),
  mode('mesh-rain', 'Mesh Rain', 'rain', { a: 1.7, b: 7.2, c: 1.2, hueBias: 0.24, palette: 'radar' }),
  mode('wavefield', 'Wavefield', 'wave', { a: 2.1, b: 1.4, c: 0.9, hueBias: 0.05, palette: 'ocean' }),
  mode('binary-wave', 'Binary Wave', 'wave', { a: 3.2, b: 0.8, c: 1.5, hueBias: 0.18, palette: 'mono' }),
  mode('signal-coast', 'Signal Coast', 'wave', { a: 1.6, b: 2.7, c: 1.1, hueBias: 0.27, palette: 'cyber' }),
  mode('tidal-scan', 'Tidal Scan', 'wave', { a: 0.7, b: 3.5, c: 1.3, hueBias: 0.31, palette: 'aurora' }),
  mode('helix-dna', 'Helix DNA', 'polar', { a: 5.5, b: 3.2, c: 1.2, hueBias: 0.09, palette: 'candy' }),
  mode('synth-spiral', 'Synth Spiral', 'polar', { a: 7.8, b: 2.1, c: 1.5, hueBias: 0.18, palette: 'synthwave' }),
  mode('vortex-grid', 'Vortex Grid', 'polar', { a: 4.7, b: 4.4, c: 1.8, hueBias: 0.26, palette: 'neon' }),
  mode('particle-spiral', 'Particle Spiral', 'polar', { a: 9.2, b: 2.8, c: 1.3, hueBias: 0.34, palette: 'sunset' }),
  mode('wormhole', 'Wormhole', 'tunnel', { a: 12, b: 2.5, c: 1.3, hueBias: 0.07, palette: 'neon' }),
  mode('gravity-well', 'Gravity Well', 'tunnel', { a: 8.4, b: 3.5, c: 1.8, hueBias: 0.14, palette: 'gold' }),
  mode('neon-tunnel', 'Neon Tunnel', 'tunnel', { a: 15.5, b: 1.9, c: 1.2, hueBias: 0.23, palette: 'cyber' }),
  mode('sunflare', 'Sunflare', 'tunnel', { a: 6.2, b: 4.2, c: 1.6, hueBias: 0.31, palette: 'fire' }),
  mode('plasma-wave', 'Plasma Wave', 'plasma', { a: 1.2, b: 1.6, c: 0.8, hueBias: 0.11, palette: 'neon' }),
  mode('plasma-arc', 'Plasma Arc', 'plasma', { a: 2.4, b: 0.9, c: 1.7, hueBias: 0.18, palette: 'synthwave' }),
  mode('aurora-noise', 'Aurora Noise', 'plasma', { a: 0.7, b: 2.6, c: 1.4, hueBias: 0.22, palette: 'aurora' }),
  mode('quantum-fizz', 'Quantum Fizz', 'plasma', { a: 3.4, b: 1.1, c: 2.1, hueBias: 0.29, palette: 'acid' }),
  mode('nebula-cloud', 'Nebula Cloud', 'noise', { a: 1.3, b: 3.1, c: 1.2, hueBias: 0.04, palette: 'synthwave' }),
  mode('frost-signal', 'Frost Signal', 'noise', { a: 2.2, b: 2.2, c: 1.4, hueBias: 0.12, palette: 'ice' }),
  mode('sandstorm', 'Sandstorm', 'noise', { a: 1.8, b: 4.3, c: 1.9, hueBias: 0.2, palette: 'gold' }),
  mode('moon-tide', 'Moon Tide', 'noise', { a: 0.9, b: 1.8, c: 1.5, hueBias: 0.28, palette: 'ocean' }),
  mode('cyber-checker', 'Cyber Checker', 'grid', { a: 8.4, b: 8.4, c: 0.7, hueBias: 0.06, palette: 'cyber' }),
  mode('circuit-bloom', 'Circuit Bloom', 'grid', { a: 14.5, b: 7.4, c: 1.3, hueBias: 0.16, palette: 'matrix' }),
  mode('moire-lattice', 'Moire Lattice', 'grid', { a: 10.2, b: 12.1, c: 1.4, hueBias: 0.25, palette: 'mono' }),
  mode('hive-sync', 'Hive Sync', 'grid', { a: 6.8, b: 13.2, c: 1.7, hueBias: 0.33, palette: 'acid' }),
  mode('equalizer', 'Equalizer', 'bars', { a: 11.1, b: 1.4, c: 1.1, hueBias: 0.08, palette: 'sunset' }),
  mode('skyline-bars', 'Skyline Bars', 'bars', { a: 7.2, b: 2.2, c: 1.6, hueBias: 0.15, palette: 'gold' }),
  mode('pulse-array', 'Pulse Array', 'bars', { a: 15.3, b: 1.1, c: 1.9, hueBias: 0.22, palette: 'candy' }),
  mode('vector-scan', 'Vector Scan', 'bars', { a: 5.6, b: 3.6, c: 1.2, hueBias: 0.31, palette: 'radar' }),
  mode('orbital-weave', 'Orbital Weave', 'orbit', { a: 3.2, b: 0.9, c: 1.3, hueBias: 0.03, palette: 'neon' }),
  mode('byte-orbit', 'Byte Orbit', 'orbit', { a: 5.7, b: 1.3, c: 1.8, hueBias: 0.11, palette: 'cyber' }),
  mode('comet-trails', 'Comet Trails', 'orbit', { a: 2.1, b: 2.4, c: 1.5, hueBias: 0.21, palette: 'fire' }),
  mode('starfield', 'Starfield', 'orbit', { a: 7.1, b: 0.6, c: 1.1, hueBias: 0.3, palette: 'ice' }),
  mode('ripple-pond', 'Ripple Pond', 'ripple', { a: 10.2, b: 2.8, c: 1.4, hueBias: 0.05, palette: 'aurora' }),
  mode('sonar-bloom', 'Sonar Bloom', 'ripple', { a: 13.5, b: 3.4, c: 1.8, hueBias: 0.14, palette: 'radar' }),
  mode('heartbeat', 'Heartbeat', 'ripple', { a: 8.8, b: 5.4, c: 2.1, hueBias: 0.22, palette: 'ember' }),
  mode('pulse-vortex', 'Pulse Vortex', 'ripple', { a: 16.2, b: 4.1, c: 1.3, hueBias: 0.29, palette: 'synthwave' }),
  mode('fire-column', 'Fire Column', 'flame', { a: 1.5, b: 5.1, c: 1.2, hueBias: 0.03, palette: 'fire' }),
  mode('ember-drift', 'Ember Drift', 'flame', { a: 0.9, b: 3.4, c: 1.7, hueBias: 0.13, palette: 'ember' }),
  mode('stormfront', 'Stormfront', 'flame', { a: 1.8, b: 6.8, c: 1.6, hueBias: 0.21, palette: 'ocean' }),
  mode('acid-melt', 'Acid Melt', 'flame', { a: 1.2, b: 4.4, c: 1.9, hueBias: 0.3, palette: 'acid' }),
  mode('crystal-cascade', 'Crystal Cascade', 'crystal', { a: 7.2, b: 1.4, c: 1.1, hueBias: 0.04, palette: 'ice' }),
  mode('frost-crystal', 'Frost Crystal', 'crystal', { a: 11.4, b: 2.6, c: 1.4, hueBias: 0.12, palette: 'ice' }),
  mode('prism-shift', 'Prism Shift', 'crystal', { a: 9.1, b: 3.2, c: 1.8, hueBias: 0.21, palette: 'candy' }),
  mode('shard-field', 'Shard Field', 'crystal', { a: 13.8, b: 4.1, c: 1.5, hueBias: 0.29, palette: 'gold' }),
  mode('thunderlines', 'Thunderlines', 'storm', { a: 6.4, b: 4.2, c: 1.3, hueBias: 0.08, palette: 'cyber' }),
  mode('radar-sweep', 'Radar Sweep', 'storm', { a: 3.2, b: 7.4, c: 1.1, hueBias: 0.16, palette: 'radar' }),
  mode('wavepackets', 'Wavepackets', 'storm', { a: 9.2, b: 5.6, c: 1.7, hueBias: 0.24, palette: 'aurora' }),
  mode('torus-signal', 'Torus Signal', 'storm', { a: 4.1, b: 8.2, c: 1.9, hueBias: 0.33, palette: 'neon' }),
  mode('signal-loss', 'Signal Loss', 'glitch', { a: 17.1, b: 2.4, c: 1.2, hueBias: 0.05, palette: 'mono' }),
  mode('static-burst', 'Static Burst', 'glitch', { a: 13.4, b: 4.3, c: 1.5, hueBias: 0.12, palette: 'mono' }),
  mode('glitch-reef', 'Glitch Reef', 'glitch', { a: 8.8, b: 6.4, c: 1.7, hueBias: 0.22, palette: 'cyber' }),
  mode('monolith', 'Monolith', 'glitch', { a: 5.1, b: 3.3, c: 2.1, hueBias: 0.31, palette: 'gold' }),
  mode('caustic-net', 'Caustic Net', 'caustic', { a: 2.5, b: 9.8, c: 1.2, hueBias: 0.07, palette: 'ocean' }),
  mode('tidepool', 'Tidepool', 'caustic', { a: 4.7, b: 7.1, c: 1.4, hueBias: 0.16, palette: 'aurora' }),
  mode('fractal-bloom', 'Fractal Bloom', 'caustic', { a: 1.8, b: 11.3, c: 1.8, hueBias: 0.24, palette: 'synthwave' }),
  mode('kaleido', 'Kaleido', 'caustic', { a: 3.6, b: 13.8, c: 2.1, hueBias: 0.32, palette: 'candy' })
];

export const MODE_BY_ID = Object.fromEntries(ANIMATION_MODES.map((modeItem) => [modeItem.id, modeItem]));

export function sampleMode(mode, x, y, t, project, layer) {
  const scale = Math.max(0.001, layer.scale * project.zoom);
  let u = x / scale + project.offsetX + layer.offsetX;
  let v = y / scale + project.offsetY + layer.offsetY;

  if (project.mirrorX) u = Math.abs(u);
  if (project.mirrorY) v = Math.abs(v);

  const rotation = ((project.rotation + layer.hueShift * 0.04) * Math.PI) / 180;
  [u, v] = rotatePoint(u, v, rotation);

  const amp = project.amplitude * Math.max(0.15, layer.warp);
  const freq = project.frequency;
  const turbulence = project.turbulence;
  const time = t * project.speed * layer.speed + layer.phase;
  const radius = Math.sqrt(u * u + v * v) + 1e-5;
  const angle = Math.atan2(v, u);
  const n1 = fbm(u * 1.7 + time * 0.11, v * 1.7 - time * 0.07, project.seed, 3);
  const n2 = fbm(u * 3.1 - time * 0.09, v * 3.1 + time * 0.13, project.seed + 41, 4);

  let value = 0;

  switch (mode.family) {
    case 'rain': {
      const stream = fract(v * mode.b + time * mode.a + valueNoise(u * 3 + n1 * turbulence * 3, 0, project.seed));
      const columns = Math.sin((u * mode.c + n2 * turbulence) * TAU * freq) * 0.5 + 0.5;
      value = (1 - stream) * columns;
      break;
    }
    case 'wave': {
      const w1 = Math.sin((u * mode.a + time * mode.c) * TAU * freq);
      const w2 = Math.cos((v * mode.b - time * mode.a * 0.5) * TAU * (freq * 0.8));
      const w3 = Math.sin(((u + v) * mode.c + n1 * turbulence) * TAU);
      value = (w1 + w2 + w3) / 6 + 0.5;
      break;
    }
    case 'polar': {
      const spiral = Math.sin(angle * mode.a + radius * mode.b * 4 - time * mode.c * TAU);
      const rings = Math.cos(radius * mode.b * 9 - time * mode.a);
      value = (spiral + rings) / 4 + 0.5;
      break;
    }
    case 'tunnel': {
      const tunnel = Math.cos(radius * mode.a * 8 - time * mode.b * TAU + angle * mode.c);
      value = clamp01((1 / (radius * mode.b * 4 + 0.18)) * 0.45 + tunnel * 0.35 + 0.28);
      break;
    }
    case 'plasma': {
      const p1 = Math.sin((u * mode.a + time * 0.6) * TAU);
      const p2 = Math.sin((v * mode.b - time * 0.4) * TAU);
      const p3 = Math.sin((u + v + time * mode.c + n2 * turbulence) * TAU);
      value = (p1 + p2 + p3) / 6 + 0.5;
      break;
    }
    case 'noise': {
      const cloud = fbm(u * mode.a * freq + time * 0.2, v * mode.b * freq - time * 0.18, project.seed + mode.b * 10, 5);
      const ridge = 1 - Math.abs(cloud * 2 - 1);
      value = clamp01(ridge * 0.7 + n2 * 0.3 * mode.c);
      break;
    }
    case 'grid': {
      const gx = Math.sin(u * mode.a * TAU + time * mode.c);
      const gy = Math.sin(v * mode.b * TAU - time * mode.c * 0.7);
      value = clamp01(1 - (Math.abs(gx) * 0.55 + Math.abs(gy) * 0.55) + n1 * 0.25 * turbulence);
      break;
    }
    case 'bars': {
      const band = Math.sin((u * mode.a + time * mode.b) * TAU);
      const modulation = Math.sin((v * mode.c - time * 0.45) * TAU * 0.5);
      value = clamp01((band * 0.5 + 0.5) * (0.55 + modulation * 0.45));
      break;
    }
    case 'orbit': {
      const orbitX = Math.cos(time * mode.b + n1 * turbulence) * 0.55;
      const orbitY = Math.sin(time * mode.a * 0.35 + n2 * turbulence) * 0.55;
      const dx = u - orbitX;
      const dy = v - orbitY;
      const d = Math.sqrt(dx * dx + dy * dy);
      value = clamp01(1 - d * mode.a * 0.25 + Math.sin(angle * mode.c * 4 + time) * 0.2);
      break;
    }
    case 'ripple': {
      const ripple = Math.sin(radius * mode.a * TAU - time * mode.b * 2);
      const bloom = Math.exp(-radius * mode.c * 1.5);
      value = clamp01((ripple * 0.5 + 0.5) * bloom + n1 * 0.18);
      break;
    }
    case 'flame': {
      const plume = Math.pow(clamp01(1 - (v + 1) * 0.5), 1.35);
      const flicker = fbm(u * mode.b + time * 0.65, v * mode.a - time * mode.c, project.seed + 99, 4);
      value = clamp01(plume * (0.35 + flicker * 0.95));
      break;
    }
    case 'crystal': {
      const facets = Math.abs(Math.sin(u * mode.a * TAU + time * 0.2)) + Math.abs(Math.cos(v * mode.b * TAU - time * 0.28));
      const shards = Math.abs(Math.sin((u + v) * mode.c * TAU + n1 * turbulence * 3));
      value = clamp01(1 - Math.abs(facets * 0.5 - shards * 0.65));
      break;
    }
    case 'storm': {
      const sweep = Math.sin(angle * mode.a + time * mode.b * 0.7 + radius * mode.c * 6);
      const electric = Math.abs(Math.sin((u * v * mode.b + n2 * turbulence * 2) * TAU));
      value = clamp01((sweep * 0.4 + 0.5) * 0.45 + electric * 0.65);
      break;
    }
    case 'glitch': {
      const qx = Math.floor((u + time * 0.18) * mode.a) / mode.a;
      const qy = Math.floor((v - time * 0.11) * mode.b) / mode.b;
      const block = valueNoise(qx * mode.c * 4, qy * mode.c * 4, project.seed + 155);
      const streak = Math.sin(v * mode.a * 2 + time * mode.c * 5);
      value = clamp01(block * 0.8 + (streak * 0.5 + 0.5) * 0.3);
      break;
    }
    case 'caustic': {
      const c1 = Math.sin((u * mode.a + Math.sin(v * mode.c + time)) * TAU);
      const c2 = Math.cos((v * mode.b + Math.sin(u * mode.a - time * 0.8)) * TAU);
      value = clamp01((c1 + c2) / 4 + 0.5 + n2 * 0.12);
      break;
    }
    default:
      value = 0;
  }

  value = clamp01(value * layer.intensity + layer.charBias * 0.1);
  return value;
}
