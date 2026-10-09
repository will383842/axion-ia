// @vitest-environment node

/**
 * L'EXPORT ART. 15 LISTE LES FICHIERS RENVOYÉS PAR LE CANDIDAT (relecture sécurité, 2026-10-08, L5b).
 *
 * Le fichier qu'une personne renvoie par son lien privé est une donnée de son
 * dossier : l'export le nomme (nom, date, taille) et dit comment en obtenir une
 * copie — sur demande à contact@axion-ia.com. Les octets ne sortent pas dans
 * l'export (des Go de vidéo), ni la clé du stockage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  whereFichiers: null as unknown,
  fichiers: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findMany: async (a: { where: Record<string, unknown> }) => {
        if ("emailHash" in a.where) {
          return a.where["emailHash"] === null
            ? []
            : [{ id: "c-1", cvStoragePath: null, photoStoragePath: null }];
        }
        return [
          {
            id: "c-1",
            offerTitleSnap: "Monteur vidéo",
            firstName: "Alice",
            lastName: "Martin",
            email: "alice@example.com",
            phone: null,
          },
        ];
      },
    },
    jobApplicationInboundReply: { findMany: async () => [] },
    lienPartage: {
      findMany: async () => [{ id: "lien-1", applicationId: "c-1" }],
    },
    fichierPartage: {
      findMany: async (a: { where: unknown }) => {
        d.whereFichiers = a.where;
        return d.fichiers;
      },
    },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: vi.fn() }));
vi.mock("@/server/careers/videos-candidat", () => ({ supprimerVideosCandidature: vi.fn() }));
vi.mock("@/server/partages/effacement-candidat", () => ({
  effacerFichiersRenvoyesCandidature: vi.fn(),
}));

import { exporterCandidaturesPour } from "@/server/careers/candidature-rgpd";

beforeEach(() => {
  process.env["PII_ENCRYPTION_KEY"] = "b".repeat(64);
  d.fichiers = [
    {
      lienDepotId: "lien-1",
      nomFichier: "Montage Alice v2.mp4",
      tailleOctets: BigInt(123_456_789),
      creeLe: new Date("2026-10-08T09:00:00Z"),
      disponibleLe: new Date("2026-10-08T09:30:00Z"),
    },
  ];
});

describe("export art. 15 — fichiers renvoyés par le lien", () => {
  it("nom, date, taille, et la copie se demande à contact@axion-ia.com", async () => {
    const { candidatures } = await exporterCandidaturesPour("alice@example.com");
    expect(d.whereFichiers).toEqual({ origine: "personne", lienDepotId: { in: ["lien-1"] } });
    expect(candidatures[0]!["fichiersRenvoyes"]).toEqual([
      {
        nom: "Montage Alice v2.mp4",
        recuLe: new Date("2026-10-08T09:30:00Z"),
        tailleOctets: 123_456_789,
        copie: "copie sur demande à contact@axion-ia.com",
      },
    ]);
    // Ni la clé du stockage, ni les octets.
    expect(JSON.stringify(candidatures)).not.toMatch(/r2Cle|partages\//);
  });

  it("aucun fichier renvoyé → liste vide", async () => {
    d.fichiers = [];
    const { candidatures } = await exporterCandidaturesPour("alice@example.com");
    expect(candidatures[0]!["fichiersRenvoyes"]).toEqual([]);
  });
});
