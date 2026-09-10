/** Save a canvas as a PNG via the browser's normal download flow. */

export function downloadCanvasAsPng(canvas, fileName) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/** "holiday snap.JPEG" + 32x32 -> "holiday snap-32x32.png" */
export function outputFileName(sourceName, targetW, targetH) {
  const base = (sourceName || 'image').replace(/\.[^./\\]+$/, '') || 'image';
  return `${base}-${targetW}x${targetH}.png`;
}
