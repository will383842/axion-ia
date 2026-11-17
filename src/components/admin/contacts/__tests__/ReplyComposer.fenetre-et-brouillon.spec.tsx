/**
 * ReplyComposer — la fenêtre défile (« Envoyer » ne sort jamais de l'écran) et
 * un brouillon non vide n'est jamais perdu sans confirmation.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("@/features/admin-submissions/reply-actions", () => ({
  replyToSubmissionAction: vi.fn(),
  getReplyDeliveryStatusAction: vi.fn(),
  retryFailedReplyAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { ReplyComposer } from "../ReplyComposer";

const props = {
  submissionId: "11111111-1111-1111-1111-111111111111",
  contactName: "Jean Dupont",
  contactEmail: "jean@example.com",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function ouvrir(): void {
  render(<ReplyComposer {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
}

describe("ReplyComposer — fenêtre", () => {
  it("🔴 la fenêtre est bornée à la hauteur de l'écran et défile", () => {
    ouvrir();
    const panneau = screen.getByRole("dialog").firstElementChild as HTMLElement;
    expect(panneau.className).toMatch(/max-h-\[calc\(100dvh/);
    expect(panneau.className).toContain("overflow-y-auto");
  });

  it("🔴 le bouton « Envoyer » est dans un pied collant", () => {
    ouvrir();
    const pied = screen.getByRole("button", { name: "Envoyer" }).parentElement as HTMLElement;
    expect(pied.className).toContain("sticky");
    expect(pied.className).toContain("bottom-0");
  });
});

describe("ReplyComposer — brouillon", () => {
  it("🔴 demande confirmation avant de fermer un brouillon non vide, et garde la fenêtre si on refuse", () => {
    const confirmer = vi.spyOn(window, "confirm").mockReturnValue(false);
    ouvrir();
    fireEvent.change(document.getElementById("reply-body") as HTMLTextAreaElement, {
      target: { value: "Bonjour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(confirmer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("ferme quand on confirme", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    ouvrir();
    fireEvent.change(document.getElementById("reply-body") as HTMLTextAreaElement, {
      target: { value: "Bonjour" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ne demande rien quand le brouillon est vide", () => {
    const confirmer = vi.spyOn(window, "confirm");
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(confirmer).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ReplyComposer — la fermeture vide vraiment le brouillon", () => {
  const corps = () => document.getElementById("reply-body") as HTMLTextAreaElement;
  const note = () => document.getElementById("reply-note") as HTMLTextAreaElement;

  it("🔴 après une fermeture confirmée, le corps et la note interne sont vides à la réouverture", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    ouvrir();
    fireEvent.change(corps(), { target: { value: "Bonjour" } });
    fireEvent.change(note(), { target: { value: "À rappeler" } });
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
    expect(corps().value).toBe("");
    expect(note().value).toBe("");
  });

  it("🔴 un refus de la confirmation garde le brouillon", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    ouvrir();
    fireEvent.change(corps(), { target: { value: "Bonjour" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(corps().value).toBe("Bonjour");
  });
});
