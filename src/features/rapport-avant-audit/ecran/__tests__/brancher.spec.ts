/**
 * Le raccord `brancher.ts` contre une base Prisma SIMULÉE (fausse table de la persistance) :
 * cloison par client, rapports écartés, base altérée, statuts, versions, noms, téléchargements.
 *
 * 🔑 Le test qui compte : pour CHAQUE méthode, le rapport du client B demandé avec le client A
 * rend EXACTEMENT la même chose qu'un identifiant inexistant — et le même rapport demandé avec
 * le client B est bien rendu (sans ce témoin positif, un `null` partout passerait).
 *
 * Mutation tentée : retirer `etat.clientId !== clientId` de `etatDuClient` fait échouer les tests
 * « cloison » (la base de B sort pour A). Données 100 % fictives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BaseAudit } from "../../base-audit-schema";

const faux = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  lancer: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return faux.db;
  },
}));
vi.mock("../../actions", () => ({ lancerRapportAvantAudit: faux.lancer }));
// Espion sur le VRAI rendu : l'aperçu ne doit jamais le déclencher.
const pdfClient = vi.hoisted(() => ({ genererPdfClient: vi.fn() }));
vi.mock("../../sorties/pdf-client", async (orig) => ({
  ...(await orig<typeof import("../../sorties/pdf-client")>()),
  genererPdfClient: pdfClient.genererPdfClient,
}));

import { scellerBase, scellerPropositions } from "../../persistance";
import { baseValide, fausseTable } from "../../__tests__/base.fixture";
import { ACCES_BRANCHE, REFUS_INTROUVABLE, fichesEnMarkdown } from "../brancher";
import type { FormatTelechargement } from "../contrat";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const INEXISTANT = "99999999-9999-4999-8999-999999999999";
const WILL = "aaaaaaaa-0000-4000-8000-000000000001";
const Q1 = "bbbbbbbb-0000-4000-8000-000000000001";

const ENV0 = { ...process.env };

function baseDe(clientId: string): BaseAudit {
  const b = baseValide();
  return { ...b, meta: { ...b.meta, clientId } };
}

let table: ReturnType<typeof fausseTable>;
let adminFindMany: ReturnType<typeof vi.fn>;
let envoisFindMany: ReturnType<typeof vi.fn>;
let horloge = 0;

/** Pose une ligne TERMINÉE (base scellée) pour `clientId`. */
async function rapportTermine(
  clientId: string,
  extra: Record<string, unknown> = {},
  base: BaseAudit = baseDe(clientId),
) {
  const s = scellerBase(base);
  const { id } = await table.create({
    data: {
      clientId,
      questionnaireIds: [Q1],
      lanceParId: WILL,
      statut: "termine",
      progression: 100,
      debutLe: new Date("2026-11-01T10:00:00Z"),
      finLe: new Date("2026-11-01T10:20:00Z"),
      baseAudit: s.chiffre,
      baseEmpreinte: s.empreinte,
      propositionsFiche: scellerPropositions(base.propositions_fiche),
      ...extra,
    },
    select: { id: true },
  });
  return id as string;
}

