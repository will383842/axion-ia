/**
 * Verrou de ligne sur la version REMPLACÉE d'un devis, contre un VRAI Postgres (Gate D :
 * étape « Devis : tests d'intégration », `pnpm test:integration tests/integration/devis`).
 *
 * Règle d'argent : dès que la version 2 est émise, la version 1 n'est plus jamais « envoye »
 * (ni « accepte »). On éprouve les entrelacements entre :
 *   A = émission de la version 2 (`marquerDevisEnvoye`, VRAIE fonction, dans une transaction que le
 *       test garde ouverte) ;
 *   B = `prolongerValiditeDevisAction` (VRAIE action) ;
 *   C = `acceptDevisAction` (VRAIE action).
 * Les transactions sont réellement VALIDÉES (jamais annulées par le test) ; seules les sorties
 * externes sont simulées (PDF, e-mail, événements Partners, journal).
 *
 * Les lignes sont des lignes de TEST (numéros `TEST-…`), retirées en `afterAll` par identifiant.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "../../../prisma/generated/client";

type Porte = { promise: Promise<void>; ouvrir: () => void };
function porte(): Porte {
  let ouvrir!: () => void;
  const promise = new Promise<void>((r) => {
    ouvrir = r;
  });
  return { promise, ouvrir };
}

const h = vi.hoisted(() => ({
  /** Retient `emettreDevisEmis` pour un devis donné : `entre` signale l'arrivée, `porte` libère. */
  retenir: new Map<string, { entre: () => void; porte: Promise<void> }>(),
  /** Vrai : `transactionDevisSigne` est la VRAIE fonction (canal Partners fermé), sans simulacre. */
  vraieTransaction: false,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/email/outbox-service", () => ({ resoudreMode: async () => "auto" }));
vi.mock("@/server/actions/qualiopi/_guards", () => {
  const session = { userId: "00000000-0000-4000-8000-0000000000aa", role: "super_admin" };
  return {
    requireAdminWrite: vi.fn(async () => session),
    requireHabilitation: vi.fn(async () => session),
    logQualiopiActivity: vi.fn(async () => undefined),
    donneesJournalQualiopi: vi.fn(
      async (i: { action: string; targetType: string; targetId: string; changes: unknown }) => ({
        adminUserId: null,
        action: i.action,
        targetType: i.targetType,
        targetId: i.targetId,
        changes: i.changes,
        ipAddress: null,
        userAgent: null,
      }),
    ),
  };
});
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => false,
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({ identite: {}, formules: undefined })),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(async () => ({ token: "tok" })),
  revoquerTokensDocument: vi.fn(async () => 0),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(async () => ({ enqueued: true })),
  sonderEnvoiOutboxAvecLien: async () => ({ dejaFait: false, urlEnFile: null }),
}));
vi.mock("@/server/partners-sync/producteurs/devis", async (importOriginal) => ({
  emettreDevisEmis: vi.fn(async (_tx: unknown, devisId: string) => {
    const g = h.retenir.get(devisId);
    if (g) {
      g.entre();
      await g.porte;
    }
    return null;
  }),
  emettreDevisSigne: vi.fn(async () => undefined),
  // Par défaut un `$transaction` permanent (les cas d'entrelacement en ont besoin). Le cas
  // « canal fermé » bascule sur la vraie fonction, qui, sans l'option, n'ouvre AUCUNE transaction.
  transactionDevisSigne: async (
    client: { $transaction: (f: unknown) => Promise<unknown> },
    travail: unknown,
    options?: unknown,
  ) => {
    if (h.vraieTransaction) {
      const reel = await importOriginal<
        typeof import("@/server/partners-sync/producteurs/devis")
      >();
      return reel.transactionDevisSigne(
        client as never,
        travail as never,
        options as never,
      );
    }
    return client.$transaction(travail);
  },
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/features/dossier-client/devis-signe-fait-client", () => ({
  faireMonterLesFichesDesDevisSignes: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/devis/proposer-plans", () => ({
  proposerPlansApresAcceptation: vi.fn(async () => undefined),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn(async () => undefined) }));

