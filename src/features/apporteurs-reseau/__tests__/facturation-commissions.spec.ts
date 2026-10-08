import { beforeEach, describe, expect, it, vi } from "vitest";

// Commission = une ligne de la « base » en mémoire ci-dessous : les requêtes de `facturation.ts` et
// de `commissions.ts` sont interprétées pour de vrai (égalité, `not: null`, `in`, `OR`, `startsWith`).
interface Ligne {
  id: string;
  apporteurId: string;
  statut: string;
  montantCents: number | null;
  autofactureNumero: string | null;
  autofactureEmiseAt: Date | null;
  avoirNumero: string | null;
  autofactureAttenteMotif: string | null;
  autofactureAttenteDepuis: Date | null;
  litigeDepuis: Date | null;
  litigeMotif: string | null;
  releveMois: string | null;
  verseeAt: Date | null;
  majAt: Date;
  activite: string;
  /** Date de création (reprise : repère des délais de l'art. 12.4). */
  creeAt?: Date;
  palier: string | null;
  parrainage: boolean;
  prixPublicHtCents: number | null;
  factureHtCents: number;
  factureId: string;
  prestationRealiseeAt: Date | null;
  prestationRealiseePar: string | null;
}

const etat = vi.hoisted(() => ({
  lignes: [] as unknown[],
  stockage: "ok" as "ok" | "ko",
  pdfs: [] as string[],
  envoyes: [] as Array<Record<string, unknown>>,
  confirmations: [] as Array<Record<string, unknown>>,
  alertes: [] as Array<{ jobId: string; payload: Record<string, unknown> }>,
  jobIds: new Set<string>(),
  cumulCents: 0,
  piecesValides: true,
  maintenant: new Date(),
  apporteurs: {} as Record<string, Record<string, unknown>>,
  colonneLitigeAbsente: false,
  factures: {} as Record<
    string,
    {
      devisId?: string | null;
      session?: { statut: string; dateFin: Date } | null;
      enrollment?: { statut: string; session: { statut: string; dateFin: Date } } | null;
    }
  >,
  journal: [] as Array<Record<string, unknown>>,
  registre: ((siren: string) => ({ ok: true, entreprise: { siren, active: true } })) as (
    siren: string,
  ) => unknown,
  sentry: [] as string[],
}));

vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(async (siren: string) => etat.registre(siren)),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({
  captureWorkerError: vi.fn((_a: string, _b: string, _c: unknown, err: Error) => {
    etat.sentry.push(err.message);
  }),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "will@interne",
}));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({
  envoyer: vi.fn(async (e: Record<string, unknown>) => {
    etat.envoyes.push(e);
    if (typeof e["jobId"] === "string") etat.jobIds.add(e["jobId"]);
    return "envoye";
  }),
  envoyerConfirmationVirement: vi.fn(async (e: Record<string, unknown>) => {
    etat.confirmations.push(e);
    return "envoye";
  }),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (
      _g: string,
      _d: string,
      _l: string,
      payload: Record<string, unknown>,
      opts: { jobId: string },
    ) => {
      etat.alertes.push({ jobId: opts.jobId, payload });
      etat.jobIds.add(opts.jobId);
      return { enqueued: true };
    },
  ),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Axion IA" }),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: async () => ({ buffer: Buffer.from("pdf") }),
  storeAndSignPdf: vi.fn(async (_b: Buffer, key: string) => {
    if (etat.stockage === "ko") return null;
    etat.pdfs.push(key);
    return "https://signe";
  }),
}));
vi.mock("@/server/qualiopi/documents/templates/autofacture-honoraires", () => ({
  AutofactureHonorairesPdf: () => null,
}));

type Valeur = unknown;
function correspond(l: Record<string, Valeur>, where: Record<string, Valeur>): boolean {
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Array<Record<string, Valeur>>).some((w) => correspond(l, w));
    const v = l[cle];
    if (cond === null) return v === null;
    // Une date se compare par sa valeur, comme en base.
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, Valeur>;
      if ("in" in c) return (c["in"] as Valeur[]).includes(v);
      if ("not" in c) return c["not"] === null ? v !== null : v !== c["not"];
      if ("gt" in c) return typeof v === "string" && v > String(c["gt"]);
      if ("startsWith" in c) return typeof v === "string" && v.startsWith(String(c["startsWith"]));
      return true;
    }
    return v === cond;
  });
}
const lignes = () => etat.lignes as Ligne[];

vi.mock("@/lib/prisma", () => {
  const prisma = {
    // SIRET de l'établissement (2026-10-08) : aucun dans ces scénarios.
    apporteurReseauSiret: { findUnique: vi.fn(async () => null) },
    apporteurReseau: {
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async (a: { where: { id: string } }) => ({
        id: a.where.id,
        prenom: a.where.id === "APP2" ? "Paul" : "Jeanne",
        nom: "Martin",
        email: `${a.where.id.toLowerCase()}@m.fr`,
        statut: a.where.id === "APP3" ? "resilie" : "signe",
        denomination: null,
        siren: "123456782",
        adresse: "1 rue des Lilas, 69000 Lyon",
        regimeTva: a.where.id === "APP4" ? "assujetti" : "franchise_293b",
        numeroTva: a.where.id === "APP4" ? "FR00123456782" : null,
        ...etat.apporteurs[a.where.id],
      })),
    },
    commissionApporteur: {
      // Une reprise (art. 4.5) crée une ligne négative.
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        const id = `rep-${lignes().length + 1}`;
        (etat.lignes as Ligne[]).push({
          ...ligne(id, "reprise", a.data["montantCents"] as number),
          ...(a.data as Partial<Ligne>),
          id,
        });
        return { id };
      }),
      findMany: vi.fn(async (a: { where: Record<string, Valeur> }) =>
        lignes().filter((l) => correspond(l as never, a.where)),
      ),
      findUnique: vi.fn(
        async (a: { where: { id: string } }) => lignes().find((l) => l.id === a.where.id) ?? null,
      ),
      count: vi.fn(
        async (a: { where: Record<string, Valeur> }) =>
          lignes().filter((l) => correspond(l as never, a.where)).length,
      ),
      groupBy: vi.fn(async (a: { by: string[]; where: Record<string, Valeur> }) => {
        const vus = new Map<string, Record<string, Valeur>>();
        for (const l of lignes().filter((x) => correspond(x as never, a.where))) {
          const cle = a.by.map((b) => String((l as never)[b])).join("|");
          vus.set(cle, Object.fromEntries(a.by.map((b) => [b, (l as never)[b]])));
        }
        return [...vus.values()];
      }),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: etat.cumulCents } })),
      updateMany: vi.fn(
        async (a: { where: Record<string, Valeur>; data: Record<string, Valeur> }) => {
          const cibles = lignes().filter((l) => correspond(l as never, a.where));
          for (const l of cibles) Object.assign(l, a.data, { majAt: etat.maintenant });
          return { count: cibles.length };
        },
      ),
    },
    pieceApporteur: {
      findMany: vi.fn(async () =>
        etat.piecesValides
          ? [
              {
                type: "vigilance",
                statut: "conforme",
                expireAt: new Date("2027-06-01T00:00:00Z"),
                remplaceeAt: null,
              },
              { type: "immatriculation", statut: "conforme", expireAt: null, remplaceeAt: null },
            ]
          : [],
      ),
    },
    emailLog: {
      count: vi.fn(async (a: { where: { jobId: string } }) =>
        etat.jobIds.has(a.where.jobId) ? 1 : 0,
      ),
    },
    numeroEmis: { findMany: vi.fn(async () => []), count: vi.fn(async () => 0) },
    // Verrou consultatif de la série (pg_advisory_xact_lock) : sans effet dans le simulateur.
    $executeRaw: vi.fn(async () => 0),
    // Colonne « litige » présente (contrat 2.3, art. 4.2 bis), sauf quand un test la retire.
    $queryRaw: vi.fn(async () => {
      if (etat.colonneLitigeAbsente) throw new Error('column "litige_depuis" does not exist');
      return [];
    }),
    factureFormation: {
      // Respecte le `where` (par id ou par devis), comme la base.
      findMany: vi.fn(async (a: { where: Record<string, Valeur> }) =>
        Object.entries(etat.factures)
          .map(([id, f]) => ({ id, devisId: null, session: null, enrollment: null, ...f }))
          .filter((f) => correspond(f as never, a.where)),
      ),
    },
    activityLog: {
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.journal.push(a.data);
        return {};
      }),
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import {
  facturerApporteur,
  facturerCommissionsDues,
  marquerVerse,
  oublierCacheRegistre,
} from "../facturation";
import { annulerCommission, reduireCommission } from "../ajustement";
import { leverSuspension, oublierLitigeDisponible, suspendreCommission } from "../litige";
import {
  annulerRealisation,
  marquerPrestationRealisee,
  marquerRealiseesDepuisSessions,
  oublierRealisationDisponible,
} from "../realisation";
import { etatEcheances, objectifVirement } from "../autofacture-donnees";

