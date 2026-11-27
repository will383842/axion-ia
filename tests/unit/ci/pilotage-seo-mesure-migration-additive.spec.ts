/**
 * PILOTAGE SEO, PR P2 — la migration « mesure » est ADDITIVE.
 * Sept tables neuves, aucune colonne ajoutée à une table existante, aucune clé étrangère, aucune
 * énumération Postgres, aucun DROP / DELETE / UPDATE / ALTER. Compatible avec les deux conteneurs
 * (app et worker) : rien ne lit ces tables dans cette PR.
 *
 * Les règles de la migration ont leur CONTRE-TÉMOIN (texte muté qui doit faire rougir la même fonction).
 * Le test du Proxy du stub prouve qu'il est générique, pas que chaque accesseur existe (le typecheck le fait).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const RACINE = process.cwd();
const NOM = "20261127230000_pilotage_seo_mesure";
const TABLES = [
  "gsc_import_runs",
  "gsc_page_jours",
  "gsc_requetes",
  "gsc_page_requete_jours",
  "gsc_page_requete_semaines",
  "gsc_inspections",
  "seo_opportunites",
];
const MODELES = [
  "GscImportRun",
  "GscPageJour",
  "GscRequete",
  "GscPageRequeteJour",
  "GscPageRequeteSemaine",
  "GscInspection",
  "SeoOpportunite",
];

const sqlBrut = readFileSync(
  path.join(RACINE, "prisma", "migrations", NOM, "migration.sql"),
  "utf8",
);
const schema = readFileSync(path.join(RACINE, "prisma", "schema.prisma"), "utf8");

const sansCommentaires = (sql: string): string => sql.replace(/--.*$/gm, "");
const nomTable = (brut: string): string =>
  brut
    .replace(/^public\./i, "")
    .replace(/"/g, "")
    .toLowerCase();

/** Fautes de la migration (liste vide = additive). */
function fautesMigration(brut: string): string[] {
  const fautes: string[] = [];
  const sql = sansCommentaires(brut);
  if (/\b(DROP|DELETE|UPDATE|TRUNCATE|INSERT|CREATE\s+TYPE|ALTER)\b/i.test(sql)) {
    fautes.push("instruction destructrice, d'écriture ou ALTER");
  }
  if (/\bREFERENCES\b|\bFOREIGN\s+KEY\b/i.test(sql)) fautes.push("clé étrangère");
  const creees = [
    ...sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"?public"?\.)?"?[A-Za-z0-9_]+"?)/gi,
    ),
  ]
    .map((m) => nomTable(m[1] as string))
    .sort();
  if (JSON.stringify(creees) !== JSON.stringify([...TABLES].sort())) {
    fautes.push(`tables créées : ${creees.join(",")}`);
  }
  const index = [
    ...sql.matchAll(
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?[A-Za-z0-9_]+"?\s+ON\s+((?:"?public"?\.)?"?[A-Za-z0-9_]+"?)/gi,
    ),
  ].map((m) => nomTable(m[1] as string));
  for (const t of index)
    if (!TABLES.includes(t)) fautes.push(`index sur une table existante : ${t}`);
  if (/CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\s+(?!IF\s+NOT\s+EXISTS)/i.test(sql)) {
    fautes.push("création non rejouable (IF NOT EXISTS manquant)");
  }
  return fautes;
}

function corpsModele(nom: string): string {
  const m = schema.match(
    new RegExp(String.raw`(?:^|\n)((?:///[^\n]*\n)*)model ${nom} \{([\s\S]*?)\n\}`),
  );
  if (!m) throw new Error(`modèle absent : ${nom}`);
  return `${m[1]}\n${m[2]}`;
}

describe("pilotage SEO P2 — migration additive", () => {
  it("la migration est additive", () => {
    expect(fautesMigration(sqlBrut)).toEqual([]);
  });

  it.each([
    ["un DROP", `${sqlBrut}\nDROP TABLE "clients";`],
    ["un ALTER", `${sqlBrut}\nALTER TABLE "site_routes" ADD COLUMN "x" TEXT;`],
    ["un ALTER … DROP", `${sqlBrut}\nALTER TABLE "gsc_page_jours" DROP COLUMN "clics";`],
    ["un DELETE", `${sqlBrut}\nDELETE FROM "gsc_requetes";`],
    [
      "une clé étrangère dans un CREATE TABLE",
      sqlBrut.replace(
        '"site_route_id" TEXT,',
        '"site_route_id" TEXT REFERENCES "site_routes"("id"),',
      ),
    ],
    [
      "un index sur une table existante",
      `${sqlBrut}\nCREATE INDEX IF NOT EXISTS "z" ON "site_routes"("id");`,
    ],
    [
      "une table non rejouable",
      sqlBrut.replace('CREATE TABLE IF NOT EXISTS "gsc_requetes"', 'CREATE TABLE "gsc_requetes"'),
    ],
  ])("contre-témoin : %s fait rougir", (_n, texte) => {
    expect(fautesMigration(texte).length).toBeGreaterThan(0);
  });

  it("contre-témoin : la règle « clé étrangère » est la seule à rougir sur une FK en CREATE", () => {
    const muté = sqlBrut.replace(
      '"site_route_id" TEXT,',
      '"site_route_id" TEXT REFERENCES "site_routes"("id"),',
    );
    expect(muté).not.toBe(sqlBrut);
    expect(fautesMigration(muté)).toEqual(["clé étrangère"]);
  });

  it("le SQL ne contient aucune énumération et aucun trigger", () => {
    expect(sansCommentaires(sqlBrut)).not.toMatch(/CREATE\s+TYPE|CREATE\s+TRIGGER/i);
  });
});

