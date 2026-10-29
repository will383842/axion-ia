/** Construit un VRAI suivi par la fonction pure de `personnes.ts` (pas une forme recopiée à la main). */
import {
  suivreParPersonne,
  type EntreeOuverture,
  type EntreeReponse,
  type SuiviParPersonne,
} from "@/features/questionnaire-preaudit/personnes";
import { squeletteDuHtml } from "@/features/questionnaire-preaudit/squelette";
import { HTML_SYNTHETIQUE } from "@/features/questionnaire-preaudit/__tests__/squelette.fixture";

const CODE_DIR = "DIRIGEANTSECRET0000AAAA";
export const CODES = ["aaaaaaaaaaa1", "bbbbbbbbbbb2", "ccccccccccc3"] as const;
const NOMS = ["Alice Martin", "Bruno Durand", "Chloé Petit"] as const;
const T = (j: number) => new Date(Date.UTC(2026, 9, j, 9, 0, 0));

const dirigeant = (): EntreeReponse => ({
  id: "r-dir",
  mode: "main",
  membreColonne: null,
  recuLe: T(25),
  ecartee: false,
  charge: {
    mode: "main",
    membre: CODE_DIR,
    donnees: {
      equipe: NOMS.map((n, i) => ({
        id: CODES[i],
        prenom: n.split(" ")[0],
        nom: n.split(" ")[1],
        role: "Fonction",
        journee: "Oui",
      })),
    },
  },
});

const collab = (i: number, ecartee = false): EntreeReponse => ({
  id: `r-${i}`,
  mode: "emp",
  membreColonne: CODES[i] as string,
  recuLe: T(27),
  ecartee,
  charge: ecartee
    ? null
    : {
        mode: "emp",
        membre: CODES[i],
        collaborateur: {
          prenom: NOMS[i]!.split(" ")[0],
          nom: NOMS[i]!.split(" ")[1],
          fonction: "F",
          membre: CODES[i],
        },
        donnees: { b_1: "x" },
      },
});

/** `recus` : indices des collaborateurs ayant répondu ; `ecartes` : indices dont la réponse est mise de côté. */
export function suiviReel(
  p: {
    recus?: number[];
    ecartes?: number[];
    ouvertures?: EntreeOuverture[];
    sansDirigeant?: boolean;
  } = {},
): SuiviParPersonne {
  return suivreParPersonne({
    reponses: [
      ...(p.sansDirigeant ? [] : [dirigeant()]),
      ...(p.recus ?? []).map((i) => collab(i)),
      ...(p.ecartes ?? []).map((i) => collab(i, true)),
    ],
    brouillons: [],
    ouvertures: p.ouvertures ?? [],
    estCodeDirigeant: (m) => m === CODE_DIR,
    squelette: squeletteDuHtml(HTML_SYNTHETIQUE),
    luLe: null,
  });
}
