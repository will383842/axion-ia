/**
 * Qualiopi ind. 27 — export PDF du registre des sous-traitants indépendants. Gabarit des
 * registres (`templates/registre.tsx`) : même en-tête d'organisme que les autres
 * registres remis à l'auditeur ; date d'export en pied. Colonnes : `export.ts`.
 */

import React from "react";

import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { RegistrePdf, type RegistreData } from "@/server/qualiopi/documents/templates/registre";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import { COLONNES_REGISTRE, cellulesRegistre, jour, mentionExport } from "./export";
import { lireRegistre } from "./lecture";

export async function exportRegistrePdf(
  maintenant: Date,
): Promise<{ buffer: Buffer; filename: string }> {
  const [lignes, identite] = await Promise.all([lireRegistre(maintenant), getOrganismeIdentite()]);
  const data: RegistreData = {
    titre: "Registre des sous-traitants — formateurs indépendants",
    sousTitre:
      "Dispositions en matière de sous-traitance (indicateur 27 du référentiel national qualité). Registre tenu automatiquement à partir des fiches des formateurs indépendants.",
    colonnes: COLONNES_REGISTRE,
    lignes: lignes.map(cellulesRegistre),
    mentionBasDePage: mentionExport(maintenant),
    dateEdition: jour(maintenant),
  };
  const { buffer } = await renderPdfToBuffer(React.createElement(RegistrePdf, { data, identite }));
  return {
    buffer,
    filename: `registre-sous-traitants-independants-${parisDateISO(maintenant)}.pdf`,
  };
}