beforeEach(async () => {
  // `restoreAllMocks` (afterEach) efface l'implémentation : l'espion est ré-armé sur le VRAI rendu.
  const vrai = await vi.importActual<typeof import("../../sorties/pdf-client")>(
    "../../sorties/pdf-client",
  );
  pdfClient.genererPdfClient.mockReset().mockImplementation(vrai.genererPdfClient);
  process.env = { ...ENV0, PII_ENCRYPTION_KEY: "d".repeat(64) };
  horloge = 0;
  table = fausseTable(() => new Date(Date.UTC(2026, 10, 1, 9, 0, horloge++)));
  // La vraie requête trie `creeLe desc` : la fausse table l'imite ici.
  const findMany = table.findMany;
  (table as Record<string, unknown>).findMany = async (args: {
    where: Record<string, unknown>;
    select?: Record<string, boolean>;
    orderBy?: { creeLe?: "asc" | "desc" };
  }) => {
    const r = await findMany(args);
    if (args.orderBy?.creeLe === "desc") {
      return [...r].sort((x, y) => (y.creeLe as Date).getTime() - (x.creeLe as Date).getTime());
    }
    return r;
  };
  adminFindMany = vi.fn(async () => [{ id: WILL, name: "Will Exemple" }]);
  envoisFindMany = vi.fn(async () => [
    { questionnaireId: Q1, recuLe: new Date("2026-10-30T08:00:00Z") },
    { questionnaireId: Q1, recuLe: new Date("2026-10-31T08:00:00Z") },
    // reçue APRÈS le début du rapport : pas prise en compte
    { questionnaireId: Q1, recuLe: new Date("2026-11-01T11:00:00Z") },
  ]);
  faux.db = {
    rapportAvantAudit: table,
    adminUser: { findMany: adminFindMany },
    questionnaireAvantAuditEnvoi: { findMany: envoisFindMany },
  };
  faux.lancer.mockReset();
});
afterEach(() => {
  process.env = { ...ENV0 };
  vi.restoreAllMocks();
});

const FORMATS: ReadonlyArray<FormatTelechargement> = [
  "base-json",
  "base-md",
  "fiches-md",
  "pdf-client",
];

describe("cloison par client — le rapport de B demandé avec A = un identifiant inexistant", () => {
  it("lireBase", async () => {
    const rB = await rapportTermine(B);
    const croise = await ACCES_BRANCHE.lireBase(A, rB);
    const absent = await ACCES_BRANCHE.lireBase(A, INEXISTANT);
    expect(croise).toBeNull();
    expect(croise).toEqual(absent);
    // témoin positif : B lit bien SA base
    expect((await ACCES_BRANCHE.lireBase(B, rB))?.meta.clientId).toBe(B);
  });

  it("lirePropositions", async () => {
    const rB = await rapportTermine(B);
    const croise = await ACCES_BRANCHE.lirePropositions(A, rB);
    expect(croise).toEqual([]);
    expect(croise).toEqual(await ACCES_BRANCHE.lirePropositions(A, INEXISTANT));
    expect(await ACCES_BRANCHE.lirePropositions(B, rB)).toHaveLength(1);
  });

  it("telecharger, pour chaque format (PDF validé)", async () => {
    const rB = await rapportTermine(B, { pdfValideLe: new Date(), pdfValideParId: WILL });
    for (const f of FORMATS) {
      const croise = await ACCES_BRANCHE.telecharger(A, rB, f);
      expect(croise, f).toBeNull();
      expect(croise, f).toEqual(await ACCES_BRANCHE.telecharger(A, INEXISTANT, f));
    }
    expect(await ACCES_BRANCHE.telecharger(B, rB, "base-json")).not.toBeNull();
  });

  it("apercuPdf", async () => {
    const rB = await rapportTermine(B);
    const croise = await ACCES_BRANCHE.apercuPdf(A, rB);
    expect(croise).toBeNull();
    expect(croise).toEqual(await ACCES_BRANCHE.apercuPdf(A, INEXISTANT));
    expect(await ACCES_BRANCHE.apercuPdf(B, rB)).toEqual({ retiresPourRelecture: [] });
  });

  it("validerPdf : même refus, et la ligne de B n'est pas touchée", async () => {
    const rB = await rapportTermine(B);
    const croise = await ACCES_BRANCHE.validerPdf(A, rB, WILL);
    expect(croise).toEqual({ ok: false, raison: REFUS_INTROUVABLE });
    expect(croise).toEqual(await ACCES_BRANCHE.validerPdf(A, INEXISTANT, WILL));
    expect(table.lignes[0]?.pdfValideLe).toBeNull();
    expect(await ACCES_BRANCHE.validerPdf(B, rB, WILL)).toEqual({ ok: true });
    expect(table.lignes[0]?.pdfValideLe).toBeInstanceOf(Date);
  });

  it("listerRapports : A ne voit jamais le rapport de B", async () => {
    const rB = await rapportTermine(B);
    expect(await ACCES_BRANCHE.listerRapports(A)).toEqual([]);
    expect((await ACCES_BRANCHE.listerRapports(B)).map((r) => r.id)).toEqual([rB]);
  });

  it("identifiants mal formés : même réponse qu'un inexistant, sans lire la base", async () => {
    const rB = await rapportTermine(B);
    expect(await ACCES_BRANCHE.lireBase("pas-un-uuid", rB)).toBeNull();
    expect(await ACCES_BRANCHE.lireBase(B, "../etc")).toBeNull();
    expect(await ACCES_BRANCHE.listerRapports("x")).toEqual([]);
  });
});

