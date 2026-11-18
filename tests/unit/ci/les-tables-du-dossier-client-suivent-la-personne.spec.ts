/**
 * ⛔ LES TABLES DU DOSSIER CLIENT SUIVENT LA PERSONNE — garde RGPD INVERSÉE
 * (chantier visio, PR 2 ; plan §3.15, ADR 0056).
 *
 * La garde existante `rgpd-aucune-table-n-echappe-en-silence` part des
 * colonnes d'ADRESSE. Or le dossier client porte des paroles, des faits, des
 * citations — de la donnée personnelle SANS colonne d'adresse. Cette garde
 * part donc de l'autre bout : du MODÈLE.
 *
 * Règle : tout modèle créé par la migration du chantier ou par une migration
 * POSTÉRIEURE (ou pas encore migré) porte, dans ses commentaires `///` :
 *   · `rgpd: dossier-client` — il est alors LU par l'export art. 15
 *     (`src/lib/rgpd-dossier-client.ts`, appelé par la route) ET MUTÉ par
 *     l'effacement (`src/lib/rgpd-erase.ts`), ou figure dans leur liste
 *     d'exclusions DÉCLARÉES, avec un motif ;
 *   · ou `rgpd: technique — <motif>` : il ne porte rien sur une personne, et
 *     le motif le dit.
 *
 * Les modèles plus anciens (dont `PartnersSyncOutbox` de #1180, migration du
 * 26/09) sont exemptés PAR LA DATE DE LEUR MIGRATION, lue dans
 * `prisma/migrations/` — pas par une liste écrite à la main, qui prendrait du
 * retard.
 *
 * Contre-témoin : on retire l'annotation de `TranscriptionSegment` dans une
 * copie du schéma → la garde la signale.
 * Angle mort avoué : la garde vérifie qu'un modèle est MENTIONNÉ par l'export
 * et l'effacement, pas que chaque colonne y est traitée ; ce sont les tests de
 * comportement (`l-export-ne-contient-que-les-paroles-du-demandeur`,
 * `un-effacement-cible-…`) qui le font, table par table.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATION_VISIO } from "../../../prisma/objets-sql-bruts";
import { lire, lireModeles, RACINE, type ModeleLu } from "./sources-du-circuit-visio";

const MODULE_EXPORT = "src/lib/rgpd-dossier-client.ts";
// Le réseau d'apporteurs a son propre module d'export (il déchiffre ses champs, ce que le circuit de la parole interdit à `rgpd-dossier-client.ts`) : même export art. 15, deux fichiers.
const MODULE_EXPORT_RESEAU = "src/lib/rgpd-reseau-apporteur.ts";
// Page « Recevoir le guide » (lot S2) : son export déchiffre le prénom, comme le réseau d'apporteurs.
const MODULE_EXPORT_GUIDE_RESEAU = "src/lib/rgpd-guide-reseau.ts";
const MODULE_EFFACEMENT = "src/lib/rgpd-erase.ts";
const ROUTE_EXPORT = "src/app/api/gdpr-export/route.ts";

/** Date (AAAAMMJJHHMMSS) de la migration qui crée chaque table. */
function migrationDeCreation(): Map<string, string> {
  const dossier = path.join(RACINE, "prisma", "migrations");
  const out = new Map<string, string>();
  const noms = readdirSync(dossier)
    .filter((n) => /^\d{14}_/.test(n))
    .sort();
  for (const nom of noms) {
    let sql: string;
    try {
      sql = readFileSync(path.join(dossier, nom, "migration.sql"), "utf8");
    } catch {
      continue;
    }
    for (const m of sql.matchAll(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"?public"?\.)?"?([a-z0-9_]+)"?\s*\(/gi,
    )) {
      const table = m[1] as string;
      if (!out.has(table)) out.set(table, nom.slice(0, 14));
    }
  }
  return out;
}

const SEUIL = MIGRATION_VISIO.slice(0, 14);

function enPerimetre(m: ModeleLu, creations: Map<string, string>): boolean {
  const creee = creations.get(m.table);
  return creee === undefined || creee >= SEUIL;
}

