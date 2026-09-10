import { describe, expect, it } from 'vitest';

import {
  centredCrop,
  clampCrop,
  minCropSize,
  moveCrop,
  refitCrop,
  resizeCrop,
} from '../src/crop.js';

const aspectOf = (crop) => crop.sw / crop.sh;
const inside = (crop, w, h) =>
  crop.sx >= -1e-9 && crop.sy >= -1e-9 && crop.sx + crop.sw <= w + 1e-9 && crop.sy + crop.sh <= h + 1e-9;

describe('centredCrop', () => {
  it('takes the full height of a landscape image for a square target', () => {
    expect(centredCrop(4000, 3000, 1)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
  });

  it('takes the full width for a wide target', () => {
    expect(centredCrop(4000, 3000, 4)).toEqual({ sx: 0, sy: 1000, sw: 4000, sh: 1000 });
  });

  it('uses the whole image when the aspect ratios already match', () => {
    expect(centredCrop(1600, 900, 16 / 9)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 });
  });
});

describe('clampCrop', () => {
  it.each([
    ['off the left edge', { sx: -80, sy: 10, sw: 100, sh: 100 }],
    ['off the top edge', { sx: 10, sy: -80, sw: 100, sh: 100 }],
    ['off the right edge', { sx: 380, sy: 10, sw: 100, sh: 100 }],
    ['off the bottom edge', { sx: 10, sy: 280, sw: 100, sh: 100 }],
  ])('pulls a crop back in when it hangs %s', (_label, crop) => {
    const clamped = clampCrop(crop, 400, 300);
    expect(inside(clamped, 400, 300)).toBe(true);
    expect(clamped.sw).toBe(100);
    expect(clamped.sh).toBe(100);
  });

  it('shrinks an oversized crop without changing its aspect ratio', () => {
    const clamped = clampCrop({ sx: 0, sy: 0, sw: 800, sh: 400 }, 400, 300);
    expect(aspectOf(clamped)).toBeCloseTo(2);
    expect(inside(clamped, 400, 300)).toBe(true);
    expect(clamped.sw).toBe(400);
  });
});

describe('moveCrop', () => {
  it('moves freely inside the image', () => {
    expect(moveCrop({ sx: 0, sy: 0, sw: 100, sh: 100 }, 50, 60, 400, 300)).toMatchObject({
      sx: 50,
      sy: 60,
    });
  });

  it('stops at the far edge instead of leaving the image', () => {
    expect(moveCrop({ sx: 0, sy: 0, sw: 100, sh: 100 }, 9999, 9999, 400, 300)).toMatchObject({
      sx: 300,
      sy: 200,
    });
  });
});

describe('refitCrop', () => {
  it('adopts the new aspect ratio and keeps the centre', () => {
    const before = { sx: 100, sy: 100, sw: 200, sh: 200 };
    const after = refitCrop(before, 4, 400, 300);
    expect(aspectOf(after)).toBeCloseTo(4);
    expect(after.sx + after.sw / 2).toBeCloseTo(200);
    expect(after.sy + after.sh / 2).toBeCloseTo(200);
  });

  it('falls back to a height-driven size when the width will not fit', () => {
    const after = refitCrop({ sx: 0, sy: 0, sw: 300, sh: 300 }, 1 / 4, 400, 300);
    expect(aspectOf(after)).toBeCloseTo(1 / 4);
    expect(after.sh).toBe(300);
    expect(inside(after, 400, 300)).toBe(true);
  });

  it('keeps the result inside the image after a drastic aspect change', () => {
    const after = refitCrop({ sx: 390, sy: 290, sw: 10, sh: 10 }, 8, 400, 300);
    expect(inside(after, 400, 300)).toBe(true);
  });
});

describe('minCropSize', () => {
  it('is the target size when the source is larger', () => {
    expect(minCropSize(32, 32, 4000, 3000)).toEqual({ sw: 32, sh: 32 });
  });

  it('falls back to the largest available crop when the source is smaller', () => {
    expect(minCropSize(64, 64, 40, 30)).toEqual({ sw: 30, sh: 30 });
  });
});

describe('resizeCrop', () => {
  const crop = { sx: 100, sy: 100, sw: 100, sh: 100 };
  const min = { sw: 32, sh: 32 };

  it('grows from the anchored corner', () => {
    const next = resizeCrop(crop, 'se', { x: 400, y: 150 }, 1, 1000, 1000, min);
    expect(next).toMatchObject({ sx: 100, sy: 100, sw: 300, sh: 300 });
  });

  it('keeps the opposite corner fixed when dragging north-west', () => {
    const next = resizeCrop(crop, 'nw', { x: 50, y: 60 }, 1, 1000, 1000, min);
    expect(next.sx + next.sw).toBeCloseTo(200);
    expect(next.sy + next.sh).toBeCloseTo(200);
    expect(next.sw).toBeCloseTo(150);
  });

  it.each(['nw', 'ne', 'se', 'sw'])('preserves a non-square aspect ratio from %s', (handle) => {
    const next = resizeCrop(crop, handle, { x: 700, y: 700 }, 4, 1000, 1000, min);
    expect(aspectOf(next)).toBeCloseTo(4);
    expect(inside(next, 1000, 1000)).toBe(true);
  });

  it('will not grow past the edge of the image', () => {
    const next = resizeCrop(crop, 'se', { x: 5000, y: 5000 }, 1, 400, 300, min);
    expect(inside(next, 400, 300)).toBe(true);
    expect(next.sw).toBeCloseTo(200);
  });

  it('will not shrink below the minimum size', () => {
    const next = resizeCrop(crop, 'se', { x: 101, y: 101 }, 1, 1000, 1000, min);
    expect(next.sw).toBeCloseTo(32);
    expect(next.sh).toBeCloseTo(32);
  });
});
