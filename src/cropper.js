/**
 * The crop overlay: draws the source image into a canvas and lets the user drag and resize
 * the crop rectangle over it. All geometry decisions live in crop.js; this module only deals
 * with pixels on screen and pointer events.
 */

import { centredCrop, clampCrop, minCropSize, moveCrop, refitCrop, resizeCrop } from './crop.js';

// The source preview never needs to be bigger than this; the crop is stored in real source
// coordinates regardless, so this only affects how sharp the on-screen preview is.
const PREVIEW_MAX_EDGE = 1024;

export function createCropper({ canvas, overlay, onChange }) {
  const box = overlay.querySelector('.crop-box');

  let image = null;
  let crop = null;
  let aspect = 1;
  let target = { w: 1, h: 1 };
  let minSize = { sw: 0, sh: 0 };
  let drag = null;
  let frame = 0;

  function emit() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onChange(crop);
    });
  }

  function render() {
    if (!image || !crop) return;
    box.style.left = `${(crop.sx / image.width) * 100}%`;
    box.style.top = `${(crop.sy / image.height) * 100}%`;
    box.style.width = `${(crop.sw / image.width) * 100}%`;
    box.style.height = `${(crop.sh / image.height) * 100}%`;
  }

  /** Grow a crop around its centre if it has fallen below the minimum useful size. */
  function applyMin(next) {
    if (next.sw >= minSize.sw && next.sh >= minSize.sh) return next;
    const scale = Math.max(minSize.sw / next.sw, minSize.sh / next.sh);
    const sw = next.sw * scale;
    const sh = next.sh * scale;
    return clampCrop(
      {
        sx: next.sx + next.sw / 2 - sw / 2,
        sy: next.sy + next.sh / 2 - sh / 2,
        sw,
        sh,
      },
      image.width,
      image.height,
    );
  }

  function update(next) {
    crop = applyMin(next);
    render();
    emit();
  }

  /** Client coordinates -> source-image coordinates. */
  function toSource(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * image.width,
      y: ((event.clientY - rect.top) / rect.height) * image.height,
    };
  }

  box.addEventListener('pointerdown', (event) => {
    if (!image || !crop) return;
    event.preventDefault();
    box.setPointerCapture(event.pointerId);
    drag = {
      handle: event.target.dataset.handle ?? null,
      start: toSource(event),
      crop,
    };
  });

  box.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = toSource(event);
    if (drag.handle) {
      update(
        resizeCrop(drag.crop, drag.handle, point, aspect, image.width, image.height, minSize),
      );
    } else {
      update(
        moveCrop(
          drag.crop,
          drag.crop.sx + (point.x - drag.start.x),
          drag.crop.sy + (point.y - drag.start.y),
          image.width,
          image.height,
        ),
      );
    }
  });

  for (const type of ['pointerup', 'pointercancel']) {
    box.addEventListener(type, (event) => {
      if (!drag) return;
      drag = null;
      box.releasePointerCapture(event.pointerId);
    });
  }

  return {
    /** Show a new source image and start with a centred crop. */
    setImage(bitmap) {
      image = bitmap;
      const scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      minSize = minCropSize(target.w, target.h, bitmap.width, bitmap.height);
      update(centredCrop(bitmap.width, bitmap.height, aspect));
    },

    /** Follow a change to the target dimensions: the crop keeps the target's aspect ratio. */
    setTarget(targetW, targetH) {
      target = { w: targetW, h: targetH };
      aspect = targetW / targetH;
      if (!image) return;
      minSize = minCropSize(targetW, targetH, image.width, image.height);
      update(refitCrop(crop, aspect, image.width, image.height));
    },

    getCrop() {
      return crop;
    },

    clear() {
      image = null;
      crop = null;
      drag = null;
    },
  };
}
