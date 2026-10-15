// @formateurs E16 — Changement de dates : lettre rectifiée (F29), l'ancienne annulée,
// F27 réarmée sur la nouvelle lettre ; empreinte des conditions.
//
// Deux tests, deux sessions :
//   (a) les relances F27 de la lettre telle qu'elles sont aujourd'hui — 1re à J+2,
//       J-3, rien après le début — et la décision récente : une RÉPONSE du formateur
//       arrête ses relances, J-3 comprise ;
//   (b) les dates changent par la console (dates de la session, puis journées) : le
//       passage horaire voit l'empreinte changer, annule la lettre non signée avec son
//       motif fermé, émet la nouvelle, envoie F29.
//
// ÉCART AU PLAN (noté au rapport) : le plan annonce la 1re relance à
// « min(J+2, mi-chemin) ». Le code (`faitsLettre`, relances-missions.ts:391) la place
// à F26 + 2 jours, et seulement si cela tombe au plus tard la veille de J-3 ; aucun
// « mi-chemin ». Le banc suit le code.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import {
  aParis,
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
  jourCivil,
  prochainPassage,
} from "../fixtures/formateurs/missions-donnees";
import {
  lettresVivantes,
  M,
  missionAcceptee,
  signerConvention,
} from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e16");
const SESSIONS = "@/server/actions/qualiopi/sessions";
const JOURS = "@/server/actions/qualiopi/session-jours";
const F27 = "formateur-lettre-relance";
const JOUR_MS = 86_400_000;

/** 10 h à Paris le jour civil de `d` (dans la fenêtre d'envoi). */
const dixHeures = (d: Date) => aParis(jourCivil(d, 0), 10);

async function lettreEnvoyee(sessionId: string, trainerId: string, email: string) {
  const conv = await creerPiece(sc.monde, {
    type: "convention",
    sessionId,
    clientId: sc.monde.clientId,
  });
  await signerConvention(sc.pilote, sc.monde, conv);
  await expect
    .poll(async () => (await envoisVers(email, "formateur-lettre-a-signer")).length, ATTENTE_FILE)
    .toBe(1);
  const [lettre] = await lettresVivantes(sessionId, trainerId);
  return { lettre: lettre!, f26: (await envoisVers(email, "formateur-lettre-a-signer"))[0]! };
}

async function passerCampagnes(t: Date): Promise<unknown> {
  return sc.pilote.appeler(M.campagnes, "passerCampagnes", [t]);
}

