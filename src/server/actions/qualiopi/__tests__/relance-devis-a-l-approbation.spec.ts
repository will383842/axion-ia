/**
 * B3 PR 2 — l'approbation d'une RELANCE de devis (`relance-devis-client`) : le lien de signature
 * naît à l'envoi par la voie « devis-renvoi » (verrou du devis, jeton haché, ancien lien révoqué),
 * les pièces jointes de la ligne passent, et une relance devenue sans objet (signée, refusée,
 * acceptée, périmée…) ne crée AUCUN jeton et ne part pas. Le vrai module `lien-a-l-envoi`, la
 * vraie `approuverEmailAction` et le vrai `motifRelanceDevisSansObjet` tournent ; base, file et
 * jetons sont simulés dans un monde en mémoire (verrou consultatif compris).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const ANCIEN = "22222222-2222-4222-8222-222222222222";
const ADRESSE = "client-secret@exemple.test";

interface Ligne {
  id: string;
  template: string;
  recipient: string;
  locale: string;
  payload: Record<string, unknown>;
  sujet: string;
  statut: string;
  clientId: string | null;
  entityType: string | null;
  entityId: string | null;
  attachments: unknown;
  refuseMotif?: string | null;
}

const h = vi.hoisted(() => ({
  /** OUT-1 : résultat de la sonde « envoi déjà fait ? » (sous le verrou du devis, avant tout jeton). */
  sonde: {
    v: "a_faire" as "a_faire" | "deja_fait",
    url: null as string | null,
    // Le lien que porte la tâche en file : vivant (cette pièce, partie client) ou non.
    vivant: true,
  },
  mode: { v: "validation" as "validation" | "auto" },
  lignes: [] as Array<Record<string, unknown>>,
  devis: { v: {} as Record<string, unknown> },
  ancien: { v: {} as Record<string, unknown> },
  journalEcritures: [] as string[],
  nbJetons: { v: 0 },
  bornes: [] as Date[],
  signe: { v: false },
  suivante: { v: 0 },
  verrous: new Set<string>(),
  echecEnfilage: { v: false },
  precedents: new Map<string, string[]>(),
  vivants: new Set<string>(),
  partis: [] as Array<{ payload: Record<string, unknown>; options: Record<string, unknown> }>,
  appelsEnqueue: [] as Array<{
    payload: Record<string, unknown>;
    options: Record<string, unknown>;
  }>,
  verdictForce: { v: null as null | Record<string, unknown> },
  emettre: vi.fn(),
  log: vi.fn(),
  sentryExc: vi.fn(),
  sentryMsg: vi.fn(),
}));

