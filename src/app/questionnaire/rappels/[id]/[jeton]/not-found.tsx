// La page NEUTRE (statut 404) : jeton d'arrêt faux, altéré, ou d'un autre domaine. Rien ne dit
// lequel.

import { Coquille, EcranDeFin } from "../../../[id]/[jeton]/Coquille";

export default function RappelsIntrouvables() {
  return (
    <Coquille>
      <EcranDeFin variante="invalide" />
    </Coquille>
  );
}
