// Tests ReplyComposer — Sprint Notif Infra 2026-05-26 / fix P1-7 audit 2026-05-27.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const replyActionMock = vi.fn().mockResolvedValue({ ok: true, replyId: "ck123" });
const statusActionMock = vi
  .fn()
  .mockResolvedValue({ status: "sent", errorMsg: null, retryCount: 0 });
const retryActionMock = vi.fn().mockResolvedValue({ ok: true });
const apercuActionMock = vi.fn().mockResolvedValue({
  ok: true,
  apercu: { html: "<p>Bonjour <strong>gras</strong> et <em>italique</em></p>" },
});
vi.mock("@/features/admin-submissions/reply-actions", () => ({
  apercuReponseDemandeAction: (...args: unknown[]) => apercuActionMock(...args),
  replyToSubmissionAction: (...args: unknown[]) => replyActionMock(...args),
  getReplyDeliveryStatusAction: (...args: unknown[]) => statusActionMock(...args),
  retryFailedReplyAction: (...args: unknown[]) => retryActionMock(...args),
}));

// ReplyComposer utilise useRouter().refresh() — mock le router (pas de contexte
// App Router dans les tests unitaires).
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { ReplyComposer } from "../ReplyComposer";

describe("ReplyComposer", () => {
  const baseProps = {
    submissionId: "11111111-1111-1111-1111-111111111111",
    contactName: "Jean Dupont",
    contactEmail: "jean@example.com",
  };

  it("rend le bouton fermé par défaut", () => {
    render(<ReplyComposer {...baseProps} />);
    expect(screen.getByRole("button", { name: /Répondre/i })).toBeInTheDocument();
  });

  it("ouvre la modal au clic sur Répondre", () => {
    render(<ReplyComposer {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Répondre/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Jean Dupont/i)).toBeInTheDocument();
    expect(screen.getByText(/jean@example\.com/i)).toBeInTheDocument();
  });

  // I2-1 : le second moteur de mise en forme du navigateur est supprimé ; le gras et l'italique
  // se vérifient désormais dans l'aperçu EXACT rendu par le serveur (cadre isolé).
  it("affiche l'aperçu exact rendu par le serveur (gras, italique)", async () => {
    render(<ReplyComposer {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Répondre/i }));
    const bodyTextarea = document.getElementById("reply-body") as HTMLTextAreaElement;
    fireEvent.change(bodyTextarea, {
      target: { value: "Bonjour **gras** et *italique*" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu exact" }));
    const cadre = await screen.findByTitle("Aperçu exact de la réponse");
    const srcdoc = cadre.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("<strong>gras</strong>");
    expect(srcdoc).toContain("<em>italique</em>");
  });

  it("expose role=dialog + aria-modal + aria-labelledby", () => {
    render(<ReplyComposer {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Répondre/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "reply-composer-title");
  });

  it("ferme la modal au clic sur Annuler", () => {
    render(<ReplyComposer {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Répondre/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Annuler/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
