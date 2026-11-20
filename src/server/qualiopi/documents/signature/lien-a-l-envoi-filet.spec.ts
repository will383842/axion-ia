// @vitest-environment node
/**
 * OUT-1 — le filet de bout en bout, avec le VRAI `lien-precedent.ts` et une base de jetons simulée
 * en mémoire (les autres specs de l'enveloppe simulent `rendreLienPrecedent`).
 *
 * Scénario : la tâche en file porte le lien T1. L'envoi forge un jeton neuf T2 (qui révoque T1 sous
 * le motif « Remplacé par un nouveau lien »), puis le filet constate que la tâche existait déjà : il
 * défait T2 et doit rendre T1, seul lien que porte l'e-mail en file.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Jeton = {
  id: string;
  tokenHash: string;
  documentGenereId: string;
  partie: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  revokedMotif: string | null;
  revokedById: string | null;
};

const h = vi.hoisted(() => ({
  jetons: [] as Array<Record<string, unknown>>,
  marquer: vi.fn(),
  sentryMsg: vi.fn(),
  telegram: vi.fn(),
}));
const base = () => h.jetons as unknown as Jeton[];

vi.mock("@/lib/prisma", () => {
  const dt = {
    findUnique: async ({ where }: { where: { tokenHash: string } }) =>
      base().find((j) => j.tokenHash === where.tokenHash) ?? null,
    findFirst: async ({
      where,
    }: {
      where: {
        documentGenereId: string;
        partie: string;
        id: { not: string };
        revokedMotif: string;
        revokedAt: { lte: Date };
        expiresAt: { gt: Date };
      };
    }) => {
      const trouves = base()
        .filter(
          (j) =>
            j.documentGenereId === where.documentGenereId &&
            j.partie === where.partie &&
            j.id !== where.id.not &&
            j.revokedMotif === where.revokedMotif &&
            j.revokedById === null &&
            j.revokedAt !== null &&
            j.revokedAt <= where.revokedAt.lte &&
            j.expiresAt > where.expiresAt.gt,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return trouves[0] ?? null;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; revokedAt: null };
      data: Partial<Jeton>;
    }) => {
      const j = base().find((x) => x.id === where.id && x.revokedAt === null);
      if (!j) return { count: 0 };
      Object.assign(j, data);
      return { count: 1 };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Jeton> }) => {
      Object.assign(
        base().find((x) => x.id === where.id)!,
        data,
      );
      return {};
    },
  };
  const tx = {
    $queryRaw: async () => [{ locked: true }],
    devis: {
      findUnique: async () => devisRelu(),
      findFirst: async () => null,
      count: async () => 1,
    },
    documentGenere: {
      findUnique: async () => ({
        id: "piece-1",
        clientId: "c-1",
        type: "devis",
        numero: "AXI-DOC-001",
      }),
    },
    documentSignatureToken: dt,
  };
  return {
    prisma: {
      documentSignatureToken: dt,
      documentSignature: { count: async () => 0 },
      $transaction: async (f: (t: unknown) => unknown) => f(tx),
    },
  };
});
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => h.telegram(...a) }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(),
  revoquerJetonPrecis: vi.fn(),
  TokenDocumentError: class TokenDocumentError extends Error {},
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({
  marquerDevisEnvoye: (...a: unknown[]) => h.marquer(...a),
}));
vi.mock("@/server/qualiopi/devis/interrupteur-formules", () => ({
  formulesActives: async () => true,
}));
vi.mock("@/server/qualiopi/devis/version-remplacee", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/devis/version-remplacee")>()),
  versionRemplaceeBloqueEmission: async () => false,
}));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://exemple.test"),
}));

import { creerTokenDocument } from "./token-document";
import { envoyerAvecLienALEnvoi } from "./lien-a-l-envoi";
import { MiseEnFileIncertaine } from "@/server/email/outbox-en-cours";
import {
  empreinteJeton,
  ligneDuLien,
  MOTIF_RELANCE_NON_PARTIE,
  MOTIF_REMPLACE,
} from "./lien-precedent";

const UPDATED = new Date("2026-11-01T10:00:00.000Z");
let statutDevis = "brouillon";
function devisRelu() {
  return {
    id: "d-1",
    numero: "AXI-DEV-2026-001",
    clientId: "c-1",
    statut: statutDevis,
    documentGenereId: "piece-1",
    updatedAt: UPDATED,
    offre: null,
    replacesDevisId: null,
    replacesDevis: null,
    dateValidite: new Date("2026-12-15T00:00:00Z"),
    client: { raisonSociale: "ACME", contactNom: "C", contactFonction: null, type: "entreprise" },
  };
}

const url = (jeton: string) => `https://exemple.test/fr/portail/signer/${jeton}`;
let horloge = 0;
/** Émet un jeton : il révoque tout jeton vivant de la pièce (comme `creerTokenDocument`). */
function emettre(jeton: string): Jeton {
  const quand = new Date(Date.now() + 60_000 * ++horloge);
  for (const j of base()) {
    if (j.documentGenereId === "piece-1" && j.partie === "client" && j.revokedAt === null) {
      j.revokedAt = quand;
      j.revokedMotif = MOTIF_REMPLACE;
    }
  }
  const neuf: Jeton = {
    id: `id-${jeton}`,
    tokenHash: empreinteJeton(jeton),
    documentGenereId: "piece-1",
    partie: "client",
    createdAt: quand,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    usedAt: null,
    revokedAt: null,
    revokedMotif: null,
    revokedById: null,
  };
  base().push(neuf);
  return neuf;
}

