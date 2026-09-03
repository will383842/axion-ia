// @vitest-environment node

/**
 * 🛑 LE JOURNAL D'UNE CANDIDATURE EST EN AJOUT SEUL.
 *
 * ## Ce qui est gardé, et pourquoi ça vaut une garde
 *
 * Un journal qu'on peut réécrire ne prouve rien. Or c'est exactement ce qu'on
 * demande à celui-ci : dire **qui** a écrit **quoi** à un candidat, et **quand**.
 * Le jour où une candidature se conteste — un refus mal vécu, une réclamation,
 * une question de la CNIL sur l'accès au dossier — la valeur de ces lignes tient
 * entièrement à ce que personne n'ait pu les retoucher après coup.
 *
 * Rien dans Postgres ne l'impose : la table accepte les `UPDATE` et les
 * `DELETE` comme n'importe quelle autre. C'est donc une discipline de code, et
 * une discipline de code sans garde est une intention.
 *
 * ## Les deux seules disparitions légitimes
 *
 * La cascade d'effacement (droit à l'oubli, purge de rétention). Elle relève de
 * la contrainte `ON DELETE CASCADE`, pas d'une action : supprimer la
 * candidature emporte son journal, et c'est voulu — conserver la trace d'une
 * personne dont on vient d'effacer le dossier serait la contradiction inverse.
 *
 * ## Ce que cette garde ne prouve pas
 *
 * Elle lit le code source : elle prouve qu'aucun appelant n'ÉCRIT une mise à
 * jour, pas qu'aucune ne peut se produire (une requête SQL brute lui
 * échapperait). C'est une garde de forme, et elle le dit — comme
 * `prospection-aucune-purge-automatique.spec.ts`, dont elle reprend la méthode
 * parce qu'elle garde la même chose : une ABSENCE, qui ne s'observe pas à
 * l'exécution.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE_SRC = join(process.cwd(), "src");

/**
 * ⚠️ Commentaires RETIRÉS avant analyse. Ce fichier-ci comme `journal.ts`
 * parlent abondamment de « mise à jour » et de « suppression » en prose ; une
 * garde statique qui trouverait ses propres explications serait un faux
 * positif, et le dépôt l'a déjà payé.
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Tous les fichiers TypeScript de `src/`, en dehors des tests. */
function fichiersSource(dossier: string = RACINE_SRC): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      if (entree === "__tests__" || entree === "node_modules") continue;
      trouves.push(...fichiersSource(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (/\.(spec|test)\.tsx?$/.test(entree)) continue;
    trouves.push(chemin);
  }
  return trouves;
}

/** Les écritures interdites sur le journal, quelle que soit la forme. */
const INTERDITS = [
  /prisma\.jobApplicationEvent\s*\.\s*update/,
  /prisma\.jobApplicationEvent\s*\.\s*updateMany/,
  /prisma\.jobApplicationEvent\s*\.\s*upsert/,
  /prisma\.jobApplicationEvent\s*\.\s*delete/,
  /prisma\.jobApplicationEvent\s*\.\s*deleteMany/,
  // La forme transactionnelle, qui contourne le préfixe `prisma.`.
  /\btx\s*\.\s*jobApplicationEvent\s*\.\s*(update|upsert|delete)/,
] as const;

describe("🛑 journal de candidature — ajout seul", () => {
  it("le balayage voit bien des fichiers — sinon la garde ne garde rien", () => {
    // Témoin de NON-VACUITÉ. Un balayage qui ne trouverait aucun fichier
    // passerait tous les cas ci-dessous au vert, et l'absence d'alerte se
    // lirait comme une absence de problème.
    const fichiers = fichiersSource();
    expect(fichiers.length).toBeGreaterThan(500);
    expect(
      fichiers.some((f) => f.endsWith(join("admin-job-applications", "journal.ts"))),
      "le module du journal n'est pas dans le périmètre balayé",
    ).toBe(true);
  });

  it("🔴 aucune mise à jour ni suppression d'un événement du journal", () => {
    const fautifs: string[] = [];
    for (const fichier of fichiersSource()) {
      const code = sansCommentaires(readFileSync(fichier, "utf8"));
      if (!code.includes("jobApplicationEvent")) continue;
      for (const interdit of INTERDITS) {
        if (interdit.test(code)) {
          fautifs.push(`${fichier.replace(RACINE_SRC, "src")} — ${String(interdit)}`);
        }
      }
    }

    expect(
      fautifs,
      "Le journal d'une candidature est en AJOUT SEUL. Une ligne qu'on peut " +
        "retoucher après coup ne prouve plus qui a écrit quoi à un candidat — " +
        "et c'est précisément ce qu'on lui demande le jour où une candidature " +
        "se conteste. Les seules disparitions légitimes sont les cascades " +
        "d'effacement, qui relèvent de Postgres et non d'une action.",
    ).toEqual([]);
  });

  it("le journal sait tout de même ÉCRIRE — sinon il n'est pas un journal", () => {
    // 🔑 Témoin inverse. Sans lui, supprimer purement et simplement le module
    // ferait passer le cas ci-dessus : on prouverait l'immuabilité par le vide.
    const journal = readFileSync(
      join(RACINE_SRC, "features", "admin-job-applications", "journal.ts"),
      "utf8",
    );
    expect(sansCommentaires(journal)).toMatch(/jobApplicationEvent\s*\.\s*create/);
    expect(journal).toContain("consignerEvenement");
  });

  it("l'écriture passe par UNE porte — aucun `create` direct ailleurs", () => {
    // 🔑 Trois invariants (auteur instantané, date du fait, résumé borné)
    // n'existent que s'ils sont écrits à un seul endroit. Un appelant qui
    // créerait sa ligne lui-même les perdrait tous les trois, en silence.
    const porte = join("features", "admin-job-applications", "journal.ts");
    const fautifs = fichiersSource()
      .filter((f) => !f.endsWith(porte))
      .filter((f) =>
        /jobApplicationEvent\s*\.\s*create/.test(sansCommentaires(readFileSync(f, "utf8"))),
      )
      .map((f) => f.replace(RACINE_SRC, "src"));

    expect(
      fautifs,
      "un événement de journal est créé hors de `journal.ts`. Les trois " +
        "invariants du journal (nom d'auteur figé, date du FAIT distincte de " +
        "la saisie, résumé borné à la colonne) n'existent que parce qu'ils " +
        "sont écrits à un seul endroit. Passer par `consignerEvenement`.",
    ).toEqual([]);
  });
});
