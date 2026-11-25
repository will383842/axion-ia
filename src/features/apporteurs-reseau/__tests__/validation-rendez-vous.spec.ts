/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 6 — « il a eu lieu » : le dirigeant valide, rien n'est automatique. Base simulée en mémoire ;
// la transaction est SÉRIALISÉE par un verrou (ce que fait l'isolation Serializable : une seule
// validation à la fois sur la même donnée, la seconde voit le résultat de la première).

type Ligne = Record<string, any>;
const { bd, tx } = vi.hoisted(() => {
  const bd = {
    presentations: [] as Ligne[],
    reservations: [] as Ligne[],
    etablissements: [] as Ligne[],
    retraits: [] as Ligne[],
    propositions: [] as Ligne[],
    journal: [] as Ligne[],
    annonces: [] as string[],
    conflit: false,
    verrou: Promise.resolve() as Promise<unknown>,
  };
  function correspond(l: Ligne, where: Ligne): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(l[k]);
        if ("not" in v) return l[k] !== v.not;
        return true;
      }
      return l[k] === v;
    });
  }

  const tx = {
    presentationEntreprise: {
      findUnique: async ({ where }: any) => {
        const p = bd.presentations.find((x) => x.id === where.id);
        return p ? { ...p } : null;
      },
      findMany: async ({ where }: any) => bd.presentations.filter((p) => correspond(p, where)),
      updateMany: async ({ where, data }: any) => {
        const l = bd.presentations.filter((p) => correspond(p, where));
        l.forEach((p) => Object.assign(p, data));
        return { count: l.length };
      },
    },
    presentationReservation: {
      findUnique: async ({ where }: any) =>
        bd.reservations.find((r) => r.presentationId === where.presentationId) ?? null,
      findMany: async ({ where }: any) => bd.reservations.filter((r) => correspond(r, where)),
      updateMany: async ({ where, data }: any) => {
        const l = bd.reservations.filter(
          (r) =>
            r.presentationId === where.presentationId &&
            (where.valideeAt === null ? r.valideeAt == null : true),
        );
        l.forEach((r) => Object.assign(r, data));
        return { count: l.length };
      },
    },
    apporteurReseauRetrait: {
      findUnique: async ({ where }: any) =>
        bd.retraits.find((r) => r.apporteurId === where.apporteurId) ?? null,
    },
    presentationEtablissement: { findMany: async () => bd.etablissements },
    activityLog: { create: async ({ data }: any) => void bd.journal.push(data) },
    propositionRendezVousPresentation: {
      updateMany: async ({ where, data }: any) => {
        const l = bd.propositions.filter(
          (p) =>
            p.presentationId === where.presentationId &&
            p.rendezVousCle === where.rendezVousCle &&
            p.retenueAt == null,
        );
        l.forEach((p) => Object.assign(p, data));
        return { count: l.length };
      },
    },
  };

  return { bd, tx };
});

vi.mock("../attribution-annonce", () => ({
  annoncerAttribution: async (id: string) => {
    if (bd.annonces.includes(id)) return false; // « une fois par jobId »
    bd.annonces.push(id);
    return true;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const precedent = bd.verrou;
      let fin!: () => void;
      bd.verrou = new Promise<void>((r) => (fin = r));
      await precedent;
      // Écritures annulées si la transaction échoue : on travaille sur une copie.
      const copie = JSON.stringify([bd.presentations, bd.reservations, bd.journal]);
      try {
        if (bd.conflit) throw Object.assign(new Error("conflit"), { code: "P2034" });
        return await fn(tx);
      } catch (err) {
        const [p, r, j] = JSON.parse(copie, (_k, v) =>
          typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v,
        );
        bd.presentations.splice(0, bd.presentations.length, ...p);
        bd.reservations.splice(0, bd.reservations.length, ...r);
        bd.journal.splice(0, bd.journal.length, ...j);
        throw err;
      } finally {
        fin();
      }
    },
  },
}));

import { ecarterProposition, validerParRendezVous } from "../validation-rendez-vous";

const SAISIE = new Date("2026-11-01T10:00:00Z");
const MAINTENANT = new Date("2026-11-20T10:00:00Z");
const PRIS = new Date("2026-11-05T10:00:00Z");
const TENU = new Date("2026-11-10T10:00:00Z");
const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";

