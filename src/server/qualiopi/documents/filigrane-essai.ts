/**
 * QNC L02 — enveloppe un élément PDF dans le contexte du filigrane ESSAI.
 *
 * L'enveloppe se pose au RENDU, jamais sur l'élément dont `generateDocument`
 * instantanéise les props (`renderData`) : les données de la pièce restent
 * celles du gabarit.
 */

import React from "react";
import { FiligraneEssaiContexte } from "@/server/qualiopi/documents/base-layout";

export function avecFiligraneEssai(
  element: React.ReactElement,
  estEssai: boolean,
): React.ReactElement {
  if (!estEssai) return element;
  return React.createElement(FiligraneEssaiContexte.Provider, { value: true }, element);
}
