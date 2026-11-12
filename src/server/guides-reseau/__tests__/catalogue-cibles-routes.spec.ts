// @vitest-environment node
// F1a — `GET /api/interne/catalogue-reseau` et `POST /api/interne/cibles-adresses`.
// Base EN MÉMOIRE, aucun réseau. Une adresse enregistrée n'est JAMAIS rendue par le catalogue.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

const { lignes } = vi.hoisted(() => ({ lignes: [] as Record<string, unknown>[] }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleAdresse: {
      findMany: async ({
        where,
        select,
      }: {
        where: { actif: boolean };
        select: Record<string, boolean>;
      }) =>
        lignes
          .filter((l) => l.actif === where.actif)
          .map((l) => Object.fromEntries(Object.keys(select).map((k) => [k, l[k]]))),
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { code: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const existante = lignes.find((l) => l.code === where.code);
        if (existante) Object.assign(existante, update);
        else lignes.push({ ...create });
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true }),
}));

import { GET } from "@/app/api/interne/catalogue-reseau/route";
import { POST } from "@/app/api/interne/cibles-adresses/route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "s".repeat(40);
const CH_GET = "/api/interne/catalogue-reseau";
const CH_POST = "/api/interne/cibles-adresses";

function signer(
  methode: "GET" | "POST",
  chemin: string,
  corps: string,
  o: { secret?: string; decalage?: number } = {},
) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const horodatage = String(Math.floor(Date.now() / 1000) + (o.decalage ?? 0));
  const signature = signerRequete({
    secret: o.secret ?? SECRET,
    horodatage,
    nonce,
    methode,
    chemin,
    corps,
  });
  return {
    "x-axion-horodatage": horodatage,
    "x-axion-nonce": nonce,
    "x-axion-signature": signature,
  };
}
const lire = () =>
  GET(
    new NextRequest(`http://localhost${CH_GET}`, {
      method: "GET",
      headers: signer("GET", CH_GET, ""),
    }),
  );
function ecrire(
  corps: unknown,
  o: { sansSignature?: boolean; secret?: string; decalage?: number } = {},
) {
  const texte = JSON.stringify(corps);
  return POST(
    new NextRequest(`http://localhost${CH_POST}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(o.sansSignature ? {} : signer("POST", CH_POST, texte, o)),
      },
      body: texte,
    }),
  );
}
const valide = { titre: "Offre de rentrée", url: "https://axion-ia.com/fr/offre" };

beforeEach(() => {
  lignes.length = 0;
  vi.stubEnv("GUIDES_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  vi.stubEnv("CIBLES_ADRESSES_HOTES", "");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/x");
});
afterEach(() => vi.unstubAllEnvs());

describe("interrupteur", () => {
  it("404 si GUIDES_RESEAU_ENABLED n'est pas vrai, sur les deux routes", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "false");
    expect((await lire()).status).toBe(404);
    expect((await ecrire(valide)).status).toBe(404);
    expect(lignes).toHaveLength(0);
  });
});

describe("signature", () => {
  it("absente → 401", async () => {
    const g = await GET(new NextRequest(`http://localhost${CH_GET}`, { method: "GET" }));
    expect(g.status).toBe(401);
    expect((await ecrire(valide, { sansSignature: true })).status).toBe(401);
  });
  it("fausse → 401", async () => {
    const h = signer("GET", CH_GET, "", { secret: "x".repeat(40) });
    expect((await GET(new NextRequest(`http://localhost${CH_GET}`, { headers: h }))).status).toBe(
      401,
    );
    expect((await ecrire(valide, { secret: "x".repeat(40) })).status).toBe(401);
  });
  it("expirée → 401", async () => {
    const h = signer("GET", CH_GET, "", { decalage: -3600 });
    expect((await GET(new NextRequest(`http://localhost${CH_GET}`, { headers: h }))).status).toBe(
      401,
    );
    expect((await ecrire(valide, { decalage: -3600 })).status).toBe(401);
    expect(lignes).toHaveLength(0);
  });
});

describe("POST /cibles-adresses", () => {
  it("adresse valide : enregistrée, code rendu, puis listée sans son adresse", async () => {
    const r = await ecrire(valide);
    expect(r.status).toBe(200);
    const { code } = (await r.json()) as { code: string };
    expect(code).toMatch(/^adr-[a-z0-9-]{6,24}$/);
    const liste = (await (await lire()).json()) as Record<string, unknown>[];
    expect(liste).toContainEqual({ code, type: "adresse", titre: "Offre de rentrée", actif: true });
    expect(JSON.stringify(liste)).not.toContain("axion-ia.com");
    expect(JSON.stringify(liste)).not.toContain("http");
  });
  it("mise à jour par code : un seul enregistrement, désactivation retire de la liste", async () => {
    await ecrire({ ...valide, code: "adr-offre01" });
    await ecrire({ ...valide, titre: "Offre bis", code: "adr-offre01" });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]!.titre).toBe("Offre bis");
    await ecrire({ ...valide, code: "adr-offre01", actif: false });
    const liste = (await (await lire()).json()) as { type: string }[];
    expect(liste.filter((e) => e.type === "adresse")).toHaveLength(0);
  });
  it.each([
    ["http", { ...valide, url: "http://axion-ia.com/x" }],
    ["identifiant", { ...valide, url: "https://u:p@axion-ia.com/x" }],
    ["trop longue", { ...valide, url: `https://axion-ia.com/${"a".repeat(300)}` }],
    ["hôte hors liste", { ...valide, url: "https://evil.test/x" }],
    ["port inhabituel", { ...valide, url: "https://axion-ia.com:8443/x" }],
    ["code mal formé", { ...valide, code: "adr-ab" }],
    ["code sans préfixe", { ...valide, code: "guide-ia" }],
    ["titre trop court", { ...valide, titre: "ab" }],
    ["champ inconnu", { ...valide, extra: 1 }],
  ])("refuse : %s (422, rien enregistré)", async (_nom, corps) => {
    const r = await ecrire(corps);
    expect(r.status).toBe(422);
    expect(lignes).toHaveLength(0);
  });
  it("hôte ajouté par CIBLES_ADRESSES_HOTES accepté", async () => {
    vi.stubEnv("CIBLES_ADRESSES_HOTES", "partenaire.test");
    expect((await ecrire({ ...valide, url: "https://partenaire.test/p" })).status).toBe(200);
    expect((await ecrire(valide)).status).toBe(422);
  });
});

describe("GET /catalogue-reseau", () => {
  it("rend le guide du catalogue, sans adresse ni donnée de personne", async () => {
    const r = await lire();
    expect(r.status).toBe(200);
    const liste = (await r.json()) as unknown[];
    expect(liste).toEqual([
      { code: "guide-ia", type: "guide", titre: "Guide IA entreprise", actif: true },
    ]);
    expect(JSON.stringify(liste)).not.toMatch(/pdf|http|@/);
  });
});
