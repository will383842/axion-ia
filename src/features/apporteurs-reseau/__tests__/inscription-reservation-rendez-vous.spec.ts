// Lot 3 de la règle « validation au premier rendez-vous tenu » : à la création d'une
// présentation, une réservation de 60 jours est inscrite SI l'interrupteur est allumé ET si le
// contrat signé est ≥ 2.8. Sinon : comportement strictement inchangé (contrat 2.6).
//
// Ni message, ni compteur, ni plafond : une redéclaration reste possible après l'échéance,
// quel que soit le nombre de présentations déjà faites.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Pres = {
  id: string;
  apporteurId: string;
  siren: string;
  statut: "reservee" | "confirmee";
  protegeeJusquAt: Date | null;
  recueAt: Date;
};

const db = vi.hoisted(() => ({
  presentations: [] as Array<{
    id: string;
    apporteurId: string;
    siren: string;
    statut: "reservee" | "confirmee";
    protegeeJusquAt: Date | null;
    recueAt: Date;
  }>,
  reservations: [] as Array<{ presentationId: string; regle: string; reserveeJusquAt: Date }>,
  etabs: new Map<string, { siret: string; entreprise: boolean; exclus: string[] }>(),
  signatures: new Map<string, unknown>(),
  tableReservationAbsente: false,
  n: 0,
}));

const { reservationApi, presentationApi } = vi.hoisted(() => {
  const absente = () => Object.assign(new Error("absente"), { code: "P2021" });
  const reservationApi = {
    findMany: async (a: { where: { presentationId: { in: string[] } } }) => {
      if (db.tableReservationAbsente) throw absente();
      return db.reservations.filter((r) => a.where.presentationId.in.includes(r.presentationId));
    },
    create: async (a: {
      data: { presentationId: string; regle: string; reserveeJusquAt: Date };
    }) => {
      if (db.tableReservationAbsente) throw absente();
      db.reservations.push({ ...a.data });
    },
  };
  const presentationApi = {
    findMany: async (a: { where: { apporteurId?: string; siren: string } }) =>
      db.presentations.filter(
        (p) =>
          p.siren === a.where.siren &&
          (a.where.apporteurId === undefined || p.apporteurId === a.where.apporteurId),
      ),
    create: async (a: { data: { apporteurId: string; siren: string; recueAt: Date } }) => {
      const p: Pres = {
        id: `p${++db.n}`,
        apporteurId: a.data.apporteurId,
        siren: a.data.siren,
        statut: "reservee",
        protegeeJusquAt: null,
        recueAt: a.data.recueAt,
      };
      db.presentations.push(p);
      return { id: p.id };
    },
  };
  return { reservationApi, presentationApi };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => v, decryptPii: (v: string) => v }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "h" }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(),
  lireEtablissementParSiret: vi.fn(),
}));
vi.mock("../rebonds", () => ({ idsPriseDeContactRebondie: vi.fn(async () => new Set()) }));
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, db.etabs.get(id) ?? vrai.AVANT_2_6] as const)),
    enregistrerEtablissement: async (id: string, siret: string, entreprise: boolean) => {
      db.etabs.set(id, { siret, entreprise, exclus: [] });
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: {
      findUnique: async (a: { where: { id: string } }) => ({
        statut: "signe",
        signatureApporteur: db.signatures.get(a.where.id) ?? null,
      }),
    },
    presentationEntreprise: presentationApi,
    presentationReservation: reservationApi,
    $transaction: async (f: (t: unknown) => unknown) => {
      // Une transaction qui échoue annule tout ce qu'elle a écrit.
      const avant = [db.presentations.length, db.reservations.length, db.etabs.size] as const;
      const etabsAvant = new Map(db.etabs);
      try {
        return await f({
          presentationEntreprise: presentationApi,
          presentationReservation: reservationApi,
        });
      } catch (e) {
        db.presentations.length = avant[0];
        db.reservations.length = avant[1];
        db.etabs.clear();
        for (const [k, v] of etabsAvant) db.etabs.set(k, v);
        throw e;
      }
    },
  },
}));

import { creerPresentation, existeDeclarationPlusAncienne } from "../presentations";
import { finReservation } from "../regle-attribution";

const A28 = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const A26 = "7a1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const B28 = "8b1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const T0 = new Date("2026-12-01T09:00:00Z");
const SIRET = "73282932000074";
const AUTRE_SIRET_MEME_SIREN = "73282932000082";
const saisie = (apporteurId: string, siret = SIRET) => ({
  apporteurId,
  siret,
  denomination: "Entreprise Test",
  personneNom: "Personne Test",
  personneFonction: null,
  personneEmail: "p@exemple.fr",
  personneTelephone: null,
  besoin: null,
  dateEchange: null,
});
const jours = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

beforeEach(() => {
  db.presentations.length = 0;
  db.reservations.length = 0;
  db.etabs.clear();
  db.signatures.clear();
  db.tableReservationAbsente = false;
  db.n = 0;
  db.signatures.set(A28, { version: "2.8" });
  db.signatures.set(B28, { version: "2.8" });
  db.signatures.set(A26, { version: "2.6" });
  vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
});

