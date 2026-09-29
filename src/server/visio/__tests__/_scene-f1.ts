/**
 * Une scène commune aux tests « F1 » (rendez-vous tenu sans compte rendu) :
 * une fiche, une rencontre saisie, tenue le 06/10, le balayage en service
 * depuis le 01/10.
 */

import {
  dossierEnMemoire,
  fiche,
  id,
} from "@/features/dossier-client/__tests__/_dossier-en-memoire";
import type { RencontrePourF1 } from "../balayage";

export const BORNE = new Date("2026-10-01T00:00:00Z");
export const MAINTENANT = new Date("2026-10-08T14:00:00Z");

export function rencontreF1(p: Partial<RencontrePourF1> = {}): RencontrePourF1 {
  return {
    id: "r",
    type: "visio",
    debutPrevu: new Date("2026-10-06T08:00:00Z"),
    finPrevue: new Date("2026-10-06T08:45:00Z"),
    statut: null,
    repriseHistorique: false,
    estTestInterne: false,
    issue: null,
    annuleCalendly: false,
    aUnCompteRendu: false,
    ...p,
  };
}

export function sceneF1(type: "visio" | "telephone" = "visio") {
  const f = fiche({ raisonSociale: "Fiche Fictive" });
  const rencontreId = id(5);
  const base = dossierEnMemoire({
    client: [f],
    battementCircuit: [
      {
        nom: "balayage",
        premierLe: BORNE,
        dernierLe: BORNE,
        drapeauVuParWorker: "true",
        version: "x",
      },
    ],
    rencontre: [
      {
        id: rencontreId,
        source: "saisie_manuelle",
        type,
        titre: "Rendez-vous",
        clientId: f["id"],
        rattachementStatut: "valide",
        statut: "planifie",
        estTestInterne: false,
        repriseHistorique: false,
        debutPrevu: new Date("2026-10-06T08:00:00Z"),
        finPrevue: new Date("2026-10-06T08:45:00Z"),
      },
    ],
  });
  return { base, f, rencontreId };
}
