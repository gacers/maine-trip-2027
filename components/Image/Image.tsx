"use client";

import { useState } from "react";
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

/**
 * Hosts where next/image's server-side fetch typically fails (referrer-
 * locked API keys, bot rate limits, CDN hotlink rules) even when the
 * browser can load the same URL. Skip the optimizer for these.
 */
function shouldSkipOptimization(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return false;
  try {
    const host = new URL(src, "https://example.com").hostname.toLowerCase();
    if (
      host === "places.googleapis.com" ||
      host === "maps.googleapis.com" ||
      host === "maps.gstatic.com" ||
      host === "upload.wikimedia.org"
    ) {
      return true;
    }
    if (host.endsWith(".ggpht.com") || host.endsWith(".googleusercontent.com")) return true;
    if (host.endsWith(".gstatic.com") && host.startsWith("encrypted-tbn")) return true;
    if (host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net")) return true;
    return false;
  } catch {
    return false;
  }
}

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
  unoptimized,
  src,
  onError,
  ...props
}: ImageProps) {
  // If the optimizer fails once (403/429/etc.), retry as a plain <img>
  // so browser-loadable URLs still show.
  const [optimizerFailed, setOptimizerFailed] = useState(false);
  const skipOpt = optimizerFailed || (unoptimized ?? shouldSkipOptimization(src));
  const useBlur = placeholder === "blur" && !skipOpt;

  return (
    <NextImage
      alt={alt}
      src={src}
      quality={quality}
      loading={loading}
      fill={fill}
      sizes={fill ? (sizes ?? DEFAULT_FILL_SIZES) : sizes}
      unoptimized={skipOpt}
      placeholder={useBlur ? "blur" : skipOpt ? "empty" : placeholder}
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
      onError={(e) => {
        if (!skipOpt) {
          setOptimizerFailed(true);
          return;
        }
        onError?.(e);
      }}
      {...props}
    />
  );
}
