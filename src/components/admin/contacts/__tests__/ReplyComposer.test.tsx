// Tests ReplyComposer — Sprint Notif Infra 2026-05-26 / fix P1-7 audit 2026-05-27.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const replyActionMock = vi.fn().mockResolvedValue({ ok: true, replyId: "ck123" });
const statusActionMock = vi
  .fn()
  .mockResolvedValue({ status: "sent", errorMsg: null, retryCount: 0 });
const retryActionMock = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/features/admin-submissions/reply-actions", () => ({
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

  it("affiche la preview markdown live (P1-3 audit)", () => {
    render(<ReplyComposer {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Répondre/i }));
    const bodyTextarea = document.getElementById("reply-body") as HTMLTextAreaElement;
    fireEvent.change(bodyTextarea, {
      target: { value: "Bonjour **gras** et *italique*" },
    });
    // Le rendu live doit afficher le bold + italic en strong/em.
    const preview = screen.getByLabelText("Aperçu du message");
    expect(preview).toBeInTheDocument();
    expect(preview.querySelector("strong")?.textContent).toBe("gras");
    expect(preview.querySelector("em")?.textContent).toBe("italique");
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
