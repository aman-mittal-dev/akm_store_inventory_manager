const COLOR_PROPS = new Set([
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'column-rule-color',
  'caret-color',
  'fill',
  'stroke',
]);

const STYLE_PROPS = [
  'color',
  'background-color',
  'background-image',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-column',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'width',
  'height',
  'min-width',
  'max-width',
  'min-height',
  'max-height',
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'border-radius',
  'box-shadow',
  'opacity',
  'white-space',
  'word-break',
  'vertical-align',
  'table-layout',
  'overflow',
  'position',
  'top',
  'right',
  'bottom',
  'left',
] as const;

let colorProbeCanvas: HTMLCanvasElement | null = null;

/**
 * html2canvas cannot parse oklch()/lab()/color(). Convert modern color values to #rrggbb.
 */
function sanitizeCssColor(value: string): string {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === 'transparent' ||
    trimmed === 'none' ||
    trimmed === 'currentcolor' ||
    trimmed === 'inherit' ||
    trimmed === 'initial' ||
    trimmed === 'unset'
  ) {
    return trimmed;
  }

  if (
    !/oklch|oklab|lab\(|lch\(|color\(|color-mix/i.test(trimmed) &&
    (/^#([0-9a-f]{3,8})$/i.test(trimmed) ||
      /^rgba?\(/i.test(trimmed) ||
      /^hsla?\(/i.test(trimmed))
  ) {
    return trimmed;
  }

  try {
    if (!colorProbeCanvas) {
      colorProbeCanvas = document.createElement('canvas');
      colorProbeCanvas.width = 1;
      colorProbeCanvas.height = 1;
    }
    const ctx = colorProbeCanvas.getContext('2d');
    if (!ctx) return '#000000';
    ctx.fillStyle = '#000000';
    ctx.fillStyle = trimmed;
    const normalized = String(ctx.fillStyle);
    if (/oklch|oklab|lab\(|lch\(|color\(/i.test(normalized)) {
      return '#000000';
    }
    return normalized;
  } catch {
    return '#000000';
  }
}

function sanitizeStyleValue(prop: string, value: string): string {
  if (!value) return value;
  if (COLOR_PROPS.has(prop) || /color/i.test(prop)) {
    return sanitizeCssColor(value);
  }
  if (prop === 'box-shadow' || prop === 'background-image' || prop === 'text-shadow') {
    return value.replace(
      /(oklch|oklab|lab|lch|color-mix|color)\([^)]*\)/gi,
      (match) => sanitizeCssColor(match),
    );
  }
  if (/oklch|oklab|lab\(|lch\(|color\(/i.test(value)) {
    return value.replace(
      /(oklch|oklab|lab|lch|color-mix|color)\([^)]*\)/gi,
      (match) => sanitizeCssColor(match),
    );
  }
  return value;
}

/**
 * Prepare a cloned DOM subtree for html2canvas by removing stylesheets and inlining
 * RGB/hex computed styles so Tailwind v4 oklch() never reaches the parser.
 */
export function prepareElementForCanvasCapture(
  clonedDoc: Document,
  clonedRoot: HTMLElement,
  originalRoot: HTMLElement,
): void {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());

  const fallbackStyle = clonedDoc.createElement('style');
  fallbackStyle.textContent = `
    * {
      box-sizing: border-box !important;
      color: #111827 !important;
      background-color: transparent !important;
      border-color: #d1d5db !important;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
  `;
  clonedDoc.head.appendChild(fallbackStyle);

  const originalNodes = [originalRoot, ...Array.from(originalRoot.querySelectorAll<HTMLElement>('*'))];
  const clonedNodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))];

  originalNodes.forEach((original, index) => {
    const clone = clonedNodes[index];
    if (!clone) return;

    clone.removeAttribute('class');
    clone.removeAttribute('style');

    const computed = window.getComputedStyle(original);
    for (const prop of STYLE_PROPS) {
      const raw = computed.getPropertyValue(prop);
      if (!raw) continue;
      clone.style.setProperty(prop, sanitizeStyleValue(prop, raw));
    }
  });

  clonedRoot.style.overflow = 'visible';
  clonedRoot.style.height = 'auto';
  clonedRoot.style.maxHeight = 'none';
  clonedRoot.style.backgroundColor = sanitizeCssColor(
    window.getComputedStyle(originalRoot).backgroundColor || '#ffffff',
  ) || '#ffffff';
}
