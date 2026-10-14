// @formateurs E31 — Organisme sous-traitant : lettre adressée à l'ORGANISME par lien,
// paiement sur la facture qu'il dépose (numéro unique).
//
// ÉCART AU PLAN (noté au rapport, V1-B-3) : le circuit de l'organisme n'est PAS
// livré. Le code le dit lui-même — « un organisme suit son propre circuit, lot
// L11f » (`lireEtatMission`, moteur-mission.ts ~l.219) ; `assemblerLettreV2` refuse
// « La lettre d'un organisme sous-traitant n'est pas encore disponible. » ; aucune
// action ne reçoit la facture déposée (seule la règle pure `controlerFactureDeposee`
// existe, appelée par aucun écran).
//
// Ce qui EXISTE, et que le banc constate :
//   (a) pour l'intervenant d'un organisme, le moteur n'émet rien : ni lettre, ni F25,
//       ni F26 au formateur — aucun envoi mal adressé ;
//   (b) le NUMÉRO de facture est unique par émetteur (l'organisme), à la casse et aux
//       espaces près : l'index `trainer_statements_facture_emetteur_unique` refuse
//       le doublon en base.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
} from "../fixtures/formateurs/missions-donnees";
import {
  lettresVivantes,
  missionAcceptee,
  signerConvention,
} from "../fixtures/formateurs/missions-gestes";
import { cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e31");

let organismeId = "";

test.describe("@formateurs E31 — organisme sous-traitant", () => {
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    const o = await prisma.sousTraitant.create({
      data: {
        nom: `Organisme Banc ${sc.monde.cle}`,
        objetPrestation: "Animation de formations (banc)",
        contactNom: "Contact Organisme",
        contactEmail: `organisme.${sc.monde.cle}@example.test`,
        siret: "98765432400019",
      },
      select: { id: true },
    });
    organismeId = o.id;
    sc.monde.traces.adresses.push(`organisme.${sc.monde.cle}@example.test`);
  });

  test.afterAll(async () => {
    await prisma.trainerStatement.deleteMany({ where: { organismeSousTraitantId: organismeId } });
    await prisma.trainer.updateMany({
      where: { organismeSousTraitantId: organismeId },
      data: { organismeSousTraitantId: null },
    });
    await prisma.sousTraitant.deleteMany({ where: { id: organismeId } });
  });

  test("(a) l'intervenant d'un organisme ne reçoit ni lettre ni F25/F26 du moteur", async () => {
    const { pilote, monde } = sc;
    const i = await creerFormateurPret(monde, { prenom: "Ugo" });
    await prisma.trainer.update({
      where: { id: i.id },
      data: { organismeSousTraitantId: organismeId },
    });
    const s = await creerSession(monde, { dansJours: 20 });
    await missionAcceptee(pilote, monde, s.id, i.id);
    const conv = await creerPiece(monde, {
      type: "convention",
      sessionId: s.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, conv);

    expect(await lettresVivantes(s.id, i.id)).toEqual([]);
    expect(await envoisVers(i.email, "formateur-accord-enregistre")).toEqual([]);
    expect(await envoisVers(i.email, "formateur-lettre-a-signer")).toEqual([]);
  });

  test("(b) le numéro de facture déposée est unique pour l'organisme", async () => {
    const { monde } = sc;
    const i1 = await creerFormateurPret(monde, { prenom: "Vera" });
    const i2 = await creerFormateurPret(monde, { prenom: "Wilfried" });
    await prisma.trainer.updateMany({
      where: { id: { in: [i1.id, i2.id] } },
      data: { organismeSousTraitantId: organismeId },
    });
    const s1 = await creerSession(monde, { dansJours: 30 });
    const s2 = await creerSession(monde, { dansJours: 40 });
    const releve = (trainerId: string, sessionId: string, mois: number, numero: string) =>
      prisma.trainerStatement.create({
        data: {
          trainerId,
          sessionId,
          organismeSousTraitantId: organismeId,
          origine: "passage_mission",
          periodeYear: 2026,
          periodeMonth: mois,
          statut: "facture_recue",
          tvaRegime: "assujetti_20",
          totalHtCents: 70_000,
          totalTtcCents: 84_000,
          numeroFacture: numero,
          montantFactureTtcCents: 84_000,
        },
        select: { id: true },
      });
    await releve(i1.id, s1.id, 11, "FA-2026-001");
    // Même numéro, autre intervenant, autre session, autre mois : refusé.
    await expect(releve(i2.id, s2.id, 12, " fa-2026-001 ")).rejects.toThrow(/Unique constraint/);
    // Un autre numéro passe.
    await expect(releve(i2.id, s2.id, 12, "FA-2026-002")).resolves.toHaveProperty("id");
  });

  // V1-B-3 — ÉCART (fonction attendue, non livrée : lot L11f). La lettre de la mission
  // d'un intervenant d'organisme doit être émise et adressée à l'ORGANISME par un
  // lien de signature (partie `sous_traitant`, à `contactEmail`), puis le paiement
  // se faire sur la facture déposée. Aujourd'hui : rien n'est émis (cf. (a)).
  test.fixme("V1-B-3 — lettre adressée à l'organisme par lien, puis paiement sur facture déposée", async () => {
    const { pilote, monde } = sc;
    const i = await creerFormateurPret(monde, { prenom: "Xavier" });
    await prisma.trainer.update({
      where: { id: i.id },
      data: { organismeSousTraitantId: organismeId },
    });
    const s = await creerSession(monde, { dansJours: 20 });
    await missionAcceptee(pilote, monde, s.id, i.id);
    const conv = await creerPiece(monde, {
      type: "convention",
      sessionId: s.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, conv);
    const [lettre] = await lettresVivantes(s.id, i.id);
    expect(lettre).toBeDefined();
    const jetons = await prisma.documentSignatureToken.count({
      where: { documentGenereId: lettre!.id, partie: "sous_traitant", revokedAt: null },
    });
    expect(jetons).toBe(1);
  });
});
