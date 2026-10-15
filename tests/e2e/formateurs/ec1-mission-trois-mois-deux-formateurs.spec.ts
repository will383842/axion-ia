// @formateurs E-C1 — une mission sur TROIS mois, deux formateurs ; B anime la dernière
// journée.
//
//   · A est payé chaque mois sur ses feuilles contresignées seules (il ne remet pas le
//     bilan) ;
//   · B est payé les mois 1 et 2 sur ses feuilles ; le mois 3 SEULEMENT après la remise
//     du bilan de fin de formation ;
//   · décision V1-C-4 (14/10, lot 3 #1540) : l'autofacture du dernier mois est DATÉE DE SON
//     ÉMISSION (`emettreAutofacture` : `dateFacture = new Date()`, après la validation
//     humaine), et non du jour de la remise du bilan ; l'échéance en découle.
//
// ÉCARTS : M-D déclaré par le banc (voir E20) ; validation écrite par le banc ; date
// d'émission à l'horloge réelle.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { BASCULE_2037, HORS_BANC } from "../fixtures/formateurs/argent-commun";
import {
  echeanceDepuisFacture,
  honorairesAnimationCents,
  jourDeParis,
} from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import type { EtapeArgent } from "../fixtures/formateurs/argent-protocole";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
  type FormateurSeme,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";

const TARIF = 35_000;
/** Une journée par formateur et par mois ; B anime la toute dernière. */
const PLANNING = [
  { date: "2037-11-16", qui: "A" },
  { date: "2037-11-17", qui: "B" },
  { date: "2037-12-14", qui: "A" },
  { date: "2037-12-15", qui: "B" },
  { date: "2038-01-11", qui: "A" },
  { date: "2038-01-12", qui: "B" },
] as const;
const REMISE_BILAN = "2038-01-14T09:30:00Z";

interface Deroule {
  a: FormateurSeme;
  b: FormateurSeme;
  sessionId: string;
  passages: unknown[];
}

/** Bilan de fin de formation allumé AVANT la mission : son exigence s'applique (jamais rétroactive). */
const BILAN_ALLUME_LE = "2037-09-01T00:00:00.000Z";

function passage(maintenant: string, sessionId: string): EtapeArgent {
  return {
    etape: "passage",
    maintenant,
    bilanAllumeLe: BILAN_ALLUME_LE,
    dateBascule: BASCULE_2037,
    sessionIds: [sessionId],
    retraitMd: "declare",
  };
}

async function derouler(): Promise<Deroule> {
  const a = await semerFormateur({ prenom: "Anouk" });
  const b = await semerFormateur({ prenom: "Basile" });
  const qui = { A: a, B: b };
  const session = await semerSession({
    jours: PLANNING.map((p) => ({ date: p.date, trainerId: qui[p.qui].id })),
    formateurs: [a.id, b.id],
    principal: a.id,
    statut: "realisee",
  });
  for (const f of [a, b]) {
    await semerMissionAcceptee({ sessionId: session.id, trainerId: f.id, tarifHtCents: TARIF });
  }
  const contresigner = (date: string, f: FormateurSeme): EtapeArgent[] =>
    (["matin", "apres_midi"] as const).map((demiJournee) => ({
      etape: "contresigner",
      sessionId: session.id,
      trainerId: f.id,
      date,
      demiJournee,
      nomConfirme: f.nomComplet,
      maintenant: `${date}T17:00:00Z`,
    }));
  // Le temps avance mois par mois : on signe les journées du mois, puis le passage du
  // lendemain de la dernière journée du mois.
  const duMois = (m: string) =>
    PLANNING.filter((p) => p.date.startsWith(m)).flatMap((p) => contresigner(p.date, qui[p.qui]));
  const etapes: EtapeArgent[] = [
    ...duMois("2037-11"),
    passage("2037-11-18T07:15:00Z", session.id),
    ...duMois("2037-12"),
    passage("2037-12-16T07:15:00Z", session.id),
    ...duMois("2038-01"),
    passage("2038-01-13T07:15:00Z", session.id),
    {
      etape: "terminer-bilan",
      sessionId: session.id,
      trainerId: b.id,
      maintenant: REMISE_BILAN,
      bilanAllumeLe: BILAN_ALLUME_LE,
    },
    passage("2038-01-15T07:15:00Z", session.id),
  ];
  const sorties = await jouer(etapes);
  const passages: unknown[] = [];
  etapes.forEach((e, i) => {
    if (e.etape === "contresigner") expect(sorties[i]).toMatchObject({ ok: true });
    else passages.push(sorties[i]);
  });
  return { a, b, sessionId: session.id, passages };
}