const lignes = () => h.lignes as unknown as Ligne[];

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentryExc(...a),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "adm-1", role: "super_admin" }),
  requireHabilitation: async () => ({ userId: "adm-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => false,
}));
vi.mock("@/server/qualiopi/documents/donnees-pdf-devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/donnees-pdf-devis")>()),
  lireContextePdfDevis: vi.fn(async () => ({})),
  donneesPdfDevis: vi.fn(() => ({ identite: {}, formules: undefined })),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: vi.fn(async () => ({ id: "piece-1", numero: "AXI-DEV-2026-001" })),
}));
vi.mock("@/server/email/outbox-service", () => ({
  resoudreMode: async () => h.mode.v,
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => h.emettre(...a),
  emettreDevisSigne: vi.fn(),
  transactionDevisSigne: vi.fn(),
  devisConcernesPourEmission: vi.fn(async () => []),
}));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/qualiopi/documents/signature/lien-precedent")
  >()),
  rendreLienPrecedent: async (url: string) => {
    const neuf = url.split("/").pop() as string;
    h.vivants.delete(neuf);
    for (const p of h.precedents.get(neuf) ?? []) h.vivants.add(p);
    return true;
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  TokenDocumentError: class extends Error {},
  creerTokenDocument: async (i: { borneMetier: Date }) => {
    h.bornes.push(i.borneMetier);
    h.nbJetons.v += 1;
    const token = `JETON-${h.nbJetons.v}`;
    h.precedents.set(token, [...h.vivants]);
    h.vivants.clear();
    h.vivants.add(token);
    return { token, tokenId: `id-${h.nbJetons.v}` };
  },
  revoquerJetonPrecis: async ({ tokenId }: { tokenId: string }) => {
    h.vivants.delete(`JETON-${tokenId.replace("id-", "")}`);
    return 1;
  },
  revoquerTokensDocument: async () => {
    h.vivants.clear();
    return 1;
  },
}));
vi.mock("@/server/queue/queues", () => ({
  sonderEnvoiOutboxAvecLien: async () => ({
    dejaFait: h.sonde.v === "deja_fait",
    urlEnFile: h.sonde.url,
  }),
  enqueueEmail: async (
    template: string,
    to: string,
    locale: string,
    payload: Record<string, unknown>,
    options: Record<string, unknown> = {},
  ) => {
    h.appelsEnqueue.push({ payload, options });
    if (options["bypassValidation"] === true) {
      // Laisse les approbations concurrentes se chevaucher pendant l'enfilage.
      await new Promise((r) => setTimeout(r, 5));
      if (h.echecEnfilage.v) throw new Error(`panne JETON-SECRET ${to} /portail/signer/x`);
    }
    if (h.verdictForce.v !== null) {
      // Le verdict imposé peut déposer la ligne que le vrai `enqueueEmail` aurait garée.
      const { ligne, ...verdict } = h.verdictForce.v as { ligne?: Record<string, unknown> };
      if (ligne) h.lignes.push(ligne);
      return verdict;
    }
    const gare =
      options["bypassValidation"] !== true &&
      (options["exigerValidation"] === true || h.mode.v === "validation");
    if (gare) {
      const id = `00000000-0000-4000-8000-00000000000${h.lignes.length + 1}`;
      h.lignes.push({
        id,
        template,
        recipient: to,
        locale,
        payload: JSON.parse(JSON.stringify(payload)),
        sujet: "s",
        statut: "a_valider",
        clientId: null,
        entityType: options["entityType"] ?? null,
        entityId: options["entityId"] ?? null,
        attachments: options["attachments"] ?? null,
      });
      return { enqueued: false, garePourValidation: true, outboxId: id };
    }
    h.partis.push({ payload, options });
    return { enqueued: true };
  },
}));

const matche = (l: Ligne, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([k, v]) => {
    const val = (l as unknown as Record<string, unknown>)[k];
    if (k === "OR") return (v as Record<string, unknown>[]).some((c) => matche(l, c));
    if (v !== null && typeof v === "object" && "gte" in (v as object)) {
      return val instanceof Date && val >= (v as { gte: Date }).gte;
    }
    if (v !== null && typeof v === "object" && "in" in (v as object)) {
      return ((v as { in: unknown[] }).in as unknown[]).includes(val);
    }
    return val === v;
  });

const modele = () => ({
  findUnique: async ({ where }: { where: { id: string } }) =>
    lignes().find((l) => l.id === where.id) ?? null,
  findFirst: async ({ where }: { where: Record<string, unknown> }) =>
    lignes().find((l) => matche(l, where)) ?? null,
  updateMany: async ({
    where,
    data,
  }: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => {
    const cible = lignes().filter((l) => matche(l, where));
    for (const l of cible) Object.assign(l, data);
    return { count: cible.length };
  },
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    Object.assign(lignes().find((l) => l.id === where.id) as Ligne, data);
    return {};
  },
});

const devisVivant = () => h.devis.v as Record<string, unknown>;
const ecritures = () => h.journalEcritures;

