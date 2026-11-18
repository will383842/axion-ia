/**
 * Lot B2, PR 3 — le PREMIER envoi d'un devis ne crée aucun lien de signature au clic quand
 * l'e-mail doit être validé : le jeton naît à l'approbation, et le devis ne passe « envoyé » qu'à
 * ce moment. Les vraies `sendDevisAction`, `approuverEmailAction`, `refuserEmailAction` et le vrai
 * module `lien-a-l-envoi` tournent ; la base, la file, le PDF et les jetons sont simulés dans un
 * « monde » en mémoire à état réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  mode: { v: "validation" as "validation" | "auto" },
  lignes: [] as Array<Record<string, unknown>>,
  devis: { v: {} as Record<string, unknown> },
  ancien: { v: {} as Record<string, unknown> },
  journalEcritures: [] as string[],
  nbJetons: { v: 0 },
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
    h.vivants.delete(url.split("/").pop() as string);
    return true;
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  TokenDocumentError: class extends Error {},
  creerTokenDocument: async () => {
    h.nbJetons.v += 1;
    const token = `JETON-${h.nbJetons.v}`;
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
  enqueueEmail: async (
    template: string,
    to: string,
    locale: string,
    payload: Record<string, unknown>,
    options: Record<string, unknown> = {},
  ) => {
    h.appelsEnqueue.push({ payload, options });
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

function tx() {
  return {
    $queryRaw: async () => [{ locked: true }],
    emailOutbox: modele(),
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
    devis: { findUnique: async () => null, count: async () => 1 },
    $transaction: async (f: (t: unknown) => unknown) => f(tx()),
  },
}));

import { sendDevisAction } from "../devis";
import { approuverEmailAction, refuserEmailAction } from "../email-outbox";

const devisBrouillon = () => ({
  id: ID,
  numero: "AXI-DEV-2026-001",
  clientId: "c1",
  statut: "brouillon",
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
  lignes: [],
  activite: null,
  refClient: null,
  replacesDevisId: null,
  offre: null,
  offreSha256: null,
  conditionsParticulieres: null,
  documentGenereId: null,
  fichierPdfUrl: null,
  financementSuggere: null,
  montantTotalHtCents: 150000,
  montantOpcoEstimeCents: null,
  resteAChargeCents: null,
  dateValidite: new Date("2026-12-31T00:00:00Z"),
  client: {
    type: "entreprise",
    raisonSociale: "Client SA",
    contactNom: "Camille",
    contactEmail: ADRESSE,
    contactFonction: null,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  h.mode.v = "validation";
  h.lignes.length = 0;
  h.partis.length = 0;
  h.appelsEnqueue.length = 0;
  h.journalEcritures.length = 0;
  h.vivants.clear();
  h.nbJetons.v = 0;
  h.verdictForce.v = null;
  h.devis.v = devisBrouillon();
  h.ancien.v = { statut: "envoye", documentGenereId: "piece-0" };
});

const sortiesSensibles = () =>
  JSON.stringify([h.log.mock.calls, h.sentryExc.mock.calls, h.sentryMsg.mock.calls]);

describe("clic « Envoyer au client » en mode validation", () => {
  it("aucun jeton, payload garé sans lien, marqueur posé, devis toujours brouillon", async () => {
    const r = await sendDevisAction(ID);
    expect(r).toMatchObject({
      data: { id: ID, emailEnvoye: false, signatureCreee: false, garePourValidation: true },
    });
    expect(h.nbJetons.v).toBe(0);
    expect(h.appelsEnqueue).toHaveLength(1);
    const { payload, options } = h.appelsEnqueue[0]!;
    expect(options).toMatchObject({ exigerValidation: true, entityType: "Devis", entityId: ID });
    expect(JSON.stringify(payload)).not.toContain("/portail/signer/");
    expect(payload).not.toHaveProperty("signatureUrl");
    expect(payload["lienSignatureALEnvoi"]).toEqual({
      v: 1,
      nature: "devis-premier-envoi",
      documentGenereId: "piece-1",
      partie: "client",
      devisId: ID,
      devisUpdatedAt: "2026-11-01T10:00:00.000Z",
      pdfCle: `documents/${new Date().getFullYear()}/devis/AXI-DEV-2026-001.pdf`,
    });
    // Aucune écriture sur le devis ni sur le client, aucun événement « devis émis ».
    expect(ecritures()).toEqual([]);
    expect(h.emettre).not.toHaveBeenCalled();
    expect(devisVivant()["statut"]).toBe("brouillon");
    expect(devisVivant()["documentGenereId"]).toBeNull();
    expect(devisVivant()["fichierPdfUrl"]).toBeNull();
    expect(lignes()).toHaveLength(1);
  });

  it("message rendu et journal « send_gare » sans adresse ni URL", async () => {
    const r = await sendDevisAction(ID);
    expect((r as { data: { note: string } }).data.note).toBe(
      "L'e-mail attend votre validation dans Emails, À valider. Le devis reste en brouillon et aucun lien de signature n'existe tant que l'e-mail n'est pas parti.",
    );
    const actions = h.log.mock.calls.map((c) => (c[0] as { action: string }).action);
    expect(actions).toContain("qualiopi.devis.send_gare");
    expect(actions).not.toContain("qualiopi.devis.send");
    const gare = h.log.mock.calls.find(
      (c) => (c[0] as { action: string }).action === "qualiopi.devis.send_gare",
    )![0] as { changes: Record<string, unknown> };
    expect(gare.changes["lienSignatureEmis"]).toBe(false);
    expect(sortiesSensibles()).not.toContain(ADRESSE);
    expect(sortiesSensibles()).not.toContain("/portail/signer/");
  });

  it("double clic : le second est refusé (ligne a_valider), aucune seconde ligne", async () => {
    await sendDevisAction(ID);
    const r2 = await sendDevisAction(ID);
    expect("error" in r2).toBe(true);
    expect(lignes()).toHaveLength(1);
    expect(h.appelsEnqueue).toHaveLength(1);
  });

  it("une ligne déjà APPROUVÉE (en cours d'envoi) bloque aussi un nouveau clic", async () => {
    await sendDevisAction(ID);
    lignes()[0]!.statut = "approuve";
    (lignes()[0] as unknown as Record<string, unknown>)["approuveAt"] = new Date();
    const r2 = await sendDevisAction(ID);
    expect("error" in r2).toBe(true);
    expect(lignes()).toHaveLength(1);
  });

  it("une ligne « approuvée » abandonnée (plus de 15 min) ne bloque plus le devis", async () => {
    await sendDevisAction(ID);
    lignes()[0]!.statut = "approuve";
    (lignes()[0] as unknown as Record<string, unknown>)["approuveAt"] = new Date(
      Date.now() - 16 * 60_000,
    );
    const r2 = await sendDevisAction(ID);
    expect("error" in r2).toBe(false);
    expect(lignes()).toHaveLength(2);
  });

  it("verdict autre que « garé » (corbeille indisponible) : refus, aucune écriture, aucun jeton", async () => {
    h.verdictForce.v = { enqueued: false, corbeilleIndisponible: true };
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(h.nbJetons.v).toBe(0);
    expect(ecritures()).toEqual([]);
  });
});

describe("refus de l'e-mail garé", () => {
  it("le devis reste brouillon, aucun jeton n'a jamais existé", async () => {
    await sendDevisAction(ID);
    const r = await refuserEmailAction({ id: lignes()[0]!.id, motif: "Pas maintenant" });
    expect("data" in r).toBe(true);
    expect(lignes()[0]!.statut).toBe("refuse");
    expect(devisVivant()["statut"]).toBe("brouillon");
    expect(h.nbJetons.v).toBe(0);
    expect(h.partis).toHaveLength(0);
    expect(ecritures()).toEqual([]);
  });
});

describe("approbation de l'e-mail garé (vrai module à l'envoi)", () => {
  it("jeton créé, e-mail parti avec le lien, devis envoyé, version remplacée expirée À CE MOMENT", async () => {
    h.devis.v = { ...devisBrouillon(), replacesDevisId: ANCIEN };
    await sendDevisAction(ID);
    // Avant l'approbation : l'ancienne version est intacte.
    expect(h.ancien.v["statut"]).toBe("envoye");
    expect(ecritures()).toEqual([]);

    const r = await approuverEmailAction({ id: lignes()[0]!.id });
    expect(r).toEqual({ data: { id: lignes()[0]!.id, envoye: true } });
    expect(h.nbJetons.v).toBe(1);
    expect(h.partis).toHaveLength(1);
    const { payload, options } = h.partis[0]!;
    expect(payload["signatureUrl"]).toBe("https://exemple.test/fr/portail/signer/JETON-1");
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(options).toMatchObject({ bypassValidation: true });
    expect(devisVivant()["statut"]).toBe("envoye");
    expect(devisVivant()["documentGenereId"]).toBe("piece-1");
    expect(h.ancien.v["statut"]).toBe("expire");
    expect(ecritures()).toEqual(["devis:envoye", "client:devis_envoye", "ancien:expire"]);
    expect(h.emettre).toHaveBeenCalledTimes(1);
    expect(lignes()[0]!.statut).toBe("envoye");
    // La ligne ne garde ni lien ni marqueur exploitable en clair.
    expect(JSON.stringify(lignes()[0]!.payload)).not.toContain("/portail/signer/");
  });
});

describe("mode auto : comportement inchangé", () => {
  it("jeton créé, e-mail enfilé avec le lien, devis envoyé (sans marqueur)", async () => {
    h.mode.v = "auto";
    const r = await sendDevisAction(ID);
    expect(r).toMatchObject({ data: { emailEnvoye: true, signatureCreee: true } });
    expect(h.nbJetons.v).toBe(1);
    const { payload, options } = h.partis[0]!;
    expect(payload["signatureUrl"]).toBe("https://exemple.test/fr/portail/signer/JETON-1");
    expect(payload).not.toHaveProperty("lienSignatureALEnvoi");
    expect(options).not.toHaveProperty("exigerValidation");
    expect(devisVivant()["statut"]).toBe("envoye");
    expect(h.emettre).toHaveBeenCalledTimes(1);
  });

  it("verdict « garé » malgré tout (règle changée) : traité comme non parti, ligne refusée, lien masqué, jeton révoqué", async () => {
    h.mode.v = "auto";
    h.verdictForce.v = {
      enqueued: false,
      garePourValidation: true,
      outboxId: "ob-force",
      ligne: {
        id: "ob-force",
        template: "devis-envoi",
        recipient: ADRESSE,
        locale: "fr",
        payload: { signatureUrl: "https://axion-ia.com/fr/portail/signer/JETON-SECRET-1234567890" },
        sujet: "s",
        statut: "a_valider",
        clientId: null,
        entityType: "Devis",
        entityId: ID,
        attachments: null,
      },
    };
    const r = await sendDevisAction(ID);
    expect("error" in r).toBe(true);
    expect(devisVivant()["statut"]).toBe("brouillon");
    expect(ecritures()).toEqual([]);
    expect(lignes().find((l) => l.id === "ob-force")!.statut).toBe("refuse");
    expect(JSON.stringify(lignes().find((l) => l.id === "ob-force")!.payload)).not.toContain(
      "JETON-SECRET",
    );
    expect(h.vivants.size).toBe(0);
  });
});