const LIGNE = {
  id: "o-1",
  template: "devis-envoi",
  recipient: "dest@client.test",
  entityType: "Devis",
  entityId: "d-1",
};
const payload = {
  lienSignatureALEnvoi: {
    v: 1,
    nature: "devis-premier-envoi",
    documentGenereId: "piece-1",
    partie: "client",
    devisId: "d-1",
    devisUpdatedAt: UPDATED.toISOString(),
    pdfCle: "documents/2026/devis/AXI-DOC-001.pdf",
  },
};
const lancer = (enfiler: unknown) =>
  envoyerAvecLienALEnvoi({
    ligne: LIGNE,
    payload,
    acteur: { session: { userId: "a", role: "super_admin" } } as never,
    enfiler: enfiler as never,
  });
const tacheDejaLa = async () => ({ enqueued: true, dejaEnFile: true, urlEnFile: url("JETON-T1") });

beforeEach(() => {
  vi.clearAllMocks();
  h.jetons.length = 0;
  horloge = 0;
  statutDevis = "brouillon";
  vi.mocked(creerTokenDocument).mockImplementation(async () => {
    const t = emettre("JETON-T2");
    return { token: "JETON-T2", tokenId: t.id, expiresAt: t.expiresAt } as never;
  });
});

describe("OUT-1 — le filet, avec le vrai lien-precedent", () => {
  it("(a) T2 révoque T1, le filet défait T2 et rend T1 : lien de la tâche vivant, devis marqué", async () => {
    emettre("JETON-T1");
    const r = await lancer(tacheDejaLa);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true, dejaEnFile: true } });
    expect((await ligneDuLien(url("JETON-T1")))?.revokedAt).toBeNull();
    const t2 = base().find((j) => j.id === "id-JETON-T2");
    expect(t2?.revokedAt).not.toBeNull();
    expect(t2?.revokedMotif).toBe(MOTIF_RELANCE_NON_PARTIE);
    expect(h.marquer).toHaveBeenCalledTimes(1);
    expect(h.sentryMsg).not.toHaveBeenCalled();
  });

  it("(b) une relance de pièce intercalée : un AUTRE jeton est rendu à la place de T1 → devis non marqué, alerte au numéro", async () => {
    emettre("JETON-T1");
    emettre("JETON-T1B"); // relance de la pièce entre deux tentatives : T1 est révoqué
    const r = await lancer(tacheDejaLa);
    expect(r).toEqual({ type: "envoi", res: { enqueued: true, dejaEnFile: true } });
    expect((await ligneDuLien(url("JETON-T1")))?.revokedAt).not.toBeNull();
    expect((await ligneDuLien(url("JETON-T1B")))?.revokedAt).toBeNull();
    expect(h.marquer).not.toHaveBeenCalled();
    expect(JSON.stringify(h.sentryMsg.mock.calls)).toContain("AXI-DEV-2026-001");
    expect(JSON.stringify([h.sentryMsg.mock.calls, h.telegram.mock.calls])).not.toContain("JETON-");
  });

  it("(b renvoi) une relance de pièce intercalée : le lien de la tâche est mort → alerte au numéro, aucune écriture de devis", async () => {
    emettre("JETON-T1");
    emettre("JETON-T1B");
    statutDevis = "envoye";
    const r = await envoyerAvecLienALEnvoi({
      ligne: LIGNE,
      payload: {
        lienSignatureALEnvoi: {
          v: 1,
          nature: "devis-renvoi",
          documentGenereId: "piece-1",
          partie: "client",
          devisId: "d-1",
        },
      },
      acteur: { session: { userId: "a", role: "super_admin" } } as never,
      enfiler: tacheDejaLa as never,
    });
    expect(r).toEqual({ type: "envoi", res: { enqueued: true, dejaEnFile: true } });
    expect(h.marquer).not.toHaveBeenCalled();
    const alertes = JSON.stringify([h.sentryMsg.mock.calls, h.telegram.mock.calls]);
    expect(alertes).toContain("AXI-DEV-2026-001");
    expect(alertes).toContain("n'a pas pu être vérifié");
    expect(alertes).not.toContain("JETON-");
  });

  it("issue inconnue de l'ajout (MiseEnFileIncertaine) : remontée telle quelle, T2 n'est pas défait, rien n'est marqué", async () => {
    emettre("JETON-T1");
    const incertaine = new MiseEnFileIncertaine();
    await expect(
      lancer(async () => {
        throw incertaine;
      }),
    ).rejects.toBe(incertaine);
    expect((await ligneDuLien(url("JETON-T2")))?.revokedAt).toBeNull();
    expect(h.marquer).not.toHaveBeenCalled();
  });
});
