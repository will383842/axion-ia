// @vitest-environment node
// G4 — GET /api/guides-reseau/fichier : lien signé du volume. Toute anomalie = 404 neutre, jamais 500.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const bd = vi.hoisted(() => ({ ligne: null as Record<string, unknown> | null, leve: false }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideReseauVersion: {
      findUnique: async () => {
        if (bd.leve) throw new Error("base_en_panne");
        return bd.ligne;
      },
    },
  },
}));

import { GET } from "@/app/api/guides-reseau/fichier/route";
import { signerLienFichier } from "../lien-fichier-guide";

const SECRET = "l".repeat(40);
let racine: string;
const url = (o: { c?: string; v?: number; e?: number; s?: string } = {}) => {
  const lien = signerLienFichier(SECRET, "gde-essai-01", 2);
  const q = new URLSearchParams({
    c: o.c ?? "gde-essai-01",
    v: String(o.v ?? 2),
    e: String(o.e ?? lien.e),
    s: o.s ?? lien.s,
  });
  return new NextRequest(`https://axion-ia.com/api/guides-reseau/fichier?${q}`);
};

beforeEach(() => {
  racine = mkdtempSync(path.join(tmpdir(), "guides-"));
  mkdirSync(path.join(racine, "guides-reseau/gde-essai-01"), { recursive: true });
  writeFileSync(path.join(racine, "guides-reseau/gde-essai-01/v2.pdf"), "%PDF-1.4 contenu");
  bd.ligne = { statut: "pret", stockage: "volume" };
  bd.leve = false;
  vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_VOLUME", racine);
  vi.stubEnv("GUIDES_RESEAU_FICHIER_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("lecture d'un PDF du volume", () => {
  it("lien valide : 200, PDF inline, no-store, noindex", async () => {
    const r = await GET(url());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toMatch(/^inline/);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(r.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(await r.text()).toBe("%PDF-1.4 contenu");
  });
  it("éteint, signature fausse, lien expiré, autre version, ligne absente ou non prête, base en panne = 404", async () => {
    vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "false");
    expect((await GET(url())).status).toBe(404);
    vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "true");
    expect((await GET(url({ s: "0".repeat(64) }))).status).toBe(404);
    expect((await GET(url({ e: Math.floor(Date.now() / 1000) - 5 }))).status).toBe(404);
    expect((await GET(url({ v: 3 }))).status).toBe(404);
    bd.ligne = null;
    expect((await GET(url())).status).toBe(404);
    bd.ligne = { statut: "en_cours", stockage: "volume" };
    expect((await GET(url())).status).toBe(404);
    bd.ligne = { statut: "pret", stockage: "r2" };
    expect((await GET(url())).status).toBe(404);
    bd.ligne = { statut: "pret", stockage: "volume" };
    bd.leve = true;
    expect((await GET(url())).status).toBe(404);
  });
  it("paramètres piégés (code avec « .. », version non numérique) = 404", async () => {
    expect((await GET(url({ c: "gde-../../etc" }))).status).toBe(404);
    expect(
      (
        await GET(
          new NextRequest(
            "https://axion-ia.com/api/guides-reseau/fichier?c=gde-essai-01&v=2abc&e=1&s=x",
          ),
        )
      ).status,
    ).toBe(404);
  });
});