import { logQualiopiActivity } from "../../../src/server/actions/qualiopi/_guards";
import { acceptDevisAction } from "../../../src/server/actions/qualiopi/devis";
import { prolongerValiditeDevisAction } from "../../../src/server/actions/qualiopi/devis-prolonger-validite";
import { marquerDevisEnvoye } from "../../../src/server/qualiopi/devis/marquer-devis-envoye";
import { VersionRemplaceeSigneeEntreTempsError } from "../../../src/server/qualiopi/devis/version-remplacee";

const db = new PrismaClient();
const HASH = "c".repeat(64);
const JOUR = 86_400_000;
const creees: { v1: string[]; v2: string[]; pieces: string[]; clients: string[] } = {
  v1: [],
  v2: [],
  pieces: [],
  clients: [],
};

beforeEach(() => {
  h.retenir.clear();
  h.vraieTransaction = false;
});

afterAll(async () => {
  try {
    const ids = [...creees.v1, ...creees.v2];
    await db.activityLog.deleteMany({ where: { targetId: { in: ids } } });
    await db.devis.deleteMany({ where: { id: { in: creees.v2 } } });
    await db.devis.deleteMany({ where: { id: { in: creees.v1 } } });
    await db.documentGenere.deleteMany({ where: { id: { in: creees.pieces } } });
    await db.client.deleteMany({ where: { id: { in: creees.clients } } });
  } catch (e) {
    // Nettoyage au mieux : la base de CI est jetable.
    console.warn("[versions-concurrentes] nettoyage incomplet", e);
  } finally {
    await db.$disconnect();
  }
});

interface Jeu {
  clientId: string;
  v1: { id: string; pieceId: string; dateValidite: Date };
  v2: { id: string; numero: string; pieceId: string; updatedAt: Date };
}

/** Un client, une pièce, v1 (pièce + sentAt) et v2 `brouillon` qui la remplace. */
async function creerJeu(tag: string, statutV1: "envoye" | "expire"): Promise<Jeu> {
  const client = await db.client.create({
    data: { numero: `TEST-CLI-VV-${tag}`, raisonSociale: `Client test VV ${tag}` },
  });
  creees.clients.push(client.id);
  const piece1 = await db.documentGenere.create({
    data: {
      type: "devis",
      numero: `TEST-DOC-VV-${tag}-1`,
      clientId: client.id,
      hashSha256: HASH,
      suppressionPrevueAt: new Date(Date.now() + 365 * JOUR),
    },
  });
  const piece2 = await db.documentGenere.create({
    data: {
      type: "devis",
      numero: `TEST-DOC-VV-${tag}-2`,
      clientId: client.id,
      hashSha256: HASH,
      suppressionPrevueAt: new Date(Date.now() + 365 * JOUR),
    },
  });
  creees.pieces.push(piece1.id, piece2.id);
  const dateValidite = new Date(Date.now() + (statutV1 === "expire" ? -2 : 30) * JOUR);
  const v1 = await db.devis.create({
    data: {
      numero: `TEST-DEV-VV-${tag}-1`,
      clientId: client.id,
      lignes: [],
      montantTotalHtCents: 100000,
      mentionTva: "TVA 20 %",
      statut: statutV1,
      dateValidite,
      sentAt: new Date(Date.now() - 10 * JOUR),
      documentGenereId: piece1.id,
    },
  });
  creees.v1.push(v1.id);
  const v2 = await db.devis.create({
    data: {
      numero: `TEST-DEV-VV-${tag}-2`,
      clientId: client.id,
      lignes: [],
      montantTotalHtCents: 100000,
      mentionTva: "TVA 20 %",
      statut: "brouillon",
      dateValidite: new Date(Date.now() + 365 * JOUR),
      replacesDevisId: v1.id,
    },
  });
  creees.v2.push(v2.id);
  return {
    clientId: client.id,
    v1: { id: v1.id, pieceId: piece1.id, dateValidite },
    v2: { id: v2.id, numero: v2.numero, pieceId: piece2.id, updatedAt: v2.updatedAt },
  };
}

