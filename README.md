# Pixel Thing

A tool to convert images into pixelated PNG textures.

![Pixel Thing, showing a photo cropped to a square and pixelated to 32 x 32](./doc/pixel-thing.png)

## Usage

Requires [pnpm](https://pnpm.io) (`mise install`).

```sh
pnpm install
pnpm dev
```

or

```sh
make
```

This runs the application at http://localhost:5173

Then:

1. Set the target width and height in pixels. "Lock to square" keeps them equal, and is on by default at 32 x 32.
2. Drop a JPEG or PNG onto the source pane, or click "Choose a file".
3. Drag the crop box, or its corners, to pick the area to keep. It is locked to the target's aspect ratio, so the output is never stretched or skewed.
4. Click **Save PNG**. The file downloads at exactly the target dimensions — it is never scaled up.


## Docs

See [Design](./doc/design.md).
