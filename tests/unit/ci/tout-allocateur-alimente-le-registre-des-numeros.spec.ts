/**
 * ⛔ TOUTE TABLE LUE PAR UN ALLOCATEUR DE NUMÉRO ALIMENTE `numeros_emis`.
 *
 * Le registre append-only `numeros_emis` ne fixe la borne haute d'une série
 * que s'il reçoit CHAQUE numéro émis. Il est alimenté par déclencheur
 * (`AFTER INSERT OR UPDATE OF <colonne>`) sur chaque table porteuse, et
 * rempli une fois par backfill. Une table porteuse oubliée — ou ajoutée plus
 * tard par un nouvel allocateur — rouvrirait en silence le défaut du
 * 2026-09-15 (`AXI-FACT-2026-001` émis deux fois) pour sa série.
 *
 * La liste n'est PAS écrite à la main : elle est DÉRIVÉE des sites d'appel de
 * `nextNumero` (chaque `.<modèle>.findMany({ where: { <champ>: … } })` lu dans
 * le lecteur de série), puis traduite en (table, colonne) par le schéma
 * Prisma (`@@map`, `@map`). Pour chaque couple, la migration du registre doit
 * poser le déclencheur ET le backfill ; et inversement, aucun déclencheur ne
 * vise une table qu'aucun allocateur ne lit.
 *
 * Un nouvel allocateur sur une nouvelle table rougit ici tant qu'une migration
 * ne lui a pas posé son déclencheur : c'est voulu.
 *
 * Mutation qui fait rougir : retirer le déclencheur de `trainer_statements`
 * (colonne `numero_facture`, le seul cas où la colonne n'est pas `numero`).
 * Contre-témoin : un site fictif lisant une table non couverte est signalé.
 */

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  argumentDAppel,
  lire,
  lireModeles,
  sansCommentaires,
  sourcesExigeesSous,
  type ModeleLu,
} from "./sources-du-circuit-visio";

const FICHIER_ALLOCATEUR = "src/server/qualiopi/numbering/allocate.ts";

interface Lecture {
  readonly fichier: string;
  readonly accesseur: string;
  readonly champ: string;
}

interface Porteuse {
  readonly table: string;
  readonly colonne: string;
  readonly vuDans: string;
}

