# ascii-bg

Drop animated ASCII art backgrounds onto any HTML element — design your scene on [ASCII Arter](https://lowgame.github.io/Ascii-Arter/), export JSON, embed anywhere.

## Install

```bash
npm install ascii-bg
```

## Quick Start

1. Design your animation at **https://lowgame.github.io/Ascii-Arter/**
2. Click **Export ▾ → JSON Project** to download your project file
3. Use the library to embed it:

```js
import AsciiBackground from 'ascii-bg';
import project from './my-project.json' assert { type: 'json' };

AsciiBackground.mount('#hero', project);
```

The animation will render as a canvas background inside `#hero`. The container gets `position: relative` automatically if needed.

## CDN (no build step)

```html
<div id="hero" style="height:400px"></div>
<script type="module">
  import AsciiBackground from 'https://unpkg.com/ascii-bg/dist/ascii-bg.esm.js';

  // Paste your exported project JSON here:
  const project = { /* ... */ };

  AsciiBackground.mount('#hero', project);
</script>
```

## API

### `AsciiBackground.mount(selector, projectData, options?)`

Static factory. Creates and starts the animation immediately.

- `selector` — CSS selector string or DOM element
- `projectData` — JSON object exported from ASCII Arter (or `null` for default)
- `options` — reserved for future use

Returns an `AsciiBackground` instance.

### Instance methods

| Method | Description |
|--------|-------------|
| `.play()` | Resume animation (chainable) |
| `.pause()` | Pause animation (chainable) |
| `.update(partial)` | Merge partial project props and re-render |
| `.destroy()` | Stop animation, remove canvas, disconnect observer |

## Example

```html
<!DOCTYPE html>
<html>
<body>
  <section id="hero" style="height:100vh; display:flex; align-items:center; justify-content:center;">
    <h1 style="position:relative; z-index:1; color:#fff">Hello, world!</h1>
  </section>

  <script type="module">
    import AsciiBackground from 'https://unpkg.com/ascii-bg/dist/ascii-bg.esm.js';

    const bg = AsciiBackground.mount('#hero', null); // uses default matrix animation

    // Pause on hover
    document.getElementById('hero').addEventListener('mouseenter', () => bg.pause());
    document.getElementById('hero').addEventListener('mouseleave', () => bg.play());
  </script>
</body>
</html>
```

## License

MIT
