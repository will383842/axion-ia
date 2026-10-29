// Le nom du destinataire d'un e-mail (onglet E-mails), lu par ce petit composant SERVEUR asynchrone
// pour que la page n'ait pas à le faire. Une seule lecture par requête pour toute la liste.
// Jamais l'adresse. Une panne ne coûte que le nom : la ligne reste affichée.

import { cache } from "react";

import { nomsDesDestinataires } from "@/features/dossier-client/fiche/noms-destinataires";

const noms = cache((clientId: string, cles: string): Promise<Map<string, string>> =>
  nomsDesDestinataires(clientId, cles === "" ? [] : cles.split(",")).catch(
    () => new Map<string, string>(),
  ),
);

export async function NomDestinataire({
  clientId,
  cles,
  cle,
}: {
  clientId: string;
  /** Toutes les clés de la liste, séparées par une virgule (même valeur pour chaque ligne). */
  cles: string;
  cle: string;
}): Promise<React.ReactElement | null> {
  const nom = (await noms(clientId, cles)).get(cle);
  return nom === undefined ? null : (
    <span className="text-[color:var(--color-admin-fg-muted)]">à {nom}</span>
  );
}
