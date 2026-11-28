// Pendant les 15 jours du premier rang, « Bien reçu » sur la déclaration d'un TIERS est refusé (message de console) ;
// il est accepté pour le premier rang lui-même. Passe par `appliquerReponse` et le vrai `fenetreOuverteParUnAutre`.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { correspond, D } from "./file-attente-faux";

const m = vi.hoisted(() => ({
  apporteur: "TIERS",
  file: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
vi.mock("../apercu-envoi", () => ({ apercu: vi.fn() }));
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(
        ids.map((id) => [id, { siret: "12345678200017", entreprise: false, exclus: [] }] as const),
      ),
  };
});
vi.mock("../envois", () => ({
  avecTexteLibre: (p: Record<string, unknown>) => p,
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    m.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (f: (t: unknown) => unknown) => f(prisma),
    presentationReservation: { findMany: vi.fn(async () => []) },
    declarationEnAttente: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) =>
        m.file.filter((l) => correspond(l, a.where)),
      ),
    },
    presentationEntreprise: {
      findUnique: vi.fn(async (a: { include?: unknown }) => {
        const base = {
          id: "P2",
          siren: "123456782",
          apporteurId: m.apporteur,
          statut: "reservee",
          contactEnvoyeAt: null,
          denomination: "Acme",
          recueAt: new Date("2026-12-02T00:00:00Z"),
          personneNom: "Durand",
          personneEmail: "d@acme.fr",
        };
        return a.include
          ? {
              ...base,
              apporteur: { id: m.apporteur, prenom: "Ana", nom: "Bel", email: "ana@x.fr" },
            }
          : base;
      }),
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
  };
  return { prisma };
});

import { MESSAGE_FENETRE_PREMIER_RANG, appliquerReponse } from "../presentations";

const o = { civilite: "" as const, nomFamille: "" };
const PENDANT = D("2026-12-10T09:00:00Z");

beforeEach(() => {
  m.envoyes = [];
  m.file = [
    {
      id: "F1",
      presentationId: "P1",
      apporteurId: "PREMIER",
      siren: "123456782",
      siret: "12345678200017",
      cleFile: "12345678200017",
      statut: "informee",
      recueAt: D("2026-11-01T10:00:00Z"),
      informeeAt: D("2026-12-01T09:00:00Z"),
      fenetreFinAt: D("2026-12-15T22:59:59.999Z"),
    },
  ];
});

describe("file-attente-fenetre-bloque-les-autres", () => {
  it("« Bien reçu » d'un tiers est refusé pendant la fenêtre, sans nommer personne", async () => {
    m.apporteur = "TIERS";
    const r = await appliquerReponse("P2", "bien_recu", o, PENDANT);
    expect(r).toEqual({ ok: false, message: MESSAGE_FENETRE_PREMIER_RANG });
    expect(MESSAGE_FENETRE_PREMIER_RANG).toContain("quinze jours");
    expect(m.envoyes).toHaveLength(0);
  });

  it("« Bien reçu » est accepté pour le premier rang", async () => {
    m.apporteur = "PREMIER";
    const r = await appliquerReponse("P2", "bien_recu", o, PENDANT);
    expect(r.ok).toBe(true);
  });

  it("la fenêtre passée, le tiers n'est plus bloqué", async () => {
    m.apporteur = "TIERS";
    const r = await appliquerReponse("P2", "bien_recu", o, D("2026-12-16T09:00:00Z"));
    expect(r.ok).toBe(true);
  });
});
