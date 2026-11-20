/**
 * Lot B2, PR 4 — le RENVOI d'un devis déjà « envoyé » ne crée aucun lien au clic quand l'e-mail
 * doit être validé : l'ANCIEN lien reste vivant jusqu'au départ réel ; à l'approbation le nouveau
 * naît et révoque l'ancien ; si l'enfilage échoue l'ancien est rendu. Les vraies
 * `envoyerDevisEmailAction`, `approuverEmailAction`, `refuserEmailAction` et le vrai module
 * `lien-a-l-envoi` tournent ; base, file et jetons sont simulés dans un « monde » en mémoire à
 * état réel, verrou consultatif compris.
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
  sonde: { v: "a_faire" as "a_faire" | "deja_fait" },
  mode: { v: "validation" as "validation" | "auto" },
  lignes: [] as Array<Record<string, unknown>>,
  devis: { v: {} as Record<string, unknown> },
  ancien: { v: {} as Record<string, unknown> },
  journalEcritures: [] as string[],
  nbJetons: { v: 0 },
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
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: vi.fn().mockResolvedValue(null),
  rendreLienPrecedent: async (url: string) => {
    const neuf = url.split("/").pop() as string;
    h.vivants.delete(neuf);
    for (const p of h.precedents.get(neuf) ?? []) h.vivants.add(p);
    return true;
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  TokenDocumentError: class extends Error {},
  creerTokenDocument: async () => {
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
  sonderEnvoiOutbox: async () => h.sonde.v,
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
    emailOutbox: modele(),
    // OUT-1 : journal des envois (aucune ligne `pending` : l'envoi abandonné n'a rien laissé en vol).
    emailLog: { findFirst: async () => null },
    devis: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === ID ? { ...devisVivant(), replacesDevis: h.ancien.v } : null,
      findFirst: async () => null,
      count: async () => 1,
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
      count: async () => 1,
    },
    documentGenere: { findUnique: async () => ({ metadata: null }) },
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

import { envoyerDevisEmailAction } from "../facturation-emails";
import { approuverEmailAction, refuserEmailAction } from "../email-outbox";

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
  dateValidite: new Date("2026-12-31T00:00:00Z"),
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
const MSG_ATTENTE = /attend déjà dans Emails/;

describe("renvoi en mode validation : le clic ne touche à aucun lien", () => {
  it("ligne garée avec marqueur, aucun jeton créé, l'ancien lien reste vivant, devis toujours envoyé", async () => {
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r && r.data.garePourValidation).toBe(true);
    expect(h.nbJetons.v).toBe(0);
    expect([...h.vivants]).toEqual([ANCIEN_JETON]);
    expect(lignes()).toHaveLength(1);
    expect(lignes()[0]!.statut).toBe("a_valider");
    expect(lignes()[0]!.payload["lienSignatureALEnvoi"]).toMatchObject({ nature: "devis-renvoi" });
    expect(JSON.stringify(lignes()[0]!.payload)).not.toContain("/portail/signer/");
    expect(devisVivant()["statut"]).toBe("envoye");
    expect(h.partis).toHaveLength(0);
  });

  it("refus de la ligne : l'ancien lien reste vivant, aucun jeton n'a existé", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    const r = await refuserEmailAction({ id: lignes()[0]!.id, motif: "Pas maintenant" });
    expect("data" in r).toBe(true);
    expect(lignes()[0]!.statut).toBe("refuse");
    expect([...h.vivants]).toEqual([ANCIEN_JETON]);
    expect(h.nbJetons.v).toBe(0);
    expect(h.partis).toHaveLength(0);
  });
});

describe("garde « déjà garé »", () => {
  it("une ligne à valider : le second renvoi est refusé, aucune seconde ligne", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("error" in r && r.error).toMatch(MSG_ATTENTE);
    expect(lignes()).toHaveLength(1);
  });

  it("OUT-1 : une ligne approuvée bloque aussi, quel que soit son âge", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    Object.assign(lignes()[0]!, { statut: "approuve", approuveAt: new Date() });
    expect("error" in (await envoyerDevisEmailAction({ devisId: ID }))).toBe(true);
    Object.assign(lignes()[0]!, { approuveAt: new Date(Date.now() - 20 * 60_000) });
    expect("error" in (await envoyerDevisEmailAction({ devisId: ID }))).toBe(true);
  });
});

describe("OUT-1 — renvoi : envoi déjà fait ou en file", () => {
  it("la sonde dit « déjà fait » : aucun jeton neuf, ancien lien intact, aucune écriture de devis, ligne « envoyé »", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    h.sonde.v = "deja_fait";
    const r = await approuverEmailAction({ id: lignes()[0]!.id });
    expect(r).toEqual({ data: { id: lignes()[0]!.id, envoye: true, dejaFait: true } });
    expect(h.nbJetons.v).toBe(0);
    expect(h.vivants.has(ANCIEN_JETON)).toBe(true);
    expect(h.partis).toHaveLength(0);
    expect(ecritures()).toEqual([]);
    expect(lignes()[0]!.statut).toBe("envoye");
  });
});

describe("approbation du renvoi (vrai module à l'envoi)", () => {
  it("le nouveau lien naît, l'ancien est révoqué, l'e-mail part avec le nouveau lien", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    const r = await approuverEmailAction({ id: lignes()[0]!.id });
    expect(r).toEqual({ data: { id: lignes()[0]!.id, envoye: true } });
    expect(h.nbJetons.v).toBe(1);
    expect([...h.vivants]).toEqual(["JETON-1"]);
    expect(h.vivants.has(ANCIEN_JETON)).toBe(false);
    expect(h.partis).toHaveLength(1);
    const { payload, options } = h.partis[0]!;
    expect(payload["signatureUrl"]).toBe("https://exemple.test/fr/portail/signer/JETON-1");
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(options).toMatchObject({ bypassValidation: true });
    expect(lignes()[0]!.statut).toBe("envoye");
    expect(JSON.stringify(lignes()[0]!.payload)).not.toContain("/portail/signer/");
    // Le devis n'est ni remarqué envoyé ni réécrit : il l'était déjà.
    expect(ecritures()).toEqual([]);
    expect(devisVivant()["statut"]).toBe("envoye");
  });

  it("échec d'enfilage : l'ancien lien est rendu vivant, le nouveau n'est pas vivant, ligne remise à valider", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    h.echecEnfilage.v = true;
    const r = await approuverEmailAction({ id: lignes()[0]!.id });
    expect("error" in r).toBe(true);
    expect([...h.vivants]).toEqual([ANCIEN_JETON]);
    expect(lignes()[0]!.statut).toBe("a_valider");
    expect(h.partis).toHaveLength(0);
    // Le message d'erreur ne porte ni jeton, ni URL, ni adresse.
    expect(JSON.stringify(r)).not.toMatch(/JETON|signer|exemple\.test/);
  });

  it("deux lignes de renvoi du MÊME devis approuvées ensemble : un seul nouveau jeton, un seul e-mail", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    // Seconde ligne, déposée directement (la garde l'interdit par l'action).
    h.lignes.push({
      ...JSON.parse(JSON.stringify(lignes()[0]!)),
      id: "00000000-0000-4000-8000-0000000000bb",
    });
    const [a, b] = await Promise.all([
      approuverEmailAction({ id: lignes()[0]!.id }),
      approuverEmailAction({ id: lignes()[1]!.id }),
    ]);
    expect([a, b].filter((r) => "data" in r)).toHaveLength(1);
    expect(h.nbJetons.v).toBe(1);
    expect(h.partis).toHaveLength(1);
    expect([...h.vivants]).toEqual(["JETON-1"]);
    const perdante = [a, b].find((r) => "error" in r) as { error: string };
    expect(perdante.error).toMatch(/déjà en cours d'envoi/);
    // La ligne perdante est remise à valider : rien n'est perdu.
    expect(lignes().filter((l) => l.statut === "a_valider")).toHaveLength(1);
  });

  it("devis devenu non « envoyé » avant l'approbation : ligne refusée, aucun jeton, ancien lien intact", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    devisVivant()["statut"] = "accepte";
    const r = await approuverEmailAction({ id: lignes()[0]!.id });
    expect("error" in r).toBe(true);
    expect(h.nbJetons.v).toBe(0);
    expect([...h.vivants]).toEqual([ANCIEN_JETON]);
    expect(lignes()[0]!.statut).toBe("refuse");
  });
});

describe("mode auto : comportement inchangé", () => {
  it("jeton créé à l'envoi (l'ancien révoqué), e-mail enfilé avec le lien, ni marqueur ni ligne garée", async () => {
    h.mode.v = "auto";
    const r = await envoyerDevisEmailAction({ devisId: ID });
    expect("data" in r && r.data.garePourValidation).toBe(false);
    expect(h.nbJetons.v).toBe(1);
    expect([...h.vivants]).toEqual(["JETON-1"]);
    expect(lignes()).toHaveLength(0);
    expect(h.partis).toHaveLength(1);
    expect(h.partis[0]!.payload["signatureUrl"]).toContain("/portail/signer/JETON-1");
    expect(h.partis[0]!.payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(h.partis[0]!.options).not.toHaveProperty("exigerValidation");
  });
});

describe("aucune fuite", () => {
  it("ni URL ni jeton dans les journaux, Sentry et la console, sur tout le parcours (échec compris)", async () => {
    await envoyerDevisEmailAction({ devisId: ID });
    h.echecEnfilage.v = true;
    await approuverEmailAction({ id: lignes()[0]!.id });
    h.echecEnfilage.v = false;
    await approuverEmailAction({ id: lignes()[0]!.id });
    const s = sortiesSensibles();
    expect(s).not.toContain("JETON");
    expect(s).not.toContain("/portail/signer/");
  });
});
