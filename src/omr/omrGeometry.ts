export type Transform = [number, number, number, number, number, number];
export type Box = [number, number, number, number];
export const IDENTITY: Transform = [1, 0, 0, 1, 0, 0];

export function mapPoint(t: Transform, x: number, y: number): [number, number] {
  return [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];
}

/** Aplica primero b y después a (convención de matrices Canvas/SVG). */
export function composeTransform(a: Transform, b: Transform): Transform {
  const origin = mapPoint(a, b[4], b[5]);
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    ...origin,
  ];
}

export function invertTransform(t: Transform): Transform {
  const det = t[0] * t[3] - t[1] * t[2];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12)
    throw new Error('Transformación no invertible.');
  const inverse: Transform = [t[3] / det, -t[1] / det, -t[2] / det, t[0] / det, 0, 0];
  [inverse[4], inverse[5]] = mapPoint(inverse, -t[4], -t[5]);
  return inverse;
}

export function mapBox(t: Transform, [x, y, w, h]: Box): Box {
  const points = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ].map(([px, py]) => mapPoint(t, px, py));
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  return [left, top, Math.max(...xs) - left, Math.max(...ys) - top];
}

/** Expande el lienzo para que el giro no elimine esquinas ni indicaciones. */
export function rotatePage(gray: Float32Array, width: number, height: number, degrees: number) {
  if (degrees === 0) return { gray, width, height, transform: IDENTITY };
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians)) < 1e-12 ? 0 : Math.cos(radians);
  const sin = Math.abs(Math.sin(radians)) < 1e-12 ? 0 : Math.sin(radians);
  const transform: Transform = [cos, sin, -sin, cos, 0, 0];
  const bounds = mapBox(transform, [0, 0, width, height]);
  transform[4] = -bounds[0];
  transform[5] = -bounds[1];
  const outW = Math.ceil(bounds[2]),
    outH = Math.ceil(bounds[3]);
  const inverse = invertTransform(transform);
  const rotated = new Float32Array(outW * outH).fill(1);
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      const [sx, sy] = mapPoint(inverse, x + 0.5, y + 0.5);
      const ix = Math.floor(sx),
        iy = Math.floor(sy);
      if (ix >= 0 && ix < width && iy >= 0 && iy < height)
        rotated[y * outW + x] = gray[iy * width + ix];
    }
  return { gray: rotated, width: outW, height: outH, transform };
}
