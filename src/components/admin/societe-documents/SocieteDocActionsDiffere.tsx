"use client";
// use-client: next/dynamic n'éclate pas un composant client importé depuis un composant serveur.

// Relais client des gestes d'une pièce Société (modifier, remplacer, supprimer ou
// retirer). Ces formulaires ne servent qu'au clic : ils sortent du chunk de la page
// (poids de la console admin). Rendus côté serveur quand même — le HTML initial est
// celui d'avant, seul le JavaScript arrive à part.

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const SocieteDocActions = dynamic(() =>
  import("./SocieteDocActions").then((m) => m.SocieteDocActions),
);

export function SocieteDocActionsDiffere(
  props: ComponentProps<typeof SocieteDocActions>,
): React.ReactElement {
  return <SocieteDocActions {...props} />;
}