describe("rapports écartés et bases illisibles", () => {
  it("un rapport écarté sort de la liste et ne se lit plus ; les versions ne bougent pas", async () => {
    const r1 = await rapportTermine(A);
    const r2 = await rapportTermine(A, { ecarteLe: new Date(), ecarteMotif: "effacement" });
    const r3 = await rapportTermine(A);
    const liste = await ACCES_BRANCHE.listerRapports(A);
    expect(liste.map((r) => [r.id, r.version])).toEqual([
      [r3, 3],
      [r1, 1],
    ]);
    expect(await ACCES_BRANCHE.lireBase(A, r2)).toBeNull();
    expect(await ACCES_BRANCHE.telecharger(A, r2, "base-json")).toBeNull();
    expect((await ACCES_BRANCHE.validerPdf(A, r2, WILL)).ok).toBe(false);
  });

  it("empreinte altérée : null, journalisée SANS contenu", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = await rapportTermine(A, { baseEmpreinte: "0".repeat(64) });
    expect(await ACCES_BRANCHE.lireBase(A, id)).toBeNull();
    expect(erreur).toHaveBeenCalledTimes(1);
    const ligne = String(erreur.mock.calls[0]?.[0]);
    expect(ligne).toContain("empreinte altérée");
    expect(ligne).toContain(id);
    expect(ligne).not.toMatch(/devis|soirées|Société/);
  });

  it("base absente (rapport en cours) : null", async () => {
    const { id } = await table.create({
      data: { clientId: A, questionnaireIds: [Q1], lanceParId: WILL, statut: "en_cours" },
      select: { id: true },
    });
    expect(await ACCES_BRANCHE.lireBase(A, id as string)).toBeNull();
  });
});

describe("résumé de la liste", () => {
  it("statuts : erreur et annule => echoue ; progression ; noms en UNE requête", async () => {
    await table.create({
      data: { clientId: A, questionnaireIds: [], lanceParId: WILL, statut: "erreur", erreur: "x" },
    });
    await table.create({
      data: { clientId: A, questionnaireIds: [], lanceParId: WILL, statut: "annule" },
    });
    await table.create({
      data: {
        clientId: A,
        questionnaireIds: [],
        lanceParId: null,
        statut: "en_cours",
        progression: 42,
      },
    });
    const id = await rapportTermine(A, { pdfValideLe: new Date(), pdfValideParId: WILL });
    const liste = await ACCES_BRANCHE.listerRapports(A);
    expect(liste.map((r) => [r.version, r.statut])).toEqual([
      [4, "termine"],
      [3, "en_cours"],
      [2, "echoue"],
      [1, "echoue"],
    ]);
    expect(liste[1]?.progression).toBe(42);
    expect(liste[0]).toMatchObject({ id, lancePar: "Will Exemple", pdfValidePar: "Will Exemple" });
    expect(liste[1]?.lancePar).toBeNull();
    expect(adminFindMany).toHaveBeenCalledTimes(1);
  });

  it("reponsesJusquau : la plus récente réponse AVANT le début, sinon null", async () => {
    await rapportTermine(A);
    await table.create({
      data: { clientId: A, questionnaireIds: [Q1], lanceParId: WILL, statut: "en_attente" },
    });
    const [attente, termine] = await ACCES_BRANCHE.listerRapports(A);
    expect(termine?.reponsesJusquau).toEqual(new Date("2026-10-31T08:00:00Z"));
    expect(attente?.reponsesJusquau).toBeNull(); // pas encore démarré
  });
});

