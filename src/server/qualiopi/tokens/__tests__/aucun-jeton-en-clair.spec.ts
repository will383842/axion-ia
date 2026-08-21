/**
 * 🔴 `D4-5-S1` — le jeton du questionnaire ne vit plus qu'en transit.
 *
 * ## Le défaut
 *
 * `questionnaires.token` était stocké EN CLAIR, et le commentaire du schéma
 * affirmait « timingSafeEqual à la lecture ». C'était faux : les cinq lectures
 * faisaient `findUnique({ where: { token } })`, une égalité SQL sur la valeur en
 * clair. `verifyQrToken`, la comparaison timing-safe que la phrase invoquait,
 * n'était appelée NULLE PART en production.
 *
 * Ce jeton ouvre le questionnaire d'un stagiaire ou l'enquête d'une entreprise
 * cliente : il permet de LIRE les réponses déjà données et d'en ÉCRIRE d'autres
 * au nom du répondant. Les notes qu'il porte alimentent le taux de satisfaction
 * (indicateurs 30-31).
 *
 * 🔑 La table voisine `portail_acces` avait été convertie la veille (`D4-4-A`),
 * avec le même raisonnement écrit dans son propre code. Le correctif avait
 * traité une instance, pas la classe.
 *
 * ## Le second défaut, découvert en corrigeant le premier
 *
 * ⚠️ La console ET le portail stagiaire expédiaient ce jeton AU NAVIGATEUR — la
 * console pour saisir les réponses à la place du stagiaire, le portail pour lui
 * afficher ses questionnaires. Le sésame de chaque questionnaire d'une session
 * se lisait donc dans la source de la page.
 *
 * Or les deux chemins sont AUTHENTIFIÉS : la console par la session admin, le
 * portail par son cookie — lequel vérifie déjà que le questionnaire appartient
 * au stagiaire. Le jeton n'y était qu'un identifiant redondant. Ils désignent
 * désormais la ligne par son `id`, qui n'ouvre rien.
 *
 * Il ne reste qu'UN usage du clair : le lien de l'enquête entreprise, envoyé par
 * e-mail à un contact qui n'a pas de compte.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { hacherToken } from "../hacher-token";

const RACINE = process.cwd();
const SRC = join(RACINE, "src");

function lireCode(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Tous les `.ts`/`.tsx` de `src/`, hors tests. */
function fichiers(): string[] {
  const sortie: string[] = [];
  const pile = [SRC];
  while (pile.length > 0) {
    const dossier = pile.pop();
    if (dossier === undefined) break;
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) pile.push(chemin);
      else if (
        (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) &&
        !/\.(spec|test)\.tsx?$/.test(e.name)
      ) {
        sortie.push(chemin);
      }
    }
  }
  return sortie;
}

describe("`D4-5-S1` — aucun jeton de questionnaire en clair", () => {
  it("le hachage est celui que la migration a appliqué", () => {
    // 🔑 Le contrat qui rend les liens DÉJÀ ENVOYÉS encore valables : la
    // migration a converti les jetons existants par `encode(sha256(token), 'hex')`
    // côté Postgres. Si cette fonction changeait d'encodage, de casse ou de
    // longueur, tous les liens en circulation cesseraient de fonctionner — en
    // silence, car un jeton inconnu rend simplement 404.
    expect(hacherToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hacherToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("🔴 le schéma ne porte plus de colonne `token` sur le questionnaire", () => {
    const schema = readFileSync(join(RACINE, "prisma", "schema.prisma"), "utf-8");
    const debut = schema.indexOf("model Questionnaire {");
    expect(debut).toBeGreaterThan(-1);
    const modele = schema.slice(debut, schema.indexOf("\n}", debut));
    expect(modele).toContain("tokenHash");
    expect(modele, "la colonne en clair est revenue").not.toMatch(/^\s+token\s+String/m);
  });

  it("🔴 aucune lecture ne cherche par `token` en clair", () => {
    const coupables = fichiers().filter((f) =>
      /questionnaire\.findUnique\(\{\s*where:\s*\{\s*token\b/.test(
        lireCode(f).replace(/\s+/g, " "),
      ),
    );
    expect(
      coupables.map((f) => f.slice(SRC.length + 1)),
      "la base ne détient qu'une empreinte : chercher par le clair ne trouvera jamais rien",
    ).toEqual([]);
  });

  it("🔴 ni la console ni le portail n'expédient le jeton au navigateur", () => {
    // Les deux chemins sont authentifiés et désignent la ligne par son `id`.
    // Y voir réapparaître `token` signifierait qu'un sésame redescend dans le
    // HTML — c'est-à-dire dans le cache du navigateur et sous les yeux de qui
    // regarde l'écran.
    for (const rel of [
      [
        "src",
        "app",
        "[locale]",
        "(admin)",
        "[adminPrefix]",
        "qualiopi",
        "sessions",
        "[id]",
        "page.tsx",
      ],
      ["src", "server", "qualiopi", "portail", "portail-service.ts"],
      ["src", "components", "admin", "qualiopi", "QuestionnairesSection.tsx"],
    ]) {
      const code = lireCode(join(RACINE, ...rel));
      expect(code, `${rel.at(-1)} sérialise un jeton de questionnaire`).not.toMatch(
        /\btoken:\s*(?:true|q\.token|questionnaire\.token)/,
      );
    }
  });

  it("le témoin : l'enquête ENTREPRISE, elle, garde son lien tokenisé", () => {
    // 🔑 Sans ce témoin, supprimer purement et simplement le jeton passerait les
    // tests ci-dessus au vert — et l'entreprise cliente, qui n'a aucun compte,
    // n'aurait plus aucun moyen de répondre.
    const envoi = lireCode(
      join(RACINE, "src", "server", "qualiopi", "notifications", "notifications-service.ts"),
    );
    expect(envoi).toContain("emettreLienQuestionnaire");
    expect(envoi).toMatch(/portail\/enquete\/\$\{token\}/);
  });
});
