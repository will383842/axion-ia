/**
 * Correctif de relecture du lot B — UNE seule porte pour contresigner le
 * contrat-cadre d'un formateur indépendant.
 *
 * Le contrat créé dans le dossier n'exige plus l'attestation URSSAF à sa création.
 * Avant ce correctif, « Contresigner » (pièce ou lot, page « À traiter ») ne
 * relisait que le registre : le contrat se concluait sans attestation vérifiée,
 * puis l'après-signature (M15) marquait le dossier « vérifié ».
 *
 * Un test par chemin de contresignature :
 *   · `contresignerPieceAction` (bouton « Contresigner » d'une pièce) ;
 *   · `contresignerParLotAction` (page « À traiter ») ;
 *   · `signerPieceParJetonAction` avec un jeton qui porterait `axionia` ;
 *   · W-4 : voir `lot-b-w4-passe-par-la-porte-commune.spec.ts`.
 *
 * Les actions réelles, la porte réelle et l'objection registre réelle ; seuls sont
 * doublés la base, le contrôle L4, le moteur de signature et l'après-signature.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SIRET = "11111111100011";
const MAINTENANT = new Date();
const IL_Y_A_UN_MOIS = new Date(MAINTENANT.getTime() - 30 * 24 * 3600 * 1000);

const h = vi.hoisted(() => ({
  type: "contrat_sous_traitance",
  // Étape 3 du C4 : la version en vigueur (dernière arrêtée) est la v4.
  version: 4,
  annuleeAt: null as Date | null,
  signeeParFormateur: true,
  attestationProuvee: false,
  documents: [] as unknown[],
  partieJeton: "axionia",
  dossierStatut: "a_verifier" as string | null,
}));

function documents(): unknown[] {
  const base = {
    fichierUrl: "r2://piece",
    dateEmission: IL_Y_A_UN_MOIS,
    dateExpiration: null,
  };
  return [
    { ...base, id: "att", type: "attestation_vigilance_urssaf", statutValidation: "valide" },
    { ...base, id: "cv", type: "cv", statutValidation: "valide" },
    { ...base, id: "rib", type: "rib", statutValidation: "valide" },
  ];
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: vi.fn(async () => ({
        type: h.type,
        numero: "CST-2026-001",
        metadata: {
          renderData: { gabaritVersion: h.version, data: { cocontractant: { siret: SIRET } } },
        },
        trainerId: "t-1",
        annuleeAt: h.annuleeAt,
        trainer: { email: "alex@exemple.fr", prenom: "Alex", siret: SIRET },
      })),
    },
    documentSignature: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => (h.signeeParFormateur ? [{ partie: "sous_traitant" }] : [])),
    },
    trainer: {
      findUnique: vi.fn(async () => ({
        statut: "sous_traitant",
        dossierStatut: h.dossierStatut,
        documents: h.documents,
      })),
    },
    preuveVigilance: {
      findMany: vi.fn(async () =>
        h.attestationProuvee ? [{ trainerDocumentId: "att", resultat: "valide" }] : [],
      ),
    },
    verificationRegistreSousTraitance: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  SOURCE_REGISTRE: "registre_entreprises+liste_of",
  controlerRegistreFormateur: vi.fn(async () => ({
    ok: true,
    verdict: "vert",
    motifs: [],
    siret: SIRET,
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(async () => ({
    ok: true,
    tokenId: "tok",
    documentGenereId: "11111111-1111-4111-8111-111111111111",
    partie: h.partieJeton,
    signataireNom: "Quelqu'un",
    signataireEmail: "q@exemple.fr",
    signataireQualite: null,
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(async () => ({
    ok: true,
    signatureId: "s",
    selfHash: "a",
    statutSignature: "signee",
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/formateurs-independants/dossier-verifie", () => ({
  marquerDossierVerifie: vi.fn(async () => true),
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: vi.fn(async () => ({ ipHash: null, userAgent: null })),
}));
vi.mock("@/server/qualiopi/documents/signature/code-signature", () => ({
  verifierCodeSignature: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/qualiopi/formateurs-independants/code-signature-envoi", () => ({
  envoyerCodeSignature: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/qualiopi/documents/signature/garde-engagement", () => ({
  peutSignerPourOrganisme: () => true,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "admin" })),
  logQualiopiActivity: vi.fn(),
}));

import { apresSignature } from "@/server/qualiopi/documents/signature/apres-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { controlerRegistreFormateur } from "@/server/qualiopi/formateurs-independants/controle";
import { marquerDossierVerifie } from "@/server/qualiopi/formateurs-independants/dossier-verifie";
import {
  MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE,
  objectionContresignatureContratCadre,
} from "@/server/qualiopi/formateurs-independants/garde-contresignature-contrat-cadre";

import {
  contresignerParLotAction,
  contresignerPieceAction,
  signerPieceParJetonAction,
} from "../piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mSigner = signerDocument as unknown as Mock;
const mApres = apresSignature as unknown as Mock;
const mVerifie = marquerDossierVerifie as unknown as Mock;
const mRegistre = controlerRegistreFormateur as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ATTESTATION =
  "Vérifiez d'abord l'attestation URSSAF (écran Vérifier et contresigner).";

const contresignerUne = () =>
  contresignerPieceAction({ documentGenereId: DOC, methode: "confirmation_accessible" });
const contresignerLot = () =>
  contresignerParLotAction({ ids: [DOC], methode: "confirmation_accessible" });
const signerParJeton = () =>
  signerPieceParJetonAction({ token: "jeton", methode: "confirmation_accessible" });

function rienNEstEcrit(): void {
  expect(mSigner).not.toHaveBeenCalled();
  expect(mApres).not.toHaveBeenCalled();
  expect(mVerifie).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.type = "contrat_sous_traitance";
  h.version = 4;
  h.annuleeAt = null;
  h.signeeParFormateur = true;
  h.attestationProuvee = false;
  h.documents = documents();
  h.partieJeton = "axionia";
  h.dossierStatut = "a_verifier";
});

describe("C4 — la contresignature, par tout chemin, exige un dossier envoyé", () => {
  it.each(["en_cours", "a_completer"])(
    "dossier « %s » : refus depuis la fiche et par lot, rien n'est écrit",
    async (statut) => {
      h.dossierStatut = statut;
      expect(await contresignerUne()).toEqual({
        ok: false,
        raison: "piece_non_signable_maintenant",
        message: MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE.dossier,
      });
      const lot = await contresignerLot();
      expect(lot).toMatchObject({ ok: true, signees: 0, refusees: 1 });
      rienNEstEcrit();
    },
  );
});

describe("🔴 contrat v3 signé par le formateur, attestation URSSAF non prouvée", () => {
  it("« Contresigner » d'une pièce : refus qui renvoie vers W-4, rien n'est écrit", async () => {
    const r = await contresignerUne();
    expect(r).toEqual({
      ok: false,
      raison: "piece_non_signable_maintenant",
      message: MESSAGE_ATTESTATION,
    });
    rienNEstEcrit();
    // Le registre n'est pas relu pour un dossier incomplet : aucune ligne de preuve.
    expect(mRegistre).not.toHaveBeenCalled();
  });

  it("contresignature par lot (« À traiter ») : la pièce est refusée, rien n'est écrit", async () => {
    const r = await contresignerLot();
    expect(r).toMatchObject({ ok: true, signees: 0, refusees: 1 });
    if (!r.ok) throw new Error("lot refusé");
    expect(r.resultats[0]).toMatchObject({ ok: false, message: MESSAGE_ATTESTATION });
    rienNEstEcrit();
  });

  it("lien à jeton portant `axionia` : la même porte refuse avant le moteur", async () => {
    const r = await signerParJeton();
    expect(r).toMatchObject({ ok: false, message: MESSAGE_ATTESTATION });
    rienNEstEcrit();
  });
});

describe("✅ la même pièce, attestation prouvée et pièces validées", () => {
  beforeEach(() => {
    h.attestationProuvee = true;
  });

  it("« Contresigner » d'une pièce passe, après le registre relu en direct", async () => {
    const r = await contresignerUne();
    expect(r).toMatchObject({ ok: true, statutSignature: "signee" });
    expect(mRegistre).toHaveBeenCalledTimes(1);
    expect(mSigner).toHaveBeenCalledTimes(1);
    expect(mApres).toHaveBeenCalledTimes(1);
  });

  it("la contresignature par lot passe", async () => {
    const r = await contresignerLot();
    expect(r).toMatchObject({ ok: true, signees: 1, refusees: 0 });
    expect(mSigner).toHaveBeenCalledTimes(1);
  });
});

describe("🔴 les autres contrôles de la porte", () => {
  beforeEach(() => {
    h.attestationProuvee = true;
  });

  it("CV manquant : refus, pièces à valider", async () => {
    h.documents = documents().filter((d) => (d as { type: string }).type !== "cv");
    const r = await contresignerUne();
    expect(r).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect((r as { message: string }).message).toMatch(/Validez d'abord les pièces/);
    expect((r as { message: string }).message).toMatch(/Vérifier et contresigner/);
    rienNEstEcrit();
  });

  it("RIB en attente de validation : refus", async () => {
    h.documents = documents().map((d) =>
      (d as { type: string }).type === "rib"
        ? { ...(d as object), statutValidation: "en_attente" }
        : d,
    );
    const r = await contresignerUne();
    expect((r as { message: string }).message).toMatch(/Validez d'abord les pièces/);
    rienNEstEcrit();
  });

  it("RC pro déposée mais non validée : refus", async () => {
    h.documents = [
      ...documents(),
      {
        id: "rc",
        type: "assurance_rc_pro",
        statutValidation: "en_attente",
        fichierUrl: "r2://rc",
        dateEmission: IL_Y_A_UN_MOIS,
        dateExpiration: null,
      },
    ];
    const r = await contresignerUne();
    expect((r as { message: string }).message).toMatch(/Validez d'abord les pièces/);
    rienNEstEcrit();
  });

  it("contrat non signé par le formateur : refus", async () => {
    h.signeeParFormateur = false;
    const r = await contresignerUne();
    expect(r).toMatchObject({ ok: false });
    rienNEstEcrit();
  });

  it("la porte elle-même refuse un contrat non signé, pour CETTE raison-là", async () => {
    // Relecture #1513 (2e tour) : par l'action, le cas ci-dessus est refusé plus
    // tôt par l'ordre de signature du moteur, et resterait vert sans le contrôle
    // de la porte. On interroge donc la porte seule : dossier par ailleurs
    // complet, attestation prouvée, registre vert.
    h.signeeParFormateur = false;
    const r = await objectionContresignatureContratCadre({
      documentGenereId: DOC,
      type: "contrat_sous_traitance",
      metadata: { renderData: { gabaritVersion: 4, data: { cocontractant: { siret: SIRET } } } },
    });
    expect(r).toEqual({ message: MESSAGES_CONTRESIGNATURE_CONTRAT_CADRE.nonSigne });
  });

  it("contrat d'une version qui n'est pas en vigueur : refus", async () => {
    // Étape 3 du C4 : une v3 signée par le formateur mais pas contresignée n'est plus en
    // vigueur — la v4 lui est présentée.
    h.version = 3;
    const r = await contresignerUne();
    expect((r as { message: string }).message).toMatch(/version en vigueur/);
    rienNEstEcrit();
  });

  it("contrat annulé : refus", async () => {
    h.annuleeAt = new Date();
    const r = await contresignerUne();
    expect((r as { message: string }).message).toMatch(/annulé/);
    rienNEstEcrit();
  });
});

describe("rien ne change pour les autres pièces", () => {
  it("contrat-cadre v2 (antérieur au circuit v3) : aucune lecture du dossier, contresigné comme avant", async () => {
    h.version = 2;
    const r = await contresignerUne();
    expect(r).toMatchObject({ ok: true });
    expect(mRegistre).not.toHaveBeenCalled();
  });
});
