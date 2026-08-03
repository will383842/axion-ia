/**
 * CONTENT-GEN-UX 2026 — Tests CampaignWizardV2 (nouvelle structure 4 étapes).
 *
 * Le wizard est devenu le POINT D'ENTRÉE unique de génération (blueprint §4.c) :
 *   Étape 1 — Quoi générer ?            (cartes de types ; « Mix équilibré » par défaut)
 *   Étape 2 — Pour qui / où ?           (verticale + villes)
 *   Étape 3 — Combien / à quel rythme ? (nom + volume + estimation coût/durée en direct)
 *   Étape 4 — Vérifier & lancer         (récap + brouillon / lancer)
 *
 * Le payload de `createCampaignFromWizard` (serviceSector/name/action/mixMode) est
 * INCHANGÉ par rapport à l'ancienne structure — seule l'UX d'étapes a évolué.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

const createCampaignMock = vi.fn();
// Mock de la server action seule (elle chaîne next-auth → next/server, non
// importable en jsdom). Les constantes WIZARD_SECTIONS viennent de
// `campaign-wizard-constants` (module pur, pas besoin de mock).
vi.mock("@/server/actions/content-gen/campaign-wizard", () => ({
  createCampaignFromWizard: (input: unknown) => createCampaignMock(input),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (msg: string) => toastSuccessMock(msg),
    error: (msg: string) => toastErrorMock(msg),
  },
}));

const routerPushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

import { CampaignWizardV2 } from "@/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2";

beforeEach(() => {
  vi.clearAllMocks();
  createCampaignMock.mockResolvedValue({ campaignId: "camp_123", status: "draft" });
});

describe("CampaignWizardV2 — CONTENT-GEN-UX 2026 (4 étapes)", () => {
  it("1 — étape 1 « Quoi générer ? » : cartes de types + bouton Suivant", () => {
    render(<CampaignWizardV2 adminPrefix="admin" />);

    expect(screen.getByText("Étape 1 — Quoi générer ?")).toBeTruthy();
    // « Pages villes » renommé « Contenu local » (landing_ville CLI-only retiré du wizard).
    expect(screen.getByText("Contenu local")).toBeTruthy();
    expect(screen.getByText("Articles de blog")).toBeTruthy();
    expect(screen.getByText("Guides piliers")).toBeTruthy();
    expect(screen.getByText("Q-R / FAQ")).toBeTruthy();
    expect(screen.getByText("Mix équilibré")).toBeTruthy();
    expect(screen.getByText("Suivant →")).toBeTruthy();
  });

  it("2 — étape 1 → 2 (mix équilibré par défaut) affiche les verticales", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    // Aucun clic requis : « Mix équilibré » (somme = 100) est l'état par défaut.
    await user.click(screen.getByText("Suivant →"));

    expect(screen.getByText("Étape 2 — Pour qui / où ?")).toBeTruthy();
    expect(screen.getByText("Audits IA")).toBeTruthy();
    expect(screen.getByText("Interventions & Formations")).toBeTruthy();
  });

  it("3 — sélection verticale → étape 3 (nom + volume)", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Suivant →")); // 1 → 2
    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →")); // 2 → 3

    expect(screen.getByText("Étape 3 — Combien / à quel rythme ?")).toBeTruthy();
    expect(screen.getByLabelText("Nom de la campagne")).toBeTruthy();
    expect(screen.getByLabelText("Contenus par jour")).toBeTruthy();
  });

  it("4 — étape 3 affiche l'estimation coût/horizon en direct (M7)", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Suivant →"));
    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →"));

    expect(screen.getByText("Estimation en direct")).toBeTruthy();
    expect(screen.getByText("Coût estimé")).toBeTruthy();
    // 🔴 La tuile s'appelait « Durée estimée » et affichait une CONSTANTE :
    // le volume vaut « par jour × 30 », la durée le redivisait par « par jour »,
    // donc 30 quoi qu'on saisisse. Elle nomme désormais ce qu'elle est.
    expect(screen.getByText("Horizon")).toBeTruthy();
  });

  it("5 — étape 4 « Enregistrer en brouillon » → createCampaignFromWizard + redirection", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Suivant →")); // 1 → 2
    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →")); // 2 → 3
    await user.type(screen.getByLabelText("Nom de la campagne"), "Test campagne audits");
    await user.click(screen.getByText("Suivant →")); // 3 → 4

    expect(screen.getByText("Étape 4 — Vérifier & lancer")).toBeTruthy();

    await user.click(screen.getByText("Enregistrer en brouillon"));

    expect(createCampaignMock).toHaveBeenCalledOnce();
    const call = createCampaignMock.mock.calls[0]![0] as {
      serviceSector: string;
      name: string;
      action: string;
      mixMode: string;
    };
    expect(call.serviceSector).toBe("audits");
    expect(call.name).toBe("Test campagne audits");
    expect(call.action).toBe("draft");
    expect(call.mixMode).toBe("percentage");

    await vi.waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalled();
      expect(routerPushMock).toHaveBeenCalled();
    });
  });
});