function tx(acquis: string[]) {
  return {
    // Verrou consultatif « xact » : pris une fois par clé, relâché à la fin de la transaction.
    $queryRaw: async (_s: unknown, cle: string) => {
      if (h.verrous.has(cle)) return [{ locked: false }];
      h.verrous.add(cle);
      acquis.push(cle);
      return [{ locked: true }];
    },
    activityLog: { findFirst: async () => null },
    emailOutbox: modele(),
    // OUT-1 : journal des envois (aucune ligne `pending` : l'envoi abandonné n'a rien laissé en vol).
    emailLog: { findFirst: async () => null },
    devis: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === ID ? { ...devisVivant(), replacesDevis: h.ancien.v } : null,
      findFirst: async () => null,
      count: async ({ where }: { where: Record<string, unknown> }) =>
        "replacesDevisId" in where ? h.suivante.v : h.signe.v ? 0 : 1,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; statut?: string; updatedAt?: Date };
        data: Record<string, unknown>;
      }) => {
        if (where.id === ID) {
          const d = devisVivant();
          if (d["statut"] !== where.statut) return { count: 0 };
          if (where.updatedAt && where.updatedAt.getTime() !== (d["updatedAt"] as Date).getTime()) {
            return { count: 0 };
          }
          Object.assign(d, data);
          ecritures().push(`devis:${String(data["statut"])}`);
          return { count: 1 };
        }
        if (where.id === ANCIEN && h.ancien.v["statut"] === "envoye") {
          h.ancien.v["statut"] = data["statut"];
          ecritures().push(`ancien:${String(data["statut"])}`);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    client: {
      updateMany: async () => {
        ecritures().push("client:devis_envoye");
        return { count: 1 };
      },
    },
    documentGenere: {
      findUnique: async () => ({
        id: "piece-1",
        clientId: "c1",
        type: "devis",
        numero: "AXI-DEV-2026-001",
      }),
    },
    documentSignatureToken: { updateMany: async () => ({ count: 0 }) },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    get emailOutbox() {
      return modele();
    },
    devis: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === ID ? devisVivant() : null,
      count: async ({ where }: { where: Record<string, unknown> }) =>
        "replacesDevisId" in where ? h.suivante.v : h.signe.v ? 0 : 1,
    },
    activityLog: { findFirst: async () => null },
    documentGenere: { findUnique: async () => ({ metadata: null }) },
    documentSignatureToken: {
      // R4 : lecture locale du lien de la tâche (échéance et usage compris).
      findUnique: async () =>
        h.sonde.vivant
          ? {
              documentGenereId: "piece-1",
              partie: "client",
              revokedAt: null,
              usedAt: null,
              expiresAt: new Date(Date.now() + 86_400_000),
            }
          : null,
    },
    $transaction: async (f: (t: unknown) => unknown) => {
      const acquis: string[] = [];
      try {
        return await f(tx(acquis));
      } finally {
        for (const c of acquis) h.verrous.delete(c);
      }
    },
  },
}));

import { approuverEmailAction } from "../email-outbox";

const ANCIEN_JETON = "ANCIEN-JETON";

const devisEnvoye = () => ({
  id: ID,
  numero: "AXI-DEV-2026-001",
  clientId: "c1",
  statut: "envoye",
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  offre: null,
  documentGenereId: "piece-1",
  documentGenere: { annuleeAt: null, signatures: [] },
  fichierPdfUrl: "documents/2026/devis/AXI-DEV-2026-001.pdf",
  montantTotalHtCents: 150000,
  dateValidite: new Date(Date.now() + 30 * 86_400_000),
  client: {
    raisonSociale: "Client SA",
    contactNom: "Camille",
    contactEmail: ADRESSE,
    contactFonction: null,
  },
});

const espions: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  h.sonde.v = "a_faire";
  h.sonde.url = null;
  h.sonde.vivant = true;
  vi.clearAllMocks();
  espions.push(
    ...(["log", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    ),
  );
  h.mode.v = "validation";
  h.lignes.length = 0;
  h.partis.length = 0;
  h.appelsEnqueue.length = 0;
  h.journalEcritures.length = 0;
  h.vivants.clear();
  h.vivants.add(ANCIEN_JETON);
  h.precedents.clear();
  h.verrous.clear();
  h.echecEnfilage.v = false;
  h.nbJetons.v = 0;
  h.bornes.length = 0;
  h.signe.v = false;
  h.suivante.v = 0;
  h.verdictForce.v = null;
  h.devis.v = devisEnvoye();
  h.ancien.v = {};
});
afterEach(() => {
  espions.length = 0;
});