const MARDI = new Date("2026-10-06T09:00:00Z");
const VENDREDI = new Date("2026-10-09T09:00:00Z");
const ligne = (
  id: string,
  statut: string,
  montantCents: number,
  surcharge: Partial<Ligne> = {},
): Ligne => ({
  id,
  apporteurId: "APP1",
  statut,
  montantCents,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  autofactureAttenteMotif: null,
  autofactureAttenteDepuis: null,
  litigeDepuis: null,
  litigeMotif: null,
  releveMois: null,
  verseeAt: null,
  majAt: new Date("2026-10-01T00:00:00Z"),
  activite: statut === "reprise" ? "reprise" : "audit",
  palier: null,
  parrainage: false,
  prixPublicHtCents: null,
  factureHtCents: 100_000,
  factureId: `F-${id}`,
  // Par défaut la prestation est réalisée (contrat 2.3, art. 4.2) ; les tests dédiés la retirent.
  prestationRealiseeAt: new Date("2026-10-01T00:00:00Z"),
  prestationRealiseePar: "console",
  ...surcharge,
});
const date = (d: Date) => d.toISOString().slice(0, 10);

beforeEach(() => {
  etat.lignes = [];
  etat.stockage = "ok";
  etat.pdfs = [];
  etat.envoyes = [];
  etat.confirmations = [];
  etat.alertes = [];
  etat.jobIds = new Set();
  etat.cumulCents = 0;
  etat.piecesValides = true;
  etat.maintenant = MARDI;
  etat.apporteurs = {};
  etat.sentry = [];
  etat.registre = (siren: string) => ({ ok: true, entreprise: { siren, active: true } });
  oublierCacheRegistre();
  oublierLitigeDisponible();
  etat.colonneLitigeAbsente = false;
  etat.journal = [];
  etat.factures = {};
  oublierRealisationDisponible();
});

describe("autofacture dès que la commission est due", () => {
  it("client payé à 100 % un mardi : autofacture le jour même, objectif jeudi, échéance J+30, commission toujours due", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan).toMatchObject({ autofactures: 1, commissions: 1, erreurs: 0 });
    const l = lignes()[0]!;
    expect(l.statut).toBe("due");
    expect(l.autofactureNumero).toBe("AXI-APP-2026-0001");
    expect(l.releveMois).toBe("2026-10");
    expect(l.autofactureEmiseAt).toEqual(MARDI);
    expect(etat.pdfs).toEqual(["apporteurs/autofactures/APP1/AXI-APP-2026-0001.pdf"]);
    const mail = etat.envoyes[0]!;
    expect(mail["gabarit"]).toBe("apporteur-releve");
    expect(mail["attachments"]).toHaveLength(1);
    expect(mail["payload"]).toMatchObject({
      numeroAutofacture: "AXI-APP-2026-0001",
      echeance: "5 novembre 2026",
    });
    expect(date(objectifVirement(MARDI))).toBe("2026-10-08");
  });

  it("client payé un vendredi : l'objectif de virement tombe le mardi suivant", async () => {
    etat.maintenant = VENDREDI;
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(VENDREDI);
    expect(date(etatEcheances(lignes()[0]!.autofactureEmiseAt!, VENDREDI).objectif)).toBe(
      "2026-10-13",
    );
  });

  it("client payé la veille d'un férié (jeudi 24/12/2026) : l'objectif saute Noël et le week-end", async () => {
    const veille = new Date("2026-12-24T09:00:00Z");
    etat.maintenant = veille;
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(veille);
    expect(date(etatEcheances(lignes()[0]!.autofactureEmiseAt!, veille).objectif)).toBe(
      "2026-12-29",
    );
  });

  it("deux commissions dues dans la même passe : UNE autofacture, UN e-mail, UNE alerte", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("c2", "due", 10_000)];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan).toMatchObject({ autofactures: 1, commissions: 2 });
    expect(new Set(lignes().map((l) => l.autofactureNumero)).size).toBe(1);
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.alertes).toHaveLength(1);
    expect((etat.envoyes[0]!["payload"] as Record<string, string>)["montant"]).toContain("500");
  });

  it("deux apporteurs dans la même passe (parrain et filleul) : une autofacture chacun", async () => {
    etat.lignes = [
      ligne("c1", "due", 40_000),
      ligne("p1", "due", 4_000, { apporteurId: "APP2", parrainage: true }),
    ];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan.autofactures).toBe(2);
    expect(lignes()[0]!.autofactureNumero).not.toBe(lignes()[1]!.autofactureNumero);
  });

  it("commission en attente de vigilance : rien n'est facturé ; libérée, elle l'est, délai compté depuis la libération", async () => {
    etat.lignes = [ligne("c1", "en_attente_vigilance", 40_000)];
    const rien = await facturerCommissionsDues(MARDI);
    expect(rien.autofactures).toBe(0);
    expect(etat.envoyes).toEqual([]);
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    // Libération par Williams le vendredi : la commission redevient due.
    etat.maintenant = VENDREDI;
    lignes()[0]!.statut = "due";
    await facturerCommissionsDues(VENDREDI);
    expect(lignes()[0]!.autofactureNumero).not.toBeNull();
    expect(date(etatEcheances(lignes()[0]!.autofactureEmiseAt!, VENDREDI).objectif)).toBe(
      "2026-10-13",
    );
  });

  it("rejeu de la passe : aucun doublon (ni numéro, ni e-mail, ni alerte, ni PDF)", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    const rejeu = await facturerCommissionsDues(MARDI);
    expect(rejeu.autofactures).toBe(0);
    expect(etat.envoyes).toHaveLength(1);
    expect(etat.alertes).toHaveLength(1);
    expect(etat.pdfs).toHaveLength(1);
  });

  it("l'e-mail et l'alerte portent une clé « une fois » par autofacture, l'alerte dit « À virer »", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    expect(etat.envoyes[0]!["jobId"]).toBe("apporteur-releve-AXI-APP-2026-0001");
    const a = etat.alertes[0]!;
    expect(a.jobId).toBe("apporteur-autofacture-alerte-AXI-APP-2026-0001");
    expect(a.payload["titre"]).toContain("À virer");
    expect(a.payload["titre"]).toContain("Jeanne Martin");
    expect(a.payload["message"]).toContain("avant le 8 octobre 2026");
    expect(a.payload["message"]).toContain("Échéance de paiement : 5 novembre 2026");
  });

  it("aucun seuil de 50 € : une commission de 30 € est facturée, même pour un contrat résilié", async () => {
    etat.lignes = [ligne("c1", "due", 3_000, { apporteurId: "APP3" })];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan.autofactures).toBe(1);
  });

  it("le PDF échoue : rien n'est écrit, aucun e-mail ; le passage suivant refait tout", async () => {
    etat.stockage = "ko";
    etat.lignes = [ligne("c1", "due", 40_000)];
    const ko = await facturerCommissionsDues(MARDI);
    expect(ko).toMatchObject({ autofactures: 0, ecartees: 1 });
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(etat.envoyes).toEqual([]);
    etat.stockage = "ok";
    expect((await facturerCommissionsDues(MARDI)).autofactures).toBe(1);
  });

  it("attestation périmée et cumul au-delà de 5 000 € : rien n'est facturé, les commissions repassent en attente", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    etat.cumulCents = 600_000;
    etat.piecesValides = false;
    const r = await facturerCommissionsDues(MARDI);
    expect(r.autofactures).toBe(0);
    expect(lignes()[0]!.statut).toBe("en_attente_vigilance");
    expect(etat.envoyes.map((e) => e["gabarit"])).not.toContain("apporteur-releve");
  });
});

