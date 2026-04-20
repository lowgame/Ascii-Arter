const DEFAULT_FONT_STACK = 'JetBrains Mono, Fira Code, Cascadia Code, monospace';

export class FrameBuffer {
  constructor(cols, rows) {
    this.resize(cols, rows);
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.size = cols * rows;
    this.chars = new Array(this.size).fill(' ');
    this.fg = new Array(this.size).fill('#ffffff');
    this.bg = new Array(this.size).fill('transparent');
  }

  clear(background = 'transparent') {
    for (let index = 0; index < this.size; index += 1) {
      this.chars[index] = ' ';
      this.fg[index] = '#ffffff';
      this.bg[index] = background;
    }
  }

  setCell(x, y, char, fg = '#ffffff', bg = 'transparent') {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return;
    const index = y * this.cols + x;
    this.chars[index] = char;
    this.fg[index] = fg;
    this.bg[index] = bg;
  }

  getCell(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null;
    const index = y * this.cols + x;
    return { char: this.chars[index], fg: this.fg[index], bg: this.bg[index] };
  }

  writeText(x, y, text, fg = '#ffffff', bg = 'transparent') {
    const lines = String(text).split('\n');
    lines.forEach((line, rowOffset) => {
      for (let charIndex = 0; charIndex < line.length; charIndex += 1) {
        this.setCell(x + charIndex, y + rowOffset, line[charIndex], fg, bg);
      }
    });
  }

  toString() {
    const lines = [];
    for (let row = 0; row < this.rows; row += 1) {
      const start = row * this.cols;
      const line = this.chars.slice(start, start + this.cols).join('');
      lines.push(line.replace(/\s+$/g, ''));
    }
    return lines.join('\n');
  }
}

export class AsciiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.fontFamily = DEFAULT_FONT_STACK;
    this.fontSize = 14;
    this.charWidth = 8;
    this.charHeight = 14;
    this.cols = 0;
    this.rows = 0;
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  }

  measure(fontSize = this.fontSize, fontFamily = this.fontFamily) {
    this.fontSize = fontSize;
    this.fontFamily = fontFamily;
    const ctx = this.ctx;
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText('M');
    this.charWidth = Math.ceil(metrics.width + 0.35);
    this.charHeight = Math.ceil(fontSize * 1.22);
  }

  resize(cols, rows, fontSize = this.fontSize, fontFamily = this.fontFamily) {
    this.cols = cols;
    this.rows = rows;
    this.measure(fontSize, fontFamily);

    const width = this.charWidth * cols;
    const height = this.charHeight * rows;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    this.pixelRatio = ratio;

    this.canvas.width = Math.ceil(width * ratio);
    this.canvas.height = Math.ceil(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ctx.font = `${fontSize}px ${fontFamily}`;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';
    this.ctx.imageSmoothingEnabled = false;
  }

  render(buffer, project) {
    const ctx = this.ctx;
    const width = this.charWidth * buffer.cols;
    const height = this.charHeight * buffer.rows;

    ctx.save();
    ctx.fillStyle = project.background;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.shadowBlur = project.glow;

    let previousFill = null;
    let previousBg = null;
    let previousShadow = null;

    for (let row = 0; row < buffer.rows; row += 1) {
      const y = row * this.charHeight;
      for (let col = 0; col < buffer.cols; col += 1) {
        const index = row * buffer.cols + col;
        const x = col * this.charWidth;
        const bg = buffer.bg[index];
        const char = buffer.chars[index];
        const fg = buffer.fg[index];

        if (bg && bg !== 'transparent' && bg !== project.background) {
          if (bg !== previousBg) {
            ctx.fillStyle = bg;
            previousBg = bg;
          }
          ctx.shadowBlur = 0;
          ctx.fillRect(x, y, this.charWidth, this.charHeight);
        }

        if (char && char !== ' ') {
          if (fg !== previousFill) {
            ctx.fillStyle = fg;
            previousFill = fg;
          }
          if (project.glow > 0 && fg !== previousShadow) {
            ctx.shadowColor = fg;
            previousShadow = fg;
          }
          ctx.shadowBlur = project.glow;
          ctx.fillText(char, x, y);
        }
      }
    }

    ctx.restore();
  }
}
