/**
 * Bascule des présentations EN ATTENTE de l'ancienne règle (silence) vers la règle du rendez-vous
 * (décision de Will, 26/11/2026). Même base en mémoire que `passage-rendez-vous.spec.ts`.
 *
 * Base en mémoire (pas une suite de mocks qui répondent oui) : les écritures conditionnelles, la
 * contrainte d'unicité des commissions et le retour arrière d'une transaction sont réels, donc un
 * rejeu, deux passages simultanés ou une validation qui double une échéance se jugent sur l'ÉTAT.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const db = vi.hoisted(() => ({
  pres: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  res: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  props: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  commissions: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  payees: [] as unknown[],
  lignes: [] as unknown[],
  devis: [] as unknown[],
  apporteurs: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  alertes: [] as Array<{
    gabarit: string;
    to: unknown;
    payload: Record<string, unknown>;
    jobId: string;
  }>,
  createErreur: null as null | { code: string },
  /** Si renseigné, `createErreur` ne frappe que cette présentation. */
  erreurPour: null as null | string,
  audit: [] as Array<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-explicit-any
  jobIds: new Set<string>(),
  /** Appelé juste APRÈS une lecture des présentations : simule un autre processus qui écrit entre lecture et écriture. */
  apresLecture: null as null | ((where: Record<string, unknown>) => void),
  apresLectureRes: null as null | ((where: Record<string, unknown>) => void),
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
  };
});
vi.mock("../avoir-client", () => ({ reprendreApresAvoirsClients: vi.fn(async () => ({})) }));
vi.mock("../facturation", () => ({
  facturerCommissionsDues: vi.fn(async () => ({
    autofactures: 0,
    commissions: 0,
    ecartees: 0,
    erreurs: 0,
  })),
}));
vi.mock("../hors-grille", () => ({ alerterHorsGrille: vi.fn(async () => 0) }));
vi.mock("../manquement", () => ({ regenererAvoirsSansPiece: vi.fn(async () => 0) }));
vi.mock("../pieces-chiffrement", () => ({ chiffrerPiecesEnClair: vi.fn(async () => 0) }));
vi.mock("../rebonds", () => ({ idsPriseDeContactRebondie: vi.fn(async () => new Set<string>()) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "williams@x.test",
}));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../alerte-vigilance", () => ({ alerterPiecesVigilanceDeposees: vi.fn(async () => 0) }));
vi.mock("../commissions", () => ({
  libererSiPiecesValides: vi.fn(async () => 0),
  relancerVigilance: vi.fn(async () => false),
  demanderVigilance: vi.fn(async () => "deja"),
  dejaEnvoye: vi.fn(async (jobId: string) => db.jobIds.has(jobId)),
  piecesVigilanceValides: vi.fn(async () => true),
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      gabarit: string,
      to: unknown,
      _l: string,
      payload: Record<string, unknown>,
      opts: { jobId: string },
    ) => {
      db.alertes.push({ gabarit, to, payload, jobId: opts.jobId });
      db.jobIds.add(opts.jobId);
      return { enqueued: true };
    },
  ),
}));

/** Petit évaluateur de `where` Prisma : égalité, null, in, not, lt/lte/gt/gte, OR, AND. */
function ok(row: Ligne, where: Ligne): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === "OR") return (v as Ligne[]).some((w) => ok(row, w));
    if (k === "AND") return (v as Ligne[]).every((w) => ok(row, w));
    const x = row[k];
    if (v === null) return x === null || x === undefined;
    if (v instanceof Date) return x instanceof Date && x.getTime() === v.getTime();
    if (typeof v === "object") {
      const o = v as Ligne;
      if ("in" in o && !o.in.includes(x)) return false;
      if ("not" in o && (o.not === null ? x == null : x === o.not)) return false;
      const t = (d: unknown) => (d instanceof Date ? d.getTime() : Number.NaN);
      if ("lte" in o && !(t(x) <= t(o.lte))) return false;
      if ("lt" in o && !(t(x) < t(o.lt))) return false;
      if ("gte" in o && !(t(x) >= t(o.gte))) return false;
      if ("gt" in o && !(t(x) > t(o.gt))) return false;
      return true;
    }
    return x === v;
  });
}
const macrotache = () => new Promise((r) => setTimeout(r, 0));

