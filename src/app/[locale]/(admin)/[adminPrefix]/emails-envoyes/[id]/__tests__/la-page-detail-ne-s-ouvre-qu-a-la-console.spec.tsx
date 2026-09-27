/**
 * `emails-envoyes/[id]` — la page détail d'un e-mail envoyé (2026-09-27).
 *
 * Le contenu d'un e-mail est une donnée personnelle : la page ne le LIT
 * qu'après la garde. Gardé ici, avec la vraie `gardePage` (seule la session
 * est doublée) :
 *   · sans session → redirection vers la connexion, AUCUNE lecture ;
 *   · session sans rôle de console → refus NOMMÉ, AUCUNE lecture ;
 *   · rôle de console → la ligne est lue, la copie s'affiche dans une iframe
 *     `sandbox=""` (ni script, ni formulaire).
 * Et au build (`stub.invalid`) : la page est `force-dynamic`, et le module de
 * lecture ne touche pas la base.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const d = vi.hoisted(() => ({
  session: null as unknown,
  charger: vi.fn(),
  premiere: vi.fn(),
  reconstituer: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/admin-emails/detail", async (orig) => ({
  ...(await orig<typeof import("@/features/admin-emails/detail")>()),
  chargerDetailEmail: (...a: unknown[]) => d.charger(...a),
  datePremiereCopie: (...a: unknown[]) => d.premiere(...a),
}));
vi.mock("@/features/admin-emails/reconstitution-invitation", async (orig) => ({
  ...(await orig<typeof import("@/features/admin-emails/reconstitution-invitation")>()),
  reconstituerInvitation: (...a: unknown[]) => d.reconstituer(...a),
}));

import Page, { dynamic } from "../page";

const ID = "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b";
const params = Promise.resolve({ adminPrefix: "p", id: ID });
const searchParams = Promise.resolve({});

const EMAIL = {
  id: ID,
  template: "convention-envoi",
  recipient: "camille.dupont@example.invalid",
  locale: "fr",
  marketing: false,
  status: "sent",
  attempts: 1,
  error: null,
  bounceType: null,
  bounceReason: null,
  bouncedAt: null,
  sentAt: new Date("2026-09-28T09:00:00Z"),
  failedAt: null,
  dueAt: null,
  createdAt: new Date("2026-09-28T08:59:00Z"),
  entityType: null,
  entityId: null,
  providerMessageId: "<m1@zeptomail>",
  copie: {
    subject: "Votre convention à signer",
    html: "<html><body><p>Bonjour Camille</p><script>alert(1)</script></body></html>",
    text: "Bonjour Camille",
    attachmentNames: ["convention.pdf"],
    secretsMasques: 2,
    createdAt: new Date("2026-09-28T09:00:01Z"),
  },
};

beforeEach(() => {
  d.charger.mockReset();
  d.premiere.mockReset();
  d.reconstituer.mockReset();
  d.session = null;
});

describe("🔴 la page détail refuse quiconque n'est pas de la console", () => {
  it("sans session : redirection vers la connexion, et aucune lecture", async () => {
    d.session = null;
    await expect(Page({ params, searchParams })).rejects.toThrow("NEXT_REDIRECT /fr/p/login");
    expect(d.charger).not.toHaveBeenCalled();
  });

  it("session sans rôle de console : refus nommé, et aucune lecture", async () => {
    d.session = { user: { id: "u-1", role: "client" } };
    const el = (await Page({ params, searchParams })) as ReactElement;
    const html = renderToStaticMarkup(el);
    expect(html).toContain("Cet écran ne vous est pas ouvert");
    expect(html).not.toContain("Bonjour Camille");
    expect(d.charger).not.toHaveBeenCalled();
  });

  it("rôle de console : la copie s'affiche dans une iframe isolée (sandbox vide)", async () => {
    d.session = { user: { id: "u-2", role: "admin" } };
    d.charger.mockResolvedValue(EMAIL);
    const html = renderToStaticMarkup((await Page({ params, searchParams })) as ReactElement);
    expect(d.charger).toHaveBeenCalledWith(ID);
    expect(html).toMatch(/<iframe[^>]*sandbox=""/);
    // Le HTML de l'e-mail est DANS l'attribut srcdoc (échappé), jamais dans la page.
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("Votre convention à signer");
    expect(html).toContain("2 lien(s) personnel(s)");
    expect(html).toContain("convention.pdf");
  });

  it("ligne inconnue : 404", async () => {
    d.session = { user: { id: "u-2", role: "admin" } };
    d.charger.mockResolvedValue(null);
    await expect(Page({ params, searchParams })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sans copie : la page dit pourquoi, sans reconstitution hors invitation apporteur", async () => {
    d.session = { user: { id: "u-2", role: "admin" } };
    d.charger.mockResolvedValue({
      ...EMAIL,
      copie: null,
      sentAt: new Date("2026-09-20T09:00:00Z"),
    });
    d.premiere.mockResolvedValue(new Date("2026-09-28T07:00:00Z"));
    const html = renderToStaticMarkup((await Page({ params, searchParams })) as ReactElement);
    expect(html).toContain("Copie non conservée (envoi antérieur au 28/09/2026)");
    expect(d.reconstituer).not.toHaveBeenCalled();
  });
});

describe("stub.invalid — rien ne se lit au build", () => {
  it("la page n'est jamais pré-rendue", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
