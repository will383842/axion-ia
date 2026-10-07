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
  releveMois: string | null;
  verseeAt: Date | null;
  majAt: Date;
  activite: string;
  palier: string | null;
  parrainage: boolean;
  prixPublicHtCents: number | null;
  factureHtCents: number;
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
  sentry: [] as string[],
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
    if (typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, Valeur>;
      if ("in" in c) return (c["in"] as Valeur[]).includes(v);
      if ("not" in c) return c["not"] === null ? v !== null : v !== c["not"];
      if ("startsWith" in c) return typeof v === "string" && v.startsWith(String(c["startsWith"]));
      return true;
    }
    return v === cond;
  });
}
const lignes = () => etat.lignes as Ligne[];

vi.mock("@/lib/prisma", () => {
  const prisma = {
    apporteurReseau: {
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
      findMany: vi.fn(async (a: { where: Record<string, Valeur> }) =>
        lignes().filter((l) => correspond(l as never, a.where)),
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
    numeroEmis: { findMany: vi.fn(async () => []) },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(prisma),
  };
  return { prisma };
});

import { facturerCommissionsDues, marquerVerse } from "../facturation";
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
  releveMois: null,
  verseeAt: null,
  majAt: new Date("2026-10-01T00:00:00Z"),
  activite: statut === "reprise" ? "reprise" : "audit",
  palier: null,
  parrainage: false,
  prixPublicHtCents: null,
  factureHtCents: 100_000,
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

  it("reprise plus grosse que les commissions dues : pas d'autofacture, la reprise reste à imputer", async () => {
    etat.lignes = [ligne("c1", "due", 10_000), ligne("r1", "reprise", -15_000)];
    const bilan = await facturerCommissionsDues(MARDI);
    expect(bilan.autofactures).toBe(0);
    expect(lignes()[1]!.autofactureNumero).toBeNull();
    expect(lignes()[1]!.releveMois).toBeNull();
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
