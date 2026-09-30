"use client";
// use-client: useFormStatus (React 19) — le bouton se désactive pendant l'envoi du formulaire.

/**
 * Bouton d'envoi d'un formulaire de geste (chantier visio, PR 7 ; V1-02).
 * Désactivé tant que le formulaire est en cours d'envoi : un double clic ne
 * soumet pas deux fois (le serveur refuse aussi le doublon, voir
 * `emailSuiviGabaritFixe`). Aucun texte embarqué : le libellé vient du
 * composant serveur qui le rend (cliquet du poids de la console).
 */

import { useFormStatus } from "react-dom";

export function BoutonGeste({
  className,
  children,
}: {
  readonly className: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {children}
    </button>
  );
}
