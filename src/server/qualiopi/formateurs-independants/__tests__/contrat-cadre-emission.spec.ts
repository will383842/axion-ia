/**
 * Lot L7b — le service qui prépare le contrat-cadre : version ARRÊTÉE inscrite, pièce
 * originale rattachée à la fiche, aucun blanc imprimé, ancienne pièce jamais signée
 * remplacée APRÈS l'émission, jamais une pièce signée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  trainer: vi.fn(),
  contrats: vi.fn(),
  controles: vi.fn(),
  preuves: vi.fn(),
  annuler: vi.fn(),
  generer: vi.fn(),
  config: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: { findUnique: (...a: unknown[]) => d.trainer(...a) },
    documentGenere: {
      findMany: (...a: unknown[]) => d.contrats(...a),
      updateMany: (...a: unknown[]) => d.annuler(...a),
    },
    verificationRegistreSousTraitance: { findMany: (...a: unknown[]) => d.controles(...a) },
    preuveVigilance: { findMany: (...a: unknown[]) => d.preuves(...a) },
  },
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => d.generer(...a),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: (k: string) => d.config(k),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({
    raisonSociale: "Axion",
    nda: "84000000000",
    qualiopi: "",
    siret: "11111111100011",
    siren: "111111111",
    capitalSocial: "1000",
    rcsVille: "Ville",
    adresseSiege: "Siège",
    adresseExercice: "Siège",
    representantLegalNom: "Représentant",
    representantLegalQualite: "Président",
    email: "contact@exemple.fr",
    telephone: "",
    site: "",
  }),
}));
vi.mock("@/server/registre-entreprises/annuaire", () => ({
  lireEtablissementParSiret: vi.fn(),
}));

import { preparerContratCadre, MOTIF_CONTRAT_REMPLACE } from "../contrat-cadre-emission";

const ID = "00000000-0000-4000-8000-0000000000aa";
const SIRET = "12345678900011";
const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const HIER = new Date("2026-10-10T10:00:00Z");
const lire = async () =>
  ({
    ok: true,
    entreprise: {
      siren: "123456789",
      siret: SIRET,
      active: true,
      enrichissement: { estEntrepreneurIndividuel: true },
    },
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  d.trainer.mockResolvedValue({
    statut: "sous_traitant",
    organismeSousTraitantId: null,
    finCollaborationAt: null,
    prenom: "Camille",
    nom: "Exemple",
    email: "camille@exemple.fr",
    siret: SIRET,
    adresseProfessionnelle: "1 rue de l'Exemple",
    sousTraitantNda: "en cours",
    numeroTvaIntracom: null,
    documents: [
      {
        id: "p-1",
        type: "attestation_vigilance_urssaf",
        statutValidation: "valide",
        fichierUrl: "x",
        dateEmission: new Date("2026-10-01T00:00:00Z"),
        dateExpiration: null,
      },
    ],
  });
  d.contrats.mockResolvedValue([]);
  d.controles.mockResolvedValue([
    { verdict: "vert", source: "registre", verifieAt: HIER, createdAt: HIER, siret: SIRET },
  ]);
  d.preuves.mockResolvedValue([{ trainerDocumentId: "p-1", resultat: "valide" }]);
  d.config.mockImplementation(async (k: string) =>
    k === "nda_region" ? "Région" : k === "adresse_formateurs" ? "formateurs@exemple.fr" : "",
  );
  d.generer.mockResolvedValue({ id: "doc-neuf", numero: "AXI-FORM-2026-010" });
  d.annuler.mockResolvedValue({ count: 1 });
});

describe("preparerContratCadre", () => {
  it("émet la dernière version arrêtée, originale, rattachée à la fiche seule", async () => {
    const r = await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    expect(r).toEqual({
      ok: true,
      documentId: "doc-neuf",
      numero: "AXI-FORM-2026-010",
      version: 3,
      remplaces: 0,
    });
    const appel = d.generer.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(appel).toMatchObject({
      type: "contrat_sous_traitance",
      refs: { trainerId: ID },
      gabaritVersion: 3,
      estCopie: false,
    });
    expect(d.annuler).not.toHaveBeenCalled();
  });

  it("configuration d'Axion vide : refus nommant le champ, aucune pièce", async () => {
    d.config.mockResolvedValue("");
    const r = await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toMatch(/région de déclaration/);
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("registre muet : refus, aucune pièce", async () => {
    const r = await preparerContratCadre({
      trainerId: ID,
      maintenant: MAINTENANT,
      lire: async () => ({ ok: false }) as never,
    });
    expect(r.ok).toBe(false);
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("une v3 déjà émise : jamais refaite", async () => {
    d.contrats.mockResolvedValue([
      {
        id: "c",
        numero: "N",
        metadata: { renderData: { gabaritVersion: 3 } },
        statutSignature: "en_attente",
        annuleeAt: null,
        _count: { signatures: 0 },
      },
    ]);
    const r = await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    expect(r.ok).toBe(false);
    expect(d.generer).not.toHaveBeenCalled();
  });

  it("une v2 jamais signée est remplacée APRÈS l'émission ; la condition exclut toute pièce signée", async () => {
    d.contrats.mockResolvedValue([
      {
        id: "v2",
        numero: "N",
        metadata: { renderData: { gabaritVersion: 2 } },
        statutSignature: "en_attente",
        annuleeAt: null,
        _count: { signatures: 0 },
      },
    ]);
    const r = await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    expect(r).toMatchObject({ ok: true, remplaces: 1 });
    expect(d.generer.mock.invocationCallOrder[0]).toBeLessThan(
      d.annuler.mock.invocationCallOrder[0] as number,
    );
    expect(d.annuler).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ["v2"] },
        statutSignature: { not: "signee" },
        signatures: { none: { revokedAt: null } },
      }),
      data: expect.objectContaining({ annuleeMotif: MOTIF_CONTRAT_REMPLACE, annuleePar: "system" }),
    });
  });
});

describe("préparations simultanées", () => {
  it("une autre préparation a émis la même version juste avant : la nôtre est annulée", async () => {
    // 1re lecture (faits) : rien ; 2e lecture (après émission) : deux v3 vivantes.
    d.contrats.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "autre", metadata: { renderData: { gabaritVersion: 3 } } },
      { id: "doc-neuf", metadata: { renderData: { gabaritVersion: 3 } } },
    ]);
    const r = await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    expect(r.ok).toBe(false);
    expect(d.annuler).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "doc-neuf", annuleeAt: null }),
      data: expect.objectContaining({ annuleePar: "system" }),
    });
  });
});

describe("le contrat préparé se signe : le SIRET de l'instantané est relu par la signature", () => {
  it("la forme écrite par `generateDocument` donne le SIRET du contrat à `siretDuContrat`", async () => {
    const { siretDuContrat } =
      await import("@/server/qualiopi/documents/signature/contrat-cadre-signature");
    await preparerContratCadre({ trainerId: ID, maintenant: MAINTENANT, lire });
    const appel = d.generer.mock.calls[0]?.[0] as {
      buildElement: (n: string) => { props: { data: unknown; identite: unknown } };
      gabaritVersion: number;
    };
    const el = appel.buildElement("AXI-FORM-2026-010");
    // Miroir de l'instantané de `documents-service.ts` (renderData).
    const metadata = {
      renderData: JSON.parse(
        JSON.stringify({
          data: el.props.data,
          identite: el.props.identite,
          gabaritVersion: appel.gabaritVersion,
        }),
      ),
    };
    expect(siretDuContrat(metadata)).toBe(SIRET);
  });
});
