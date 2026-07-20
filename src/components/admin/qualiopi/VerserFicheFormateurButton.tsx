"use client";
// use-client: appel de Server Action + retour visuel (numéro du document versé) via useTransition.

/**
 * Verse la fiche formateur au dossier de preuves (ind. 21).
 *
 * Distinct de `PdfExportButton` : celui-ci ne télécharge rien, il PERSISTE un
 * document officiel (numéroté, hashé, conservé) et renseigne `Trainer.cvUrl`,
 * ce qui rend l'indicateur 21 couvert. Le retour affiche le numéro attribué,
 * qui est la référence citable au dossier d'audit.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verserFicheFormateurAction } from "@/server/actions/qualiopi/documents";

export interface VerserFicheFormateurButtonProps {
  trainerId: string;
  /** True si une fiche a déjà été versée — change le libellé (remplacement). */
  dejaVersee: boolean;
}

export function VerserFicheFormateurButton({
  trainerId,
  dejaVersee,
}: VerserFicheFormateurButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onClick(): void {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await verserFicheFormateurAction({ trainerId });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setMsg(`Fiche versée au dossier — ${r.data.numero}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <button type="button" onClick={onClick} disabled={isPending} className="admin-button">
        {isPending
          ? "Versement…"
          : dejaVersee
            ? "Remplacer la fiche au dossier"
            : "Verser la fiche au dossier (ind. 21)"}
      </button>
      {msg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {msg}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
