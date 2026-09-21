/**
 * L'effacement RGPD depuis la console annule les envois programmés — AVANT
 * d'effacer (2026-09-19).
 *
 * Les relances J+2 / J+7 et le kit du dossier commencé sont des jobs retardés,
 * retrouvés par l'EMPREINTE de l'adresse ; l'invitation, elle, peut séjourner en
 * file de validation. Une fois la ligne
 * effacée, plus rien ne relie ces jobs à la personne : l'annulation doit donc
 * se faire avant, avec l'adresse DÉCHIFFRÉE (l'empreinte d'un texte chiffré à IV
 * aléatoire ne retrouve rien).
 *
 * Même raison pour la trace d'audit : l'empreinte doit porter sur l'adresse
 * claire, sinon elle ne permet jamais de prouver sur quoi l'effacement a porté.
 */

import { createHash } from "node:crypto";

import { describe, it, expect, vi, beforeEach } from "vitest";

const ordre: string[] = [];
const findUnique = vi.fn();
const del = vi.fn();
const logCreate = vi.fn();
const annuler = vi.fn();

vi.mock("@/lib/prisma", () => {
  const tx = {
    submission: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      delete: (...a: unknown[]) => {
        ordre.push("delete");
        return del(...a);
      },
    },
    activityLog: { create: (...a: unknown[]) => logCreate(...a) },
  };
  return {
    prisma: {
      ...tx,
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin-1", role: "super_admin" } }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: () => Promise.resolve("127.0.0.1") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => (v === null ? null : String(v).replace(/^chiffre\(|\)$/g, "")),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => {
    ordre.push("annuler");
    return annuler(...a);
  },
}));

import { eraseSubmissionAction } from "../actions";

const ID = "22222222-2222-4222-8222-222222222222";

function formulaire(): FormData {
  const f = new FormData();
  f.set("id", ID);
  f.set("reason", "Demande de la personne par e-mail");
  return f;
}

beforeEach(() => {
  ordre.length = 0;
  vi.clearAllMocks();
  findUnique.mockResolvedValue({
    id: ID,
    type: "contact",
    contactEmail: "chiffre(Nadia@Exemple.fr)",
  });
  del.mockResolvedValue({});
  logCreate.mockResolvedValue({});
  annuler.mockResolvedValue(2);
});

describe("eraseSubmissionAction", () => {
  it("🔴 annule les envois programmés avec l'adresse DÉCHIFFRÉE, AVANT l'effacement", async () => {
    const r = await eraseSubmissionAction({ ok: true }, formulaire());
    expect(r).toEqual({ ok: true });
    expect(annuler).toHaveBeenCalledWith("Nadia@Exemple.fr", "Envoi annulé : effacement RGPD.");
    expect(ordre).toEqual(["annuler", "delete"]);
  });

  it("🔴 l'empreinte d'audit porte sur l'adresse CLAIRE, pas sur le texte chiffré", async () => {
    await eraseSubmissionAction({ ok: true }, formulaire());
    const trace = logCreate.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } };
    const attendue = createHash("sha256").update("nadia@exemple.fr").digest("hex");
    expect(trace.data.changes["contactEmailHash"]).toBe(attendue);
  });

  it("une file indisponible n'empêche pas l'effacement", async () => {
    annuler.mockRejectedValue(new Error("redis mort"));
    const r = await eraseSubmissionAction({ ok: true }, formulaire());
    expect(r).toEqual({ ok: true });
    expect(del).toHaveBeenCalledTimes(1);
  });
});
