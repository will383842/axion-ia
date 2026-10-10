/**
 * L0b — une seule réponse « introuvable », de l'action jusqu'au service.
 *
 * ⚠️ Le service `signerDocument` n'est PAS simulé ici : seuls Prisma (une base
 * en mémoire), le stockage d'image, Sentry et l'authentification le sont. Un test
 * qui simulerait le service figerait la réponse que le test a écrite, pas celle
 * que le formateur reçoit.
 *
 * Pour un formateur, quatre refus doivent être INDISCERNABLES (même valeur, même
 * forme, même message), quelle que soit l'action appelée :
 *   - la pièce d'un autre formateur ;
 *   - un identifiant inconnu ;
 *   - une pièce d'un type que le formateur ne signe pas ;
 *   - une pièce sans session qui ne lui est pas rattachée.
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const SESSION_A = "a5a5a5a5-0000-4000-8000-00000000000a";
  const IDS = {
    lettreCadreA: "d1d1d1d1-0000-4000-8000-000000000001",
    contratA: "d2d2d2d2-0000-4000-8000-000000000002",
    releveA: "d3d3d3d3-0000-4000-8000-000000000003",
    factureA: "d4d4d4d4-0000-4000-8000-000000000004",
    sansAncre: "d5d5d5d5-0000-4000-8000-000000000005",
  };
  function piece(id: string, over: Record<string, unknown>) {
    return {
      id,
      numero: `AXI-${id.slice(0, 4)}`,
      hashSha256: "c".repeat(64),
      metadata: {},
      annuleeAt: null,
      signatures: [],
      sessionId: null,
      session: null,
      trainerId: null,
      ...over,
    };
  }
  const sessionA = {
    formateurPrincipalId: A,
    coFormateurs: [],
    sessionFormateurs: [{ trainerId: A, role: "principal" }],
  };
  const documents = new Map<string, Record<string, unknown>>([
    [IDS.lettreCadreA, piece(IDS.lettreCadreA, { type: "lettre_mission", trainerId: A })],
    [IDS.contratA, piece(IDS.contratA, { type: "contrat_travail", trainerId: A })],
    [
      IDS.releveA,
      piece(IDS.releveA, { type: "releve_connexion", sessionId: SESSION_A, session: sessionA }),
    ],
    // Porte l'ancre de A, mais le formateur n'a rien à y signer.
    [IDS.factureA, piece(IDS.factureA, { type: "facture", trainerId: A })],
    // Sans session ni ancre : n'appartient à personne.
    [IDS.sansAncre, piece(IDS.sansAncre, { type: "lettre_mission" })],
  ]);
  const sessions = new Map<string, Record<string, unknown>>([[SESSION_A, sessionA]]);
  const lire =
    (m: Map<string, Record<string, unknown>>) =>
    async ({ where }: { where: { id: string } }) =>
      m.get(where.id) ?? null;
  const signatures: Array<Record<string, unknown>> = [];
  const prisma: Record<string, unknown> = {
    documentGenere: { findUnique: lire(documents), update: async () => ({}) },
    trainingSession: { findUnique: lire(sessions) },
    trainer: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        nom: where.id === A ? "Alpha" : "Bravo",
        prenom: "Camille",
        email: null,
      }),
    },
    adminUser: { findUnique: async () => null },
    documentSignature: {
      findFirst: async () => null,
      findMany: async () => signatures.map((s) => ({ partie: s["partie"] })),
      count: async () => 0,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        signatures.push(data);
        return { id: data["id"], selfHash: data["selfHash"] };
      },
    },
    documentSignatureToken: { findUnique: async () => null },
  };
  prisma["$transaction"] = async (cb: (tx: unknown) => unknown) => cb(prisma);
  const courant = { trainerId: A };
  return { A, B, IDS, prisma, signatures, courant };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/formateur/guard", () => ({
  requireFormateurAction: vi.fn(async () => ({ trainerId: h.courant.trainerId })),
  getFormateurSession: vi.fn(async () => ({ trainerId: h.courant.trainerId })),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/emargement/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/emargement/storage")>()),
  storeSignatureImage: vi.fn(async () => ({
    key: "emargement/test.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 10,
  })),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { signerLettreMissionFormateurAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { signerContratTravailFormateurAction } from "@/server/actions/qualiopi/contrat-travail-signature";
import { signerReleveFormateurAction } from "@/server/actions/qualiopi/releve-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";
import { REFUS_PIECE_INTROUVABLE } from "@/server/qualiopi/documents/signature/refus-piece-introuvable";

const SIGNATURE = { methode: "confirmation_accessible" as const };
const lettre = (id: string) =>
  signerLettreMissionFormateurAction({ documentGenereId: id, ...SIGNATURE });
const contrat = (id: string) =>
  signerContratTravailFormateurAction({ documentGenereId: id, ...SIGNATURE });
const releve = (id: string) => signerReleveFormateurAction({ documentGenereId: id, ...SIGNATURE });
const service = (id: string, trainerId: string) =>
  signerDocument({
    documentGenereId: id,
    porteur: { type: "formateur_authentifie", trainerId, partie: "formateur" },
    methode: "confirmation_accessible",
    partiesRequises: ["formateur", "axionia"],
  });

/** La réponse attendue, écrite en dur : la constante ne s'approuve pas elle-même. */
const INTROUVABLE = { ok: false, raison: "piece_introuvable", message: "Pièce introuvable." };

