// La page NEUTRE du dossier en ligne (statut 404) : jeton faux ou révoqué, dossier
// inconnu, refusé ou résilié. La même page pour tous les cas — rien ne dit lequel.

import { Coquille, EcranInvalide } from "./Coquille";

export default function DossierIntrouvable() {
  return (
    <Coquille>
      <EcranInvalide />
    </Coquille>
  );
}
