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
  'border-style',
  'border-radius',
  'box-shadow',
  'opacity',
  'white-space',
  'word-break',
  'vertical-align',
  'table-layout',
] as const;

const TABLE_CELL_PROPS = [
  'text-align',
  'vertical-align',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-color',
  'border-width',
  'border-style',
  'background-color',
  'color',
  'font-weight',
] as const;

/**
 * html2canvas cannot parse modern CSS color functions (e.g. oklch from Tailwind v4).
 * Strip external stylesheets from the clone and copy resolved computed styles from
 * the live DOM so capture works reliably.
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
      box-sizing: border-box;
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

    const computed = window.getComputedStyle(original);
    const props = original.tagName === 'TD' || original.tagName === 'TH'
      ? [...STYLE_PROPS, ...TABLE_CELL_PROPS]
      : STYLE_PROPS;

    for (const prop of props) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        clone.style.setProperty(prop, value);
      }
    }
  });

  clonedRoot.style.overflow = 'visible';
  clonedRoot.style.height = 'auto';
  clonedRoot.style.maxHeight = 'none';
}
