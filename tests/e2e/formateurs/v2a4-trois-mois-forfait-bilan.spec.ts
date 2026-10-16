// @formateurs V2-A4 — mission sur TROIS mois avec forfait de déplacement, deux formateurs,
// et une DERNIÈRE journée sans formateur désigné.
//
// Septembre, octobre, novembre 2040. A (principal, forfait 60 €/journée) a une journée
// désignée en septembre et en octobre ; B (co-formateur, sans forfait) aussi. La dernière
// journée (novembre) n'est désignée à personne : elle revient aux deux, qui l'animent et la
// contresignent. Règle (lot 8A) : sans désignation, c'est le formateur PRINCIPAL qui remet
// le bilan de fin de formation ; lui seul voit son DERNIER mois attendre le bilan.
//
// Attendu : A et B payés en septembre et octobre sur leurs feuilles ; en novembre, B est
// payé sur ses feuilles, A seulement après son bilan ; chaque mois écrit UNE fois malgré
// des passages répétés ; montants au centime (contre-calcul indépendant).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { honorairesAnimationCents } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import type { EtapeArgent } from "../fixtures/formateurs/argent-protocole";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF_A = 42_000;
const TARIF_B = 38_000;
const FORFAIT_A = 6_000;
const BILAN_ALLUME_LE = "2040-08-01T00:00:00.000Z";

test.describe("@formateurs V2-A4 — trois mois, forfait, dernière journée partagée", () => {
  test.setTimeout(900_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("seul le principal attend le bilan, et seulement en novembre ; rien deux fois", async () => {
    await avecVerrouArgent(async () => {
      const a = await semerFormateur({ prenom: "Albane", tarifJourneeHtCents: TARIF_A });
      const b = await semerFormateur({ prenom: "Bertin", tarifJourneeHtCents: TARIF_B });
      const s = await semerSession({
        jours: [
          { date: "2040-09-10", trainerId: a.id },
          { date: "2040-09-11", trainerId: b.id },
          { date: "2040-10-08", trainerId: a.id },
          { date: "2040-10-09", trainerId: b.id },
          // Dernière journée : personne n'est désigné.
          { date: "2040-11-12" },
        ],
        formateurs: [a.id, b.id],
        principal: a.id,
        statut: "realisee",
      });
      const ma = await semerMissionAcceptee({
        sessionId: s.id,
        trainerId: a.id,
        tarifHtCents: TARIF_A,
      });
      await semerMissionAcceptee({ sessionId: s.id, trainerId: b.id, tarifHtCents: TARIF_B });
      await prisma.missionFormateur.update({
        where: { id: ma },
        data: { forfaitDeplacementParJourHtCents: FORFAIT_A },
      });
      const p = (m: string) => passageV2a(m, [s.id], { bilanAllumeLe: BILAN_ALLUME_LE });
      const etapes: EtapeArgent[] = [
        ...contresignerJournee(s.id, a, "2040-09-10"),
        ...contresignerJournee(s.id, b, "2040-09-11"),
        p("2040-09-12T07:15:00Z"),
        p("2040-09-13T07:15:00Z"),
        ...contresignerJournee(s.id, a, "2040-10-08"),
        ...contresignerJournee(s.id, b, "2040-10-09"),
        p("2040-10-10T07:15:00Z"),
        ...contresignerJournee(s.id, a, "2040-11-12"),
        ...contresignerJournee(s.id, b, "2040-11-12"),
        p("2040-11-13T07:15:00Z"),
        p("2040-11-14T07:15:00Z"),
        {
          etape: "terminer-bilan",
          sessionId: s.id,
          trainerId: a.id,
          maintenant: "2040-11-15T09:00:00Z",
          bilanAllumeLe: BILAN_ALLUME_LE,
        },
        p("2040-11-16T07:15:00Z"),
        p("2040-11-17T07:15:00Z"),
      ];
      const sorties = await jouer(etapes);
      const passages: unknown[] = [];
      etapes.forEach((e, i) => {
        if (e.etape === "contresigner") expect(sorties[i]).toMatchObject({ ok: true });
        else if (e.etape === "passage") passages.push(sorties[i]);
        else expect(sorties[i]).toEqual({ avis: "ok", fin: "ok" });
      });
      const [sep, sep2, oct, nov, nov2, apresBilan, apresBilan2] = passages;
      expect(sep).toMatchObject({ etat: "fait", ecrits: 2, erreurs: 0 });
      expect(sep2).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 2 });
      expect(oct).toMatchObject({ etat: "fait", ecrits: 2, dejaEcrits: 2 });
      // Novembre : B écrit ; A attend SON bilan (une attente, aucune anomalie).
      expect(nov).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 1, anomalies: [] });
      expect(nov2).toMatchObject({ etat: "fait", ecrits: 0, enAttente: 1 });
      expect(apresBilan).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 0 });
      expect(apresBilan2).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 6 });

      const jourA = honorairesAnimationCents(2, TARIF_A) + FORFAIT_A;
      const jourB = honorairesAnimationCents(2, TARIF_B);
      const parMois = async (id: string) =>
        (await relevesDe(id)).map((r) => [r.periodeMonth, r.statut, r.totalHtCents]);
      expect(await parMois(a.id)).toEqual([
        [9, "a_valider", jourA],
        [10, "a_valider", jourA],
        [11, "a_valider", jourA],
      ]);
      expect(await parMois(b.id)).toEqual([
        [9, "a_valider", jourB],
        [10, "a_valider", jourB],
        [11, "a_valider", jourB],
      ]);
      // Rien n'est validé seul, rien n'est autofacturé seul.
      const tous = [...(await relevesDe(a.id)), ...(await relevesDe(b.id))];
      expect(tous.every((r) => r.numeroFacture === null && r.autofactureAt === null)).toBe(true);
    });
  });
});