vi.mock("@/lib/prisma", () => {
  const fake: Ligne = {
    presentationEntreprise: {
      findMany: vi.fn(async (a: { where: Ligne }) => {
        const r = db.pres.filter((p) => ok(p, a.where)).map((p) => ({ ...p }));
        db.apresLecture?.(a.where);
        return r;
      }),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) => db.pres.find((p) => p.id === a.where.id) ?? null,
      ),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const l = db.pres.filter((p) => ok(p, a.where));
        for (const p of l) Object.assign(p, a.data);
        return { count: l.length };
      }),
      update: vi.fn(async (a: { where: { id: string }; data: Ligne }) => {
        const p = db.pres.find((x) => x.id === a.where.id)!;
        Object.assign(p, a.data);
        return p;
      }),
    },
    presentationReservation: {
      findUnique: vi.fn(async (a: { where: { presentationId: string } }) => {
        const r = db.res.find((x) => x.presentationId === a.where.presentationId);
        return r ? { ...r } : null;
      }),
      create: vi.fn(async (a: { data: Ligne }) => {
        if (db.createErreur && (!db.erreurPour || db.erreurPour === a.data.presentationId))
          throw Object.assign(new Error("table"), db.createErreur);
        if (db.res.some((x) => x.presentationId === a.data.presentationId))
          throw Object.assign(new Error("unique"), { code: "P2002" });
        db.res.push({
          echueAt: null,
          rendezVousPrisAt: null,
          rendezVousAt: null,
          rendezVousCle: null,
          validationSource: null,
          valideeAt: null,
          ...a.data,
        });
        return a.data;
      }),
      findMany: vi.fn(async (a: { where: Ligne }) => {
        const r = db.res.filter((x) => ok(x, a.where)).map((x) => ({ ...x }));
        db.apresLectureRes?.(a.where);
        return r;
      }),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const l = db.res.filter((r) => ok(r, a.where));
        for (const r of l) Object.assign(r, a.data);
        return { count: l.length };
      }),
    },
    propositionRendezVousPresentation: {
      findMany: vi.fn(async (a: { where: Ligne }) =>
        db.props.filter((r) => ok(r, a.where)).map((r) => ({ ...r })),
      ),
    },
    // Annulations de rendez-vous (art. 3.2) : aucune dans ces scénarios.
    annulationRendezVousPresentation: { findMany: vi.fn(async () => []) },
    factureFormation: {
      findMany: vi.fn(async (a: { where: { statut?: string; avoirDeId?: unknown } }) => {
        if (a.where.statut === "payee") return db.payees;
        if (a.where.avoirDeId === null) return db.lignes;
        return [];
      }),
    },
    commissionApporteur: {
      findMany: vi.fn(async () => {
        const snap = db.commissions.map((c) => ({ ...c }));
        await macrotache();
        return snap;
      }),
      groupBy: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(async (a: { data: Ligne }) => {
        const d = a.data;
        if (
          db.commissions.some(
            (c) =>
              c.factureId === d.factureId &&
              c.apporteurId === d.apporteurId &&
              !!c.parrainage === !!d.parrainage,
          )
        )
          throw Object.assign(new Error("unique"), { code: "P2002" });
        db.commissions.push({ ...d });
        return d;
      }),
    },
    apporteurReseau: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) =>
          db.apporteurs.find((x) => x.id === a.where.id) ?? null,
      ),
      updateMany: vi.fn(async (a: { where: Ligne; data: Ligne }) => {
        const l = db.apporteurs.filter((p) => ok(p, a.where));
        for (const p of l) Object.assign(p, { statut: a.data.statut, resilieAt: a.data.resilieAt });
        return { count: l.length };
      }),
    },
    apporteurResiliation: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      findMany: vi.fn(async () => []),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Ligne }) => {
        db.audit.push({ ...a.data, createdAt: new Date() });
        return {};
      }),
      findMany: vi.fn(async (a: { where: { action: string } }) =>
        db.audit.filter((l) => l.action === a.where.action).map((l) => ({ targetId: l.targetId })),
      ),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    devis: { findMany: vi.fn(async () => db.devis) },
    client: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const avant = {
        pres: db.pres.map((x) => ({ ...x })),
        res: db.res.map((x) => ({ ...x })),
      };
      try {
        return await fn(fake);
      } catch (e) {
        db.pres.splice(0, db.pres.length, ...avant.pres);
        db.res.splice(0, db.res.length, ...avant.res);
        throw e;
      }
    }),
  };
  return { prisma: fake };
});

