// @vitest-environment node
//
// Bouton « Suivre la page Axion IA » — formulaire, remerciement, e-mail du guide.
// Rien en production tant que les variables d'adresse ne sont pas posées.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { render } from "@react-email/components";
import { createElement } from "react";

vi.mock("@/lib/prisma", () => ({
  prisma: { contactGuideReseau: { findUnique: async () => null } },
}));

import { GET as PageGET } from "../../../app/guide-reseau/route";
import { GET as MerciGET } from "../../../app/guide-reseau/merci/route";
import { GuideIaEnvoiEmail } from "@/lib/email/templates/guide-ia-envoi";
import { creerJeton } from "@/server/guides-reseau/lien-page-guide";
import { adressePageSuivre, TEXTE_SUIVRE_PAGE } from "../page-suivre";

const SECRET = "L".repeat(40);
const FB = "https://www.facebook.com/exemple";
const LI = "https://www.linkedin.com/company/exemple";
const IG = "https://www.instagram.com/exemple";

const jeton = (reseau: "facebook" | "linkedin" | "instagram" | "autre") =>
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

async function formulaire(reseau: Parameters<typeof jeton>[0]): Promise<string> {
  const r = await PageGET(
    new NextRequest(`https://axion-ia.com/guide-reseau?j=${encodeURIComponent(jeton(reseau))}`),
  );
  const html = await r.text();
  // Garde-fou : on lit bien le FORMULAIRE (sinon « absent » serait vrai pour une mauvaise raison).
  expect(html).toContain('action="/guide-reseau/envoyer"');
  return html;
}
async function merci(r?: string): Promise<string> {
  const q = r === undefined ? "" : `?r=${r}`;
  const res = await MerciGET(new NextRequest(`https://axion-ia.com/guide-reseau/merci${q}`));
  return res.text();
}
async function courriel(extra: Record<string, unknown>): Promise<string> {
  return render(
    createElement(GuideIaEnvoiEmail, {
      locale: "fr",
      payload: {
        downloadToken: "t",
        reseau: true,
        pageGuide: true,
        oppositionToken: "o",
        ...extra,
      },
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("PAGE_GUIDE_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_LIEN_SECRET", SECRET);
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", "A".repeat(40));
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", "");
  vi.stubEnv("PAGE_SUIVRE_FACEBOOK", "");
  vi.stubEnv("PAGE_SUIVRE_LINKEDIN", "");
  vi.stubEnv("PAGE_SUIVRE_INSTAGRAM", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("adressePageSuivre", () => {
  it("accepte https + hôte de la liste, pour le bon réseau", () => {
    expect(adressePageSuivre("facebook", { PAGE_SUIVRE_FACEBOOK: FB })).toBe(FB);
    expect(adressePageSuivre("linkedin", { PAGE_SUIVRE_LINKEDIN: LI })).toBe(LI);
    expect(adressePageSuivre("instagram", { PAGE_SUIVRE_INSTAGRAM: IG })).toBe(IG);
    // pas la variable d'un autre réseau
    expect(adressePageSuivre("linkedin", { PAGE_SUIVRE_FACEBOOK: FB })).toBeNull();
  });
  it("refuse absent, vide, http, hôte hors liste, identifiants, tiktok, autre, inconnu", () => {
    expect(adressePageSuivre("facebook", {})).toBeNull();
    expect(adressePageSuivre("facebook", { PAGE_SUIVRE_FACEBOOK: "  " })).toBeNull();
    expect(
      adressePageSuivre("facebook", { PAGE_SUIVRE_FACEBOOK: "http://facebook.com/x" }),
    ).toBeNull();
    for (const h of [
      "https://exemple.org/x",
      "https://facebook.com.exemple.org/x",
      "https://m.facebook.com/x",
      "https://user:pw@facebook.com/x",
      "javascript:alert(1)",
      "pas une adresse",
    ]) {
      expect(adressePageSuivre("facebook", { PAGE_SUIVRE_FACEBOOK: h })).toBeNull();
    }
    for (const r of ["tiktok", "autre", "inconnu", "", undefined, null, 3, "__proto__"]) {
      expect(
        adressePageSuivre(r, { PAGE_SUIVRE_FACEBOOK: FB, PAGE_SUIVRE_LINKEDIN: LI }),
      ).toBeNull();
    }
  });
});

describe("page du formulaire", () => {
  it("bouton présent avec variable valide, pour le bon réseau", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", FB);
    vi.stubEnv("PAGE_SUIVRE_LINKEDIN", LI);
    const html = await formulaire("facebook");
    expect(html).toContain(`href="${FB}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(TEXTE_SUIVRE_PAGE);
    expect(html).not.toContain(LI);
    expect(html).not.toMatch(/<script|abonn/i);
    expect(html).not.toMatch(/name="suivre"/);
  });
  it("absent sans variable", async () => {
    expect(await formulaire("facebook")).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour une adresse hors liste", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", "https://exemple.org/x");
    expect(await formulaire("facebook")).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour autre", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", FB);
    expect(await formulaire("autre")).not.toContain(TEXTE_SUIVRE_PAGE);
  });
});

describe("page de remerciement", () => {
  it("bouton présent avec variable valide, pour le bon réseau", async () => {
    vi.stubEnv("PAGE_SUIVRE_INSTAGRAM", IG);
    const html = await merci("instagram");
    expect(html).toContain(`href="${IG}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent sans variable", async () => {
    expect(await merci("instagram")).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour une adresse hors liste", async () => {
    vi.stubEnv("PAGE_SUIVRE_INSTAGRAM", "https://exemple.org/x");
    expect(await merci("instagram")).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour tiktok, autre, inconnu ou sans réseau", async () => {
    vi.stubEnv("PAGE_SUIVRE_INSTAGRAM", IG);
    for (const r of ["tiktok", "autre", "zzz", undefined]) {
      expect(await merci(r)).not.toContain(TEXTE_SUIVRE_PAGE);
    }
  });
});

describe("e-mail du guide", () => {
  it("bouton présent avec variable valide, pour le bon réseau, en simple lien", async () => {
    vi.stubEnv("PAGE_SUIVRE_LINKEDIN", LI);
    const html = await courriel({ reseauOrigine: "linkedin" });
    expect(html).toContain(`href="${LI}"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(TEXTE_SUIVRE_PAGE);
    expect(html).not.toMatch(/abonn(?!ement de la lettre)/i);
  });
  it("absent sans variable", async () => {
    expect(await courriel({ reseauOrigine: "linkedin" })).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour une adresse hors liste", async () => {
    vi.stubEnv("PAGE_SUIVRE_LINKEDIN", "https://exemple.org/x");
    expect(await courriel({ reseauOrigine: "linkedin" })).not.toContain(TEXTE_SUIVRE_PAGE);
  });
  it("absent pour tiktok, autre ou sans réseau", async () => {
    vi.stubEnv("PAGE_SUIVRE_FACEBOOK", FB);
    for (const r of ["tiktok", "autre", undefined]) {
      expect(await courriel({ reseauOrigine: r })).not.toContain(TEXTE_SUIVRE_PAGE);
    }
  });
});
