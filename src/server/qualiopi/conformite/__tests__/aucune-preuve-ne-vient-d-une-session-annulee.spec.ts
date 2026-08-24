/**
 * CLIQUET — aucune preuve d'indicateur ne peut venir d'une session annulée.
 *
 * ## Le défaut (2026-08-24, cahier D1-4)
 *
 * 🔴 `pieceAdmissibleAuDossier()` existe depuis le 2026-08-20 (`D2-5-12`) et
 * exclut deux choses : les pièces annulées, **et les pièces d'une session
 * `annulee` ou `reportee`**. Son en-tête écrit la règle en toutes lettres :
 * « Tout nouveau consommateur appelle cette fonction, jamais ne réécrit son
 * prédicat. »
 *
 * `conformite-service.ts` ne l'importait pas, et réécrivait `annuleeAt: null`
 * **à cinq endroits** — donc sans le filtre de statut de session. Une
 * convocation émise pour une session ensuite **annulée** couvrait l'indicateur
 * 9 ; un émargement d'une session annulée couvrait le 12.
 *
 * 🔑 **La contradiction se voyait sur une seule page.** Le manifeste d'audit
 * prend le *statut* de l'indicateur dans `evaluerConformite()` (non filtré) et
 * la *liste des pièces* via `pieceAdmissibleAuDossier()` (filtré). Il pouvait
 * donc écrire « Indicateur 9 — Couvert » au-dessus d'une rubrique
 * « Documents » **vide**.
 *
 * C'est la forme récurrente de ce dépôt : une règle écrite et justifiée à un
 * endroit, appliquée à un site, oubliée sur son jumeau.
 *
 * ## Pourquoi ce fichier balaye au lieu d'énumérer
 *
 * La garde qui existait (`audit-dossier.spec.ts`) lisait **un seul fichier, en
 * dur** : `audit-dossier.ts`. Les cinq littéraux de `conformite-service.ts`
 * étaient hors de sa portée — une garde nommant son unique cible ne pouvait pas
 * voir le jumeau. Celle-ci balaye **tout le domaine**, et un sixième
 * consommateur écrit demain serait vu sans qu'on touche à ce fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src", "server", "qualiopi");

/**
 * Les domaines qui produisent des VERDICTS de conformité — c'est-à-dire ceux
 * dont les comptes deviennent la réponse donnée au certificateur.
 *
 * ⚠️ Volontairement pas « tout `src/` » : `rgpd-service` compte délibérément les
 * lignes annulées (il doit purger leurs images et les rendre à l'export art. 15),
 * et le registre des pièces DOIT montrer les annulations avec leur motif. La
 * règle porte sur ce qui PROUVE, pas sur ce qui inventorie.
 */
const DOMAINES_DE_PREUVE = ["conformite", "indicateurs"] as const;

/** Tous les `.ts` de production d'un domaine (specs et tests exclus). */
function sourcesDe(domaine: string): string[] {
  const dossier = join(RACINE, domaine);
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) continue;
    if (!entree.endsWith(".ts")) continue;
    if (entree.includes(".spec.") || entree.includes(".test.")) continue;
    trouves.push(chemin);
  }
  return trouves;
}

