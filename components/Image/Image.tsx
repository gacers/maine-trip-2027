"use client";

import NextImage, { type ImageProps as NextImageProps } from "next/image";

export type ImageProps = NextImageProps;

/** Sensible default for fill layouts (cards / grids). Override per call site. */
const DEFAULT_FILL_SIZES = "(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 33vw";

// Thin wrapper around next/image so site-wide defaults (quality, lazy
// load, cover-fit fill) live in one place. Use fill + a positioned
// parent for card posters; width/height for fixed thumbnails.
export default function Image({
  alt,
  quality = 75,
  loading = "lazy",
  fill,
  sizes,
  style,
  ...props
}: ImageProps) {
  return (
    <NextImage
      alt={alt}
      quality={quality}
      loading={loading}
      fill={fill}
      sizes={fill ? (sizes ?? DEFAULT_FILL_SIZES) : sizes}
      style={
        fill
          ? {
              objectFit: "cover",
              objectPosition: "center",
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}