/**
 * A : émission de la version 2 par la VRAIE `marquerDevisEnvoye`, dans une transaction que le test
 * garde ouverte jusqu'à `fin`. `ecrit` se résout quand la fonction a rendu la main (écritures et
 * verrou de ligne posés). `statutPerime` est le statut lu « en début de transaction ».
 */
function lancerA(jeu: Jeu, statutPerime: string, opts: { echoue?: boolean } = {}) {
  const ecrit = porte();
  const fin = porte();
  const resultat = db
    .$transaction(
      async (tx) => {
        await marquerDevisEnvoye(tx, {
          devisId: jeu.v2.id,
          clientId: jeu.clientId,
          numero: jeu.v2.numero,
          updatedAt: jeu.v2.updatedAt,
          pdfCle: "documents/test/vv.pdf",
          documentGenereId: jeu.v2.pieceId,
          replacesDevisId: jeu.v1.id,
          replacesDevis: { statut: statutPerime, documentGenereId: jeu.v1.pieceId },
        });
        ecrit.ouvrir();
        await fin.promise;
        if (opts.echoue) throw new Error("A annulée par le test");
      },
      { timeout: 30_000, maxWait: 10_000 },
    )
    .then(
      () => ({ ok: true as const }),
      (erreur: unknown) => ({ ok: false as const, erreur }),
    );
  return { ecrit: ecrit.promise, fin: fin.ouvrir, resultat };
}

/** « Reste en attente » : la promesse n'est pas terminée au bout de 400 ms. */
async function resteEnAttente(p: Promise<unknown>): Promise<boolean> {
  const verdict = await Promise.race([
    p.then(() => "fini"),
    new Promise<string>((r) => setTimeout(() => r("attend"), 400)),
  ]);
  return verdict === "attend";
}

const dansDixJours = () => new Date(Date.now() + 10 * JOUR).toISOString().slice(0, 10);
const prolonger = (id: string) =>
  prolongerValiditeDevisAction({ devisId: id, nouvelleDate: dansDixJours() });

async function statuts(jeu: Jeu) {
  const [v1, v2] = await Promise.all([
    db.devis.findUniqueOrThrow({
      where: { id: jeu.v1.id },
      select: { statut: true, dateValidite: true },
    }),
    db.devis.findUniqueOrThrow({ where: { id: jeu.v2.id }, select: { statut: true } }),
  ]);
  // Règle d'argent commune à tous les cas.
  expect([v1.statut, v2.statut].filter((s) => s === "envoye").length).toBeLessThanOrEqual(1);
  expect(v1.statut === "accepte" && v2.statut === "envoye").toBe(false);
  return { v1: v1.statut, v2: v2.statut, dateV1: v1.dateValidite };
}

