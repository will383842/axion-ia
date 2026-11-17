/**
 * Historique des réponses : pas de « Réessayer » sur un rebond, texte visible
 * d'emblée, en-tête De / Répondre à, HTML enregistré toujours masqué.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { submissionReply: { findMany: () => findMany() } } }));
vi.mock("../RetryFailedReplyButton", () => ({
  RetryFailedReplyButton: () => <button type="button">Réessayer l&apos;envoi</button>,
}));

import { ReplyHistory } from "../ReplyHistory";

const JETON = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";

function reponse(statut: string, extra: Record<string, unknown> = {}) {
  return {
    id: "r1",
    repliedAt: new Date("2026-11-17T10:00:00Z"),
    repliedByName: "Équipe",
    subject: "Votre demande",
    bodyHtml: "<p>Bonjour</p>",
    bodyText: "Bonjour, voici la réponse.",
    deliveryStatus: statut,
    providerMessageId: null,
    sentAt: null,
    failedAt: null,
    errorMsg: null,
    retryCount: 0,
    ...extra,
  };
}

async function rendre(): Promise<void> {
  render(await ReplyHistory({ submissionId: "s1" }));
}

afterEach(() => {
  cleanup();
  findMany.mockReset();
});

describe("ReplyHistory — rebond", () => {
  it("🔴 `bounced` : aucun bouton « Réessayer », la phrase est là", async () => {
    findMany.mockResolvedValue([reponse("bounced")]);
    await rendre();
    expect(screen.queryByRole("button", { name: /Réessayer/ })).toBeNull();
    expect(
      screen.getByText(/Adresse refusée par le serveur du destinataire : vérifier l'adresse/),
    ).toBeTruthy();
  });

  it("témoin : `failed` garde son bouton, sans la phrase de rebond", async () => {
    findMany.mockResolvedValue([reponse("failed")]);
    await rendre();
    expect(screen.getByRole("button", { name: /Réessayer l'envoi/ })).toBeTruthy();
    expect(screen.queryByText(/Adresse refusée/)).toBeNull();
  });

  it("le texte est visible sans clic (hors de tout <details>)", async () => {
    findMany.mockResolvedValue([reponse("sent")]);
    await rendre();
    const visibles = screen
      .getAllByText("Bonjour, voici la réponse.")
      .filter((el) => el.closest("details") === null);
    expect(visibles).toHaveLength(1);
    expect(screen.getByText("Voir la mise en forme envoyée")).toBeTruthy();
  });

  it("🔴 un lien d'opposition à jeton est affiché `[masqué]`, jamais en clair", async () => {
    const lien = `https://axion-ia.com/fr/opposition/${JETON}`;
    findMany.mockResolvedValue([
      reponse("sent", {
        bodyHtml: `<p>Bonjour</p><a href="${lien}">Se désinscrire</a>`,
        bodyText: `Bonjour\nSe désinscrire : ${lien}`,
      }),
    ]);
    const { container } = render(await ReplyHistory({ submissionId: "s1" }));
    expect(container.innerHTML).not.toContain(JETON);
    expect(container.innerHTML).toContain("[masqué]");
  });

  it("l'en-tête porte De et Répondre à", async () => {
    findMany.mockResolvedValue([reponse("sent")]);
    const { container } = render(await ReplyHistory({ submissionId: "s1" }));
    expect(container.textContent).toMatch(/De\s*:?/);
    expect(container.textContent).toMatch(/Répondre à/);
    expect(container.textContent).toMatch(/axion-ia\.com/);
  });
});