describe("téléchargements", () => {
  it("le PDF client est refusé tant qu'il n'est pas validé ; pdfChemin n'est jamais lu", async () => {
    const id = await rapportTermine(A, { pdfChemin: "/etc/passwd" });
    expect(await ACCES_BRANCHE.telecharger(A, id, "pdf-client")).toBeNull();
    expect((await ACCES_BRANCHE.validerPdf(A, id, WILL)).ok).toBe(true);
    const f = await ACCES_BRANCHE.telecharger(A, id, "pdf-client");
    expect(f?.type).toBe("application/pdf");
    expect(
      Buffer.from(f?.contenu as Uint8Array)
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });

  it("base-json, base-md et fiches-md", async () => {
    const id = await rapportTermine(A);
    const json = await ACCES_BRANCHE.telecharger(A, id, "base-json");
    expect(JSON.parse(String(json?.contenu)).meta.clientId).toBe(A);
    expect((await ACCES_BRANCHE.telecharger(A, id, "base-md"))?.type).toContain("markdown");
    expect(String((await ACCES_BRANCHE.telecharger(A, id, "fiches-md"))?.contenu)).toMatch(
      /^# Fiches des personnes/,
    );
    expect(fichesEnMarkdown(baseDe(A))).toContain("Aucune fiche individuelle");
  });

  it("validerPdf déjà validé : sans effet, ok", async () => {
    const avant = new Date("2026-11-01T12:00:00Z");
    const id = await rapportTermine(A, { pdfValideLe: avant, pdfValideParId: WILL });
    expect(await ACCES_BRANCHE.validerPdf(A, id, "autre")).toEqual({ ok: true });
    expect(table.lignes[0]?.pdfValideLe).toEqual(avant);
    expect(table.lignes[0]?.pdfValideParId).toBe(WILL);
  });
});

describe("aperçu du PDF client (sans rendu)", () => {
  /** Une base qui porte deux passages à retirer (mots interdits), 100 % fictive. */
  function baseAvecInterdits(): BaseAudit {
    const b = baseDe(A);
    return {
      ...b,
      besoins_declares: [{ ...b.besoins_declares[0]!, enonce: "Un gain garanti sur les devis" }],
      pistes: [b.pistes[0]!, { ...b.pistes[0]!, id: "P2", titre: "Préparer Qualiopi", rang: 2 }],
    };
  }

  it("n'appelle jamais genererPdfClient et rend les MÊMES passages retirés que le rendu", async () => {
    const base = baseAvecInterdits();
    const id = await rapportTermine(A, {}, base);
    const apercu = await ACCES_BRANCHE.apercuPdf(A, id);
    expect(pdfClient.genererPdfClient).not.toHaveBeenCalled();
    expect(apercu?.retiresPourRelecture.map((r) => r.ou).sort()).toEqual(["besoin", "piste"]);
    // Témoin : le rendu complet retire exactement les mêmes passages.
    const { genererPdfClient } = await import("../../sorties/pdf-client");
    const { retiresPourRelecture } = await genererPdfClient(base);
    expect(pdfClient.genererPdfClient).toHaveBeenCalledTimes(1); // l'espion voit bien le rendu
    expect(apercu).toEqual({ retiresPourRelecture });
  }, 30_000);
});

describe("lancer", () => {
  it("délègue à `lancerRapportAvantAudit(clientId)` et traduit le refus", async () => {
    faux.lancer.mockResolvedValueOnce({ ok: true, rapportId: "r" });
    expect(await ACCES_BRANCHE.lancer(A, WILL)).toEqual({ ok: true, rapportId: "r" });
    expect(faux.lancer).toHaveBeenCalledWith(A);
    faux.lancer.mockResolvedValueOnce({ ok: false, erreur: "Non." });
    expect(await ACCES_BRANCHE.lancer(A, WILL)).toEqual({ ok: false, raison: "Non." });
  });
});
