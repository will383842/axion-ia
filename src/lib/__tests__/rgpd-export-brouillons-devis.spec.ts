/**
 * S17 — l'export art. 15 d'une fiche INCLUT ses brouillons d'assistant de devis (sans coordonnées),
 * et seulement ceux de SA fiche.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const appels = vi.hoisted(() => ({
  brouillons: [] as unknown[],
  fusions: [] as Array<{ absorbeId: string; absorbantId: string; defaiteLe: Date | null }>,
}));

vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (e: string) => `h:${e}` }));
vi.mock("@/features/questionnaire-preaudit/portee-rgpd", () => ({
  envoisDuDirigeant: () => ({}),
  questionnairesDuDirigeant: () => ({}),
}));

vi.mock("@/lib/prisma", () => {
  const BROUILLONS = [
    {
      id: "b-1",
      clientId: "fiche-1",
      createdAt: new Date("2026-11-01"),
      updatedAt: new Date("2026-11-02"),
      statut: "en_cours",
      payload: { etape: 2 },
    },
    {
      id: "b-f0",
      clientId: "fiche-0",
      createdAt: new Date("2026-10-01"),
      updatedAt: new Date("2026-10-02"),
      statut: "en_cours",
      payload: { etape: 1 },
    },
    {
      id: "b-autre",
      clientId: "fiche-2",
      createdAt: new Date("2026-11-01"),
      updatedAt: new Date("2026-11-02"),
      statut: "en_cours",
      payload: {},
    },
  ];
  const vide = { findMany: async () => [] };
  const specifiques: Record<string, unknown> = {
    clientContactAdresse: { findMany: async () => [{ contactId: "contact-1" }] },
    clientContact: {
      findMany: async () => [
        {
          id: "contact-1",
          nom: "Alice",
          fonction: null,
          telephone: null,
          statut: "actif",
          partiLe: null,
          oppositionIaLe: null,
          clientId: "fiche-1",
          client: { raisonSociale: "SCI" },
          adresses: [{ email: "alice@exemple.fr", nature: "pro", emailHash: "h:alice@exemple.fr" }],
        },
      ],
    },
    clientFusion: {
      findMany: async (args: { where: { absorbantId: { in: string[] }; defaiteLe: null } }) =>
        appels.fusions.filter(
          (f) => args.where.absorbantId.in.includes(f.absorbantId) && f.defaiteLe === null,
        ),
    },
    devisAssistantBrouillon: {
      findMany: async (args: { where: { clientId: { in: string[] } } }) => {
        appels.brouillons.push(args);
        return BROUILLONS.filter((b) => args.where.clientId.in.includes(b.clientId));
      },
    },
  };
  return {
    prisma: new Proxy({}, { get: (_t, nom: string) => specifiques[nom] ?? vide }),
  };
});

import { exporterDossierClientPour } from "@/lib/rgpd-dossier-client";

describe("export art. 15 — brouillons de l'assistant de devis (S17)", () => {
  beforeEach(() => {
    appels.fusions = [];
  });

  it("rend les brouillons de SA fiche, sans coordonnées, et pas ceux d'une autre", async () => {
    const r = await exporterDossierClientPour("alice@exemple.fr");
    expect(r.avertissements).toEqual([]);
    expect(r.brouillonsDevis).toEqual([
      {
        id: "b-1",
        creeLe: new Date("2026-11-01"),
        modifieLe: new Date("2026-11-02"),
        statut: "en_cours",
        payload: { etape: 2 },
        ficheLien: "client:fiche-1",
      },
    ]);
    expect(JSON.stringify(r.brouillonsDevis)).not.toMatch(/@|telephone/);
  });

  it("fusion F0 dans F1 (fiche de la personne) puis export => brouillon de F0 inclus", async () => {
    appels.fusions = [{ absorbeId: "fiche-0", absorbantId: "fiche-1", defaiteLe: null }];
    const r = await exporterDossierClientPour("alice@exemple.fr");
    expect(r.brouillonsDevis.map((b) => b.id).sort()).toEqual(["b-1", "b-f0"]);
    expect(r.brouillonsDevis.find((b) => b.id === "b-f0")?.ficheLien).toBe("client:fiche-0");
    expect(JSON.stringify(r.brouillonsDevis)).not.toMatch(/@|telephone/);
  });

  it("fusion défaite, ou fiche absorbée dans la fiche d'une AUTRE personne => non inclus", async () => {
    appels.fusions = [
      { absorbeId: "fiche-0", absorbantId: "fiche-1", defaiteLe: new Date("2026-11-03") },
      { absorbeId: "fiche-0", absorbantId: "fiche-2", defaiteLe: null },
    ];
    const r = await exporterDossierClientPour("alice@exemple.fr");
    expect(r.brouillonsDevis.map((b) => b.id)).toEqual(["b-1"]);
  });
});