describe("reprises", () => {
  it("une reprise donne un AVOIR numéroté dans la même série, joint à l'e-mail, déduit du virement", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    await facturerCommissionsDues(MARDI);
    const [c, r] = lignes();
    // Imputée à l'autofacture suivante, avec son propre numéro d'avoir.
    expect(r!.autofactureNumero).toBe(c!.autofactureNumero);
    expect(c!.autofactureNumero).toBe("AXI-APP-2026-0001");
    expect(r!.avoirNumero).toBe("AXI-APP-2026-0002");
    expect(r!.statut).toBe("reprise");
    expect(etat.pdfs).toEqual([
      "apporteurs/autofactures/APP1/AXI-APP-2026-0001.pdf",
      "apporteurs/autofactures/APP1/AXI-APP-2026-0002.pdf",
    ]);
    expect(etat.envoyes[0]!["attachments"]).toHaveLength(2);
    expect((etat.envoyes[0]!["payload"] as Record<string, string>)["sommeVirement"]).toContain(
      "250",
    );
  });

  it("la numérotation suivante tient compte des avoirs (aucun numéro réutilisé)", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    await facturerCommissionsDues(MARDI);
    lignes().push(ligne("c2", "due", 20_000));
    await facturerCommissionsDues(MARDI);
    expect(lignes()[2]!.autofactureNumero).toBe("AXI-APP-2026-0003");
  });

  it("le décompte e-mail présente l'avoir numéroté, avec renvoi à l'autofacture d'origine, et la somme virée", async () => {
    etat.lignes = [
      ligne("c0", "versee", 30_000, {
        autofactureNumero: "AXI-APP-2026-0001",
        releveMois: "2026-09",
      }),
      ligne("c1", "due", 40_000),
      ligne("r1", "reprise", -15_000, { palier: "reprise-de:c0" }),
    ];
    await facturerCommissionsDues(MARDI);
    const p = etat.envoyes[0]!["payload"] as Record<string, unknown>;
    expect(p["avoirs"]).toEqual([
      "Avoir n° AXI-APP-2026-0003 : 150 € hors taxes, déduit du virement (rectifie l'autofacture AXI-APP-2026-0001, émise en septembre 2026)",
    ]);
    expect(p["montant"]).toContain("400");
    expect(p["sommeVirement"]).toContain("250");
  });

  it("sans reprise : le décompte ne parle ni d'avoir ni de somme virée", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    const p = etat.envoyes[0]!["payload"] as Record<string, unknown>;
    expect(p["avoirs"]).toBeUndefined();
    expect(p["sommeVirement"]).toBeUndefined();
  });

  it("reprise plus grosse que les dues : COMPENSATION (art. 12.4) — autofacture, avoir scindé, net 0 réglé d'office", async () => {
    etat.lignes = [ligne("c1", "due", 10_000), ligne("r1", "reprise", -15_000)];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan.autofactures).toBe(1);
    const r1 = lignes().find((l) => l.id === "r1")!;
    expect(r1.montantCents).toBe(-10_000); // part imputée
    expect(r1.releveMois).not.toBeNull();
    const reste = lignes().find((l) => l.statut === "reprise" && l.id !== "r1")!;
    expect(reste).toMatchObject({ montantCents: -5_000, releveMois: null, palier: r1.palier });
    // Rien à virer : dues réglées par compensation, avoir soldé.
    expect(lignes().find((l) => l.id === "c1")!.statut).toBe("versee");
    expect(r1.verseeAt).not.toBeNull();
    const releve = etat.envoyes.find((e) => e["gabarit"] === "apporteur-releve")!;
    expect(releve["payload"]).toMatchObject({ compense: true });
    expect(releve["attachments"] as unknown[]).toHaveLength(2); // autofacture + avoir
  });

  it("une reprise déjà imputée n'est pas déduite deux fois", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    await facturerCommissionsDues(MARDI);
    lignes().push(ligne("c2", "due", 20_000));
    await facturerCommissionsDues(MARDI);
    expect((etat.envoyes[1]!["payload"] as Record<string, string>)["montant"]).toContain("200");
  });
});

describe("« Virement fait »", () => {
  it("ne génère AUCUN PDF : statut versée, date du virement, e-mail de confirmation à l'apporteur", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    const pdfs = etat.pdfs.length;
    const envois = etat.envoyes.length;
    const jeudi = new Date("2026-10-08T14:00:00Z");
    const r = await marquerVerse("APP1", jeudi, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: true, totalCents: 40_000, numeros: ["AXI-APP-2026-0001"] });
    expect(lignes()[0]!.statut).toBe("versee");
    expect(lignes()[0]!.verseeAt).toEqual(jeudi);
    expect(etat.pdfs).toHaveLength(pdfs);
    expect(etat.envoyes).toHaveLength(envois);
    expect(etat.confirmations).toHaveLength(1);
    expect(etat.confirmations[0]).toMatchObject({
      apporteurId: "APP1",
      destinataire: "app1@m.fr",
      contactName: "Jeanne Martin",
      numeros: ["AXI-APP-2026-0001"],
      dateVirement: "8 octobre 2026",
    });
    expect(String(etat.confirmations[0]!["montant"])).toContain("400");
  });

  it("aucune confirmation quand il n'y a rien à confirmer", async () => {
    expect((await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001")).ok).toBe(false);
    expect(etat.confirmations).toEqual([]);
  });

  it("la reprise imputée porte la même date de virement (DAS2)", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    await facturerCommissionsDues(MARDI);
    const jeudi = new Date("2026-10-08T14:00:00Z");
    const r = await marquerVerse("APP1", jeudi, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: true, totalCents: 25_000 });
    expect(lignes()[1]!.statut).toBe("reprise");
    expect(lignes()[1]!.verseeAt).toEqual(jeudi);
  });

  it("deux clics : le second ne trouve rien à confirmer", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    expect((await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001")).ok).toBe(true);
    expect((await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001")).ok).toBe(false);
  });

  it("une autofacture n'en confirme pas une autre", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    lignes().push(ligne("c2", "due", 10_000));
    await facturerCommissionsDues(MARDI);
    await marquerVerse("APP1", MARDI, "AXI-APP-2026-0002");
    expect(lignes()[0]!.statut).toBe("due");
    expect(lignes()[1]!.statut).toBe("versee");
  });

  it("rattrapage : une commission due sans autofacture est d'abord facturée, puis versée", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    const r = await marquerVerse("APP1", MARDI);
    expect(r).toMatchObject({ ok: true, totalCents: 40_000 });
    expect(etat.pdfs).toHaveLength(1);
    expect(lignes()[0]!.statut).toBe("versee");
    expect(lignes()[0]!.autofactureNumero).not.toBeNull();
  });
});

