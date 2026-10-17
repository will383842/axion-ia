"use client";
// use-client: next/dynamic n'éclate pas un composant client importé depuis un composant serveur.

// Relais client du panneau « contrat de travail » d'un formateur salarié. Le
// panneau (saisie, émission, relecture) ne sert qu'au clic et à un sous-ensemble
// des formateurs : il sort du chunk de la page (poids de la console admin). Il reste
// rendu côté serveur — le HTML initial est celui d'avant.

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const TrainerContratTravailPanel = dynamic(() =>
  import("@/components/admin/qualiopi/TrainerContratTravailPanel").then(
    (m) => m.TrainerContratTravailPanel,
  ),
);

export function TrainerContratTravailPanelDiffere(
  props: ComponentProps<typeof TrainerContratTravailPanel>,
): React.ReactElement {
  return <TrainerContratTravailPanel {...props} />;
}
