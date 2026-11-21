/**
 * Garde de version d'une SIGNATURE de devis, contre un VRAI Postgres (Gate D :
 * étape « Devis : tests d'intégration », `pnpm test:integration tests/integration/devis`).
 *
 * Règle d'argent : dès que la version 2 est émise, la version 1 ne reçoit plus AUCUNE signature.
 *   S = signature d'une pièce v1 (VRAIE `signerDocument`, scan papier : le canal où l'envoi vers R2
 *       ouvre la fenêtre de course) ;
 *   A = émission de la version 2 (VRAIE `marquerDevisEnvoye`, dans une transaction que le test garde
 *       ouverte).
 * Les transactions sont réellement VALIDÉES. Seules les sorties externes sont simulées : le
 * stockage du scan (PILOTABLE : il signale son entrée et attend une porte, c'est la fenêtre réelle
 * d'envoi vers R2) et les effets de bord de l'envoi (PDF, e-mail, événements Partners, journal).
 *
 * Canal couvert : reversement papier (porteur `reversement_papier`, partie client). Le canal par
 * lien (`signataire_jeton`) passe par la même garde, dans la même transaction de `signerDocument` ;
 * il n'est pas rejoué ici.
 *
 * Les lignes sont des lignes de TEST (numéros `TEST-…`), retirées en `afterAll` par identifiant.
 * Les tables de preuve sont en ajout seul (déclencheurs, clés étrangères RESTRICT) : si leur
 * suppression est refusée, rien n'est forcé — la base de CI est jetable.
 *
 * Sans `DATABASE_URL`, ce fichier ÉCHOUE — il ne se saute pas.
 */
import { randomUUID } from "node:crypto";
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
  /** Retient `stockerScanPapier` : `entre` signale l'arrivée, `porte` libère. */
  stockage: null as { entre: () => void; porte: Promise<void> } | null,
  supprimerScan: vi.fn(async (_cle: string) => undefined),
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
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: vi.fn(async () => null),
  emettreDevisSigne: vi.fn(async () => undefined),
  transactionDevisSigne: async (
    client: { $transaction: (f: unknown) => Promise<unknown> },
    travail: unknown,
  ) => client.$transaction(travail),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/server/qualiopi/emargement/storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/scan-papier-storage", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/qualiopi/documents/signature/scan-papier-storage")
  >()),
  stockerScanPapier: vi.fn(async (a: { id: string }) => {
    if (h.stockage !== null) {
      h.stockage.entre();
      await h.stockage.porte;
    }
    return {
      key: `documents/2026/devis-signes-papier/${a.id}.pdf`,
      sha256: "d".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 64,
    };
  }),
  supprimerScanPapier: h.supprimerScan,
}));

import { marquerDevisEnvoye } from "../../../src/server/qualiopi/devis/marquer-devis-envoye";
import { VersionRemplaceeSigneeEntreTempsError } from "../../../src/server/qualiopi/devis/version-remplacee";
import { signerDocument } from "../../../src/server/qualiopi/documents/signature/document-signature-service";

const db = new PrismaClient();
const HASH = "c".repeat(64);
const JOUR = 86_400_000;
const OCTETS = Buffer.from("%PDF-1.7\n contenu \n%%EOF\n");
const creees: {
  v1: string[];
  v2: string[];
  pieces: string[];
  clients: string[];
  admins: string[];
} = { v1: [], v2: [], pieces: [], clients: [], admins: [] };

beforeEach(() => {
  h.stockage = null;
  h.supprimerScan.mockClear();
});

async function essayer(libelle: string, f: () => Promise<unknown>) {
  try {
    await f();
  } catch (e) {
    // Nettoyage au mieux : la base de CI est jetable (tables de preuve en ajout seul).
    console.warn(`[signature-version-remplacee] nettoyage incomplet : ${libelle}`, e);
  }
}

afterAll(async () => {
  try {
    const ids = [...creees.v1, ...creees.v2];
    await essayer("horodatages", () =>
      db.documentSignatureHorodatage.deleteMany({
        where: { signature: { documentGenereId: { in: creees.pieces } } },
      }),
    );
    await essayer("signatures", () =>
      db.documentSignature.deleteMany({ where: { documentGenereId: { in: creees.pieces } } }),
    );
    await essayer("journal", () => db.activityLog.deleteMany({ where: { targetId: { in: ids } } }));
    await essayer("devis v2", () => db.devis.deleteMany({ where: { id: { in: creees.v2 } } }));
    await essayer("devis v1", () => db.devis.deleteMany({ where: { id: { in: creees.v1 } } }));
    await essayer("pièces", () =>
      db.documentGenere.deleteMany({ where: { id: { in: creees.pieces } } }),
    );
    await essayer("clients", () => db.client.deleteMany({ where: { id: { in: creees.clients } } }));
    await essayer("administrateurs", () =>
      db.adminUser.deleteMany({ where: { id: { in: creees.admins } } }),
    );
  } finally {
    await db.$disconnect();
  }
});