describe("inscription de la réservation à la création", () => {
  it("signataire 2.6, interrupteur allumé : aucune ligne de réservation", async () => {
    const r = await creerPresentation(saisie(A26), T0);
    expect(r.ok).toBe(true);
    expect(db.presentations).toHaveLength(1);
    expect(db.reservations).toHaveLength(0);
  });

  it("signataire 2.8, interrupteur ÉTEINT : aucune ligne (rien ne change en production)", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "");
    expect((await creerPresentation(saisie(A28), T0)).ok).toBe(true);
    expect(db.reservations).toHaveLength(0);
    vi.unstubAllEnvs();
    expect((await creerPresentation(saisie(A28, AUTRE_SIRET_MEME_SIREN), T0)).ok).toBe(true);
    expect(db.reservations).toHaveLength(0);
  });

  it("signataire 2.8 + interrupteur allumé : une ligne « rendez_vous » à la fin du 60e jour (Paris)", async () => {
    const r = await creerPresentation(saisie(A28), T0);
    expect(r.ok).toBe(true);
    expect(db.reservations).toEqual([
      {
        presentationId: db.presentations[0]!.id,
        regle: "rendez_vous",
        reserveeJusquAt: new Date("2027-01-29T22:59:59.999Z"),
      },
    ]);
    expect(db.reservations[0]!.reserveeJusquAt).toEqual(finReservation(T0));
  });

  it("table de réservation absente : la création ÉCHOUE, rien n'est écrit (jamais de repli silencieux)", async () => {
    db.tableReservationAbsente = true;
    await expect(creerPresentation(saisie(A28), T0)).rejects.toMatchObject({ code: "P2021" });
    expect(db.presentations).toHaveLength(0);
    expect(db.reservations).toHaveLength(0);
  });

  it("table absente mais signataire 2.6 : la création réussit comme avant", async () => {
    db.tableReservationAbsente = true;
    expect((await creerPresentation(saisie(A26), T0)).ok).toBe(true);
  });
});

describe("doublon, échéance, périmètre", () => {
  it("double envoi : une seule présentation, une seule réservation", async () => {
    expect((await creerPresentation(saisie(A28), T0)).ok).toBe(true);
    const seconde = await creerPresentation(saisie(A28), jours(T0, 1));
    expect(seconde.ok).toBe(false);
    expect(db.presentations).toHaveLength(1);
    expect(db.reservations).toHaveLength(1);
  });

  it("redéclaration possible après l'échéance (le 60e jour encore refusé, le lendemain accepté)", async () => {
    await creerPresentation(saisie(A28), T0);
    expect((await creerPresentation(saisie(A28), jours(T0, 59))).ok).toBe(false);
    expect((await creerPresentation(saisie(A28), jours(T0, 60))).ok).toBe(true);
    expect(db.presentations).toHaveLength(2);
    expect(db.reservations).toHaveLength(2);
  });

  it("aucun plafond ni compteur : on redéclare à l'infini, 60 jours après chaque saisie", async () => {
    let t = T0;
    for (let i = 0; i < 8; i++) {
      expect((await creerPresentation(saisie(A28), t)).ok).toBe(true);
      t = jours(t, 61);
    }
    expect(db.presentations).toHaveLength(8);
  });

  it("table absente à la LECTURE : l'ancienne présentation continue d'occuper (jamais plus permissif)", async () => {
    await creerPresentation(saisie(A28), T0);
    db.tableReservationAbsente = true;
    expect((await creerPresentation(saisie(A28), jours(T0, 90))).ok).toBe(false);
  });

  it("un AUTRE SIRET du même SIREN est accepté", async () => {
    expect((await creerPresentation(saisie(A28), T0)).ok).toBe(true);
    expect((await creerPresentation(saisie(A28, AUTRE_SIRET_MEME_SIREN), jours(T0, 1))).ok).toBe(
      true,
    );
    expect(db.presentations).toHaveLength(2);
    expect(db.reservations).toHaveLength(2);
  });

  it("contrat 2.6 : comportement inchangé — une `reservee` occupe sans limite de durée", async () => {
    await creerPresentation(saisie(A26), T0);
    expect((await creerPresentation(saisie(A26), jours(T0, 400))).ok).toBe(false);
  });
});

describe("deux apporteurs, une entreprise : le premier qui a saisi la garde", () => {
  const ligne = (apporteurId: string, recueAt: Date) => ({
    apporteurId,
    statut: "reservee" as const,
    protegeeJusquAt: null,
    recueAt,
  });

  it("la déclaration plus ancienne, réservation en cours, occupe : la plus récente est refusée", () => {
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ligne(A28, T0), reservation: { reserveeJusquAt: jours(T0, 60) } }],
        { apporteurId: B28, recueAt: jours(T0, 3) },
        jours(T0, 3),
      ),
    ).toBe(true);
  });

  it("jamais deux commissionnés : réservation échue, l'ancienne ne bloque plus ; la nouvelle devient la seule à occuper", () => {
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ligne(A28, T0), reservation: { reserveeJusquAt: jours(T0, 60) } }],
        { apporteurId: B28, recueAt: jours(T0, 70) },
        jours(T0, 70),
      ),
    ).toBe(false);
  });

  it("sans réservation (contrat 2.6) : l'ancienne occupe toujours, comme avant", () => {
    expect(
      existeDeclarationPlusAncienne(
        [ligne(A26, T0)],
        { apporteurId: B28, recueAt: jours(T0, 500) },
        jours(T0, 500),
      ),
    ).toBe(true);
  });

  it("l'ordre de saisie décide : la plus récente n'est jamais prioritaire sur l'ancienne", () => {
    expect(
      existeDeclarationPlusAncienne(
        [{ ...ligne(B28, jours(T0, 3)), reservation: { reserveeJusquAt: jours(T0, 63) } }],
        { apporteurId: A28, recueAt: T0 },
        jours(T0, 4),
      ),
    ).toBe(false);
  });
});