import { passerReseauApporteurs } from "../passage-quotidien";
import {
  DELAI_MINIMAL_BASCULE_JOURS,
  MARQUEUR_CLAUSE_BASCULE,
  basculeVersRendezVous,
  termeApresBascule,
} from "../regle-attribution";
import { idsPriseDeContactRebondie } from "../rebonds";
import { envoyer } from "../envois";

const JOUR = 86_400_000;
const j = (d: Date, n: number) => new Date(d.getTime() + n * JOUR);
const RECUE = new Date("2026-09-01T09:00:00Z");
const FIN_RESERVATION = j(RECUE, 60); // 2026-10-31
const apporteur = (o: Ligne = {}) => ({
  prenom: "A",
  nom: "B",
  email: "a@b.fr",
  parrainId: null,
  signeParSocieteAt: null,
  ...o,
});
const pres = (o: Ligne = {}): Ligne => ({
  id: "P1",
  apporteurId: "APP1",
  siren: "123456782",
  denomination: "Acme",
  recueAt: RECUE,
  statut: "reservee",
  contactEnvoyeAt: null,
  confirmeeAt: null,
  confirmationTacite: false,
  protegeeJusquAt: null,
  prolongeeAt: null,
  personneEmail: "p@acme.fr",
  apporteur: apporteur(),
  ...o,
});
const reservation = (o: Ligne = {}): Ligne => ({
  presentationId: "P1",
  regle: "rendez_vous",
  reserveeJusquAt: FIN_RESERVATION,
  echueAt: null,
  rendezVousPrisAt: null,
  rendezVousAt: null,
  rendezVousCle: null,
  validationSource: null,
  valideeAt: null,
  ...o,
});
beforeEach(() => {
  delete process.env.APPORTEURS_VALIDATION_RDV;
  for (const k of [
    "pres",
    "res",
    "props",
    "commissions",
    "payees",
    "lignes",
    "devis",
    "apporteurs",
    "alertes",
    "audit",
  ] as const)
    db[k].length = 0;
  db.jobIds.clear();
  db.apresLecture = null;
  db.apresLectureRes = null;
  db.createErreur = null;
  db.erreurPour = null;
  vi.mocked(envoyer).mockClear();
});

/** Signature 2.8 dont le texte archivé porte la clause transitoire de l'article 13.5. */
const SIG28 = { version: "2.8", texte: `… 13.5 … ${MARQUEUR_CLAUSE_BASCULE} le jour où … …` };
const DIX_NOV = new Date("2026-11-10T09:00:00Z");
const VINGT_SIX = new Date("2026-11-26T08:00:00Z");
/** Fin du 30e jour suivant le 26/11/2026, minuit heure de Paris (UTC+1 en décembre). */
const FIN_JOUR_30 = new Date("2026-12-26T22:59:59.999Z");
const signe28 = (o: Ligne = {}) =>
  apporteur({
    statut: "signe",
    signatureApporteur: SIG28,
    signeParSocieteAt: new Date("2026-08-01T09:00:00Z"),
    ...o,
  });
const paul = (o: Ligne = {}) => pres({ recueAt: DIX_NOV, apporteur: signe28(), ...o });
const allume = () => {
  process.env.APPORTEURS_VALIDATION_RDV = "true";
};

describe("basculeVersRendezVous (décision pure)", () => {
  const base = {
    statut: "reservee",
    recueAt: DIX_NOV,
    apporteur: {
      statut: "signe",
      signature: SIG28,
    },
    silenceAtteint: false,
    aUneLigne: false,
    rebond: false,
    actif: true,
    maintenant: VINGT_SIX,
  };
  it("Paul : bascule, terme = fin du 60e jour à Paris (08/01/2027)", () => {
    const r = basculeVersRendezVous(base);
    expect(r).toEqual({ bascule: true, reserveeJusquAt: new Date("2027-01-08T22:59:59.999Z") });
  });
  it.each([
    ["interrupteur", { actif: false }],
    ["version", { apporteur: { ...base.apporteur, signature: { version: "2.6" } } }],
    ["version", { apporteur: { ...base.apporteur, signature: { version: "2.8" } } }],
    ["statut_apporteur", { apporteur: { ...base.apporteur, statut: "resilie" } }],
    ["silence_acquis", { silenceAtteint: true }],
    ["deja_reglee", { aUneLigne: true }],
    ["deja_reglee", { statut: "confirmee" }],
    ["rebond", { rebond: true }],
    ["terme_depasse", { recueAt: new Date("2026-09-20T09:00:00Z") }],
  ])("refus « %s »", (motif, o) => {
    expect(basculeVersRendezVous({ ...base, ...o })).toEqual({ bascule: false, motif });
  });
});

