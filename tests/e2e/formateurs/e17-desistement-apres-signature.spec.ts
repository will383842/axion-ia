// @formateurs E17 — Désistement APRÈS signature de la lettre : la décision est
// préparée pour validation humaine, le 2e choix reçoit la proposition.
//
// Ce que le code fait (`seDesister`, choix-formateur-service.ts:690) :
//   · la mission passe « désistée », l'affectation est retirée ;
//   · la lettre SIGNÉE reste au registre (jamais annulée par le système) ;
//   · F48 (« désistement reçu ») part au formateur ;
//   · l'alerte « Désistement après lettre signée : à vous de décider » est levée
//     (`regleDesistementLettreSignee`) : annuler la lettre avec motif, ou constater ;
//   · le 2e choix est proposé (rang suivant, cause « désistement »).
//
// ÉCART AU PLAN (noté au rapport) : « indemnité calculée ». Le code n'en calcule
// AUCUNE pour un désistement du formateur — « Un désistement du formateur n'ouvre
// aucun droit (art. 7.4) » (`indemniteAnnulation`, argent/calcul-mission.ts:296).
// L'indemnité n'existe que pour une annulation PAR AXION à moins de 72 h d'une
// mission acceptée. Le banc constate donc qu'aucune ligne d'indemnité n'est écrite
// et que la mission n'entre pas dans « Missions à indemniser ».

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
  prochainPassage,
} from "../fixtures/formateurs/missions-donnees";
import {
  choisir,
  contresignerLettre,
  derniereMission,
  lettresVivantes,
  M,
  repondre,
  signerConvention,
  signerMaLettre,
} from "../fixtures/formateurs/missions-gestes";
import {
  ATTENTE_FILE,
  cadreScenario,
  exigerAuPlusUneVivante,
  propositionsVivantes,
} from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e17");
const ALERTE = "@/server/qualiopi/alertes/regle-desistement-lettre-signee";
const INDEMNITE = "@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-base";

test.describe("@formateurs E17 — désistement après signature", () => {
  test.setTimeout(240_000);

  test("lettre gardée, décision à valider, 2e choix proposé, aucune indemnité", async () => {
    const { pilote, monde } = sc;
    const a = await creerFormateurPret(monde, { prenom: "Kilian" });
    const b = await creerFormateurPret(monde, { prenom: "Lena" });
    const session = await creerSession(monde, { dansJours: 20 });

    const c = await choisir(pilote, monde, session.id, [{ trainerId: a.id }, { trainerId: b.id }]);
    expect(c).toEqual({ data: expect.objectContaining({ missionProposee: true }) });
    const mA = await derniereMission(session.id, a.id);
    expect(await repondre(pilote, a.id, mA.id, "acceptee")).toEqual({
      data: expect.objectContaining({ statut: "acceptee" }),
    });
    const conv = await creerPiece(monde, {
      type: "convention",
      sessionId: session.id,
      clientId: monde.clientId,
    });
    await signerConvention(pilote, monde, conv);
    const [lettre] = await lettresVivantes(session.id, a.id);
    expect(lettre).toBeDefined();
    expect(await signerMaLettre(pilote, a.id, lettre!.id)).toMatchObject({ ok: true });
    expect(await contresignerLettre(pilote, monde, lettre!.id)).toMatchObject({
      ok: true,
      statutSignature: "signee",
    });

    // ── « Je ne peux plus assurer cette mission », depuis l'espace ────────────
    const d = await pilote.appeler<{ data?: unknown; error?: string }>(
      M.choix,
      "seDesisterMissionAction",
      [{ missionId: mA.id, motif: "Empêchement familial (banc)" }],
      sc.espace(a.id),
    );
    expect(d, JSON.stringify(d)).toEqual({ data: { ok: true } });
    const apres = await prisma.missionFormateur.findUniqueOrThrow({
      where: { id: mA.id },
      select: { statut: true, desisteAt: true, desisteMotif: true },
    });
    expect(apres.statut).toBe("desistee");
    expect(apres.desisteMotif).toContain("Empêchement familial");

    // La lettre signée RESTE au registre.
    const l = await prisma.documentGenere.findUniqueOrThrow({
      where: { id: lettre!.id },
      select: { annuleeAt: true, statutSignature: true },
    });
    expect(l).toEqual({ annuleeAt: null, statutSignature: "signee" });

    // F48 au formateur, une fois.
    await expect
      .poll(
        async () => (await envoisVers(a.email, "formateur-desistement-recu")).length,
        ATTENTE_FILE,
      )
      .toBe(1);

    // La décision est préparée pour un humain : l'alerte « à vous de décider ».
    const alertes = await pilote.appeler<Array<{ code: string; cibleId: string; titre: string }>>(
      ALERTE,
      "regleDesistementLettreSignee",
      [new Date()],
    );
    expect(alertes.filter((x) => x.cibleId === session.id)).toEqual([
      expect.objectContaining({
        code: "formateur_desistement_lettre_signee",
        titre: "Désistement après lettre signée : à vous de décider",
      }),
    ]);

    // Le 2e choix : tout de suite dans la fenêtre d'envoi, sinon au passage suivant.
    if ((await propositionsVivantes(session.id)).length === 0) {
      await pilote.appeler(M.serviceChoix, "proposerRangsSuivants", [prochainPassage(new Date())]);
    }
    const mB = await derniereMission(session.id, b.id);
    expect(mB.statut).toBe("en_attente");
    await exigerAuPlusUneVivante(session.id);

    // Aucune indemnité : pas de ligne, pas de mission « à indemniser ».
    const lignes = await prisma.trainerFeeLine.count({
      where: { trainerId: a.id, objet: "indemnite_annulation" },
    });
    expect(lignes).toBe(0);
    const aIndemniser = await pilote.appeler<Array<{ missionId?: string; id?: string }>>(
      INDEMNITE,
      "lireMissionsAIndemniser",
    );
    expect(JSON.stringify(aIndemniser)).not.toContain(mA.id);
  });
});
