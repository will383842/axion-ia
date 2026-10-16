/**
 * V2-N-5 (MAJEUR) — le lien de connexion à l'espace formateur, OUVERT par la messagerie.
 *
 * Les messageries d'entreprise ouvrent les liens des e-mails pour les contrôler. Le lien
 * se consommait à l'ouverture (GET) : il était brûlé avant la personne, qui lisait « Ce
 * lien de connexion est invalide ou a expiré ». Désormais :
 *   · l'ouverture n'écrit RIEN : elle affiche « Ouvrir mon espace » ;
 *   · le bouton (POST) consomme le lien — une seule fois, comme avant ;
 *   · un lien déjà servi ou échu mène droit au message d'erreur, dès l'ouverture.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  utilisable: vi.fn(),
  consommer: vi.fn(),
  trainer: { findUnique: vi.fn(), update: vi.fn() },
  cookie: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { trainer: h.trainer } }));
vi.mock("@/server/formateur/magic-link", () => ({
  formateurMagicLinkUtilisable: h.utilisable,
  consumeFormateurMagicLink: h.consommer,
}));
vi.mock("@/lib/formateur-session", () => ({ signFormateurSession: vi.fn(async () => "jeton") }));
vi.mock("@/server/formateur/cookie", () => ({ setFormateurCookie: h.cookie }));

import { GET, POST } from "@/app/[locale]/espace-formateur/connexion/[token]/route";
import { TEXTES_PAGE_CONNEXION } from "@/server/formateur/page-confirmer-connexion";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

const URL_LIEN = "https://axion-ia.com/fr/espace-formateur/connexion/TOK";
const ctx = () => ({ params: Promise.resolve({ token: "TOK", locale: "fr" }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.utilisable.mockResolvedValue(true);
  // Usage unique : le premier clic passe, les suivants non (comme `updateMany` en base).
  h.consommer.mockReset().mockResolvedValueOnce("trainer-1").mockResolvedValue(null);
  h.trainer.findUnique.mockResolvedValue({ id: "trainer-1", actif: true });
});

describe("V2-N-5 — ouvrir le lien ne le consomme pas", () => {
  it("deux ouvertures (la messagerie, puis la personne) : la page « Ouvrir mon espace », rien d'écrit", async () => {
    for (const _ of [1, 2]) {
      const r = await GET(new NextRequest(URL_LIEN), ctx());
      expect(r.status).toBe(200);
      const html = await r.text();
      expect(html).toContain(TEXTES_PAGE_CONNEXION.bouton);
      expect(html).toMatch(/<form method="post">/);
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    }
    expect(h.consommer).not.toHaveBeenCalled();
    expect(h.cookie).not.toHaveBeenCalled();
  });

  it("le bouton ouvre l'espace (303), et le lien ne sert qu'une fois", async () => {
    const premier = await POST(new NextRequest(URL_LIEN, { method: "POST" }), ctx());
    expect(premier.status).toBe(303);
    expect(new URL(premier.headers.get("location")!).pathname).toBe(FORMATEUR_BASE_PATH);
    expect(h.cookie).toHaveBeenCalledTimes(1);

    const second = await POST(new NextRequest(URL_LIEN, { method: "POST" }), ctx());
    expect(second.status).toBe(303);
    expect(new URL(second.headers.get("location")!).searchParams.get("erreur")).toBe(
      "lien_invalide",
    );
    expect(h.cookie).toHaveBeenCalledTimes(1);
  });

  it("un lien déjà servi ou échu : le message d'erreur dès l'ouverture, sans bouton", async () => {
    h.utilisable.mockResolvedValue(false);
    const r = await GET(new NextRequest(URL_LIEN), ctx());
    expect(new URL(r.headers.get("location")!).searchParams.get("erreur")).toBe("lien_invalide");
  });

  it("un envoi venu d'un autre site ne consomme rien", async () => {
    const r = await POST(
      new NextRequest(URL_LIEN, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      ctx(),
    );
    expect(new URL(r.headers.get("location")!).searchParams.get("erreur")).toBe("lien_invalide");
    expect(h.consommer).not.toHaveBeenCalled();
  });

  it("la page est en français simple, sans lien sortant ni script", async () => {
    const html = await (await GET(new NextRequest(URL_LIEN), ctx())).text();
    expect(html).toContain('lang="fr"');
    expect(html).not.toMatch(/<script|<a\s|https?:\/\//i);
  });
});