/** Les lectures `.<accesseur>.findMany({ where: { <champ>: …` de chaque appel à `nextNumero`. */
function lecturesDesAllocateurs(sources: ReadonlyArray<{ fichier: string; code: string }>): {
  sites: number;
  lectures: Lecture[];
  sitesSansLecture: string[];
} {
  const lectures: Lecture[] = [];
  const sitesSansLecture: string[] = [];
  let sites = 0;
  for (const { fichier, code } of sources) {
    const propre = sansCommentaires(code);
    for (const m of propre.matchAll(/\bnextNumero\s*\(/g)) {
      const avant = propre.slice(Math.max(0, (m.index ?? 0) - 20), m.index);
      if (/function\s*$/.test(avant)) continue; // la définition elle-même
      sites += 1;
      const ouvrante = (m.index ?? 0) + m[0].length - 1;
      const arg = argumentDAppel(propre, ouvrante);
      const trouvees = [
        ...arg.matchAll(/\.(\w+)\s*\.findMany\(\s*\{\s*where:\s*\{\s*(\w+)\s*:/g),
      ].map((x) => ({ fichier, accesseur: x[1] as string, champ: x[2] as string }));
      if (trouvees.length === 0) sitesSansLecture.push(fichier);
      lectures.push(...trouvees);
    }
  }
  return { sites, lectures, sitesSansLecture };
}

/** (accesseur, champ) → (table, colonne) par le schéma. */
function porteuses(
  lectures: readonly Lecture[],
  modeles: readonly ModeleLu[],
): {
  porteuses: Porteuse[];
  inconnues: string[];
} {
  const parAccesseur = new Map(modeles.map((m) => [m.accesseur, m]));
  const out = new Map<string, Porteuse>();
  const inconnues: string[] = [];
  for (const l of lectures) {
    const modele = parAccesseur.get(l.accesseur);
    if (!modele) {
      inconnues.push(`${l.fichier} : accesseur Prisma inconnu « ${l.accesseur} »`);
      continue;
    }
    const ligne = modele.corps.split("\n").find((x) => new RegExp(`^\\s*${l.champ}\\s`).test(x));
    if (!ligne) {
      inconnues.push(`${l.fichier} : champ « ${l.champ} » absent du modèle ${modele.nom}`);
      continue;
    }
    const colonne = /@map\("([^"]+)"\)/.exec(ligne)?.[1] ?? l.champ;
    const cle = `${modele.table}.${colonne}`;
    if (!out.has(cle)) out.set(cle, { table: modele.table, colonne, vuDans: l.fichier });
  }
  return { porteuses: [...out.values()], inconnues };
}

function echapper(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ce qui manque à la migration pour les porteuses données. */
function fautes(porteusesAttendues: readonly Porteuse[], sql: string): string[] {
  const out: string[] = [];
  for (const p of porteusesAttendues) {
    const t = echapper(p.table);
    const c = echapper(p.colonne);
    const declencheur = new RegExp(
      `CREATE TRIGGER "\\w+"\\s+AFTER INSERT OR UPDATE OF "${c}" ON "${t}"\\s+FOR EACH ROW EXECUTE FUNCTION "numeros_emis_enregistrer"\\('${c}'\\)`,
    );
    if (!declencheur.test(sql)) {
      out.push(
        `${p.table}.${p.colonne} (lue par ${p.vuDans}) : aucun déclencheur vers numeros_emis`,
      );
    }
    const backfill = new RegExp(
      `INSERT INTO "numeros_emis"[^;]*SELECT "${c}"[^;]*FROM "${t}"[^;]*ON CONFLICT`,
    );
    if (!backfill.test(sql)) {
      out.push(`${p.table}.${p.colonne} (lue par ${p.vuDans}) : aucun backfill vers numeros_emis`);
    }
  }
  // Sens inverse : un déclencheur sur une table qu'aucun allocateur ne lit.
  const attendues = new Set(porteusesAttendues.map((p) => `${p.table}.${p.colonne}`));
  for (const m of sql.matchAll(
    /CREATE TRIGGER "\w+"\s+AFTER INSERT OR UPDATE OF "(\w+)" ON "(\w+)"/g,
  )) {
    const cle = `${m[2]}.${m[1]}`;
    if (!attendues.has(cle))
      out.push(`${cle} : déclencheur posé, mais aucun allocateur ne lit cette table`);
  }
  return out;
}

function migrationDuRegistre(): { nom: string; sql: string } {
  const candidates = readdirSync(`${process.cwd()}/prisma/migrations`, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .map((nom) => {
      try {
        return { nom, sql: lire(`prisma/migrations/${nom}/migration.sql`) };
      } catch {
        return { nom, sql: "" };
      }
    })
    .filter((m) => /CREATE TABLE "numeros_emis"/.test(m.sql));
  if (candidates.length !== 1) {
    throw new Error(
      `attendu : exactement une migration crée "numeros_emis" (trouvé ${candidates.length})`,
    );
  }
  return candidates[0] as { nom: string; sql: string };
}

/** Déclencheurs du registre lui-même (ajout seul), attendus en plus des porteuses. */
const DECLENCHEURS_DU_REGISTRE = [
  "numeros_emis:numeros_emis_ajout_seul",
  "numeros_emis:numeros_emis_pas_de_truncate",
] as const;

/**
 * La liste que Gate D exige EN BASE (`pg_trigger`), lue entre les marqueurs
 * `déclencheurs-attendus` de `tests/sql/numeros-emis-comportement.sql`.
 */
function declencheursExigesEnBase(sql: string): string[] {
  const bloc = /déclencheurs-attendus:début([\s\S]*?)déclencheurs-attendus:fin/.exec(sql)?.[1];
  if (bloc === undefined) throw new Error("marqueurs déclencheurs-attendus introuvables");
  return [...bloc.matchAll(/\('(\w+)',\s*'(\w+)'\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
}

describe("tout allocateur de numéro alimente le registre numeros_emis", () => {
  const sources = sourcesExigeesSous(["src"])
    .filter((f) => /\.tsx?$/.test(f) && f !== FICHIER_ALLOCATEUR)
    .map((fichier) => ({ fichier, code: lire(fichier) }))
    .filter((s) => s.code.includes("nextNumero"));
  const { sites, lectures, sitesSansLecture } = lecturesDesAllocateurs(sources);
  const modeles = lireModeles();
  const { porteuses: attendues, inconnues } = porteuses(lectures, modeles);

  it("le balayage trouve bien les allocateurs (un vert qui ne regarde rien est le pire état)", () => {
    // 18 sites au 2026-09-30 ; on n'en fige pas le nombre, on exige qu'il y en ait.
    expect(sites).toBeGreaterThanOrEqual(18);
    expect(sitesSansLecture).toEqual([]);
    expect(inconnues).toEqual([]);
    // Au moins la série légale des factures et le cas colonne ≠ `numero`.
    expect(attendues.map((p) => `${p.table}.${p.colonne}`)).toEqual(
      expect.arrayContaining(["factures_formation.numero", "trainer_statements.numero_facture"]),
    );
  });

  it("la liste exigée EN BASE par Gate D est exactement celle dérivée des allocateurs", () => {
    // Gate D (`pg_trigger`) prouve que les déclencheurs EXISTENT et sont actifs
    // sur la base migrée à neuf — y compris après une migration ultérieure qui
    // en retirerait un. Cette spec prouve que la liste de Gate D ne dérive pas.
    const attendue = [
      ...attendues.map((p) => `${p.table}:${p.table}_numero_emis`),
      ...DECLENCHEURS_DU_REGISTRE,
    ].sort();
    const sql = lire("tests/sql/numeros-emis-comportement.sql");
    expect(declencheursExigesEnBase(sql)).toEqual(attendue);
    expect(attendue).toHaveLength(attendues.length + 2);
  });

  it("chaque table porteuse a son déclencheur et son backfill, et rien de plus", () => {
    const { sql } = migrationDuRegistre();
    expect(fautes(attendues, sql)).toEqual([]);
  });

  it("le registre est en ajout seul (ni UPDATE, ni DELETE, ni TRUNCATE)", () => {
    const { sql } = migrationDuRegistre();
    expect(sql).toMatch(
      /CREATE TRIGGER "numeros_emis_ajout_seul"\s+BEFORE UPDATE OR DELETE ON "numeros_emis"/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER "numeros_emis_pas_de_truncate"\s+BEFORE TRUNCATE ON "numeros_emis"/,
    );
  });

  it("le modèle Prisma NumeroEmis existe et vise la table numeros_emis", () => {
    const m = modeles.find((x) => x.nom === "NumeroEmis");
    expect(m?.table).toBe("numeros_emis");
  });

  it("contre-témoin : une table lue par un allocateur mais sans déclencheur est signalée", () => {
    const fictive: Porteuse = { table: "nouvelle_table", colonne: "numero", vuDans: "fictif.ts" };
    const { sql } = migrationDuRegistre();
    expect(fautes([...attendues, fictive], sql)).toEqual([
      "nouvelle_table.numero (lue par fictif.ts) : aucun déclencheur vers numeros_emis",
      "nouvelle_table.numero (lue par fictif.ts) : aucun backfill vers numeros_emis",
    ]);
  });

  it("contre-témoin : le balayage reconnaît un site d'appel fictif et sa table", () => {
    const code = `
      const n = await nextNumero("facture", 2026, (prefixe) =>
        tx.factureFormation.findMany({ where: { numero: { startsWith: prefixe } }, select: { numero: true } }),
      );`;
    const r = lecturesDesAllocateurs([{ fichier: "fictif.ts", code }]);
    expect(r.sites).toBe(1);
    expect(porteuses(r.lectures, modeles).porteuses).toEqual([
      { table: "factures_formation", colonne: "numero", vuDans: "fictif.ts" },
    ]);
  });
});
