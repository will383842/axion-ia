"use client";
// use-client: next/dynamic n'éclate pas un composant client importé depuis un composant serveur.

// CHANTIER QNC, L13 — gestes « Remplacer » / « Retirer » d'un document du hub. Ce
// relais client existe pour que ces deux formulaires sortent du chunk de la page
// (poids de la console) : appelé tel quel depuis le composant serveur, `dynamic`
// ne les éclaterait pas.

import dynamic from "next/dynamic";

import type { CibleDocumentOrganisme } from "@/server/documents-organisme/documents-organisme-pur";

const RemplacerConsoleDocButton = dynamic(() =>
  import("./RemplacerConsoleDocButton").then((m) => m.RemplacerConsoleDocButton),
);
const RetirerDocumentButton = dynamic(() =>
  import("./RetirerDocumentButton").then((m) => m.RetirerDocumentButton),
);

export function ActionsArchivageConsoleDoc({
  cible,
  id,
  titre,
  retraitPossible,
}: {
  cible: CibleDocumentOrganisme;
  id: string;
  titre: string;
  retraitPossible: boolean;
}): React.ReactElement {
  return (
    <>
      <RemplacerConsoleDocButton id={id} title={titre} />
      {retraitPossible ? <RetirerDocumentButton cible={cible} id={id} titre={titre} /> : null}
    </>
  );
}
