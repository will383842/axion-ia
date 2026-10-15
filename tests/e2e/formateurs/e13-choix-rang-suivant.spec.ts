// @formateurs E13 — Choix 1/2/3 en deux clics, refus au 1er choix SANS motif, le 2e
// choix proposé dans l'heure (forfait affiché), son silence jusqu'à l'échéance, F24,
// puis « À pourvoir » quand plus personne ne reste.
//
// Contrôles clés : jamais deux propositions vivantes sur la session ; le montant
// (honoraires et forfait) est écrit au formateur AVANT « J'accepte ».
//
// Chemin réel : l'action de la console (`choisirFormateursSessionAction`, cartes puis
// affectation du 1er choix), l'action de l'espace formateur
// (`repondreMissionFormateurAction`, refus libre de l'indépendant), puis les deux
// passages du worker (`passerRelancesPropositionsHoraires`, `proposerRangsSuivants`)
// appelés avec l'horloge du banc. Les actions lisent l'heure réelle, comme en
// production ; l'horloge du banc part toujours APRÈS elle.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { horlogePilotee } from "../fixtures/formateurs/horloge";
import {
  creerFormateurPret,
  creerSession,
  envoisVers,
  prochainPassage,
  gabaritsVers,
  type FormateurBanc,
  type SessionBanc,
} from "../fixtures/formateurs/missions-donnees";
import { envoiRendu } from "../fixtures/formateurs/missions-gestes";
import {
  ATTENTE_FILE,
  cadreScenario,
  exigerAuPlusUneVivante,
  propositionsVivantes,
} from "../fixtures/formateurs/missions-scenario";

const CHOIX = "@/server/actions/qualiopi/choix-formateur";
const MISSION = "@/server/actions/qualiopi/mission-formateur";
const SERVICE_CHOIX = "@/server/qualiopi/formateurs-independants/choix-formateur-service";
const RELANCES = "@/server/qualiopi/formateurs-independants/relances-propositions-horaires";
const CHIFFREE = "@/server/qualiopi/formateurs-independants/proposition-chiffree";

type Resultat<T> = { data: T } | { error: string };

const sc = cadreScenario("e13");

let a: FormateurBanc;
let b: FormateurBanc;
let c: FormateurBanc;
let session: SessionBanc;

async function missionDe(trainerId: string) {
  return prisma.missionFormateur.findFirstOrThrow({
    where: { sessionId: session.id, trainerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      statut: true,
      tarifHtCents: true,
      forfaitDeplacementParJourHtCents: true,
      echeanceReponseAt: true,
      motifRefus: true,
    },
  });
}

