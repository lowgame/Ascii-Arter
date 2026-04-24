export const SUBJECT_FONT_FAMILY_OPTIONS = [
  {
    value: 'mono',
    label: 'Mono',
    stack: '"Courier New", "Lucida Console", monospace',
  },
  {
    value: 'sans',
    label: 'Sans',
    stack: 'Arial, Helvetica, sans-serif',
  },
  {
    value: 'serif',
    label: 'Serif',
    stack: 'Georgia, "Times New Roman", serif',
  },
];

const SUBJECT_FONT_FAMILY_MAP = new Map(
  SUBJECT_FONT_FAMILY_OPTIONS.map((option) => [option.value, option.stack]),
);

export function getSubjectFontStack(familyKey = SUBJECT_FONT_FAMILY_OPTIONS[0].value) {
  return SUBJECT_FONT_FAMILY_MAP.get(familyKey) || SUBJECT_FONT_FAMILY_OPTIONS[0].stack;
}

export function buildSubjectCanvasFont({ weight = 'bold', size = 16, familyKey = SUBJECT_FONT_FAMILY_OPTIONS[0].value } = {}) {
  return `${weight} ${size}px ${getSubjectFontStack(familyKey)}`;
}

export function applySubjectLetterSpacing(text, spacing = 0) {
  const gap = ' '.repeat(Math.max(0, Number(spacing) || 0));
  return String(text).split('').join(gap);
}

export function getSpacedSubjectLines(text = '', spacing = 0) {
  return String(text)
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => applySubjectLetterSpacing(line, spacing));
}
