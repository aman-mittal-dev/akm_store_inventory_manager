/** One-off SKU for custom / ad-hoc line items (not catalog products). */
export function generateAdHocSku(prefix = "LINE"): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${t}-${r}`;
}
