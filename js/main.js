import {
  BLEND_MODES,
  CHARSETS,
  GLOBAL_CONTROL_SECTIONS,
  LAYER_CONTROL_SCHEMA,
  PALETTES,
  TEXT_ANIMATIONS,
  TEXT_CONTROL_SCHEMA,
  SVG_CONTROL_SCHEMA,
  cloneProject,
  createDefaultLayer,
  createDefaultProject,
  createDefaultText,
  createDefaultSvgLayer,
  normalizeProject
} from './data/config.js';
import { ANIMATION_MODES, MODE_BY_ID, sampleMode } from './data/animations.js';
import { BUILTIN_PRESETS, getPresetById } from './data/presets.js';
import { AsciiRenderer, FrameBuffer } from './core/engine.js';
import { downloadText, exportCanvasPNG, exportHTMLSnapshot, exportProjectJSON, importProjectJSON } from './core/exporters.js';

const dom = {};
let project = createDefaultProject();
let renderer;
let buffer;
let selectedLayerId = project.layers[0].id;
let selectedTextId = project.texts[0].id;
let selectedSvgLayerId = null;
let frameValues = new Float32Array(project.cols * project.rows);
let isPlaying = true;
let timeline = 0;
let lastTick = 0;
let lastRenderDuration = 0;
let currentFps = 0;
let fpsFrames = 0;
let fpsWindow = 0;
let needsRedraw = true;
let lastFrameTextRefresh = 0;
// ── SUBJECT MASK ──
let subjectMask = null; // Float32Array | null
let subjectDirty = true;
const controlRefs = new Map();
const paletteCache = new Map(Object.entries(PALETTES).map(([name, stops]) => [name, stops.map(hexToRgb)]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const fract = (value) => value - Math.floor(value);

window.addEventListener('DOMContentLoaded', init);

function init() {
  bindDom();
  renderer = new AsciiRenderer(dom.stageCanvas);
  buffer = new FrameBuffer(project.cols, project.rows);

  buildGlobalControls();
  populatePresetSelect();
  bindButtons();
  resizeScene();
  renderLists();
  renderInspectors();
  syncGlobalControls();
  updateProjectLabel();
  refreshFrameOutput(true);

  fpsWindow = performance.now();
  requestAnimationFrame(loop);
}

function bindDom() {
  const ids = [
    'presetSelect', 'controlsContent', 'projectTitleLabel', 'stageCanvas', 'frameOutput',
    'fpsStat', 'renderStat', 'cellsStat', 'layersStat', 'statusStat', 'playPauseBtn',
    'randomizeBtn', 'shuffleCharsetBtn', 'savePresetBtn', 'importBtn', 'exportProjectBtn',
    'importProjectInput', 'copyFrameBtn', 'exportTxtBtn', 'exportPngBtn', 'exportHtmlBtn',
    'refreshFrameBtn', 'layersList', 'textsList', 'layerInspector', 'textInspector',
    'addLayerBtn', 'removeLayerBtn', 'duplicateLayerBtn', 'moveLayerUpBtn', 'moveLayerDownBtn',
    'addTextBtn', 'removeTextBtn', 'duplicateTextBtn',
    'svgLayersList', 'svgLayerInspector', 'addSvgLayerBtn', 'removeSvgLayerBtn',
    'svgUploadInput', 'presetsGalleryBtn', 'presetsModal', 'presetsModalClose', 'presetsGrid'
  ];

  ids.forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

function bindButtons() {
  dom.playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    dom.playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    setStatus(isPlaying ? 'Playback resumed' : 'Playback paused');
    needsRedraw = true;
  });

  dom.randomizeBtn.addEventListener('click', () => {
    randomizeProject();
    applyProject(project, { keepPresetSelection: false, status: 'Randomized scene' });
  });

  dom.shuffleCharsetBtn.addEventListener('click', () => {
    const sets = Object.keys(CHARSETS);
    project.charSet = sets[Math.floor(Math.random() * sets.length)];
    project.customChars = shuffleString((project.customChars || CHARSETS.classic).replace(/\s+/g, ' ') || CHARSETS.classic);
    syncGlobalControls();
    setStatus(`Charset changed to ${project.charSet}`);
    needsRedraw = true;
  });

  dom.savePresetBtn.addEventListener('click', () => saveCurrentPreset());
  dom.importBtn.addEventListener('click', () => dom.importProjectInput.click());
  dom.exportProjectBtn.addEventListener('click', () => downloadText(fileBaseName() + '.json', exportProjectJSON(project)));
  dom.importProjectInput.addEventListener('change', handleImportProject);

  dom.copyFrameBtn.addEventListener('click', async () => {
    refreshFrameOutput(true);
    await navigator.clipboard.writeText(dom.frameOutput.value);
    setStatus('ASCII frame copied to clipboard');
  });

  dom.exportTxtBtn.addEventListener('click', () => {
    refreshFrameOutput(true);
    downloadText(fileBaseName() + '.txt', dom.frameOutput.value);
  });

  dom.exportPngBtn.addEventListener('click', () => exportCanvasPNG(dom.stageCanvas, fileBaseName() + '.png'));

  dom.exportHtmlBtn.addEventListener('click', () => {
    refreshFrameOutput(true);
    downloadText(fileBaseName() + '-snapshot.html', exportHTMLSnapshot(project, dom.frameOutput.value));
  });

  dom.refreshFrameBtn.addEventListener('click', () => {
    refreshFrameOutput(true);
    setStatus('ASCII text snapshot refreshed');
  });

  dom.presetSelect.addEventListener('change', () => {
    const value = dom.presetSelect.value;
    if (!value) return;

    if (value.startsWith('builtin:')) {
      const preset = getPresetById(value.replace('builtin:', ''));
      if (preset) {
        project = normalizeProject(preset);
        selectedLayerId = project.layers[0]?.id || selectedLayerId;
        selectedTextId = project.texts[0]?.id || selectedTextId;
        applyProject(project, { keepPresetSelection: true, status: `Loaded ${preset.projectName || 'preset'}` });
      }
      return;
    }

    if (value.startsWith('saved:')) {
      const presets = getSavedPresets();
      const preset = presets.find((item) => item.id === value.replace('saved:', ''));
      if (preset) {
        project = normalizeProject(preset.project);
        selectedLayerId = project.layers[0]?.id || selectedLayerId;
        selectedTextId = project.texts[0]?.id || selectedTextId;
        applyProject(project, { keepPresetSelection: true, status: `Loaded ${preset.name}` });
      }
    }
  });

  dom.addLayerBtn.addEventListener('click', () => {
    const layer = createDefaultLayer({
      name: `Layer ${project.layers.length + 1}`,
      mode: ANIMATION_MODES[Math.floor(Math.random() * ANIMATION_MODES.length)].id,
      palette: 'inherit',
      blend: BLEND_MODES[Math.floor(Math.random() * BLEND_MODES.length)].value
    });
    project.layers.push(layer);
    selectedLayerId = layer.id;
    renderLists();
    renderInspectors();
    setStatus('Added animation layer');
    needsRedraw = true;
  });

  dom.removeLayerBtn.addEventListener('click', () => {
    if (project.layers.length <= 1) {
      setStatus('At least one animation layer is required');
      return;
    }
    project.layers = project.layers.filter((layer) => layer.id !== selectedLayerId);
    selectedLayerId = project.layers[0].id;
    renderLists();
    renderInspectors();
    setStatus('Removed animation layer');
    needsRedraw = true;
  });

  dom.duplicateLayerBtn.addEventListener('click', () => {
    const active = getSelectedLayer();
    if (!active) return;
    const { id: _ignoredId, ...rest } = cloneProject(active);
    const duplicate = createDefaultLayer({ ...rest, name: `${active.name} Copy` });
    project.layers.splice(project.layers.indexOf(active) + 1, 0, duplicate);
    selectedLayerId = duplicate.id;
    renderLists();
    renderInspectors();
    setStatus('Duplicated animation layer');
    needsRedraw = true;
  });

  dom.moveLayerUpBtn.addEventListener('click', () => moveLayer(-1));
  dom.moveLayerDownBtn.addEventListener('click', () => moveLayer(1));

  dom.addTextBtn.addEventListener('click', () => {
    const text = createDefaultText({ content: `TEXT ${project.texts.length + 1}`, x: 6, y: 8 + project.texts.length * 2 });
    project.texts.push(text);
    selectedTextId = text.id;
    renderLists();
    renderInspectors();
    setStatus('Added text layer');
    needsRedraw = true;
  });

  dom.removeTextBtn.addEventListener('click', () => {
    if (project.texts.length <= 1) {
      setStatus('At least one text layer is required');
      return;
    }
    project.texts = project.texts.filter((text) => text.id !== selectedTextId);
    selectedTextId = project.texts[0].id;
    renderLists();
    renderInspectors();
    setStatus('Removed text layer');
    needsRedraw = true;
  });

  dom.duplicateTextBtn.addEventListener('click', () => {
    const active = getSelectedText();
    if (!active) return;
    const { id: _ignoredId, ...rest } = cloneProject(active);
    const duplicate = createDefaultText({ ...rest, content: `${active.content} COPY`, x: active.x + 2, y: active.y + 2 });
    project.texts.push(duplicate);
    selectedTextId = duplicate.id;
    renderLists();
    renderInspectors();
    setStatus('Duplicated text layer');
    needsRedraw = true;
  });

  // Preset Gallery
  dom.presetsGalleryBtn.addEventListener('click', () => openPresetsModal());
  dom.presetsModalClose.addEventListener('click', () => closePresetsModal());
  dom.presetsModal.addEventListener('click', (e) => { if (e.target === dom.presetsModal) closePresetsModal(); });

  // SVG Layers
  dom.addSvgLayerBtn.addEventListener('click', () => {
    const layer = createDefaultSvgLayer();
    project.svgLayers.push(layer);
    selectedSvgLayerId = layer.id;
    renderSvgList();
    renderSvgInspector();
    setStatus('Added SVG layer');
    needsRedraw = true;
  });

  dom.removeSvgLayerBtn.addEventListener('click', () => {
    if (!project.svgLayers.length) return;
    project.svgLayers = project.svgLayers.filter((l) => l.id !== selectedSvgLayerId);
    selectedSvgLayerId = project.svgLayers[0]?.id || null;
    svgRasterCache.clear();
    renderSvgList();
    renderSvgInspector();
    setStatus('Removed SVG layer');
    needsRedraw = true;
  });

  dom.svgUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const layer = getSelectedSvgLayer();
    if (layer) {
      layer.svgContent = text;
      layer._rasterDirty = true;
      rasterizeSvg(layer);
      renderSvgInspector();
      needsRedraw = true;
    }
    e.target.value = '';
  });

  // ── SUBJECT PANEL BINDINGS ──
  document.querySelectorAll('.subject-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (!project.subject) project.subject = {};
      project.subject.type = type;
      // Sync all subject-tab active states
      document.querySelectorAll('.subject-tab').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
      // Highlight the active textarea
      const textTA = document.getElementById('subjectTextInput');
      const svgTA = document.getElementById('subjectSvgInput');
      if (textTA) textTA.classList.toggle('active-subject', type === 'text');
      if (svgTA) svgTA.classList.toggle('active-subject', type === 'svg');
      // Legacy hidden sections (if they still exist)
      const textArea = document.getElementById('subjectTextArea');
      const svgArea = document.getElementById('subjectSvgArea');
      const opts = document.getElementById('subjectOptions');
      if (textArea) textArea.style.display = type === 'text' ? '' : 'none';
      if (svgArea) svgArea.style.display = type === 'svg' ? '' : 'none';
      if (opts) opts.style.display = type !== 'none' ? '' : 'none';
      subjectDirty = true;
      needsRedraw = true;
    });
  });

  // Clear button
  const subjectClearBtn = document.getElementById('subjectClearBtn');
  if (subjectClearBtn) {
    subjectClearBtn.addEventListener('click', () => {
      const textTA = document.getElementById('subjectTextInput');
      const svgTA = document.getElementById('subjectSvgInput');
      if (textTA) { textTA.value = ''; textTA.classList.remove('active-subject'); }
      if (svgTA) { svgTA.value = ''; svgTA.classList.remove('active-subject'); }
      if (project.subject) { project.subject.type = 'none'; project.subject.text = ''; project.subject.svgContent = ''; }
      document.querySelectorAll('.subject-tab').forEach((b) => b.classList.toggle('active', b.dataset.type === 'none'));
      subjectDirty = true;
      needsRedraw = true;
    });
  }

  const subjectTextInput = document.getElementById('subjectTextInput');
  if (subjectTextInput) {
    subjectTextInput.addEventListener('input', () => {
      if (!project.subject) project.subject = {};
      project.subject.text = subjectTextInput.value;
      subjectDirty = true;
      needsRedraw = true;
    });
  }

  const subjectSvgInput = document.getElementById('subjectSvgInput');
  if (subjectSvgInput) {
    subjectSvgInput.addEventListener('input', () => {
      if (!project.subject) project.subject = {};
      project.subject.svgContent = subjectSvgInput.value;
      subjectDirty = true;
      needsRedraw = true;
    });
  }

  const subjectSvgUpload = document.getElementById('subjectSvgUpload');
  const subjectSvgFileInput = document.getElementById('subjectSvgFileInput');
  if (subjectSvgUpload && subjectSvgFileInput) {
    subjectSvgUpload.addEventListener('click', () => subjectSvgFileInput.click());
    subjectSvgFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (subjectSvgInput) subjectSvgInput.value = text;
      if (!project.subject) project.subject = {};
      project.subject.svgContent = text;
      subjectDirty = true;
      needsRedraw = true;
      e.target.value = '';
    });
  }

  const subjectFontWeight = document.getElementById('subjectFontWeight');
  if (subjectFontWeight) {
    subjectFontWeight.addEventListener('change', () => {
      if (!project.subject) project.subject = {};
      project.subject.textFont = subjectFontWeight.value;
      subjectDirty = true;
      needsRedraw = true;
    });
  }

  const subjectBgIntensity = document.getElementById('subjectBgIntensity');
  if (subjectBgIntensity) {
    subjectBgIntensity.addEventListener('input', () => {
      if (!project.subject) project.subject = {};
      project.subject.bgIntensity = Number(subjectBgIntensity.value);
      needsRedraw = true;
    });
  }

  const subjectPadding = document.getElementById('subjectPadding');
  if (subjectPadding) {
    subjectPadding.addEventListener('input', () => {
      if (!project.subject) project.subject = {};
      project.subject.padding = Number(subjectPadding.value);
      subjectDirty = true;
      needsRedraw = true;
    });
  }
}