describe("apporteur qui facture la TVA : on vire le TTC", () => {
  it("l'alerte, la somme virée et « Virement fait » sont TVA comprise", async () => {
    etat.lignes = [ligne("c1", "due", 40_000, { apporteurId: "APP4" })];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan.autofactures).toBe(1);
    expect(etat.alertes[0]!.payload["titre"]).toContain("480");
    const p = etat.envoyes[0]!["payload"] as Record<string, string>;
    expect(p["montant"]).toContain("400");
    expect(p["sommeVirement"]).toContain("480");
    const r = await marquerVerse("APP4", MARDI, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: true, totalCents: 48_000 });
  });

  it("avec un avoir : TTC de l'autofacture moins TTC de l'avoir", async () => {
    etat.lignes = [
      ligne("c1", "due", 40_000, { apporteurId: "APP4" }),
      ligne("r1", "reprise", -15_000, { apporteurId: "APP4" }),
    ];
    await facturerCommissionsDues(MARDI);
    const r = await marquerVerse("APP4", MARDI, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: true, totalCents: 30_000 });
  });
});

describe("autofacture impossible faute de donnée : en attente, une seule alerte, reprise automatique", () => {
  const MERCREDI = new Date("2026-10-07T09:00:00Z");

  it("SIREN manquant : rien n'est facturé, la commission reste due et affiche ce qui manque, sans Sentry", async () => {
    etat.apporteurs["APP1"] = { siren: null };
    etat.lignes = [ligne("c1", "due", 40_000)];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan).toMatchObject({ autofactures: 0, ecartees: 1, erreurs: 0 });
    const l = lignes()[0]!;
    expect(l.statut).toBe("due");
    expect(l.autofactureNumero).toBeNull();
    expect(l.autofactureAttenteMotif).toBe("SIREN de l'apporteur");
    expect(l.autofactureAttenteDepuis).toEqual(MARDI);
    expect(etat.pdfs).toEqual([]);
    expect(etat.envoyes).toEqual([]);
    expect(etat.sentry).toEqual([]);
  });

  it("07/10 : SIREN invalide (clé fausse) : aucune autofacture, aucun versement possible", async () => {
    etat.apporteurs["APP1"] = { siren: "123456789" };
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(lignes()[0]!.autofactureAttenteMotif).toBe("SIREN de l'apporteur");
    expect(await marquerVerse("APP1", MARDI)).toMatchObject({ ok: false });
    expect(lignes()[0]!.statut).toBe("due");
    expect(etat.pdfs).toEqual([]);
  });

  it("07/10 : entreprise radiée au registre : en attente, UNE alerte, aucun versement", async () => {
    etat.registre = (siren: string) => ({ ok: true, entreprise: { siren, active: false } });
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    await facturerCommissionsDues(new Date("2026-10-06T10:00:00Z"));
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(lignes()[0]!.autofactureAttenteMotif).toBe("entreprise radiée au registre public");
    expect(etat.alertes.filter((a) => a.jobId.includes("autofacture-attente"))).toHaveLength(1);
    expect(await marquerVerse("APP1", MARDI)).toMatchObject({ ok: false });
    expect(etat.pdfs).toEqual([]);
  });

  it("07/10 : registre muet : rien n'est facturé ni marqué, aucun Sentry ; il répond, ça part", async () => {
    etat.registre = () => ({ ok: false, raison: "indisponible" });
    etat.lignes = [ligne("c1", "due", 40_000)];
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0, erreurs: 0 });
    expect(lignes()[0]!.autofactureAttenteMotif).toBeNull();
    expect(etat.sentry).toEqual([]);
    etat.registre = (siren: string) => ({ ok: true, entreprise: { siren, active: true } });
    expect((await facturerCommissionsDues(MARDI)).autofactures).toBe(1);
  });

  it("régime de TVA et adresse manquants : le motif les nomme tous les deux", async () => {
    etat.apporteurs["APP1"] = { regimeTva: null, adresse: "  " };
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    expect(lignes()[0]!.autofactureAttenteMotif).toBe(
      "régime de TVA de l'apporteur, adresse de l'apporteur",
    );
  });

  it("une seule alerte au premier blocage, pas une par passage horaire", async () => {
    etat.apporteurs["APP1"] = { siren: null };
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    await facturerCommissionsDues(new Date("2026-10-06T10:00:00Z"));
    await facturerCommissionsDues(new Date("2026-10-06T11:00:00Z"));
    const alertes = etat.alertes.filter((a) => a.jobId.includes("autofacture-attente"));
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.payload["message"]).toContain("SIREN de l'apporteur");
    // La date du premier blocage n'est pas réécrite à chaque passage.
    expect(lignes()[0]!.autofactureAttenteDepuis).toEqual(MARDI);
    expect(etat.sentry).toEqual([]);
  });

  it("donnée complétée : le passage suivant facture tout seul et efface l'attente", async () => {
    etat.apporteurs["APP1"] = { siren: null };
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    etat.apporteurs["APP1"] = {};
    etat.maintenant = MERCREDI;
    const bilan = await facturerCommissionsDues(MERCREDI);
    expect(bilan).toMatchObject({ autofactures: 1, commissions: 1 });
    const l = lignes()[0]!;
    expect(l.autofactureNumero).toBe("AXI-APP-2026-0001");
    expect(l.autofactureEmiseAt).toEqual(MERCREDI);
    expect(l.autofactureAttenteMotif).toBeNull();
    expect(l.autofactureAttenteDepuis).toBeNull();
    expect(etat.envoyes).toHaveLength(1);
  });

  it("une erreur technique (stockage) garde ses nouveaux essais et son alerte Sentry, sans attente affichée", async () => {
    etat.stockage = "ko";
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    expect(lignes()[0]!.autofactureAttenteMotif).toBeNull();
    expect(etat.sentry.length).toBeGreaterThan(0);
  });

  it("« Virement fait » sur un apporteur bloqué : refusé avec ce qui manque, rien n'est versé", async () => {
    etat.apporteurs["APP1"] = { siren: null };
    etat.lignes = [ligne("c1", "due", 40_000)];
    const r = await marquerVerse("APP1", MARDI);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("SIREN de l'apporteur");
    expect(lignes()[0]!.statut).toBe("due");
  });
});

