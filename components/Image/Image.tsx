"use client";

import NextImage, { type ImageProps as NextImageProps } from "next/image";

export type ImageProps = NextImageProps;

/** Sensible default for fill layouts (cards / grids). Override per call site. */
const DEFAULT_FILL_SIZES = "(max-width: 40rem) 100vw, (max-width: 64rem) 50vw, 33vw";

/** Tiny neutral shimmer — used when placeholder="blur" and no blurDataURL. */
const DEFAULT_BLUR_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="100%" height="100%" fill="#e4e4e7"/></svg>`
  );

// Thin wrapper around next/image so site-wide defaults (quality, lazy
// load, cover-fit fill, blur placeholder) live in one place. Use fill +
// a positioned parent for card posters; width/height for fixed thumbs.
export default function Image({
  alt,
  quality = 75,
  loading = "lazy",
  fill,
  sizes,
  style,
  placeholder = "blur",
  blurDataURL,
  ...props
}: ImageProps) {
  const useBlur = placeholder === "blur";
  return (
    <NextImage
      alt={alt}
      quality={quality}
      loading={loading}
      fill={fill}
      sizes={fill ? (sizes ?? DEFAULT_FILL_SIZES) : sizes}
      placeholder={placeholder}
      blurDataURL={useBlur ? (blurDataURL ?? DEFAULT_BLUR_DATA_URL) : blurDataURL}
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
