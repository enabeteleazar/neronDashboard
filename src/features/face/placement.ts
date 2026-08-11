export type Rect = { x: number; y: number; w: number; h: number };

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Cherche le centre le plus degage pour un bloc de taille `size` dans `area`,
 * en evitant `obstacles`. A egalite de recouvrement, on reste pres de `prefer`.
 */
export function bestSpot(
  area: Rect,
  obstacles: Rect[],
  size: { w: number; h: number },
  prefer: { x: number; y: number },
): { x: number; y: number } {
  const halfW = size.w / 2;
  const halfH = size.h / 2;
  const minX = area.x + halfW;
  const maxX = area.x + area.w - halfW;
  const minY = area.y + halfH;
  const maxY = area.y + area.h - halfH;

  if (maxX < minX || maxY < minY) return prefer;

  const COLS = 21;
  const ROWS = 13;
  let best = prefer;
  let bestScore = Infinity;

  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const cx = minX + ((maxX - minX) * i) / (COLS - 1 || 1);
      const cy = minY + ((maxY - minY) * j) / (ROWS - 1 || 1);
      const box: Rect = { x: cx - halfW, y: cy - halfH, w: size.w, h: size.h };

      let hidden = 0;
      for (const o of obstacles) hidden += overlap(box, o);

      const drift = Math.hypot(cx - prefer.x, cy - prefer.y);
      const score = hidden / (size.w * size.h) + drift / 4000;

      if (score < bestScore - 1e-6) {
        bestScore = score;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}
