/**
 * Lot D2 (M10) — les deux issues d'un désaccord, côté console.
 * Habilitation « rémunérer », confirmation exigée, interrupteur sans date = refus ;
 * l'auteur est celui de la session ; le motif n'entre pas au journal.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const accepter = vi.fn();
const refuser = vi.fn();
const bascule = vi.fn();
const piece = vi.fn();
const log = vi.fn();
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: vi
    .fn()
    .mockResolvedValue({ userId: "44444444-4444-4444-8444-444444444444", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => log(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/desaccord-mission", () => ({
  accepterDesaccord: (...a: unknown[]) => accepter(...a),
  refuserDesaccord: (...a: unknown[]) => refuser(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/lecture-passage", () => ({
  lireDateBascule: (...a: unknown[]) => bascule(...a),
}));
vi.mock("@/server/qualiopi/remuneration/autofacture-emission", () => ({
  emettrePieceAvoirMission: (...a: unknown[]) => piece(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { accepterDesaccordFormAction, refuserDesaccordFormAction } from "./desaccord-mission";

const R = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const RETOUR = `/fr/adm/qualiopi/remuneration/${R}`;

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
async function url(p: Promise<unknown>): Promise<string> {
  await expect(p).rejects.toThrow(/NEXT_REDIRECT/);
  return decodeURIComponent(String(redirect.mock.calls.at(-1)![0]));
}

beforeEach(() => {
  vi.clearAllMocks();
  bascule.mockResolvedValue("2026-11-01");
  accepter.mockResolvedValue({ issue: "acceptee", avoirId: "b", nouveauId: "c" });
  refuser.mockResolvedValue({ issue: "non_retenu", envoi: "envoye" });
  piece.mockResolvedValue({ numero: "AXI-AUTOF-2026-0009", documentId: null });
});

describe("accepterDesaccordFormAction", () => {
  const ok = { retour: RETOUR, statementId: R, htVuCents: "130000", confirmer: "oui" };

  it("transmet le HT VU (jamais un montant saisi) et l'auteur de la session ; numérote l'avoir", async () => {
    const u = await url(accepterDesaccordFormAction(fd(ok)));
    expect(accepter.mock.calls[0]![0]).toMatchObject({
      statementId: R,
      htVuCents: 130_000,
      parId: ADMIN,
    });
    expect(piece).toHaveBeenCalledWith("b");
    expect(log.mock.calls[0]![0]).toMatchObject({ targetId: R });
    expect(u).toMatch(/ok=.*AXI-AUTOF-2026-0009/);
  });

  it("sans confirmation, sans aperçu, interrupteur sans date : rien n'est écrit", async () => {
    await url(accepterDesaccordFormAction(fd({ ...ok, confirmer: "" })));
    await url(accepterDesaccordFormAction(fd({ ...ok, htVuCents: "" })));
    bascule.mockResolvedValue(null);
    await url(accepterDesaccordFormAction(fd(ok)));
    expect(accepter).not.toHaveBeenCalled();
  });

  it("refus métier : message lisible, aucune pièce d'avoir", async () => {
    accepter.mockResolvedValue({ issue: "refusee", motif: "apercu_perime" });
    const u = await url(accepterDesaccordFormAction(fd(ok)));
    expect(u).toMatch(/erreur=.*aperçu/);
    expect(piece).not.toHaveBeenCalled();
  });

  it("retour forgé : racine, jamais ailleurs", async () => {
    const u = await url(accepterDesaccordFormAction(fd({ ...ok, retour: "//evil.tld" })));
    expect(u.startsWith("/?")).toBe(true);
  });
});

describe("refuserDesaccordFormAction", () => {
  const ok = {
    retour: RETOUR,
    statementId: R,
    motif: "La journée a été annulée.",
    confirmer: "oui",
  };

  it("motif transmis, auteur de la session ; le journal ne porte pas le motif", async () => {
    const u = await url(refuserDesaccordFormAction(fd(ok)));
    expect(refuser.mock.calls[0]![0]).toMatchObject({
      statementId: R,
      parId: ADMIN,
      motif: ok.motif,
    });
    expect(JSON.stringify(log.mock.calls[0]![0])).not.toContain("annulée");
    expect(u).toMatch(/ok=.*débloqué/);
  });

  it("sans confirmation : rien n'est écrit", async () => {
    await url(refuserDesaccordFormAction(fd({ ...ok, confirmer: "" })));
    expect(refuser).not.toHaveBeenCalled();
  });
});
