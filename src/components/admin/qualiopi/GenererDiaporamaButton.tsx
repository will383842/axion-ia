"use client";
// use-client: useTransition + état local du résultat, pour appeler la server action de génération.
/**
 * GenererDiaporamaButton — produit le diaporama projeté (.pptx) d'une formation
 * depuis son programme rédigé.
 *
 * Le bouton dit précisément ce qui s'est passé, parce que les trois issues sont
 * différentes et qu'aucune n'est un échec :
 *
 *  — une nouvelle version a été déposée, en BROUILLON : elle ne remplace rien
 *    tant qu'elle n'est pas publiée, et le .pptx déposé à la main reste servi ;
 *  — le contenu est INCHANGÉ : rien n'a été créé, et c'est une bonne nouvelle,
 *    pas une panne. Sans ce message, un second clic sans effet passerait pour un
 *    bug ;
 *  — le programme n'est pas encore rédigé : le message nomme ce qui manque au
 *    lieu de produire un fichier creux.
 *
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type GenererDiaporamaReponse =
  { ok: true; version: number; slides: number; inchange: boolean } | { ok: false; error: string };

export interface GenererDiaporamaButtonProps {
  formationId: string;
  /** Server action — `genererDiaporamaAction`. */
  action: (input: { formationId: string }) => Promise<GenererDiaporamaReponse>;
  /** Le slot porte-t-il déjà un fichier ? Change le libellé, pas le comportement. */
  dejaDepose?: boolean;
}

export function GenererDiaporamaButton({
  formationId,
  action,
  dejaDepose = false,
}: GenererDiaporamaButtonProps): React.ReactElement {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "ok" | "info" | "erreur"; texte: string } | null>(
    null,
  );

  const lancer = () => {
    setMessage(null);
    demarrer(async () => {
      const r = await action({ formationId });
      if (!r.ok) {
        setMessage({ ton: "erreur", texte: r.error });
        return;
      }
      setMessage(
        r.inchange
          ? {
              ton: "info",
              texte: `Contenu inchangé — la version ${r.version} est déjà à jour. Aucune nouvelle version créée.`,
            }
          : {
              ton: "ok",
              texte: `Version ${r.version} déposée en brouillon — ${r.slides} slides. Elle ne remplace le diaporama en place qu'une fois publiée.`,
            },
      );
      router.refresh();
    });
  };

  const tons = {
    ok: "text-[color:var(--color-admin-success-fg)]",
    info: "text-[color:var(--color-admin-fg-muted)]",
    erreur: "text-[color:var(--color-admin-destructive-fg)]",
  } as const;

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <button
        type="button"
        onClick={lancer}
        disabled={enCours}
        className="w-fit rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enCours
          ? "Génération en cours…"
          : dejaDepose
            ? "Regénérer le diaporama"
            : "Générer le diaporama"}
      </button>
      {message !== null && (
        <p className={`text-[13px] ${tons[message.ton]}`} role="status">
          {message.texte}
        </p>
      )}
    </div>
  );
}
