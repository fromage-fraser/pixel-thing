/**
 * Colour-count reduction.
 *
 * The palette comes from the image's own pixels by median cut: start with one box holding every
 * distinct colour, repeatedly split the box with the widest channel spread at that channel's
 * population-weighted median, then take each finished box's weighted mean as a palette entry.
 * Every pixel is mapped to its nearest palette colour with no dithering, so flat areas stay flat.
 *
 * No DOM: an "image" here is anything shaped like ImageData ({ width, height, data }), and
 * `quantise` rewrites `data` in place because ImageData cannot be constructed outside a browser.
 */

const CHANNELS = ['r', 'g', 'b'];

const packed = (r, g, b) => (r << 16) | (g << 8) | b;

/**
 * Packed RGB -> how many pixels have that colour. Fully transparent pixels are ignored: their
 * RGB carries no information and would spend a palette entry on it.
 */
function tally(image) {
  const counts = new Map();
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = packed(data[i], data[i + 1], data[i + 2]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function entriesOf(counts) {
  return [...counts].map(([key, n]) => ({ r: (key >> 16) & 255, g: (key >> 8) & 255, b: key & 255, n }));
}

/** A box records the widest channel of the colours it holds, which is where it would be cut. */
function makeBox(entries) {
  const min = { r: 255, g: 255, b: 255 };
  const max = { r: 0, g: 0, b: 0 };
  let total = 0;

  for (const entry of entries) {
    total += entry.n;
    for (const channel of CHANNELS) {
      if (entry[channel] < min[channel]) min[channel] = entry[channel];
      if (entry[channel] > max[channel]) max[channel] = entry[channel];
    }
  }

  let channel = 'r';
  for (const c of CHANNELS) {
    if (max[c] - min[c] > max[channel] - min[channel]) channel = c;
  }

  return { entries, total, channel, range: max[channel] - min[channel] };
}

/** Cut at the population-weighted median, so both halves stand for a similar number of pixels. */
function split(box) {
  const sorted = [...box.entries].sort((a, b) => a[box.channel] - b[box.channel]);
  const half = box.total / 2;
  let seen = 0;
  let cut = 0;

  // Stop one short of the end so neither half comes out empty.
  while (cut < sorted.length - 1 && seen + sorted[cut].n <= half) {
    seen += sorted[cut].n;
    cut += 1;
  }
  if (cut === 0) cut = 1;

  return [makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut))];
}

/** The colour that best stands for a box's pixels. */
function meanOf(box) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const entry of box.entries) {
    r += entry.r * entry.n;
    g += entry.g * entry.n;
    b += entry.b * entry.n;
  }
  return { r: Math.round(r / box.total), g: Math.round(g / box.total), b: Math.round(b / box.total) };
}

function paletteFrom(entries, max) {
  if (entries.length === 0) return [];
  const boxes = [makeBox(entries)];

  while (boxes.length < max) {
    // Widest spread first, population breaking ties: a gradient reaching across the colour space
    // earns a split before a large flat area that is already well represented by one colour.
    let best = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i].entries.length < 2) continue;
      if (best === -1 || boxes[i].range > boxes[best].range) best = i;
      else if (boxes[i].range === boxes[best].range && boxes[i].total > boxes[best].total) best = i;
    }
    if (best === -1) break; // every box is down to a single colour

    const [left, right] = split(boxes[best]);
    boxes.splice(best, 1, left, right);
  }

  return boxes.map(meanOf);
}

function nearestIn(palette, r, g, b) {
  let best = palette[0];
  let bestDistance = Infinity;
  for (const colour of palette) {
    const dr = colour.r - r;
    const dg = colour.g - g;
    const db = colour.b - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = colour;
    }
  }
  return best;
}

/** How many distinct colours an image uses, not counting fully transparent pixels. */
export function countColours(image) {
  return tally(image).size;
}

/** At most `max` colours, chosen by median cut over the image's own pixels. */
export function buildPalette(image, max) {
  return paletteFrom(entriesOf(tally(image)), max);
}

/**
 * Restrict `image` to at most `max` colours, in place. Returns the same image.
 *
 * Alpha is never quantised: every pixel keeps its own, and fully transparent pixels are left
 * exactly as they were.
 */
export function quantise(image, max) {
  const counts = tally(image);
  if (counts.size <= max) return image;

  const palette = paletteFrom(entriesOf(counts), max);
  // Nearest-colour search runs once per distinct colour, not once per pixel.
  const nearest = new Map();
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = packed(data[i], data[i + 1], data[i + 2]);
    let colour = nearest.get(key);
    if (colour === undefined) {
      colour = nearestIn(palette, data[i], data[i + 1], data[i + 2]);
      nearest.set(key, colour);
    }
    data[i] = colour.r;
    data[i + 1] = colour.g;
    data[i + 2] = colour.b;
  }

  return image;
}
