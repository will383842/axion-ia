"use client";
// use-client: next/dynamic n'éclate pas un composant client importé depuis un composant serveur.

// Relais client du panneau de fin de collaboration d'un formateur : geste rare,
// hors du chunk de la page (poids de la console admin). Rendu côté serveur quand
// même — le HTML initial est celui d'avant.

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const FinCollaborationPanel = dynamic(() =>
  import("@/components/admin/qualiopi/FinCollaborationPanel").then((m) => m.FinCollaborationPanel),
);

export function FinCollaborationPanelDiffere(
  props: ComponentProps<typeof FinCollaborationPanel>,
): React.ReactElement {
  return <FinCollaborationPanel {...props} />;
}