describe("contrat 2.3 (art. 4.2 bis) : commission suspendue pendant une contestation écrite", () => {
  it("suspendue : ni autofacture ni virement ; levée : elle part au passage suivant", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    expect(
      await suspendreCommission("c1", "e-mail du client du 06/10 : formation contestée", MARDI),
    ).toEqual({ ok: true });
    expect(lignes()[0]!.litigeDepuis).toEqual(MARDI);
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0 });
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    // Sans numéro, le rattrapage de « Virement fait » ne facture pas non plus la commission suspendue.
    await marquerVerse("APP1", MARDI);
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(lignes()[0]!.statut).toBe("due");
    expect(await leverSuspension("c1", "admin-1")).toEqual({ ok: true });
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 1 });
  });

  it("déjà facturée puis contestée : « Virement fait » est refusé tant que la suspension dure", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    await suspendreCommission("c1", "contestation de la facture", MARDI);
    const r = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("suspendue");
    expect(lignes()[0]!.statut).toBe("due");
  });

  it("une commission versée ou reprise ne se suspend pas ; un motif est exigé", async () => {
    etat.lignes = [ligne("v1", "versee", 40_000), ligne("c2", "due", 10_000)];
    expect(await suspendreCommission("v1", "trop tard", MARDI)).toMatchObject({ ok: false });
    expect(await suspendreCommission("c2", "  ", MARDI)).toMatchObject({ ok: false });
  });
});

describe("relecture de la PR 1359 (a1)", () => {
  it("le refus de « Virement fait » vient bien de la SUSPENSION (par le numéro, comme la console)", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    const sans = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(sans).toMatchObject({ ok: true }); // témoin : sans suspension, le virement passe
    etat.lignes = [ligne("c2", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    const numero = lignes()[0]!.autofactureNumero!;
    await suspendreCommission("c2", "contestation écrite", MARDI);
    const r = await marquerVerse("APP1", MARDI, numero);
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain(
      "suspendue (contestation écrite du client",
    );
  });

  it("colonne absente (worker avant la migration) : pas de filtre, et JAMAIS mémorisé", async () => {
    const { litigeDisponible } = await import("../litige");
    etat.colonneLitigeAbsente = true;
    expect(await litigeDisponible()).toBe(false);
    etat.colonneLitigeAbsente = false;
    // La migration vient de passer : dès l'appel suivant, le filtre s'applique.
    expect(await litigeDisponible()).toBe(true);
  });

  it("suspension et levée sont TRACÉES (qui, quand, motif) : rien ne disparaît", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await suspendreCommission("c1", "contestation du 06/10", MARDI, "admin-1");
    await leverSuspension("c1", "admin-1", VENDREDI);
    expect(etat.journal.map((j) => j["action"])).toEqual([
      "commission_apporteur.suspendue",
      "commission_apporteur.suspension_levee",
    ]);
    expect(etat.journal[1]).toMatchObject({
      adminUserId: "admin-1",
      targetId: "c1",
      changes: { motif: "contestation du 06/10", suspendueDepuis: MARDI.toISOString() },
    });
  });
});

