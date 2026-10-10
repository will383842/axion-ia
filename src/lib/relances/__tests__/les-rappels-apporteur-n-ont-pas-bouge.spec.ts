// CAMP-0a — preuve de non-régression : les enveloppes apporteur au-dessus du
// moteur commun rendent EXACTEMENT ce que rendait la règle d'origine.
//
// `ancienneDecision` et `ancienMotifBloquant` sont une copie FIGÉE du code
// d'origine de `lib/commercial-application/relance-invitation.ts` (avant
// CAMP-0a). Ne pas les « mettre à jour » : elles sont le témoin.

import { describe, expect, it } from "vitest";

import {
  AGE_MAX_INVITATION_MS,
  DELAI_J3_MS,
  DELAI_J7_MS,
  ECART_MIN_ENTRE_RELANCES_MS,
  RELANCES_MAX,
  decisionRelance,
  jobIdRelanceInvitation,
  motifBloquant,
  type DecisionRelance,
  type EtatRelanceInvitation,
} from "../../commercial-application/relance-invitation";

function ancienMotifBloquant(
  e: Pick<EtatRelanceInvitation, "efface" | "reserve" | "repondu" | "close">,
) {
  if (e.efface) return "efface";
  if (e.reserve) return "reserve";
  if (e.repondu) return "repondu";
  if (e.close) return "close";
  return null;
}

function ancienneDecision(e: EtatRelanceInvitation, maintenant: Date): DecisionRelance {
  const bloquant = ancienMotifBloquant(e);
  if (bloquant) return { relancer: false, motif: bloquant };
  const age = maintenant.getTime() - e.derniereInvitation.getTime();
  if (age > AGE_MAX_INVITATION_MS) return { relancer: false, motif: "trop-ancienne" };
  const n = e.relancesApres.length;
  if (n >= RELANCES_MAX) return { relancer: false, motif: "termine" };
  if (n === 0) {
    return age >= DELAI_J3_MS
      ? { relancer: true, etape: "j3" }
      : { relancer: false, motif: "pas-encore" };
  }
  const derniere = Math.max(...e.relancesApres.map((d) => d.getTime()));
  if (age >= DELAI_J7_MS && maintenant.getTime() - derniere >= ECART_MIN_ENTRE_RELANCES_MS) {
    return { relancer: true, etape: "j7" };
  }
  return { relancer: false, motif: "pas-encore" };
}

const H = 60 * 60 * 1000;
const INVITATION = new Date("2026-09-27T19:30:00Z");
const t = (heures: number) => new Date(INVITATION.getTime() + heures * H);

// Toutes les combinaisons de drapeaux (16), d'historiques de rappels et
// d'instants, toutes les 6 h de J-1 à J+20, plus les bornes exactes.
const DRAPEAUX = Array.from({ length: 16 }, (_, i) => ({
  efface: !!(i & 1),
  reserve: !!(i & 2),
  repondu: !!(i & 4),
  close: !!(i & 8),
}));
const HISTORIQUES: Date[][] = [
  [],
  [t(72)],
  [t(100)],
  [t(216)],
  [t(72), t(168)],
  [t(168), t(72)],
  [t(72), t(168), t(240)],
  [t(-5)],
];
const INSTANTS = [
  ...Array.from({ length: 22 * 4 }, (_, i) => t(-24 + i * 6)),
  new Date(INVITATION.getTime() + DELAI_J3_MS - 1),
  new Date(INVITATION.getTime() + DELAI_J3_MS),
  new Date(INVITATION.getTime() + DELAI_J7_MS),
  new Date(INVITATION.getTime() + AGE_MAX_INVITATION_MS),
  new Date(INVITATION.getTime() + AGE_MAX_INVITATION_MS + 1),
  new Date(t(72).getTime() + ECART_MIN_ENTRE_RELANCES_MS - 1),
  new Date(t(216).getTime() + ECART_MIN_ENTRE_RELANCES_MS),
];

describe("les enveloppes apporteur rendent exactement l'ancienne règle", () => {
  it(`motifBloquant — ${DRAPEAUX.length} combinaisons`, () => {
    for (const d of DRAPEAUX)
      expect(motifBloquant(d), JSON.stringify(d)).toBe(ancienMotifBloquant(d));
  });

  it(`decisionRelance — ${DRAPEAUX.length * HISTORIQUES.length * INSTANTS.length} cas`, () => {
    for (const d of DRAPEAUX) {
      for (const relancesApres of HISTORIQUES) {
        for (const maintenant of INSTANTS) {
          const e: EtatRelanceInvitation = { derniereInvitation: INVITATION, relancesApres, ...d };
          expect(decisionRelance(e, maintenant), JSON.stringify({ e, maintenant })).toEqual(
            ancienneDecision(e, maintenant),
          );
        }
      }
    }
  });

  it("jobIdRelanceInvitation — même chaîne, `:` compris", () => {
    for (const [etape, emp, inv] of [
      ["j3", "abc123", "inv-1"],
      ["j7", "e:f", "inv:2"],
    ] as const) {
      expect(jobIdRelanceInvitation(etape, emp, inv)).toBe(
        `apporteur-invit-relance-${etape}-${emp}-${inv}`.replace(/:/g, "-"),
      );
    }
  });
});
