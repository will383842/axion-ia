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
vi.mock("@/lib/prisma", () => {
  const prisma = {
    $transaction: async (f: (t: unknown) => unknown) => f(prisma),
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
  };
  return { prisma };
});

import {
  appliquerReponse,
  construireEnvoisReponse,
  dejaAttribueeAUnAutre,
  existeDeclarationPlusAncienne,
  MESSAGE_DECLARATION_PLUS_ANCIENNE,
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

describe("art. 3.5 : la déclaration la plus ancienne passe en premier", () => {
  const maintenant = new Date("2026-10-06T10:00:00Z");
  const moi = { apporteurId: "APP2", recueAt: new Date("2026-10-01T00:00:00Z") };
  const ancienne = {
    apporteurId: "APP1",
    statut: "reservee" as const,
    contactEnvoyeAt: null,
    recueAt: new Date("2026-09-25T00:00:00Z"),
    protegeeJusquAt: null,
  };

  it("règle pure : une déclaration plus ancienne d'un autre apporteur, encore en cours, prime", () => {
    expect(existeDeclarationPlusAncienne([ancienne], moi, maintenant)).toBe(true);
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ancienne, statut: "confirmee" as const, protegeeJusquAt: new Date("2027-01-01") }],
        moi,
        maintenant,
      ),
    ).toBe(true);
  });
  it("règle pure : plus récente, même apporteur, refusée ou protection échue = pas de priorité", () => {
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ancienne, recueAt: new Date("2026-10-03") }],
        moi,
        maintenant,
      ),
    ).toBe(false);
    expect(
      existeDeclarationPlusAncienne([{ ...ancienne, apporteurId: "APP2" }], moi, maintenant),
    ).toBe(false);
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ancienne, statut: "deja_connue" as unknown as "reservee" }],
        moi,
        maintenant,
      ),
    ).toBe(false);
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ancienne, statut: "confirmee" as const, protegeeJusquAt: new Date("2026-09-30") }],
        moi,
        maintenant,
      ),
    ).toBe(false);
  });
  it("« Bien reçu » sur la plus récente est refusé avec un message clair, rien n'est écrit ni envoyé", async () => {
    etat.autres = [ancienne];
    const r = await appliquerReponse("P2", "bien_recu", opts, maintenant);
    expect(r).toEqual({ ok: false, message: MESSAGE_DECLARATION_PLUS_ANCIENNE });
    expect(MESSAGE_DECLARATION_PLUS_ANCIENNE).toContain("plus ancienne");
    expect(etat.maj).toEqual([]);
    expect(etat.envoyes).toEqual([]);
  });
  it("la plus ancienne elle-même peut répondre « Bien reçu » (l'autre est plus récente)", async () => {
    etat.autres = [{ ...ancienne, recueAt: new Date("2026-10-03T00:00:00Z") }];
    const r = await appliquerReponse("P2", "bien_recu", opts, maintenant);
    expect(r.ok).toBe(true);
  });
  it("double clic simultané : la vérification et la prise de la ligne sont dans UNE transaction sérialisable", async () => {
    const { prisma } = await import("@/lib/prisma");
    const spy = vi.spyOn(prisma, "$transaction");
    await appliquerReponse("P2", "bien_recu", opts, maintenant);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![1]).toMatchObject({ isolationLevel: "Serializable" });
  });
  it("conflit de sérialisation (deux clics en même temps) : message de nouvelle tentative, rien n'est envoyé", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      Object.assign(new Error("write conflict"), { code: "P2034" }),
    );
    const r = await appliquerReponse("P2", "bien_recu", opts, maintenant);
    expect(r.ok).toBe(false);
    expect(etat.envoyes).toEqual([]);
  });
});

describe("« Pas disponible » : aucune promesse que la Société ne peut pas tenir", () => {
  it("le motif ne promet ni prévenance ni délai de 15 jours", async () => {
    const { COPY_DEMARRAGE } = await import("@/lib/email/templates/apporteur-demarrage");
    const m = COPY_DEMARRAGE.presentationRefusee.motif["pas-disponible"];
    expect(m).toContain("déjà suivie par Axion-IA");
    expect(m).toContain("nous ne pouvons pas la rattacher à votre déclaration");
    expect(m).not.toMatch(/préviendrons|15 jours|à nouveau/);
  });
  it("l'objet reste sous 45 caractères", async () => {
    const { COPY_DEMARRAGE } = await import("@/lib/email/templates/apporteur-demarrage");
    expect(
      COPY_DEMARRAGE.presentationRefusee.subject("Acme Industries").length,
    ).toBeLessThanOrEqual(45);
  });
});
