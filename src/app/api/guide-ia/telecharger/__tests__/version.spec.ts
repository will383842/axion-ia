// @vitest-environment node
//
// G4 — /api/guide-ia/telecharger pour un chemin VERSIONNÉ (guides-reseau/gde-…/v<n>.pdf), POST seulement.
// Tout doute = page « indisponible » en 200, jamais 500. Le guide-ia et le chemin public/ ne bougent pas.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  demande: null as Ligne | null,
  cible: null as Ligne | null,
  version: null as Ligne | null,
  lectureVersionLeve: false,
  versionLue: 0,
  r2: { taille: 4096, signe: [] as unknown[][], leve: false },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: { findUnique: async () => bd.demande, updateMany: async () => ({ count: 1 }) },
    cibleReseau: { findUnique: async () => bd.cible },
    get guideReseauVersion() {
      bd.versionLue++;
      return {
        findUnique: async () => {
          if (bd.lectureVersionLeve) throw new Error("base_en_panne");
          return bd.version;
        },
      };
    },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  tailleObjetR2: async () => {
    if (bd.r2.leve) throw new Error("r2_en_panne");
    return bd.r2.taille;
  },
  signerLectureR2: async (...a: unknown[]) => {
    bd.r2.signe.push(a);
    return "https://compte.r2.cloudflarestorage.com/axion-ia-guides/guides-reseau/gde-essai-01/v2.pdf?X-Amz-Signature=abc";
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/analytics/plausible-serveur", () => ({
  emettreEvenementPlausible: async () => true,
}));
vi.mock("@/server/guides-reseau/preuve-page-guide", () => ({
  confirmerPreuvesAuClic: async () => undefined,
}));
vi.mock("@/server/crm-sync/lettre-guide", () => ({ transmettreClicGuide: async () => undefined }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h:${e.trim().toLowerCase()}` : null),
}));

import { GET, POST } from "../route";
import { SITE_URL } from "@/lib/site-url";

const BASE = "https://axion-ia.com";
const JETON = "b2".repeat(32);
const SECRET_LIEN = "l".repeat(40);
const post = () =>
  POST(
    new NextRequest(`${BASE}/api/guide-ia/telecharger`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `t=${JETON}`,
    }),
  );
const corpsDe = async (r: Response) => await r.text();
const CLE = "guides-reseau/gde-essai-01/v2.pdf";

beforeEach(() => {
  bd.demande = {
    id: "d1",
    locale: "fr",
    source: "mot-guide:instagram",
    email: "p@example.test",
    aimant: "gde-essai-01",
  };
  bd.cible = {
    code: "gde-essai-01",
    type: "guide",
    titre: "Le plan",
    cheminPdf: CLE,
    actif: true,
    test: false,
  };
  bd.version = { statut: "pret", stockage: "r2", cleObjet: CLE };
  bd.lectureVersionLeve = false;
  bd.versionLue = 0;
  bd.r2 = { taille: 4096, signe: [], leve: false };
  vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_STOCKAGE", "r2");
  vi.stubEnv("R2_ACCOUNT_ID", "compte");
  vi.stubEnv("R2_GUIDES_BUCKET_NAME", "axion-ia-guides");
  vi.stubEnv("R2_GUIDES_ACCESS_KEY_ID", "cle");
  vi.stubEnv("R2_GUIDES_SECRET_ACCESS_KEY", "secret");
});
afterEach(() => vi.unstubAllEnvs());

const indisponible = async (r: Response) => {
  expect(r.status).toBe(200);
  expect(r.headers.get("location")).toBeNull();
  expect(await corpsDe(r)).toMatch(/<html/i);
};

describe("G4 — version prête sur R2", () => {
  it("303 vers l'URL signée, 600 s, inline, no-store, no-referrer", async () => {
    const r = await post();
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toMatch(/X-Amz-Signature/);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    const [cible, cle, ttl, fichier] = bd.r2.signe[0] as [
      Record<string, string>,
      string,
      number,
      Record<string, string>,
    ];
    expect(cible.bucket).toBe("axion-ia-guides");
    expect(cle).toBe(CLE);
    expect(ttl).toBe(600);
    expect(fichier.disposition).toBe("inline");
  });
  it("l'URL signée n'est jamais journalisée", async () => {
    const espions = (["log", "info", "warn", "error"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await post();
    for (const e of espions)
      expect(JSON.stringify(e.mock.calls)).not.toMatch(/X-Amz|r2\.cloudflarestorage/);
    espions.forEach((e) => e.mockRestore());
  });
});

describe("G4 — tout doute = indisponible en 200, jamais 500", () => {
  it("interrupteur éteint", async () => {
    vi.stubEnv("GUIDES_RESEAU_FABRIQUE_ENABLED", "false");
    await indisponible(await post());
    expect(bd.versionLue).toBe(0);
  });
  it("ligne absente, « en_cours », « echec »", async () => {
    for (const v of [
      null,
      { statut: "en_cours", stockage: "r2", cleObjet: CLE },
      { statut: "echec", stockage: "r2", cleObjet: CLE },
    ]) {
      bd.version = v;
      await indisponible(await post());
    }
  });
  it("clé de la ligne différente de la clé dérivée", async () => {
    bd.version = { statut: "pret", stockage: "r2", cleObjet: "guides-reseau/gde-autre-02/v2.pdf" };
    await indisponible(await post());
  });
  it("base en panne, R2 en panne, objet vide, R2 non configuré", async () => {
    bd.lectureVersionLeve = true;
    await indisponible(await post());
    bd.lectureVersionLeve = false;
    bd.r2.leve = true;
    await indisponible(await post());
    bd.r2.leve = false;
    bd.r2.taille = 0;
    await indisponible(await post());
    bd.r2.taille = 10;
    vi.stubEnv("R2_GUIDES_BUCKET_NAME", "axion-ia-backups");
    await indisponible(await post());
  });
  it("le code du chemin n'est pas celui du guide : ancien code (public/), jamais la table", async () => {
    bd.cible = { ...bd.cible, cheminPdf: "guides-reseau/gde-autre-02/v2.pdf" };
    await indisponible(await post()); // fichier absent de public/ → indisponible
    expect(bd.versionLue).toBe(0);
  });
  it("GET ne livre ni ne lit jamais la version (page de confirmation seulement)", async () => {
    const r = await GET(new NextRequest(`${BASE}/api/guide-ia/telecharger?t=${JETON}`));
    expect(r.status).toBe(200);
    expect(bd.versionLue).toBe(0);
  });
});

describe("G4 — volume", () => {
  let racine: string;
  beforeEach(() => {
    racine = mkdtempSync(path.join(tmpdir(), "guides-"));
    vi.stubEnv("GUIDES_RESEAU_STOCKAGE", "volume");
    vi.stubEnv("GUIDES_RESEAU_VOLUME", racine);
    vi.stubEnv("GUIDES_RESEAU_FICHIER_SECRET", SECRET_LIEN);
    bd.version = { statut: "pret", stockage: "volume", cleObjet: CLE };
  });
  const poser = () => {
    mkdirSync(path.join(racine, "guides-reseau/gde-essai-01"), { recursive: true });
    writeFileSync(path.join(racine, CLE), "%PDF-1.4 contenu");
  };
  it("fichier présent : 303 vers /api/guides-reseau/fichier avec c, v, e, s", async () => {
    poser();
    const r = await post();
    expect(r.status).toBe(303);
    const u = new URL(r.headers.get("location")!);
    expect(`${u.origin}`).toBe(new URL(SITE_URL).origin);
    expect(u.pathname).toBe("/api/guides-reseau/fichier");
    expect(u.searchParams.get("c")).toBe("gde-essai-01");
    expect(u.searchParams.get("v")).toBe("2");
    expect(u.searchParams.get("s")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("fichier absent, vide, secret absent ou trop court = indisponible", async () => {
    await indisponible(await post());
    poser();
    writeFileSync(path.join(racine, CLE), "");
    await indisponible(await post());
    writeFileSync(path.join(racine, CLE), "%PDF");
    vi.stubEnv("GUIDES_RESEAU_FICHIER_SECRET", "court");
    await indisponible(await post());
  });
  it("lien symbolique sur le dossier du guide = indisponible", async () => {
    const dehors = mkdtempSync(path.join(tmpdir(), "dehors-"));
    writeFileSync(path.join(dehors, "v2.pdf"), "%PDF secret");
    mkdirSync(path.join(racine, "guides-reseau"));
    symlinkSync(dehors, path.join(racine, "guides-reseau/gde-essai-01"));
    await indisponible(await post());
  });
});
