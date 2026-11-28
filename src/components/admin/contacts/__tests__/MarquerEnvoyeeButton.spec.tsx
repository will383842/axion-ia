// U1 : « Marquer comme envoyée » n'apparaît dans l'historique que pour `failed` + issue inconnue.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { submissionReply: { findMany: () => findMany() } } }));
vi.mock("../RetryFailedReplyButton", () => ({
  RetryFailedReplyButton: () => <button type="button">Réessayer l&apos;envoi</button>,
}));
vi.mock("../MarquerEnvoyeeButton", () => ({
  MarquerEnvoyeeButton: () => <button type="button">Marquer comme envoyée</button>,
}));

import { ReplyHistory } from "../ReplyHistory";
import { MOTIF_ISSUE_INCONNUE } from "@/lib/email/reponse-manuelle-etat";

function reponse(statut: string, errorMsg: string | null) {
  return {
    id: "r1",
    repliedAt: new Date("2026-11-17T10:00:00Z"),
    repliedByName: "Équipe",
    subject: "Votre demande",
    bodyHtml: "<p>Bonjour</p>",
    bodyText: "Bonjour.",
    deliveryStatus: statut,
    providerMessageId: null,
    sentAt: null,
    failedAt: null,
    errorMsg,
    retryCount: 0,
  };
}
async function rendre(): Promise<void> {
  render(await ReplyHistory({ submissionId: "s1" }));
}
afterEach(() => {
  cleanup();
  findMany.mockReset();
});

describe("ReplyHistory — Marquer comme envoyée", () => {
  it("U1 : failed + issue inconnue → le bouton est là, « Réessayer » aussi", async () => {
    findMany.mockResolvedValue([reponse("failed", MOTIF_ISSUE_INCONNUE)]);
    await rendre();
    expect(screen.getByRole("button", { name: "Marquer comme envoyée" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Réessayer/ })).toBeTruthy();
  });

  it.each([
    ["failed", "Envoi non abouti après plusieurs essais"],
    ["failed", null],
    ["pending", MOTIF_ISSUE_INCONNUE],
    ["sent", MOTIF_ISSUE_INCONNUE],
    ["bounced", MOTIF_ISSUE_INCONNUE],
  ])("U1 : %s avec %s → pas de bouton", async (statut, msg) => {
    findMany.mockResolvedValue([reponse(statut, msg)]);
    await rendre();
    expect(screen.queryByRole("button", { name: "Marquer comme envoyée" })).toBeNull();
  });
});
