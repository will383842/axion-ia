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
    exporte: lire(MODULE_EXPORT) + lire(MODULE_EXPORT_RESEAU),
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

  it("la route d'export appelle bien le module du dossier client", () => {
    expect(lire(ROUTE_EXPORT)).toContain("@/lib/rgpd-dossier-client");
    expect(lire(ROUTE_EXPORT)).toMatch(/exporterDossierClientPour\(email\)/);
  });

  it("la route d'effacement appelle bien l'effacement du dossier client", () => {
    expect(lire("src/app/api/gdpr-erase/route.ts")).toMatch(/effacerCibleParAdresses\(\[email\]/);
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
