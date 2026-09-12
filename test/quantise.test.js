import { describe, expect, it } from 'vitest';

import { buildPalette, countColours, quantise } from '../src/quantise.js';

/** An ImageData-shaped object one row high, from [r, g, b, a] tuples. */
const image = (pixels) => ({
  width: pixels.length,
  height: 1,
  data: new Uint8ClampedArray(pixels.flat()),
});

const clone = (img) => ({ ...img, data: new Uint8ClampedArray(img.data) });

const pixelAt = (img, i) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];

const greys = (n, step) => Array.from({ length: n }, (_, i) => [i * step, i * step, i * step, 255]);

/** Independent nearest-colour search, to check the module's own mapping against. */
function nearest(palette, [r, g, b]) {
  return palette.reduce((best, colour) => {
    const distance = (c) => (c.r - r) ** 2 + (c.g - g) ** 2 + (c.b - b) ** 2;
    return distance(colour) < distance(best) ? colour : best;
  });
}

describe('countColours', () => {
  it('counts distinct colours, not pixels', () => {
    expect(countColours(image([[10, 20, 30, 255], [10, 20, 30, 255], [40, 50, 60, 255]]))).toBe(2);
  });

  it('ignores fully transparent pixels', () => {
    expect(countColours(image([[10, 20, 30, 255], [0, 0, 0, 0], [99, 99, 99, 0]]))).toBe(1);
  });

  it('is 0 for an entirely transparent image', () => {
    expect(countColours(image([[0, 0, 0, 0], [7, 7, 7, 0]]))).toBe(0);
  });
});

describe('quantise', () => {
  it('leaves an image that already fits within the limit untouched', () => {
    const original = image([[200, 0, 0, 255], [0, 200, 0, 255], [0, 0, 200, 255]]);
    const result = quantise(clone(original), 32);
    expect(result.data).toEqual(original.data);
  });

  it('leaves a solid colour as a single colour', () => {
    const result = quantise(image(Array(16).fill([90, 120, 150, 255])), 4);
    expect(countColours(result)).toBe(1);
    expect(pixelAt(result, 0)).toEqual([90, 120, 150]);
  });

  it.each([8, 16, 32])('reduces a 64-colour gradient to exactly %i colours', (max) => {
    expect(countColours(quantise(image(greys(64, 4)), max))).toBe(max);
  });

  it('maps every pixel to its nearest palette colour', () => {
    const original = image([
      [12, 200, 30, 255], [18, 190, 44, 255], [250, 10, 10, 255], [230, 40, 25, 255],
      [8, 12, 240, 255], [30, 20, 210, 255], [120, 120, 120, 255], [250, 250, 240, 255],
      [60, 70, 80, 255], [200, 180, 40, 255], [90, 20, 140, 255], [15, 15, 15, 255],
    ]);
    const palette = buildPalette(original, 3);
    const result = quantise(clone(original), 3);

    expect(palette).toHaveLength(3);
    for (let i = 0; i < original.width; i += 1) {
      const { r, g, b } = nearest(palette, pixelAt(original, i));
      expect(pixelAt(result, i)).toEqual([r, g, b]);
    }
  });

  it('keeps each pixel its own alpha', () => {
    const alphas = [255, 128, 64, 200, 255, 3, 90, 255];
    const source = greys(8, 30).map((pixel, i) => [...pixel.slice(0, 3), alphas[i]]);
    const result = quantise(image(source), 2);

    expect([...result.data.filter((_, i) => i % 4 === 3)]).toEqual(alphas);
    expect(countColours(result)).toBe(2);
  });

  it('does not spend a palette entry on fully transparent pixels', () => {
    // Five distinct RGB values in the buffer, but only four that are actually visible, so a
    // limit of four needs no reduction at all.
    const original = image([
      [200, 30, 30, 255], [30, 200, 30, 255], [30, 30, 200, 255], [200, 200, 30, 255],
      [0, 0, 0, 0],
    ]);
    const result = quantise(clone(original), 4);

    expect(result.data).toEqual(original.data);
    expect(countColours(result)).toBe(4);
  });

  it('handles an entirely transparent image', () => {
    const original = image([[0, 0, 0, 0], [7, 7, 7, 0]]);
    expect(quantise(clone(original), 4).data).toEqual(original.data);
  });
});

describe('buildPalette', () => {
  it('returns one colour per requested slot once there are enough distinct colours', () => {
    expect(buildPalette(image(greys(64, 4)), 8)).toHaveLength(8);
  });

  it('never returns more colours than the image actually has', () => {
    expect(buildPalette(image([[10, 10, 10, 255], [20, 20, 20, 255]]), 16)).toHaveLength(2);
  });

  it('is empty for an image with nothing visible in it', () => {
    expect(buildPalette(image([[0, 0, 0, 0]]), 8)).toEqual([]);
  });
});
