/**
 * Area-average downscale of a cropped region to exact target dimensions.
 *
 * The chain of intermediate sizes is built as targetW * 2^n down to targetW * 2^0, so every
 * step after the first is an exact halving on both axes — a true 2x2 box average — and no
 * step ever changes the aspect ratio. `n` is chosen so the first draw reduces by less than
 * 2x, which keeps the whole cascade equivalent to a box filter without allocating ImageData
 * for the full-size source.
 */

function context(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** How many exact halvings fit between the crop and the target. */
export function halvingSteps(cropW, cropH, targetW, targetH) {
  let steps = 0;
  while (targetW * 2 ** (steps + 1) <= cropW && targetH * 2 ** (steps + 1) <= cropH) {
    steps += 1;
  }
  return steps;
}

/**
 * @param {ImageBitmap|HTMLCanvasElement|HTMLImageElement} source
 * @param {{sx:number, sy:number, sw:number, sh:number}} crop region of the source to keep
 * @returns {HTMLCanvasElement} a canvas of exactly targetW x targetH
 */
export function pixelate(source, crop, targetW, targetH) {
  const steps = halvingSteps(crop.sw, crop.sh, targetW, targetH);

  // Two scratch canvases, used alternately so we never read and write the same one.
  const scratch = [document.createElement('canvas'), document.createElement('canvas')];

  let src = source;
  let { sx, sy, sw, sh } = crop;

  for (let i = steps; i >= 1; i -= 1) {
    const canvas = scratch[i % 2];
    canvas.width = targetW * 2 ** i;
    canvas.height = targetH * 2 ** i;
    context(canvas).drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    src = canvas;
    sx = 0;
    sy = 0;
    sw = canvas.width;
    sh = canvas.height;
  }

  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  context(out).drawImage(src, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return out;
}
