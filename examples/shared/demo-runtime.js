import AsciiBackground, { parseProjectData } from '../../lib/dist/ascii-arter.esm.js';

async function mountAscii(selector, file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`Failed to load ${file}: ${response.status}`);
  const json = await response.text();
  const instance = AsciiBackground.mount(selector, parseProjectData(json));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) instance.pause();
  return instance;
}

export async function mountDualDemo({
  heroSelector = '#heroBg',
  heroFile = './hero.json',
  ctaSelector = '#ctaBg',
  ctaFile = './cta.json',
  name = 'Example',
} = {}) {
  try {
    const [hero, cta] = await Promise.all([
      mountAscii(heroSelector, heroFile),
      mountAscii(ctaSelector, ctaFile),
    ]);

    window.__demoInstances = { hero, cta };
    document.documentElement.dataset.demoReady = 'true';
    return { hero, cta };
  } catch (error) {
    console.error(`${name} demo failed`, error);
    document.documentElement.dataset.demoReady = 'error';
    throw error;
  }
}
