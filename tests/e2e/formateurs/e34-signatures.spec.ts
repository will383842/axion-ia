// @formateurs E34 — Signatures.
//   (a) une lettre ne se signe QUE par son formateur ;
//   (b) un lot de 3 lettres à contresigner dont une PÉRIMÉE → 2 signées, 1 refusée
//       avec son motif ; et le formateur ne peut pas signer une lettre périmée ;
//   (c) l'ancienne version du contrat-cadre est encore RENDUE après la nouvelle ;
//   (d) le consentement à l'image est rendu en exemplaire, et jamais relancé ;
//   (e) nouvelle version « favorable » / « engageante » (voir l'écart ci-dessous) ;
//   (f) décision récente : le SIRET du contrat doit être celui de la fiche.
//
// ÉCART AU PLAN (noté au rapport, V1-B-4) : le code ne connaît pas de nouvelle
// version « favorable » (sans signature) ni « engageante » (F45, relances J+7 / J+21,
// bouton « Je préfère rester sur la version actuelle »). Cette distinction n'existe
// que dans le TEXTE du contrat (art. 32). L'envoi d'une nouvelle version
// (`envoyerNouvelleVersionAction`) exige le résumé des changements au registre des
// versions ; la v4 n'en a pas : l'envoi refuse, rien n'est préparé ni envoyé. Le
// banc constate ce refus ; le comportement attendu est consigné en `test.fixme`.

import { expect, test } from "@playwright/test";

