import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  autres: [] as Array<Record<string, unknown>>,
  maj: [] as Array<Record<string, unknown>>,
  envoyes: [] as Array<Record<string, unknown>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: unknown) => v,
  encryptPii: (v: unknown) => v,
}));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: (v: string) => v }));
vi.mock("../annuaire", () => ({ lireEntrepriseParSiren: vi.fn() }));
vi.mock("../envois", () => ({
  apercu: vi.fn(async (e: Record<string, unknown>) => ({ ...e, sujet: "s", html: "" })),
  avecTexteLibre: (p: Record<string, unknown>) => p,
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    return "envoye";
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    presentationEntreprise: {
      findUnique: vi.fn(async (a: { include?: unknown }) => {
        const base = {
          id: "P2",
          siren: "123456782",
          apporteurId: "APP2",
          statut: "reservee",
          contactEnvoyeAt: null,
          denomination: "Acme",
          recueAt: new Date("2026-10-01T00:00:00Z"),
          personneNom: "Durand",
          personneEmail: "d@acme.fr",
        };
        return a.include
          ? {
              ...base,
              apporteur: { id: "APP2", prenom: "Ana", nom: "Bel", email: "ana@x.fr" },
            }
          : base;
      }),
      findMany: vi.fn(async () => etat.autres),
      updateMany: vi.fn(async (a: Record<string, unknown>) => {
        etat.maj.push(a);
        return { count: 1 };
      }),
      update: vi.fn(async () => ({})),
    },
  },
}));

import {
  appliquerReponse,
  construireEnvoisReponse,
  dejaAttribueeAUnAutre,
  MESSAGE_DEJA_ATTRIBUEE,
} from "../presentations";

const dejaBienRecue = {
  apporteurId: "APP1",
  statut: "reservee" as const,
  contactEnvoyeAt: new Date("2026-09-20T00:00:00Z"),
};
const opts = { civilite: "" as const, nomFamille: "" };

beforeEach(() => {
  etat.autres = [];
  etat.maj = [];
  etat.envoyes = [];
});

describe("doublon « Bien reçu » : une entreprise déjà attribuée ne reçoit pas de seconde prise de contact", () => {
  it("règle pure : un autre apporteur déjà « Bien reçu » et en cours = attribuée", () => {
    expect(dejaAttribueeAUnAutre([dejaBienRecue], "APP2")).toBe(true);
    expect(
      dejaAttribueeAUnAutre([{ ...dejaBienRecue, statut: "confirmee" as const }], "APP2"),
    ).toBe(true);
  });
  it("règle pure : même apporteur, protection terminée ou refusée, pas encore contactée = libre", () => {
    expect(dejaAttribueeAUnAutre([dejaBienRecue], "APP1")).toBe(false);
    expect(dejaAttribueeAUnAutre([{ ...dejaBienRecue, statut: "terminee" as const }], "APP2")).toBe(
      false,
    );
    expect(
      dejaAttribueeAUnAutre([{ ...dejaBienRecue, statut: "deja_connue" as const }], "APP2"),
    ).toBe(false);
    expect(dejaAttribueeAUnAutre([{ ...dejaBienRecue, contactEnvoyeAt: null }], "APP2")).toBe(
      false,
    );
  });
  it("« Bien reçu » refusé avec un message clair, rien n'est écrit ni envoyé", async () => {
    etat.autres = [dejaBienRecue];
    const r = await appliquerReponse("P2", "bien_recu", opts);
    expect(r).toEqual({ ok: false, message: MESSAGE_DEJA_ATTRIBUEE });
    expect(MESSAGE_DEJA_ATTRIBUEE).toContain("déjà attribuée");
    expect(etat.maj).toEqual([]);
    expect(etat.envoyes).toEqual([]);
  });
  it("« Bien reçu » passe si aucune autre présentation n'est attribuée", async () => {
    const r = await appliquerReponse("P2", "bien_recu", opts);
    expect(r.ok).toBe(true);
    expect(etat.envoyes.map((e) => e.gabarit)).toEqual([
      "entreprise-prise-de-contact-apporteur",
      "apporteur-presentation-recue",
    ]);
  });
  it("« Pas disponible » : refus motivé « pas-disponible » à l'apporteur seul, jamais à l'entreprise", async () => {
    etat.autres = [dejaBienRecue];
    const r = await appliquerReponse("P2", "pas_disponible", opts);
    expect(r.ok).toBe(true);
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.envoyes[0]).toMatchObject({
      gabarit: "apporteur-presentation-refusee",
      destinataire: "ana@x.fr",
      payload: { motif: "pas-disponible" },
    });
    expect(etat.maj[0]).toMatchObject({ data: { statut: "deja_connue" } });
  });
  it("les autres refus gardent leur motif", () => {
    const d = {
      presentation: {
        id: "P2",
        denomination: "Acme",
        recueAt: new Date(),
        personneNom: "D",
        personneEmail: "d@acme.fr",
      },
      apporteur: { id: "APP2", prenom: "A", nom: "B", email: "a@b.fr" },
    };
    expect(construireEnvoisReponse(d, "deja_connue", opts)[0]!.payload.motif).toBe("deja-connue");
    expect(construireEnvoisReponse(d, "hors_champ", opts)[0]!.payload.motif).toBe("hors-champ");
  });
});