test.describe("@formateurs E13 — choix 1/2/3, refus, rang suivant, expiration, à pourvoir", () => {
  // V1-B-1 lit la session du parcours complet : les deux tests tournent dans l'ordre.
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("le parcours complet, une seule proposition vivante à chaque instant", async () => {
    const { pilote, monde } = sc;
    // A en Isère (même région), B à Paris (ailleurs) : forfait dû ; C dans le Rhône : compris.
    a = await creerFormateurPret(monde, { prenom: "Albane", codePostalPro: "38000" });
    b = await creerFormateurPret(monde, { prenom: "Bastien", codePostalPro: "75011" });
    c = await creerFormateurPret(monde, { prenom: "Coline", codePostalPro: "69007" });
    session = await creerSession(monde, { dansJours: 20, nbJours: 2 });

    // ── Les cartes : les trois sont disponibles ───────────────────────────────
    const cartes = await pilote.appeler<{
      disponibles: Array<{ trainerId: string }>;
      indisponibles: Array<{ trainerId: string; refus: unknown[] }>;
      ouverte: boolean;
    }>(SERVICE_CHOIX, "lireCartesChoix", [session.id, new Date()]);
    expect(cartes.ouverte).toBe(true);
    const dispo = cartes.disponibles.map((x) => x.trainerId);
    expect(dispo, JSON.stringify(cartes.indisponibles)).toEqual(
      expect.arrayContaining([a.id, b.id, c.id]),
    );

    // ── Deux clics : le choix 1/2/3, puis « Valider » ────────────────────────
    const choix = await pilote.appeler<Resultat<{ missionProposee: boolean }>>(
      CHOIX,
      "choisirFormateursSessionAction",
      [
        {
          sessionId: session.id,
          choix: [
            { trainerId: a.id, rang: 1, forfaitDeplacementParJourHtCents: 6_000 },
            { trainerId: b.id, rang: 2, forfaitDeplacementParJourHtCents: 3_500 },
            { trainerId: c.id, rang: 3, forfaitDeplacementParJourHtCents: null },
          ],
        },
      ],
      sc.console(),
    );
    expect(choix).toEqual({ data: expect.objectContaining({ missionProposee: true }) });
    const figes = await prisma.choixFormateurSession.findMany({
      where: { sessionId: session.id },
      orderBy: { rang: "asc" },
      select: {
        rang: true,
        trainerId: true,
        tarifHtCents: true,
        forfaitDeplacementParJourHtCents: true,
      },
    });
    // Le tarif figé est celui du texte arrêté (350 € HT la journée), pas celui de la
    // fiche : c'est ce que le paiement par mission versera.
    expect(
      figes.map((f) => [f.rang, f.trainerId, f.tarifHtCents, f.forfaitDeplacementParJourHtCents]),
    ).toEqual([
      [1, a.id, 35_000, 6_000],
      [2, b.id, 35_000, 3_500],
      [3, c.id, 35_000, 0],
    ]);
    const mA = await missionDe(a.id);
    expect(mA).toMatchObject({
      statut: "en_attente",
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 6_000,
    });
    await exigerAuPlusUneVivante(session.id);

    // ── Le montant est écrit AVANT « J'accepte » : page et e-mail ─────────────
    const proposition = await pilote.appeler<{
      totalHtCents: number;
      ligneHonoraires: string;
      ligneDeplacement: string;
    } | null>(CHIFFREE, "lirePropositionChiffree", [mA.id]);
    // 2 journées × 350 € + 2 × 60 € de forfait.
    expect(proposition?.totalHtCents).toBe(2 * 35_000 + 2 * 6_000);
    const f23 = await envoiRendu(pilote, `formateur-mission-${mA.id}-proposition`);
    expect(f23.to).toBe(a.email);
    expect(f23.texte).toMatch(/350/);
    expect(f23.texte).toMatch(/forfait de 60[\s\u00a0\u202f]?€ HT par journée/);

    // ── Refus du 1er choix, SANS motif (indépendant) ─────────────────────────
    const refus = await pilote.appeler<Resultat<{ statut: string }>>(
      MISSION,
      "repondreMissionFormateurAction",
      [{ missionId: mA.id, reponse: "refusee" }],
      sc.espace(a.id),
    );
    expect(refus).toEqual({ data: expect.objectContaining({ statut: "refusee" }) });
    expect((await missionDe(a.id)).motifRefus).toBeNull();
    await exigerAuPlusUneVivante(session.id);

    // ── Le 2e choix dans l'heure : tout de suite si l'heure réelle est dans la
    //    fenêtre d'envoi, sinon au premier passage horaire qui suit.
    const horloge = horlogePilotee(prochainPassage(new Date()));
    if ((await propositionsVivantes(session.id)).length === 0) {
      expect(horloge.maintenant().getTime() - Date.now()).toBeLessThan(15 * 3_600_000);
      await pilote.appeler(SERVICE_CHOIX, "proposerRangsSuivants", [horloge.maintenant()]);
    }
    const mB = await missionDe(b.id);
    expect(mB).toMatchObject({
      statut: "en_attente",
      tarifHtCents: 35_000,
      forfaitDeplacementParJourHtCents: 3_500,
    });
    expect((await propositionsVivantes(session.id)).map((v) => v.trainerId)).toEqual([b.id]);
    const sessionApresB = await prisma.trainingSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { formateurPrincipalId: true },
    });
    expect(sessionApresB.formateurPrincipalId).toBe(b.id);
    // Le forfait du 2e choix est affiché dans sa proposition, avant « J'accepte ».
    const f23b = await envoiRendu(pilote, `formateur-mission-${mB.id}-proposition`);
    expect(f23b.to).toBe(b.email);
    expect(f23b.texte).toMatch(/forfait de 35[\s\u00a0\u202f]?€ HT par journée/);

    // ── Silence du 2e choix jusqu'à l'échéance : sans réponse, F24 ───────────
    expect(mB.echeanceReponseAt).not.toBeNull();
    const apresB = prochainPassage(new Date((mB.echeanceReponseAt as Date).getTime() + 60_000));
    const bilanB = await pilote.appeler<{ sansReponse: number }>(
      RELANCES,
      "passerRelancesPropositionsHoraires",
      [apresB],
    );
    expect(bilanB.sansReponse).toBeGreaterThanOrEqual(1);
    expect((await missionDe(b.id)).statut).toBe("sans_reponse");
    await pilote.appeler(SERVICE_CHOIX, "proposerRangsSuivants", [apresB]);
    const mC = await missionDe(c.id);
    expect(mC.statut).toBe("en_attente");
    await exigerAuPlusUneVivante(session.id);

    // ── Silence du 3e choix : F24, puis plus personne — « À pourvoir » ───────
    const apresC = prochainPassage(new Date((mC.echeanceReponseAt as Date).getTime() + 60_000));
    expect(apresC.getTime()).toBeLessThan(session.dateDebut.getTime());
    await pilote.appeler(RELANCES, "passerRelancesPropositionsHoraires", [apresC]);
    expect((await missionDe(c.id)).statut).toBe("sans_reponse");
    const aPourvoir = await pilote.appeler<{ proposes: number; aPourvoir: number }>(
      SERVICE_CHOIX,
      "proposerRangsSuivants",
      [apresC],
    );
    expect(aPourvoir.proposes).toBe(0);
    expect(await propositionsVivantes(session.id)).toEqual([]);
    const fin = await prisma.trainingSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { formateurPrincipalId: true },
    });
    expect(fin.formateurPrincipalId).toBeNull();
    const restants = await prisma.choixFormateurSession.count({
      where: { sessionId: session.id, rang: { lte: 3 }, sauteAt: null },
    });
    expect(restants).toBe(0);
    // ── Ce qui part, et ce qui ne part pas ───────────────────────────────────
    await expect
      .poll(
        async () => (await envoisVers(c.email, "formateur-proposition-close")).length,
        ATTENTE_FILE,
      )
      .toBe(1);
    expect(await gabaritsVers(a.email)).toEqual(["formateur-mission-proposee"]);
    expect(await gabaritsVers(b.email)).toEqual([
      "formateur-mission-proposee",
      "formateur-proposition-close",
    ]);
    expect(await gabaritsVers(c.email)).toEqual([
      "formateur-mission-proposee",
      "formateur-proposition-close",
    ]);
  });

  // V1-B-1 — corrigé (lot 4). Quand le DERNIER choix se tait, la place est libérée par
  // `passerLesSansReponse`, puis le passage horaire (`proposerRangsSuivants`, cause
  // « passage ») découvre que plus personne ne reste. Il vient de VIDER la liste des
  // choix : il l'annonce — journal `qualiopi.mission.a_pourvoir` + alerte —, une fois.
  test("V1-B-1 — « À pourvoir » est annoncé quand le silence du dernier choix libère la place", async () => {
    const journal = await prisma.activityLog.findMany({
      where: { targetId: session.id, action: "qualiopi.mission.a_pourvoir" },
      select: { action: true },
    });
    expect(journal).toHaveLength(1);
  });
});
