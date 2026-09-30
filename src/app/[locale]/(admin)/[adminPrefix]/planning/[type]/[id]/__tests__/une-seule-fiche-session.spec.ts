/**
 * 🔴 Lot L4 (2026-09-30) — « une seule porte » vers la fiche session.
 *
 * `/planning/formation/[id]` était une CINQUIÈME fiche pour une même session :
 * ses propres blocs, sans le verrou du dossier. Elle répond désormais 308 vers
 * `/qualiopi/sessions/[id]` — marque-pages et liens déjà envoyés restent bons.
 * Le coaching garde sa fiche 360° : il n'a pas de fiche session.
 *
 * On appelle le VRAI `permanentRedirect` de Next : c'est son `digest` qui porte
 * le code HTTP et la cible, c'est donc lui qu'il faut lire pour prouver 308.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { gardePage, getPlanningEventDetail } = vi.hoisted(() => ({
  gardePage: vi.fn(),
  getPlanningEventDetail: vi.fn(),
}));

vi.mock("@/server/auth/garde-page", () => ({ gardePage }));
vi.mock("@/features/admin-planning/detail", () => ({ getPlanningEventDetail }));
vi.mock("@/features/admin-planning/queries", () => ({
  getTrainerConflicts: vi.fn(async () => []),
}));

import PlanningDetailPage from "../page";

function digestDe(err: unknown): string {
  return String((err as { digest?: unknown } | null)?.digest ?? "");
}

describe("/planning/[type]/[id] — une seule fiche par session", () => {
  beforeEach(() => {
    gardePage.mockReset();
    gardePage.mockResolvedValue({ autorise: true });
    getPlanningEventDetail.mockReset();
  });

  it("une formation répond 308 vers la fiche session, sans lire la fiche 360°", async () => {
    let capture: unknown = null;
    try {
      await PlanningDetailPage({
        params: Promise.resolve({ adminPrefix: "adm", type: "formation", id: "sess-1" }),
      });
    } catch (err) {
      capture = err;
    }
    const digest = digestDe(capture);
    // Forme du digest Next : NEXT_REDIRECT;<type>;<url>;<statut>;
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain(";/fr/adm/qualiopi/sessions/sess-1;");
    expect(digest).toContain(";308;");
    expect(getPlanningEventDetail).not.toHaveBeenCalled();
  });

  it("la garde passe AVANT la redirection (aucune cible révélée sans session)", async () => {
    gardePage.mockRejectedValueOnce(new Error("NEXT_REDIRECT_LOGIN"));
    await expect(
      PlanningDetailPage({
        params: Promise.resolve({ adminPrefix: "adm", type: "formation", id: "sess-1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT_LOGIN");
  });

  it("un coaching garde sa fiche 360° : aucune redirection", async () => {
    getPlanningEventDetail.mockResolvedValue(null);
    let capture: unknown = null;
    try {
      await PlanningDetailPage({
        params: Promise.resolve({ adminPrefix: "adm", type: "coaching", id: "c-1" }),
      });
    } catch (err) {
      capture = err;
    }
    // `notFound()` (détail absent), jamais une redirection vers une session.
    expect(digestDe(capture)).not.toContain("NEXT_REDIRECT");
    expect(getPlanningEventDetail).toHaveBeenCalledWith("coaching", "c-1");
  });
});
