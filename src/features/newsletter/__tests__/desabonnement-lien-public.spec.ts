// @vitest-environment node
//
// Lien public de désabonnement (RFC 8058) — lot L3.
//
// Le lien et le bouton de la console passent par `desabonnerAbonne`, dont
// l'écriture est CONDITIONNELLE : si un autre geste a désabonné la personne
// entre la lecture et l'écriture (double clic, bouton de la console), la
// transition est perdue et rien n'est émis. La page doit alors dire « déjà
// désabonné », pas prétendre l'avoir fait.

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  findUnique: vi.fn(),
  desabonner: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { newsletterSubscriber: { findUnique: (...a: unknown[]) => d.findUnique(...a) } },
}));
vi.mock("@/server/newsletter/desabonner", () => ({
  desabonnerAbonne: (...a: unknown[]) => d.desabonner(...a),
}));

import { unsubscribeNewsletterAction } from "../actions";

const LIGNE = {
  id: "00000000-0000-4000-8000-0000000000c1",
  email: "lectrice@example.invalid",
  locale: "fr",
  status: "confirmed",
  consentFormRef: null,
  consentVersion: null,
};
const JETON = "j".repeat(64);

beforeEach(() => {
  d.findUnique.mockReset().mockResolvedValue(LIGNE);
  d.desabonner.mockReset();
});

describe("unsubscribeNewsletterAction", () => {
  it("transition faite par CE lien : « désabonnée », motif du lien", async () => {
    d.desabonner.mockResolvedValue(true);
    const r = await unsubscribeNewsletterAction(JETON);
    expect(r).toEqual({ ok: true, alreadyUnsubscribed: false, email: LIGNE.email });
    expect(d.desabonner).toHaveBeenCalledWith(
      expect.objectContaining({ id: LIGNE.id }),
      "unsubscribe-link",
    );
  });

  it("🔴 course perdue (un autre geste l'a fait entre-temps) : « déjà désabonnée »", async () => {
    d.desabonner.mockResolvedValue(false);
    const r = await unsubscribeNewsletterAction(JETON);
    expect(r).toEqual({ ok: true, alreadyUnsubscribed: true, email: LIGNE.email });
    // Discriminant positif : le chemin commun a bien été tenté.
    expect(d.desabonner).toHaveBeenCalledTimes(1);
  });
});
