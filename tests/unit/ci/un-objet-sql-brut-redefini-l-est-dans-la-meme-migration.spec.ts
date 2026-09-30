/**
 * ⛔ UN OBJET SQL BRUT REDÉFINI L'EST DANS LA MÊME MIGRATION — ET SON MIROIR
 * SUIT SA DERNIÈRE DÉFINITION (chantier visio, correctif P-2, ADR 0061).
 *
 * `tout-objet-sql-brut-est-dans-une-migration.spec.ts` ne lit que la migration
 * qui a CRÉÉ le chantier. Depuis le 30/09, une migration postérieure redéfinit
 * un CHECK (`rencontres_test_interne_saisie`, élargi à Calendly). Deux défauts
 * deviennent alors possibles sans qu'aucune garde ne les voie :
 *   1. une migration qui SUPPRIME un objet déclaré sans le recréer (même nom,
 *      même table, après la suppression) : l'objet disparaît de la base, la
 *      liste `prisma/objets-sql-bruts.ts` continue de le promettre, et seule
 *      Gate D (sur base neuve) le verrait — trop tard pour la relecture ;
 *   2. le miroir en mémoire des tests (`_dossier-en-memoire.ts`) qui garde
 *      l'ANCIENNE règle : les tests refusent ce que la base accepte (ou
 *      l'inverse), et prouvent une règle qui n'existe plus.
 *
 * Mutations qui font rougir :
 *   · retirer l'`ADD CONSTRAINT` de la migration 20260930170000 → test 1 ;
 *   · remettre dans `_dossier-en-memoire.ts` le contrôle `source !==
 *     "saisie_manuelle"` seul → test 3 (Calendly refusé par le miroir).
 * Contre-témoins : une suppression orpheline fabriquée dans le texte est vue ;
 * la lecture du CHECK trouve bien les deux sources.
 * Angle mort : le miroir n'est comparé que pour ce CHECK (les autres n'ont
 * jamais été redéfinis) ; la base réelle reste prouvée par Gate D.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MIGRATION_VISIO, OBJETS_SQL_BRUTS } from "../../../prisma/objets-sql-bruts";
import { dossierEnMemoire } from "../../../src/features/dossier-client/__tests__/_dossier-en-memoire";
import { lire, RACINE } from "./sources-du-circuit-visio";

const DOSSIER = path.join(RACINE, "prisma", "migrations");

/** Les migrations postérieures à celle du chantier, dans l'ordre. */
const POSTERIEURES = readdirSync(DOSSIER)
  .filter((d) => /^\d{14}_/.test(d) && d > MIGRATION_VISIO)
  .sort();

