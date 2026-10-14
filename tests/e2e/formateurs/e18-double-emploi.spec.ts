// @formateurs E18 — Double emploi le même jour : refusé aux TROIS portes de la
// console (affectation, création, report), et grisé dans les cartes du choix.
//
// Le formateur indépendant a déjà accepté une mission le jour J. Une autre session
// le même jour ne peut pas le recevoir :
//   1. AFFECTATION (fiche session) — refus « déjà mobilisé » ;
//   2. CRÉATION d'une session avec ce formateur — même refus (interrupteur
//      `formateurs.affectation_sure`) ;
//   3. REPORT d'une de ses sessions sur le jour J — il n'est PAS reconduit : la
//      session reportée part sans formateur (choix du code : « un indépendant déjà
//      pris aux nouvelles dates n'est pas réinstallé », sessions-recurrentes.ts ~l.625).
// Et aucune proposition ne part pour ces sessions.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerSession,
  envoisVers,
} from "../fixtures/formateurs/missions-donnees";
import { M, missionAcceptee, type Resultat } from "../fixtures/formateurs/missions-gestes";
import { cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e18");
const TRAINERS = "@/server/actions/qualiopi/trainers";
const SESSIONS = "@/server/actions/qualiopi/sessions";
const REPORT = "@/server/actions/qualiopi/sessions-recurrentes";
const DEJA_PRIS = /déjà mobilisé/;

test.describe("@formateurs E18 — double emploi le même jour", () => {
  test.setTimeout(240_000);

  test("refusé à l'affectation, à la création et au report ; grisé dans les cartes", async () => {
    const { pilote, monde } = sc;
    const a = await creerFormateurPret(monde, { prenom: "Mael" });
    const s1 = await creerSession(monde, { dansJours: 21 });
    await missionAcceptee(pilote, monde, s1.id, a.id);
    const s2 = await creerSession(monde, { dansJours: 21 }); // le MÊME jour
    const s3 = await creerSession(monde, { dansJours: 26 });
    // A est aussi affecté à S3 (un autre jour) : c'est celle qu'on reportera sur J.
    const aff3 = await pilote.appeler<Resultat<unknown>>(
      TRAINERS,
      "assignTrainerToSessionAction",
      [{ sessionId: s3.id, trainerId: a.id }],
      sc.console(),
    );
    expect(aff3, JSON.stringify(aff3)).toEqual({ data: expect.anything() });
    const propositionsAvant = (await envoisVers(a.email, "formateur-mission-proposee")).length;

    // ── Les cartes : A est grisé, raison « double emploi » ───────────────────
    const cartes = await pilote.appeler<{
      disponibles: Array<{ trainerId: string }>;
      indisponibles: Array<{ trainerId: string; refus: Array<{ code: string; texte: string }> }>;
    }>(M.serviceChoix, "lireCartesChoix", [s2.id, new Date()]);
    expect(cartes.disponibles.map((x) => x.trainerId)).not.toContain(a.id);
    const grisee = cartes.indisponibles.find((x) => x.trainerId === a.id);
    expect(grisee?.refus.map((r) => r.code)).toEqual(["double_emploi"]);

    // ── Porte 1 : l'affectation ───────────────────────────────────────────────
    const aff = await pilote.appeler<Resultat<unknown>>(
      TRAINERS,
      "assignTrainerToSessionAction",
      [{ sessionId: s2.id, trainerId: a.id }],
      sc.console(),
    );
    expect("error" in aff && aff.error).toMatch(DEJA_PRIS);
    expect(
      (
        await prisma.trainingSession.findUniqueOrThrow({
          where: { id: s2.id },
          select: { formateurPrincipalId: true },
        })
      ).formateurPrincipalId,
    ).toBeNull();

    // ── Porte 2 : la création d'une session avec ce formateur ────────────────
    const avantCreation = await prisma.trainingSession.count({
      where: { formationId: monde.formationId },
    });
    const cree = await pilote.appeler<Resultat<unknown>>(
      SESSIONS,
      "createSessionAction",
      [
        {
          formationId: monde.formationId,
          dateDebut: s1.dateDebut,
          dateFin: s1.dateFin,
          modalite: "presentiel",
          nbParticipantsPrevus: 6,
          montantHtCents: 120_000,
          clientId: monde.clientId,
          trainerId: a.id,
          lieuType: "sur_site",
          lieuAdresse: "3 rue du Banc",
          lieuCodePostal: "69003",
          lieuVille: "Lyon",
        },
      ],
      sc.console(),
    );
    expect("error" in cree && cree.error).toMatch(DEJA_PRIS);
    expect(await prisma.trainingSession.count({ where: { formationId: monde.formationId } })).toBe(
      avantCreation,
    );

    // ── Porte 3 : le report de S3 sur le jour J ───────────────────────────────
    const rep = await pilote.appeler<Resultat<{ nouvelleSessionId: string }>>(
      REPORT,
      "reportSessionAction",
      [
        {
          sessionId: s3.id,
          nouvelleDateDebut: s1.dateDebut,
          nouvelleDateFin: s1.dateFin,
          motif: "Report demandé par le client (banc)",
        },
      ],
      sc.console(),
    );
    expect("data" in rep, JSON.stringify(rep)).toBe(true);
    if (!("data" in rep)) return;
    const reportee = await prisma.trainingSession.findUniqueOrThrow({
      where: { id: rep.data.nouvelleSessionId },
      select: { formateurPrincipalId: true, sessionFormateurs: { select: { trainerId: true } } },
    });
    expect(reportee.formateurPrincipalId).toBeNull();
    expect(reportee.sessionFormateurs.map((x) => x.trainerId)).not.toContain(a.id);

    // ── Ce qui ne part pas : aucune proposition pour S2, la création, le report ──
    expect((await envoisVers(a.email, "formateur-mission-proposee")).length).toBe(
      propositionsAvant,
    );
    // Et S1 reste à lui.
    expect(
      (
        await prisma.trainingSession.findUniqueOrThrow({
          where: { id: s1.id },
          select: { formateurPrincipalId: true },
        })
      ).formateurPrincipalId,
    ).toBe(a.id);
  });
});
