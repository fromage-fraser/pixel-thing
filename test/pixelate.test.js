import { describe, expect, it } from 'vitest';

import { halvingSteps } from '../src/pixelate.js';

describe('halvingSteps', () => {
  it('uses as many exact halvings as fit, leaving a sub-2x first step', () => {
    // 3000 -> 32 * 2^6 = 2048 (a 1.46x reduction), then six exact halvings.
    expect(halvingSteps(3000, 3000, 32, 32)).toBe(6);
  });

  it('is 0 when the crop is less than twice the target', () => {
    expect(halvingSteps(60, 60, 32, 32)).toBe(0);
    expect(halvingSteps(20, 20, 32, 32)).toBe(0);
  });

  it('is limited by whichever axis runs out first', () => {
    expect(halvingSteps(4000, 100, 64, 16)).toBe(2);
  });
});
