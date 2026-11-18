/**
 * S14 — « Nouvelle vente » : interrupteur de l'assistant de devis.
 * Allumé, l'étape 3 ne crée ni n'envoie de devis : elle renvoie vers l'assistant.
 * Éteint, l'ancien parcours reste en place ; et un e-mail garé dans la corbeille
 * de validation ne passe plus le devis à « envoyé ».
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const pushMock = vi.fn();
const createBrouillonMock = vi.fn();
const updateMock = vi.fn();
const sendMock = vi.fn();
const toastMessage = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    message: (...a: unknown[]) => toastMessage(...a),
  },
}));
vi.mock("@/server/actions/qualiopi/vente-brouillon", () => ({
  createVenteBrouillonAction: (...a: unknown[]) => createBrouillonMock(...a),
  supprimerVenteBrouillonAction: vi.fn(),
  updateVenteBrouillonAction: (...a: unknown[]) => updateMock(...a),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({ createClientAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/formations", () => ({ duplicateFormationAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/sessions", () => ({ createSessionAction: vi.fn() }));
vi.mock("@/server/actions/qualiopi/devis", () => ({
  createDevisAction: vi.fn(),
  sendDevisAction: (...a: unknown[]) => sendMock(...a),
  lireBandeauAttributionAction: async () => null,
}));
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handlers: {} }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
}));

import { VenteWizard } from "@/components/admin/qualiopi/VenteWizard";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const DEVIS_ID = "22222222-2222-4222-8222-222222222222";

function monter(opts: { assistant?: boolean; devis?: boolean; projetId?: string }) {
  return render(
    <VenteWizard
      adminPrefix="adm"
      role="admin"
      clients={[{ id: CLIENT, numero: "AXI-CLI-001", raisonSociale: "Client" }]}
      offres={[]}
      formations={[]}
      {...(opts.assistant !== undefined ? { assistantDevisActif: opts.assistant } : {})}
      {...(opts.projetId !== undefined ? { projetId: opts.projetId, clientInitialId: CLIENT } : {})}
      brouillon={{
        id: "b-1",
        etape: 3,
        payload: {},
        clientId: CLIENT,
        devisId: opts.devis === true ? DEVIS_ID : null,
        sessionId: null,
      }}
      {...(opts.devis === true
        ? {
            devisInitial: {
              id: DEVIS_ID,
              numero: "AXI-DEV-001",
              statut: "brouillon" as const,
              sentAt: null,
              fichierPdfUrl: null,
              docusealSubmissionId: null,
              signatureMaison: false,
              montantTotalHtCents: 100000,
            },
          }
        : {})}
    />,
  );
}

describe("vente — l'étape devis passe par l'assistant quand il est allumé", () => {
  beforeEach(() => {
    pushMock.mockReset();
    sendMock.mockReset();
    toastMessage.mockReset();
    createBrouillonMock.mockReset();
    updateMock.mockReset();
    updateMock.mockResolvedValue({ data: { id: "b-1" } });
  });

  it("allumé, sans devis : ni « Créer le devis (brouillon) », ni « Envoyer le devis », ni montant", () => {
    monter({ assistant: true });
    expect(screen.queryByRole("button", { name: /Créer le devis/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Envoyer le devis/ })).toBeNull();
    expect(screen.queryByText(/Montant HT/)).toBeNull();
    expect(screen.getByText(/Stagiaires prévus/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Faire le devis dans l'assistant/ })).toBeTruthy();
  });

  it("le bouton enregistre la vente puis ouvre l'assistant avec clientId, venteBrouillonId et modele", async () => {
    monter({ assistant: true });
    fireEvent.click(screen.getByRole("button", { name: /Faire le devis dans l'assistant/ }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    const url = pushMock.mock.calls[0]?.[0] as string;
    expect(url.startsWith("/fr/adm/qualiopi/devis/new?")).toBe(true);
    const q = new URLSearchParams(url.split("?")[1]);
    expect(q.get("clientId")).toBe(CLIENT);
    expect(q.get("venteBrouillonId")).toBe("b-1");
    expect(q.get("modele")).toBe("formation");
    expect(q.get("projetId")).toBeNull();
  });

  it("vente ouverte depuis un projet : le lien porte projetId", async () => {
    monter({ assistant: true, projetId: "p-9" });
    fireEvent.click(screen.getByRole("button", { name: /Faire le devis dans l'assistant/ }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    const q = new URLSearchParams((pushMock.mock.calls[0]?.[0] as string).split("?")[1]);
    expect(q.get("projetId")).toBe("p-9");
  });

  it("allumé, devis lié en brouillon : « Ouvrir dans l'assistant » remplace « Envoyer le devis »", () => {
    monter({ assistant: true, devis: true });
    expect(screen.queryByRole("button", { name: /Envoyer le devis/ })).toBeNull();
    const lien = screen.getByRole("link", { name: /Ouvrir dans l'assistant/ });
    expect(lien.getAttribute("href")).toBe(`/fr/adm/qualiopi/devis/new?devis=${DEVIS_ID}`);
  });

  it("éteint : les anciens boutons sont présents, pas ceux de l'assistant", () => {
    monter({});
    expect(screen.getByRole("button", { name: /Créer le devis \(brouillon\)/ })).toBeTruthy();
    expect(screen.getByText(/Montant HT/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Faire le devis dans l'assistant/ })).toBeNull();
  });

  it("éteint, devis lié en brouillon : « Envoyer le devis » est présent", () => {
    monter({ assistant: false, devis: true });
    expect(screen.getByRole("button", { name: /Envoyer le devis/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Ouvrir dans l'assistant/ })).toBeNull();
  });

  it("e-mail garé dans la corbeille : le statut reste « Brouillon » et la note s'affiche", async () => {
    sendMock.mockResolvedValue({
      data: {
        id: DEVIS_ID,
        emailEnvoye: false,
        signatureCreee: false,
        garePourValidation: true,
        note: "En attente dans Emails → À valider",
      },
    });
    monter({ devis: true });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le devis/ }));
    await waitFor(() =>
      expect(toastMessage).toHaveBeenCalledWith("En attente dans Emails → À valider"),
    );
    expect(screen.getByText("Brouillon")).toBeTruthy();
    expect(screen.queryByText(/^Envoyé/)).toBeNull();
  });

  it("envoi réel : le statut passe à « Envoyé »", async () => {
    sendMock.mockResolvedValue({
      data: { id: DEVIS_ID, emailEnvoye: true, signatureCreee: true },
    });
    monter({ devis: true });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer le devis/ }));
    await waitFor(() => expect(screen.getByText(/^Envoyé/)).toBeTruthy());
  });
});
