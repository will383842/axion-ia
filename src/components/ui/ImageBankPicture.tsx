// use-client: état hover/intersection + gestion événements LQIP → nécessite le DOM
'use client';
// Composant image pour la banque d'images Axion-IA.
//
// Rendu d'une image banque via <picture> srcset WebP + AVIF multi-variants,
// LQIP background-image, JSON-LD ImageObject, et attributs AEO speakable.
//
// Usage :
//   <ImageBankPicture
//     slug="axion-ia-audit-ia-paris-banniere"
//     alt="Audit IA à Paris — Axion-IA"
//     caption="Cabinet IA expert Paris"
//     priority={true}
//     width={1200}
//     height={630}
//     lqipBase64="data:image/webp;base64,..."
//   />
//
// Variantes disponibles (générées par le pipeline Sharp) :
//   {slug}.webp       — pleine largeur WebP
//   {slug}.avif       — pleine largeur AVIF
//   {slug}-md.webp    — 768 px
//   {slug}-sm.webp    — 384 px
//   {slug}-og.webp    — 1200×630 OG (non exposé en srcset)
//   {slug}-square.webp— 1080×1080
//   {slug}-thumb.webp — 400×300 (admin)
//
// Perf budget AGENTS.md :
//   - LCP ≤ 1 800 ms p75 : utiliser priority={true} pour les images above-the-fold.
//   - CLS = 0 : toujours passer width + height explicites.
//   - JS : 0 KB (composant serveur-compatible, 'use client' uniquement pour
//     compatibilité React 19 hydration — aucun state, aucun effet).

import type { CSSProperties } from 'react';
import ReactDOM from 'react-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageBankPictureProps {
  /**
   * Slug de l'image (sans extension ni suffixe variant).
   * Ex. : "axion-ia-audit-ia-paris-banniere"
   */
  slug: string;
  /** Texte alternatif (WCAG 2.2 — obligatoire). */
  alt: string;
  /** Légende / caption — exposée en `itemProp="description"` + `data-speakable` (AEO). */
  caption?: string;
  /**
   * true = image LCP above-the-fold → fetchpriority="high" + loading="eager".
   * false (défaut) = lazy + async.
   */
  priority?: boolean;
  /** Largeur intrinsèque px — requis pour réserver l'espace (anti-CLS). */
  width?: number;
  /** Hauteur intrinsèque px — requis pour réserver l'espace (anti-CLS). */
  height?: number;
  /**
   * Data URI LQIP (Low Quality Image Placeholder).
   * Affichée en background-image pendant le chargement — inlinée < 1 KB.
   */
  lqipBase64?: string;
  /** Classes CSS Tailwind / custom passées au <figure>. */
  className?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function ImageBankPicture({
  slug,
  alt,
  caption,
  priority = false,
  width,
  height,
  lqipBase64,
  className,
}: ImageBankPictureProps) {
  const base = `/images/${slug}`;

  // React 19 / Next.js 15+ : émet un <link rel="preload" as="image"> dans le
  // <head> lorsque l'image est above-the-fold. Cela permet aux navigateurs de
  // commencer le téléchargement de l'image avant que le rendu HTML ne soit
  // complet, améliorant significativement le LCP.
  // ReactDOM.preload() fonctionne côté serveur (SSR) ET côté client.
  if (priority) {
    ReactDOM.preload(`${base}.webp`, {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: `${base}.webp 1920w, ${base}-md.webp 768w, ${base}-sm.webp 384w`,
      imageSizes: '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px',
      type: 'image/webp',
    });
  }

  // Style inline pour le LQIP — fond flou pendant le chargement.
  const imgStyle: CSSProperties | undefined = lqipBase64
    ? {
        backgroundImage: `url(${lqipBase64})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <figure
      itemScope
      itemType="https://schema.org/ImageObject"
      className={className}
    >
      <meta itemProp="url" content={`${base}.webp`} />
      {width && <meta itemProp="width" content={String(width)} />}
      {height && <meta itemProp="height" content={String(height)} />}

      <picture>
        {/*
          AVIF — pleine taille uniquement (le pipeline auto-convert génère 1 seul
          variant AVIF sans suffix). Les navigateurs qui supportent AVIF obtiendront
          la meilleure compression ; les autres tombent sur le srcset WebP responsive.
        */}
        <source
          type="image/avif"
          srcSet={`${base}.avif`}
        />
        {/* WebP — 3 breakpoints responsive (sm/md/full générés par le worker) */}
        <source
          type="image/webp"
          srcSet={`${base}.webp 1920w, ${base}-md.webp 768w, ${base}-sm.webp 384w`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
        />
        <img
          src={`${base}.webp`}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          fetchPriority={priority ? 'high' : 'auto'}
          style={imgStyle}
          itemProp="contentUrl"
        />
      </picture>

      {caption && (
        <figcaption
          itemProp="description"
          className="sr-only"
          data-speakable="true"
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
