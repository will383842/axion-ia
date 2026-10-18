/**
 * VÉRIFICATION DE BOUT EN BOUT AVEC LE STUDIO FACTICE (plan PLAN-W1-W4 §13,
 * étapes 1 à 5 + retrait ; enrichi à chaque lot).
 *
 *   pnpm test:integration tests/integration/videos/bout-en-bout
 *
 * Vrai Postgres (migration `site_videos_reception` appliquée), vrais gestionnaires
 * de route, vrai serveur de fichiers qui répond aux `Range` en 206, vraie vidéo de
 * 31 s fabriquée par `ffmpeg -f lavfi`. Le studio factice signe avec son propre
 * code (scripts/videos/studio-factice.mjs), indépendant de celui du site : si les
 * deux divergeaient, ce test le verrait.
 *
 * Nettoie ses lignes en fin de test ; sans `DATABASE_URL`, il ÉCHOUE.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient } from "../../../prisma/generated/client";
import {
  construirePublication,
  deposer,
  entetesSignes,
  fabriquerFichiers,
  servirFichiers,
} from "../../../scripts/videos/studio-factice.mjs";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: 0,
    panne: false,
  })),
}));
vi.mock("@/server/reviews/presence", () => ({ avisPublies: async () => false }));

// eslint-disable-next-line no-restricted-imports
import { POST, DELETE } from "@/app/api/interne/videos/route";
// eslint-disable-next-line no-restricted-imports
import { GET } from "@/app/api/interne/reglages-publics/route";

const SECRET = "secret-de-test-".padEnd(40, "x");
const SLUG = "video-de-test-w1";
// Les lignes de CE test seulement : d'autres fichiers d'intégration partagent la base.
const IDS = ["vs_test_w1_0001", "vs_test_w1_0002"];
const CH_VIDEOS = "/api/interne/videos";
const CH_REGLAGES = "/api/interne/reglages-publics";

const prisma = new PrismaClient();
let dossierTravail: string;
let serveur: Awaited<ReturnType<typeof servirFichiers>>;
let tailles: Record<string, number>;
let octetsVtt: number;

function requete(
  methode: "GET" | "POST" | "DELETE",
  chemin: string,
  corps = "",
  surcharge: { nonce?: string; horodatage?: number } = {},
) {
  const entetes = entetesSignes({ secret: SECRET, methode, chemin, corps, ...surcharge });
  return new NextRequest(`http://localhost${chemin}`, {
    method: methode,
    headers: entetes,
    ...(methode === "GET" ? {} : { body: corps }),
  });
}

function publication(surcharge: Record<string, unknown> = {}) {
  return JSON.stringify(
    construirePublication({
      slug: SLUG,
      tailles,
      sousTitresOctets: octetsVtt,
      studioVideoId: "vs_test_w1_0001",
      surcharge,
    }),
  );
}

async function nettoyer() {
  await prisma.siteVideoReception.deleteMany({ where: { studioVideoId: { in: IDS } } });
  await prisma.siteVideo.deleteMany({ where: { slug: SLUG } });
}

beforeAll(async () => {
  dossierTravail = mkdtempSync(join(tmpdir(), "studio-factice-"));
  tailles = fabriquerFichiers(join(dossierTravail, "source"));
  octetsVtt = deposer({
    racineServie: join(dossierTravail, "servi"),
    slug: SLUG,
    version: 1,
    dossierSource: join(dossierTravail, "source"),
  });
  serveur = await servirFichiers(join(dossierTravail, "servi"));
  await nettoyer();
});

afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
  await serveur.arreter();
  rmSync(dossierTravail, { recursive: true, force: true });
});

beforeEach(() => {
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", SECRET);
  vi.stubEnv("MEDIAS_ORIGINE", serveur.origine);
  vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "true");
});

describe("§13 — studio factice → site", () => {
  it("2. drapeau éteint : POST → 503 et table vide", async () => {
    vi.stubEnv("VIDEOS_SITE_ENABLED", "false");
    const r = await POST(requete("POST", CH_VIDEOS, publication()));
    expect(r.status).toBe(503);
    expect(await prisma.siteVideo.count({ where: { slug: SLUG } })).toBe(0);
    expect(await prisma.siteVideoReception.count({ where: { studioVideoId: { in: IDS } } })).toBe(
      0,
    );
  });

  it("3. allumé : les réglages publics rendent les quatre booléens", async () => {
    const r = await GET(requete("GET", CH_REGLAGES));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      schemaVersion: 1,
      qualiopiCertificationObtenue: false,
      ofPublicDisclosure: true,
      avisPublies: false,
      videosSiteActives: true,
    });
  });

  it("le serveur de fichiers répond aux Range en 206 (sinon Safari iOS ne lit pas)", async () => {
    const url = `${serveur.origine}/medias/videos/${SLUG}/v1/video-1080p.mp4`;
    const r = await fetch(url, { headers: { range: "bytes=0-1" } });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toMatch(/^bytes 0-1\/\d+$/);
  });

  it("4. POST signé valide → 201, vidéo écrite, fichiers vérifiés par HEAD", async () => {
    const avant = serveur.compteurs.head;
    const r = await POST(requete("POST", CH_VIDEOS, publication()));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({
      ok: true,
      statut: "publiee",
      slug: SLUG,
      version: 1,
      rejeu: false,
    });
    expect(serveur.compteurs.head - avant).toBe(5);
    const ligne = await prisma.siteVideo.findUniqueOrThrow({ where: { slug: SLUG } });
    expect(ligne.statut).toBe("publiee");
    expect(ligne.dureeSecondes).toBe(31);
  });

  it("5. même requête rejouée → même réponse, X-Axion-Rejeu: 1, aucune ligne en plus", async () => {
    await nettoyer();
    const corps = publication();
    const nonce = "a".repeat(32);
    const premiere = await POST(requete("POST", CH_VIDEOS, corps, { nonce }));
    const compter = () =>
      prisma.siteVideoReception.count({ where: { studioVideoId: { in: IDS } } });
    const lignesApres = await compter();
    const seconde = await POST(requete("POST", CH_VIDEOS, corps, { nonce }));
    expect(premiere.status).toBe(201);
    expect(seconde.status).toBe(201);
    expect(seconde.headers.get("x-axion-rejeu")).toBe("1");
    expect(await seconde.json()).toEqual(await premiere.json());
    expect(await compter()).toBe(lignesApres);
    expect(await prisma.siteVideo.count({ where: { slug: SLUG } })).toBe(1);
  });

  it("5. un octet de signature faux → 401 ; horodatage − 301 s → 401", async () => {
    const corps = publication({ version: 2 });
    const fausse = requete("POST", CH_VIDEOS, corps);
    fausse.headers.set(
      "x-axion-signature",
      fausse.headers.get("x-axion-signature")!.replace(/.$/, (c) => (c === "0" ? "1" : "0")),
    );
    expect((await POST(fausse)).status).toBe(401);
    const ancienne = requete("POST", CH_VIDEOS, corps, {
      horodatage: Math.floor(Date.now() / 1000) - 301,
    });
    expect((await POST(ancienne)).status).toBe(401);
  });

  it("fichier absent du serveur → 422 fichier_injoignable, aucune vidéo de plus", async () => {
    const corps = JSON.stringify(
      construirePublication({
        slug: "fichiers-absents",
        tailles,
        sousTitresOctets: octetsVtt,
        studioVideoId: "vs_test_w1_0002",
      }),
    );
    const r = await POST(requete("POST", CH_VIDEOS, corps));
    expect(r.status).toBe(422);
    expect((await r.json()).erreur).toBe("fichier_injoignable");
    expect(await prisma.siteVideo.count({ where: { slug: "fichiers-absents" } })).toBe(0);
  });

  it("retrait : statut retiree en base, retrait rejoué → 200 rejeu", async () => {
    const corps = JSON.stringify({
      schemaVersion: 1,
      studioVideoId: "vs_test_w1_0001",
      motif: "autre",
    });
    const r = await DELETE(requete("DELETE", CH_VIDEOS, corps));
    expect(r.status).toBe(200);
    const ligne = await prisma.siteVideo.findUniqueOrThrow({ where: { slug: SLUG } });
    expect(ligne.statut).toBe("retiree");
    expect(ligne.retireeLe).not.toBeNull();
    const encore = await DELETE(requete("DELETE", CH_VIDEOS, corps));
    expect(await encore.json()).toMatchObject({ statut: "retiree", rejeu: true });
  });
});
