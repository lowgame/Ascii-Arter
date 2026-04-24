# ascii-arter

Drop animated ASCII art backgrounds onto any HTML element — design your scene on https://lowgame.github.io/Ascii-Arter/, export JSON, embed anywhere.

## Install

```bash
npm install ascii-arter
```

Tip: Önce JSON'u doğrudan ASCII Arter içinde test et, sonra export edip kendi projende kullan:
https://lowgame.github.io/Ascii-Arter/  (JSON Test button)

## Quick Start

1. Sahneyi https://lowgame.github.io/Ascii-Arter/ içinde hazırla
2. JSON export al
3. JSON'u sitene yükle ve mount et

```js
import AsciiBackground, { parseProjectData } from 'ascii-arter';

fetch('/my-project.json')
  .then((res) => res.text())
  .then((json) => {
    AsciiBackground.mount('#hero', parseProjectData(json));
  });
```

`parseProjectData()` hem JSON string hem plain object kabul eder. Böylece export edilen veriyi dosyadan, API'den veya inline string olarak güvenli şekilde yükleyebilirsin.

Animasyon `#hero` içinde canvas background olarak render edilir. Gerekirse container'a `position: relative` otomatik eklenir.

## CDN

```html
<div id="hero" style="height:400px"></div>
<script type="module">
  import AsciiBackground, { parseProjectData } from 'https://unpkg.com/ascii-arter/dist/ascii-arter.esm.js';

  fetch('/my-project.json')
    .then((res) => res.text())
    .then((json) => {
      AsciiBackground.mount('#hero', parseProjectData(json));
    });
</script>
```

## API

### `AsciiBackground.mount(selector, projectData, options?)`

Static factory. Animation'ı hemen başlatır.

- `selector` — CSS selector string veya DOM element
- `projectData` — ASCII Arter'dan export edilen JSON object/string
- `options` — future use

Bir `AsciiBackground` instance döner.

### Instance methods

| Method | Description |
|--------|-------------|
| `.play()` | Animasyonu devam ettirir |
| `.pause()` | Animasyonu durdurur |
| `.load(projectData)` | Tüm sahneyi yeni export JSON ile değiştirir |
| `.update(partial)` | Partial project props merge eder ve yeniden render eder |
| `.toJSON(space?)` | O an çalışan sahneyi tekrar JSON olarak export eder |
| `.destroy()` | Animasyonu durdurur, canvas'ı kaldırır, observer'ı kapatır |

### Utility exports

| Export | Description |
|--------|-------------|
| `parseProjectData(input)` | Export edilen JSON string/object input'unu normalize eder |
| `serializeProjectData(project)` | Runtime-only alanları temizler; publish/embed-safe JSON üretir |

## Example

```html
<!DOCTYPE html>
<html>
<body>
  <section id="hero" style="height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden;">
    <h1 style="position:relative; z-index:1; color:#fff">Hello, world!</h1>
  </section>

  <script type="module">
    import AsciiBackground from 'https://unpkg.com/ascii-arter/dist/ascii-arter.esm.js';

    const bg = AsciiBackground.mount('#hero', null);

    document.getElementById('hero').addEventListener('mouseenter', () => bg.pause());
    document.getElementById('hero').addEventListener('mouseleave', () => bg.play());
  </script>
</body>
</html>
```

## License

MIT
