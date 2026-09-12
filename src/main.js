/** Wiring: file loading, target dimensions, and the crop -> pixelate -> preview pipeline. */

import { createCropper } from './cropper.js';
import { pixelate } from './pixelate.js';
import { countColours, quantise } from './quantise.js';
import { downloadCanvasAsPng, outputFileName } from './download.js';

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 1024;
const PREVIEW_MAX_EDGE = 512;
const PREVIEW_MAX_SCALE = 8;
// Textures larger than this on either edge are magnified less, so a bigger target does not
// also mean a much bigger preview.
const PREVIEW_LARGE_EDGE = 32;
const PREVIEW_LARGE_SCALE = 4;
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg']);

const el = (id) => document.getElementById(id);

const widthInput = el('width');
const heightInput = el('height');
const lockInput = el('lock');
const coloursInput = el('colours');
const fileInput = el('file');
const dropzone = el('dropzone');
const stage = el('stage');
const overlay = el('crop-overlay');
const placeholder = el('placeholder');
const replaceButton = el('replace');
const sourceInfo = el('source-info');
const outputCanvas = el('output-canvas');
const outputInfo = el('output-info');
const saveButton = el('save');
const errorBox = el('error');

const state = {
  bitmap: null,
  fileName: '',
  targetW: 32,
  targetH: 32,
  // 'actual' keeps whatever colours pixelation resolves; a bit depth caps the output at 2**n.
  depth: 'actual',
};

const cropper = createCropper({
  canvas: el('source-canvas'),
  overlay,
  onChange: render,
});

// --- errors ---------------------------------------------------------------

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.textContent = '';
  errorBox.hidden = true;
}

// --- dimensions -----------------------------------------------------------

function clampDimension(value) {
  return Math.min(Math.max(Math.round(value), MIN_DIMENSION), MAX_DIMENSION);
}

/** The typed value, or null while the field is empty or otherwise mid-edit. */
function readDimension(input) {
  const value = Number(input.value);
  if (input.value.trim() === '' || !Number.isFinite(value) || value < MIN_DIMENSION) return null;
  return clampDimension(value);
}

function applyDimensions(source) {
  const typed = readDimension(source);
  if (typed === null) return;

  if (lockInput.checked) {
    const mirror = source === widthInput ? heightInput : widthInput;
    mirror.value = String(typed);
  }

  const width = readDimension(widthInput);
  const height = readDimension(heightInput);
  if (width === null || height === null) return;

  state.targetW = width;
  state.targetH = height;
  cropper.setTarget(width, height);
  render();
}

for (const input of [widthInput, heightInput]) {
  input.addEventListener('input', () => applyDimensions(input));
  // Normalise the field once the user is done typing (empty, 0, 5000, 12.7, ...).
  input.addEventListener('change', () => {
    const value = Number(input.value);
    input.value = String(Number.isFinite(value) && value >= MIN_DIMENSION ? clampDimension(value) : MIN_DIMENSION);
    applyDimensions(input);
  });
}

lockInput.addEventListener('change', () => {
  if (lockInput.checked) applyDimensions(widthInput);
});

// --- colours --------------------------------------------------------------

coloursInput.addEventListener('change', () => {
  const value = coloursInput.value;
  state.depth = value === 'actual' ? 'actual' : Number(value);
  render();
});

// --- loading a source image ----------------------------------------------

async function loadFile(file) {
  if (!file) return;
  clearError();

  if (!ACCEPTED_TYPES.has(file.type)) {
    showError(`${file.name} is not a JPEG or PNG.`);
    return;
  }

  let bitmap;
  try {
    // 'from-image' so EXIF-rotated phone photos are not loaded sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    showError(`Could not read ${file.name}. It may be corrupt or an unsupported variant.`);
    return;
  }

  state.bitmap?.close?.();
  state.bitmap = bitmap;
  state.fileName = file.name;

  placeholder.hidden = true;
  stage.hidden = false;
  overlay.hidden = false;
  replaceButton.hidden = false;

  cropper.setImage(bitmap);
}

fileInput.addEventListener('change', () => {
  loadFile(fileInput.files?.[0]);
  fileInput.value = '';
});

for (const type of ['dragenter', 'dragover']) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-over');
  });
}

for (const type of ['dragleave', 'drop']) {
  dropzone.addEventListener(type, () => dropzone.classList.remove('is-over'));
}

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  loadFile(event.dataTransfer?.files?.[0]);
});

// Dropping outside the zone should do nothing, not navigate away from the app.
for (const type of ['dragover', 'drop']) {
  window.addEventListener(type, (event) => event.preventDefault());
}

// --- pipeline -------------------------------------------------------------

/** Magnification for the output preview: 8x up to 32 px on an edge, 4x above that. */
function previewScale(targetW, targetH) {
  const edge = Math.max(targetW, targetH);
  const max = edge > PREVIEW_LARGE_EDGE ? PREVIEW_LARGE_SCALE : PREVIEW_MAX_SCALE;
  return Math.max(1, Math.min(max, Math.floor(PREVIEW_MAX_EDGE / edge)));
}

function render() {
  const crop = cropper.getCrop();
  if (!state.bitmap || !crop) {
    saveButton.disabled = true;
    return;
  }

  const { targetW, targetH } = state;
  const result = pixelate(state.bitmap, crop, targetW, targetH);

  // Quantise on the pixels themselves. Restricting colours always starts from a freshly
  // pixelated image, so switching between settings never compounds two reductions.
  const image = result.getContext('2d').getImageData(0, 0, targetW, targetH);
  if (state.depth !== 'actual') quantise(image, 2 ** state.depth);

  // Copy 1:1 into the on-page canvas, then magnify it with CSS so the preview stays crisp.
  // putImageData writes alpha straight through instead of compositing it.
  outputCanvas.width = targetW;
  outputCanvas.height = targetH;
  outputCanvas.getContext('2d').putImageData(image, 0, 0);

  const scale = previewScale(targetW, targetH);
  outputCanvas.style.width = `${targetW * scale}px`;
  outputCanvas.style.height = `${targetH * scale}px`;
  outputCanvas.hidden = false;

  outputInfo.textContent =
    `${targetW} x ${targetH} px, shown at ${scale}x, ${countColours(image)} colours`;
  sourceInfo.textContent =
    `${state.fileName} — ${state.bitmap.width} x ${state.bitmap.height} px, ` +
    `cropping ${Math.round(crop.sw)} x ${Math.round(crop.sh)} px`;

  saveButton.disabled = false;
}

saveButton.addEventListener('click', () => {
  if (saveButton.disabled) return;
  downloadCanvasAsPng(outputCanvas, outputFileName(state.fileName, state.targetW, state.targetH));
});

cropper.setTarget(state.targetW, state.targetH);