const mois = (r: { periodeYear: number; periodeMonth: number }) =>
  `${r.periodeYear}-${String(r.periodeMonth).padStart(2, "0")}`;

test.describe("@formateurs E-C1 — mission sur trois mois, deux formateurs", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("A chaque mois sur ses feuilles ; B mois 3 seulement après le bilan ; virement ≤ 30 j", async () => {
    await avecVerrouArgent(async () => {
      const { a, b, sessionId, passages } = await derouler();
      const [nov, dec, jan, bilan, apresBilan] = passages;
      expect(nov).toMatchObject({ etat: "fait", ecrits: 2, erreurs: 0 });
      expect(dec).toMatchObject({ etat: "fait", ecrits: 2, erreurs: 0 });
      // Janvier : A est écrit ; B attend son bilan (une attente, aucune anomalie).
      expect(jan).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 1, anomalies: [] });
      expect(bilan).toEqual({ avis: "ok", fin: "ok" });
      expect(apresBilan).toMatchObject({ etat: "fait", ecrits: 1, enAttente: 0 });

      // Contre-calcul : une journée (deux demi-journées) par formateur et par mois.
      const parMois = honorairesAnimationCents(2, TARIF);
      expect(parMois).toBe(35_000);
      for (const f of [a, b]) {
        const releves = await relevesDe(f.id);
        expect(releves.map((r) => [mois(r), r.origine, r.statut, r.totalHtCents])).toEqual([
          ["2037-11", "passage_mission", "a_valider", parMois],
          ["2037-12", "passage_mission", "a_valider", parMois],
          ["2038-01", "passage_mission", "a_valider", parMois],
        ]);
        expect(releves.every((r) => r.sessionId === sessionId)).toBe(true);
      }

      // Le relevé de janvier de B n'existait pas avant la remise du bilan : il est
      // écrit par le passage qui la suit, et son échéance provisoire part de ce jour-là.
      const janB = (await relevesDe(b.id)).at(-1)!;
      const bilanEnBase = await prisma.bilanFinFormation.findFirstOrThrow({
        where: { sessionId, trainerId: b.id },
        select: { termineAt: true },
      });
      expect(bilanEnBase.termineAt?.toISOString()).toBe(new Date(REMISE_BILAN).toISOString());
      expect(jourDeParis(janB.echeanceAt!)).toBe("2038-02-14");

      // Validation humaine, autofacture : virement au plus tard 30 j après SA date.
      const [emis] = (await jouer([{ etape: "valider-et-emettre", statementId: janB.id }])) as [
        { valide: boolean; emission: { data?: { numero: string } } },
      ];
      expect(emis.valide).toBe(true);
      expect(emis.emission.data?.numero).toMatch(/\S/);
      const facture = (await relevesDe(b.id)).at(-1)!;
      expect(facture.statut).toBe("facture_recue");
      expect(jourDeParis(facture.echeanceAt!)).toBe(
        echeanceDepuisFacture(jourDeParis(facture.dateFacture!)),
      );
    });
  });

  // V1-C-4 — l'autofacture du dernier mois est datée de son émission, pas de la remise du bilan.
  test("V1-C-4 : l'autofacture du dernier mois de B est datée de son émission", async () => {
    await avecVerrouArgent(async () => {
      const { b } = await derouler();
      const janB = (await relevesDe(b.id)).at(-1)!;
      const avant = jourDeParis(new Date());
      await jouer([{ etape: "valider-et-emettre", statementId: janB.id }]);
      const apres = jourDeParis(new Date());
      const facture = (await relevesDe(b.id)).at(-1)!;
      const jourFacture = jourDeParis(facture.dateFacture!);
      // Émission à l'horloge réelle : le jour de la facture est celui de l'appel (tolère
      // un passage de minuit pendant l'appel), et ce n'est PAS la remise du bilan.
      expect([avant, apres]).toContain(jourFacture);
      expect(jourFacture).not.toBe(jourDeParis(new Date(REMISE_BILAN)));
      expect(jourDeParis(facture.echeanceAt!)).toBe(echeanceDepuisFacture(jourFacture));
    });
  });
});
