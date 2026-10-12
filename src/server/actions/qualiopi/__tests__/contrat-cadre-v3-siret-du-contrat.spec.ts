/**
 * L7c — l'entreprise confirmée active doit être CELLE QUI CONTRACTE.
 *
 * Le contrat v3 porte son propre SIRET figé (`renderData.data.cocontractant.siret`,
 * rendu dans son texte). Si la fiche a changé de SIRET depuis l'émission (A
 * cessé → B actif), relire le registre sur B ne dit rien de A : aux TROIS portes
 * (demande de code, signature, contresignature), le contrat est refusé, sans code
 * envoyé ni signature écrite.
 *
 * Les actions réelles et l'objection RÉELLE (`objectionContratCadre`) ; seuls
 * sont doublés la base, le contrôle L4 (fidèle : il relit le SIRET de la fiche),
 * l'envoi du code et l'écriture de la preuve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SIRET_A = "11111111100011";
const SIRET_B = "22222222200022";

const h = vi.hoisted(() => ({
  siretContrat: "" as string | undefined,
  siretFiche: "",
  actifs: new Set<string>(),
  partie: "sous_traitant" as string,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: vi.fn(async () => ({
        type: "contrat_sous_traitance",
        numero: "AXI-DOC-2026-990",
        metadata: {
          renderData: {
            gabaritVersion: 3,
            // La forme réelle de l'instantané : le cocontractant vit sous `data`.
            data: {
              cocontractant: h.siretContrat === undefined ? {} : { siret: h.siretContrat },
            },
          },
        },
        trainerId: "t-1",
        trainer: { email: "alex@exemple.fr", prenom: "Alex", siret: h.siretFiche },
      })),
    },
    documentSignature: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => [{ partie: "sous_traitant" }]),
    },
    verificationRegistreSousTraitance: { findMany: vi.fn(async () => []) },
    // Dossier complet (attestation prouvée, pièces validées) : la porte de
    // contresignature ne s'arrête que sur le SIRET, objet de ce spec.
    trainer: {
      findUnique: vi.fn(async () => {
        const piece = {
          fichierUrl: "r2://piece",
          dateEmission: new Date(Date.now() - 30 * 24 * 3600 * 1000),
          dateExpiration: null,
          statutValidation: "valide",
        };
        return {
          statut: "sous_traitant",
          documents: [
            { ...piece, id: "att", type: "attestation_vigilance_urssaf" },
            { ...piece, id: "cv", type: "cv" },
            { ...piece, id: "rib", type: "rib" },
          ],
        };
      }),
    },
    preuveVigilance: {
      findMany: vi.fn(async () => [{ trainerDocumentId: "att", resultat: "valide" }]),
    },
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/controle", () => ({
  SOURCE_REGISTRE: "registre_entreprises+liste_of",
  // Comme le vrai : interroge le registre sur le SIRET DE LA FICHE.
  controlerRegistreFormateur: vi.fn(async () => {
    const actif = h.actifs.has(h.siretFiche);
    return {
      ok: true,
      verdict: actif ? "vert" : "rouge",
      motifs: actif ? [] : ["siren_cesse"],
      siret: h.siretFiche,
    };
  }),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  verifierTokenDocument: vi.fn(async () => ({
    ok: true,
    tokenId: "tok",
    documentGenereId: "11111111-1111-4111-8111-111111111111",
    partie: "sous_traitant",
    signataireNom: "Alex Durand",
    signataireEmail: "alex@exemple.fr",
    signataireQualite: null,
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(async () => ({
    ok: true,
    signatureId: "s",
    selfHash: "a",
    statutSignature: "partielle",
  })),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: vi.fn(async () => ({ ip: null, userAgent: null })),
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

import { verifierCodeSignature } from "@/server/qualiopi/documents/signature/code-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { controlerRegistreFormateur } from "@/server/qualiopi/formateurs-independants/controle";
import { envoyerCodeSignature } from "@/server/qualiopi/formateurs-independants/code-signature-envoi";

import {
  contresignerPieceAction,
  demanderCodeSignatureAction,
  signerPieceParJetonAction,
} from "../piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const mEnvoyer = envoyerCodeSignature as unknown as Mock;
const mSigner = signerDocument as unknown as Mock;
const mCode = verifierCodeSignature as unknown as Mock;
const mControler = controlerRegistreFormateur as unknown as Mock;

const DOC = "11111111-1111-4111-8111-111111111111";
const INTERDITS =
  /poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble/i;

const demander = () => demanderCodeSignatureAction({ token: "jeton" });
const signer = () =>
  signerPieceParJetonAction({ token: "jeton", methode: "confirmation_accessible", code: "123456" });
const contresigner = () =>
  contresignerPieceAction({ documentGenereId: DOC, methode: "confirmation_accessible" });

beforeEach(() => {
  vi.clearAllMocks();
  h.actifs = new Set([SIRET_B]);
});

describe("🔴 contrat au SIRET A (cessé), fiche corrigée vers le SIRET B (actif)", () => {
  beforeEach(() => {
    h.siretContrat = SIRET_A;
    h.siretFiche = SIRET_B;
  });

  it("demande de code : refus, aucun code envoyé, registre non relu", async () => {
    const r = await demander();
    expect(r).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    const message = (r as { message: string }).message;
    expect(message).toMatch(/n'est plus celui de votre dossier/);
    expect(message).toMatch(/contrat à jour/);
    expect(message).not.toMatch(INTERDITS);
    expect(mEnvoyer).not.toHaveBeenCalled();
    expect(mControler).not.toHaveBeenCalled();
  });

  it("signature : refus, code non consommé, rien n'est signé", async () => {
    const r = await signer();
    expect(r).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect((r as { message: string }).message).not.toMatch(INTERDITS);
    expect(mCode).not.toHaveBeenCalled();
    expect(mSigner).not.toHaveBeenCalled();
    expect(mControler).not.toHaveBeenCalled();
  });

  it("contresignature : refus, rien n'est signé", async () => {
    const r = await contresigner();
    expect(r).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect((r as { message: string }).message).toMatch(/Contresignature impossible/);
    expect((r as { message: string }).message).not.toMatch(INTERDITS);
    expect(mSigner).not.toHaveBeenCalled();
    expect(mControler).not.toHaveBeenCalled();
  });
});

describe("🔴 contrat sans SIRET lisible : refusé aux trois portes", () => {
  it.each([[undefined], [""], ["1234"], ["ABCDEFGHIJKLMN"]])("SIRET du contrat %j", async (s) => {
    h.siretContrat = s;
    h.siretFiche = SIRET_B;
    expect(await demander()).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(await signer()).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(await contresigner()).toMatchObject({
      ok: false,
      raison: "piece_non_signable_maintenant",
    });
    expect(mEnvoyer).not.toHaveBeenCalled();
    expect(mSigner).not.toHaveBeenCalled();
  });
});

describe("même SIRET au contrat et à la fiche", () => {
  it("🔴 SIRET cessé : refus aux trois portes, même s'il est identique", async () => {
    h.siretContrat = SIRET_A;
    h.siretFiche = SIRET_A;
    expect(await demander()).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(await signer()).toMatchObject({ ok: false, raison: "piece_non_signable_maintenant" });
    expect(await contresigner()).toMatchObject({
      ok: false,
      raison: "piece_non_signable_maintenant",
    });
    expect(mEnvoyer).not.toHaveBeenCalled();
    expect(mSigner).not.toHaveBeenCalled();
  });

  it("nominal (SIRET actif confirmé, espaces ignorés) : code envoyé, signé UNE fois, contresigné", async () => {
    h.siretContrat = "222 222 222 00022";
    h.siretFiche = SIRET_B;

    expect(await demander()).toMatchObject({ ok: true });
    expect(mEnvoyer).toHaveBeenCalledTimes(1);

    expect((await signer()).ok).toBe(true);
    expect(mCode).toHaveBeenCalledTimes(1);
    expect(mSigner).toHaveBeenCalledTimes(1);
    expect(mSigner.mock.calls[0]?.[0]).toMatchObject({
      consentementVersion: "doc-consent-code-v1",
    });

    expect((await contresigner()).ok).toBe(true);
    expect(mSigner).toHaveBeenCalledTimes(2);
    expect(mSigner.mock.calls[1]?.[0]).toMatchObject({
      porteur: { type: "organisme_authentifie", adminId: "admin-1", partie: "axionia" },
    });
  });

  it("🔴 la fiche change de SIRET PENDANT le contrôle : la preuve ne porte pas sur le contrat → refus", async () => {
    h.siretContrat = SIRET_B;
    h.siretFiche = SIRET_B;
    mControler.mockImplementationOnce(async () => ({
      ok: true,
      verdict: "vert",
      motifs: [],
      siret: "33333333300033",
    }));
    expect(await contresigner()).toMatchObject({
      ok: false,
      raison: "piece_non_signable_maintenant",
    });
    expect(mSigner).not.toHaveBeenCalled();
  });
});
