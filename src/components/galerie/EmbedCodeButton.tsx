"use client";
// use-client: navigator.clipboard.writeText API + click handler state

// Template : src/components/galerie/EmbedCodeButton.tsx
//
// Client component séparé pour le copy-to-clipboard du code embed.
// MUST live in a separate file with "use client" directive at the top
// (Next 16 App Router refuse de mélanger Server + Client component dans
// le même fichier).
//
// Importé depuis la page Server `src/app/[locale]/galerie/[slug]/page.tsx`.

import { useState } from "react";

// 2026-08-24 — ce fichier portait sa PROPRE copie de `escapeHtmlAttr`, identique
// au caractère près à celle qu'exportait `server/image-bank/utils/xml.ts` (qui,
// elle, n'avait aucun appelant). Deux exemplaires du même échappement, dont un
// mort. La SSOT vit désormais dans `@/lib/xml` — voir son en-tête : 27 copies de
// cette fonction coexistent encore dans le dépôt, sous six noms différents.
import { escapeHtmlAttr } from "@/lib/xml";

interface EmbedCodeButtonProps {
  /** Absolute CDN URL of the image (lg variant recommended). */
  imageUrl: string;
  /** Absolute URL of the detail page (CC BY 4.0 attribution target). */
  pageUrl: string;
  /** Alt text for the embedded <img>. */
  alt: string;
  /** Localized label : "Code intégration" / "Embed code". */
  label: string;
}

export function EmbedCodeButton({ imageUrl, pageUrl, alt, label }: EmbedCodeButtonProps) {
  const [copied, setCopied] = useState(false);

  // Snippet HTML auto-attribué CC BY 4.0 — copie minimaliste, pas de iframe.
  // L'attribution Axion-IA est inline (cf. license CC BY 4.0).
  const embedHtml = [
    `<a href="${pageUrl}" rel="noopener">`,
    `<img src="${imageUrl}" alt="${escapeHtmlAttr(alt)}" loading="lazy" />`,
    `</a>`,
    `<br>`,
    `<small>Image: <a href="${pageUrl}">Axion-IA</a> — CC BY 4.0</small>`,
  ].join("");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(embedHtml);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // navigator.clipboard.writeText peut throw sur iframe sans Clipboard permission.
          // Pas de telemetry ici — silencieux est OK pour cette interaction.
        }
      }}
      aria-live="polite"
      className="border-border-strong text-fg hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {copied ? `${label} ✓` : label}
    </button>
  );
}
