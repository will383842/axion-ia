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
    events: [] as Ligne[],
    rencontres: [] as Ligne[],
    journal: [] as Ligne[],
    annonces: [] as string[],
    conflit: false,
    /** Appelée au début de la première écriture conditionnelle : simule une écriture concurrente. */
    avantEcriture: null as null | (() => void),
    /** Appelée au début de la première écriture sur une proposition. */
    avantEcritureProposition: null as null | (() => void),
    /** Options passées à chaque `$transaction` (isolation). */
    optionsTx: [] as unknown[],
    verrou: Promise.resolve() as Promise<unknown>,
  };
  function correspond(l: Ligne, where: Ligne): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v === null) return l[k] == null;
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
        bd.avantEcriture?.();
        bd.avantEcriture = null;
        const l = bd.reservations.filter((r) => correspond(r, where));
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
    calendlyEvent: {
      findUnique: async ({ where }: any) => bd.events.find((x) => x.id === where.id) ?? null,
    },
    rencontre: {
      findUnique: async ({ where }: any) => bd.rencontres.find((x) => x.id === where.id) ?? null,
    },
    propositionRendezVousPresentation: {
      findUnique: async ({ where }: any) => bd.propositions.find((p) => p.id === where.id) ?? null,
      findMany: async ({ where }: any) => bd.propositions.filter((p) => correspond(p, where)),
      updateMany: async ({ where, data }: any) => {
        bd.avantEcritureProposition?.();
        bd.avantEcritureProposition = null;
        const l = bd.propositions.filter((p) => correspond(p, where));
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
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>, options?: unknown) => {
      bd.optionsTx.push(options);
      const precedent = bd.verrou;
      let fin!: () => void;
      bd.verrou = new Promise<void>((r) => (fin = r));
      await precedent;
      // Écritures annulées si la transaction échoue : on travaille sur une copie.
      const copie = JSON.stringify([
        bd.presentations,
        bd.reservations,
        bd.journal,
        bd.propositions,
      ]);
      try {
        if (bd.conflit) throw Object.assign(new Error("conflit"), { code: "P2034" });
        return await fn(tx);
      } catch (err) {
        const [p, r, j, pr] = JSON.parse(copie, (_k, v) =>
          typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v,
        );
        bd.presentations.splice(0, bd.presentations.length, ...p);
        bd.reservations.splice(0, bd.reservations.length, ...r);
        bd.journal.splice(0, bd.journal.length, ...j);
        bd.propositions.splice(0, bd.propositions.length, ...pr);
        throw err;
      } finally {
        fin();
      }
    },
  },
}));

import {
  ecarterProposition,
  MESSAGE_ANCIEN_RDV_ANNULE,
  validerParRendezVous,
} from "../validation-rendez-vous";

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