describe("clause transitoire dans le texte signé (art. 13.5)", () => {
  const base = {
    statut: "reservee",
    recueAt: DIX_NOV,
    apporteur: { statut: "signe", signature: SIG28 as unknown },
    silenceAtteint: false,
    aUneLigne: false,
    rebond: false,
    actif: true,
    maintenant: VINGT_SIX,
  };
  it("2.8 signée sans la clause → pas de bascule", () => {
    const signature = { version: "2.8", texte: "13.5 sans l'exception transitoire" };
    expect(basculeVersRendezVous({ ...base, apporteur: { ...base.apporteur, signature } })).toEqual(
      { bascule: false, motif: "version" },
    );
  });
  it("2.8 sans texte archivé → pas de bascule", () => {
    const signature = { version: "2.8" };
    expect(basculeVersRendezVous({ ...base, apporteur: { ...base.apporteur, signature } })).toEqual(
      { bascule: false, motif: "version" },
    );
  });
  it("2.9 sans la clause → pas de bascule non plus (le texte fait foi)", () => {
    const signature = { version: "2.9", texte: "autre texte" };
    expect(basculeVersRendezVous({ ...base, apporteur: { ...base.apporteur, signature } })).toEqual(
      { bascule: false, motif: "version" },
    );
  });
});

describe("terme d'une présentation basculée (art. 13.5 : au moins 30 jours)", () => {
  it("max(terme normal, bascule + 30 jours) : terme normal plus tardif → inchangé", () => {
    expect(termeApresBascule(DIX_NOV, VINGT_SIX)).toEqual(new Date("2027-01-08T22:59:59.999Z"));
  });
  it("terme normal plus proche (4 jours) → bascule + 30 jours", () => {
    const recue = new Date("2026-09-30T09:00:00Z"); // terme normal : 29/11
    expect(termeApresBascule(recue, VINGT_SIX)).toEqual(FIN_JOUR_30);
    const d = basculeVersRendezVous({
      statut: "reservee",
      recueAt: recue,
      apporteur: { statut: "signe", signature: SIG28 },
      silenceAtteint: false,
      aUneLigne: false,
      rebond: false,
      actif: true,
      maintenant: VINGT_SIX,
    });
    expect(d).toEqual({ bascule: true, reserveeJusquAt: FIN_JOUR_30 });
  });
});