function sansCommentairesSql(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

const NOMS_DECLARES = new Map(OBJETS_SQL_BRUTS.map((o) => [o.nom, o]));

/** Les objets déclarés supprimés par ce SQL sans être recréés après, sur leur table. */
function suppressionsOrphelines(sql: string): string[] {
  const actif = sansCommentairesSql(sql);
  const out: string[] = [];
  const suppressions = actif.matchAll(
    /(?:ALTER TABLE "([^"]+)" DROP CONSTRAINT|DROP (?:INDEX|TRIGGER))(?: IF EXISTS)? "([^"]+)"/g,
  );
  for (const m of suppressions) {
    const nom = m[2] as string;
    const objet = NOMS_DECLARES.get(nom);
    if (!objet) continue;
    const apres = actif.slice((m.index ?? 0) + m[0].length);
    const t = objet.table;
    const recree =
      new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${nom}" `).test(apres) ||
      new RegExp(`CREATE (?:UNIQUE )?INDEX "${nom}" ON "${t}"`).test(apres) ||
      new RegExp(`CREATE (?:CONSTRAINT )?TRIGGER "${nom}"[\\s\\S]*?\\bON "${t}"`).test(apres);
    if (!recree) out.push(nom);
  }
  return out;
}

/** La DERNIÈRE définition d'un CHECK, toutes migrations du chantier confondues. */
function derniereDefinition(nom: string): string {
  let def = "";
  for (const d of [MIGRATION_VISIO, ...POSTERIEURES]) {
    const actif = sansCommentairesSql(lire(`prisma/migrations/${d}/migration.sql`));
    for (const m of actif.matchAll(
      new RegExp(`ADD CONSTRAINT "${nom}" CHECK \\(([^;]*)\\);`, "g"),
    )) {
      def = m[1] as string;
    }
  }
  return def;
}

/** Les sources qu'un CHECK « NOT est_test_interne OR source … » admet. */
function sourcesAdmises(def: string): string[] {
  const m = /"source" (?:= '([a-z_]+)'|IN \(([^)]*)\))/.exec(def);
  if (!m) throw new Error(`définition illisible : ${def}`);
  if (m[1]) return [m[1]];
  return [...(m[2] as string).matchAll(/'([a-z_]+)'/g)].map((x) => x[1] as string).sort();
}

/** Les valeurs de l'énumération `RencontreSource`, lues dans le schéma. */
function sourcesDuSchema(): string[] {
  const schema = lire("prisma/schema.prisma");
  const bloc = /enum RencontreSource \{([\s\S]*?)\}/.exec(schema)?.[1] ?? "";
  return bloc
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

/** Le miroir en mémoire accepte-t-il une rencontre de test de cette source ? */
async function miroirAccepte(source: string): Promise<boolean> {
  const base = dossierEnMemoire({
    client: [{ id: "00000000-0000-4000-8000-0000000000c1", numero: "AXI-CLI-001" }],
  });
  try {
    await base.client.$transaction(async (tx) => {
      await (
        tx as never as { rencontre: { create: (a: unknown) => Promise<unknown> } }
      ).rencontre.create({
        data: {
          id: "00000000-0000-4000-8000-0000000000e1",
          source,
          type: "visio",
          titre: "Rencontre de test",
          estTestInterne: true,
          clientId: "00000000-0000-4000-8000-0000000000c1",
          rattachementStatut: "valide",
        },
      });
    });
    return true;
  } catch (e) {
    if (e instanceof Error && e.message === "rencontres_test_interne_saisie") return false;
    throw e;
  }
}

describe("⛔ un objet SQL brut redéfini l'est dans la même migration", () => {
  it("1. aucune migration postérieure ne supprime un objet déclaré sans le recréer", () => {
    expect(POSTERIEURES.length).toBeGreaterThan(0);
    const fautes = POSTERIEURES.flatMap((d) =>
      suppressionsOrphelines(lire(`prisma/migrations/${d}/migration.sql`)).map(
        (n) => `${d} : ${n}`,
      ),
    );
    expect(fautes, "objets déclarés supprimés sans être recréés :").toEqual([]);
  });

  it("contre-témoin : une suppression orpheline fabriquée est vue", () => {
    const sql =
      `ALTER TABLE "rencontres" DROP CONSTRAINT "rencontres_test_interne_saisie";\n` +
      `-- ALTER TABLE "rencontres" ADD CONSTRAINT "rencontres_test_interne_saisie" CHECK (true);\n`;
    expect(suppressionsOrphelines(sql)).toEqual(["rencontres_test_interne_saisie"]);
    // … et recréée sur une AUTRE table, elle l'est aussi.
    const ailleurs = sql.replace("-- ", "").replace('TABLE "rencontres" ADD', 'TABLE "faits" ADD');
    expect(suppressionsOrphelines(ailleurs)).toEqual(["rencontres_test_interne_saisie"]);
  });

  it("2. la dernière définition du CHECK de test admet la saisie ET Calendly", () => {
    expect(sourcesAdmises(derniereDefinition("rencontres_test_interne_saisie"))).toEqual([
      "calendly",
      "saisie_manuelle",
    ]);
  });

  it("3. le miroir en mémoire suit la dernière définition, source par source", async () => {
    const admises = new Set(sourcesAdmises(derniereDefinition("rencontres_test_interne_saisie")));
    const sources = sourcesDuSchema();
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const source of sources) {
      expect(await miroirAccepte(source), `source « ${source} »`).toBe(admises.has(source));
    }
  });
});
