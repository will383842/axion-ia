"use client";
// use-client: état local (résultat + liens) + useTransition pour la server action deck.
/**
 * GenererDeckButton — Génère le DIAPORAMA DE PROJECTION (PDF 16:9 + PowerPoint
 * éditable) d'une formation. Affiche les deux liens de téléchargement dès le
 * succès (URLs signées fraîches renvoyées par l'action → pas de lien expiré).
 *
 * "use client" : appel Server Action + feedback. Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface DeckResult {
  supportId: string;
  pdfUrl: string | null;
  pptxUrl: string | null;
  nbSlides: number;
  pptxDisponible: boolean;
}

export interface GenererDeckButtonProps {
  formationId: string;
  genererAction: (input: {
    formationId: string;
  }) => Promise<{ data: DeckResult } | { error: string }>;
}

export function GenererDeckButton({
  formationId,
  genererAction,
}: GenererDeckButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeckResult | null>(null);

  function handleGenerer() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await genererAction({ formationId });
      if ("error" in res) {
        setError(res.error);
      } else {
        setResult(res.data);
        router.refresh();
      }
    });
  }

  const linkCls =
    "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline hover:no-underline";

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex items-center gap-[var(--space-admin-4)]">
        <button type="button" onClick={handleGenerer} disabled={isPending} className="admin-button">
          {isPending ? "Génération du diaporama…" : "Générer le diaporama (PDF 16:9 + PowerPoint)"}
        </button>
        {result != null && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {result.nbSlides} slides
          </span>
        )}
      </div>

      {result != null && (
        <div className="flex flex-wrap items-center gap-[var(--space-admin-5)]">
          {result.pdfUrl != null ? (
            <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
              ⬇ PDF de projection (16:9)
            </a>
          ) : (
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              PDF : stockage non configuré
            </span>
          )}
          {result.pptxUrl != null ? (
            <a href={result.pptxUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
              ⬇ PowerPoint éditable (.pptx)
            </a>
          ) : (
            <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              PowerPoint : {result.pptxDisponible ? "stockage non configuré" : "indisponible"}
            </span>
          )}
        </div>
      )}

      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
