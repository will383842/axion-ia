"use client";
// use-client: navigator.clipboard + état "Copié !" 2 s + aria-live.
//
// Îlot d'interactivité MINIMAL — copie un texte arbitraire (citation porte-parole,
// boilerplate) dans le presse-papiers. Calqué sur `CopyLinkButton` mais générique :
// le parent serveur passe le texte déjà localisé. Seul ce bouton embarque du JS.

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyTextButtonProps {
  /** Texte copié dans le presse-papiers (déjà localisé par le parent). */
  readonly text: string;
  /** Libellé au repos (déjà localisé). */
  readonly label: string;
  /** Libellé après copie (déjà localisé). */
  readonly copiedLabel: string;
}

/**
 * Bouton « Copier la citation » — pill chartré. État « Copié ! » pendant 2 s,
 * annoncé via `aria-live="polite"`.
 */
export function CopyTextButton({ text, label, copiedLabel }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
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
      className="border-border text-fg-soft hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {copied ? (
        <Check className="text-terracotta size-4" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