describe("pilotage SEO P2 — schéma Prisma", () => {
  it("les sept modèles existent et portent une annotation rgpd technique motivée", () => {
    for (const nom of MODELES) {
      expect(corpsModele(nom), nom).toMatch(/\/\/\/ rgpd: technique — \S+/);
    }
  });

  it("les clés d'idempotence et les index sont présents", () => {
    const attendu: Record<string, string[]> = {
      GscImportRun: ["@@unique([jour, typeRecherche]"],
      GscPageJour: ["@@unique([date, typeRecherche, chemin]", "@@index([chemin, date]"],
      GscRequete: ["@unique", "@@index([derniereLe]"],
      GscPageRequeteJour: [
        "@@unique([date, typeRecherche, chemin, requeteId]",
        "@@index([requeteId, date]",
      ],
      GscPageRequeteSemaine: ["@@unique([semaine, typeRecherche, chemin, requeteId]"],
      GscInspection: ["@@index([chemin, inspecteLe]"],
      SeoOpportunite: ["@@unique([semaine, detecteur, cible]", "@@index([etat, priorite]"],
    };
    for (const [nom, motifs] of Object.entries(attendu)) {
      const corps = corpsModele(nom).replace(/[ \t]+/g, " ");
      for (const m of motifs) expect(corps, `${nom} : ${m}`).toContain(m.replace(/[ \t]+/g, " "));
    }
  });

  it("aucune relation (@relation) dans les sept modèles : pas de clé étrangère", () => {
    for (const nom of MODELES) {
      expect(corpsModele(nom), nom).not.toMatch(/@relation/);
    }
  });

  it("siteRouteId est nullable, sans clé étrangère", () => {
    for (const nom of ["GscPageJour", "GscInspection", "SeoOpportunite"]) {
      expect(corpsModele(nom), nom).toMatch(/siteRouteId\s+String\?/);
    }
  });

  it("chaque table du schéma est créée par la migration, et seulement celles-là", () => {
    const maps = MODELES.map((n) => corpsModele(n).match(/@@map\("([^"]+)"\)/)?.[1]).sort();
    expect(maps).toEqual([...TABLES].sort());
  });

  it("le bloc ajouté est annoncé par un en-tête distinct en fin de fichier", () => {
    expect(schema).toContain("PILOTAGE SEO & GEO — couche « mesure » (PR P2");
    expect(schema.lastIndexOf("model SeoOpportunite")).toBeGreaterThan(
      schema.indexOf("PILOTAGE SEO & GEO"),
    );
  });
});

describe("pilotage SEO P2 — Proxy du stub Prisma (build GH Actions)", () => {
  const avant = process.env.DATABASE_URL;
  afterEach(() => {
    if (avant === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = avant;
    vi.resetModules();
  });

  it("le Proxy générique répond à vide (groupBy, aggregate) sur les accesseurs des sept modèles ; une mutation lève", async () => {
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    vi.resetModules();
    const { prisma } = (await import("@/lib/prisma")) as unknown as {
      prisma: Record<string, Record<string, (a?: unknown) => Promise<unknown>>>;
    };
    const accesseurs = [
      "gscImportRun",
      "gscPageJour",
      "gscRequete",
      "gscPageRequeteJour",
      "gscPageRequeteSemaine",
      "gscInspection",
      "seoOpportunite",
    ];
    for (const a of accesseurs) {
      const m = prisma[a] as Record<string, (x?: unknown) => Promise<unknown>>;
      await expect(m.groupBy!({ by: ["id"] })).resolves.toEqual([]);
      await expect(m.aggregate!({ _sum: { id: true } })).resolves.toEqual({ _count: { _all: 0 } });
      await expect(m.findMany!()).resolves.toEqual([]);
      await expect(m.create!({ data: {} })).rejects.toThrow(/stub/);
    }
  });
});
