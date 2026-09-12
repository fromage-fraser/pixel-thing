# Design

This repository should provide a web application that can run locally.

It should be a simple Javascript-based application using:

- `pnpm` for package management
- `vite` as a build tool

Usage will be completely local: there is no need to accept requests from external hosts, do any authentication or
caching, tracking, logging, etc.


## Purpose

The purpose of the tool is to take a source image provided by the user, pixelate it, and save the pixelated image
as a PNG file, which is saved to the default location for the browser.

The user will specify the target image height and width, in pixels. The image is then pixelated to those dimensions.

The output image is not scaled: it will have the same pixel dimensions that the user has specified. 


## Interface

The application should be a simple page that:

- Lets the user configure the target file dimensions, which a checkbox option to "lock" the dimensions as a square. This "lock" is set by default, with a default height and width of 32 pixels. 
- Has a file upload area for supplying source images. The user should also be able to drag the source image into the app.
- Should support reading JPEG and PNG source files.
- Should crop or subselect an area of the source image, so that the source has the same aspect ratio as the target file.
- **Should not** stretch or skew the source image in any way.
- Should pixelate the source image to the given target dimensions.
- Should preview the output image, but scaled so that it is clearly visible (e.g. 8x magnification).
- Should have a "Save" button that appears active when the image is successfully transformed. Saving will download the target PNG.
- The user is also able to select from a dropdown the colours to use in the target image. The options include the actual colours resolved during pixelation, or a colour depth from "8-bit" (256 colours) down to "3-bit" (8 colours). These other options are restrictions to the set of possible output colours: at most 2^n of them, chosen from the image itself.
