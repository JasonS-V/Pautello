export type ContrastMode = 'original' | 'local' | 'adaptive';

/** Fondo local suavizado: conserva los niveles intermedios de bordes, puntillos y cabezas huecas. */
export function contrastVariants(gray: Float32Array, width: number, height: number) {
  const histogram = new Uint32Array(256);
  for (const value of gray) histogram[Math.round(value * 255)]++;
  let accumulated = 0,
    black = 0,
    white = 1;
  for (let i = 0; i < 256; i++) {
    accumulated += histogram[i];
    if (accumulated >= gray.length * 0.005) {
      black = i / 255;
      break;
    }
  }
  accumulated = 0;
  for (let i = 0; i < 256; i++) {
    accumulated += histogram[i];
    if (accumulated >= gray.length * 0.95) {
      white = i / 255;
      break;
    }
  }
  const integral = new Float64Array((width + 1) * (height + 1));
  const stride = width + 1;
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += gray[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const local = new Float32Array(gray.length),
    adaptive = new Float32Array(gray.length);
  const radius = Math.max(8, Math.round(Math.min(width, height) / 20));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(width, x + radius + 1);
      const y0 = Math.max(0, y - radius),
        y1 = Math.min(height, y + radius + 1);
      const mean =
        (integral[y1 * stride + x1] -
          integral[y0 * stride + x1] -
          integral[y1 * stride + x0] +
          integral[y0 * stride + x0]) /
        ((x1 - x0) * (y1 - y0));
      const i = y * width + x,
        value = gray[i];
      local[i] = Math.max(
        0,
        Math.min(1, (value - black) / Math.max(0.05, Math.max(mean, white * 0.98) - black))
      );
      adaptive[i] = value < mean - 0.04 ? 0 : 1;
    }
  return { original: gray, local, adaptive };
}

/** La mejora de líneas no basta: no se permite perder ni inventar tinta en símbolos. */
export function preservesSymbols(original: Float32Array, candidate: Float32Array): boolean {
  let sourceInk = 0,
    lost = 0,
    added = 0;
  for (let i = 0; i < original.length; i++) {
    if (original[i] < 0.9) {
      sourceInk++;
      if (candidate[i] > 0.94) lost++;
    } else if (candidate[i] < 0.6) added++;
  }
  return sourceInk > 0 && lost / sourceInk <= 0.005 && added / sourceInk <= 0.01;
}