function buildGlobalControls() {
  dom.controlsContent.innerHTML = '';
  controlRefs.clear();

  GLOBAL_CONTROL_SECTIONS.forEach((section) => {
    const group = document.createElement('section');
    group.className = 'controlGroup';

    const title = document.createElement('h3');
    title.textContent = section.title;
    group.appendChild(title);

    section.controls.forEach((control) => {
      const field = createField(control, project[control.key], (value) => {
        project[control.key] = value;
        if (['cols', 'rows', 'fontSize'].includes(control.key)) {
          resizeScene();
        }
        updateProjectLabel();
        needsRedraw = true;
      });
      group.appendChild(field.wrapper);
      controlRefs.set(control.key, field);
    });

    dom.controlsContent.appendChild(group);
  });
}

function createField(control, value, onChange) {
  const wrapper = document.createElement('label');
  wrapper.className = control.type === 'checkbox' ? 'checkboxField' : 'field';

  const labelRow = document.createElement('div');
  labelRow.className = 'fieldLabelRow';

  const label = document.createElement('span');
  label.textContent = control.label;
  labelRow.appendChild(label);

  let valueEl = null;
  if (control.type !== 'checkbox') {
    valueEl = document.createElement('span');
    valueEl.className = 'fieldValue';
    valueEl.textContent = formatValue(value, control);
    labelRow.appendChild(valueEl);
  }

  if (control.type === 'checkbox') {
    wrapper.appendChild(label);
  } else {
    wrapper.appendChild(labelRow);
  }

  let input;
  switch (control.type) {
    case 'select':
    case 'animation-select': {
      input = document.createElement('select');
      input.className = 'select';
      const options = control.type === 'animation-select'
        ? ANIMATION_MODES.map((mode) => ({ value: mode.id, label: mode.name }))
        : control.options.map((item) => ({ value: item, label: item }));
      options.forEach((option) => {
        const el = document.createElement('option');
        el.value = option.value;
        el.textContent = option.label;
        input.appendChild(el);
      });
      input.value = value;
      break;
    }
    case 'textarea':
      input = document.createElement('textarea');
      input.className = 'textInput';
      input.value = value;
      break;
    default:
      input = document.createElement('input');
      input.className = control.type === 'color' ? 'textInput' : 'textInput';
      input.type = control.type === 'checkbox' ? 'checkbox' : control.type;
      if (control.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value;
  }

  if (control.placeholder) input.placeholder = control.placeholder;
  if (control.min !== undefined) input.min = control.min;
  if (control.max !== undefined) input.max = control.max;
  if (control.step !== undefined) input.step = control.step;

  const handler = () => {
    const nextValue = readInputValue(control, input);
    if (valueEl) valueEl.textContent = formatValue(nextValue, control);
    onChange(nextValue);
  };

  input.addEventListener(control.type === 'text' || control.type === 'textarea' ? 'input' : 'input', handler);
  if (control.type === 'select' || control.type === 'animation-select' || control.type === 'checkbox') {
    input.addEventListener('change', handler);
  }

  wrapper.appendChild(input);
  return { wrapper, input, valueEl, control };
}

function renderLists() {
  dom.layersList.innerHTML = '';
  dom.textsList.innerHTML = '';

  project.layers.forEach((layer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layerItem' + (layer.id === selectedLayerId ? ' active' : '');
    button.innerHTML = `<div><strong>${layer.name}</strong><br><small>${MODE_BY_ID[layer.mode]?.name || layer.mode}</small></div><small>${layer.enabled ? 'ON' : 'OFF'} • ${layer.blend}</small>`;
    button.addEventListener('click', () => {
      selectedLayerId = layer.id;
      renderLists();
      renderInspectors();
    });
    dom.layersList.appendChild(button);
  });

  project.texts.forEach((text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'textItem' + (text.id === selectedTextId ? ' active' : '');
    button.innerHTML = `<div><strong>${truncate(text.content.replace(/\n/g, ' / '), 20)}</strong><br><small>${text.animation}</small></div><small>${text.enabled ? 'ON' : 'OFF'} • x:${text.x} y:${text.y}</small>`;
    button.addEventListener('click', () => {
      selectedTextId = text.id;
      renderLists();
      renderInspectors();
    });
    dom.textsList.appendChild(button);
  });

  updateStats();
  renderSvgList();
}

function renderInspectors() {
  renderLayerInspector();
  renderTextInspector();
  renderSvgInspector();
}

function renderLayerInspector() {
  dom.layerInspector.innerHTML = '';
  const layer = getSelectedLayer();
  if (!layer) return;

  LAYER_CONTROL_SCHEMA.forEach((control) => {
    const field = createField(control, layer[control.key], (value) => {
      layer[control.key] = value;
      renderLists();
      needsRedraw = true;
    });
    dom.layerInspector.appendChild(field.wrapper);
  });
}

function renderTextInspector() {
  dom.textInspector.innerHTML = '';
  const text = getSelectedText();
  if (!text) return;

  TEXT_CONTROL_SCHEMA.forEach((control) => {
    if (control.key === 'glow') {
      const divider = document.createElement('div');
      divider.className = 'inspector-section-title';
      divider.textContent = 'Text Effects';
      dom.textInspector.appendChild(divider);
    }
    const field = createField(control, text[control.key], (value) => {
      text[control.key] = value;
      renderLists();
      needsRedraw = true;
    });
    dom.textInspector.appendChild(field.wrapper);
  });
}

// ── SVG LAYERS ──
const svgRasterCache = new Map();

function rasterizeSvg(svgLayer) {
  if (!svgLayer.svgContent || !svgLayer._rasterDirty) return;
  const blob = new Blob([svgLayer.svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const offscreen = document.createElement('canvas');
    offscreen.width = project.cols;
    offscreen.height = project.rows;
    const ctx = offscreen.getContext('2d');
    const scale = svgLayer.svgScale || 1;
    const ox = (svgLayer.svgX || 0) * project.cols;
    const oy = (svgLayer.svgY || 0) * project.rows;
    ctx.drawImage(img, ox, oy, project.cols * scale, project.rows * scale);
    svgRasterCache.set(svgLayer.id, ctx.getImageData(0, 0, project.cols, project.rows));
    svgLayer._rasterDirty = false;
    needsRedraw = true;
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function applySvgLayers() {
  if (!project.svgLayers || !project.svgLayers.length) return;
  project.svgLayers.filter((l) => l.enabled).forEach((svgLayer) => {
    if (svgLayer._rasterDirty && svgLayer.svgContent) rasterizeSvg(svgLayer);
    const imageData = svgRasterCache.get(svgLayer.id);
    if (!imageData) return;
    const data = imageData.data;
    for (let y = 0; y < project.rows; y++) {
      for (let x = 0; x < project.cols; x++) {
        const idx = (y * project.cols + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255 * (a / 255);
        const inShape = svgLayer.invert ? brightness <= 0.3 : brightness > 0.3;
        if (inShape && svgLayer.fgIntensity > 0) {
          const palName = svgLayer.fgPalette !== 'inherit' ? svgLayer.fgPalette : project.palette;
          const fg = samplePalette(palName, brightness, project.saturation, project.hueShift);
          const charset = svgLayer.fgCharSet !== 'inherit' ? (CHARSETS[svgLayer.fgCharSet] || getActiveCharset()) : getActiveCharset();
          const charLen = Math.max(1, charset.length - 1);
          const charIdx = clamp(Math.floor(brightness * charLen), 0, charLen);
          const ch = brightness < 0.12 ? ' ' : (charset[charIdx] || charset[charset.length - 1]);
          buffer.setCell(x, y, ch, fg, 'transparent');
        } else if (!inShape && svgLayer.bgIntensity > 0) {
          const palName = svgLayer.bgPalette !== 'inherit' ? svgLayer.bgPalette : project.palette;
          const fg = samplePalette(palName, brightness, project.saturation, project.hueShift);
          const cell = buffer.getCell(x, y);
          const blended = blendSample(cell ? 0.5 : 0, svgLayer.bgIntensity * 0.5, svgLayer.blend);
          if (blended > 0.05) buffer.setCell(x, y, cell?.char || ' ', fg, 'transparent');
        }
      }
    }
  });
}

function renderSvgList() {
  if (!dom.svgLayersList) return;
  dom.svgLayersList.innerHTML = '';
  (project.svgLayers || []).forEach((layer) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layerItem' + (layer.id === selectedSvgLayerId ? ' active' : '');
    const label = layer.svgContent ? 'SVG (has content)' : 'SVG (empty)';
    btn.innerHTML = `<div><strong>${label}</strong></div><small>${layer.enabled ? 'ON' : 'OFF'}</small>`;
    btn.addEventListener('click', () => {
      selectedSvgLayerId = layer.id;
      renderSvgList();
      renderSvgInspector();
    });
    dom.svgLayersList.appendChild(btn);
  });
}

function renderSvgInspector() {
  if (!dom.svgLayerInspector) return;
  dom.svgLayerInspector.innerHTML = '';
  const layer = getSelectedSvgLayer();
  if (!layer) return;
  SVG_CONTROL_SCHEMA.forEach((control) => {
    const field = createField(control, layer[control.key], (value) => {
      layer[control.key] = value;
      if (control.key === 'svgContent' || control.key === 'svgScale' || control.key === 'svgX' || control.key === 'svgY') {
        layer._rasterDirty = true;
        rasterizeSvg(layer);
      }
      renderSvgList();
      needsRedraw = true;
    });
    dom.svgLayerInspector.appendChild(field.wrapper);
  });
}

function getSelectedSvgLayer() {
  return (project.svgLayers || []).find((l) => l.id === selectedSvgLayerId) || (project.svgLayers || [])[0] || null;
}

// ── SUBJECT MASK GENERATION ──

function buildSubjectMask() {
  const { subject } = project;
  if (!subject || subject.type === 'none' || (!subject.text && !subject.svgContent)) {
    subjectMask = null;
    subjectDirty = false;
    return;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = project.cols;
  offscreen.height = project.rows;
  const ctx = offscreen.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, project.cols, project.rows);

  if (subject.type === 'text' && subject.text) {
    // Fit text to canvas width using padding
    const padding = subject.padding || 4;
    const maxW = project.cols - padding * 2;
    let fSize = project.rows * 0.72;
    ctx.font = `${subject.textFont || 'bold'} ${fSize}px monospace`;
    const lines = subject.text.split('\n').filter(Boolean);
    const longestLine = lines.reduce((a, b) => a.length > b.length ? a : b, '');
    while (ctx.measureText(longestLine).width > maxW && fSize > 4) {
      fSize -= 0.5;
      ctx.font = `${subject.textFont || 'bold'} ${fSize}px monospace`;
    }
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const lineH = fSize * 1.1;
    const totalH = lines.length * lineH;
    const startY = (project.rows - totalH) / 2 + lineH / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, project.cols / 2, startY + i * lineH);
    });

    // Sample pixels → mask
    const imageData = ctx.getImageData(0, 0, project.cols, project.rows);
    subjectMask = new Float32Array(project.cols * project.rows);
    for (let i = 0; i < subjectMask.length; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      subjectMask[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }
    subjectDirty = false;

  } else if (subject.type === 'svg' && subject.svgContent) {
    // Async SVG rasterization — will trigger needsRedraw when done
    _buildSvgMaskAsync(subject.svgContent, offscreen, ctx);
    // subjectDirty remains true until async completes
  }
}

async function _buildSvgMaskAsync(svgContent, offscreen, ctx) {
  try {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    URL.revokeObjectURL(url);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
    const imageData = ctx.getImageData(0, 0, project.cols, project.rows);
    subjectMask = new Float32Array(project.cols * project.rows);
    for (let i = 0; i < subjectMask.length; i++) {
      const r = imageData.data[i * 4];
      const g = imageData.data[i * 4 + 1];
      const b = imageData.data[i * 4 + 2];
      subjectMask[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }
    subjectDirty = false;
    needsRedraw = true;
  } catch (e) {
    console.warn('SVG subject rasterization failed', e);
    subjectDirty = false;
  }
}

// ── PRESET GALLERY ──
const PRESET_META = {
  'matrix-cathedral': { palette: 'matrix', tags: 'Rain • Matrix • Circuit' },
  'synthwave-core':   { palette: 'synthwave', tags: 'Neon • Tunnel • Retro' },
  'aurora-terminal':  { palette: 'aurora', tags: 'Aurora • Noise • Tidal' },
  'frost-grid':       { palette: 'ice', tags: 'Crystal • Geometric • Cold' },
  'solar-breach':     { palette: 'fire', tags: 'Fire • Solar • Intense' },
  'radar-dream':      { palette: 'radar', tags: 'Radar • Sweep • Tactical' },
  'byte-storm':       { palette: 'cyber', tags: 'Binary • Glitch • Data' },
  'liquid-gold':      { palette: 'gold', tags: 'Caustic • Gold • Flow' },
  'dream-candy':      { palette: 'candy', tags: 'Kaleido • Rainbow • Pop' },
  'deep-ocean':       { palette: 'ocean', tags: 'Tide • Deep • Fluid' },
  'terminal-monolith':{ palette: 'mono', tags: 'Brutal • Mono • Classic' },
};

function buildPresetsGrid() {
  dom.presetsGrid.innerHTML = '';
  BUILTIN_PRESETS.forEach((preset) => {
    const meta = PRESET_META[preset.id] || { palette: 'matrix', tags: '' };
    const colors = (PALETTES[meta.palette] || []).slice(0, 4);
    const card = document.createElement('div');
    card.className = 'preset-card';
    const swatchHtml = colors.map((c) => `<span class="preset-swatch" style="background:${c}"></span>`).join('');
    card.innerHTML = `
      <div class="preset-card-body">
        <div class="preset-card-name">${preset.name}</div>
        <div class="preset-card-tags">${meta.tags}</div>
      </div>
      <div class="preset-card-swatches">${swatchHtml}</div>
    `;
    card.addEventListener('click', () => {
      dom.presetSelect.value = `builtin:${preset.id}`;
      dom.presetSelect.dispatchEvent(new Event('change'));
      closePresetsModal();
    });
    dom.presetsGrid.appendChild(card);
  });

  // Also add saved presets
  const savedPresets = getSavedPresets();
  savedPresets.forEach((preset) => {
    const card = document.createElement('div');
    card.className = 'preset-card preset-card-saved';
    card.innerHTML = `
      <div class="preset-card-body">
        <div class="preset-card-name">${preset.name}</div>
        <div class="preset-card-tags">Saved Preset</div>
      </div>
      <div class="preset-card-swatches"></div>
    `;
    card.addEventListener('click', () => {
      dom.presetSelect.value = `saved:${preset.id}`;
      dom.presetSelect.dispatchEvent(new Event('change'));
      closePresetsModal();
    });
    dom.presetsGrid.appendChild(card);
  });
}

function openPresetsModal() {
  buildPresetsGrid();
  dom.presetsModal.hidden = false;
}

function closePresetsModal() {
  dom.presetsModal.hidden = true;
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!lastTick) lastTick = now;

  const deltaMs = now - lastTick;
  const fpsCap = Math.max(1, project.fpsCap || 30);
  if (deltaMs < 1000 / fpsCap && !needsRedraw) {
    return;
  }

  lastTick = now;
  if (isPlaying) timeline += deltaMs / 1000;

  const renderStart = performance.now();
  renderFrame(timeline);
  renderer.render(buffer, project);
  lastRenderDuration = performance.now() - renderStart;
  needsRedraw = false;

  fpsFrames += 1;
  if (now - fpsWindow >= 1000) {
    currentFps = Math.round((fpsFrames * 1000) / (now - fpsWindow));
    fpsFrames = 0;
    fpsWindow = now;
  }

  if (now - lastFrameTextRefresh > 240) {
    refreshFrameOutput(true);
    lastFrameTextRefresh = now;
  }

  updateStats();
}

function renderFrame(time) {
  // ── Rebuild subject mask if dirty ──
  if (subjectDirty) buildSubjectMask();

  ensureBuffers();
  buffer.clear('transparent');
  const backgroundRgb = hexToRgb(project.background);
  const charset = getActiveCharset();
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
      value = frameValues[index] * project.trail + value * (1 - project.trail);
      frameValues[index] = value;
      let shaded = project.invert ? 1 - value : value;
      shaded = clamp01(Math.pow(shaded, 1 / Math.max(0.15, project.density)));

      const charIndex = clamp(Math.floor(shaded * charLength), 0, charLength);
      const colorRgb = samplePaletteRgb(paletteName, fract(shaded + hue), project.saturation, project.hueShift);
      const fg = rgbToCss(mixRgb(colorRgb, backgroundRgb, project.backgroundMix * 0.55));
      const char = shaded < 0.12 ? ' ' : charset[charIndex] || charset[charset.length - 1] || '#';

      // ── Subject mask compositing ──
      if (subjectMask !== null) {
        const maskVal = subjectMask[index];
        if (maskVal < 0.15) {
          // Background cell — dim or empty based on bgIntensity
          const bgIntensity = project.subject?.bgIntensity ?? 0.08;
          const bgVal = clamp01(value * bgIntensity);
          if (bgVal < 0.1) {
            buffer.setCell(x, y, ' ', '#000', 'transparent');
          } else {
            buffer.setCell(x, y, char, rgbToCss(mixRgb(colorRgb, backgroundRgb, 0.85)), 'transparent');
          }
        } else {
          // Shape cell — modulate by mask brightness for vivid subject rendering
          const modValue = clamp01(value * (0.4 + maskVal * 0.6) + maskVal * 0.5);
          const modShaded = clamp01(Math.pow(modValue, 1 / Math.max(0.15, project.density)));
          const modCharIdx = clamp(Math.floor(modShaded * charLength), 0, charLength);
          const modColor = samplePaletteRgb(paletteName, fract(modShaded + hue), project.saturation, project.hueShift);
          const modChar = modShaded < 0.08 ? ' ' : charset[modCharIdx] || charset[charset.length - 1] || '#';
          buffer.setCell(x, y, modChar, rgbToCss(mixRgb(modColor, backgroundRgb, project.backgroundMix * 0.3)), 'transparent');
        }
      } else {
        // Legacy mode — no subject, fill everything
        buffer.setCell(x, y, char, fg, 'transparent');
      }
    }
  }

  applyTextLayers(time);
  applySvgLayers();
}

