// @vitest-environment node

/**
 * L12i — l'action « Présentation faite le … ».
 *
 *   · interrupteur absent : refus, RIEN n'est lu ni écrit (comportement d'avant L12i) ;
 *   · rôle non habilité à `remunerer_formateur` : refus, avant même l'interrupteur ;
 *   · sans `confirmer=oui` : un aperçu, aucune transaction ouverte ;
 *   · une violation de l'unicité (double clic) : « déjà payée », jamais une erreur brute.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  requireHabilitation: vi.fn(),
  interrupteurAllume: vi.fn(),
  lireContratCadreSigne: vi.fn(),
  lireVerdictPresentation: vi.fn(),
  ecrirePresentationMethode: vi.fn(),
  prealablesSchemaPresentation: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transaction } }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: m.requireHabilitation,
}));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: m.interrupteurAllume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur", () => ({
  lireContratCadreSigne: m.lireContratCadreSigne,
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/presentation-methode-base", () => ({
  lireVerdictPresentation: m.lireVerdictPresentation,
  ecrirePresentationMethode: m.ecrirePresentationMethode,
  prealablesSchemaPresentation: m.prealablesSchemaPresentation,
}));

import { enregistrerPresentationMethodeAction } from "../formateur-presentation-methode";

const T = "0b9f5a3c-2d1e-4f6a-8b7c-9d0e1f2a3b4c";

beforeEach(() => {
  vi.clearAllMocks();
  m.requireHabilitation.mockResolvedValue({ userId: "u", role: "super_admin" });
  m.interrupteurAllume.mockResolvedValue(true);
  m.prealablesSchemaPresentation.mockResolvedValue(null);
  m.lireContratCadreSigne.mockResolvedValue({ version: 3, signeLe: new Date("2026-11-02") });
});

describe("enregistrerPresentationMethodeAction", () => {
  it("interrupteur absent : refus, rien n'est lu ni écrit", async () => {
    m.interrupteurAllume.mockResolvedValue(false);
    const r = await enregistrerPresentationMethodeAction({
      trainerId: T,
      jour: "2026-11-20",
      confirmer: "oui",
    });
    expect("error" in r).toBe(true);
    expect(m.interrupteurAllume).toHaveBeenCalledWith("presentation_payee");
    expect(m.lireContratCadreSigne).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.ecrirePresentationMethode).not.toHaveBeenCalled();
  });

  it("rôle non habilité : refus avant tout", async () => {
    m.requireHabilitation.mockRejectedValue(new Error("forbidden: …"));
    const r = await enregistrerPresentationMethodeAction({ trainerId: T, jour: "2026-11-20" });
    expect("error" in r).toBe(true);
    expect(m.requireHabilitation).toHaveBeenCalledWith("remunerer_formateur");
    expect(m.interrupteurAllume).not.toHaveBeenCalled();
  });

  it("sans « confirmer=oui » : un aperçu, aucune transaction", async () => {
    m.lireVerdictPresentation.mockResolvedValue({
      ok: true,
      regimeTva: "assujetti_20",
      mois: { year: 2026, month: 11 },
      calcul: {
        lignes: [],
        totalHtCents: 17_500,
        tvaCents: 3_500,
        totalTtcCents: 21_000,
        mentionTva: "TVA 20 %",
        echeance: "2026-12-20",
        dateCible: "2026-12-18",
      },
    });
    const r = await enregistrerPresentationMethodeAction({ trainerId: T, jour: "2026-11-20" });
    expect(r).toEqual({
      data: {
        etape: "apercu",
        totalHtCents: 17_500,
        tvaCents: 3_500,
        totalTtcCents: 21_000,
        mentionTva: "TVA 20 %",
        echeance: "2026-12-20",
      },
    });
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("aperçu : un préalable de schéma manquant est dit avant toute confirmation", async () => {
    m.prealablesSchemaPresentation.mockResolvedValue("schema_hors_mission_absent");
    const r = await enregistrerPresentationMethodeAction({ trainerId: T, jour: "2026-11-20" });
    expect("error" in r && r.error).toMatch(/sans session/);
    expect(m.lireVerdictPresentation).not.toHaveBeenCalled();
  });

  it("un refus de la règle est rendu en clair", async () => {
    m.lireVerdictPresentation.mockResolvedValue({ ok: false, motif: "deja_payee" });
    const r = await enregistrerPresentationMethodeAction({ trainerId: T, jour: "2026-11-20" });
    expect(r).toEqual({
      error: "Une présentation de la méthode est déjà payée pour ce formateur.",
    });
  });

  it("double clic arrivé jusqu'à un index unique : refus en clair, jamais d'erreur brute", async () => {
    m.transaction.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await enregistrerPresentationMethodeAction({
      trainerId: T,
      jour: "2026-11-20",
      confirmer: "oui",
    });
    expect("error" in r && r.error).toMatch(/déjà enregistré/);
  });

  it("données invalides : refus", async () => {
    const r = await enregistrerPresentationMethodeAction({ trainerId: "x", jour: "2026-11-20" });
    expect(r).toEqual({ error: "Données invalides." });
  });
});
