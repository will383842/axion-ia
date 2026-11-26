// Lot 7b — le branchement des textes « validation par rendez-vous ».
//
// Preuve centrale : rien ne change tant que `APPORTEURS_VALIDATION_RDV` n'est pas exactement
// « true » ET que le contrat signé n'est pas ≥ 2.8. Sinon, les apporteurs gardent EXACTEMENT les
// envois actuels (« 30 jours »). Et l'information à l'entreprise n'est jamais envoyée.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  signature: null as unknown,
  envoyes: [] as Array<Record<string, unknown>>,
  apercus: [] as Array<Record<string, unknown>>,
}));

vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
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
vi.mock("../apercu-envoi", () => ({
  apercu: vi.fn(async (e: Record<string, unknown>) => {
    etat.apercus.push(e);
    return { ...e, sujet: "s", html: "" };
  }),
}));
vi.mock("../envois", () => ({
  avecTexteLibre: (p: Record<string, unknown>, t?: string) => (t ? { ...p, texteLibre: t } : p),
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
          recueAt: new Date("2026-11-25T10:00:00Z"),
          personneNom: "Durand",
          personneEmail: "d@acme.fr",
        };
        return a.include
          ? {
              ...base,
              apporteur: {
                id: "APP2",
                prenom: "Ana",
                nom: "Bel",
                email: "ana@x.fr",
                signatureApporteur: etat.signature,
              },
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

import { appliquerReponse, apercuReponse, construireEnvoisReponse } from "../presentations";

const opts = { civilite: "" as const, nomFamille: "" };
const donnees = {
  presentation: {
    id: "P2",
    denomination: "Acme",
    recueAt: new Date("2026-11-25T10:00:00Z"),
    personneNom: "Durand",
    personneEmail: "d@acme.fr",
  },
  apporteur: { id: "APP2", prenom: "Ana", nom: "Bel", email: "ana@x.fr" },
};

const ACTUEL = ["entreprise-prise-de-contact-apporteur", "apporteur-presentation-recue"];
const RENDEZ_VOUS = [
  "entreprise-prise-de-contact-apporteur",
  "apporteur-presentation-recue-rendez-vous",
];

const ancienEnv = process.env.APPORTEURS_VALIDATION_RDV;
beforeEach(() => {
  etat.envoyes = [];
  etat.apercus = [];
  etat.signature = null;
  delete process.env.APPORTEURS_VALIDATION_RDV;
});
afterEach(() => {
  if (ancienEnv === undefined) delete process.env.APPORTEURS_VALIDATION_RDV;
  else process.env.APPORTEURS_VALIDATION_RDV = ancienEnv;
});

describe("construireEnvoisReponse : la règle choisit l'accusé", () => {
  it("sans règle (ou règle nulle) : les envois actuels, payload compris, inchangés", () => {
    const sans = construireEnvoisReponse(donnees, "bien_recu", opts);
    const nulle = construireEnvoisReponse({ ...donnees, regle: null }, "bien_recu", opts);
    expect(nulle).toEqual(sans);
    expect(sans.map((e) => e.gabarit)).toEqual(ACTUEL);
    expect(sans[1]!.payload).toEqual({
      contactName: "Ana Bel",
      entreprise: "Acme",
      datePresentation: expect.any(String),
      personnePresentee: "Durand",
    });
    expect(sans[1]!.jobId).toBe("apporteur-presentation-recue-P2");
  });

  it("règle « rendez_vous » : l'accusé 60 jours, avec la fin de réservation (fin du 60e jour, N1)", () => {
    const e = construireEnvoisReponse({ ...donnees, regle: "rendez_vous" }, "bien_recu", opts);
    expect(e.map((x) => x.gabarit)).toEqual(RENDEZ_VOUS);
    expect(e[1]!.destinataire).toBe("ana@x.fr");
    expect(e[1]!.payload).toEqual({
      contactName: "Ana Bel",
      entreprise: "Acme",
      dateFinReservation: "23 janvier 2027",
    });
    // Jour 1 = 25/11/2026 : le 60e jour est le 23/01/2027 (saisie + 59).
    // Même clé d'idempotence : jamais deux accusés pour une présentation.
    expect(e[1]!.jobId).toBe("apporteur-presentation-recue-P2");
    // Pas de `gabaritRepli` : le repli naturel annoncerait l'ancienne règle (voir interrupteur-rendez-vous.ts).
    expect(e[1]!.payload).not.toHaveProperty("gabaritRepli");
  });

  it("la page et l'e-mail disent la même règle : « un devis signé pendant ces 60 jours compte aussi »", async () => {
    const { commentRendezVous } =
      await import("../../../app/apporteur/dossier/[id]/[jeton]/textes-comment");
    const { COPY_PRESENTATION_RECUE_RENDEZ_VOUS } =
      await import("@/lib/email/templates/apporteur-presentation-recue-rendez-vous");
    const phrase = COPY_PRESENTATION_RECUE_RENDEZ_VOUS.devis(60);
    expect(phrase).toBe("Un devis signé pendant ces 60 jours compte aussi.");
    expect(commentRendezVous(60, 6)).toContain(phrase);
  });

  it("🔒 « entreprise-information-coordonnees » n'existe NI dans les gabarits NI dans EmailJobName", async () => {
    const { EMAIL_TEMPLATE_NAMES } = await import("@/lib/email/templates");
    expect(EMAIL_TEMPLATE_NAMES as readonly string[]).not.toContain(
      "entreprise-information-coordonnees",
    );
    const { readFileSync } = await import("node:fs");
    const types = readFileSync("src/server/queue/types.ts", "utf8");
    expect(types).not.toContain("entreprise-information-coordonnees");
  });

  it("l'information à l'entreprise n'est JAMAIS construite, quelle que soit la règle", () => {
    for (const regle of [null, "rendez_vous"] as const) {
      for (const reponse of ["bien_recu", "deja_connue", "pas_disponible", "hors_champ"] as const) {
        const e = construireEnvoisReponse({ ...donnees, regle }, reponse, opts);
        expect(e.map((x) => x.gabarit)).not.toContain("entreprise-information-coordonnees");
      }
    }
  });

  it("les refus ne changent pas avec la règle", () => {
    for (const r of ["deja_connue", "pas_disponible", "hors_champ"] as const) {
      expect(construireEnvoisReponse({ ...donnees, regle: "rendez_vous" }, r, opts)).toEqual(
        construireEnvoisReponse(donnees, r, opts),
      );
    }
  });
});

describe("de bout en bout : l'interrupteur ET le contrat ≥ 2.8, sinon rien ne change", () => {
  const cas: Array<[string, string | undefined, unknown, string[]]> = [
    ["interrupteur absent, contrat 2.8", undefined, { version: "2.8" }, ACTUEL],
    ["interrupteur « false », contrat 2.8", "false", { version: "2.8" }, ACTUEL],
    ["interrupteur « TRUE », contrat 2.8", "TRUE", { version: "2.8" }, ACTUEL],
    ["interrupteur « 1 », contrat 2.8", "1", { version: "2.8" }, ACTUEL],
    ["interrupteur « true », contrat 2.6", "true", { version: "2.6" }, ACTUEL],
    ["interrupteur « true », contrat 2.7", "true", { version: "2.7" }, ACTUEL],
    ["interrupteur « true », signature absente", "true", null, ACTUEL],
    ["interrupteur « true », version illisible", "true", { version: "2.08" }, ACTUEL],
    ["interrupteur « true », contrat 2.8", "true", { version: "2.8" }, RENDEZ_VOUS],
    ["interrupteur « true », contrat 2.10", "true", { version: "2.10" }, RENDEZ_VOUS],
    ["interrupteur « true », contrat 3", "true", { version: "3" }, RENDEZ_VOUS],
  ];
  it.each(cas)("%s", async (_nom, env, signature, attendu) => {
    if (env !== undefined) process.env.APPORTEURS_VALIDATION_RDV = env;
    etat.signature = signature;

    const ap = await apercuReponse("P2", "bien_recu", opts);
    expect(ap.ok).toBe(true);
    expect(etat.apercus.map((e) => e.gabarit)).toEqual(attendu);

    const r = await appliquerReponse("P2", "bien_recu", opts);
    expect(r.ok).toBe(true);
    expect(etat.envoyes.map((e) => e.gabarit)).toEqual(attendu);
    expect(etat.envoyes.map((e) => e.gabarit)).not.toContain("entreprise-information-coordonnees");
  });
});