describe("étape « bascule-regle-rendez-vous »", () => {
  it("terme court : la ligne enregistrée laisse 30 jours, et l'échéance ne la clôt pas avant", async () => {
    allume();
    db.pres.push(
      paul({
        recueAt: new Date("2026-10-01T09:00:00Z"),
        contactEnvoyeAt: new Date("2026-10-27T09:00:00Z"),
      }),
    );
    await passerReseauApporteurs(VINGT_SIX);
    expect(db.res[0]!.reserveeJusquAt).toEqual(FIN_JOUR_30);
    const b = await passerReseauApporteurs(new Date("2026-12-10T08:00:00Z"));
    expect(b.reservationsEchues).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
  });

  it("rendez-vous pris le dernier jour annoncé, à 20 h (Paris) → retenu", async () => {
    const { reservationOccupe } = await import("../regle-attribution");
    const recue = new Date("2026-09-30T09:00:00Z");
    const terme = termeApresBascule(recue, VINGT_SIX);
    const pris = new Date("2026-12-26T19:00:00Z"); // 20 h à Paris
    expect(pris.getTime()).toBeLessThanOrEqual(terme.getTime());
    expect(
      reservationOccupe(
        { recueAt: recue, reserveeJusquAt: terme, rendezVousEnAttentePrisAt: pris },
        new Date("2026-12-27T08:00:00Z"),
      ),
    ).toBe(true);
    expect(DELAI_MINIMAL_BASCULE_JOURS).toBe(30);
  });

  it("décision du 27/11 : à la bascule, AUCUN e-mail n'est envoyé à l'apporteur ; la présentation passe à la règle du rendez-vous (≥ 30 jours)", async () => {
    allume();
    db.pres.push(paul());
    const b = await passerReseauApporteurs(VINGT_SIX);
    await passerReseauApporteurs(j(VINGT_SIX, 1));
    expect(b.basculees).toBe(1);
    // La ligne de réservation existe, terme d'au moins 30 jours après la bascule.
    expect(db.res).toHaveLength(1);
    expect(db.res[0]!.reserveeJusquAt.getTime()).toBeGreaterThanOrEqual(j(VINGT_SIX, 30).getTime());
    // Aucun envoi à l'apporteur : ni `envoyer`, ni file d'e-mails vers lui.
    expect(vi.mocked(envoyer)).not.toHaveBeenCalled();
    expect(db.alertes.some((a) => a.to === "a@b.fr")).toBe(false);
    expect(db.alertes.some((a) => String(a.gabarit).startsWith("apporteur-presentation"))).toBe(
      false,
    );
  });

  it("apporteur qui passe en 2.8 APRÈS une première exécution : la bascule a lieu au passage suivant", async () => {
    allume();
    db.pres.push(paul({ apporteur: signe28({ signatureApporteur: { version: "2.6" } }) }));
    expect((await passerReseauApporteurs(VINGT_SIX)).basculees).toBe(0);
    expect(db.res).toHaveLength(0);
    db.pres[0]!.apporteur = signe28();
    const b = await passerReseauApporteurs(j(VINGT_SIX, 1));
    expect(b.basculees).toBe(1);
    expect(db.res[0]!.reserveeJusquAt.getTime()).toBeGreaterThanOrEqual(j(VINGT_SIX, 31).getTime());
  });

  it("alerte de lot : deux passages le même jour qui basculent des présentations différentes → deux alertes", async () => {
    allume();
    db.pres.push(paul());
    await passerReseauApporteurs(VINGT_SIX);
    db.pres.push(paul({ id: "P2", denomination: "Beta" }));
    await passerReseauApporteurs(j(VINGT_SIX, 0.1));
    const lots = db.alertes.filter((a) => a.jobId.startsWith("apporteur-bascule-lot-"));
    expect(lots).toHaveLength(2);
    expect(new Set(lots.map((l) => l.jobId)).size).toBe(2);
    expect(String(lots[1]!.payload.message)).toContain("Beta");
  });

  it("alerte de lot : le jour de la clé est celui de Paris (23 h 30 UTC le 26 → 27 novembre)", async () => {
    allume();
    db.pres.push(paul());
    await passerReseauApporteurs(new Date("2026-11-26T23:30:00Z"));
    const lot = db.alertes.find((a) => a.jobId.startsWith("apporteur-bascule-lot-"))!;
    expect(lot.jobId).toMatch(/^apporteur-bascule-lot-2026-11-27-[0-9a-f]{12}$/);
  });

  it("erreur non-P2002 au milieu d'une page : comptée au bilan, les suivantes basculent quand même", async () => {
    allume();
    db.pres.push(
      paul({ id: "P1", recueAt: new Date("2026-11-01T09:00:00Z") }),
      paul({ id: "P2", recueAt: new Date("2026-11-02T09:00:00Z") }),
      paul({ id: "P3", recueAt: new Date("2026-11-03T09:00:00Z") }),
    );
    db.createErreur = { code: "P2034" };
    db.erreurPour = "P2";
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.erreurs).toBe(1);
    expect(b.basculees).toBe(2);
    expect(db.res.map((r) => r.presentationId).sort()).toEqual(["P1", "P3"]);
  });

  it("course avec une confirmation manuelle (console) entre la lecture et l'écriture : aucune ligne, la confirmée reste intacte", async () => {
    allume();
    db.pres.push(paul());
    db.apresLecture = (where) => {
      if (where.statut !== "reservee") return;
      db.apresLecture = null;
      db.pres[0]!.statut = "confirmee";
    };
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(0);
    expect(db.res).toHaveLength(0);
    expect(db.pres[0]!.statut).toBe("confirmee");
  });

  it("Paul : une ligne rendez_vous est créée, statut et dates inchangés, pas de confirmation par le silence ensuite", async () => {
    allume();
    db.pres.push(paul());
    const avant = { ...db.pres[0]! };
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b).toMatchObject({ basculees: 1, basculeesEcartees: 0, confirmeesTacites: 0 });
    expect(db.res).toHaveLength(1);
    expect(db.res[0]).toMatchObject({
      presentationId: "P1",
      regle: "rendez_vous",
      reserveeJusquAt: new Date("2027-01-08T22:59:59.999Z"),
    });
    expect(db.pres[0]).toMatchObject({ statut: "reservee", recueAt: avant.recueAt });
    expect(db.audit.some((a) => a.action === "apporteur.presentation_basculee_rendez_vous")).toBe(
      true,
    );
    // Au 10/01, la date du silence est passée : sans ligne elle serait confirmée ; avec, elle est close par l'échéance.
    const b2 = await passerReseauApporteurs(new Date("2027-01-10T08:00:00Z"));
    expect(b2.confirmeesTacites).toBe(0);
    expect(b2.reservationsEchues).toBe(1);
    expect(db.pres[0]!.statut).toBe("terminee");
  });

  it("la date du silence tombe aujourd'hui : bascule, et PAS confirmée dans le même passage", async () => {
    allume();
    db.pres.push(
      paul({
        recueAt: new Date("2026-10-01T09:00:00Z"),
        contactEnvoyeAt: new Date("2026-10-27T09:00:00Z"),
      }),
    );
    // contact + 30 j = 26/11 : confirmerait ce jour ; le terme (30/11) n'est pas dépassé.
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(1);
    expect(b.confirmeesTacites).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
  });

  it("la date du silence est DÉJÀ atteinte (passage à 10 h, silence à 9 h) : pas de bascule, la confirmation tacite joue", async () => {
    allume();
    db.pres.push(
      paul({
        recueAt: new Date("2026-10-01T09:00:00Z"),
        contactEnvoyeAt: new Date("2026-10-27T09:00:00Z"),
      }),
    );
    const b = await passerReseauApporteurs(new Date("2026-11-26T10:00:00Z"));
    expect(b).toMatchObject({ basculees: 0, confirmeesTacites: 1 });
    expect(db.res).toHaveLength(0);
    expect(db.pres[0]!.statut).toBe("confirmee");
  });

  it("une alerte interne unique par passage liste les présentations basculées (rendez-vous déjà tenus à vérifier)", async () => {
    allume();
    db.pres.push(paul());
    await passerReseauApporteurs(VINGT_SIX);
    await passerReseauApporteurs(VINGT_SIX);
    const lots = db.alertes.filter((a) => a.jobId.startsWith("apporteur-bascule-lot-"));
    expect(lots).toHaveLength(1);
    expect(String(lots[0]!.payload.message)).toContain("Acme");
  });

  it("déjà attribuée définitivement (silence, réponse, prolongation) : objet strictement identique, aucune ligne", async () => {
    allume();
    db.pres.push(
      paul({ id: "C1", statut: "confirmee", confirmationTacite: true, confirmeeAt: DIX_NOV }),
      paul({ id: "C2", statut: "confirmee", confirmationTacite: false, confirmeeAt: DIX_NOV }),
      paul({
        id: "C3",
        statut: "confirmee",
        prolongeeAt: DIX_NOV,
        motifProlongation: "devis en cours",
        protegeeJusquAt: new Date("2027-06-01T00:00:00Z"),
      }),
    );
    const avant = JSON.stringify(db.pres);
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(0);
    expect(db.res).toHaveLength(0);
    expect(JSON.stringify(db.pres)).toBe(avant);
  });

  it.each([undefined, "false", "TRUE", "1", " true"])(
    "interrupteur %s : aucune ligne, le silence joue comme avant",
    async (v) => {
      if (v !== undefined) process.env.APPORTEURS_VALIDATION_RDV = v;
      // Reçue le 10/11 : silence non acquis, elle basculerait si l'interrupteur était allumé.
      db.pres.push(paul());
      const b = await passerReseauApporteurs(VINGT_SIX);
      expect(b.basculees).toBe(0);
      expect(db.res).toHaveLength(0);
      expect(b.confirmeesTacites).toBe(0);
    },
  );

  it("interrupteur éteint : le silence déjà acquis joue comme avant", async () => {
    db.pres.push(paul({ recueAt: j(VINGT_SIX, -61) }));
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(0);
    expect(db.res).toHaveLength(0);
    expect(b.confirmeesTacites).toBe(1);
  });

  it.each([["2.6"], ["2.7"], [undefined], ["n'importe quoi"]])(
    "apporteur en version %s : ancienne règle intacte, aucune ligne",
    async (version) => {
      allume();
      db.pres.push(
        paul({
          apporteur: signe28({ signatureApporteur: version ? { version } : null }),
        }),
      );
      const b = await passerReseauApporteurs(VINGT_SIX);
      expect(b.basculees).toBe(0);
      expect(db.res).toHaveLength(0);
    },
  );

  it("table de réservation absente (P2021) : l'étape s'arrête sans erreur au bilan", async () => {
    allume();
    db.pres.push(paul());
    db.createErreur = { code: "P2021" };
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b).toMatchObject({ basculees: 0, erreurs: 0 });
  });

  it("apporteur résilié : aucune ligne ; en préavis (toujours signé) : bascule", async () => {
    allume();
    db.pres.push(
      paul({ id: "R", apporteur: signe28({ statut: "resilie" }) }),
      paul({ id: "S", apporteur: signe28({ preavis: true }) }),
    );
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(1);
    expect(db.res.map((r) => r.presentationId)).toEqual(["S"]);
  });

  it.each(["dementie", "deja_connue", "hors_champ", "terminee"])(
    "statut %s : aucune ligne",
    async (statut) => {
      allume();
      db.pres.push(paul({ statut }));
      await passerReseauApporteurs(VINGT_SIX);
      expect(db.res).toHaveLength(0);
    },
  );

  it("terme dépassé alors que le silence n'est pas atteint : pas de bascule, comptée, sans alerte (le silence confirme le lendemain)", async () => {
    allume();
    db.pres.push(paul({ recueAt: new Date("2026-09-27T09:00:00Z") }));
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b).toMatchObject({ basculees: 0, basculeesEcartees: 1 });
    expect(db.res).toHaveLength(0);
    expect(db.alertes.filter((a) => a.jobId.startsWith("apporteur-bascule-ecartee"))).toHaveLength(
      0,
    );
  });

  it("prise de contact revenue en erreur : écartée et signalée, pas de ligne", async () => {
    allume();
    db.pres.push(paul());
    vi.mocked(idsPriseDeContactRebondie).mockResolvedValueOnce(new Set(["P1"]));
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b).toMatchObject({ basculees: 0, basculeesEcartees: 1 });
    expect(db.res).toHaveLength(0);
    await passerReseauApporteurs(VINGT_SIX);
    expect(
      db.alertes.filter((a) => a.jobId === "apporteur-bascule-ecartee-rebond-P1"),
    ).toHaveLength(1);
  });

  it("rejeu et ligne native : un second passage ne crée rien, une ligne native n'est pas modifiée", async () => {
    allume();
    db.pres.push(paul(), paul({ id: "P2" }));
    const native = reservation({ presentationId: "P2", reserveeJusquAt: j(VINGT_SIX, 40) });
    db.res.push(native);
    const copie = JSON.stringify(native);
    expect((await passerReseauApporteurs(VINGT_SIX)).basculees).toBe(1);
    expect((await passerReseauApporteurs(VINGT_SIX)).basculees).toBe(0);
    expect(db.res).toHaveLength(2);
    expect(JSON.stringify(db.res.find((r) => r.presentationId === "P2"))).toBe(copie);
  });

  it("concurrence : une ligne née entre la lecture et l'écriture empêche la création, état cohérent", async () => {
    allume();
    db.pres.push(paul());
    // Née APRÈS le pré-filtre des réservations : seule la garde dans la transaction peut la voir.
    db.apresLectureRes = () => {
      db.apresLectureRes = null;
      db.res.push(reservation({ reserveeJusquAt: j(VINGT_SIX, 40) }));
    };
    const b = await passerReseauApporteurs(VINGT_SIX);
    expect(b.basculees).toBe(0);
    expect(db.res).toHaveLength(1);
    expect(db.res[0]!.reserveeJusquAt).toEqual(j(VINGT_SIX, 40));
  });

  it("rien n'est purgé : aucun delete, aucune modification de la présentation par l'étape", async () => {
    allume();
    db.pres.push(paul());
    const avant = JSON.stringify(db.pres);
    await passerReseauApporteurs(VINGT_SIX);
    expect(JSON.stringify(db.pres)).toBe(avant);
    expect(db.commissions).toHaveLength(0);
  });
});
