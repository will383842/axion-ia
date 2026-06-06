/**
 * Tests unitaires — estimateOpcoCoverage.
 *
 * Mocke getQualiopiConfig via vi.mock pour isoler la logique du plafonnement.
 * Plafonds de test : Atlas 40 €/h intra, 25 €/h inter présentiel, 15 €/h inter
 * distanciel, plafond annuel 8 000 €.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateOpcoCoverage } from "./devis";

// ─────────────────────────────────────────────────────────────────────────────
// Mock getQualiopiConfig
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(),
}));

import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

/** Plafonds de test alignés avec les défauts du registre. */
const DEFAULTS = {
  opco_atlas_intra_horaire: 40, // €/h/participant
  opco_atlas_inter_presentiel: 25, // €/h/participant
  opco_atlas_inter_distanciel: 15, // €/h/participant
  opco_atlas_plafond_annuel: 8000, // € HT
} as const;

beforeEach(() => {
  mockGetConfig.mockImplementation((key: string) => {
    const map: Record<string, number> = {
      opco_atlas_intra_horaire: DEFAULTS.opco_atlas_intra_horaire,
      opco_atlas_inter_presentiel: DEFAULTS.opco_atlas_inter_presentiel,
      opco_atlas_inter_distanciel: DEFAULTS.opco_atlas_inter_distanciel,
      opco_atlas_plafond_annuel: DEFAULTS.opco_atlas_plafond_annuel,
    };
    return Promise.resolve(map[key] ?? 0);
  });
});

describe("estimateOpcoCoverage", () => {
  // ── Cas intra ──────────────────────────────────────────────────────────────

  it("intra : couvre totalement si montant < théorique et < plafond annuel", async () => {
    // 1 participant × 7h × 40 €/h = 280 € → 28 000 ¢
    // montant = 200 € = 20 000 ¢ → tout couvert
    const result = await estimateOpcoCoverage({
      nbParticipants: 1,
      dureeHeures: 7,
      modalite: "intra",
      montantHtCents: 20_000,
    });
    expect(result.montantPriseEnChargeCents).toBe(20_000);
    expect(result.resteAChargeCents).toBe(0);
  });

  it("intra : reste à charge > 0 si montant dépasse enveloppe restante", async () => {
    // 5 participants × 14h × 40 €/h = 2 800 € = 280 000 ¢ (théorique)
    // enveloppe = 1 500 € = 150 000 ¢ → plafonnée par enveloppe
    // montant = 5 000 € = 500 000 ¢ → prise en charge = min(280_000, 150_000, 500_000) = 150_000
    // reste = 500_000 - 150_000 = 350_000
    const result = await estimateOpcoCoverage({
      nbParticipants: 5,
      dureeHeures: 14,
      modalite: "intra",
      montantHtCents: 500_000, // 5 000 €
      enveloppeRestanteCents: 150_000, // 1 500 €
    });
    expect(result.montantPriseEnChargeCents).toBe(150_000);
    expect(result.resteAChargeCents).toBe(350_000);
  });

  it("intra : plafonnement par plafond annuel (défaut 8 000 €) si montant > plafond", async () => {
    // 10 participants × 21h × 40 €/h = 8 400 € → dépasse plafond annuel 8 000 €
    // montantHt = 9 000 € → prise en charge = min(840_000, 800_000, 900_000) = 800_000
    const result = await estimateOpcoCoverage({
      nbParticipants: 10,
      dureeHeures: 21,
      modalite: "intra",
      montantHtCents: 900_000,
    });
    expect(result.montantPriseEnChargeCents).toBe(800_000);
    expect(result.resteAChargeCents).toBe(100_000);
  });

  // ── Cas inter_presentiel ───────────────────────────────────────────────────

  it("inter_presentiel : couvre totalement un petit montant", async () => {
    // 2 participants × 3h × 25 €/h = 150 € → 15 000 ¢
    // montant = 100 € = 10 000 ¢ → tout couvert
    const result = await estimateOpcoCoverage({
      nbParticipants: 2,
      dureeHeures: 3,
      modalite: "inter_presentiel",
      montantHtCents: 10_000,
    });
    expect(result.montantPriseEnChargeCents).toBe(10_000);
    expect(result.resteAChargeCents).toBe(0);
  });

  it("inter_presentiel : reste à charge si montant > théorique", async () => {
    // 1 participant × 4h × 25 €/h = 100 € → 10 000 ¢
    // montant = 200 € = 20 000 ¢ → prise en charge = 10 000 ¢
    const result = await estimateOpcoCoverage({
      nbParticipants: 1,
      dureeHeures: 4,
      modalite: "inter_presentiel",
      montantHtCents: 20_000,
    });
    expect(result.montantPriseEnChargeCents).toBe(10_000);
    expect(result.resteAChargeCents).toBe(10_000);
  });

  // ── Cas inter_distanciel ───────────────────────────────────────────────────

  it("inter_distanciel : applique le tarif horaire 15 €/h", async () => {
    // 3 participants × 8h × 15 €/h = 360 € → 36 000 ¢
    // montant = 400 € = 40 000 ¢ → prise en charge = 36 000 ¢
    const result = await estimateOpcoCoverage({
      nbParticipants: 3,
      dureeHeures: 8,
      modalite: "inter_distanciel",
      montantHtCents: 40_000,
    });
    expect(result.montantPriseEnChargeCents).toBe(36_000);
    expect(result.resteAChargeCents).toBe(4_000);
  });

  // ── Enveloppe restante nulle ───────────────────────────────────────────────

  it("reste à charge = montantHt si enveloppe restante = 0", async () => {
    const result = await estimateOpcoCoverage({
      nbParticipants: 5,
      dureeHeures: 7,
      modalite: "intra",
      montantHtCents: 100_000,
      enveloppeRestanteCents: 0,
    });
    expect(result.montantPriseEnChargeCents).toBe(0);
    expect(result.resteAChargeCents).toBe(100_000);
  });

  // ── Montant nul ───────────────────────────────────────────────────────────

  it("prise en charge = 0 si montantHtCents = 0", async () => {
    const result = await estimateOpcoCoverage({
      nbParticipants: 5,
      dureeHeures: 7,
      modalite: "intra",
      montantHtCents: 0,
    });
    expect(result.montantPriseEnChargeCents).toBe(0);
    expect(result.resteAChargeCents).toBe(0);
  });
});