function applyTextLayers(time) {
  const paletteKeys = Object.keys(PALETTES);
  project.texts.filter((text) => text.enabled).forEach((text, textIndex) => {
    const lines = String(text.content || '').split('\n').filter(Boolean);
    if (!lines.length) return;

    const { x, y } = getTextPosition(text, time, lines);
    const paletteName = paletteKeys[textIndex % paletteKeys.length] || project.palette;

    lines.forEach((line, lineIndex) => {
      const spacedLine = applySpacing(line, text.spacing);
      if (!text.repeat) {
        drawStyledLine(Math.round(x), Math.round(y + lineIndex), spacedLine, text, paletteName, time);
        return;
      }

      const repeatStep = Math.max(4, spacedLine.length + 4);
      for (let offset = -repeatStep * 2; offset < project.cols + repeatStep * 2; offset += repeatStep) {
        drawStyledLine(Math.round(x + offset), Math.round(y + lineIndex), spacedLine, text, paletteName, time);
      }
    });
  });
}

function drawStyledLine(startX, startY, line, text, paletteName, time) {
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
      ? samplePalette(paletteName, fract(time * 0.15 + index * 0.05), project.saturation, project.hueShift)
      : text.color;

    if (text.outline) {
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => buffer.setCell(x + ox, y + oy, glyph, outlineColor, 'transparent'));
    }

    buffer.setCell(x, y, glyph, fg, text.bg || 'transparent');
  }
}

