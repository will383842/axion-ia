/**
 * CLIQUET — une Server Action sans garde est un endpoint HTTP ouvert.
 *
 * ## Le fait structurel, mesuré le 2026-08-25 (cahier D6-1)
 *
 * 🔴 **Vivre sous `/[adminPrefix]/` ne protège RIEN.**
 *
 * `src/auth.config.ts` autorise par **chemin d'URL** :
 *
 * ```ts
 * const isOnAdmin = adminRegex.test(nextUrl.pathname);
 * if (!isOnAdmin) return true; // hors admin = laisse passer
 * ```
 *
 * Or une Server Action n'est pas identifiée par son chemin : elle est appelée
 * par un POST portant l'en-tête `Next-Action`, et **ce POST peut viser
 * n'importe quelle URL**, y compris `/fr/`. Le middleware la laisse alors
 * passer sans jamais regarder la session.
 *
 * **Chaque fonction exportée d'un fichier `"use server"` est donc un endpoint
 * HTTP joignable, et sa seule protection est la garde qu'elle porte elle-même.**
 *
 * ## Le défaut que ce fichier ferme
 *
 * Sept actions de `site-explorer/site-routes.ts` n'en portaient aucune, alors
 * que `triggerDiscovery` et `setRouteAdminNotes`, **dans le même fichier**, en
 * portaient une. Trois mettaient un traitement en file ou résolvaient une
 * anomalie ; quatre rendaient l'inventaire SEO complet — `adminNotes` (que
 * seule une action gardée sait écrire), `filePath` (arborescence serveur) et
 * les métriques de position.
 *
 * C'est la forme récurrente de ce dépôt : une règle appliquée à un site,
 * oubliée sur son voisin — ici, dans le même fichier.
 *
 * ## Pourquoi ce cliquet est DÉRIVÉ
 *
 * Il ne nomme pas les sept actions d'aujourd'hui : il balaye le module et exige
 * que **toute** action exportée porte une garde. La huitième, écrite demain,
 * sera vue sans qu'on touche à ce fichier — *une garde qui nomme sa cible ne
 * peut pas voir le jumeau.*
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ACTIONS = join(process.cwd(), "src", "server", "actions");

/**
 * Modules dont TOUTE action exportée doit porter une garde.
 *
 * ⚠️ Volontairement pas « tous les modules d'actions » : plusieurs portent des
 * surfaces publiques assumées (émargement du stagiaire, enquête, baromètre,
 * demande d'accès au portail), qui se protègent par jeton et rate-limit plutôt
 * que par session. Les inclure ferait rougir le cliquet sur des décisions
 * écrites — et on l'affaiblirait pour le faire taire.
 *
 * On commence par le module où le défaut a été mesuré. Étendre cette liste est
 * un geste délibéré, pas un effet de bord.
 */
const MODULES_ENTIEREMENT_GARDES = ["site-explorer"] as const;

/** Le code seul, lignes de commentaire écartées. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

/** Les `.ts` de production d'un module d'actions. */
function sourcesDe(moduleNom: string): string[] {
  const dossier = join(ACTIONS, moduleNom);
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".ts") && !f.includes(".spec.") && !f.includes(".test."))
    .map((f) => join(dossier, f))
    .filter((f) => statSync(f).isFile());
}

/**
 * Les actions exportées d'un fichier, avec le corps de chacune.
 *
 * Le découpage va d'un `export async function` au suivant : c'est grossier mais
 * suffisant pour répondre à « cette fonction appelle-t-elle une garde ».
 */
function actionsAvecCorps(code: string): Array<{ nom: string; corps: string }> {
  const bornes = [...code.matchAll(/export async function (\w+)/g)];
  return bornes.map((m, i) => ({
    nom: m[1] ?? "",
    corps: code.slice(m.index ?? 0, bornes[i + 1]?.index ?? code.length),
  }));
}

const PORTE_UNE_GARDE =
  /require(AdminRead|AdminWrite|AdminPublish|AdminDelete|Habilitation|SuperAdmin|Formateur)\s*\(/;

describe("toute Server Action porte sa propre garde", () => {
  it("le balayage voit réellement des actions — sinon il ne garde rien", () => {
    // 🔑 CONTRE-TÉMOIN. Si le découpage cassait, ou si le module déménageait, le
    // test central rendrait une liste vide de fautives et passerait au vert
    // **sans examiner une seule action**. C'est la panne que ce dépôt a payée
    // cinq fois.
    const total = MODULES_ENTIEREMENT_GARDES.flatMap((m) =>
      sourcesDe(m).flatMap((f) => actionsAvecCorps(codeSeul(f))),
    );
    expect(
      total.length,
      "aucune Server Action trouvée dans les modules surveillés : le test suivant " +
        "ne garde plus rien.",
    ).toBeGreaterThanOrEqual(10);
  });

  it("🔴 aucune action exportée n'est dépourvue de garde", () => {
    const fautives: string[] = [];
    for (const moduleNom of MODULES_ENTIEREMENT_GARDES) {
      for (const fichier of sourcesDe(moduleNom)) {
        const code = codeSeul(fichier);
        if (!code.includes('"use server"')) continue;
        for (const { nom, corps } of actionsAvecCorps(code)) {
          if (!PORTE_UNE_GARDE.test(corps)) {
            fautives.push(`${moduleNom}/${fichier.split(/[\\/]/).pop()} → ${nom}`);
          }
        }
      }
    }

    expect(
      fautives,
      "Server Action exportée SANS garde. Chaque fonction exportée d'un fichier " +
        '`"use server"` est un endpoint HTTP : elle est appelée par un POST ' +
        "portant l'en-tête `Next-Action`, qui peut viser n'importe quelle URL. " +
        "Vivre sous `/[adminPrefix]/` ne protège rien — `auth.config.ts` autorise " +
        "par CHEMIN (`if (!isOnAdmin) return true`), pas par surface d'action. " +
        "La seule protection d'une action est celle qu'elle porte elle-même.",
    ).toEqual([]);
  });

  it("le contre-témoin : le motif reconnaît bien une action sans garde", () => {
    // 🔑 Sans ce cas, le test central rendrait zéro fautive même si son motif
    // ne reconnaissait plus rien.
    const faux = [
      '"use server";',
      "export async function actionGardee() {",
      "  await requireAdminWrite();",
      "  return 1;",
      "}",
      "export async function actionNue() {",
      "  return 2;",
      "}",
    ].join("\n");

    const trouvees = actionsAvecCorps(faux).filter((a) => !PORTE_UNE_GARDE.test(a.corps));
    expect(
      trouvees.map((a) => a.nom),
      "le motif ne distingue plus une action gardée d'une action nue : le test " +
        "central ne mesure plus rien.",
    ).toEqual(["actionNue"]);
  });
});
