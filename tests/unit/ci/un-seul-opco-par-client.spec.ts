/**
 * Lot OPCO A7a — UN seul OPCO par client.
 *
 * 1. La migration de reprise recopie `opco_identifie` dans `opco` typé, pour les
 *    seules fiches dont l'OPCO typé est vide et dont le texte est l'un des 11
 *    identifiants de l'enum : idempotente, sans rien retirer.
 * 2. Garde d'architecture : l'OPCO d'un client se LIT par `opcoDuClient` /
 *    `nomOpcoDuClient` / `referenceOpcoDuClient` (`opco-referentiel.ts`). Toute
 *    lecture directe de `.opcoIdentifie` hors de la liste fermée ci-dessous rouvre
 *    le défaut que ce lot ferme : une brique aveugle sur la moitié des fiches.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { OPCO_IDS } from "@/server/qualiopi/financements/opco-referentiel";

const RACINE = join(__dirname, "../../..");

describe("migration opco_client_repris_de_opco_identifie", () => {
  const dossiers = readdirSync(join(RACINE, "prisma/migrations")).filter((d) =>
    d.endsWith("_opco_client_repris_de_opco_identifie"),
  );
  const sql = dossiers[0]
    ? readFileSync(join(RACINE, "prisma/migrations", dossiers[0], "migration.sql"), "utf8")
    : "";
  const code = sql.replace(/--.*$/gm, "");

  it("existe une seule fois, horodatée après le 2026-10-04 12:00:00", () => {
    expect(dossiers).toHaveLength(1);
    expect(dossiers[0]!.slice(0, 14) > "20261004120000").toBe(true);
  });

  it("n'écrit que là où l'OPCO typé est vide (idempotente) et ne touche que `opco`", () => {
    const updates = code.match(/\bUPDATE\b/gi) ?? [];
    expect(updates).toHaveLength(1);
    expect(code).toMatch(
      /UPDATE "clients"\s+SET "opco" = "opco_identifie"::"Opco"\s+WHERE "opco" IS NULL/,
    );
    // Un seul SET, une seule colonne.
    expect(code.match(/\bSET\b/g) ?? []).toHaveLength(1);
    expect(code).not.toMatch(/,\s*"\w+"\s*=/);
  });

  it("borne la recopie aux 11 identifiants de l'enum, ni plus ni moins", () => {
    const liste = /"opco_identifie" IN \(([^)]*)\)/.exec(code)?.[1] ?? "";
    const valeurs = [...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(valeurs).toEqual([...OPCO_IDS].sort());
  });

  it("aucun DROP, DELETE, RENAME, ni modification de structure", () => {
    expect(code).not.toMatch(/\b(DROP|DELETE|RENAME|TRUNCATE|ALTER|CREATE|INSERT)\b/i);
  });
});

/**
 * Fichiers qui ont le droit de lire `.opcoIdentifie` directement. Liste FERMÉE :
 * l'agrandir demande une raison écrite ici.
 */
const LECTURES_AUTORISEES = new Map<string, string>([
  // La règle unique elle-même.
  ["src/server/qualiopi/financements/opco-referentiel.ts", "règle unique opcoDuClient"],
  // Suggestion d'OPCO typé à partir du texte libre (lecture seule, affichée).
  ["src/server/qualiopi/financements/opco-suggestion.ts", "rapprochement du texte libre"],
  // L'action qui ÉCRIT le champ (création, édition, ré-inférence).
  ["src/server/actions/qualiopi/clients.ts", "écriture et ré-inférence"],
  // Référentiel NAF/IDCC → OPCO : produit la valeur sans lire de fiche. Exception
  // PRÉVENTIVE, demandée par le cahier du lot — d'où son exclusion du test « place morte ».
  ["src/server/qualiopi/crm/naf-opco.ts", "inférence"],
  // La liste des clients TRANSMET la valeur brute au formulaire qui saisit le
  // texte libre (`ClientBrancheForm`) : on édite ce qui est en base, pas sa lecture.
  // L'AFFICHAGE de la colonne OPCO, lui, passe par la règle unique.
  ["src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/page.tsx", "valeur éditée"],
]);

function fichiersSources(dossier: string): string[] {
  const sortie: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      sortie.push(...fichiersSources(chemin));
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Le code sans ses commentaires : une phrase qui CITE le champ n'est pas une lecture. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("garde d'architecture — l'OPCO d'un client se lit par la règle unique", () => {
  const lecteurs = fichiersSources(join(RACINE, "src"))
    .filter((f) => /\.opcoIdentifie\b/.test(sansCommentaires(readFileSync(f, "utf8"))))
    .map((f) => relative(RACINE, f).split("\\").join("/"));

  it("aucune lecture directe de `.opcoIdentifie` hors de la liste fermée", () => {
    expect(lecteurs.filter((f) => !LECTURES_AUTORISEES.has(f))).toEqual([]);
  });

  it("chaque exception sert encore (la liste ne garde pas de place morte)", () => {
    const vivants = new Set(lecteurs);
    const morts = [...LECTURES_AUTORISEES.keys()].filter(
      (f) => !vivants.has(f) && f !== "src/server/qualiopi/crm/naf-opco.ts",
    );
    expect(morts).toEqual([]);
  });
});
