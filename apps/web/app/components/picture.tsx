import type { Locale } from "../../src/copy.ts";
import { SYNTHETIC_IMAGE } from "../../src/copy.ts";

export type BrandImage = "hero-pampa" | "robot-inspeccion" | "estacion-renovada" | "patron-red";

const WIDTHS = [480, 768, 1280] as const;
// Solo existe el JPEG de 1280. 480 y 768 responden 404 y rompen el respaldo.
const JPEG_WIDTHS = [1280] as const;

function asset(name: BrandImage, width: number, ext: "avif" | "webp" | "jpg"): string {
  return `/brand/img/${name}-${width}.${ext}`;
}

function srcset(name: BrandImage, ext: "avif" | "webp" | "jpg"): string {
  const widths = ext === "jpg" ? JPEG_WIDTHS : WIDTHS;
  return widths.map((w) => `${asset(name, w, ext)} ${w}w`).join(", ");
}

/**
 * Imagen sintética de marca en AVIF/WebP con JPEG de respaldo.
 * Las fuentes son de 1280×720: nunca se piden por encima de ese ancho.
 */
export function BrandPicture({
  name,
  alt,
  sizes,
  priority = false,
  className = "",
}: {
  name: BrandImage;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={srcset(name, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcset(name, "webp")} sizes={sizes} />
      <img
        src={asset(name, 1280, "jpg")}
        srcSet={srcset(name, "jpg")}
        sizes={sizes}
        width={1280}
        height={720}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </picture>
  );
}

export function SyntheticFigure({
  name,
  alt,
  caption,
  locale,
  sizes,
  priority = false,
  variant = "card",
}: {
  name: BrandImage;
  alt: string;
  caption: string;
  locale: Locale;
  sizes: string;
  priority?: boolean;
  variant?: "hero" | "card";
}) {
  return (
    <figure className={`figure figure--${variant}`}>
      <BrandPicture name={name} alt={alt} sizes={sizes} priority={priority} />
      <figcaption>
        {SYNTHETIC_IMAGE[locale]} · {caption}
      </figcaption>
    </figure>
  );
}