describe("règle ferme (contrat 2.3, art. 4.2) : rien n'est facturé ni versé avant la réalisation", () => {
  const enAttente = (id: string, montant = 40_000) =>
    ligne(id, "due", montant, { prestationRealiseeAt: null, prestationRealiseePar: null });

  it("passage horaire : une prestation non réalisée n'est pas facturée ; marquée réalisée, elle l'est", async () => {
    etat.lignes = [enAttente("c1")];
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0 });
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(
      await marquerPrestationRealisee("c1", new Date("2026-10-05T12:00:00Z"), MARDI, "admin-1"),
    ).toEqual({ ok: true });
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 1 });
    expect(
      etat.journal.some((j) => j["action"] === "commission_apporteur.prestation_realisee"),
    ).toBe(true);
  });

  it("« Virement fait » SANS numéro : ne facture ni ne verse une prestation non réalisée", async () => {
    etat.lignes = [enAttente("c1")];
    expect(await marquerVerse("APP1", MARDI)).toMatchObject({ ok: false });
    expect(lignes()[0]!.autofactureNumero).toBeNull();
    expect(lignes()[0]!.statut).toBe("due");
  });

  it("« Virement fait » AVEC numéro : refusé si une ligne de l'autofacture n'est pas réalisée", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await facturerCommissionsDues(MARDI);
    lignes()[0]!.prestationRealiseeAt = null; // donnée incohérente : le verrou tient quand même
    const r = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(r).toMatchObject({ ok: false });
    expect((r as { message: string }).message).toContain("En attente de réalisation");
    expect(lignes()[0]!.statut).toBe("due");
  });

  it("colonne absente (worker avant la migration) : RIEN n'est facturé ni versé", async () => {
    etat.colonneLitigeAbsente = true; // le simulateur refuse alors toute requête brute
    etat.lignes = [ligne("c1", "due", 40_000)];
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0 });
    expect(await marquerVerse("APP1", MARDI)).toMatchObject({ ok: false });
  });

  it("« Annuler » : possible tant que la commission n'est pas facturée, refusé ensuite", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("c2", "due", 10_000)];
    expect(await annulerRealisation("c2", "admin-1")).toEqual({ ok: true });
    expect(lignes()[1]!.prestationRealiseeAt).toBeNull();
    await facturerCommissionsDues(MARDI);
    expect(await annulerRealisation("c1", "admin-1")).toMatchObject({ ok: false });
  });

  it("automatique : session de formation « réalisée » = prestation réalisée à la fin de la session", async () => {
    etat.lignes = [enAttente("c1")];
    const fin = new Date("2026-10-03T16:00:00Z");
    etat.factures = { "F-c1": { session: { statut: "realisee", dateFin: fin } } };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(1);
    expect(lignes()[0]!).toMatchObject({
      prestationRealiseeAt: fin,
      prestationRealiseePar: "session-realisee",
    });
    // Une session encore planifiée ne rend rien « réalisé ».
    etat.lignes = [enAttente("c2")];
    etat.factures = { "F-c2": { session: { statut: "planifiee", dateFin: fin } } };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(0);
  });

  it("date de réalisation du JOUR (posée à midi UTC) : admise même tôt le matin", async () => {
    etat.lignes = [enAttente("c1")];
    const matin = new Date(`${MARDI.toISOString().slice(0, 10)}T05:00:00Z`);
    const jour = new Date(`${MARDI.toISOString().slice(0, 10)}T12:00:00.000Z`);
    expect(await marquerPrestationRealisee("c1", jour, matin)).toEqual({ ok: true });
  });

  it("date de réalisation dans le futur : refusée", async () => {
    etat.lignes = [enAttente("c1")];
    expect(
      await marquerPrestationRealisee("c1", new Date("2027-01-01T00:00:00Z"), MARDI),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe("suites de la suspension (contrat 2.3, art. 4.2 bis)", () => {
  it("« Virement fait » ne bloque QUE la ligne suspendue : les autres lignes de l'autofacture sont versées", async () => {
    etat.lignes = [ligne("c1", "due", 40_000), ligne("c2", "due", 10_000)];
    await facturerCommissionsDues(MARDI);
    const numero = lignes()[0]!.autofactureNumero!;
    expect(lignes()[1]!.autofactureNumero).toBe(numero);
    await suspendreCommission("c2", "contestation écrite de la formation", MARDI);
    expect(await marquerVerse("APP1", MARDI, numero)).toMatchObject({ ok: true });
    expect(lignes().find((l) => l.id === "c1")!.statut).toBe("versee");
    expect(lignes().find((l) => l.id === "c2")!.statut).toBe("due");
  });

  it("la part du PARRAIN, née de la même facture, est suspendue puis libérée avec elle", async () => {
    etat.lignes = [
      ligne("c1", "due", 40_000, { factureId: "F-1" }),
      ligne("p1", "due", 4_000, { apporteurId: "APP2", parrainage: true, factureId: "F-1" }),
      ligne("p2", "due", 4_000, { apporteurId: "APP2", parrainage: true, factureId: "F-2" }),
    ];
    await suspendreCommission("c1", "contestation écrite", MARDI);
    expect(lignes().find((l) => l.id === "p1")!.litigeDepuis).toEqual(MARDI);
    expect(lignes().find((l) => l.id === "p2")!.litigeDepuis).toBeNull();
    await leverSuspension("c1", "admin-1", VENDREDI);
    expect(lignes().find((l) => l.id === "p1")!.litigeDepuis).toBeNull();
    // Le parrain est prévenu lui aussi, de la suspension puis de son issue.
    const auParrain = etat.envoyes.filter(
      (x) =>
        x["gabarit"] === "apporteur-commission-suspension" && x["destinataire"] === "app2@m.fr",
    );
    expect(auParrain.map((x) => (x["payload"] as { etat: string }).etat)).toEqual([
      "suspendue",
      "levee",
    ]);
  });

  it("l'apporteur est PRÉVENU de la suspension, puis de son issue", async () => {
    etat.lignes = [ligne("c1", "due", 40_000)];
    await suspendreCommission("c1", "contestation écrite", MARDI, "admin-1");
    await leverSuspension("c1", "admin-1", VENDREDI);
    const e = etat.envoyes.filter((x) => x["gabarit"] === "apporteur-commission-suspension");
    expect(e.map((x) => (x["payload"] as { etat: string }).etat)).toEqual(["suspendue", "levee"]);
    expect(e[0]).toMatchObject({ destinataire: "app1@m.fr" });
  });
});

describe("relecture de la PR 1365 (a1) : l'automatisme ne marque jamais « réalisée » à tort", () => {
  const enAttente = (id: string) =>
    ligne(id, "due", 40_000, { prestationRealiseeAt: null, prestationRealiseePar: null });
  const FIN = new Date("2026-10-03T16:00:00Z");
  const realisee = { statut: "realisee", dateFin: FIN };

  it("session annulée ou reportée : reste en attente", async () => {
    for (const statut of ["annulee", "reportee"]) {
      etat.lignes = [enAttente("c1")];
      etat.factures = { "F-c1": { session: { statut, dateFin: FIN } } };
      expect(await marquerRealiseesDepuisSessions(MARDI), statut).toBe(0);
    }
  });

  it("session « réalisée » mais fin dans le futur : reste en attente", async () => {
    etat.lignes = [enAttente("c1")];
    etat.factures = {
      "F-c1": { session: { statut: "realisee", dateFin: new Date("2026-12-01T00:00:00Z") } },
    };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(0);
  });

  it("inter-entreprises : participant du client en abandon ou exclu = en attente, présent = réalisée", async () => {
    for (const [statut, attendu] of [
      ["abandon", 0],
      ["exclu", 0],
      ["planifiee", 0],
      ["presente", 1],
    ] as const) {
      etat.lignes = [enAttente("c1")];
      etat.factures = { "F-c1": { session: realisee, enrollment: { statut, session: realisee } } };
      expect(await marquerRealiseesDepuisSessions(MARDI), statut).toBe(attendu);
    }
  });

  it("commande sur plusieurs sessions (même devis) : réalisée seulement quand TOUTES le sont, à la dernière fin", async () => {
    etat.lignes = [enAttente("c1")];
    const finB = new Date("2026-10-05T16:00:00Z");
    etat.factures = {
      "F-c1": { devisId: "D1", session: realisee },
      "F-autre": { devisId: "D1", session: { statut: "planifiee", dateFin: finB } },
    };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(0);
    etat.factures["F-autre"]!.session = { statut: "realisee", dateFin: finB };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(1);
    expect(lignes()[0]!.prestationRealiseeAt).toEqual(finB);
  });

  it("« Annuler » à la main n'est PAS refait au passage horaire suivant, ni facturé", async () => {
    etat.lignes = [enAttente("c1")];
    etat.factures = { "F-c1": { session: realisee } };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(1);
    expect(await annulerRealisation("c1", "admin-1")).toEqual({ ok: true });
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(0);
    expect(lignes()[0]!.prestationRealiseeAt).toBeNull();
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0 });
    // Le bouton, lui, peut toujours la reposer.
    expect(await marquerPrestationRealisee("c1", FIN, MARDI, "admin-1")).toEqual({ ok: true });
  });

  it("facture sans session ni inscription (audit, 1-to-1, intégration) : bouton seulement", async () => {
    etat.lignes = [enAttente("c1")];
    etat.factures = { "F-c1": {} };
    expect(await marquerRealiseesDepuisSessions(MARDI)).toBe(0);
  });
});

describe("relecture de la PR 1368 (a1) : versement partiel jamais négatif, somme exacte", () => {
  // Témoin : sans suspension, le virement complet de la même autofacture.
  async function complet(f: () => ReturnType<typeof ligne>[]): Promise<number> {
    etat.lignes = f();
    await facturerCommissionsDues(MARDI);
    const r = await marquerVerse("APP1", MARDI, lignes()[0]!.autofactureNumero!);
    expect(r).toMatchObject({ ok: true });
    return (r as { totalCents: number }).totalCents;
  }

  for (const [nom, a, b, rep] of [
    ["A 100, B 300 suspendu, reprise −150", 10_000, 30_000, -15_000],
    ["A 100, B 50 suspendu, reprise −120 (exemple de a1)", 10_000, 5_000, -12_000],
  ] as const) {
    it(`${nom} : partiel REFUSÉ (les reprises dépassent), puis virement complet exact après la levée`, async () => {
      const f = () => [ligne("a", "due", a), ligne("b", "due", b), ligne("r", "reprise", rep)];
      const attendu = await complet(f);
      etat.lignes = f();
      await facturerCommissionsDues(MARDI);
      const numero = lignes()[0]!.autofactureNumero!;
      expect(lignes().every((l) => l.autofactureNumero === numero)).toBe(true);
      await suspendreCommission("b", "contestation écrite", MARDI);
      const partiel = await marquerVerse("APP1", MARDI, numero);
      expect(partiel).toMatchObject({ ok: false });
      expect((partiel as { message: string }).message).toContain("Levez d'abord la suspension");
      expect(lignes().find((l) => l.id === "a")!.statut).toBe("due");
      expect(lignes().find((l) => l.id === "r")!.verseeAt).toBeNull();
      await leverSuspension("b", "admin-1", VENDREDI);
      const tout = await marquerVerse("APP1", VENDREDI, numero);
      expect(tout).toMatchObject({ ok: true, totalCents: attendu });
    });
  }

  it("A 300, B 100 suspendu, reprise −150 : partiel positif admis, reprise déduite, somme exacte", async () => {
    const f = () => [
      ligne("a", "due", 30_000),
      ligne("b", "due", 10_000),
      ligne("r", "reprise", -15_000),
    ];
    const attendu = await complet(f);
    etat.lignes = f();
    await facturerCommissionsDues(MARDI);
    const numero = lignes()[0]!.autofactureNumero!;
    await suspendreCommission("b", "contestation écrite", MARDI);
    const p1 = await marquerVerse("APP1", MARDI, numero);
    expect(p1).toMatchObject({ ok: true });
    expect((p1 as { totalCents: number }).totalCents).toBeGreaterThan(0);
    expect(lignes().find((l) => l.id === "r")!.verseeAt).not.toBeNull();
    await leverSuspension("b", "admin-1", VENDREDI);
    const p2 = await marquerVerse("APP1", VENDREDI, numero);
    expect(
      (p1 as { totalCents: number }).totalCents + (p2 as { totalCents: number }).totalCents,
    ).toBe(attendu);
  });

  it("une ligne suspendue ET non réalisée ne bloque pas le reste du virement", async () => {
    etat.lignes = [ligne("a", "due", 10_000), ligne("b", "due", 30_000)];
    await facturerCommissionsDues(MARDI);
    const numero = lignes()[0]!.autofactureNumero!;
    await suspendreCommission("b", "contestation écrite", MARDI);
    lignes().find((l) => l.id === "b")!.prestationRealiseeAt = null;
    expect(await marquerVerse("APP1", MARDI, numero)).toMatchObject({ ok: true });
    expect(lignes().find((l) => l.id === "a")!.statut).toBe("versee");
  });
});

describe("réduire ou annuler une commission pas encore facturée (point 4)", () => {
  // Audit : 30 % du HT facturé (100 000 c). Part du parrain : 10 %, arrondi à l'inférieur.
  const avecParrain = (part: Partial<Ligne> = {}) => [
    ligne("c1", "due", 30_000, { factureId: "F-1" }),
    ligne("p1", "due", 3_000, {
      apporteurId: "APP2",
      parrainage: true,
      factureId: "F-1",
      ...part,
    }),
  ];

  it("réduire : la commission est RECALCULÉE depuis le prix conservé, la part du parrain par sa règle", async () => {
    etat.lignes = avecParrain();
    const r = await reduireCommission("c1", 80_005, "prix conservé : 800,05 € HT", "admin-1");
    expect(r).toMatchObject({ ok: true, montantCents: 24_001 });
    expect(lignes().find((l) => l.id === "c1")!).toMatchObject({
      montantCents: 24_001,
      factureHtCents: 80_005,
    });
    expect(lignes().find((l) => l.id === "p1")!.montantCents).toBe(2_400); // 10 % arrondi inférieur
    expect(etat.journal[0]).toMatchObject({
      adminUserId: "admin-1",
      action: "commission_apporteur.reduite",
      changes: { avantCents: 30_000, apresCents: 24_001, prixConserveHtCents: 80_005 },
    });
  });

  it("réduire : refusé sans motif, à un prix supérieur ou nul, sur une part de parrain, ou une fois facturée", async () => {
    etat.lignes = avecParrain();
    expect(await reduireCommission("c1", 50_000, " ")).toMatchObject({ ok: false });
    expect(await reduireCommission("c1", 100_000, "x")).toMatchObject({ ok: false });
    expect(await reduireCommission("c1", 0, "x")).toMatchObject({ ok: false });
    expect(await reduireCommission("p1", 50_000, "x")).toMatchObject({ ok: false });
    await facturerCommissionsDues(MARDI);
    const r = await reduireCommission("c1", 50_000, "trop tard");
    expect((r as { message: string }).message).toContain("déjà facturée");
  });

  it("part du parrain déjà VERSÉE : reprise de la différence ; déjà FACTURÉE non versée : avertissement", async () => {
    etat.lignes = avecParrain({ statut: "versee" });
    const r1 = await reduireCommission("c1", 50_000, "prix conservé");
    expect(r1).toMatchObject({ ok: true });
    const reprise = lignes().find((l) => l.statut === "reprise");
    expect(reprise?.montantCents).toBe(-1_500); // 3 000 → 1 500
    etat.lignes = avecParrain({ autofactureNumero: "AXI-APP-2026-0009" });
    const r2 = await reduireCommission("c1", 50_000, "prix conservé");
    expect(r2).toMatchObject({ ok: true });
    expect((r2 as { avertissement?: string }).avertissement).toContain("déjà facturée");
    expect(lignes().find((l) => l.id === "p1")!.montantCents).toBe(3_000);
  });

  it("annuler : la ligne reste en base au statut « annulée », la part du parrain aussi, rien n'est facturé", async () => {
    etat.lignes = avecParrain();
    expect(await annulerCommission("c1", "commande annulée par le client", "admin-1")).toEqual({
      ok: true,
    });
    expect(lignes().map((l) => l.statut)).toEqual(["annulee", "annulee"]);
    expect(await facturerCommissionsDues(MARDI)).toMatchObject({ autofactures: 0 });
    expect(etat.journal.filter((j) => j["action"] === "commission_apporteur.annulee")).toHaveLength(
      2,
    );
  });

  it("annuler : refusé sur une commission versée (c'est une reprise) ou sans motif", async () => {
    etat.lignes = [ligne("v1", "versee", 40_000), ligne("c2", "due", 10_000)];
    expect(await annulerCommission("v1", "trop tard")).toMatchObject({ ok: false });
    expect(await annulerCommission("c2", "")).toMatchObject({ ok: false });
    expect(lignes()[1]!.statut).toBe("due");
  });

  it("facturation : une ligne dont le montant a changé entre la lecture et l'écriture n'est pas facturée à l'ancien montant", async () => {
    etat.lignes = [ligne("c1", "due", 30_000)];
    const { prisma } = await import("@/lib/prisma");
    const um = prisma.commissionApporteur.updateMany as unknown as {
      getMockImplementation: () => (a: unknown) => unknown;
      mockImplementationOnce: (f: (a: unknown) => unknown) => void;
    };
    const vraie = um.getMockImplementation();
    // Réduction « concurrente » juste avant l'écriture de la facturation.
    um.mockImplementationOnce((a) => {
      lignes()[0]!.montantCents = 24_000;
      return vraie(a);
    });
    await facturerCommissionsDues(MARDI);
    expect(lignes()[0]!.autofactureNumero).toBeNull();
  });
});

describe("ligne RETENUE pour manquement (art. 4.5 bis) dans une autofacture", () => {
  it("le reste est versé par complément, la ligne retenue n'est jamais virée, l'avoir n'est pas redéduit", async () => {
    etat.lignes = [ligne("a", "due", 10_000), ligne("b", "due", 30_000)];
    await facturerCommissionsDues(MARDI);
    const numero = lignes()[0]!.autofactureNumero!;
    const b = lignes().find((l) => l.id === "b")!;
    b.statut = "retenue";
    const avoirVerseLe = new Date("2026-10-06T08:00:00Z");
    (etat.lignes as Ligne[]).push(
      ligne("av", "reprise", -30_000, {
        autofactureNumero: numero,
        avoirNumero: "AXI-APP-2026-0099",
        releveMois: "2026-10",
        verseeAt: avoirVerseLe,
      }),
    );
    const r = await marquerVerse("APP1", MARDI, numero);
    expect(r).toMatchObject({ ok: true });
    expect((r as { totalCents: number }).totalCents).toBeGreaterThan(0);
    expect(lignes().find((l) => l.id === "a")!.statut).toBe("versee");
    expect(lignes().find((l) => l.id === "b")!.statut).toBe("retenue");
    expect(lignes().find((l) => l.id === "av")!.verseeAt).toEqual(avoirVerseLe);
  });
});

describe("solde négatif (art. 12.4) : compensation avec pièces", () => {
  it("deux reprises plus grosses que trois dues : la plus ancienne entière, la suivante scindée, le reste attend", async () => {
    etat.lignes = [
      ligne("d1", "due", 10_000),
      ligne("d2", "due", 5_000),
      ligne("d3", "due", 3_000),
      ligne("r1", "reprise", -12_000),
      ligne("r2", "reprise", -20_000),
    ];
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: true });
    const l = (id: string) => lignes().find((x) => x.id === id)!;
    expect(l("r1")).toMatchObject({ montantCents: -12_000 });
    expect(l("r2")).toMatchObject({ montantCents: -6_000 });
    expect(l("r1").releveMois).not.toBeNull();
    expect(l("r2").releveMois).not.toBeNull();
    const reste = lignes().filter((x) => x.statut === "reprise" && x.releveMois === null);
    expect(reste.map((x) => x.montantCents)).toEqual([-14_000]);
    expect(reste[0]!.palier).toBe(l("r2").palier); // même référence d'origine
    expect(["d1", "d2", "d3"].map((id) => l(id).statut)).toEqual(["versee", "versee", "versee"]);
    // Rien ne se perd : 32 000 de reprises = 18 000 imputés + 14 000 en attente.
    const toutes = lignes().filter((x) => x.statut === "reprise");
    expect(toutes.reduce((s, x) => s + (x.montantCents ?? 0), 0)).toBe(-32_000);
  });

  it("assujetti à la TVA : l'avoir ne dépasse jamais l'autofacture en TTC (arrondi), rien n'est perdu", async () => {
    etat.lignes = [
      ligne("d1", "due", 3_333, { apporteurId: "APP4" }),
      ligne("d2", "due", 3_333, { apporteurId: "APP4" }),
      ligne("d3", "due", 3_333, { apporteurId: "APP4" }),
      ligne("r1", "reprise", -20_000, { apporteurId: "APP4" }),
    ];
    const r = await facturerApporteur("APP4", MARDI);
    expect(r).toMatchObject({ ok: true });
    const net = (r as { totalCents: number }).totalCents;
    expect(net).toBeGreaterThanOrEqual(0); // jamais négatif
    expect(net).toBeLessThanOrEqual(1); // au plus le centime d'arrondi, laissé au virement
    const reprises = lignes().filter((x) => x.statut === "reprise");
    expect(reprises.reduce((s, x) => s + (x.montantCents ?? 0), 0)).toBe(-20_000);
  });

  it("reprises plus petites que les dues : rien ne change (déduction habituelle)", async () => {
    etat.lignes = [ligne("d1", "due", 40_000), ligne("r1", "reprise", -15_000)];
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: true });
    expect(lignes().filter((x) => x.statut === "reprise")).toHaveLength(1);
    expect(lignes().find((x) => x.id === "d1")!.statut).toBe("due"); // à virer
  });
});

