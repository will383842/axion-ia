/**
 * Sprint v7 Phase 3 commit 1 — Tests CampaignWizardV2.
 *
 * 5 cases :
 *   1. Render step 1 — 5 verticales radio + bouton Suivant
 *   2. Navigation step 1 → 2 après sélection verticale
 *   3. Step 3 mode percentage somme initialisée = 100 (preset équilibré)
 *   4. Mode manual désactive contrainte 100%
 *   5. Step 4 submit "draft" appelle createCampaignFromWizard + router push
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

const createCampaignMock = vi.fn();
// Mock complet : hardcode WIZARD_CONTENT_TYPES pour éviter import chain
// next-auth → next/server qui plante en vitest jsdom.
vi.mock("@/server/actions/content-gen/campaign-wizard", () => ({
  WIZARD_CONTENT_TYPES: [
    "landing_ville",
    "blog_article",
    "blog_from_rss",
    "blog_from_keywords",
    "blog_from_title",
    "comparison",
    "guide_pilier",
    "qa_derived",
    "faq_standalone",
  ] as const,
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

describe("CampaignWizardV2 — Sprint v7 Phase 3 commit 1", () => {
  it("1 — render step 1 : 5 verticales radio + bouton Suivant", () => {
    render(<CampaignWizardV2 adminPrefix="admin" />);

    expect(screen.getByText("Étape 1 — Choisir une verticale Axion-IA")).toBeTruthy();
    expect(screen.getByText("Interventions & Formations")).toBeTruthy();
    expect(screen.getByText("Audits IA")).toBeTruthy();
    expect(screen.getByText("Implémentations IA")).toBeTruthy();
    expect(screen.getByText("1-to-1 Coaching")).toBeTruthy();
    expect(screen.getByText("Sites web augmentés IA")).toBeTruthy();
    expect(screen.getByText("Suivant →")).toBeTruthy();
  });

  it("2 — sélection verticale + Suivant → step 2 visible", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →"));

    expect(screen.getByText("Étape 2 — Nom, volume, scope villes, période")).toBeTruthy();
    expect(screen.getByLabelText("Nom de la campagne")).toBeTruthy();
    expect(screen.getByLabelText("Articles par jour")).toBeTruthy();
  });

  it("3 — step 3 affiche somme initiale = 100 (preset équilibré)", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →"));
    await user.type(screen.getByLabelText("Nom de la campagne"), "Test campagne");
    await user.click(screen.getByText("Suivant →"));

    // Sprint v7 Phase 8 commit 3/4 — wizard étendu 9 → 21 sliders en 6 sections.
    expect(screen.getByText("Étape 3 — Mix types contenu (21 sliders · 6 sections)")).toBeTruthy();
    expect(screen.getByText(/Somme :/)).toBeTruthy();
  });

  it("4 — Mode manual masque le badge 'Somme doit = 100'", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →"));
    await user.type(screen.getByLabelText("Nom de la campagne"), "Test");
    await user.click(screen.getByText("Suivant →"));

    await user.click(screen.getByLabelText("Quotas manuels"));
    expect(screen.queryByText("Somme doit = 100")).toBeNull();
  });

  it("5 — Step 4 submit draft → createCampaignFromWizard appelé + router push", async () => {
    const user = userEvent.setup();
    render(<CampaignWizardV2 adminPrefix="admin" />);

    await user.click(screen.getByText("Audits IA"));
    await user.click(screen.getByText("Suivant →"));
    await user.type(screen.getByLabelText("Nom de la campagne"), "Test campagne audits");
    await user.click(screen.getByText("Suivant →"));
    await user.click(screen.getByText("Suivant →"));
    expect(screen.getByText("Étape 4 — Récapitulatif")).toBeTruthy();

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
