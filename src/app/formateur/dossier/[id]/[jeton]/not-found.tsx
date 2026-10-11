// La page NEUTRE du dossier en ligne du formateur (statut 404) : interrupteur éteint, lien
// faux, échu ou révoqué, fiche inconnue ou fermée. La même page pour tous les cas — rien ne
// dit lequel.

import { Coquille, EcranInvalide } from "./Coquille";

export default function DossierIntrouvable() {
  return (
    <Coquille>
      <EcranInvalide />
    </Coquille>
  );
}
