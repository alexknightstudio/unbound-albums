"use client";

import { decode } from "blurhash";
import { useEffect, useRef, useState } from "react";
import { RowsPhotoAlbum, type RenderImageProps, type Photo } from "react-photo-album";
import "react-photo-album/rows.css";
import "photoswipe/style.css";

/**
 * The gallery surface (PLATFORM_SPEC §6) — justified rows, blurhash
 * placeholders, full-screen lightbox. This is the sacred photo-forward
 * surface: no SaaS chrome, no cards, no borders. Just photographs.
 *
 * Layout is solved from stored aspect ratios before a single byte of image
 * arrives, so nothing reflows as photos stream in.
 */

export type GalleryPhoto = {
  id: string;
  src: string;
  full: string;
  width: number;
  height: number;
  blurhash: string | null;
};

/** Decodes a blurhash into a canvas that sits under the real image. */
function BlurhashBackdrop({ hash }: { hash: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    try {
      const pixels = decode(hash, 32, 32);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // A bad hash is cosmetic — leave the canvas empty.
    }
  }, [hash]);

  return (
    <canvas
      ref={ref}
      width={32}
      height={32}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ filter: "blur(1px)" }}
    />
  );
}

function GridImage({
  photo,
  imageProps,
  index,
  onOpen,
}: {
  photo: GalleryPhoto;
  imageProps: RenderImageProps;
  index: number;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image served from cache can finish BEFORE React attaches onLoad — that
  // event never fires and the photo would sit invisible forever. Check the
  // element's own completeness once mounted.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  const { src, alt, sizes, className, onClick, style, loading, ...rest } = imageProps;
  void onClick;
  void loading;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View photo full screen"
      className="relative block w-full cursor-zoom-in overflow-hidden bg-[#1a1b1e]"
      // The album wrapper sizes children via CSS variables; a custom element
      // must claim its own height or the row collapses to zero.
      style={{ ...style, aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {photo.blurhash && !loaded ? (
        <BlurhashBackdrop hash={photo.blurhash} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...rest}
        ref={imgRef}
        src={src}
        alt={alt}
        sizes={sizes}
        // The first screenful is eager (it's the LCP); the tail stays lazy.
        loading={index < 8 ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        className={`${className ?? ""} absolute inset-0 h-full w-full object-cover transition-opacity duration-500`}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </button>
  );
}

export function PhotoGrid({ photos }: { photos: GalleryPhoto[] }) {
  const lightboxRef = useRef<import("photoswipe/lightbox").default | null>(null);

  useEffect(() => {
    let cancelled = false;
    // PhotoSwipe is browser-only and heavy — load it after paint.
    void (async () => {
      const { default: PhotoSwipeLightbox } = await import("photoswipe/lightbox");
      if (cancelled) return;
      const lightbox = new PhotoSwipeLightbox({
        dataSource: photos.map((p) => ({
          src: p.full,
          width: p.width,
          height: p.height,
        })),
        pswpModule: () => import("photoswipe"),
        bgOpacity: 1,
        padding: { top: 24, bottom: 24, left: 16, right: 16 },
      });
      lightbox.init();
      lightboxRef.current = lightbox;
    })();
    return () => {
      cancelled = true;
      lightboxRef.current?.destroy();
      lightboxRef.current = null;
    };
  }, [photos]);

  const albumPhotos: (Photo & { galleryPhoto: GalleryPhoto })[] = photos.map(
    (p) => ({
      key: p.id,
      src: p.src,
      width: p.width,
      height: p.height,
      alt: "",
      galleryPhoto: p,
    }),
  );

  return (
    <RowsPhotoAlbum
      photos={albumPhotos}
      targetRowHeight={(containerWidth) =>
        containerWidth < 640 ? 200 : containerWidth < 1024 ? 260 : 320
      }
      spacing={8}
      render={{
        image: (imageProps, { photo, index }) => (
          <GridImage
            photo={(photo as (typeof albumPhotos)[number]).galleryPhoto}
            imageProps={imageProps}
            index={index}
            onOpen={() => lightboxRef.current?.loadAndOpen(index)}
          />
        ),
      }}
    />
  );
}