describe("reprise libérée après une retenue : réimputée SANS nouvel avoir", () => {
  it("garde son numéro d'avoir, aucune nouvelle pièce, déduite du virement", async () => {
    etat.lignes = [
      ligne("d1", "due", 40_000),
      ligne("r1", "reprise", -10_000, { avoirNumero: "AXI-APP-2026-0002" }),
    ];
    const avant = etat.pdfs.length;
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: true });
    expect(etat.pdfs.length - avant).toBe(1); // l'autofacture seule
    const r1 = lignes().find((l) => l.id === "r1")!;
    expect(r1.avoirNumero).toBe("AXI-APP-2026-0002");
    expect(r1.autofactureNumero).toBe((r as { numero: string }).numero);
    expect(r1.releveMois).not.toBeNull();
  });
});

describe("compensation (art. 12.4) et avoir déjà émis", () => {
  it("avoir déjà émis de 1 000 € en attente, 300 € dus : RIEN n'est versé, l'avoir n'est pas scindé", async () => {
    etat.lignes = [
      ligne("d1", "due", 30_000),
      ligne("rx", "reprise", -100_000, { avoirNumero: "AXI-APP-2026-0002" }),
    ];
    const r = await facturerApporteur("APP1", MARDI);
    expect(r).toMatchObject({ ok: false });
    expect(lignes().find((l) => l.id === "d1")!).toMatchObject({
      statut: "due",
      autofactureNumero: null,
    });
    expect(lignes().find((l) => l.id === "rx")!).toMatchObject({
      montantCents: -100_000,
      releveMois: null,
    });
    expect(lignes().filter((l) => l.statut === "reprise")).toHaveLength(1);
  });

  it("ce blocage est SIGNALÉ : motif « solde négatif » sur la ligne, une seule alerte à Williams", async () => {
    etat.lignes = [
      ligne("d1", "due", 30_000),
      ligne("rx", "reprise", -100_000, { avoirNumero: "AXI-APP-2026-0002" }),
    ];
    await facturerApporteur("APP1", MARDI);
    await facturerApporteur("APP1", MARDI);
    const motif = lignes().find((l) => l.id === "d1")!.autofactureAttenteMotif ?? "";
    expect(motif).toContain("solde négatif : un avoir de");
    expect(motif).toContain("reste à compenser");
    const alertes = etat.alertes.filter(
      (x) => (x["payload"] as Record<string, unknown>)["code"] === "apporteur_solde_negatif",
    );
    expect(alertes).toHaveLength(1);
  });

  it("la ligne de reste d'une scission garde la date d'ORIGINE de la reprise (délais de 12 et 24 mois)", async () => {
    const origine = new Date("2026-03-01T10:00:00Z");
    etat.lignes = [
      ligne("d1", "due", 10_000),
      ligne("r1", "reprise", -15_000, { creeAt: origine }),
    ];
    await facturerApporteur("APP1", MARDI);
    const reste = lignes().find((l) => l.statut === "reprise" && l.id !== "r1")!;
    expect(reste.creeAt).toEqual(origine);
  });

  it("assujetti, reprises de DEUX autofactures d'origine : plafond TTC pièce par pièce, net jamais négatif", async () => {
    etat.lignes = [
      ligne("v1", "versee", 9_999, { apporteurId: "APP4", autofactureNumero: "AXI-APP-2026-0010" }),
      ligne("v2", "versee", 9_999, { apporteurId: "APP4", autofactureNumero: "AXI-APP-2026-0011" }),
      ligne("d1", "due", 3_333, { apporteurId: "APP4" }),
      ligne("d2", "due", 3_333, { apporteurId: "APP4" }),
      ligne("d3", "due", 3_333, { apporteurId: "APP4" }),
      ligne("r1", "reprise", -5_001, { apporteurId: "APP4", palier: "reprise-de:v1" }),
      ligne("r2", "reprise", -8_003, { apporteurId: "APP4", palier: "reprise-de:v2" }),
    ];
    const r = await facturerApporteur("APP4", MARDI);
    expect(r).toMatchObject({ ok: true });
    expect((r as { totalCents: number }).totalCents).toBeGreaterThanOrEqual(0);
    const reprises = lignes().filter((x) => x.statut === "reprise");
    expect(reprises.reduce((s, x) => s + (x.montantCents ?? 0), 0)).toBe(-13_004);
  });
});