function entreprise(id: string, apporteurId: string, o: Ligne = {}, statutApporteur = "signe") {
  bd.presentations.push({
    id,
    apporteurId,
    siren: "732829320",
    statut: "reservee",
    recueAt: SAISIE,
    protegeeJusquAt: null,
    apporteur: { statut: statutApporteur, signatureApporteur: { version: "2.8" } },
    ...o,
  });
  bd.reservations.push({
    presentationId: id,
    regle: "rendez_vous",
    reserveeJusquAt: new Date(((o["recueAt"] as Date) ?? SAISIE).getTime() + 60 * 86_400_000),
    echueAt: null,
    valideeAt: null,
    rendezVousPrisAt: null,
  });
}

const saisie = (id: string, o: Ligne = {}) => ({
  presentationId: id,
  rendezVousCle: "calendly:ev1",
  prisAt: PRIS,
  tenuAt: TENU,
  source: "calendly" as const,
  acteurId: "admin-1",
  ...o,
});

beforeEach(() => {
  vi.stubEnv("APPORTEURS_VALIDATION_RDV", "true");
  for (const k of [
    "presentations",
    "reservations",
    "etablissements",
    "retraits",
    "propositions",
    "journal",
    "annonces",
  ] as const)
    bd[k].length = 0;
  bd.conflit = false;
  bd.verrou = Promise.resolve();
});