function getTextPosition(text, time, lines) {
  const width = Math.max(...lines.map((line) => applySpacing(line, text.spacing).length));
  const t = time * text.speed + text.phase;
  switch (text.animation) {
    case 'marquee':
      return { x: project.cols - ((t * 10) % (project.cols + width + 10)), y: text.y };
    case 'bounce':
      return { x: text.x, y: text.y + Math.abs(Math.sin(t)) * text.amplitude };
    case 'orbit':
      return {
        x: project.cols * 0.5 + Math.cos(t) * text.amplitude * 2 - width / 2,
        y: project.rows * 0.5 + Math.sin(t * 1.2) * text.amplitude - lines.length / 2
      };
    case 'glitch':
      return {
        x: text.x + Math.round(Math.sin(t * 8.4) * text.amplitude * 0.5),
        y: text.y + Math.round(Math.cos(t * 6.2) * text.amplitude * 0.3)
      };
    case 'pulse':
      return { x: text.x, y: text.y + Math.sin(t * 1.6) * text.amplitude * 0.18 };
    case 'spiral':
      return {
        x: text.x + Math.cos(t * 1.1) * text.amplitude * 1.2,
        y: text.y + Math.sin(t * 1.4) * text.amplitude * 0.8
      };
    case 'drift':
      return { x: text.x + Math.sin(t * 0.7) * text.amplitude, y: text.y + Math.cos(t * 0.45) * text.amplitude * 0.45 };
    case 'wave':
      return { x: text.x, y: text.y };
    default:
      return { x: text.x, y: text.y };
  }
}

