/**
 * Lot S4 — l'espace formateur n'a qu'une réponse « introuvable ».
 *
 * Pour chaque action, deux appels avec la session du formateur A :
 *   1. un identifiant qui EXISTE mais appartient au formateur B ;
 *   2. un UUID aléatoire, qui n'existe pas.
 * Les deux résultats doivent être STRICTEMENT égaux (même forme, même corps).
 */

import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const SESSION_A = "a5a5a5a5-0000-4000-8000-00000000000a";
  const SESSION_B = "b5b5b5b5-0000-4000-8000-00000000000b";
  const CRENEAU_B = "c0c0c0c0-0000-4000-8000-00000000000b";
  /** La « base » : uniquement des objets appartenant à B (ou à sa session). */
  const documents = new Map<string, Record<string, unknown>>([
    [
      "d1d1d1d1-0000-4000-8000-000000000001",
      { id: "d1", type: "lettre_mission", trainerId: B, sessionId: SESSION_B, numero: "LM-1" },
    ],
    [
      "d2d2d2d2-0000-4000-8000-000000000002",
      { id: "d2", type: "releve_connexion", trainerId: null, sessionId: SESSION_B, numero: "RC-1" },
    ],
    [
      "d3d3d3d3-0000-4000-8000-000000000003",
      { id: "d3", type: "contrat_travail", trainerId: B, sessionId: null, numero: "CT-1" },
    ],
  ]);
  const sessions = new Map<string, Record<string, unknown>>([
    [SESSION_A, { formateurPrincipalId: A, sessionFormateurs: [] }],
    [SESSION_B, { formateurPrincipalId: B, sessionFormateurs: [] }],
  ]);
  const missions = new Map<string, Record<string, unknown>>([
    [
      "e1e1e1e1-0000-4000-8000-000000000001",
      {
        id: "e1e1e1e1-0000-4000-8000-000000000001",
        trainerId: B,
        sessionId: SESSION_B,
        statut: "en_attente",
        echeanceReponseAt: null,
        session: {
          dateDebut: new Date("2099-01-01T08:00:00Z"),
          statut: "planifiee",
          formateurPrincipalId: B,
        },
      },
    ],
  ]);
  const lire =
    (m: Map<string, Record<string, unknown>>) =>
    async ({ where }: { where: { id: string } }) =>
      m.get(where.id) ?? null;
  const prisma = {
    documentGenere: { findUnique: lire(documents) },
    trainingSession: { findUnique: lire(sessions) },
    missionFormateur: { findUnique: lire(missions), update: async () => ({}) },
    sessionFormateur: { findFirst: async () => null, findUnique: async () => null },
  };
  return { A, B, SESSION_A, SESSION_B, CRENEAU_B, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/formateur/guard", () => ({
  requireFormateurAction: vi.fn(async () => ({ trainerId: h.A })),
  getFormateurSession: vi.fn(async () => ({ trainerId: h.A })),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(async () => ({ ok: true, signatureId: "s", statutSignature: "partielle" })),
}));
vi.mock("@/server/qualiopi/emargement/signature-service", () => ({
  // Fidèle au service : un créneau d'une autre session refuse le porteur, un
  // créneau inconnu est introuvable.
  signerCreneau: vi.fn(async ({ creneauId }: { creneauId: string }) =>
    creneauId === h.CRENEAU_B
      ? {
          ok: false,
          raison: "porteur_non_autorise",
          message: "Ce lien ne permet pas de signer cette feuille.",
        }
      : { ok: false, raison: "creneau_introuvable", message: "Créneau introuvable." },
  ),
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  // Le dossier de B est CLOS : il ne doit pas se lire depuis la session de A.
  assertDossierOuvert: vi.fn(async (id: string) =>
    id === h.SESSION_B
      ? { ok: false, code: "DOSSIER_CLOS", message: "Dossier clos.", error: "Dossier clos." }
      : { ok: true, sessionId: id },
  ),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { signerLettreMissionFormateurAction } from "@/server/actions/qualiopi/lettre-mission-signature";
import { signerReleveFormateurAction } from "@/server/actions/qualiopi/releve-signature";
import { signerContratTravailFormateurAction } from "@/server/actions/qualiopi/contrat-travail-signature";
import { repondreMissionFormateurAction } from "@/server/actions/qualiopi/mission-formateur";
import {
  signerPourStagiaireAction,
  contresignerDemiJourneeAction,
} from "@/server/actions/qualiopi/emargement-formateur";

const SIGNATURE = { methode: "confirmation_accessible" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

async function deuxReponses<T>(appel: (id: string) => Promise<T>, idDeB: string): Promise<[T, T]> {
  return [await appel(idDeB), await appel(randomUUID())];
}

describe("🔴 identifiant d'un autre formateur ≡ identifiant inconnu", () => {
  it("signerLettreMissionFormateurAction", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) => signerLettreMissionFormateurAction({ documentGenereId: id, ...SIGNATURE }),
      "d1d1d1d1-0000-4000-8000-000000000001",
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toMatchObject({ ok: false, raison: "piece_introuvable" });
  });

  it("signerReleveFormateurAction", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) => signerReleveFormateurAction({ documentGenereId: id, ...SIGNATURE }),
      "d2d2d2d2-0000-4000-8000-000000000002",
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toMatchObject({ ok: false, raison: "piece_introuvable" });
  });

  it("signerContratTravailFormateurAction", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) => signerContratTravailFormateurAction({ documentGenereId: id, ...SIGNATURE }),
      "d3d3d3d3-0000-4000-8000-000000000003",
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toMatchObject({ ok: false, raison: "piece_introuvable" });
  });

  it("repondreMissionFormateurAction", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) => repondreMissionFormateurAction({ missionId: id, reponse: "acceptee" }),
      "e1e1e1e1-0000-4000-8000-000000000001",
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toEqual({ error: "Cette proposition n'existe pas." });
  });

  it("signerPourStagiaireAction — session de B (dossier clos compris)", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) =>
        signerPourStagiaireAction({
          sessionId: id,
          creneauId: randomUUID(),
          methode: "confirmation_accessible",
          nomConfirme: "X",
        }),
      h.SESSION_B,
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toMatchObject({ ok: false, raison: "creneau_introuvable" });
  });

  it("signerPourStagiaireAction — créneau de B depuis la session de A", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) =>
        signerPourStagiaireAction({
          sessionId: h.SESSION_A,
          creneauId: id,
          methode: "confirmation_accessible",
          nomConfirme: "X",
        }),
      h.CRENEAU_B,
    );
    expect(deB).toStrictEqual(inconnu);
  });

  it("contresignerDemiJourneeAction — session de B", async () => {
    const [deB, inconnu] = await deuxReponses(
      (id) =>
        contresignerDemiJourneeAction({
          sessionId: id,
          date: "2026-10-10",
          demiJournee: "matin",
          methode: "confirmation_accessible",
          nomConfirme: "X",
        }),
      h.SESSION_B,
    );
    expect(deB).toStrictEqual(inconnu);
    expect(inconnu).toMatchObject({ ok: false, raison: "session_introuvable" });
  });
});

describe("🔴 GET /api/formateur/lettre-mission/[id] — 404 not_found pour la lettre d'un autre", () => {
  async function appeler(id: string): Promise<{ status: number; corps: unknown }> {
    const { GET } = await import("@/app/api/formateur/lettre-mission/[id]/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(
      new NextRequest(`https://axion-ia.test/api/formateur/lettre-mission/${id}`),
      {
        params: Promise.resolve({ id }),
      },
    );
    return { status: res.status, corps: await res.json() };
  }

  it("lettre de B et UUID aléatoire : même statut, même corps", async () => {
    const deB = await appeler("d1d1d1d1-0000-4000-8000-000000000001");
    const inconnu = await appeler(randomUUID());
    expect(deB).toStrictEqual(inconnu);
    expect(deB).toEqual({ status: 404, corps: { error: "not_found" } });
  });
});