describe("validerParRendezVous", () => {
  it("valide : confirmée à la date du rendez-vous, protection de 6 mois, journal, une annonce", async () => {
    entreprise("p1", A1);
    bd.propositions.push({ presentationId: "p1", rendezVousCle: "calendly:ev1", retenueAt: null });
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(true);
    const p = bd.presentations[0]!;
    expect(p["statut"]).toBe("confirmee");
    expect(p["confirmeeAt"]).toEqual(TENU);
    expect(p["protegeeJusquAt"]).toEqual(new Date("2027-05-10T10:00:00Z"));
    expect(bd.reservations[0]!["valideeParId"]).toBe("admin-1");
    expect(bd.journal).toHaveLength(1);
    expect(bd.propositions[0]!["retenueAt"]).toEqual(MAINTENANT);
    expect(bd.annonces).toEqual(["p1"]);
  });

  it("double clic : une validation, une annonce", async () => {
    entreprise("p1", A1);
    const [a, b] = await Promise.all([
      validerParRendezVous(saisie("p1"), MAINTENANT),
      validerParRendezVous(saisie("p1"), MAINTENANT),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(bd.journal).toHaveLength(1);
    expect(bd.annonces).toEqual(["p1"]);
  });

  it("deux apporteurs validés en même temps : un seul (le plus ancien passe en premier)", async () => {
    entreprise("p1", A1);
    entreprise("p2", A2, { recueAt: new Date("2026-11-02T10:00:00Z") });
    const [a, b] = await Promise.all([
      validerParRendezVous(saisie("p2", { prisAt: new Date("2026-11-06T10:00:00Z") }), MAINTENANT),
      validerParRendezVous(saisie("p1"), MAINTENANT),
    ]);
    expect(bd.presentations.filter((p) => p["statut"] === "confirmee")).toHaveLength(1);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(true);
    expect(bd.presentations.find((p) => p["id"] === "p1")!["statut"]).toBe("confirmee");
  });

  it("jamais deux apporteurs : une entreprise déjà validée par un autre est refusée, même plus ancienne", async () => {
    entreprise("p1", A1);
    entreprise("p2", A2, {
      statut: "confirmee",
      protegeeJusquAt: new Date("2027-03-01T00:00:00Z"),
    });
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
    expect(bd.annonces).toHaveLength(0);
  });

  it("une déclaration plus ancienne d'un autre apporteur, encore en cours, passe en premier", async () => {
    entreprise("p1", A1, { recueAt: new Date("2026-11-03T10:00:00Z") });
    entreprise("p2", A2); // saisie le 1er : plus ancienne
    const r = await validerParRendezVous(
      saisie("p1", { prisAt: new Date("2026-11-05T10:00:00Z") }),
      MAINTENANT,
    );
    expect(r.ok).toBe(false);
    expect(bd.presentations.every((p) => p["statut"] === "reservee")).toBe(true);
  });

  it("apporteur résilié entre la saisie et le rendez-vous : refus", async () => {
    entreprise("p1", A1, {}, "resilie");
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r).toMatchObject({ ok: false });
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
  });

  it("apporteur retiré du réseau : permis, avec un avertissement", async () => {
    entreprise("p1", A1);
    bd.retraits.push({ apporteurId: A1 });
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.avertissements.join(" ")).toMatch(/retiré/);
  });

  it("apporteur en préavis (contrat encore signé) : permis", async () => {
    entreprise("p1", A1);
    expect((await validerParRendezVous(saisie("p1"), MAINTENANT)).ok).toBe(true);
  });

  it("contrat signé avant la 2.8 : refus", async () => {
    entreprise("p1", A1, {
      apporteur: { statut: "signe", signatureApporteur: { version: "2.6" } },
    });
    expect((await validerParRendezVous(saisie("p1"), MAINTENANT)).ok).toBe(false);
  });

  it("date de prise hors des 60 jours : refus (avant la saisie, ou après la réservation)", async () => {
    entreprise("p1", A1);
    const avant = await validerParRendezVous(
      saisie("p1", { prisAt: new Date("2026-10-30T10:00:00Z") }),
      MAINTENANT,
    );
    const apres = await validerParRendezVous(
      saisie("p1", {
        prisAt: new Date("2027-01-15T10:00:00Z"),
        tenuAt: new Date("2027-01-20T10:00:00Z"),
      }),
      new Date("2027-02-01T10:00:00Z"),
    );
    expect(avant.ok).toBe(false);
    expect(apres.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
  });

  it("tenu avant la prise : refus", async () => {
    entreprise("p1", A1);
    const r = await validerParRendezVous(saisie("p1", { prisAt: TENU, tenuAt: PRIS }), MAINTENANT);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.message).toMatch(/précède sa prise/);
  });

  it("rendez-vous pas encore tenu (dans le futur) : refus", async () => {
    entreprise("p1", A1);
    const r = await validerParRendezVous(
      saisie("p1", { tenuAt: new Date("2026-12-01T10:00:00Z") }),
      MAINTENANT,
    );
    expect(r.ok).toBe(false);
  });

  it("saisie manuelle (téléphone ou sur place) : sans clé de rendez-vous, source « saisie »", async () => {
    entreprise("p1", A1);
    const r = await validerParRendezVous(
      saisie("p1", { rendezVousCle: null, source: "saisie", prisAt: TENU }),
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    expect(bd.reservations[0]).toMatchObject({ validationSource: "saisie", rendezVousCle: null });
  });

  it("interrupteur éteint : rien n'est écrit", async () => {
    vi.stubEnv("APPORTEURS_VALIDATION_RDV", "TRUE");
    entreprise("p1", A1);
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
    expect(bd.journal).toHaveLength(0);
  });

  it("conflit de sérialisation (P2034) : message clair, rien d'écrit", async () => {
    entreprise("p1", A1);
    bd.conflit = true;
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r).toMatchObject({ ok: false });
    expect(bd.annonces).toHaveLength(0);
  });
});

describe("ecarterProposition", () => {
  it("écarte sans jamais supprimer, une seule fois", async () => {
    const lignes: Ligne[] = [{ id: "x", ecarteeAt: null, retenueAt: null }];
    const { prisma } = await import("@/lib/prisma");
    (prisma as any).propositionRendezVousPresentation = {
      updateMany: async ({ where, data }: any) => {
        const l = lignes.filter((p) => p.id === where.id && !p.ecarteeAt && !p.retenueAt);
        l.forEach((p) => Object.assign(p, data));
        return { count: l.length };
      },
    };
    expect((await ecarterProposition("x", "admin-1", MAINTENANT)).ok).toBe(true);
    expect((await ecarterProposition("x", "admin-1", MAINTENANT)).ok).toBe(false);
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ ecarteeAt: MAINTENANT, ecarteeParId: "admin-1" });
  });
});
