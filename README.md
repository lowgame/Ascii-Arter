# ASCII Arter

ASCII Arter is a pure JavaScript ASCII animation creator designed to run directly on GitHub Pages.

Features:
- 60 built-in animation modes
- 28+ live controls
- Layered animation system
- Layered text overlays
- Custom palettes and character sets
- Built-in presets + local preset saving
- TXT, PNG, HTML snapshot, and JSON export
- No framework, no build step, no backend

Project structure:
- `index.html` — app shell
- `css/main.css` — layout and styling
- `js/data/config.js` — control schemas and defaults
- `js/data/animations.js` — 60 animation definitions and samplers
- `js/data/presets.js` — built-in presets
- `js/core/engine.js` — framebuffer + canvas renderer
- `js/core/exporters.js` — export/import helpers
- `js/main.js` — UI, state, runtime loop

Run locally:
1. Open the repo root
2. Start a static server
   - `python3 -m http.server 8123`
3. Visit `http://127.0.0.1:8123`

Deploy on GitHub Pages:
- Push everything to the root of the repository
- Enable GitHub Pages from the `main` branch using the `/ (root)` folder
- `.nojekyll` is included so GitHub Pages serves the app as a plain static site

Notes:
- Presets saved from the UI are stored in browser `localStorage`
- JSON export/import moves full projects between browsers or machines
- The app is optimized around a canvas-based ASCII renderer for fast redraws
