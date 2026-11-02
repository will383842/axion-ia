"use client";
// use-client: appel de Server Action + retour d'état inline (ADR 0036).
//
// Formulaire du bloc « Rapport d'analyse » (« Valider le PDF client », « Compléter la fiche ») :
// le contenu (cases, champs cachés) est rendu par le SERVEUR et passé en `children` ; ce composant
// n'ajoute que l'envoi et le message de retour, écrit sous le bouton. L'action revérifie tout.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Retour = { ok: boolean; texte: string };

interface Props {
  readonly action: (formData: FormData) => Promise<Retour>;
  readonly libelle: string;
  readonly libelleEnCours: string;
  readonly children?: React.ReactNode;
}

export function FormulaireRapport({
  action,
  libelle,
  libelleEnCours,
  children,
}: Props): React.ReactElement {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<Retour | null>(null);

  function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const donnees = new FormData(ev.currentTarget);
    setResultat(null);
    demarrer(async () => {
      // `try/catch` INDISPENSABLE (voir EnrichCalendlyEventButton) : sans filet, un rejet de la
      // couche Server Action laisserait le clic sans réponse.
      try {
        const r = await action(donnees);
        setResultat(r);
        if (r.ok) router.refresh();
      } catch (e) {
        setResultat({
          ok: false,
          texte: `Rien n'a été fait (${
            e instanceof Error ? e.message : "erreur inconnue"
          }). Réessayez dans un instant.`,
        });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-[var(--space-admin-2)]">
      {children}
      <button type="submit" disabled={enCours} className="admin-button-secondary">
        {enCours ? libelleEnCours : libelle}
      </button>
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
    </form>
  );
}
