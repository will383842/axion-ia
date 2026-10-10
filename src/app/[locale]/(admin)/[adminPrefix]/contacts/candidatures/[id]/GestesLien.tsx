"use client";
// use-client: confirmation avant de retirer un lien, retour du geste à l'écran.

/**
 * « Prolonger » et « Retirer le lien » d'un envoi de fichiers (Candidatures unifiées L5).
 * Retirer est définitif pour CE lien : la page devient neutre (on envoie un
 * nouveau message pour rouvrir l'accès) — d'où la confirmation.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  prolongerLienAction,
  retirerLienAction,
} from "@/features/bibliotheque-fichiers/liens-actions";

interface Props {
  readonly lienId: string;
  readonly retirable: boolean;
  /** « 30 jours » ou « 7 jours » : ce que fait « Prolonger ». */
  readonly duree: string;
  /** Un lien externe (Drive, WeTransfer) figure dans l'envoi [I4]. */
  readonly avecLienExterne: boolean;
}

export function GestesLien({ lienId, retirable, duree, avecLienExterne }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(quoi: "prolonger" | "retirer"): void {
    if (quoi === "retirer") {
      const avertissement = avecLienExterne
        ? "\n\nRetirer ce lien coupe l'accès par notre page, pas le lien d'origine (Drive, WeTransfer)."
        : "";
      if (
        !window.confirm(
          `Retirer ce lien ? La page de téléchargement ne montrera plus rien à cette personne.${avertissement}`,
        )
      )
        return;
    }
    demarrer(async () => {
      const r =
        quoi === "prolonger" ? await prolongerLienAction(lienId) : await retirerLienAction(lienId);
      setMessage({ ok: r.ok, texte: r.message });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      {retirable ? (
        <>
          <button
            type="button"
            className="admin-button-ghost admin-button-sm admin-button-tactile"
            disabled={enCours}
            onClick={() => lancer("prolonger")}
            title={`Nouvelle date limite : dans ${duree}`}
          >
            Prolonger ({duree})
          </button>
          <button
            type="button"
            className="admin-button-ghost-danger admin-button-sm admin-button-tactile"
            disabled={enCours}
            onClick={() => lancer("retirer")}
          >
            Retirer le lien
          </button>
        </>
      ) : null}
      {message ? (
        <span
          role={message.ok ? "status" : "alert"}
          className={
            message.ok ? "admin-alert admin-alert-success" : "admin-alert admin-alert-error"
          }
        >
          {message.texte}
        </span>
      ) : null}
    </div>
  );
}
