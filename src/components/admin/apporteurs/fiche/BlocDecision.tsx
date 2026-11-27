"use client";
// use-client: garde le message de décision hors du bloc « à vérifier », qui se démonte au rechargement

// Après la contresignature (ou un complément, ou un refus), l'action serveur revalide la page :
// l'apporteur n'est plus « à vérifier », donc le bloc de décision disparaît AVEC son état local, et
// le message de réussite (« Contrat contresigné et envoyé. » + bilan des pièces jointes) avec lui.
// Ce composant reste monté à la même place quel que soit le statut : il porte le message et le rend
// sous le bloc (ou à sa place) après le rechargement.

import { useState, type ReactNode } from "react";

import { AdminCard } from "@/components/admin/ui";

import { DecisionDossier } from "./DecisionDossier";

export function BlocDecision({
  apporteurId,
  aVerifier,
}: {
  apporteurId: string;
  aVerifier: boolean;
}) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  let bloc: ReactNode = null;
  if (aVerifier) {
    bloc = (
      <AdminCard as="section" elevation={2}>
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold">
          Dossier signé : à vérifier
        </h2>
        <p className="mb-[var(--space-admin-3)] text-[color:var(--color-admin-fg-muted)]">
          Vérifiez chaque pièce, relisez le contrat signé, puis choisissez.
        </p>
        <DecisionDossier apporteurId={apporteurId} onReussite={setConfirmation} />
      </AdminCard>
    );
  }
  return (
    <>
      {confirmation ? (
        <AdminCard as="section" elevation={2}>
          <p role="status" className="font-semibold text-[color:var(--color-admin-success)]">
            {confirmation}
          </p>
        </AdminCard>
      ) : null}
      {bloc}
    </>
  );
}