beforeEach(() => {
  vi.clearAllMocks();
  h.signatures.length = 0;
  h.courant.trainerId = h.A;
});

describe("🔴 L0b — le formateur A signe sa lettre-cadre (vrai service)", () => {
  it("A signe SA lettre-cadre depuis son espace → ok", async () => {
    const res = await lettre(h.IDS.lettreCadreA);
    expect(res).toMatchObject({ ok: true, statutSignature: "partielle" });
    expect(h.signatures).toHaveLength(1);
    expect(h.signatures[0]).toMatchObject({
      documentGenereId: h.IDS.lettreCadreA,
      partie: "formateur",
    });
  });
});

describe("🔴 L0b — tout refus visible par un formateur est STRICTEMENT identique", () => {
  it("B : lettre-cadre de A, contrat de travail de A, UUID aléatoire → toStrictEqual", async () => {
    h.courant.trainerId = h.B;
    const lettreCadreDeA = await lettre(h.IDS.lettreCadreA);
    const contratDeA = await contrat(h.IDS.contratA);
    const uuidLettre = await lettre(randomUUID());
    const uuidContrat = await contrat(randomUUID());

    expect(lettreCadreDeA).toStrictEqual(uuidLettre);
    expect(contratDeA).toStrictEqual(uuidLettre);
    expect(uuidContrat).toStrictEqual(uuidLettre);
    expect(uuidLettre).toStrictEqual(INTROUVABLE);
    expect(REFUS_PIECE_INTROUVABLE).toStrictEqual(INTROUVABLE);
    // Aucune signature écrite sur un refus.
    expect(h.signatures).toHaveLength(0);
  });

  it("B : relevé d'une session de A et UUID aléatoire via signerReleveFormateurAction", async () => {
    h.courant.trainerId = h.B;
    expect(await releve(h.IDS.releveA)).toStrictEqual(INTROUVABLE);
    expect(await releve(randomUUID())).toStrictEqual(INTROUVABLE);
  });

  it("type que le formateur ne signe pas, même ancré sur lui → même réponse, dans les trois actions", async () => {
    // A est le titulaire de la facture et de la lettre-cadre : seul le TYPE refuse.
    expect(await lettre(h.IDS.factureA)).toStrictEqual(INTROUVABLE);
    expect(await contrat(h.IDS.factureA)).toStrictEqual(INTROUVABLE);
    expect(await releve(h.IDS.factureA)).toStrictEqual(INTROUVABLE);
    // Une pièce bien à lui, mais présentée à la mauvaise action.
    expect(await contrat(h.IDS.lettreCadreA)).toStrictEqual(INTROUVABLE);
    expect(await releve(h.IDS.contratA)).toStrictEqual(INTROUVABLE);
  });

  it("pièce sans session qui ne lui est pas rattachée → même réponse", async () => {
    expect(await lettre(h.IDS.sansAncre)).toStrictEqual(INTROUVABLE);
  });

  it("le SERVICE répond à l'identique : pièce d'un autre, inconnue, type non signé, sans ancre", async () => {
    const reponses = [
      await service(h.IDS.lettreCadreA, h.B),
      await service(h.IDS.contratA, h.B),
      await service(h.IDS.releveA, h.B),
      await service(randomUUID(), h.B),
      await service(h.IDS.factureA, h.A),
      await service(h.IDS.sansAncre, h.A),
    ];
    for (const r of reponses) expect(r).toStrictEqual(INTROUVABLE);
    expect(h.signatures).toHaveLength(0);
  });
});
