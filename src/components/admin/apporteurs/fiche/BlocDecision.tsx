"use client";
// use-client: garde le message de décision hors du bloc « à vérifier », qui se démonte au rechargement

// Après la contresignature (ou un complément, ou un refus), l'action serveur revalide la page :
// l'apporteur n'est plus « à vérifier », donc le bloc de décision disparaît AVEC son état local, et
// le message de réussite (« Contrat contresigné et envoyé. » + bilan des pièces jointes) avec lui.
// Ce composant reste monté à la même place quel que soit le statut : il porte le message et le rend
// au-dessus du bloc (ou à sa place) après le rechargement.
//
// Le bloc (carte, titre, DecisionDossier) reste rendu par le serveur et passé en `children` : seul
// ce petit composant part au client (cliquet de poids de la console admin).

import { createContext, useContext, useState, type ReactNode } from "react";

const SignalerReussite = createContext<(message: string) => void>(() => {});

/** Pour `DecisionDossier` : remonte le message de réussite au parent qui survit au rechargement. */
export const useSignalerReussite = () => useContext(SignalerReussite);

export function BlocDecision({ children }: { children?: ReactNode }) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  return (
    <SignalerReussite.Provider value={setConfirmation}>
      {confirmation ? (
        <section className="admin-card-v2 rounded-[var(--radius-admin-xl,16px)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-card,20px)] shadow-[var(--shadow-admin-2)]">
          <p role="status" className="font-semibold text-[color:var(--color-admin-success)]">
            {confirmation}
          </p>
        </section>
      ) : null}
      {children}
    </SignalerReussite.Provider>
  );
}
