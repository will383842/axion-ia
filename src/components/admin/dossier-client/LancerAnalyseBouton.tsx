"use client";
// use-client: appel de Server Action + retour d'état inline (ADR 0036).
//
// Bouton « Lancer l'analyse complète » du bloc « Rapport d'analyse ». Éteint, il reste VISIBLE
// avec sa raison écrite dessous (réservé, éteint, sans réponse, déjà en cours) : un bouton caché
// laisserait croire que l'analyse n'existe pas. L'action revérifie tout côté serveur.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { lancerAnalyseAction } from "@/features/rapport-avant-audit/ecran/actions";

interface Props {
  readonly clientId: string;
  readonly actif: boolean;
  readonly libelle: string;
  /** Pourquoi le bouton est éteint ; `null` s'il est actif. */
  readonly raison: string | null;
}

export function LancerAnalyseBouton({
  clientId,
  actif,
  libelle,
  raison,
}: Props): React.ReactElement {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<{ ok: boolean; texte: string } | null>(null);

  function onClick() {
    setResultat(null);
    demarrer(async () => {
      // `try/catch` INDISPENSABLE (voir EnrichCalendlyEventButton) : la couche Server Action peut
      // rejeter (réseau, session expirée) ; sans filet, le clic ne dirait rien.
      try {
        const r = await lancerAnalyseAction({ clientId });
        if (r.ok) {
          setResultat({ ok: true, texte: r.message });
          router.refresh();
        } else {
          setResultat({ ok: false, texte: r.erreur });
        }
      } catch (e) {
        setResultat({
          ok: false,
          texte: `Le lancement n'a pas abouti (${
            e instanceof Error ? e.message : "erreur inconnue"
          }). Réessayez dans un instant.`,
        });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
      <button
        type="button"
        onClick={onClick}
        disabled={enCours || !actif}
        aria-describedby={raison !== null ? `raison-lancer-${clientId}` : undefined}
        className="admin-button"
      >
        {enCours ? "Lancement…" : libelle}
      </button>
      {raison !== null ? (
        <p
          id={`raison-lancer-${clientId}`}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
        >
          {raison}
        </p>
      ) : null}
      {resultat !== null ? (
        <p
          role="status"
          className={`text-[length:var(--text-admin-xs)] ${
            resultat.ok
              ? "text-[color:var(--color-admin-success)]"
              : "text-[color:var(--color-admin-danger)]"
          }`}
        >
          {resultat.texte}
        </p>
      ) : null}
    </div>
  );
}