function applyProject(nextProject, { keepPresetSelection = false, status = 'Project updated' } = {}) {
  project = normalizeProject(nextProject);
  selectedLayerId = project.layers.find((layer) => layer.id === selectedLayerId)?.id || project.layers[0]?.id;
  selectedTextId = project.texts.find((text) => text.id === selectedTextId)?.id || project.texts[0]?.id;
  selectedSvgLayerId = (project.svgLayers || []).find((l) => l.id === selectedSvgLayerId)?.id || (project.svgLayers || [])[0]?.id || null;
  svgRasterCache.clear();
  resizeScene();
  renderLists();
  renderInspectors();
  syncGlobalControls();
  updateProjectLabel();
  subjectDirty = true; // subject may have changed with new project
  if (!keepPresetSelection) dom.presetSelect.value = '';
  setStatus(status);
  needsRedraw = true;
}

function resizeScene() {
  renderer.resize(project.cols, project.rows, project.fontSize);
  buffer.resize(project.cols, project.rows);
  frameValues = new Float32Array(project.cols * project.rows);
  needsRedraw = true;
  updateStats();
}

function syncGlobalControls() {
  controlRefs.forEach((field, key) => {
    const value = project[key];
    if (field.control.type === 'checkbox') field.input.checked = Boolean(value);
    else field.input.value = value;
    if (field.valueEl) field.valueEl.textContent = formatValue(value, field.control);
  });
  syncSubjectUI();
}

