/**
 * S17 — l'export art. 15 d'une fiche INCLUT ses brouillons d'assistant de devis (sans coordonnées),
 * et seulement ceux de SA fiche.
 */
import { describe, expect, it, vi } from "vitest";

const appels = vi.hoisted(() => ({ brouillons: [] as unknown[] }));

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
});