function lit(source: string, accesseur: string): boolean {
  return new RegExp(`\\.${accesseur}\\.(findMany|findFirst|findUnique)\\b`).test(source);
}
function mute(source: string, accesseur: string): boolean {
  return new RegExp(`\\.${accesseur}\\.(updateMany|deleteMany|update|delete)\\b`).test(source);
}
function declare(source: string, modele: string): boolean {
  return new RegExp(`modele:\\s*"${modele}"`).test(source);
}

/** Une table « sans écrivain » : modèle Prisma, nom SQL et relations qui y mènent (écriture imbriquée). */
interface TableSansEcrivain {
  readonly modele: string;
  readonly table: string;
  /** Champs de relation des AUTRES modèles vers celui-ci (`emailsManuels`, `piecesJointes`…). */
  readonly relations?: readonly string[];
}

/**
 * Ce qui écrit dans une table « sans écrivain », sous toutes ses formes :
 *   · appel Prisma, avec blanc ou saut de ligne avant les points (`prisma\n  .emailManuel\n  .create(`),
 *     `create`, `createMany`, `createManyAndReturn`, `upsert`, `update`, `updateMany` ;
 *   · création imbriquée par une relation (`emailsManuels: { create`, `connectOrCreate`…) ;
 *   · SQL brut `INSERT INTO` / `UPDATE`, en minuscules, avec ou sans guillemets, schéma optionnel.
 * ⚠️ `String.raw` : sans lui `\b` devient un retour arrière et `\.` un simple point (défaut de la
 * version précédente : un appel Prisma n'était jamais détecté).
 */
function regexEcrivain(liste: readonly TableSansEcrivain[]): RegExp {
  if (liste.length === 0) return /(?!)/;
  const accesseurs = liste.map((t) => t.modele.charAt(0).toLowerCase() + t.modele.slice(1));
  const relations = liste.flatMap((t) => t.relations ?? []);
  const formes = [
    String.raw`\.\s*(?:${accesseurs.join("|")})\s*\.\s*(?:createManyAndReturn|createMany|create|upsert|updateMany|update)\b`,
    String.raw`(?:insert\s+into|update)\s+(?:"?public"?\s*\.\s*)?"?(?:${liste.map((t) => t.table).join("|")})\b`,
  ];
  if (relations.length > 0) {
    formes.push(
      String.raw`\b(?:${relations.join("|")})\s*:\s*\{\s*(?:createMany|create|connectOrCreate|upsert)\b`,
    );
  }
  return new RegExp(formes.join("|"), "i");
}

function fautes(
  modeles: readonly ModeleLu[],
  creations: Map<string, string>,
  sources: { exporte: string; efface: string },
): string[] {
  const out: string[] = [];
  for (const m of modeles.filter((x) => enPerimetre(x, creations))) {
    if (m.annotation === null) {
      out.push(`${m.nom} : aucune annotation « rgpd: dossier-client » ni « rgpd: technique — … »`);
      continue;
    }
    if (m.annotation === "technique" && m.motif === "") {
      out.push(`${m.nom} : « rgpd: technique » sans motif (« rgpd: technique — <motif> »)`);
    }
    if (m.annotation === "dossier-client") {
      if (!lit(sources.exporte, m.accesseur) && !declare(sources.exporte, m.nom)) {
        out.push(`${m.nom} : ni lu par l'export art. 15 (${MODULE_EXPORT}) ni déclaré exclu`);
      }
      if (!mute(sources.efface, m.accesseur) && !declare(sources.efface, m.nom)) {
        out.push(`${m.nom} : ni effacé (${MODULE_EFFACEMENT}) ni déclaré en exception`);
      }
    }
  }
  return out;
}