import type { Prisma } from "../../../prisma/generated/client/index.js";
import { prisma } from "../fixtures/formateurs/base";
import {
  creerFormateurPret,
  creerPiece,
  creerSession,
  envoisVers,
  jourCivil,
  siretDeBanc,
  type FormateurBanc,
} from "../fixtures/formateurs/missions-donnees";
import {
  lettresVivantes,
  M,
  missionAcceptee,
  SCAN_FICTIF,
  signerConvention,
  signerMaLettre,
} from "../fixtures/formateurs/missions-gestes";
import { ATTENTE_FILE, cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e34");
const AIDES = "./missions-aides-serveur.ts";
const EXEMPLAIRE = "@/server/qualiopi/documents/signature/exemplaire-signe";
const DOCUMENTS = "@/server/actions/qualiopi/documents";
const CONTRAT = "@/server/actions/qualiopi/formateur-contrat-cadre";
const EN_VIGUEUR = "@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur";
const RELANCE = "@/server/qualiopi/documents/signature/relance-partie";
const JOUR_MS = 86_400_000;

type Signature = { ok: boolean; statutSignature?: string; raison?: string; message?: string };

/** Une mission acceptée, sa convention signée : la lettre est émise. */
async function lettreDe(f: FormateurBanc, dansJours: number) {
  const s = await creerSession(sc.monde, { dansJours });
  await missionAcceptee(sc.pilote, sc.monde, s.id, f.id);
  const conv = await creerPiece(sc.monde, {
    type: "convention",
    sessionId: s.id,
    clientId: sc.monde.clientId,
  });
  await signerConvention(sc.pilote, sc.monde, conv);
  const [l] = await lettresVivantes(s.id, f.id);
  expect(l).toBeDefined();
  return { session: s, lettre: l! };
}

/** La console décale la session d'une semaine (plage puis journées), SANS passage du moteur. */
async function decaler(s: { id: string; dateDebut: Date; dateFin: Date }) {
  const debut = new Date(s.dateDebut.getTime() + 7 * JOUR_MS);
  const motif = "Report d'une semaine (banc)";
  await sc.pilote.appeler(
    "@/server/actions/qualiopi/sessions",
    "setSessionDatesAction",
    [
      {
        id: s.id,
        dateDebut: debut,
        dateFin: new Date(s.dateFin.getTime() + 7 * JOUR_MS),
        motifRequalification: motif,
      },
    ],
    sc.console(),
  );
  await sc.pilote.appeler(
    "@/server/actions/qualiopi/session-jours",
    "saveSessionJoursAction",
    [
      {
        sessionId: s.id,
        jours: [
          {
            date: jourCivil(debut, 0).toISOString().slice(0, 10),
            heureDebut: "09:00",
            heureFin: "17:00",
          },
        ],
        motifRequalification: motif,
      },
    ],
    sc.console(),
  );
}

test.describe("@formateurs E34 — signatures", () => {
  test.setTimeout(300_000);

  test("(a)(b) lettre signée par son seul formateur ; lot de 3 dont une périmée", async () => {
    const { pilote, monde } = sc;
    const [t1, t2, t3, t4] = [
      await creerFormateurPret(monde, { prenom: "Yanis" }),
      await creerFormateurPret(monde, { prenom: "Zoe" }),
      await creerFormateurPret(monde, { prenom: "Adele" }),
      await creerFormateurPret(monde, { prenom: "Bruno" }),
    ];
    const l1 = await lettreDe(t1, 20);
    const l2 = await lettreDe(t2, 21);
    const l3 = await lettreDe(t3, 22);
    const l4 = await lettreDe(t4, 23);

    // (a) Un AUTRE formateur ne signe pas la lettre de T1 ; T1, oui.
    const intrus = await signerMaLettre(pilote, t2.id, l1.lettre.id);
    expect(intrus.ok).toBe(false);
    expect(
      await prisma.documentSignature.count({
        where: { documentGenereId: l1.lettre.id, revokedAt: null },
      }),
    ).toBe(0);
    expect(await signerMaLettre(pilote, t1.id, l1.lettre.id)).toMatchObject({
      ok: true,
      statutSignature: "partielle",
    });
    expect(await signerMaLettre(pilote, t2.id, l2.lettre.id)).toMatchObject({ ok: true });
    expect(await signerMaLettre(pilote, t3.id, l3.lettre.id)).toMatchObject({ ok: true });

    // L3 (signée par T3) et L4 (pas encore signée) deviennent PÉRIMÉES.
    await decaler(l3.session);
    await decaler(l4.session);

    // Le formateur ne signe pas une lettre périmée.
    const perimee = (await signerMaLettre(pilote, t4.id, l4.lettre.id)) as Signature;
    expect(perimee.ok).toBe(false);
    expect(perimee.raison).toBe("piece_non_signable_maintenant");
    expect(perimee.message ?? "").not.toBe("");

    // (b) Le lot de trois : 2 contresignées, 1 refusée avec son motif.
    const lot = await pilote.appeler<{
      ok?: boolean;
      signees?: number;
      refusees?: number;
      resultats?: Array<{
        documentGenereId: string;
        ok: boolean;
        raison?: string;
        message?: string;
      }>;
      error?: string;
    }>(
      M.piece,
      "contresignerParLotAction",
      [{ ids: [l1.lettre.id, l2.lettre.id, l3.lettre.id], methode: "confirmation_accessible" }],
      sc.console(),
    );
    expect(lot, JSON.stringify(lot)).toMatchObject({ signees: 2, refusees: 1 });
    const refusee = lot.resultats?.find((r) => r.documentGenereId === l3.lettre.id);
    expect(refusee).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(refusee?.message ?? "").toMatch(/\S/);
    const statuts = await prisma.documentGenere.findMany({
      where: { id: { in: [l1.lettre.id, l2.lettre.id, l3.lettre.id] } },
      select: { id: true, statutSignature: true },
    });
    const parId = Object.fromEntries(statuts.map((x) => [x.id, x.statutSignature]));
    expect([parId[l1.lettre.id], parId[l2.lettre.id], parId[l3.lettre.id]]).toEqual([
      "signee",
      "signee",
      "partielle",
    ]);
  });

  test("(c) l'ancienne version du contrat-cadre est encore rendue après la nouvelle", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Celia", contratSigne: false });
    const signer = async (id: string) => {
      // Le formateur : contrat signé sur papier, versé par la console ; puis Axion.
      for (const [porteur, methode] of [
        [
          {
            type: "reversement_papier",
            adminId: monde.admin.id,
            provider: "physical_signed",
            partie: "sous_traitant",
            signataire: { nom: "Celia Banc" },
          },
          "papier_scanne",
        ],
        [
          { type: "organisme_authentifie", adminId: monde.admin.id, partie: "axionia" },
          "confirmation_accessible",
        ],
      ] as const) {
        const r = await pilote.appeler<Signature>(M.signature, "signerDocument", [
          {
            documentGenereId: id,
            porteur,
            methode,
            ...(methode === "papier_scanne" ? { imageDataUrl: SCAN_FICTIF } : {}),
            partiesRequises: ["sous_traitant", "axionia"],
          },
        ]);
        expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
      }
    };
    const v3 = await pilote.appeler<string>(AIDES, "genererContratCadreBanc", [f.id, 3]);
    monde.traces.documents.push(v3);
    await signer(v3);
    const v4 = await pilote.appeler<string>(AIDES, "genererContratCadreBanc", [f.id, 4]);
    monde.traces.documents.push(v4);
    await signer(v4);

    const enVigueur = await pilote.appeler<{ version: number } | null>(
      EN_VIGUEUR,
      "lireContratCadreSigne",
      [f.id],
    );
    expect(enVigueur?.version).toBe(4);
    const r3 = await pilote.appeler<{ ok: boolean; raison?: string; buffer?: { $octets: number } }>(
      EXEMPLAIRE,
      "rendreExemplaireSigne",
      [v3],
    );
    const r4 = await pilote.appeler<{ ok: boolean; raison?: string; buffer?: { $octets: number } }>(
      EXEMPLAIRE,
      "rendreExemplaireSigne",
      [v4],
    );
    expect(r3, JSON.stringify(r3)).toMatchObject({ ok: true });
    expect(r4, JSON.stringify(r4)).toMatchObject({ ok: true });
    expect(r3.buffer?.$octets ?? 0).toBeGreaterThan(1_000);
    // Chaque exemplaire rejoue SA version : la v3 n'est pas reconstituée en v4.
    const versions = await prisma.documentGenere.findMany({
      where: { id: { in: [v3, v4] } },
      select: { id: true, metadata: true, annuleeAt: true },
    });
    const v = (id: string) =>
      (versions.find((x) => x.id === id)?.metadata as { renderData?: { gabaritVersion?: number } })
        ?.renderData?.gabaritVersion;
    expect([v(v3), v(v4)]).toEqual([3, 4]);
    expect(versions.every((x) => x.annuleeAt === null)).toBe(true);
  });

  test("(d) le consentement à l'image : rendu en exemplaire, jamais relancé", async () => {
    const { pilote, monde } = sc;
    const s = await creerSession(monde, { dansJours: 24 });
    const email = `beneficiaire.${monde.cle}@example.test`;
    const stagiaire = await prisma.trainee.create({
      data: { nom: "Image", prenom: "Camille", email } as Prisma.TraineeUncheckedCreateInput,
      select: { id: true },
    });
    monde.traces.stagiaires.push(stagiaire.id);
    monde.traces.adresses.push(email);
    const insc = await prisma.enrollment.create({
      data: { sessionId: s.id, traineeId: stagiaire.id } as Prisma.EnrollmentUncheckedCreateInput,
      select: { id: true },
    });
    const g = await pilote.appeler<{
      data?: { documentId: string; numero: string };
      error?: string;
    }>(DOCUMENTS, "genererAutorisationCaptationAction", [{ enrollmentId: insc.id }], sc.console());
    expect(g.error, JSON.stringify(g)).toBeUndefined();
    const docId = g.data!.documentId;
    monde.traces.documents.push(docId);

    // Jamais relancé : la règle de relance ne désigne personne, signée ou non.
    expect(
      await pilote.appeler(RELANCE, "partieARelancer", [
        "autorisation_captation",
        "en_attente",
        [],
      ]),
    ).toBeNull();

    // Signé (papier versé), l'exemplaire est remis.
    const r = await pilote.appeler<Signature>(M.signature, "signerDocument", [
      {
        documentGenereId: docId,
        porteur: {
          type: "reversement_papier",
          adminId: monde.admin.id,
          provider: "physical_signed",
          partie: "beneficiaire",
          signataire: { nom: "Camille Image", email },
        },
        methode: "papier_scanne",
        imageDataUrl: SCAN_FICTIF,
        partiesRequises: ["beneficiaire"],
      },
    ]);
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true, statutSignature: "signee" });
    await pilote.appeler(M.apres, "apresSignature", [
      {
        documentGenereId: docId,
        type: "autorisation_captation",
        numero: g.data!.numero,
        statutSignature: "signee",
        partie: "beneficiaire",
        acteur: {
          type: "administrateur",
          session: { userId: monde.admin.id, role: monde.admin.role },
        },
      },
    ]);
    const rendu = await pilote.appeler<{ ok: boolean }>(EXEMPLAIRE, "rendreExemplaireSigne", [
      docId,
    ]);
    expect(rendu, JSON.stringify(rendu)).toMatchObject({ ok: true });
    await expect
      .poll(async () => (await envoisVers(email, "piece-exemplaire-signe")).length, ATTENTE_FILE)
      .toBe(1);
    // Rien d'autre ne lui part : pas de relance de signature.
    expect((await envoisVers(email)).map((e) => e.template)).toEqual(["piece-exemplaire-signe"]);
  });

  test("(e) nouvelle version du contrat : l'envoi refuse tant que le résumé n'est pas écrit", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Dorian" });
    const avant = await prisma.documentGenere.count({ where: { trainerId: f.id } });
    const r = await pilote.appeler<{ error?: string; data?: unknown }>(
      CONTRAT,
      "envoyerNouvelleVersionAction",
      [{ trainerIds: [f.id] }],
      sc.console(),
    );
    expect(r.error ?? "").toMatch(/résumé des changements de la version \d+ n'est pas écrit/);
    expect(await prisma.documentGenere.count({ where: { trainerId: f.id } })).toBe(avant);
    expect(await envoisVers(f.email, "formateur-contrat-nouvelle-version")).toEqual([]);
  });

  test.fixme("V1-B-4 — nouvelle version « engageante » : F45, relances J+7 / J+21, « rester sur la version actuelle » ; « favorable » sans signature", async () => {
    // Attendu : une version marquée « favorable » s'applique sans signature ; une
    // version « engageante » part par F45, relancée à J+7 puis J+21, et l'espace
    // formateur propose « Je préfère rester sur la version actuelle ».
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, { prenom: "Elsa" });
    await pilote.appeler(
      CONTRAT,
      "envoyerNouvelleVersionAction",
      [{ trainerIds: [f.id] }],
      sc.console(),
    );
    expect(await envoisVers(f.email, "formateur-contrat-nouvelle-version")).toHaveLength(1);
  });

  test("(f) SIRET du contrat différent de la fiche : aucune mission", async () => {
    const { pilote, monde } = sc;
    const f = await creerFormateurPret(monde, {
      prenom: "Fabien",
      siretDuContrat: siretDeBanc(424_242),
    });
    const s = await creerSession(monde, { dansJours: 25 });
    const cartes = await pilote.appeler<{
      indisponibles: Array<{ trainerId: string; refus: Array<{ texte: string }> }>;
    }>(M.serviceChoix, "lireCartesChoix", [s.id, new Date()]);
    const carte = cartes.indisponibles.find((x) => x.trainerId === f.id);
    expect(carte?.refus.map((x) => x.texte)).toEqual([
      "Le SIRET inscrit dans le contrat-cadre signé n'est plus celui de la fiche : un contrat à jour doit être signé.",
    ]);
  });
});
