// @formateurs V2-A3 — une mission À CHEVAL sur deux mois, au centime.
//
// Formateur ASSUJETTI à la TVA (20 %), tarif IMPAIR de 350,01 €/j, forfait de
// déplacement de 49,99 €/journée, à nos locaux. Trois journées :
//   · mercredi 30/05/2040, journée entière (deux demi-journées) ;
//   · jeudi 31/05/2040, matin seulement (09:00-12:30) ;
//   · vendredi 01/06/2040, matin seulement.
// Chaque mois a SON relevé, recalculé ici par le contre-calcul indépendant (aucun import
// de `src/`) : animation ⌊n × tarif / 2⌋, forfait par journée de déplacement, TVA à 20 %
// sur le total HT du relevé, arrondie au centime. Les passages se répètent : rien deux fois.
//
// DÉFAUT V2-A-3 (corrigé, ex-test.fixme, mineur) : la mission compte QUATRE demi-journées, soit deux
// journées, soit 700,02 € (contrat : « deux demi-journées font toujours le tarif exact »,
// argent/calcul-mission.ts ~l. 13). Le passage arrondit CHAQUE MOIS à part
// (`montantAnimationCents` par relevé, ~l. 40) : 525,01 € + 175,00 € = 700,01 €. Le
// centime du reliquat d'un tarif impair est perdu quand une demi-journée impaire tombe
// de chaque côté d'une fin de mois.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents, ttcCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF = 35_001;
const FORFAIT = 4_999;

async function missionACheval() {
  const f = await semerFormateur({
    prenom: "Cyprien",
    regimeTva: "assujetti_20",
    tarifJourneeHtCents: TARIF,
  });
  const s = await semerSession({
    jours: [
      { date: "2040-05-30", trainerId: f.id },
      { date: "2040-05-31", trainerId: f.id, heureDebut: "09:00", heureFin: "12:30" },
      { date: "2040-06-01", trainerId: f.id, heureDebut: "09:00", heureFin: "12:30" },
    ],
    formateurs: [f.id],
    statut: "realisee",
  });
  const missionId = await semerMissionAcceptee({
    sessionId: s.id,
    trainerId: f.id,
    tarifHtCents: TARIF,
    regimeTva: "assujetti_20",
  });
  await prisma.missionFormateur.update({
    where: { id: missionId },
    data: { forfaitDeplacementParJourHtCents: FORFAIT },
  });
  const sorties = await jouer([
    ...contresignerJournee(s.id, f, "2040-05-30"),
    ...contresignerJournee(s.id, f, "2040-05-31", ["matin"]),
    passageV2a("2040-06-01T05:00:00Z", [s.id]),
    passageV2a("2040-06-01T05:30:00Z", [s.id]),
    ...contresignerJournee(s.id, f, "2040-06-01", ["matin"]),
    passageV2a("2040-06-02T07:15:00Z", [s.id]),
    passageV2a("2040-06-03T07:15:00Z", [s.id]),
  ]);
  for (const i of [0, 1, 2, 5]) expect(sorties[i]).toMatchObject({ ok: true });
  return { f, passages: [sorties[3], sorties[4], sorties[6], sorties[7]] };
}

test.describe("@formateurs V2-A3 — mission à cheval sur deux mois, au centime", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("un relevé par mois, montants et TVA au centime, aucun relevé écrit deux fois", async () => {
    await avecVerrouArgent(async () => {
      const { f, passages } = await missionACheval();
      expect(passages[0]).toMatchObject({ etat: "fait", ecrits: 1, erreurs: 0 });
      expect(passages[1]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 1 });
      expect(passages[2]).toMatchObject({ etat: "fait", ecrits: 1, dejaEcrits: 1 });
      expect(passages[3]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 2 });

      // Contre-calcul : mai, 3 demi-journées sur 2 journées ; juin, 1 demi-journée qui
      // COMPLÈTE la deuxième journée de la mission (V2-A-3) : elle reçoit le reliquat
      // du tarif impair, ⌊4 × tarif / 2⌋ − ⌊3 × tarif / 2⌋ = 175,01 €.
      const animationJuin = honorairesAnimationCents(4, TARIF) - honorairesAnimationCents(3, TARIF);
      const mai = honorairesAnimationCents(3, TARIF) + 2 * FORFAIT;
      const juin = animationJuin + 1 * FORFAIT;
      expect([mai, juin]).toEqual([62_499, 22_500]);
      const releves = await relevesDe(f.id);
      expect(
        releves.map((r) => [r.periodeMonth, r.statut, r.totalHtCents, r.totalTtcCents]),
      ).toEqual([
        [5, "a_valider", mai, ttcCents(mai, "assujetti_20")],
        [6, "a_valider", juin, ttcCents(juin, "assujetti_20")],
      ]);
      // TVA facturée sur chaque relevé (assujetti), jamais un montant négatif.
      for (const r of releves) {
        expect(r.totalTtcCents - r.totalHtCents).toBe(Math.round(r.totalHtCents / 5));
        expect(r.feeLines.every((l) => l.montantHtCents > 0)).toBe(true);
      }
      expect(releves.flatMap((r) => r.feeLines.map((l) => [l.objet, l.montantHtCents]))).toEqual([
        ["animation", honorairesAnimationCents(3, TARIF)],
        ["deplacement", 2 * FORFAIT],
        ["animation", animationJuin],
        ["deplacement", FORFAIT],
      ]);
    });
  });

  // DÉFAUT V2-A-3 (mineur) — le centime du reliquat est perdu à la fin du mois.
  test("V2-A-3 : quatre demi-journées font deux journées exactes, à cheval ou non", async () => {
    await avecVerrouArgent(async () => {
      const { f } = await missionACheval();
      const animation = (await relevesDe(f.id))
        .flatMap((r) => r.feeLines)
        .filter((l) => l.objet === "animation")
        .reduce((t, l) => t + l.montantHtCents, 0);
      expect(animation).toBe(honorairesAnimationCents(4, TARIF));
      expect(animation).toBe(2 * TARIF);
    });
  });
});
