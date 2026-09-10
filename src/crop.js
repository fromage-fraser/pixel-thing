/**
 * Crop geometry. Pure functions, no DOM — all rectangles are in source-image pixel
 * coordinates as { sx, sy, sw, sh }, and `aspect` is always width / height.
 *
 * Every rectangle these functions return has exactly the requested aspect ratio, which is
 * what keeps the output from being stretched or skewed.
 */

/** Largest rectangle of the given aspect ratio that fits in the image, centred. */
export function centredCrop(imgW, imgH, aspect) {
  let sw = imgW;
  let sh = sw / aspect;
  if (sh > imgH) {
    sh = imgH;
    sw = sh * aspect;
  }
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh };
}

/** Shrink (preserving aspect) then shift a rectangle so it sits inside the image. */
export function clampCrop(crop, imgW, imgH) {
  const aspect = crop.sw / crop.sh;
  let { sw, sh } = crop;
  if (sw > imgW) {
    sw = imgW;
    sh = sw / aspect;
  }
  if (sh > imgH) {
    sh = imgH;
    sw = sh * aspect;
  }
  return {
    sx: Math.min(Math.max(crop.sx, 0), imgW - sw),
    sy: Math.min(Math.max(crop.sy, 0), imgH - sh),
    sw,
    sh,
  };
}

/** Move a rectangle to a new top-left, keeping it inside the image. */
export function moveCrop(crop, sx, sy, imgW, imgH) {
  return clampCrop({ ...crop, sx, sy }, imgW, imgH);
}

/**
 * The target dimensions changed: keep the crop's centre and its width where the new aspect
 * ratio allows, otherwise let the height drive the size.
 */
export function refitCrop(crop, newAspect, imgW, imgH) {
  const cx = crop.sx + crop.sw / 2;
  const cy = crop.sy + crop.sh / 2;
  let sw = crop.sw;
  let sh = sw / newAspect;
  if (sh > imgH) {
    sh = imgH;
    sw = sh * newAspect;
  }
  if (sw > imgW) {
    sw = imgW;
    sh = sw / newAspect;
  }
  return clampCrop({ sx: cx - sw / 2, sy: cy - sh / 2, sw, sh }, imgW, imgH);
}

/**
 * Smallest crop we allow: anything smaller than the target would mean upscaling. If the
 * source itself is smaller than the target, the largest available crop is the floor.
 */
export function minCropSize(targetW, targetH, imgW, imgH) {
  const largest = centredCrop(imgW, imgH, targetW / targetH);
  return { sw: Math.min(targetW, largest.sw), sh: Math.min(targetH, largest.sh) };
}

/**
 * Corner-handle drag. The corner opposite `handle` is the anchor and does not move; the
 * rectangle grows towards the pointer, keeping `aspect`, never leaving the image, and never
 * shrinking below `minSize` unless there is not that much room.
 */
export function resizeCrop(crop, handle, pointer, aspect, imgW, imgH, minSize) {
  const west = handle.includes('w');
  const north = handle.includes('n');
  const anchorX = west ? crop.sx + crop.sw : crop.sx;
  const anchorY = north ? crop.sy + crop.sh : crop.sy;

  // Follow whichever axis the pointer has pulled further, so the box tracks the cursor.
  let sw = Math.abs(pointer.x - anchorX);
  const sh = Math.abs(pointer.y - anchorY);
  sw = Math.max(sw, sh * aspect);

  // Room available from the anchor, in the direction the handle grows.
  const roomX = west ? anchorX : imgW - anchorX;
  const roomY = north ? anchorY : imgH - anchorY;
  const maxW = Math.min(roomX, roomY * aspect);

  sw = Math.min(Math.max(sw, minSize.sw), maxW);
  const height = sw / aspect;

  return clampCrop(
    {
      sx: west ? anchorX - sw : anchorX,
      sy: north ? anchorY - height : anchorY,
      sw,
      sh: height,
    },
    imgW,
    imgH,
  );
}
