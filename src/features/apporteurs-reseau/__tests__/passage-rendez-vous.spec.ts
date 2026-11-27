/**
 * Lot 4 — validation par rendez-vous : passage quotidien, argent, résiliation.
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
    apporteurResiliation: { updateMany: vi.fn(async () => ({ count: 0 })) },
    activityLog: { create: vi.fn(async () => ({})) },
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

import { passerFacturationApporteurs, passerReseauApporteurs } from "../passage-quotidien";
import { planResiliation, executerResiliation } from "../resiliation";
import { alerterDeclarationsSansReponse } from "../attribution-annonce";
import { regleDe } from "../regle-attribution";
import { envoyer } from "../envois";

const JOUR = 86_400_000;
const j = (d: Date, n: number) => new Date(d.getTime() + n * JOUR);
const RECUE = new Date("2026-09-01T09:00:00Z");
const FIN_RESERVATION = j(RECUE, 60); // 2026-10-31
const MAINT = new Date("2026-12-20T08:00:00Z"); // J+110
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
const unPaiement = (acceptedAt: Date, siren = "123456782") => {
  db.payees = [{ id: "F1", devisId: "D1" }];
  db.lignes = [
    {
      id: "F1",
      devisId: "D1",
      statut: "payee",
      avoirDeId: null,
      activite: "audit",
      montantHtCents: 100_000,
      emiseAt: j(acceptedAt, 1),
      devis: { acceptedAt, montantTotalHtCents: 100_000 },
      client: { siren, siret: null },
    },
  ];
};

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
  ] as const)
    db[k].length = 0;
  db.jobIds.clear();
  db.apresLecture = null;
  db.apresLectureRes = null;
  vi.mocked(envoyer).mockClear();
});

describe("confirmation par le silence : intacte pour 2.6, jamais pour une réservation", () => {
  it("présentation 2.6 (sans ligne de réservation) : confirmée à J+60, comme avant", async () => {
    db.pres.push(pres({ recueAt: j(MAINT, -61) }));
    const b = await passerReseauApporteurs(MAINT);
    expect(b.confirmeesTacites).toBe(1);
    expect(db.pres[0]).toMatchObject({ statut: "confirmee", confirmationTacite: true });
    expect(db.pres[0]!.protegeeJusquAt).toBeInstanceOf(Date);
  });

  it.each([undefined, "true", "false"])(
    "présentation avec ligne de réservation : jamais confirmée par silence (interrupteur %s)",
    async (valeur) => {
      if (valeur !== undefined) process.env.APPORTEURS_VALIDATION_RDV = valeur;
      // Contactée il y a 40 jours ET déclarée il y a 90 jours : les deux chemins de la confirmation tacite.
      db.pres.push(pres({ recueAt: j(MAINT, -90), contactEnvoyeAt: j(MAINT, -40) }));
      db.pres.push(pres({ id: "P2", recueAt: j(MAINT, -90), contactEnvoyeAt: null }));
      db.res.push(
        reservation({ reserveeJusquAt: j(MAINT, 100) }),
        reservation({ presentationId: "P2", reserveeJusquAt: j(MAINT, 100) }),
      );
      const b = await passerReseauApporteurs(MAINT);
      expect(b.confirmeesTacites).toBe(0);
      expect(db.pres.map((p) => p.statut)).toEqual(["reservee", "reservee"]);
    },
  );

  it("la garde est RELUE avant l'écriture : une ligne de réservation née entre la lecture et l'écriture empêche la confirmation", async () => {
    db.pres.push(pres({ recueAt: j(MAINT, -61) }));
    // Née APRÈS la première lecture des réservations (celle qui prépare la liste) : seule la
    // relecture juste avant l'écriture peut la voir.
    db.apresLectureRes = () => {
      db.apresLectureRes = null;
      db.res.push(reservation({ reserveeJusquAt: j(MAINT, 100) }));
    };
    const b = await passerReseauApporteurs(MAINT);
    expect(b.confirmeesTacites).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
  });

  it("sans ligne de réservation et sans bascule possible (apporteur sans contrat 2.8), rien ne change, interrupteur allumé ou non", async () => {
    process.env.APPORTEURS_VALIDATION_RDV = "true";
    db.pres.push(pres({ recueAt: j(MAINT, -20) }));
    const b = await passerReseauApporteurs(MAINT);
    expect(b).toMatchObject({ confirmeesTacites: 0, reservationsEchues: 0, commissionsCreees: 0 });
    expect(db.pres[0]!.statut).toBe("reservee");
    expect(regleDe({ version: "2.7" }, true)).toBeNull();
    expect(regleDe({ version: "2.8" }, false)).toBeNull();
    expect(regleDe({ version: "2.8" }, true)).toBe("rendez_vous");
  });
});

describe("échéance de la réservation", () => {
  it("échue sans rendez-vous : `echueAt` posé puis statut `terminee` ; rejouée : sans effet", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    const b1 = await passerReseauApporteurs(MAINT);
    expect(b1.reservationsEchues).toBe(1);
    expect(db.pres[0]!.statut).toBe("terminee");
    const echueAt = db.res[0]!.echueAt as Date;
    expect(echueAt.getTime()).toBe(MAINT.getTime());
    const b2 = await passerReseauApporteurs(j(MAINT, 1));
    expect(b2.reservationsEchues).toBe(0);
    expect(db.res[0]!.echueAt).toEqual(echueAt);
  });

  it("pas échue (J+55) : rien, et AUCUN message à l'apporteur à l'approche de la fin", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    const b = await passerReseauApporteurs(j(RECUE, 55));
    expect(b.reservationsEchues).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
    expect(envoyer).not.toHaveBeenCalled();
    expect(db.alertes.filter((a) => a.to !== "williams@x.test")).toEqual([]);
  });

  it("validation et échéance simultanées : une seule gagne (la validation passe entre la lecture et l'écriture)", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    db.apresLecture = (where) => {
      if (!where.id) return; // la lecture de l'échéance (présentations par identifiant)
      db.apresLecture = null;
      // Ce que fera le lot 5 : écriture conditionnelle sur la réservation, puis la présentation.
      Object.assign(db.res[0]!, { valideeAt: MAINT, validationSource: "calendly" });
      Object.assign(db.pres[0]!, {
        statut: "confirmee",
        confirmeeAt: MAINT,
        protegeeJusquAt: j(MAINT, 180),
      });
    };
    const b = await passerReseauApporteurs(MAINT);
    expect(b.reservationsEchues).toBe(0);
    expect(db.res[0]!.echueAt).toBeNull();
    expect(db.pres[0]!.statut).toBe("confirmee");
  });

  it("l'échéance gagne : la présentation n'est plus `reservee` (résiliée entre-temps) → rien n'est écrit, `echueAt` reste vide", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    db.apresLecture = (where) => {
      if (!where.id) return;
      db.apresLecture = null;
      db.pres[0]!.statut = "dementie";
    };
    const b = await passerReseauApporteurs(MAINT);
    expect(b.reservationsEchues).toBe(0);
    expect(db.res[0]!.echueAt).toBeNull();
    expect(db.pres[0]!.statut).toBe("dementie");
  });

  it("verdict D : lecture TRIÉE (échéance la plus ancienne d'abord) et par pages, jusqu'au bout", async () => {
    const { prisma } = await import("@/lib/prisma");
    const fm = vi.mocked(prisma.presentationReservation.findMany);
    fm.mockClear();
    // 500 réservations suspendues (rendez-vous pris, pas encore tenu) puis une échue « libre ».
    for (let i = 0; i < 500; i++) {
      const id = `S${String(i).padStart(3, "0")}`;
      db.pres.push(pres({ id }));
      db.res.push(
        reservation({
          presentationId: id,
          reserveeJusquAt: j(MAINT, -30),
          rendezVousPrisAt: j(RECUE, 10),
        }),
      );
    }
    db.pres.push(pres({ id: "Z" }));
    db.res.push(reservation({ presentationId: "Z", reserveeJusquAt: j(MAINT, -5) }));
    // Le faux ne sait ni trier ni borner : il applique l'ordre et la taille demandés.
    fm.mockImplementation((async (a: { where: Ligne; orderBy?: unknown; take?: number }) => {
      const r = db.res
        .filter((x) => ok(x, a.where))
        .sort(
          (x, y) =>
            x.reserveeJusquAt.getTime() - y.reserveeJusquAt.getTime() ||
            String(x.presentationId).localeCompare(String(y.presentationId)),
        )
        .slice(0, a.take ?? Infinity)
        .map((x) => ({ ...x }));
      return r;
    }) as never);
    const b = await passerReseauApporteurs(MAINT);
    const appelEcheances = fm.mock.calls.find(
      (c) => (c[0] as { orderBy?: unknown }).orderBy !== undefined,
    );
    expect((appelEcheances![0] as { orderBy: unknown }).orderBy).toEqual([
      { reserveeJusquAt: "asc" },
      { presentationId: "asc" },
    ]);
    expect(b.reservationsEchues).toBe(1);
    expect(db.pres.find((p) => p.id === "Z")).toMatchObject({ statut: "terminee" });
    fm.mockReset();
    fm.mockImplementation((async (a: { where: Ligne }) => {
      const r = db.res.filter((x) => ok(x, a.where)).map((x) => ({ ...x }));
      db.apresLectureRes?.(a.where);
      return r;
    }) as never);
  });

  it("un rendez-vous pris pendant la réservation et pas encore tenu garde l'entreprise", async () => {
    db.pres.push(pres());
    db.res.push(reservation({ rendezVousPrisAt: j(RECUE, 40) }));
    const b = await passerReseauApporteurs(MAINT);
    expect(b.reservationsEchues).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
    expect(db.res[0]!.echueAt).toBeNull();
  });

  it("proposition recevable non écartée : l'échéance est suspendue, UNE alerte interne, aucun e-mail à l'apporteur", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    db.props.push({
      presentationId: "P1",
      rendezVousCle: "calendly:E1",
      prisAt: j(RECUE, 20),
      rendezVousAt: j(RECUE, 70),
      ecarteeAt: null,
      retenueAt: null,
    });
    const b1 = await passerReseauApporteurs(MAINT);
    const b2 = await passerReseauApporteurs(j(MAINT, 1));
    expect(b1.reservationsEchues + b2.reservationsEchues).toBe(0);
    expect(db.pres[0]!.statut).toBe("reservee");
    const alertes = db.alertes.filter((a) => a.jobId.includes("echeance"));
    expect(alertes).toHaveLength(1);
    expect(alertes[0]).toMatchObject({ gabarit: "qualiopi-alerte-interne", to: "williams@x.test" });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("proposition écartée, ou prise avant la saisie / après la réservation : l'échéance a lieu", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    db.props.push(
      {
        presentationId: "P1",
        rendezVousCle: "calendly:E1",
        prisAt: j(RECUE, 20),
        ecarteeAt: MAINT,
        retenueAt: null,
      },
      {
        presentationId: "P1",
        rendezVousCle: "calendly:E2",
        prisAt: j(RECUE, -3),
        ecarteeAt: null,
        retenueAt: null,
      },
      {
        presentationId: "P1",
        rendezVousCle: "calendly:E3",
        prisAt: j(RECUE, 61),
        ecarteeAt: null,
        retenueAt: null,
      },
    );
    const b = await passerReseauApporteurs(MAINT);
    expect(b.reservationsEchues).toBe(1);
    expect(db.pres[0]!.statut).toBe("terminee");
  });

  it("prolongation refusée à une réservation non validée : l'échéance clôt, sans lire les faits de la Société", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    const b = await passerReseauApporteurs(MAINT);
    expect(b.prolongees).toBe(0);
    expect(db.pres[0]!).toMatchObject({ statut: "terminee", prolongeeAt: null });
    expect(db.pres[0]!.protegeeJusquAt).toBeNull();
  });
});

describe("commissions d'une réservation (argent)", () => {
  it("commande J+30, facture payée J+120, présentation échue : commission créée, une seule, rejeu = 0", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    unPaiement(j(RECUE, 30));
    const b1 = await passerReseauApporteurs(j(RECUE, 120));
    expect(db.pres[0]!.statut).toBe("terminee");
    expect(b1.commissionsCreees).toBe(1);
    expect(db.commissions).toHaveLength(1);
    expect(db.commissions[0]).toMatchObject({
      apporteurId: "APP1",
      presentationId: "P1",
      montantCents: 30_000,
    });
    const b2 = await passerReseauApporteurs(j(RECUE, 121));
    const b3 = await passerFacturationApporteurs(j(RECUE, 121));
    expect(b2.commissionsCreees + b3.commissionsCreees).toBe(0);
    expect(db.commissions).toHaveLength(1);
  });

  it("deux passages simultanés : une seule commission", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    unPaiement(j(RECUE, 30));
    await Promise.all([
      passerFacturationApporteurs(j(RECUE, 120)),
      passerFacturationApporteurs(j(RECUE, 120)),
      passerReseauApporteurs(j(RECUE, 120)),
    ]);
    expect(db.commissions).toHaveLength(1);
  });

  it("commande signée APRÈS la fin de la réservation, sans rendez-vous : aucune commission", async () => {
    db.pres.push(pres({ statut: "terminee" }));
    db.res.push(reservation({ echueAt: j(RECUE, 61) }));
    unPaiement(j(RECUE, 65));
    await passerReseauApporteurs(MAINT);
    expect(db.commissions).toEqual([]);
  });

  it("commande signée avant la saisie : aucune commission", async () => {
    db.pres.push(pres());
    db.res.push(reservation({ reserveeJusquAt: j(MAINT, 50) }));
    unPaiement(j(RECUE, -1));
    await passerReseauApporteurs(MAINT);
    expect(db.commissions).toEqual([]);
  });

  it("manquement (`dementie`) ou déjà connue / hors champ, même avec une ligne de réservation : aucune commission", async () => {
    for (const statut of ["dementie", "deja_connue", "hors_champ"]) {
      db.pres.length = 0;
      db.res.length = 0;
      db.pres.push(pres({ statut }));
      db.res.push(reservation());
      unPaiement(j(RECUE, 30));
      await passerReseauApporteurs(MAINT);
      expect(db.commissions).toEqual([]);
    }
  });

  it("résilié à J+20 : la commande de J+10 est couverte, celle de J+25 non", async () => {
    const resil = j(RECUE, 20);
    db.pres.push(pres({ statut: "terminee" }));
    db.res.push(reservation({ reserveeJusquAt: resil }));
    unPaiement(j(RECUE, 10));
    await passerFacturationApporteurs(MAINT);
    expect(db.commissions).toHaveLength(1);
    db.commissions.length = 0;
    unPaiement(j(RECUE, 25));
    await passerFacturationApporteurs(MAINT);
    expect(db.commissions).toEqual([]);
  });

  it("JAMAIS deux apporteurs commissionnés pour une même entreprise : la commande est déjà commissionnée à un autre", async () => {
    db.pres.push(
      pres(),
      pres({
        id: "P2",
        apporteurId: "APP2",
        statut: "confirmee",
        recueAt: j(RECUE, 10),
        confirmeeAt: j(RECUE, 12),
        protegeeJusquAt: j(RECUE, 300),
      }),
    );
    db.res.push(reservation({ reserveeJusquAt: j(MAINT, 10) }));
    unPaiement(j(RECUE, 30));
    db.commissions.push({ factureId: "F1", apporteurId: "APP2", parrainage: false });
    await passerFacturationApporteurs(MAINT);
    expect(db.commissions.filter((c) => !c.parrainage).map((c) => c.apporteurId)).toEqual(["APP2"]);
    expect(db.alertes.some((a) => a.jobId.includes("deux-apporteurs"))).toBe(true);
  });

  it("deux présentations qui couvrent la même commande : un seul apporteur est commissionné (la plus ancienne)", async () => {
    db.pres.push(
      pres(),
      pres({ id: "P2", apporteurId: "APP2", recueAt: j(RECUE, 10), denomination: "Acme" }),
    );
    db.res.push(
      reservation({ reserveeJusquAt: j(MAINT, 10) }),
      reservation({ presentationId: "P2", reserveeJusquAt: j(MAINT, 10) }),
    );
    unPaiement(j(RECUE, 30));
    await passerFacturationApporteurs(MAINT);
    expect(new Set(db.commissions.map((c) => c.apporteurId)).size).toBe(1);
  });
});

describe("commande signée pendant la réservation, sans rendez-vous", () => {
  it("valide l'entreprise à la date de signature (six mois), alerte unique par devis, aucun e-mail à l'apporteur", async () => {
    const signee = j(RECUE, 30);
    db.pres.push(pres());
    db.res.push(reservation({ reserveeJusquAt: j(MAINT, 10) }));
    db.devis.push({ id: "D1", acceptedAt: signee, client: { siren: "123456782", siret: null } });
    const b1 = await passerReseauApporteurs(j(RECUE, 32));
    const b2 = await passerReseauApporteurs(j(RECUE, 33));
    expect(b1.commandesSigneesAnnoncees + b2.commandesSigneesAnnoncees).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
    expect(db.pres[0]).toMatchObject({ statut: "confirmee" });
    expect((db.pres[0]!.protegeeJusquAt as Date).toISOString()).toBe("2027-04-01T09:00:00.000Z");
    expect(db.res[0]).toMatchObject({ validationSource: "commande" });
    expect(db.res[0]!.valideeAt).toBeInstanceOf(Date);
    expect(
      db.alertes.filter((a) => a.jobId === "apporteur-commande-en-reservation-D1"),
    ).toHaveLength(1);
  });

  it("verdict G : l'alerte a ÉCHOUÉ au passage de la validation → au suivant, toujours aucun e-mail « commande signée », l'alerte est retentée", async () => {
    const signee = j(RECUE, 30);
    db.pres.push(pres());
    db.res.push(reservation({ reserveeJusquAt: j(MAINT, 10) }));
    db.devis.push({ id: "D1", acceptedAt: signee, client: { siren: "123456782", siret: null } });
    const { enqueueEmail } = await import("@/server/queue/queues");
    vi.mocked(enqueueEmail).mockRejectedValueOnce(new Error("Redis indisponible"));
    await passerReseauApporteurs(j(RECUE, 32));
    expect(db.pres[0]).toMatchObject({ statut: "confirmee" });
    expect(db.res[0]).toMatchObject({ validationSource: "commande", valideeParId: "systeme" });
    expect(db.alertes).toHaveLength(0);
    await passerReseauApporteurs(j(RECUE, 33));
    expect(envoyer).not.toHaveBeenCalled();
    expect(
      db.alertes.filter((a) => a.jobId === "apporteur-commande-en-reservation-D1"),
    ).toHaveLength(1);
  });

  it("une commande signée APRÈS la validation (protection en cours) reçoit bien son annonce", async () => {
    db.pres.push(
      pres({
        statut: "confirmee",
        confirmeeAt: j(RECUE, 30),
        protegeeJusquAt: j(RECUE, 210),
      }),
    );
    db.res.push(
      reservation({
        validationSource: "commande",
        valideeAt: j(RECUE, 31),
        valideeParId: "systeme",
      }),
    );
    db.devis.push({
      id: "D2",
      acceptedAt: j(RECUE, 40),
      client: { siren: "123456782", siret: null },
    });
    await passerReseauApporteurs(j(RECUE, 41));
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("l'échéance et la validation par commande ne gagnent jamais toutes les deux", async () => {
    db.pres.push(pres());
    db.res.push(reservation());
    db.devis.push({
      id: "D1",
      acceptedAt: j(RECUE, 59),
      client: { siren: "123456782", siret: null },
    });
    await passerReseauApporteurs(j(RECUE, 61));
    const r = db.res[0]!;
    expect(!!r.echueAt && !!r.valideeAt).toBe(false);
  });
});

describe("résiliation", () => {
  it("planResiliation ramène la fin de réservation à maintenant, jamais plus tard", () => {
    const maintenant = j(RECUE, 20);
    const plan = planResiliation(
      [
        { id: "A", statut: "reservee", protegeeJusquAt: null, reserveeJusquAt: FIN_RESERVATION },
        { id: "B", statut: "reservee", protegeeJusquAt: null, reserveeJusquAt: j(RECUE, 10) },
        { id: "C", statut: "reservee", protegeeJusquAt: null },
      ],
      maintenant,
    );
    expect(plan.find((p) => p.id === "A")!.reserveeJusquAt).toEqual(maintenant);
    expect(plan.find((p) => p.id === "B")!.reserveeJusquAt).toEqual(j(RECUE, 10));
    expect(plan.find((p) => p.id === "C")!.reserveeJusquAt ?? null).toBeNull();
  });

  it("executerResiliation écrit la fin de réservation ramenée, et la présentation passe `terminee`", async () => {
    db.apporteurs.push({ id: "APP1", statut: "signe" });
    db.pres.push(pres());
    db.res.push(reservation());
    const maintenant = j(RECUE, 20);
    const r = await executerResiliation("APP1", maintenant, maintenant);
    expect(r.ok).toBe(true);
    expect(db.res[0]!.reserveeJusquAt).toEqual(maintenant);
    expect(db.pres[0]!.statut).toBe("terminee");
  });
});

describe("alerte interne « déclaration sans réponse » : le texte suit la règle", () => {
  it("avec réservation : parle de la réservation, jamais de confirmation réputée acquise", async () => {
    db.pres.push(pres({ recueAt: j(MAINT, -16) }));
    db.res.push(reservation({ reserveeJusquAt: j(MAINT, 44) }));
    await alerterDeclarationsSansReponse(MAINT);
    const m = String(db.alertes[0]!.payload.message);
    expect(m).toMatch(/réservée jusqu'au/);
    expect(m).not.toMatch(/réputée confirmée|art\. 3\.2/);
  });

  it("sans réservation : le texte d'avant (art. 3.2)", async () => {
    db.pres.push(pres({ recueAt: j(MAINT, -16) }));
    await alerterDeclarationsSansReponse(MAINT);
    expect(String(db.alertes[0]!.payload.message)).toMatch(/réputée confirmée/);
  });
});
