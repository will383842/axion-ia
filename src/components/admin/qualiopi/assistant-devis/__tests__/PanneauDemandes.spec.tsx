import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
const sources = vi.hoisted(() => vi.fn());
vi.mock("@/server/actions/qualiopi/devis-assistant-brouillon", () => ({
  creerBrouillonAssistantAction: vi.fn(),
  sauverBrouillonAssistantAction: vi.fn(),
  reprendreBrouillonAssistantAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-finaliser", () => ({
  numeroterDevisAssistantAction: vi.fn(),
  envoyerDepuisAssistantAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-apercu", () => ({
  apercuAssistantAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-apercu-email", () => ({
  apercuEmailDevisAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/devis-assistant-sources", () => ({
  listerSourcesPourQuiAction: sources,
}));

import { AssistantDevisBranche } from "../AssistantDevisBranche";
import { etatInitial } from "../etat";
import { etatVersPayload } from "../vers-payload";

function monter() {
  const etat = etatInitial({ validiteParDefaut: "2026-12-08", formulesActives: true });
  return render(
    <AssistantDevisBranche
      payloadInitial={etatVersPayload(etat, 1, { tvaStandardPct: 20, textes: [] })}
      brouillon={null}
      clients={[]}
      textesParDefaut={[]}
      tauxStandard={20}
      formulesActives
      validiteParDefaut="2026-12-08"
      versionCgv="v"
      urlAssistant="/x"
      rendreEtape={() => <p>corps</p>}
    />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("panneau « Demandes récentes »", () => {
  it("replié, titre avec compte, 10 lignes au plus, note de panne visible", async () => {
    sources.mockResolvedValue({
      data: Array.from({ length: 25 }, (_, i) => ({
        clientId: null,
        libelle: `Nom ${i}`,
        detail: "Audit IA",
        lien: `/d/${i}`,
      })),
      note: "Liste incomplète : appels réservés n'ont pas pu être lus.",
    });
    const { container } = monter();
    await waitFor(() => expect(screen.getByText("Demandes récentes (10)")).toBeTruthy());
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(within(details as HTMLElement).getAllByRole("listitem", { hidden: true })).toHaveLength(
      10,
    );
    expect(screen.getByRole("note", { hidden: true }).textContent).toContain("Liste incomplète");
  });
});