function syncSubjectUI() {
  const subject = project.subject || {};
  const type = subject.type || 'none';

  // Update tab active states
  document.querySelectorAll('.subject-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Show/hide sections
  const textArea = document.getElementById('subjectTextArea');
  const svgArea = document.getElementById('subjectSvgArea');
  const opts = document.getElementById('subjectOptions');
  if (textArea) textArea.style.display = type === 'text' ? '' : 'none';
  if (svgArea) svgArea.style.display = type === 'svg' ? '' : 'none';
  if (opts) opts.style.display = type !== 'none' ? '' : 'none';

  // Sync values
  const subjectTextInput = document.getElementById('subjectTextInput');
  if (subjectTextInput) subjectTextInput.value = subject.text || '';
  const subjectSvgInput = document.getElementById('subjectSvgInput');
  if (subjectSvgInput) subjectSvgInput.value = subject.svgContent || '';
  const subjectFontWeight = document.getElementById('subjectFontWeight');
  if (subjectFontWeight) subjectFontWeight.value = subject.textFont || 'bold';
  const subjectBgIntensity = document.getElementById('subjectBgIntensity');
  if (subjectBgIntensity) subjectBgIntensity.value = subject.bgIntensity ?? 0.08;
  const subjectPadding = document.getElementById('subjectPadding');
  if (subjectPadding) subjectPadding.value = subject.padding ?? 4;
}

function populatePresetSelect() {
  dom.presetSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Built-in and saved presets';
  dom.presetSelect.appendChild(placeholder);

  const builtins = document.createElement('optgroup');
  builtins.label = 'Built-in Presets';
  BUILTIN_PRESETS.forEach((preset) => {
    const option = document.createElement('option');
    option.value = `builtin:${preset.id}`;
    option.textContent = preset.name;
    builtins.appendChild(option);
  });
  dom.presetSelect.appendChild(builtins);

  const saved = document.createElement('optgroup');
  saved.label = 'Saved Presets';
  const savedPresets = getSavedPresets();
  if (savedPresets.length) {
    savedPresets.forEach((preset) => {
      const option = document.createElement('option');
      option.value = `saved:${preset.id}`;
      option.textContent = preset.name;
      saved.appendChild(option);
    });
    dom.presetSelect.appendChild(saved);
  }
}

function saveCurrentPreset() {
  const name = window.prompt('Preset adı?', project.projectName || 'Ascii Arter Preset');
  if (!name) return;
  const saved = getSavedPresets();
  const entry = { id: slugify(name) + '-' + Date.now(), name, project: cloneProject(project) };
  saved.unshift(entry);
  localStorage.setItem('ascii-arter-presets', JSON.stringify(saved.slice(0, 24)));
  populatePresetSelect();
  dom.presetSelect.value = `saved:${entry.id}`;
  setStatus(`Saved preset: ${name}`);
}

async function handleImportProject(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = await importProjectJSON(file);
    applyProject(imported, { keepPresetSelection: false, status: `Imported ${file.name}` });
  } catch (error) {
    console.error(error);
    setStatus('Import failed: invalid JSON');
  } finally {
    event.target.value = '';
  }
}