test.describe("@formateurs E16 — relances de la lettre, changement de dates", () => {
  test.setTimeout(240_000);

  test("(a) F27 : 1re à J+2, réponse du formateur ⇒ plus de J-3, rien après le début", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Gaspard" });
    const session = await creerSession(monde, { dansJours: 20 });
    await missionAcceptee(pilote, monde, session.id, f.id);
    const { lettre, f26 } = await lettreEnvoyee(session.id, f.id, f.email);

    // Avant J+2 : rien.
    await passerCampagnes(dixHeures(new Date(f26.createdAt.getTime() + JOUR_MS)));
    expect(await envoisVers(f.email, F27)).toEqual([]);
    // J+2 : la 1re relance, une seule, même si le passage repasse.
    const j2 = prochainPassage(new Date(f26.createdAt.getTime() + 2 * JOUR_MS));
    await passerCampagnes(j2);
    await passerCampagnes(new Date(j2.getTime() + 3_600_000));
    const premieres = await envoisVers(f.email, F27);
    expect(premieres.map((e) => e.jobId)).toEqual([`fi-lettre-1re-${f.id}-${lettre.id}-1re`]);

    // Le formateur RÉPOND (message rangé sur sa fiche) : ses relances s'arrêtent.
    await prisma.reponseEntranteFormateur.create({
      data: {
        trainerId: f.id,
        source: "banc",
        recuLe: new Date(j2.getTime() + 2 * 3_600_000),
        auto: false,
      },
    });
    const j3 = dixHeures(new Date(session.dateDebut.getTime() - 3 * JOUR_MS));
    await passerCampagnes(j3);
    expect((await envoisVers(f.email, F27)).length).toBe(1);

    // Après le début : jamais rien.
    await passerCampagnes(dixHeures(new Date(session.dateDebut.getTime() + JOUR_MS)));
    expect((await envoisVers(f.email, F27)).length).toBe(1);
  });

  test("(a bis) sans réponse : 1re à J+2, puis J-3 — une seule de chaque", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Hortense" });
    const session = await creerSession(monde, { dansJours: 20 });
    await missionAcceptee(pilote, monde, session.id, f.id);
    const { lettre, f26 } = await lettreEnvoyee(session.id, f.id, f.email);
    await passerCampagnes(prochainPassage(new Date(f26.createdAt.getTime() + 2 * JOUR_MS)));
    const j3 = dixHeures(new Date(session.dateDebut.getTime() - 3 * JOUR_MS));
    await passerCampagnes(j3);
    await passerCampagnes(new Date(j3.getTime() + 3_600_000));
    expect((await envoisVers(f.email, F27)).map((e) => e.jobId)).toEqual([
      `fi-lettre-1re-${f.id}-${lettre.id}-1re`,
      `fi-lettre-j3-${f.id}-${lettre.id}-j-3`,
    ]);
  });

  test("(b) dates changées : ancienne lettre annulée, nouvelle émise, F29, empreinte changée", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Ilona" });
    const session = await creerSession(monde, { dansJours: 20, nbJours: 2 });
    await missionAcceptee(pilote, monde, session.id, f.id);
    const { lettre: ancienne } = await lettreEnvoyee(session.id, f.id, f.email);
    const empreinteAvant = (ancienne.metadata as { empreinteMission?: string }).empreinteMission;
    expect(empreinteAvant).toMatch(/^[0-9a-f]{64}$/);

    // La console décale la session d'une semaine : la plage, puis les journées.
    const debut = new Date(session.dateDebut.getTime() + 7 * JOUR_MS);
    const fin = new Date(session.dateFin.getTime() + 7 * JOUR_MS);
    const motif = "Report d'une semaine demandé par le client (banc)";
    const dates = await pilote.appeler<{ data?: unknown; error?: string }>(
      SESSIONS,
      "setSessionDatesAction",
      [{ id: session.id, dateDebut: debut, dateFin: fin, motifRequalification: motif }],
      sc.console(),
    );
    expect(dates.error).toBeUndefined();
    const jours = [0, 1].map((i) => ({
      date: jourCivil(debut, i).toISOString().slice(0, 10),
      heureDebut: "09:00",
      heureFin: "17:00",
    }));
    const j = await pilote.appeler<{ data?: unknown; error?: string }>(
      JOURS,
      "saveSessionJoursAction",
      [{ sessionId: session.id, jours, motifRequalification: motif }],
      sc.console(),
    );
    expect(j.error).toBeUndefined();

    // Le passage horaire (filet) voit la lettre périmée.
    const t = aParis(jourCivil(new Date(), 1), 11, 25);
    await pilote.appeler(M.moteur, "passerMoteurMissions", [t]);

    const vivantes = await lettresVivantes(session.id, f.id);
    expect(vivantes, "une seule lettre vivante").toHaveLength(1);
    const nouvelle = vivantes[0]!;
    expect(nouvelle.id).not.toBe(ancienne.id);
    const annulee = await prisma.documentGenere.findUniqueOrThrow({
      where: { id: ancienne.id },
      select: { annuleeAt: true, annuleeMotif: true, annuleePar: true },
    });
    expect(annulee.annuleeAt).not.toBeNull();
    expect(annulee.annuleeMotif).toBe("Dates, lieu ou honoraires modifiés (dates_modifiees)");
    expect(annulee.annuleePar).toBe("system");
    const empreinteApres = (nouvelle.metadata as { empreinteMission?: string }).empreinteMission;
    expect(empreinteApres).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteApres).not.toBe(empreinteAvant);
    const mission = await prisma.missionFormateur.findFirstOrThrow({
      where: { sessionId: session.id, trainerId: f.id },
      select: { lettreMissionId: true },
    });
    expect(mission.lettreMissionId).toBe(nouvelle.id);

    // F29, une fois ; pas de second F26.
    await expect
      .poll(
        async () => (await envoisVers(f.email, "formateur-lettre-rectifiee")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    // Un second passage ne rejoue rien : l'empreinte rangée est à jour.
    await pilote.appeler(M.moteur, "passerMoteurMissions", [new Date(t.getTime() + 3_600_000)]);
    expect(await lettresVivantes(session.id, f.id)).toHaveLength(1);
    expect(await envoisVers(f.email, "formateur-lettre-rectifiee")).toHaveLength(1);
    expect(await envoisVers(f.email, "formateur-lettre-a-signer")).toHaveLength(1);
  });

  // V1-B-2 — DÉFAUT (gravité haute). Après une rectification, la nouvelle lettre n'a
  // AUCUNE relance F27 : `lireLignesLettre` (relances-missions.ts ~l.476) ne compte
  // comme « envoyée » qu'une lettre dont le journal porte un F26 de jobId
  // `formateur-lettre-a-signer-<lettreMissionId>`. Or la lettre rectifiée part par F29
  // (moteur-mission.ts ~l.901), jamais par F26 : `envoyeeAt` reste nul, `faitsLettre`
  // rend `null`, ni 1re ni J-3 ne partent. Un formateur dont la session a été décalée
  // n'est plus jamais relancé pour signer.
  test.fixme("V1-B-2 — F27 réarmée sur la lettre rectifiée (1re puis J-3)", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Jules" });
    const session = await creerSession(monde, { dansJours: 20 });
    await missionAcceptee(pilote, monde, session.id, f.id);
    await lettreEnvoyee(session.id, f.id, f.email);
    const debut = new Date(session.dateDebut.getTime() + 7 * JOUR_MS);
    await pilote.appeler(
      SESSIONS,
      "setSessionDatesAction",
      [
        {
          id: session.id,
          dateDebut: debut,
          dateFin: new Date(debut.getTime() + 8 * 3_600_000),
          motifRequalification: "Report (banc)",
        },
      ],
      sc.console(),
    );
    await pilote.appeler(
      JOURS,
      "saveSessionJoursAction",
      [
        {
          sessionId: session.id,
          jours: [
            { date: debut.toISOString().slice(0, 10), heureDebut: "09:00", heureFin: "17:00" },
          ],
          motifRequalification: "Report (banc)",
        },
      ],
      sc.console(),
    );
    const t = aParis(jourCivil(new Date(), 1), 11, 25);
    await pilote.appeler(M.moteur, "passerMoteurMissions", [t]);
    const [nouvelle] = await lettresVivantes(session.id, f.id);
    await passerCampagnes(prochainPassage(new Date(t.getTime() + 2 * JOUR_MS)));
    expect((await envoisVers(f.email, F27)).map((e) => e.jobId)).toEqual([
      `fi-lettre-1re-${f.id}-${nouvelle!.id}-1re`,
    ]);
  });
});