interface Jeu {
  clientId: string;
  adminId: string;
  v1: { id: string; pieceId: string };
  v2: { id: string; numero: string; pieceId: string; updatedAt: Date };
}

/** Un client, un administrateur actif, une pièce v1 (hash + `envoye`) et v2 `brouillon` qui la remplace. */
async function creerJeu(tag: string): Promise<Jeu> {
  const admin = await db.adminUser.create({
    data: {
      name: `Admin test SV ${tag}`,
      email: `test-sv-${tag.toLowerCase()}-${randomUUID()}@axion.test`,
      passwordHash: "x".repeat(20),
      role: "super_admin",
      status: "active",
    },
  });
  creees.admins.push(admin.id);
  const client = await db.client.create({
    data: { numero: `TEST-CLI-SV-${tag}`, raisonSociale: `Client test SV ${tag}` },
  });
  creees.clients.push(client.id);
  const piece1 = await db.documentGenere.create({
    data: {
      type: "devis",
      numero: `TEST-DOC-SV-${tag}-1`,
      clientId: client.id,
      hashSha256: HASH,
      suppressionPrevueAt: new Date(Date.now() + 365 * JOUR),
    },
  });
  const piece2 = await db.documentGenere.create({
    data: {
      type: "devis",
      numero: `TEST-DOC-SV-${tag}-2`,
      clientId: client.id,
      hashSha256: HASH,
      suppressionPrevueAt: new Date(Date.now() + 365 * JOUR),
    },
  });
  creees.pieces.push(piece1.id, piece2.id);
  const v1 = await db.devis.create({
    data: {
      numero: `TEST-DEV-SV-${tag}-1`,
      clientId: client.id,
      lignes: [],
      montantTotalHtCents: 100000,
      mentionTva: "TVA 20 %",
      statut: "envoye",
      dateValidite: new Date(Date.now() + 30 * JOUR),
      sentAt: new Date(Date.now() - 10 * JOUR),
      documentGenereId: piece1.id,
    },
  });
  creees.v1.push(v1.id);
  const v2 = await db.devis.create({
    data: {
      numero: `TEST-DEV-SV-${tag}-2`,
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
    adminId: admin.id,
    v1: { id: v1.id, pieceId: piece1.id },
    v2: { id: v2.id, numero: v2.numero, pieceId: piece2.id, updatedAt: v2.updatedAt },
  };
}

/** S : signature du client par scan papier, VRAIE `signerDocument`. */
function lancerS(jeu: Jeu) {
  return signerDocument({
    documentGenereId: jeu.v1.pieceId,
    porteur: {
      type: "reversement_papier",
      adminId: jeu.adminId,
      provider: "physical_signed",
      partie: "client",
      signataire: { nom: "Camille Durand", email: "camille@client.test", qualite: "Gérante" },
    },
    methode: "papier_scanne",
    partiesRequises: ["client", "axionia"],
    scanPdf: { octets: OCTETS },
  });
}

/** Retient le stockage du scan (fenêtre d'envoi vers R2) ; `entre` se résout quand S y arrive. */
function retenirStockage() {
  const entre = porte();
  const libere = porte();
  h.stockage = { entre: entre.ouvrir, porte: libere.promise };
  return { entre: entre.promise, liberer: libere.ouvrir };
}

/**
 * A : émission de la version 2 par la VRAIE `marquerDevisEnvoye`, dans une transaction que le test
 * garde ouverte jusqu'à `fin`. `ecrit` se résout quand la fonction a rendu la main (écritures et
 * verrou de ligne posés). Le statut de la version 1 est « périmé » : `envoye`.
 */
function lancerA(jeu: Jeu, opts: { echoue?: boolean } = {}) {
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
          pdfCle: "documents/test/sv.pdf",
          documentGenereId: jeu.v2.pieceId,
          replacesDevisId: jeu.v1.id,
          replacesDevis: { statut: "envoye", documentGenereId: jeu.v1.pieceId },
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

async function etat(jeu: Jeu) {
  const [v1, v2, piece, signatures, horodatages] = await Promise.all([
    db.devis.findUniqueOrThrow({ where: { id: jeu.v1.id }, select: { statut: true } }),
    db.devis.findUniqueOrThrow({ where: { id: jeu.v2.id }, select: { statut: true } }),
    db.documentGenere.findUniqueOrThrow({
      where: { id: jeu.v1.pieceId },
      select: { statutSignature: true },
    }),
    db.documentSignature.count({
      where: { documentGenereId: jeu.v1.pieceId, partie: "client", revokedAt: null },
    }),
    db.documentSignatureHorodatage.count({
      where: { signature: { documentGenereId: jeu.v1.pieceId } },
    }),
  ]);
  // Règle d'argent commune à tous les cas : jamais (signature client non révoquée sur la pièce v1
  // ET v2 non `brouillon`) ; au plus une version `envoye`.
  expect(signatures > 0 && v2.statut !== "brouillon").toBe(false);
  expect([v1.statut, v2.statut].filter((s) => s === "envoye").length).toBeLessThanOrEqual(1);
  return {
    v1: v1.statut,
    v2: v2.statut,
    statutSignature: piece.statutSignature,
    signatures,
    horodatages,
  };
}

describe("signature d'une version de devis : jamais sur une version remplacée, Postgres réel", () => {
  it("envoi_pendant_l_envoi_R2_signature_attend_puis_refusee", async () => {
    const jeu = await creerJeu("S1");
    const avant = await etat(jeu);
    const stockage = retenirStockage();
    const s = lancerS(jeu);
    await stockage.entre; // S est en train d'envoyer le scan : tous ses contrôles sont passés
    const a = lancerA(jeu);
    await a.ecrit; // v2 « envoye » non validée, ligne v1 verrouillée
    stockage.liberer();
    expect(await resteEnAttente(s)).toBe(true); // S attend le verrou de ligne, en ne tenant rien
    a.fin();
    expect((await a.resultat).ok).toBe(true);
    expect(await s).toMatchObject({ ok: false, raison: "version_remplacee" });
    const fin = await etat(jeu);
    expect(fin).toMatchObject({ v1: "expire", v2: "envoye", signatures: 0, horodatages: 0 });
    expect(fin.statutSignature).toBe(avant.statutSignature);
    expect(h.supprimerScan).toHaveBeenCalledTimes(1);
  });

  it("envoi_valide_pendant_l_envoi_R2", async () => {
    const jeu = await creerJeu("S2");
    const avant = await etat(jeu);
    const stockage = retenirStockage();
    const s = lancerS(jeu);
    await stockage.entre;
    const a = lancerA(jeu);
    await a.ecrit;
    a.fin();
    expect((await a.resultat).ok).toBe(true); // A complète et VALIDÉE avant que S n'inscrive
    stockage.liberer();
    expect(await s).toMatchObject({ ok: false, raison: "version_remplacee" });
    const fin = await etat(jeu);
    expect(fin).toMatchObject({ v1: "expire", v2: "envoye", signatures: 0, horodatages: 0 });
    expect(fin.statutSignature).toBe(avant.statutSignature);
    expect(h.supprimerScan).toHaveBeenCalledTimes(1);
  });

  it("envoi_annule_la_signature_passe", async () => {
    const jeu = await creerJeu("S3");
    const stockage = retenirStockage();
    const s = lancerS(jeu);
    await stockage.entre;
    const a = lancerA(jeu, { echoue: true });
    await a.ecrit;
    stockage.liberer();
    expect(await resteEnAttente(s)).toBe(true);
    a.fin();
    expect((await a.resultat).ok).toBe(false);
    expect(await s).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(await etat(jeu)).toMatchObject({
      v1: "envoye",
      v2: "brouillon",
      signatures: 1,
      horodatages: 1,
    });
    expect(h.supprimerScan).not.toHaveBeenCalled();
  });

  it("signature_d_abord_puis_envoi", async () => {
    const jeu = await creerJeu("S4");
    expect(await lancerS(jeu)).toMatchObject({ ok: true, statutSignature: "partielle" });
    const a = lancerA(jeu); // statut périmé « envoye »
    const fin = await a.resultat;
    a.fin();
    expect(fin.ok).toBe(false);
    expect((fin as { erreur: unknown }).erreur).toBeInstanceOf(
      VersionRemplaceeSigneeEntreTempsError,
    );
    expect(await etat(jeu)).toMatchObject({ v1: "envoye", v2: "brouillon", signatures: 1 });
  });

  it("successeur_brouillon_n_empeche_rien", async () => {
    const jeu = await creerJeu("S5");
    expect(await lancerS(jeu)).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(await etat(jeu)).toMatchObject({ v1: "envoye", v2: "brouillon", signatures: 1 });
  });
});