describe("deux versions d'un même devis : jamais deux ouvertes, Postgres réel", () => {
  it("envoi_d_abord_puis_prolongation", async () => {
    const jeu = await creerJeu("A1", "expire");
    const a = lancerA(jeu, "expire");
    await a.ecrit;
    const b = prolonger(jeu.v1.id);
    expect(await resteEnAttente(b)).toBe(true);
    a.fin();
    expect((await a.resultat).ok).toBe(true);
    const r = await b;
    expect((r as { error?: string }).error).toMatch(/version plus récente/);
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "expire", v2: "envoye" });
    expect(etat.dateV1.getTime()).toBe(jeu.v1.dateValidite.getTime());
  });

  it("prolongation_d_abord_puis_envoi", async () => {
    const jeu = await creerJeu("A2", "expire");
    const retenue = porte();
    const bEntre = porte();
    h.retenir.set(jeu.v1.id, { entre: bEntre.ouvrir, porte: retenue.promise });
    const b = prolonger(jeu.v1.id);
    await bEntre.promise; // B a écrit v1 et relu v2 (brouillon) : sa transaction reste ouverte
    const a = lancerA(jeu, "expire"); // statut périmé
    expect(await resteEnAttente(a.resultat)).toBe(true);
    retenue.ouvrir();
    const r = await b;
    expect(r).toMatchObject({ data: { rouvert: true } });
    a.fin();
    expect((await a.resultat).ok).toBe(true);
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "expire", v2: "envoye" });
  });

  it("prolongation_validee_pendant_l_envoi (lecture périmée)", async () => {
    const jeu = await creerJeu("A3", "expire");
    const r = await prolonger(jeu.v1.id);
    expect(r).toMatchObject({ data: { rouvert: true } });
    // A lisait « expire » au début de sa transaction : la prolongation est passée depuis.
    const a = lancerA(jeu, "expire");
    await a.ecrit;
    a.fin();
    expect((await a.resultat).ok).toBe(true);
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "expire", v2: "envoye" });
  });

  it("envoi_annule_la_prolongation_aboutit", async () => {
    const jeu = await creerJeu("A4", "expire");
    const a = lancerA(jeu, "expire", { echoue: true });
    await a.ecrit;
    const b = prolonger(jeu.v1.id);
    expect(await resteEnAttente(b)).toBe(true);
    a.fin();
    expect((await a.resultat).ok).toBe(false);
    const r = await b;
    expect(r).toMatchObject({ data: { rouvert: true } });
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "envoye", v2: "brouillon" });
  });

  it("acceptation_d_abord", async () => {
    const jeu = await creerJeu("A5", "envoye");
    const r = await acceptDevisAction(jeu.v1.id);
    expect(r).toMatchObject({ data: { id: jeu.v1.id } });
    const a = lancerA(jeu, "envoye"); // statut périmé
    const fin = await a.resultat.then(
      (x) => x,
      (e) => ({ ok: false as const, erreur: e }),
    );
    a.fin();
    expect(fin.ok).toBe(false);
    expect((fin as { erreur: unknown }).erreur).toBeInstanceOf(
      VersionRemplaceeSigneeEntreTempsError,
    );
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "accepte", v2: "brouillon" });
  });

  it("envoi_d_abord_puis_acceptation", async () => {
    const jeu = await creerJeu("A6", "envoye");
    const a = lancerA(jeu, "envoye");
    await a.ecrit; // v1 « expire » (non validé), ligne verrouillée
    const c = acceptDevisAction(jeu.v1.id);
    expect(await resteEnAttente(c)).toBe(true);
    a.fin();
    expect((await a.resultat).ok).toBe(true);
    const r = await c;
    expect((r as { error?: string }).error).toMatch(/remplacé par une version plus récente/);
    const etat = await statuts(jeu);
    expect(etat).toMatchObject({ v1: "expire", v2: "envoye" });
  });

  it("envoi_d_abord_puis_acceptation, canal Partners FERMÉ, vraie transactionDevisSigne", async () => {
    const ancien = process.env.PARTNERS_SYNC_ENABLED;
    process.env.PARTNERS_SYNC_ENABLED = "false";
    h.vraieTransaction = true;
    try {
      vi.mocked(logQualiopiActivity).mockClear();
      const jeu = await creerJeu("A7", "envoye");
      const a = lancerA(jeu, "envoye");
      await a.ecrit; // v1 « expire » (non validé), ligne verrouillée
      const c = acceptDevisAction(jeu.v1.id);
      expect(await resteEnAttente(c)).toBe(true);
      a.fin();
      expect((await a.resultat).ok).toBe(true);
      const r = await c;
      expect((r as { error?: string }).error).toMatch(/version plus récente/);
      const etat = await statuts(jeu);
      expect(etat).toMatchObject({ v1: "expire", v2: "envoye" });
      expect(vi.mocked(logQualiopiActivity)).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: "qualiopi.devis.accept", targetId: jeu.v1.id }),
      );
      expect(
        await db.activityLog.count({
          where: { targetId: jeu.v1.id, action: "qualiopi.devis.accept" },
        }),
      ).toBe(0);
    } finally {
      h.vraieTransaction = false;
      if (ancien === undefined) delete process.env.PARTNERS_SYNC_ENABLED;
      else process.env.PARTNERS_SYNC_ENABLED = ancien;
    }
  });
});
