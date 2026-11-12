// @vitest-environment node
//
// Adresse de redirection vers le merci : le piège à robots et l'envoi réel donnent EXACTEMENT la
// même adresse (sinon la présence de `?r=` révélerait lequel des deux a répondu).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/security/honeypot-observable", () => ({ signalerHoneypot: async () => undefined }));
vi.mock("@/server/guides-reseau/page-confirmation", () => ({
  confirmerPageGuide: async () => ({ ok: true }),
}));

import { POST } from "../../../app/guide-reseau/envoyer/route";
import { creerJeton } from "../lien-page-guide";
import { adresseMerci } from "../page-suivre";

const SECRET = "L".repeat(40);
const FB = "https://www.facebook.com/exemple";
const jeton = (reseau: "facebook" | "autre") =>
  creerJeton(
    {
      conv: "conv_exemple_0001",
      mot: "GUIDE",
      reseau,
      guide: "guide-ia",
      compte: "page_principale",
      version_m1: "m1-2026-11",
    },
    SECRET,
    Date.now(),
  );

async function adresse(j: string, piege: boolean): Promise<string> {
  const champs: Record<string, string> = {
    j,
    prenom: "Camille",
    email: "a@example.test",
    accord: "oui",
  };
  if (piege) champs.website = "http://spam.example";
  const r = await POST(
    new NextRequest("http://localhost/guide-reseau/envoyer", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(champs).toString(),
    }),
  );
  expect(r.status).toBe(303);
  const u = new URL(r.headers.get("location")!);
  return u.pathname + u.search;
}

beforeEach(() => {
  vi.stubEnv("PAGE_GUIDE_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_LIEN_SECRET", SECRET);
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", "A".repeat(40));
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", "");
  vi.stubEnv("PAGE_SUIVRE_FACEBOOK", "");
});

describe("adresse du merci : piège et envoi réel indiscernables", () => {
  it("jeton facebook, SANS variable : les deux donnent `merci` sans ?r=", async () => {
    const j = jeton("facebook");
    expect(await adresse(j, true)).toBe("/guide-reseau/merci");
    expect(await adresse(j, false)).toBe("/guide-reseau/merci");
  });
  it("jeton facebook, AVEC variable valide : les deux donnent la même adresse avec ?r=", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", FB);
    const j = jeton("facebook");
    const piege = await adresse(j, true);
    expect(piege).toBe("/guide-reseau/merci?r=facebook");
    expect(await adresse(j, false)).toBe(piege);
  });
  it("jeton non suivable (autre) ou faux : même adresse nue des deux côtés", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", FB);
    for (const j of [jeton("autre"), "n-importe-quoi"]) {
      expect(await adresse(j, true)).toBe("/guide-reseau/merci");
      expect(await adresse(j, false)).toBe("/guide-reseau/merci");
    }
  });
  it("adresseMerci : pas de secret → adresse nue", () => {
    expect(adresseMerci(jeton("facebook"), null, { PAGE_SUIVRE_FACEBOOK: FB })).toBe(
      "/guide-reseau/merci",
    );
  });
});
