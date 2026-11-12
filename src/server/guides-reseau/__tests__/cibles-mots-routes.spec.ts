// @vitest-environment node
// F1a-bis — catalogue de cibles (guides + adresses) et liaisons mot → cible, tout en base.
// Base EN MÉMOIRE, aucun réseau. Aucune adresse ni chemin de PDF ne sort du catalogue.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";

const { cibles, mots } = vi.hoisted(() => ({
  cibles: [] as Record<string, unknown>[],
  mots: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cibleReseau: {
      findMany: async () =>
        cibles.map((c) => ({
          code: c.code,
          type: c.type,
          titre: c.titre,
          actif: c.actif,
          test: c.test,
        })),
      findUnique: async ({ where }: { where: { code: string } }) =>
        cibles.find((c) => c.code === where.code) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { code: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const e = cibles.find((c) => c.code === where.code);
        if (e) Object.assign(e, update);
        else cibles.push({ test: false, version: 1, actif: true, ...create });
      },
    },
    motCible: {
      findMany: async () => mots.map((m) => ({ ...m })),
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { mot_reseau: { mot: string; reseau: string } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const { mot, reseau } = where.mot_reseau;
        const e = mots.find((m) => m.mot === mot && m.reseau === reseau);
        if (e) Object.assign(e, update);
        else mots.push({ actif: true, ...create });
      },
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));

import { GET as GET_CATALOGUE } from "@/app/api/interne/catalogue-reseau/route";
import { POST as POST_CIBLE } from "@/app/api/interne/cibles-reseau/route";
import { GET as GET_MOTS, POST as POST_MOT } from "@/app/api/interne/mots-cibles/route";
import { signerRequete } from "@/server/videos/signature";

const SECRET = "s".repeat(40);
const CH = {
  catalogue: "/api/interne/catalogue-reseau",
  cible: "/api/interne/cibles-reseau",
  mots: "/api/interne/mots-cibles",
};

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
type Opt = { sansSignature?: boolean; secret?: string; decalage?: number };
const lire = (handler: typeof GET_CATALOGUE, chemin: string, o: Opt = {}) =>
  handler(
    new NextRequest(`http://localhost${chemin}`, {
      method: "GET",
      headers: o.sansSignature ? {} : signer("GET", chemin, "", o),
    }),
  );
const ecrire = (handler: typeof POST_CIBLE, chemin: string, corps: unknown, o: Opt = {}) => {
  const texte = JSON.stringify(corps);
  return handler(
    new NextRequest(`http://localhost${chemin}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(o.sansSignature ? {} : signer("POST", chemin, texte, o)),
      },
      body: texte,
    }),
  );
};
const cible = (c: unknown, o: Opt = {}) => ecrire(POST_CIBLE, CH.cible, c, o);
const mot = (c: unknown, o: Opt = {}) => ecrire(POST_MOT, CH.mots, c, o);

const adresse = {
  type: "adresse",
  titre: "Offre de rentrée",
  url: "https://axion-ia.com/fr/offre",
};
const guide = { type: "guide", titre: "Guide second", cheminPdf: "imprimes/second.pdf" };

beforeEach(() => {
  cibles.length = 0;
  mots.length = 0;
  vi.stubEnv("GUIDES_RESEAU_ENABLED", "true");
  vi.stubEnv("GUIDES_RESEAU_HMAC_SECRET", SECRET);
  vi.stubEnv("CIBLES_ADRESSES_HOTES", "");
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/x");
});
afterEach(() => vi.unstubAllEnvs());

describe("interrupteur et signature (les quatre handlers)", () => {
  it("404 si GUIDES_RESEAU_ENABLED n'est pas vrai", async () => {
    vi.stubEnv("GUIDES_RESEAU_ENABLED", "false");
    expect((await lire(GET_CATALOGUE, CH.catalogue)).status).toBe(404);
    expect((await lire(GET_MOTS, CH.mots)).status).toBe(404);
    expect((await cible(adresse)).status).toBe(404);
    expect((await mot({ mot: "ia", reseau: "tous", codeCible: "gde-abcdef" })).status).toBe(404);
    expect(cibles).toHaveLength(0);
  });
  it.each([
    ["absente", { sansSignature: true }],
    ["fausse", { secret: "x".repeat(40) }],
    ["expirée", { decalage: -3600 }],
  ])("signature %s → 401, rien écrit", async (_n, o) => {
    expect((await lire(GET_CATALOGUE, CH.catalogue, o)).status).toBe(401);
    expect((await lire(GET_MOTS, CH.mots, o)).status).toBe(401);
    expect((await cible(adresse, o)).status).toBe(401);
    expect((await mot({ mot: "ia", reseau: "tous", codeCible: "gde-abcdef" }, o)).status).toBe(401);
    expect(cibles).toHaveLength(0);
    expect(mots).toHaveLength(0);
  });
});

describe("POST /cibles-reseau", () => {
  it("adresse valide : enregistrée, code adr-, listée sans son adresse", async () => {
    const r = await cible(adresse);
    expect(r.status).toBe(200);
    const { code } = (await r.json()) as { code: string };
    expect(code).toMatch(/^adr-[a-z0-9-]{6,24}$/);
    const liste = (await (await lire(GET_CATALOGUE, CH.catalogue)).json()) as unknown[];
    expect(liste).toContainEqual({
      code,
      type: "adresse",
      titre: "Offre de rentrée",
      actif: true,
      test: false,
    });
    expect(JSON.stringify(liste)).not.toMatch(/http|axion-ia\.com|pdf/);
  });
  it("guide valide : code gde-, chemin du PDF jamais rendu", async () => {
    const { code } = (await (await cible(guide)).json()) as { code: string };
    expect(code).toMatch(/^gde-[a-z0-9-]{6,24}$/);
    const txt = JSON.stringify(await (await lire(GET_CATALOGUE, CH.catalogue)).json());
    expect(txt).toContain(code);
    expect(txt).not.toMatch(/pdf|imprimes/);
  });
  it("sans limite de nombre : 30 guides et 30 adresses", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await cible({ ...guide, titre: `Guide numéro ${i}` })).status).toBe(200);
      expect((await cible({ ...adresse, titre: `Adresse numéro ${i}` })).status).toBe(200);
    }
    expect(cibles).toHaveLength(60);
  });
  it("mise à jour par code : un seul enregistrement, fiche de test marquée", async () => {
    await cible({ ...adresse, code: "adr-offre01" });
    await cible({ ...adresse, titre: "Offre bis", code: "adr-offre01", test: true, actif: false });
    expect(cibles).toHaveLength(1);
    expect(cibles[0]).toMatchObject({ titre: "Offre bis", test: true, actif: false });
  });
  it.each([
    ["guide avec url", { ...guide, url: "https://axion-ia.com/x" }],
    ["adresse avec cheminPdf", { ...adresse, cheminPdf: "imprimes/x.pdf" }],
    ["guide sans cheminPdf", { type: "guide", titre: "Guide sans pdf" }],
    ["adresse sans url", { type: "adresse", titre: "Adresse sans url" }],
    ["type inconnu", { ...adresse, type: "video" }],
    ["chemin hors dossier", { ...guide, cheminPdf: "../secret.pdf" }],
    ["http", { ...adresse, url: "http://axion-ia.com/x" }],
    ["identifiant", { ...adresse, url: "https://u:p@axion-ia.com/x" }],
    ["trop longue", { ...adresse, url: `https://axion-ia.com/${"a".repeat(300)}` }],
    ["hôte hors liste", { ...adresse, url: "https://evil.test/x" }],
    ["port inhabituel", { ...adresse, url: "https://axion-ia.com:8443/x" }],
    ["code mal formé", { ...adresse, code: "adr-ab" }],
    ["préfixe ne correspond pas au type", { ...adresse, code: "gde-abcdef" }],
    ["titre trop court", { ...adresse, titre: "ab" }],
    ["champ inconnu", { ...adresse, extra: 1 }],
  ])("refuse : %s (422, rien enregistré)", async (_n, corps) => {
    expect((await cible(corps)).status).toBe(422);
    expect(cibles).toHaveLength(0);
  });
  it("hôte ajouté par CIBLES_ADRESSES_HOTES accepté", async () => {
    vi.stubEnv("CIBLES_ADRESSES_HOTES", "partenaire.test");
    expect((await cible({ ...adresse, url: "https://partenaire.test/p" })).status).toBe(200);
    expect((await cible(adresse)).status).toBe(422);
  });
});

describe("mots → cibles", () => {
  beforeEach(async () => {
    await cible({ ...guide, code: "gde-un0001" });
    await cible({ ...adresse, code: "adr-deux02" });
  });
  it("PLUSIEURS mots peuvent mener à la MÊME cible", async () => {
    for (const m of ["Énergie", "solaire", "panneaux"]) {
      expect((await mot({ mot: m, reseau: "tous", codeCible: "gde-un0001" })).status).toBe(200);
    }
    expect(mots).toHaveLength(3);
    expect(mots.every((m) => m.codeCible === "gde-un0001")).toBe(true);
    expect(mots.map((m) => m.mot)).toContain("energie");
  });
  it("même mot + même réseau deux fois = mise à jour, pas doublon", async () => {
    await mot({ mot: "ia", reseau: "facebook", codeCible: "gde-un0001" });
    expect((await mot({ mot: "IA", reseau: "facebook", codeCible: "adr-deux02" })).status).toBe(
      200,
    );
    expect(mots).toHaveLength(1);
    expect(mots[0]!.codeCible).toBe("adr-deux02");
  });
  it("même mot sur deux réseaux = deux liaisons", async () => {
    await mot({ mot: "ia", reseau: "facebook", codeCible: "gde-un0001" });
    await mot({ mot: "ia", reseau: "tous", codeCible: "adr-deux02" });
    expect(mots).toHaveLength(2);
  });
  it("cible inconnue refusée", async () => {
    const r = await mot({ mot: "ia", reseau: "tous", codeCible: "gde-absent1" });
    expect(r.status).toBe(422);
    expect(mots).toHaveLength(0);
  });
  it("cible inactive refusée", async () => {
    await cible({ ...adresse, code: "adr-deux02", actif: false });
    expect((await mot({ mot: "ia", reseau: "tous", codeCible: "adr-deux02" })).status).toBe(422);
    expect(mots).toHaveLength(0);
  });
  it.each([
    ["mot trop court", { mot: "a", reseau: "tous", codeCible: "gde-un0001" }],
    ["mot avec espace", { mot: "deux mots", reseau: "tous", codeCible: "gde-un0001" }],
    ["réseau inconnu", { mot: "ia", reseau: "myspace", codeCible: "gde-un0001" }],
    ["champ inconnu", { mot: "ia", reseau: "tous", codeCible: "gde-un0001", x: 1 }],
  ])("refuse : %s (422)", async (_n, corps) => {
    expect((await mot(corps)).status).toBe(422);
    expect(mots).toHaveLength(0);
  });
  it("GET liste les liaisons mot → code, sans adresse", async () => {
    await mot({ mot: "ia", reseau: "tous", codeCible: "adr-deux02" });
    const liste = (await (await lire(GET_MOTS, CH.mots)).json()) as unknown[];
    expect(liste).toEqual([{ mot: "ia", reseau: "tous", codeCible: "adr-deux02", actif: true }]);
  });
});