function randomizeProject() {
  // Save subject before randomizing — user content is sacred
  const savedSubject = project.subject ? { ...project.subject } : null;

  const palettes = Object.keys(PALETTES);
  const charSets = Object.keys(CHARSETS);
  const layerCount = 2 + Math.floor(Math.random() * 3);
  const textCount = 1 + Math.floor(Math.random() * 2);

  project.projectName = 'Ascii Arter Remix';
  project.palette = pick(palettes);
  project.charSet = pick(charSets);
  project.background = rgbToHex({ r: Math.floor(Math.random() * 22), g: Math.floor(Math.random() * 22), b: Math.floor(Math.random() * 38) });
  project.brightness = randomBetween(-0.08, 0.12);
  project.contrast = randomBetween(0.95, 1.45);
  project.gamma = randomBetween(0.85, 1.35);
  project.saturation = randomBetween(0.75, 1.65);
  project.hueShift = randomBetween(-60, 60);
  project.density = randomBetween(0.7, 1.5);
  project.glow = randomBetween(4, 18);
  project.trail = randomBetween(0.06, 0.34);
  project.backgroundMix = randomBetween(0.12, 0.42);
  project.speed = randomBetween(0.75, 1.6);
  project.zoom = randomBetween(0.7, 1.5);
  project.rotation = randomBetween(-35, 35);
  project.amplitude = randomBetween(0.6, 1.8);
  project.frequency = randomBetween(0.7, 1.8);
  project.turbulence = randomBetween(0.6, 1.8);
  project.offsetX = randomBetween(-0.3, 0.3);
  project.offsetY = randomBetween(-0.3, 0.3);
  project.seed = Math.floor(randomBetween(1, 9999));
  project.mirrorX = Math.random() > 0.72;
  project.mirrorY = Math.random() > 0.74;

  project.layers = Array.from({ length: layerCount }, (_, index) => createDefaultLayer({
    name: `Layer ${index + 1}`,
    mode: pick(ANIMATION_MODES).id,
    palette: Math.random() > 0.4 ? pick(palettes) : 'inherit',
    blend: pick(BLEND_MODES).value,
    intensity: randomBetween(0.4, 1.4),
    speed: randomBetween(0.4, 1.8),
    scale: randomBetween(0.6, 1.8),
    phase: randomBetween(-3.14, 3.14),
    offsetX: randomBetween(-0.6, 0.6),
    offsetY: randomBetween(-0.6, 0.6),
    warp: randomBetween(0.6, 1.8),
    hueShift: randomBetween(-60, 60),
    charBias: randomBetween(-0.3, 0.3)
  }));

  project.texts = Array.from({ length: textCount }, (_, index) => createDefaultText({
    content: index === 0 ? 'ASCII ARTER' : pick(['PURE JS', '60 MODES', 'GITHUB PAGES', 'LAYERED TEXT']),  // decorative text only
    animation: pick(TEXT_ANIMATIONS).value,
    x: Math.floor(randomBetween(4, project.cols * 0.45)),
    y: Math.floor(randomBetween(2, project.rows * 0.5)),
    speed: randomBetween(0.7, 2.2),
    amplitude: randomBetween(1, 8),
    color: samplePalette(project.palette, Math.random(), 1.2, 0),
    bg: 'transparent',
    repeat: Math.random() > 0.72,
    rainbow: Math.random() > 0.62,
    outline: Math.random() > 0.3
  }));

  selectedLayerId = project.layers[0].id;
  selectedTextId = project.texts[0].id;

  // Restore subject — user content is never randomized
  if (savedSubject) project.subject = savedSubject;
  subjectDirty = true; // re-render mask with potentially new dimensions
}

