// La page NEUTRE du questionnaire en ligne (statut 404) : jeton invalide ou
// altéré, questionnaire inconnu, clos, ou pas encore ouvert en ligne. La même
// page pour tous les cas — rien ne dit lequel (UX §1.8).

import { Coquille, EcranDeFin } from "./Coquille";

export default function QuestionnaireIntrouvable() {
  return (
    <Coquille>
      <EcranDeFin variante="invalide" />
    </Coquille>
  );
}
