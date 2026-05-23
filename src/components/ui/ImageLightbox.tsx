"use client";
// use-client: dialog.showModal() + click handlers require browser DOM.

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageLightboxProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** sizes hint for next/image */
  sizes?: string;
  /** className applied to the thumbnail wrapper (figure). */
  className?: string;
  /** Optional caption rendered under the thumbnail. */
  caption?: string;
}

// Thumbnail cliquable qui ouvre un overlay full-screen (native <dialog>).
// ESC ou clic backdrop ferme. Image agrandie chargée seulement à l'ouverture.
export function ImageLightbox({
  src,
  alt,
  width,
  height,
  sizes = "(max-width: 1024px) 100vw, 50vw",
  className,
  caption,
}: ImageLightboxProps) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = React.useState(false);

  function openModal() {
    const d = dialogRef.current;
    if (d && !d.open) {
      d.showModal();
      setOpen(true);
    }
  }
  function closeModal() {
    const d = dialogRef.current;
    if (d && d.open) {
      d.close();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border-0 bg-transparent p-0 focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        )}
        aria-label={`Agrandir : ${alt}`}
      >
        <figure className="border-border overflow-hidden rounded-2xl border">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            sizes={sizes}
            className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {caption ? (
            <figcaption className="text-fg-muted bg-paper px-4 py-2 text-xs leading-snug">
              {caption}
            </figcaption>
          ) : null}
        </figure>
      </button>

      <dialog
        ref={dialogRef}
        className="bg-mocha-rich/95 fixed inset-0 m-0 h-screen max-h-screen w-screen max-w-none overflow-auto p-0 backdrop:bg-black/80"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // close on backdrop click (when target is dialog itself, not children)
          if (e.target === dialogRef.current) closeModal();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") closeModal();
        }}
      >
        {open ? (
          <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
            <button
              type="button"
              onClick={closeModal}
              className="bg-paper text-fg fixed top-4 right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full shadow-lg focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:outline-none sm:top-6 sm:right-6"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <figure className="relative max-w-[1600px]">
              <Image
                src={src}
                alt={alt}
                width={width}
                height={height}
                sizes="100vw"
                className="h-auto w-full rounded-lg"
                priority
              />
              {caption ? (
                <figcaption className="text-paper/85 mt-4 text-center text-sm leading-relaxed">
                  {caption}
                </figcaption>
              ) : null}
            </figure>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