describe("les tables du dossier client suivent la personne", () => {
  const creations = migrationDeCreation();
  const modeles = lireModeles();
  const sources = {
    exporte: lire(MODULE_EXPORT) + lire(MODULE_EXPORT_RESEAU) + lire(MODULE_EXPORT_GUIDE_RESEAU),
    efface: lire(MODULE_EFFACEMENT),
  };

  it("la garde regarde bien les tables du chantier (sinon elle serait verte pour rien)", () => {
    const vus = modeles.filter((m) => enPerimetre(m, creations)).map((m) => m.nom);
    for (const attendu of ["Fait", "TranscriptionSegment", "ClientContact", "Rencontre"]) {
      expect(vus).toContain(attendu);
    }
    // Et elle n'emporte pas le schéma entier : les modèles anciens sont exemptés.
    expect(vus).not.toContain("Client");
    expect(vus).not.toContain("CalendlyEvent");
  });

  it("aucun modèle récent n'échappe à l'export ni à l'effacement", () => {
    expect(
      fautes(modeles, creations, sources),
      "un modèle récent doit dire ce qu'il devient pour la personne (plan §3.15) :",
    ).toEqual([]);
  });

  it("une exception « sans écrivain » n'a pas d'écrivain", () => {
    const src = lire(MODULE_EFFACEMENT);
    const sansEcrivain = [
      ...src.matchAll(/modele:\s*"(\w+)",\s*motif:\s*((?:"[^"\n]*"\s*\+?\s*)+)/g),
    ].filter((m) => (m[2] as string).includes("sans écrivain"));
    // Lot A1 (2026-10-29) : plus aucune table n'est « sans écrivain » (ClientTache est neutralisée
    // par l'effacement ; notes, profil, étiquettes sont des exclusions motivées). Une future table
    // créée par migration seule s'ajoute à `TABLES_SANS_ECRIVAIN` ET à une exception « sans écrivain ».
    // Paires { modele, table } : `table` = nom `@@map` du modèle (pour détecter aussi le SQL brut).
    // Lot S2 (2026-11-08) : `contacts_guide_reseau` a maintenant un écrivain (la page « Recevoir le
    // guide ») ; son export (`rgpd-guide-reseau.ts`) et sa mise à l'écart (`rgpd-erase.ts`) sont réels.
    // Lot I4, fiche F1b : les deux tables des e-mails écrits à la main ont leur export (art. 15) et
    // leur traitement d'effacement réels ; la liste est donc vide. Une future table créée par
    // migration seule s'ajoute ICI (avec ses relations) ET à une exception « sans écrivain ».
    const TABLES_SANS_ECRIVAIN: readonly TableSansEcrivain[] = [];
    expect(sansEcrivain.map((m) => m[1]).sort()).toEqual(
      TABLES_SANS_ECRIVAIN.map((t) => t.modele).sort(),
    );
    const ecrivain = regexEcrivain(TABLES_SANS_ECRIVAIN);
    const fichiers: string[] = [];
    const marche = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "__tests__" && e.name !== "node_modules") marche(p);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(spec|test)\.tsx?$/.test(e.name)) {
          fichiers.push(p);
        }
      }
    };
    marche(path.join(RACINE, "src"));
    const fautifs = fichiers.filter((f) => ecrivain.test(readFileSync(f, "utf8")));
    expect(
      fautifs,
      "du code écrit dans une table déclarée « sans écrivain » : brancher l'export et l'effacement réels, puis retirer l'exception",
    ).toEqual([]);
  });

  describe("contre-témoins : la détection d'écrivain voit chaque forme d'écriture, jamais une lecture", () => {
    const re = regexEcrivain([
      {
        modele: "EmailManuel",
        table: "emails_manuels",
        relations: ["emailsManuels"],
      },
      {
        modele: "EmailManuelPieceJointe",
        table: "emails_manuels_pieces_jointes",
        relations: ["piecesJointes"],
      },
    ]);
    const ECRITURES: ReadonlyArray<readonly [string, string]> = [
      ["create", "await tx.emailManuel.create({ data })"],
      ["updateMany", "await prisma.emailManuel.updateMany({"],
      ["createMany", "await tx.emailManuelPieceJointe.createMany({ data })"],
      ["createManyAndReturn", "await tx.emailManuel.createManyAndReturn({ data })"],
      ["upsert", "await tx.emailManuel.upsert({"],
      ["blanc avant le point", "await prisma.emailManuel .create({ data })"],
      ["saut de ligne avant le point", "await prisma\n  .emailManuel\n  .create({ data })"],
      ["saut de ligne après le point", "await prisma.\n  emailManuel.\n  create({ data })"],
      [
        "création imbriquée (e-mail)",
        "client.update({ data: { emailsManuels: { create: { a } } } })",
      ],
      [
        "création imbriquée (pièce)",
        "emailManuel: {\n piecesJointes:\n {\n createMany: { data } } }",
      ],
      ["SQL brut guillemets", 'INSERT INTO "emails_manuels" ("id")'],
      ["SQL brut minuscules sans guillemets", "insert into emails_manuels (id) values (1)"],
      ["SQL brut avec schéma", 'insert  into "public"."emails_manuels_pieces_jointes" (id)'],
      ["SQL brut update", "update emails_manuels set objet = 'x'"],
    ];
    for (const [forme, code] of ECRITURES) {
      it(`voit : ${forme}`, () => expect(re.test(code), code).toBe(true));
    }
    const LECTURES: ReadonlyArray<string> = [
      "await prisma.emailManuel.findMany({",
      "await prisma.emailManuelPieceJointe.count({",
      "include: { emailsManuels: { select: { id: true } } }",
      'SELECT * FROM "emails_manuels"',
    ];
    for (const code of LECTURES) {
      it(`ne voit pas : ${code}`, () => expect(re.test(code), code).toBe(false));
    }
    it("une liste vide ne détecte rien", () => {
      expect(regexEcrivain([]).test("await tx.emailManuel.create({})")).toBe(false);
    });
  });

  it("la route d'export appelle bien le module du dossier client", () => {
    expect(lire(ROUTE_EXPORT)).toContain("@/lib/rgpd-dossier-client");
    expect(lire(ROUTE_EXPORT)).toMatch(/exporterDossierClientPour\(email\)/);
  });

  it("fiche F1b — la route d'effacement n'appelle pas le traitement manuel des e-mails écrits à la main", () => {
    // Geste du fondateur seulement : `neutraliserEmailsManuelsPour` n'est appelée par aucune route.
    const route = lire("src/app/api/gdpr-erase/route.ts");
    expect(route).not.toContain("neutraliserEmailsManuelsPour");
    expect(lire(MODULE_EFFACEMENT)).toMatch(/export async function neutraliserEmailsManuelsPour\b/);
  });

  it("11/11/2026 — la route d'effacement n'efface plus le dossier client (mise à l'écart)", () => {
    // Décision de Williams : une demande d'effacement écarte la personne, ne supprime rien.
    // `effacerCibleParAdresses` reste l'outil du geste humain.
    const route = lire("src/app/api/gdpr-erase/route.ts");
    expect(route).not.toMatch(/effacerCibleParAdresses\(\[email\]/);
    expect(route).toContain("ecarterPourDemandeEffacement(");
  });

  it("contre-témoin : sans son annotation, TranscriptionSegment est signalé", () => {
    const schema = lire("prisma/schema.prisma");
    const coupe = schema.replace(
      /(\/\/\/ Un segment de parole\. `texte` chiffré\.\r?\n)\/\/\/ rgpd: dossier-client\r?\n/,
      "$1",
    );
    expect(coupe).not.toBe(schema);
    expect(fautes(lireModeles(coupe), creations, sources)).toEqual([
      "TranscriptionSegment : aucune annotation « rgpd: dossier-client » ni « rgpd: technique — … »",
    ]);
  });

  it("contre-témoin : un modèle dossier-client que personne ne traite est signalé", () => {
    const fictif = lireModeles(
      `/// rgpd: dossier-client\nmodel NoteFictive {\n  id String @id\n  @@map("notes_fictives")\n}\n`,
    );
    expect(fautes(fictif, creations, sources)).toHaveLength(2);
  });
});
