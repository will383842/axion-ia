// @vitest-environment node
//
// /api/guide-ia/telecharger — deux portes, deux vérités (lot L2, 2026-09-24).
//
//   · un GET est « vu » (peut être un antivirus) : jamais « cliqué » ;
//   · seul le POST du bouton vaut clic humain, puis 303 vers le PDF ;
//   · un jeton inconnu ou mal formé : 404, sans rien dire de plus.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findUnique = vi.fn();
const updateMany = vi.fn();
const checkRateLimit = vi.fn();
const emettreEvenementPlausible = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: (...a: unknown[]) => emettreEvenementPlausible(...a),
}));

import { GET, POST } from "./route";
import { GUIDE_IA_CHEMIN } from "@/content/guide-ia";

const BASE = "https://axion-ia.com";
const JETON = "a1".repeat(32);

function get(t: string): NextRequest {
  return new NextRequest(`${BASE}/api/guide-ia/telecharger?t=${t}`, { method: "GET" });
}
function post(t: string): NextRequest {
  return new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Vitest" },
    body: `t=${t}`,
  });
}

/** Les champs écrits par les `updateMany`, tous appels confondus. */
function champsEcrits(): string[] {
  return updateMany.mock.calls.flatMap((c) =>
    Object.keys((c[0] as { data: Record<string, unknown> }).data),
  );
}

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue({ id: "demande-1", locale: "fr", source: "guide-ia" });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
  emettreEvenementPlausible.mockReset().mockResolvedValue(true);
});

describe("GET — le lien est ouvert (humain ou antivirus)", () => {
  it("🔴 pose first_seen_at, JAMAIS first_click_at, et rend une page avec un bouton qui POSTE", async () => {
    const res = await GET(get(JETON));
    expect(res.status).toBe(200);
    expect(champsEcrits()).toEqual(["firstSeenAt"]);
    const html = await res.text();
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/guide-ia/telecharger"');
    expect(html).toContain(`value="${JETON}"`);
    // Aucun JavaScript, et jamais le PDF en lien direct : c'est le POST qui y mène.
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain(GUIDE_IA_CHEMIN);
    expect(emettreEvenementPlausible).not.toHaveBeenCalled();
  });

  it("premier passage seulement : la mise à jour est conditionnée à first_seen_at vide", async () => {
    await GET(get(JETON));
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "demande-1", firstSeenAt: null },
      data: { firstSeenAt: expect.any(Date) },
    });
  });

  it("noindex, sans cache, sans référent", async () => {
    const res = await GET(get(JETON));
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("page en anglais pour une demande en anglais", async () => {
    findUnique.mockResolvedValue({ id: "demande-1", locale: "en", source: null });
    const html = await (await GET(get(JETON))).text();
    expect(html).toContain('lang="en"');
    expect(html).toContain("Download the guide (PDF)");
  });
});

describe("POST — le bouton : seul geste qui vaut clic humain", () => {
  it("🔴 pose first_click_at, émet « Guide Downloaded » sans donnée personnelle, puis 303 vers le PDF", async () => {
    const res = await POST(post(JETON));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain(GUIDE_IA_CHEMIN);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "demande-1", firstClickAt: null },
      data: { firstClickAt: expect.any(Date) },
    });
    expect(emettreEvenementPlausible).toHaveBeenCalledTimes(1);
    const evenement = emettreEvenementPlausible.mock.calls[0]?.[0] as {
      nom: string;
      chemin: string;
      props: Record<string, string>;
    };
    expect(evenement.nom).toBe("Guide Downloaded");
    expect(evenement.props).toEqual({ source: "guide-ia", premier: "oui" });
    // Le chemin transmis ne porte PAS le jeton personnel.
    expect(evenement.chemin).not.toContain(JETON);
  });

  it("un second clic n'est plus « premier »", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await POST(post(JETON));
    const evenement = emettreEvenementPlausible.mock.calls[0]?.[0] as {
      props: Record<string, string>;
    };
    expect(evenement.props["premier"]).toBe("non");
  });
});

describe("jeton invalide → 404", () => {
  it("🔴 jeton inconnu : 404 au GET comme au POST, rien n'est écrit", async () => {
    findUnique.mockResolvedValue(null);
    expect((await GET(get(JETON))).status).toBe(404);
    expect((await POST(post(JETON))).status).toBe(404);
    expect(updateMany).not.toHaveBeenCalled();
    expect(emettreEvenementPlausible).not.toHaveBeenCalled();
  });

  it("jeton mal formé : 404 sans même interroger la base", async () => {
    for (const t of ["", "abc", "z".repeat(64), `${JETON}0`]) {
      expect((await GET(get(t))).status).toBe(404);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("limite de débit : 429", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await GET(get(JETON))).status).toBe(429);
    expect((await POST(post(JETON))).status).toBe(429);
  });
});

describe("pages d'erreur : une vraie phrase, dans la langue de la personne (décision du 25/09)", () => {
  function avecLangue(req: NextRequest, langue: string): NextRequest {
    req.headers.set("accept-language", langue);
    return req;
  }

  it("🔴 429 : une phrase, jamais le code « rate_limited »", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    for (const res of [await GET(get(JETON)), await POST(post(JETON))]) {
      const html = await res.text();
      expect(res.status).toBe(429);
      expect(html).not.toContain("rate_limited");
      expect(html).toContain("Trop de demandes en peu de temps. Réessayez dans quelques minutes.");
      expect(res.headers.get("content-type")).toContain("text/html");
    }
    const en = await GET(avecLangue(get(JETON), "en-GB,en;q=0.9"));
    expect(await en.text()).toContain(
      "Too many requests in a short time. Try again in a few minutes.",
    );
    // Le débit est vérifié AVANT la base : rien n'est lu.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("🔴 404 : la phrase dit où redemander le guide, en français par défaut", async () => {
    findUnique.mockResolvedValue(null);
    const html = await (await GET(get(JETON))).text();
    expect(html).toContain('lang="fr"');
    expect(html).toContain("Ce lien n&#39;est plus valable. Demandez à nouveau le guide sur");
    expect(html).toContain('<a href="/fr/guide-ia">axion-ia.com/fr/guide-ia</a>.');
    expect(html).not.toMatch(/<script/i);
  });

  it("404 en anglais quand le navigateur demande l'anglais", async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(avecLangue(post(JETON), "en-US,en;q=0.8,fr;q=0.5"));
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('lang="en"');
    expect(html).toContain("This link is no longer valid. Request the guide again at");
    expect(html).toContain('<a href="/en/ai-guide">axion-ia.com/en/ai-guide</a>.');
  });

  it("un navigateur qui préfère le français garde la page en français", async () => {
    const res = await GET(avecLangue(get("abc"), "fr-FR,fr;q=0.9,en;q=0.8"));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('lang="fr"');
  });
});
