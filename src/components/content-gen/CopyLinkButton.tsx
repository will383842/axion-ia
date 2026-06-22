"use client";
// use-client: navigator.clipboard + état "Copié !" 2 s + aria-live.
//
// Îlot d'interactivité MINIMAL isolé du server component `ArticleShareBar`.
// Seul ce bouton embarque du JS ; les liens de partage (X / LinkedIn / e-mail)
// restent de simples <a> rendus côté serveur (0 JS).

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

interface CopyLinkButtonProps {
  readonly url: string;
  /** Libellé au repos (déjà localisé par le parent). */
  readonly label: string;
  /** Libellé après copie (déjà localisé par le parent). */
  readonly copiedLabel: string;
}

/**
 * Bouton « Copier le lien » — pill chartré, cohérent avec les liens de partage.
 * État « Copié ! » pendant 2 s, annoncé via `aria-live="polite"`.
 */
export function CopyLinkButton({ url, label, copiedLabel }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible (contexte non sécurisé) : no-op silencieux.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? copiedLabel : label}
      className="border-border text-fg-soft hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {copied ? (
        <Check className="text-terracotta size-4" aria-hidden="true" />
      ) : (
        <Link2 className="size-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
