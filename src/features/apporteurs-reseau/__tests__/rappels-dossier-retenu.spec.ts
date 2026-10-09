/**
 * Rappels J+3 / J+7 quand le lien du dossier a voyagé dans l'e-mail « Retenu » (chemin principal :
 * journalisé sur la candidature `Submission`, pas sur l'apporteur). Le rappel part TOUJOURS avec le
 * gabarit `apporteur-dossier-lien` (`rappel` 1 puis 2), sans boucle, rien après J+14.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  retenuAt: null as Date | null,
  retenuBounce: null as string | null,
  envoyes: [] as Array<Record<string, unknown>>,
  dejaPartis: new Set<string>(),
}));

// Étape « avoirs-clients » (art. 4.5) : testée à part (avoir-client.spec.ts).
vi.mock("../avoir-client", () => ({ reprendreApresAvoirsClients: vi.fn(async () => ({})) }));
vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("../jeton", () => ({
  urlDossier: () => "https://exemple.test/apporteur/dossier/A1/jeton",
}));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async (jobId: string) => etat.dejaPartis.has(jobId)),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    etat.dejaPartis.add(String(e.jobId));
    return "envoye";
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: { findMany: vi.fn(async () => []) },
    factureFormation: { findMany: vi.fn(async () => []) },
    commissionApporteur: { findMany: vi.fn(async () => []), groupBy: vi.fn(async () => []) },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => []) },
    emailLog: {
      findMany: vi.fn(async (a: { where: { template: string } }) =>
        a.where.template === "apporteur-issue-retenu" && etat.retenuAt
          ? [
              {
                id: "RET1",
                sentAt: etat.retenuAt,
                jobId: "apporteur-issue-retenu-abc",
                bounceType: etat.retenuBounce,
              },
            ]
          : [],
      ),
    },
    apporteurReseau: {
      findMany: vi.fn(async (a: { where: { statut?: string } }) =>
        a.where.statut === "dossier_en_cours"
          ? [
              {
                id: "A1",
                prenom: "Ana",
                email: "ana@exemple.fr",
                versionLien: 1,
                submissionId: "SUB1",
              },
            ]
          : [],
      ),
    },
  },
}));

import { passerReseauApporteurs } from "../passage-quotidien";

const RETENU = new Date("2026-10-01T09:00:00Z");
const jour = (j: number) => new Date(RETENU.getTime() + j * 86_400_000 + 3_600_000);

beforeEach(() => {
  etat.retenuAt = RETENU;
  etat.retenuBounce = null;
  etat.envoyes = [];
  etat.dejaPartis = new Set();
});

describe("rappels du dossier : le lien arrivé par l'e-mail « Retenu »", () => {
  it("lien « Retenu » envoyé en J : un rappel à J+3, un autre à J+7, rien ensuite jusqu'à J+14 et après", async () => {
    const parJour: number[] = [];
    for (let j = 0; j <= 20; j += 1) {
      const avant = etat.envoyes.length;
      await passerReseauApporteurs(jour(j));
      if (etat.envoyes.length > avant) parJour.push(j);
    }
    expect(parJour).toEqual([3, 7]);
    expect(etat.envoyes.map((e) => e.gabarit)).toEqual([
      "apporteur-dossier-lien",
      "apporteur-dossier-lien",
    ]);
    expect(etat.envoyes.map((e) => (e.payload as { rappel: number }).rappel)).toEqual([1, 2]);
    expect(etat.envoyes.every((e) => e.entityType === "ApporteurReseau")).toBe(true);
    expect(String(etat.envoyes[0]!.jobId)).toContain("apporteur-dossier-rappel-A1-RET1-j3");
  });

  it("rien avant J+3", async () => {
    await passerReseauApporteurs(jour(2));
    expect(etat.envoyes).toEqual([]);
  });

  it("e-mail « Retenu » rebondi (adresse morte) : aucun rappel", async () => {
    etat.retenuBounce = "hard";
    await passerReseauApporteurs(jour(4));
    expect(etat.envoyes).toEqual([]);
  });

  it("aucun e-mail « Retenu » journalisé : rien", async () => {
    etat.retenuAt = null;
    await passerReseauApporteurs(jour(4));
    expect(etat.envoyes).toEqual([]);
  });
});