function moveLayer(direction) {
  const index = project.layers.findIndex((layer) => layer.id === selectedLayerId);
  if (index < 0) return;
  const nextIndex = clamp(index + direction, 0, project.layers.length - 1);
  if (nextIndex === index) return;
  const [layer] = project.layers.splice(index, 1);
  project.layers.splice(nextIndex, 0, layer);
  renderLists();
  setStatus('Reordered animation layers');
  needsRedraw = true;
}

function refreshFrameOutput(force = false) {
  if (!force && document.activeElement === dom.frameOutput) return;
  dom.frameOutput.value = buffer.toString();
}

function updateProjectLabel() {
  dom.projectTitleLabel.textContent = project.projectName || 'Ascii Arter';
}

function updateStats() {
  dom.fpsStat.textContent = `FPS: ${currentFps}`;
  dom.renderStat.textContent = `Render: ${lastRenderDuration.toFixed(2)} ms`;
  dom.cellsStat.textContent = `Cells: ${project.cols * project.rows}`;
  dom.layersStat.textContent = `Layers: ${project.layers.length} anim / ${project.texts.length} text`;
}

function setStatus(message) {
  dom.statusStat.textContent = message;
}

function ensureBuffers() {
  const size = project.cols * project.rows;
  if (frameValues.length !== size) {
    frameValues = new Float32Array(size);
  }
}

function getSavedPresets() {
  try {
    return JSON.parse(localStorage.getItem('ascii-arter-presets') || '[]');
  } catch {
    return [];
  }
}

function getSelectedLayer() {
  return project.layers.find((layer) => layer.id === selectedLayerId) || project.layers[0];
}

function getSelectedText() {
  return project.texts.find((text) => text.id === selectedTextId) || project.texts[0];
}

function getActiveCharset() {
  if (project.charSet === 'custom') {
    const chars = (project.customChars || '').trim();
    return chars.length ? chars : CHARSETS.classic;
  }
  return CHARSETS[project.charSet] || CHARSETS.classic;
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

function applySpacing(text, spacing) {
  const gap = ' '.repeat(Math.max(0, spacing));
  return String(text).split('').join(gap);
}

function readInputValue(control, input) {
  switch (control.type) {
    case 'checkbox':
      return input.checked;
    case 'range':
      return Number(input.value);
    case 'color':
    case 'text':
    case 'textarea':
    case 'select':
    case 'animation-select':
    default:
      return input.value;
  }
}

function formatValue(value, control) {
  if (control.type === 'range') {
    if (Number.isInteger(control.step)) return String(Math.round(Number(value)));
    return Number(value).toFixed(control.step < 0.1 ? 2 : 1);
  }
  if (control.type === 'color') return String(value).toUpperCase();
  return String(value);
}

function truncate(text, size) {
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffleString(text) {
  return text.split('').sort(() => Math.random() - 0.5).join('');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'preset';
}

function fileBaseName() {
  return slugify(project.projectName || 'ascii-arter');
}

function hexToRgb(hex) {
  if (!hex || hex === 'transparent') return { r: 0, g: 0, b: 0 };
  if (hex.startsWith('rgb')) {
    const [r, g, b] = hex.match(/\d+(?:\.\d+)?/g)?.map(Number) || [0, 0, 0];
    return { r, g, b };
  }
  const value = hex.replace('#', '');
  const safe = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function rgbToCss({ r, g, b }) {
  return `rgb(${Math.round(clamp(r, 0, 255))}, ${Math.round(clamp(g, 0, 255))}, ${Math.round(clamp(b, 0, 255))})`;
}

function mixRgb(a, b, amount) {
  const t = clamp01(amount);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function samplePalette(name, t, saturation = 1, hueShift = 0) {
  return rgbToCss(samplePaletteRgb(name, t, saturation, hueShift));
}

function samplePaletteRgb(name, t, saturation = 1, hueShift = 0) {
  const palette = paletteCache.get(name) || paletteCache.get(project.palette) || paletteCache.values().next().value;
  const wrapped = fract(t + hueShift / 360);
  const scaled = wrapped * (palette.length - 1);
  const index = Math.floor(scaled);
  const local = scaled - index;
  const start = palette[index] || palette[0];
  const end = palette[index + 1] || palette[palette.length - 1];
  const mixed = mixRgb(start, end, local);
  const gray = (mixed.r + mixed.g + mixed.b) / 3;
  return {
    r: gray + (mixed.r - gray) * saturation,
    g: gray + (mixed.g - gray) * saturation,
    b: gray + (mixed.b - gray) * saturation
  };
}
