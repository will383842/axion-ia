// La page NEUTRE du dossier en ligne du formateur (statut 404) : interrupteur éteint, lien
// faux, échu ou révoqué, fiche inconnue ou fermée. La même page pour tous les cas — rien ne
// dit lequel.

import { dossierEnLigneOuvert } from "@/server/qualiopi/formateurs-independants/dossier";

import { Coquille, EcranInvalide } from "./Coquille";

export default async function DossierIntrouvable() {
  // Lot B (M25) : « Retrouver mon espace » n'est proposé que si la page existe.
  const ouvert = await dossierEnLigneOuvert().catch(() => false);
  return (
    <Coquille>
      <EcranInvalide avecRetrouver={ouvert} />
    </Coquille>
  );
}
