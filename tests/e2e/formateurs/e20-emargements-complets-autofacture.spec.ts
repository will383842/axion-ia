// @formateurs E20 — émargements complets → relevé de MISSION → autofacture F36 →
// échéance = date de l'autofacture + 30 jours ; aucun relevé MENSUEL pour le même
// formateur et la même session.
//
// Décision du dirigeant (14/10/2026, « comme les apporteurs ») : l'autofacture n'est
// établie que quand tout est complet pour le mois, le virement part au plus tard 30
// jours après SA date, et chaque relevé passe par une validation humaine.
//
// ÉCARTS notés (rapport V1-C) :
//   · « Tout contresigner » n'existe pas : l'espace du formateur contresigne demi-journée
//     par demi-journée (`contresignerDemiJournee`) ; le banc enchaîne les quatre.
//   · M-D (retrait de l'unique historique) n'est pas en base : le passage RÉEL refuse
//     (`bloque_contract`) — constaté ici —, puis le banc DÉCLARE M-D pour éprouver
//     l'écriture (aucun relevé mensuel n'existe pour ce formateur, l'index ne joue pas).
//   · La validation n'a pas de service hors session : le banc écrit l'effet du clic.
//   · L'autofacture est datée par l'horloge RÉELLE (`emettreAutofacture` n'a pas de
//     paramètre d'instant) : l'échéance est contre-calculée depuis la date écrite.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  ATTENTE,
  BASCULE_2037,
  HORS_BANC,
  bascule,
  attendreEnvois,
} from "../fixtures/formateurs/argent-commun";
import {
  echeanceDepuisFacture,
  honorairesAnimationCents,
  jourDeParis,
  plusJours,
  ttcCents,
} from "../fixtures/formateurs/argent-contre-calcul";
import { jouer } from "../fixtures/formateurs/argent-execution";
import { jobF36, messagesLus } from "../fixtures/formateurs/argent-puits";
import {
  lignesVivantes,
  relevesDe,
  semerFormateur,
  semerMissionAcceptee,
  semerSession,
} from "../fixtures/formateurs/argent-semis";
import { avecVerrouArgent } from "../fixtures/formateurs/argent-verrou";
import { semerInterrupteurs } from "../fixtures/formateurs/interrupteurs";
import { viderPuitsPour } from "../fixtures/formateurs/puits-smtp";

const TARIF = 35_000;
const JOURS = ["2037-10-12", "2037-10-13"] as const;