/** Un rendez-vous Calendly tel que la source le porte (dates identiques à PRIS / TENU). */
function evenement(id: string, o: Ligne = {}) {
  bd.events.push({
    id,
    status: "scheduled",
    startTime: TENU,
    capturedAt: PRIS,
    rencontre: null,
    ...o,
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
    "events",
    "rencontres",
    "journal",
    "annonces",
  ] as const)
    bd[k].length = 0;
  bd.conflit = false;
  bd.avantEcriture = null;
  bd.avantEcritureProposition = null;
  bd.optionsTx.length = 0;
  bd.verrou = Promise.resolve();
  evenement("ev1");
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

  // Les dates viennent de la SOURCE (l'événement) : on les fixe là.
  const source = (pris: Date, tenu: Date) => {
    bd.events[0]!["capturedAt"] = pris;
    bd.events[0]!["startTime"] = tenu;
  };

  it("date de prise hors des 60 jours : refus (avant la saisie, ou après la réservation)", async () => {
    entreprise("p1", A1);
    source(new Date("2026-10-30T10:00:00Z"), TENU);
    const avant = await validerParRendezVous(saisie("p1"), MAINTENANT);
    source(new Date("2027-01-15T10:00:00Z"), new Date("2027-01-20T10:00:00Z"));
    const apres = await validerParRendezVous(saisie("p1"), new Date("2027-02-01T10:00:00Z"));
    expect(avant.ok).toBe(false);
    expect(apres.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
  });

  it("tenu avant la prise : refus", async () => {
    entreprise("p1", A1);
    source(TENU, PRIS);
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.message).toMatch(/précède sa prise/);
  });

  it("rendez-vous pas encore tenu (dans le futur) : refus", async () => {
    entreprise("p1", A1);
    source(PRIS, new Date("2026-12-01T10:00:00Z"));
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
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

describe("rendez-vous annulé, absent ou reporté : jamais de validation", () => {
  const refus = async (id = "p1") => {
    const r = await validerParRendezVous(saisie(id), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
    expect(bd.journal).toHaveLength(0);
    expect(bd.annonces).toHaveLength(0);
    return r;
  };

  for (const status of ["canceled", "no_show"]) {
    it(`Calendly « ${status} » après la proposition : refus`, async () => {
      entreprise("p1", A1);
      bd.events[0]!["status"] = status;
      const r = await refus();
      if (!r.ok) expect(r.message).toMatch(/n'a pas eu lieu/);
    });
  }

  for (const statut of ["annule", "absent", "reporte"]) {
    it(`rencontre « ${statut} » : refus (clé rencontre)`, async () => {
      entreprise("p1", A1);
      bd.rencontres.push({ id: "r1", statut, debutReel: null, debutPrevu: TENU, createdAt: PRIS });
      const r = await validerParRendezVous(
        saisie("p1", { rendezVousCle: "rencontre:r1", source: "rencontre" }),
        MAINTENANT,
      );
      expect(r.ok).toBe(false);
      expect(bd.presentations[0]!["statut"]).toBe("reservee");
    });

    it(`événement Calendly dont la rencontre liée est « ${statut} » : refus`, async () => {
      entreprise("p1", A1);
      bd.events[0]!["rencontre"] = { statut, debutReel: null, debutPrevu: TENU };
      await refus();
    });
  }

  it("rendez-vous introuvable à la source : refus", async () => {
    entreprise("p1", A1);
    bd.events.length = 0;
    await refus();
  });

  it("la date de la SOURCE l'emporte sur celle de la proposition (rendez-vous déplacé)", async () => {
    entreprise("p1", A1);
    const deplace = new Date("2026-11-12T10:00:00Z");
    bd.events[0]!["startTime"] = deplace;
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(true);
    expect(bd.presentations[0]!["confirmeeAt"]).toEqual(deplace);
  });

  it("source déplacée dans le futur : refus (pas encore tenu)", async () => {
    entreprise("p1", A1);
    bd.events[0]!["startTime"] = new Date("2026-12-24T10:00:00Z");
    await refus();
  });
});

describe("premier rendez-vous tenu", () => {
  it("un rendez-vous plus ancien déjà tenu, proposé et non écarté : refus", async () => {
    entreprise("p1", A1);
    evenement("ev0", { startTime: new Date("2026-11-08T10:00:00Z") });
    bd.propositions.push({ presentationId: "p1", rendezVousCle: "calendly:ev0", ecarteeAt: null });
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/PREMIER/);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
  });

  it("la saisie manuelle est soumise à la même règle", async () => {
    entreprise("p1", A1);
    evenement("ev0", { startTime: new Date("2026-11-08T10:00:00Z") });
    bd.propositions.push({ presentationId: "p1", rendezVousCle: "calendly:ev0", ecarteeAt: null });
    const r = await validerParRendezVous(
      saisie("p1", { rendezVousCle: null, source: "saisie", canal: "telephone", prisAt: TENU }),
      MAINTENANT,
    );
    expect(r.ok).toBe(false);
  });

  it("le plus ancien écarté, annulé ou futur ne bloque pas ; le plus ancien lui-même passe", async () => {
    entreprise("p1", A1);
    evenement("ev0", { status: "canceled", startTime: new Date("2026-11-08T10:00:00Z") });
    evenement("ev9", { startTime: new Date("2026-11-30T10:00:00Z") });
    evenement("ev8", { startTime: new Date("2026-11-07T10:00:00Z") });
    bd.propositions.push(
      { presentationId: "p1", rendezVousCle: "calendly:ev0", ecarteeAt: null },
      { presentationId: "p1", rendezVousCle: "calendly:ev9", ecarteeAt: null },
      { presentationId: "p1", rendezVousCle: "calendly:ev8", ecarteeAt: new Date() },
    );
    expect((await validerParRendezVous(saisie("p1"), MAINTENANT)).ok).toBe(true);
  });
});

describe("canal de la saisie manuelle", () => {
  it("est inscrit au journal", async () => {
    entreprise("p1", A1);
    const r = await validerParRendezVous(
      saisie("p1", {
        rendezVousCle: null,
        source: "saisie",
        canal: "sur_place",
        prisAt: TENU,
      }),
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    expect(bd.journal[0]!["changes"]).toMatchObject({ source: "saisie", canal: "sur_place" });
  });
});

describe("ecarterProposition", () => {
  it("écarte sans jamais supprimer, une seule fois", async () => {
    const lignes: Ligne[] = [{ id: "x", ecarteeAt: null, retenueAt: null }];
    const origine = tx.propositionRendezVousPresentation.updateMany;
    tx.propositionRendezVousPresentation.updateMany = async ({ where, data }: any) => {
      const l = lignes.filter((p) => p.id === where.id && !p.ecarteeAt && !p.retenueAt);
      l.forEach((p) => Object.assign(p, data));
      return { count: l.length };
    };
    try {
      expect((await ecarterProposition("x", "admin-1", MAINTENANT)).ok).toBe(true);
      expect((await ecarterProposition("x", "admin-1", MAINTENANT)).ok).toBe(false);
    } finally {
      tx.propositionRendezVousPresentation.updateMany = origine;
    }
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ ecarteeAt: MAINTENANT, ecarteeParId: "admin-1" });
  });
});

describe("revue de sécurité du lot 6", () => {
  it("un rendez-vous PRIS pendant la réservation de l'ancien, pas encore tenu, le retient au-delà du terme", async () => {
    // A2 : saisie le 1er sept., terme le 31 oct. ; rendez-vous pris le 20 oct., prévu le 25 nov.
    entreprise("pOld", A2, { recueAt: new Date("2026-09-01T10:00:00Z") });
    bd.reservations[0]!["reserveeJusquAt"] = new Date("2026-10-31T22:59:59.999Z");
    evenement("evOld", {
      startTime: new Date("2026-11-25T10:00:00Z"),
      capturedAt: new Date("2026-10-20T10:00:00Z"),
    });
    bd.propositions.push({
      id: "prOld",
      presentationId: "pOld",
      rendezVousCle: "calendly:evOld",
      prisAt: new Date("2026-10-20T10:00:00Z"),
      ecarteeAt: null,
      retenueAt: null,
    });
    entreprise("p1", A1, { recueAt: new Date("2026-11-01T10:00:00Z") });
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations.find((p) => p["id"] === "p1")!["statut"]).toBe("reservee");
    expect(bd.annonces).toHaveLength(0);
  });

  function ancienneAvecRdv(statut: string) {
    entreprise("pOld", A2, { recueAt: new Date("2026-09-01T10:00:00Z") });
    bd.reservations[0]!["reserveeJusquAt"] = new Date("2026-10-31T22:59:59.999Z");
    evenement("evOld", {
      status: statut,
      startTime: new Date("2026-11-25T10:00:00Z"),
      capturedAt: new Date("2026-10-20T10:00:00Z"),
    });
    bd.propositions.push({
      id: "prOld",
      presentationId: "pOld",
      rendezVousCle: "calendly:evOld",
      prisAt: new Date("2026-10-20T10:00:00Z"),
      ecarteeAt: null,
      retenueAt: null,
    });
  }

  it("le rendez-vous de l'ancien, pris à temps puis annulé, attend le dirigeant : le plus récent n'est pas validé", async () => {
    ancienneAvecRdv("canceled");
    entreprise("p1", A1);
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGE_ANCIEN_RDV_ANNULE });
    expect(bd.presentations.find((p) => p["id"] === "p1")!["statut"]).toBe("reservee");
    expect(bd.annonces).toHaveLength(0);
  });

  it("une fois la proposition annulée de l'ancien écartée, le plus récent est validé", async () => {
    ancienneAvecRdv("canceled");
    bd.propositions[0]!["ecarteeAt"] = new Date("2026-11-19T10:00:00Z");
    entreprise("p1", A1);
    expect((await validerParRendezVous(saisie("p1"), MAINTENANT)).ok).toBe(true);
  });

  it("source introuvable : la proposition de l'ancien continue de la retenir", async () => {
    ancienneAvecRdv("scheduled");
    bd.events.splice(
      bd.events.findIndex((x) => x["id"] === "evOld"),
      1,
    );
    entreprise("p1", A1);
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations.find((p) => p["id"] === "p1")!["statut"]).toBe("reservee");
  });

  it("proposition écartée entre l'affichage et le clic : refus, rien d'écrit", async () => {
    entreprise("p1", A1);
    bd.propositions.push({
      id: "pr1",
      presentationId: "p1",
      rendezVousCle: "calendly:ev1",
      prisAt: PRIS,
      ecarteeAt: new Date("2026-11-19T10:00:00Z"),
      retenueAt: null,
    });
    const r = await validerParRendezVous(saisie("p1", { propositionId: "pr1" }), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
    expect(bd.journal).toHaveLength(0);
  });

  it("écriture concurrente entre la lecture et l'écriture : la condition « valideeAt vide » refuse, ni journal ni annonce", async () => {
    entreprise("p1", A1);
    bd.avantEcriture = () => {
      bd.reservations[0]!["valideeAt"] = new Date("2026-11-20T09:59:00Z");
    };
    const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
    expect(r.ok).toBe(false);
    expect(bd.journal).toHaveLength(0);
    expect(bd.annonces).toHaveLength(0);
    expect(bd.presentations[0]!["statut"]).toBe("reservee");
  });

  it("la présentation change de statut entre la lecture et l'écriture : refus, rien d'écrit, aucune annonce", async () => {
    entreprise("p1", A1);
    // L'écriture sur la réservation passe, puis la présentation n'est plus « réservée ».
    const origine = tx.presentationEntreprise.updateMany;
    tx.presentationEntreprise.updateMany = async (a: any) => {
      bd.presentations[0]!["statut"] = "dementie";
      return origine(a);
    };
    try {
      const r = await validerParRendezVous(saisie("p1"), MAINTENANT);
      expect(r.ok).toBe(false);
    } finally {
      tx.presentationEntreprise.updateMany = origine;
    }
    expect(bd.journal).toHaveLength(0);
    expect(bd.annonces).toHaveLength(0);
    expect(bd.reservations[0]!["valideeAt"]).toBeNull();
  });

  it("« Annulé par Axion IA » : réputé tenu, le canal est inscrit au journal", async () => {
    entreprise("p1", A1);
    const r = await validerParRendezVous(
      saisie("p1", { rendezVousCle: null, source: "saisie", canal: "annule_par_axion" }),
      MAINTENANT,
    );
    expect(r.ok).toBe(true);
    expect(bd.journal[0]!["changes"]).toMatchObject({ canal: "annule_par_axion" });
  });
});