const sortiesSensibles = () =>
  JSON.stringify([
    h.log.mock.calls,
    h.sentryExc.mock.calls,
    h.sentryMsg.mock.calls,
    espions.flatMap((e) => e.mock.calls),
  ]);

const PDF = [
  { filename: "AXI-DEV-2026-001.pdf", r2Key: "documents/2026/devis/AXI-DEV-2026-001.pdf" },
];

/** Une relance garée par la préparation : marqueur « devis-renvoi », PDF joint, aucun lien. */
function garerRelance(id = "00000000-0000-4000-8000-0000000000a1", marqueur = true) {
  h.lignes.push({
    id,
    template: "relance-devis-client",
    recipient: ADRESSE,
    locale: "fr",
    payload: {
      destinataireNom: "Camille",
      numero: "AXI-DEV-2026-001",
      pieceJointe: true,
      ...(marqueur
        ? {
            lienSignatureALEnvoi: {
              v: 1,
              nature: "devis-renvoi",
              documentGenereId: "piece-1",
              partie: "client",
              devisId: ID,
            },
          }
        : {}),
    },
    sujet: "Devis AXI-DEV-2026-001 : un point ?",
    statut: "a_valider",
    clientId: "c1",
    entityType: "Devis",
    entityId: ID,
    attachments: PDF,
  });
  return id;
}

