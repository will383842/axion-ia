import { beforeEach, describe, expect, it, vi } from "vitest";

const lister = vi.fn(async (..._a: unknown[]): Promise<Array<{ id: string }>> => []);
vi.mock("@/lib/prisma", () => ({
  prisma: { jobApplication: { findMany: (...a: unknown[]) => lister(...a) } },
}));
let lien: string | null = "https://calendly.com/axion/echange-apporteur-affaires";
vi.mock("@/features/commercial-application/invitation-auto", () => ({
  lienReservationAuto: () => lien,
}));
const creer = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({
  ok: true,
  submissionId: "fiche-1",
}));
vi.mock("@/features/admin-job-applications/fiche-apporteur-depuis-candidature", () => ({
  creerFicheApporteurDepuisCandidature: (...a: unknown[]) => creer(...a),
}));
const envoyer = vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: true }));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  envoyerInvitationApporteur: (...a: unknown[]) => envoyer(...a),
}));
const journal = vi.fn();
vi.mock("@/features/admin-job-applications/journal", () => ({
  consignerEvenement: (...a: unknown[]) => journal(...a),
}));

import {
  DEBUT_PROPOSITION_RESEAU,
  envoyerProposition,
  preparerProposition,
  proposerAuxSpontaneesCommerciales,
} from "../proposer-reseau-auto";

beforeEach(() => {
  vi.clearAllMocks();
  lien = "https://calendly.com/axion/echange-apporteur-affaires";
});

describe("proposer le réseau d'apporteurs automatiquement", () => {
  it("prépare la fiche avec son origine dite telle quelle (personne n'a cliqué)", async () => {
    expect(await preparerProposition("app-1", "poste-pourvu")).toEqual({
      fiche: "creee",
      submissionId: "fiche-1",
    });
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        acteurId: null,
        proposition: "poste-pourvu",
      }),
    );
  });

  it("🔴 lien Calendly absent : rien n'est préparé, donc rien n'est promis", async () => {
    lien = null;
    expect(await preparerProposition("app-1", "poste-pourvu")).toEqual({
      fiche: "impossible",
      raison: "lien-calendly-absent",
    });
    expect(creer).not.toHaveBeenCalled();
  });

  it("déjà apporteur, ou déjà proposée : pas de seconde fiche", async () => {
    creer.mockResolvedValueOnce({ ok: false, erreur: "doublon" });
    expect((await preparerProposition("a", "poste-pourvu")).fiche).toBe("impossible");
    creer.mockResolvedValueOnce({ ok: true, deja: true, submissionId: "x" });
    expect(await preparerProposition("a", "poste-pourvu")).toEqual({
      fiche: "impossible",
      raison: "deja-proposee",
    });
  });

  it("l'invitation passe par la fonction du bouton de la console, et laisse une trace", async () => {
    expect(await envoyerProposition("app-1", "fiche-1")).toBe("envoyee");
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ submissionId: "fiche-1", adminId: null }),
    );
    expect(journal).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "app-1", type: "note" }),
    );
  });
});

describe("candidatures spontanées commerciales", () => {
  it("🔴 seulement les FUTURES (depuis le 29/09), vieilles de 15 minutes, à l'intitulé commercial", async () => {
    const maintenant = new Date("2026-10-02T10:00:00Z");
    await proposerAuxSpontaneesCommerciales(maintenant, ["deja-tunnel"]);
    const where = (lister.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where.offer).toBeNull();
    expect((where.submittedAt as { gte: Date }).gte).toEqual(DEBUT_PROPOSITION_RESEAU);
    expect((where.submittedAt as { lte: Date }).lte).toEqual(new Date("2026-10-02T09:45:00Z"));
    expect(where.id).toEqual({ notIn: ["deja-tunnel"] });
    expect(JSON.stringify(where.OR)).toContain("commercial");
  });

  it("invite chaque spontanée commerciale — jamais de « poste pourvu » ici", async () => {
    lister.mockResolvedValueOnce([{ id: "s-1" }]);
    const r = await proposerAuxSpontaneesCommerciales(new Date("2026-10-02T10:00:00Z"));
    expect(r).toEqual({ proposees: 1, ecartees: 0 });
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({ proposition: "spontanee-commerciale" }),
    );
    expect(envoyer).toHaveBeenCalledTimes(1);
  });
});