test.describe("@formateurs E20 — émargements complets, autofacture, échéance", () => {
  test.setTimeout(2_400_000);
  test.skip(HORS_BANC, "hors du job banc-formateurs : ni file ni puits SMTP");

  test("relevé de mission, F36, échéance à facture + 30 j, aucun relevé mensuel", async () => {
    await avecVerrouArgent(async () => {
      const restaurer = await semerInterrupteurs({
        ...bascule(BASCULE_2037),
        // Le bilan de fin de formation n'est pas l'objet d'E20 (voir E-C1) : coupé.
        "formateurs.bilan_fin_formation": { actif: false },
      });
      const formateur = await semerFormateur({ prenom: "Elise" });
      try {
        const session = await semerSession({
          jours: JOURS.map((date) => ({ date, trainerId: formateur.id })),
          formateurs: [formateur.id],
          statut: "realisee",
        });
        await semerMissionAcceptee({
          sessionId: session.id,
          trainerId: formateur.id,
          tarifHtCents: TARIF,
        });

        // ── « Tout contresigner » : les quatre demi-journées, le soir de la 2e journée.
        const soir = "2037-10-13T17:30:00Z";
        const passage = "2037-10-14T06:15:00Z"; // 08 h 15 de Paris, l'heure du cron
        const [reel, ...suite] = await jouer([
          // Avant toute signature, et sans M-D : le passage réel refuse de tourner.
          {
            etape: "passage",
            maintenant: passage,
            dateBascule: BASCULE_2037,
            sessionIds: [session.id],
            retraitMd: "reel",
          },
          ...JOURS.flatMap((date) =>
            (["matin", "apres_midi"] as const).map((demiJournee) => ({
              etape: "contresigner" as const,
              sessionId: session.id,
              trainerId: formateur.id,
              date,
              demiJournee,
              nomConfirme: formateur.nomComplet,
              maintenant: soir,
            })),
          ),
          {
            etape: "passage",
            maintenant: passage,
            dateBascule: BASCULE_2037,
            sessionIds: [session.id],
            retraitMd: "declare",
          },
          // Idempotent : un second passage le même jour n'écrit rien.
          {
            etape: "passage",
            maintenant: passage,
            dateBascule: BASCULE_2037,
            sessionIds: [session.id],
            retraitMd: "declare",
          },
        ]);
        expect(reel).toEqual({ etat: "bloque_contract" });
        const signatures = suite.slice(0, 4) as Array<{ ok: boolean }>;
        expect(signatures.map((s) => s.ok)).toEqual([true, true, true, true]);
        expect(suite[4]).toMatchObject({ etat: "fait", ecrits: 1, erreurs: 0, enAttente: 0 });
        expect(suite[5]).toMatchObject({ etat: "fait", ecrits: 0, dejaEcrits: 1 });

        // ── Le relevé : un seul, à valider, contre-calculé au centime.
        const ht = honorairesAnimationCents(4, TARIF);
        expect(ht).toBe(70_000);
        let releves = await relevesDe(formateur.id);
        expect(releves).toHaveLength(1);
        const r = releves[0]!;
        expect([r.statut, r.origine, r.sessionId, r.periodeYear, r.periodeMonth]).toEqual([
          "a_valider",
          "passage_mission",
          session.id,
          2037,
          10,
        ]);
        expect([r.totalHtCents, r.totalTtcCents]).toEqual([ht, ttcCents(ht, "franchise_293b")]);
        expect(
          r.feeLines.map((l) => [l.objet, l.demiJournees, l.montantHtCents, l.statut]),
        ).toEqual([["animation", 4, ht, "calcule"]]);
        // Échéance PROVISOIRE : celle d'une autofacture émise le jour de l'écriture, jamais
        // avant la dernière journée + 30 j.
        const provisoire = [plusJours("2037-10-14", 30), plusJours(JOURS[1], 30)].sort().at(-1);
        expect(jourDeParis(r.echeanceAt!)).toBe(provisoire);
        // Rien n'est validé seul.
        expect(r.autofactureAt).toBeNull();

        // ── Validation humaine, puis l'autofacture et F36.
        const [emission] = (await jouer([{ etape: "valider-et-emettre", statementId: r.id }])) as [
          { valide: boolean; emission: { data?: { numero: string; transmise: boolean } } },
        ];
        expect(emission.valide).toBe(true);
        expect(emission.emission.data?.numero).toMatch(/\S/);
        releves = await relevesDe(formateur.id);
        const f = releves[0]!;
        expect(f.statut).toBe("facture_recue");
        expect(f.numeroFacture).toBe(emission.emission.data!.numero);
        const jourFacture = jourDeParis(f.dateFacture!);
        const echeance = echeanceDepuisFacture(jourFacture);
        expect(jourDeParis(f.echeanceAt!)).toBe(echeance);
        expect(jourDeParis(f.autofactureAt!)).toBe(jourFacture);

        // F36 : une ligne au journal, et le job posé en file porte le montant et la date
        // limite contre-calculés. Le banc a un seau R2 simulé (job `banc-formateurs`) : le
        // worker joint la pièce et l'e-mail ARRIVE au puits, objet portant le numéro de la facture.
        await attendreEnvois(formateur.email, "autofacture-transmission", 1);
        const job = await jobF36(r.id);
        expect(job?.to).toBe(formateur.email);
        const [a, m, j] = echeance.split("-");
        expect(job?.payload).toMatchObject({
          numero: f.numeroFacture,
          dateEcheanceLabel: `${j}/${m}/${a}`,
        });
        expect(String(job?.payload["montantLabel"]).replace(/\s/g, " ")).toBe("700,00 € TTC");
        expect(String(job?.payload["missionLabel"])).toContain("du 12/10/2037 au 13/10/2037");
        await expect
          .poll(async () => (await messagesLus(formateur.email)).length, ATTENTE)
          .toBe(1);
        const [recu] = await messagesLus(formateur.email);
        expect(recu!.sujet).toContain(f.numeroFacture!);

        // ── Le calcul mensuel d'octobre ne paie PAS ce couple une seconde fois.
        await jouer([{ etape: "run-mensuel", year: 2037, month: 10 }]);
        const vivantes = await lignesVivantes(formateur.id, session.id);
        expect(vivantes.map((l) => l.origine)).toEqual(["passage_mission"]);
        expect(vivantes.reduce((s, l) => s + l.montantHtCents, 0)).toBe(ht);
        const mensuels = await prisma.trainerStatement.count({
          where: { trainerId: formateur.id, origine: "releve_mensuel" },
        });
        expect(mensuels).toBe(0);
      } finally {
        await restaurer();
        await viderPuitsPour(formateur.email);
      }
    });
  });
});
