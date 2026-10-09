import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.7 (art. 3.2 et 3.7) : la personne qui a rencontré l'entreprise pour le compte de
// l'apporteur (associé, salarié) est FACULTATIVE dans la déclaration ; vide = l'apporteur lui-même.
// Si elle est renseignée, la prise de contact la cite. Nom chiffré.

vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
const h = vi.hoisted(() => ({
  creees: [] as Array<Record<string, unknown>>,
  lues: [] as Array<{ presentationId: string; personne: string }>,
  creerPresentation: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: async () => ({ statut: "signe", prenom: "x", nom: "y" }) },
    presentationEntreprise: { findMany: async () => [] },
    presentationRencontre: {
      create: async (a: { data: Record<string, unknown> }) => {
        h.creees.push(a.data);
        return {};
      },
      findMany: async () => h.lues,
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `chiffre:${v}`,
  decryptPii: (v: string | null) => (v ? v.replace(/^chiffre:/, "") : v),
}));
vi.mock("../presentations", () => ({
  creerPresentation: (...a: unknown[]) => h.creerPresentation(...a),
  nomComplet: () => "Éloïse Lefèvre",
  presentationOccupe: () => false,
}));
vi.mock("../envois", () => ({ envoyer: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({})) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import { declarerEntreprise } from "../declaration-entreprise";
import { validerDeclaration } from "../declaration-regles";
import { lirePersonnesRencontrees } from "../personne-rencontre";

const MAINTENANT = new Date("2026-10-09T10:00:00Z");
const BONNE = {
  siret: "73282932000074",
  denomination: "Boulangerie Martin",
  personneNom: "Claire Durand",
  personneFonction: "Gérante",
  personneEmail: "claire@exemple.fr",
  personneTelephone: "06 12 34 56 78",
  dateContact: "2026-10-01",
};

beforeEach(() => {
  h.creees = [];
  h.lues = [];
  h.creerPresentation.mockResolvedValue({ ok: true, id: "p1" });
});

describe("déclaration : champ facultatif", () => {
  it("absent ou vide : la déclaration est valide, rien n'est enregistré", async () => {
    expect(validerDeclaration(BONNE, MAINTENANT).ok).toBe(true);
    expect(validerDeclaration({ ...BONNE, personneRencontre: "  " }, MAINTENANT).ok).toBe(true);
    expect(await declarerEntreprise("A1", BONNE, MAINTENANT)).toEqual({ ok: true });
    expect(h.creees).toEqual([]);
  });

  it("renseigné : enregistré CHIFFRÉ, rattaché à la présentation", async () => {
    expect(
      await declarerEntreprise("A1", { ...BONNE, personneRencontre: " Paul Associé " }, MAINTENANT),
    ).toEqual({ ok: true });
    expect(h.creees).toEqual([{ presentationId: "p1", personne: "chiffre:Paul Associé" }]);
  });

  it("trop long : refusé avec un message clair", () => {
    const r = validerDeclaration({ ...BONNE, personneRencontre: "x".repeat(151) }, MAINTENANT);
    expect(r).toEqual({
      ok: false,
      message: "Le nom de la personne qui a rencontré l'entreprise est trop long.",
    });
  });

  it("lecture : le nom est déchiffré", async () => {
    h.lues = [{ presentationId: "p1", personne: "chiffre:Paul Associé" }];
    expect((await lirePersonnesRencontrees(["p1"])).get("p1")).toBe("Paul Associé");
  });
});
