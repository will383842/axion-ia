"use client";
// use-client: choix de l'attribution d'une commande, avec retour sans recharger.

// « Commandes à attribuer » (contrat 2.6, art. 3.1) : Williams choisit à quelle attribution
// revient la commande, ou « aucun apporteur ». Une seule décision par commande.

import { useActionState } from "react";

import { deciderAttributionAction } from "@/features/apporteurs-reseau/actions-etablissement";
import type { EtatAction } from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

export function CommandeAAttribuer({
  factureId,
  candidats,
}: {
  factureId: string;
  candidats: ReadonlyArray<{ presentationId: string; apporteur: string; perimetre: string }>;
}) {
  const [etat, decider, enCours] = useActionState(deciderAttributionAction, INITIAL);
  if (etat.etat === "ok")
    return (
      <p
        role="status"
        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
      >
        {etat.message}
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
      {candidats.map((c) => (
        <form key={c.presentationId} action={decider}>
          <input type="hidden" name="factureId" value={factureId} />
          <input type="hidden" name="presentationId" value={c.presentationId} />
          <button type="submit" className="admin-button-secondary" disabled={enCours}>
            Attribuer à {c.apporteur} ({c.perimetre})
          </button>
        </form>
      ))}
      <form action={decider}>
        <input type="hidden" name="factureId" value={factureId} />
        <input type="hidden" name="presentationId" value="aucune" />
        <button type="submit" className="admin-button-secondary" disabled={enCours}>
          Aucun apporteur
        </button>
      </form>
      {etat.etat === "erreur" ? (
        <span role="alert" className="text-[color:var(--color-admin-destructive)]">
          {etat.message}
        </span>
      ) : null}
    </div>
  );
}
