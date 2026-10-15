// @formateurs V2-A7 — L'ÉCHÉANCE QUI RECULE quand Axion tarde à valider.
//
// Une mission de deux journées, contresignée le soir même : le mois est COMPLET le
// lendemain (feuilles signées ; aucun bilan exigé). Le relevé est écrit ce jour-là, avec
// son échéance provisoire « autofacture émise aujourd'hui + 30 jours ». Puis personne ne
// valide pendant près de deux mois ; la validation et l'autofacture partent enfin.
// Décision du 14/10/2026 : « l'autofacture d'un mois n'est établie QUE quand tout est
// complet », et le virement part « au plus tard 30 jours après la date de cette
// autofacture » : un retard des PIÈCES du formateur retarde son paiement, un retard
// d'AXION ne le doit pas.
//
// ÉCART : l'émission lit l'horloge réelle (elle ne reçoit pas d'instant) ; le scénario
// est donc daté par rapport au jour réel (journées il y a 60 jours), et non en 2040.
//
// DÉFAUT V2-A-5 (corrigé, ex-test.fixme) : à l'émission, l'échéance devient « jour de l'autofacture
// + 30 » (`echeanceAutofactureMission`, paiement/echeance-autofacture.ts ~l. 52 ;
// remuneration/autofacture-emission.ts ~l. 468), jour de l'autofacture = jour du CLIC
// (`maintenant` réel). L'échéance provisoire, posée au jour où tout était complet, est
// écrasée par une plus lointaine : chaque jour d'attente de la validation recule d'autant
// la date limite du virement (ici de près de deux mois). Même racine que V1-C-4 (date de
// l'autofacture = émission), hors du cas du bilan.

import { expect, test } from "@playwright/test";

import { HORS_BANC } from "../fixtures/formateurs/argent-commun";
import { ecartJours, jourDeParis, plusJours } from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import { poserIban, IBAN_A } from "../fixtures/formateurs/argent-parcours";
import {
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { contresignerJournee, passageV2a } from "../fixtures/formateurs/v2a-semis";

const TARIF = 35_000;

/** Un mois complet il y a ~2 mois, relevé écrit le lendemain, validé seulement aujourd'hui. */
async function valideAvecRetard(emettre: boolean) {
  const aujourdhui = jourDeParis(new Date());
  // Deux journées il y a ~60 jours, dans le MÊME mois civil (le paiement ne lit pas les fériés).
  let recul = 60;
  while (plusJours(aujourdhui, -recul).slice(0, 7) !== plusJours(aujourdhui, 1 - recul).slice(0, 7))
    recul += 1;
  const j1 = plusJours(aujourdhui, -recul);
  const j2 = plusJours(aujourdhui, 1 - recul);
  const complet = plusJours(aujourdhui, 2 - recul);
  const f = await semerFormateur({ prenom: "Edmee", tarifJourneeHtCents: TARIF });
  await poserIban(f.id, IBAN_A);
  const s = await semerSession({
    jours: [
      { date: j1, trainerId: f.id },
      { date: j2, trainerId: f.id },
    ],
    formateurs: [f.id],
    statut: "realisee",
  });
  await semerMissionAcceptee({ sessionId: s.id, trainerId: f.id, tarifHtCents: TARIF });
  const sorties = await jouer([
    ...contresignerJournee(s.id, f, j1),
    ...contresignerJournee(s.id, f, j2),
    // Le passage tourne au matin du lendemain, avec SA date de bascule (un 1er du mois avant).
    passageV2a(`${complet}T07:15:00Z`, [s.id], { dateBascule: `${j1.slice(0, 7)}-01` }),
  ]);
  for (const r of sorties.slice(0, 4)) expect(r).toMatchObject({ ok: true });
  expect(sorties[4]).toMatchObject({ etat: "fait", ecrits: 1, erreurs: 0 });
  const [ecrit] = await relevesDe(f.id);
  const provisoire = jourDeParis(ecrit!.echeanceAt!);
  if (emettre) {
    const [e] = (await jouer([{ etape: "valider-et-emettre", statementId: ecrit!.id }])) as [
      { emission: { data?: { numero: string } } },
    ];
    expect(e.emission.data?.numero).toMatch(/\S/);
  }
  const [apres] = await relevesDe(f.id);
  return { complet, provisoire, apres: apres!, aujourdhui };
}

test.describe("@formateurs V2-A7 — échéance qui recule", () => {
  test.setTimeout(600_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("à l'écriture du mois complet : échéance au jour où tout est complet + 30 jours", async () => {
    await avecVerrouArgent(async () => {
      const { complet, provisoire, apres } = await valideAvecRetard(false);
      expect(apres.statut).toBe("a_valider");
      expect(provisoire).toBe(plusJours(complet, 30));
    });
  });

  // DÉFAUT V2-A-5 — la validation tardive d'Axion recule la date limite du virement.
  test("V2-A-5 : une validation tardive ne recule pas la date limite du virement", async () => {
    await avecVerrouArgent(async () => {
      const { complet, provisoire, apres, aujourdhui } = await valideAvecRetard(true);
      expect(apres.statut).toBe("facture_recue");
      const definitive = jourDeParis(apres.echeanceAt!);
      // Le retard de validation (≈ 58 jours) ne reporte pas le paiement du formateur.
      expect(ecartJours(complet, aujourdhui)).toBeGreaterThan(50);
      expect(definitive <= provisoire).toBe(true);
      expect(ecartJours(complet, definitive)).toBeLessThanOrEqual(30);
    });
  });
});