/**
 * Le code seul, commentaires de LIGNE écartés.
 *
 * ⚠️ On n'enlève PAS les blocs `/* … *\/` par expression régulière : sur un
 * fichier qui contient lui-même des motifs entre guillemets, l'appariement se
 * déphase et emporte du vrai code. Ce dépôt a déjà payé un test statique qui
 * accusait ses propres commentaires.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

describe("aucune preuve d'indicateur ne vient d'une session annulée", () => {
  it("le prédicat partagé existe encore et exclut bien les deux statuts", async () => {
    // 🔑 CONTRE-TÉMOIN n° 1. Tout ce fichier repose sur l'idée que
    // `pieceAdmissibleAuDossier()` est le bon prédicat. S'il cessait d'exclure
    // les sessions annulées, les tests suivants resteraient verts en exigeant
    // qu'on appelle une fonction devenue inoffensive.
    // ⚠️ On importe le module PUR, jamais `audit-dossier.ts` : celui-ci tire
    // toute la chaîne d'authentification et ne peut pas se charger dans un test
    // unitaire. C'est précisément pourquoi le prédicat en a été extrait.
    const { pieceAdmissibleAuDossier } =
      await import("@/server/qualiopi/conformite/piece-admissible");
    const predicat = pieceAdmissibleAuDossier();

    expect(predicat.annuleeAt, "le prédicat n'exclut plus les pièces annulées").toBeNull();

    const exclus = predicat.OR[1].session.statut.notIn;
    for (const statut of ["annulee", "reportee"] as const) {
      expect(
        exclus,
        `« ${statut} » n'est plus exclu du prédicat partagé : les pièces d'une ` +
          `session qui n'a pas eu lieu redeviennent des preuves d'indicateur.`,
      ).toContain(statut);
    }

    // L'admission des pièces SANS session est un arbitrage explicite, pas un
    // oubli : les procédures, registres et lettres-cadres n'ont pas de session
    // et sont précisément ce que la moitié des indicateurs réclame.
    expect(
      predicat.OR[0],
      "les pièces générales de l'organisme ne sont plus admises : le dossier se " +
        "viderait de ses procédures et registres.",
    ).toEqual({ sessionId: null });
  });

  it("aucun fichier de preuve ne réécrit le prédicat à la main", () => {
    // Le cœur du cliquet. Un littéral `annuleeAt: null` dans un `where` est
    // toujours un prédicat recopié — et un prédicat recopié diverge. Ce dépôt
    // l'a payé quatre fois, dont une où une alerte critique partait chaque nuit
    // sur des pièces annulées.
    const fautifs: string[] = [];
    for (const domaine of DOMAINES_DE_PREUVE) {
      for (const chemin of sourcesDe(domaine)) {
        const source = codeSeul(chemin);
        // ⚠️ Le motif ne vise que les requêtes RACINE — `prisma.documentGenere.x`.
        //
        // Une relation IMBRIQUÉE (`documentsGeneres: { where: … }` à l'intérieur
        // d'un `findUnique` de session) est déjà scopée à une session précise :
        // lui appliquer le prédicat partagé, qui admet volontairement
        // `sessionId: null`, n'aurait aucun sens. Enveloppe lue avant d'accuser —
        // le filtre littéral y est correct et suffisant.
        const litteraux =
          source.match(/prisma\.documentGenere\.\w+\(\s*\{[\s\S]{0,300}?annuleeAt:\s*null/g) ?? [];
        if (litteraux.length > 0) {
          fautifs.push(`${chemin.slice(RACINE.length + 1)} — ${litteraux.length} littéral(aux)`);
        }
      }
    }

    expect(
      fautifs,
      "prédicat d'admissibilité RECOPIÉ à la main au lieu d'appeler " +
        "`pieceAdmissibleAuDossier()`. Un littéral `annuleeAt: null` n'exclut que " +
        "les pièces annulées — PAS les pièces d'une session annulée ou reportée. " +
        "C'est le défaut du 2026-08-24 : une convocation émise pour une session " +
        "ensuite annulée couvrait l'indicateur 9 devant le certificateur.",
    ).toEqual([]);
  });

  it("le contre-témoin : le balayage voit réellement les fichiers", () => {
    // 🔑 CONTRE-TÉMOIN n° 2, et il n'est pas décoratif. Si `sourcesDe` cessait
    // de trouver quoi que ce soit — dossier renommé, filtre trop strict — le
    // test précédent rendrait une liste vide de fautifs et passerait au vert
    // sans avoir examiné un seul fichier. C'est la panne exacte que ce dépôt a
    // payée cinq fois.
    const total = DOMAINES_DE_PREUVE.flatMap((d) => sourcesDe(d));
    expect(
      total.length,
      "le balayage ne trouve plus aucun fichier de production dans les domaines " +
        "de preuve : le test précédent ne garde plus rien.",
    ).toBeGreaterThanOrEqual(3);

    // Et il doit voir le fichier qui portait le défaut.
    expect(
      total.some((f) => f.endsWith("conformite-service.ts")),
      "`conformite-service.ts` n'est plus balayé — c'est pourtant le fichier qui " +
        "portait les cinq prédicats recopiés.",
    ).toBe(true);
  });

  it("le contre-témoin : le motif reconnaîtrait bien un prédicat recopié", () => {
    // 🔑 CONTRE-TÉMOIN n° 3. Le motif du test central est une expression
    // régulière ; si elle cessait de reconnaître la forme qu'elle traque, elle
    // rendrait zéro fautif sur un fichier plein de littéraux.
    const faux = [
      "prisma.documentGenere.count({ where: { annuleeAt: null } }),",
      "prisma.documentGenere.count({",
      "  where: {",
      '    type: { in: ["convocation"] },',
      "    annuleeAt: null,",
      "  },",
      "}),",
      // Et la forme qui NE doit PAS être comptée : une relation imbriquée, déjà
      // scopée à une session par le `findUnique` qui la porte. Si elle était
      // comptée, la garde exigerait un prédicat qui n'a pas de sens à cet
      // endroit — et on « corrigerait » du code juste pour la faire taire.
      "documentsGeneres: { where: { annuleeAt: null } },",
    ].join("\n");

    const trouves =
      faux.match(/prisma\.documentGenere\.\w+\(\s*\{[\s\S]{0,300}?annuleeAt:\s*null/g) ?? [];
    expect(
      trouves.length,
      "le motif ne reconnaît plus un prédicat recopié sur une requête racine — " +
        "ni sur une ligne ni sur plusieurs — ou bien il s'est mis à compter les " +
        "relations imbriquées, qui sont déjà scopées à une session. Dans les deux " +
        "cas, le test central ne mesure plus la bonne chose.",
    ).toBe(2);
  });
});
