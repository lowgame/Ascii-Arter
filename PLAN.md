# ASCII Arter v2 — Image-to-ASCII Converter

## Goal
Rebuild ASCII Arter as a browser-based image/video-to-ASCII-art converter inspired by ascii-magic.com.

## Architecture
- **Single HTML file** with inline CSS + JS (GitHub Pages compatible)
- **Canvas pipeline**: Load image → draw to offscreen canvas → read pixels → map to style → render to display canvas
- **Modular style engine**: each style is a pure function `(imageData, config) → renderedCanvas`

## Styles (Phase 1 — 8 core styles)
1. **Classic Characters** — brightness → character ramp `@%#*+=-:. `
2. **Block Characters** — Unicode half/quarter blocks for dense terminal look
3. **Pixel Art** — quantized color blocks with grid lines
4. **Dither** — Floyd-Steinberg + ordered dither with retro palettes
5. **Photo Mosaic** — cell-based color tiles
6. **Dots/Halftone** — circles sized by brightness
7. **LEGO Bricks** — studded tile rendering
8. **Glitch** — scanline displacement + RGB split

## Controls Panel
- **Source**: Upload (file/drag-drop/paste/URL), demo images
- **Style selector**: tab/grid of style cards
- **Parameters** (per-style): brightness, contrast, resolution/charWidth, invert, character ramp editor
- **Background**: blurred image / solid / original / transparent
- **Export**: PNG, JPG, GIF (animated), MP4
- **Recipe**: shareable URL with all settings encoded

## Implementation Phases

### Phase 1: Core Engine (this session)
- [x] Plan written
- [ ] HTML shell + CSS layout (sidebar + canvas preview)
- [ ] Image loading (file, drag-drop, paste, demo images)
- [ ] Canvas processing pipeline
- [ ] Classic Characters style
- [ ] Brightness/contrast/resolution controls
- [ ] PNG export

### Phase 2: More Styles
- [ ] Block Characters
- [ ] Pixel Art
- [ ] Dither (Floyd-Steinberg)
- [ ] Dots/Halftone

### Phase 3: Polish
- [ ] Mosaic, LEGO, Glitch styles
- [ ] Background options
- [ ] Recipe system (URL encoding)
- [ ] Landing page polish

### Phase 4: Video + Advanced Export
- [ ] Video frame processing
- [ ] GIF export (gif.js)
- [ ] MP4 export (mp4-muxer)

## Stack
- Vanilla JS (no framework)
- Canvas 2D API for all rendering
- gif.js + mp4-muxer for animated export (loaded via CDN)
- GitHub Pages deployment
