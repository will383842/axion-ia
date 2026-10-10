/**
 * Lot S6a (f) — l'exemplaire de l'autorisation de captation est COMMANDÉ par
 * `signature.exemplaire_captation`, et le rattrapage ne reprend jamais
 * l'historique.
 *
 * Sur `main`, la remise d'un consentement s'arrêtait sur `type_non_rendu` :
 * aucun e-mail. Rendre le type sans interrupteur aurait fait partir, par le
 * rattrapage horaire, l'exemplaire de chaque consentement signé depuis le 01/09.
 *
 * La vraie chaîne est exercée : rattrapage → transmission → rendu de
 * l'exemplaire. Seuls Prisma, R2, le rendu PDF et la file d'e-mails sont simulés.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface PieceFausse {
  id: string;
  numero: string;
  type: string;
  signeAt: Date;
}

const h = vi.hoisted(() => ({
  pieces: [] as PieceFausse[],
  reglage: null as { value: unknown; updatedAt: Date } | null,
  enqueueEmail: vi.fn(),
}));

/** Évalue la seule clause du `where` qui distingue les cas : le `NOT` captation. */
function retenue(p: PieceFausse, where: Record<string, unknown>): boolean {
  const not = where["NOT"] as
    { type: string; signatures: { some: { signeAt: { lt: Date } } } } | undefined;
  if (not === undefined) return true;
  return !(p.type === not.type && p.signeAt < not.signatures.some.signeAt.lt);
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: {
      findUnique: vi.fn(async () => h.reglage),
    },
    documentGenere: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        h.pieces.filter((p) => retenue(p, where)).map((p) => ({ id: p.id, numero: p.numero })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const p = h.pieces.find((x) => x.id === where.id);
        if (p === undefined) return null;
        return {
          id: p.id,
          type: p.type,
          numero: p.numero,
          createdAt: new Date("2026-10-01T08:00:00Z"),
          statutSignature: "signee",
          annuleeAt: null,
          exemplaireSigneEnvoyeAt: null,
          clientId: null,
          hashSha256: "a".repeat(64),
          metadata: { renderData: { data: { numero: p.numero }, gabaritVersion: 1 } },
          client: null,
          session: { titreSession: "Formation d'essai" },
          signatures: [
            {
              partie: "beneficiaire",
              signataireEmail: "personne@exemple.test",
              signataireNom: "Personne Essai",
            },
          ],
        };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
    documentSignature: {
      findMany: vi.fn(async ({ where }: { where: { documentGenereId: string } }) => {
        const p = h.pieces.find((x) => x.id === where.documentGenereId);
        return p === undefined
          ? []
          : [
              {
                partie: "beneficiaire",
                signataireNom: "Personne Essai",
                signataireQualite: "Stagiaire",
                signeAt: p.signeAt,
                selfHash: "c".repeat(64),
                methode: "confirmation_accessible",
                signatureKey: null,
                imagePurgeeAt: null,
              },
            ];
      }),
    },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  documentPdfKey: (_t: string, n: string) => `documents/2026/autorisation_captation/${n}.pdf`,
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: vi.fn(async () => ({ buffer: Buffer.from("%PDF-essai") })),
  storeAndSignPdf: vi.fn(async () => ({ key: "k", url: "u" })),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));

import { rattraperExemplairesNonTransmis } from "./rattrapage-transmission";
import { transmettreExemplaireSigne } from "./transmission-exemplaire";

const ALLUMAGE = new Date("2026-10-10T12:00:00Z");
const MAINTENANT = new Date("2026-10-10T18:00:00Z");

const ANCIENNE: PieceFausse = {
  id: "5a6e0000-0000-4000-8000-000000000001",
  numero: "AXI-DOC-2026-901",
  type: "autorisation_captation",
  signeAt: new Date("2026-09-15T09:00:00Z"),
};
const RECENTE: PieceFausse = {
  id: "5a6e0000-0000-4000-8000-000000000002",
  numero: "AXI-DOC-2026-902",
  type: "autorisation_captation",
  signeAt: new Date("2026-10-10T14:00:00Z"),
};

function allume(): void {
  h.reglage = {
    value: { actif: true, allumeLe: ALLUMAGE.toISOString() },
    updatedAt: ALLUMAGE,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
  h.pieces = [ANCIENNE, RECENTE];
  h.reglage = null;
});

describe("clé absente — comportement de main : aucun envoi", () => {
  it("chemin normal : la remise s'arrête sur `type_non_rendu`", async () => {
    const r = await transmettreExemplaireSigne(RECENTE.id);
    expect(r).toMatchObject({ ok: false, motif: "rendu_impossible", detail: "type_non_rendu" });
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("rattrapage : rien ne part, ni l'ancienne ni la récente", async () => {
    const r = await rattraperExemplairesNonTransmis(MAINTENANT);
    expect(r.transmises).toBe(0);
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });

  it("clé illisible ou coupée : même chose", async () => {
    for (const value of [{ actif: "true" }, { actif: false, allumeLe: ALLUMAGE.toISOString() }]) {
      h.reglage = { value, updatedAt: ALLUMAGE };
      await rattraperExemplairesNonTransmis(MAINTENANT);
      await transmettreExemplaireSigne(RECENTE.id);
    }
    expect(h.enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("clé allumée — seul ce qui est signé APRÈS l'allumage est rattrapé", () => {
  it("chemin normal : la pièce signée après l'allumage est remise", async () => {
    allume();
    const r = await transmettreExemplaireSigne(RECENTE.id);
    expect(r.ok).toBe(true);
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("rattrapage : la récente part, l'ancienne jamais", async () => {
    allume();
    const r = await rattraperExemplairesNonTransmis(MAINTENANT);
    expect(r.numerosRemis).toEqual([RECENTE.numero]);
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    const [, , , , options] = h.enqueueEmail.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      unknown,
      { entityId: string },
    ];
    expect(options.entityId).toBe(RECENTE.id);
  });

  it("sans `allumeLe`, la date du réglage fait foi", async () => {
    h.reglage = { value: { actif: true }, updatedAt: ALLUMAGE };
    const r = await rattraperExemplairesNonTransmis(MAINTENANT);
    expect(r.numerosRemis).toEqual([RECENTE.numero]);
  });
});