describe("approbation d'une relance de devis (vrai module à l'envoi)", () => {
  it("le lien naît à l'approbation, l'ancien lien du premier e-mail est révoqué, le PDF part avec", async () => {
    const id = garerRelance();
    const r = await approuverEmailAction({ id });
    expect(r).toEqual({ data: { id, envoye: true } });
    expect(h.nbJetons.v).toBe(1);
    expect([...h.vivants]).toEqual(["JETON-1"]);
    expect(h.vivants.has(ANCIEN_JETON)).toBe(false);
    expect(h.partis).toHaveLength(1);
    const { payload, options } = h.partis[0]!;
    expect(payload["signatureUrl"]).toBe("https://exemple.test/fr/portail/signer/JETON-1");
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(options["attachments"]).toEqual(PDF);
    expect(options).toMatchObject({ bypassValidation: true, entityType: "Devis", entityId: ID });
    expect(lignes()[0]!.statut).toBe("envoye");
    expect(JSON.stringify(lignes()[0]!.payload)).not.toContain("/portail/signer/");
  });

  it("le lien est borné à la date de validité du devis", async () => {
    const id = garerRelance();
    await approuverEmailAction({ id });
    expect(h.bornes).toEqual([devisVivant()["dateValidite"]]);
  });

  it.each([
    ["signé par le client", () => (h.signe.v = true), /déjà signé/],
    ["refusé", () => (devisVivant()["statut"] = "refuse"), /refusé/],
    ["accepté", () => (devisVivant()["statut"] = "accepte"), /accepté/],
    [
      "périmé",
      () => (devisVivant()["dateValidite"] = new Date(Date.now() - 86_400_000)),
      /validité du devis est dépassée/,
    ],
    [
      "remplacé par une version plus récente",
      () => {
        devisVivant()["statut"] = "expire";
        h.suivante.v = 1;
      },
      /remplacé/,
    ],
  ])(
    "devis %s : aucun jeton, aucun e-mail, motif du module affiché, ligne refusée",
    async (_n, etat, motif) => {
      const id = garerRelance();
      etat();
      const r = await approuverEmailAction({ id });
      expect("error" in r && r.error).toMatch(motif);
      expect(h.nbJetons.v).toBe(0);
      expect(h.appelsEnqueue).toHaveLength(0);
      expect([...h.vivants]).toEqual([ANCIEN_JETON]);
      expect(lignes()[0]!.statut).toBe("refuse");
      expect(lignes()[0]!.refuseMotif).toMatch(motif);
    },
  );

  it("relance garée SANS marqueur (devis classique) sur un devis refusé : rien ne part non plus", async () => {
    const id = garerRelance(undefined, false);
    devisVivant()["statut"] = "refuse";
    const r = await approuverEmailAction({ id });
    expect("error" in r && r.error).toMatch(/refusé/);
    expect(h.appelsEnqueue).toHaveLength(0);
    expect(h.nbJetons.v).toBe(0);
  });

  it("relance garée SANS marqueur, devis vivant : part telle quelle (PDF, pas de lien)", async () => {
    const id = garerRelance(undefined, false);
    const r = await approuverEmailAction({ id });
    expect(r).toEqual({ data: { id, envoye: true } });
    expect(h.nbJetons.v).toBe(0);
    expect(h.partis[0]!.payload).not.toHaveProperty("signatureUrl");
    expect(h.partis[0]!.options["attachments"]).toEqual(PDF);
  });

  it("deux approbations simultanées de relances du même devis : un seul jeton actif, un seul e-mail", async () => {
    const a = garerRelance("00000000-0000-4000-8000-0000000000a1");
    const b = garerRelance("00000000-0000-4000-8000-0000000000a2");
    const res = await Promise.all([
      approuverEmailAction({ id: a }),
      approuverEmailAction({ id: b }),
    ]);
    expect(res.filter((r) => "data" in r)).toHaveLength(1);
    expect(h.nbJetons.v).toBe(1);
    expect(h.partis).toHaveLength(1);
    expect([...h.vivants]).toEqual(["JETON-1"]);
  });

  it("marqueur « premier envoi » sur une relance : refus, aucun jeton", async () => {
    const id = garerRelance();
    (lignes()[0]!.payload["lienSignatureALEnvoi"] as Record<string, unknown>)["nature"] =
      "devis-premier-envoi";
    const r = await approuverEmailAction({ id });
    expect("error" in r).toBe(true);
    expect(h.nbJetons.v).toBe(0);
    expect(h.appelsEnqueue).toHaveLength(0);
  });

  it("échec d'enfilage : l'ancien lien est rendu, ligne remise à valider, aucune fuite", async () => {
    const id = garerRelance();
    h.echecEnfilage.v = true;
    const r = await approuverEmailAction({ id });
    expect("error" in r).toBe(true);
    expect([...h.vivants]).toEqual([ANCIEN_JETON]);
    expect(lignes()[0]!.statut).toBe("a_valider");
    expect(JSON.stringify(r)).not.toMatch(/JETON|signer|exemple\.test/);
  });

  it("aucune fuite : ni URL, ni jeton, ni adresse dans journaux, Sentry et console (succès et refus)", async () => {
    await approuverEmailAction({ id: garerRelance() });
    const id2 = garerRelance("00000000-0000-4000-8000-0000000000a3");
    devisVivant()["statut"] = "refuse";
    await approuverEmailAction({ id: id2 });
    const s = sortiesSensibles();
    expect(s).not.toContain("JETON");
    expect(s).not.toContain("/portail/signer/");
    expect(s).not.toContain(ADRESSE);
  });
});

describe("renvoi (devis-envoi) : validité dépassée", () => {
  it("un renvoi approuvé après l'échéance ne crée aucun lien (plancher de 48 h évité)", async () => {
    const id = garerRelance();
    Object.assign(lignes()[0]!, { template: "devis-envoi" });
    devisVivant()["dateValidite"] = new Date(Date.now() - 3_600_000);
    const r = await approuverEmailAction({ id });
    expect("error" in r && r.error).toMatch(/validité du devis est dépassée/);
    expect(h.nbJetons.v).toBe(0);
    expect(h.appelsEnqueue).toHaveLength(0);
  });
});
