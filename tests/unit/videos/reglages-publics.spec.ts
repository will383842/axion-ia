import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "s".repeat(40);
const T0 = 1_800_000_000;
const CHEMIN = "/api/interne/reglages-publics";
const avisPublies = vi.fn();

vi.mock("@/server/reviews/presence", () => ({ avisPublies: () => avisPublies() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: 0,
    panne: false,
  })),
}));

// eslint-disable-next-line no-restricted-imports
import { GET } from "@/app/api/interne/reglages-publics/route";

const NONCE = "0123456789abcdef0123456789abcdef";

function requete(over: { signature?: string; horodatage?: number } = {}): NextRequest {
  const horodatage = String(over.horodatage ?? T0);
  const signature =
    over.signature ??
    signerRequete({
      secret: SECRET,
      horodatage,
      nonce: NONCE,
      methode: "GET",
      chemin: CHEMIN,
      corps: "",
    });
  return new NextRequest(`http://localhost${CHEMIN}`, {
    method: "GET",
    headers: {
      "x-axion-horodatage": horodatage,
      "x-axion-nonce": NONCE,
      "x-axion-signature": signature,
    },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 * 1000);
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", SECRET);
  vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "");
  vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  avisPublies.mockReset();
  avisPublies.mockResolvedValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("GET /api/interne/reglages-publics", () => {
  it("non signé (signature fausse) → 401", async () => {
    const r = await GET(requete({ signature: "v1=" + "0".repeat(64) }));
    expect(r.status).toBe(401);
  });

  it("sans en-têtes → 400", async () => {
    const r = await GET(new NextRequest(`http://localhost${CHEMIN}`));
    expect(r.status).toBe(400);
  });

  it("signé → les quatre booléens, ET RIEN D'AUTRE (clés figées)", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    avisPublies.mockResolvedValue(true);
    const r = await GET(requete());
    expect(r.status).toBe(200);
    const j = (await r.json()) as Record<string, unknown>;
    expect(Object.keys(j).sort()).toEqual(
      [
        "avisPublies",
        "luLe",
        "ofPublicDisclosure",
        "qualiopiCertificationObtenue",
        "schemaVersion",
        "videosSiteActives",
      ].sort(),
    );
    expect(j).toMatchObject({
      schemaVersion: 1,
      qualiopiCertificationObtenue: true,
      ofPublicDisclosure: true,
      avisPublies: true,
      videosSiteActives: true,
    });
    expect(new Date(String(j.luLe)).getTime()).toBe(T0 * 1000);
  });

  it("avisPublies suit avisPublies() (false)", async () => {
    avisPublies.mockResolvedValue(false);
    const j = (await (await GET(requete())).json()) as Record<string, unknown>;
    expect(j.avisPublies).toBe(false);
  });

  it("les réglages sont lus au runtime : divulgation OF éteinte → false", async () => {
    vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "false");
    const j = (await (await GET(requete())).json()) as Record<string, unknown>;
    expect(j.ofPublicDisclosure).toBe(false);
    expect(j.qualiopiCertificationObtenue).toBe(false);
  });

  it("jamais en cache, jamais indexé", async () => {
    const r = await GET(requete());
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("x-robots-tag")).toMatch(/noindex/);
  });

  it("la signature d'un autre chemin ne passe pas", async () => {
    const signature = signerRequete({
      secret: SECRET,
      horodatage: String(T0),
      nonce: NONCE,
      methode: "GET",
      chemin: "/api/interne/videos",
      corps: "",
    });
    expect((await GET(requete({ signature }))).status).toBe(401);
  });

  it("n'écrit rien en base (le nonce d'une lecture n'est pas journalisé)", async () => {
    // Aucun mock Prisma : si la route touchait la base, ce test échouerait à l'import.
    expect((await GET(requete())).status).toBe(200);
  });
});
