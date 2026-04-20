export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(filename, text) {
  downloadBlob(filename, new Blob([text], { type: 'text/plain;charset=utf-8' }));
}

export function exportProjectJSON(project) {
  return JSON.stringify(project, null, 2);
}

export function importProjectJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function exportCanvasPNG(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(filename, blob);
  }, 'image/png');
}

export function exportHTMLSnapshot(project, asciiText) {
  const escaped = asciiText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${project.projectName} Snapshot</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: ${project.background};
      color: #fff;
      font-family: system-ui, sans-serif;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      width: min(100%, 1200px);
      background: rgba(0,0,0,0.22);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 30px 60px rgba(0,0,0,0.35);
      backdrop-filter: blur(16px);
    }
    h1 { margin: 0 0 12px; font-size: 18px; }
    p { opacity: 0.7; margin: 0 0 12px; }
    pre {
      margin: 0;
      overflow: auto;
      padding: 18px;
      border-radius: 12px;
      background: rgba(0,0,0,0.38);
      color: #fff;
      font-size: ${project.fontSize}px;
      line-height: 1.15;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
  </style>
</head>
<body>
  <section class="card">
    <h1>${project.projectName}</h1>
    <p>Snapshot exported from ASCII Arter.</p>
    <pre>${escaped}</pre>
  </section>
</body>
</html>`;
}
