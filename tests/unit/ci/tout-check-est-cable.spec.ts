/**
 * Tout script de contrôle doit être APPELÉ — garde d'infrastructure.
 *
 * ## Pourquoi elle existe, et pourquoi celle d'à côté ne suffisait pas
 *
 * `gardes-isolation-sont-appelees.spec.ts` (2026-08-24) verrouille le câblage
 * de TROIS gardes d'isolation, nommées une à une. Elle a parfaitement tenu son
 * périmètre — et c'est exactement là qu'elle était aveugle : le 2026-08-27, un
 * inventaire des 17 scripts se terminant par `check` en a trouvé **trois
 * autres** que personne n'exécutait.
 *
 *   · `radius:check`   — sortait en **code 1 sur `main`** (Footer.tsx:437,
 *                        `rounded-[10px]`) dans un script que rien n'appelait.
 *                        Elle ne dormait pas : elle criait dans une pièce vide.
 *   · `contrast:check` — verte, mais branchée nulle part : rien n'aurait vu
 *                        une régression sur ses 39 paires.
 *   · `posts:check`    — rend « 0 articles vérifiés … ✓ all clear » depuis le
 *                        2026-07-03 (voir l'exemption plus bas).
 *
 * 🔑 La leçon est celle d'une campagne qui ne trouve que ce qu'elle a NOMMÉ.
 * Une garde qui énumère trois noms en dur ne peut pas voir le quatrième script
 * écrit après elle. Celle-ci énumère donc **depuis `package.json`** : tout
 * nouveau script de contrôle est couvert le jour où il est déclaré, sans que
 * personne ait à penser à l'ajouter ici.
 *
 * ## Ce qu'elle lit, et ce qu'elle refuse de lire
 *
 * ⚠️ Elle raisonne sur des lignes de **CODE** YAML, jamais sur du commentaire.
 * Ce fichier-ci cite `radius:check` et `contrast:check` dans son propre en-tête ;
 * les workflows en font autant. Un contrôle qui confond une explication avec le
 * fait qu'elle explique est faux — même piège que
 * `test-statique-trouve-ses-propres-commentaires`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const WORKFLOWS = path.join(RACINE, ".github", "workflows");

/**
 * Scripts volontairement NON câblés, avec la raison mesurée. Trois seulement,
 * et chacune est une raison de FOND — pas un « on verra plus tard ».
 *
 * ⚠️ Ce tableau ne doit pas grandir sans qu'une raison du même calibre y soit
 * écrite. Y ajouter une ligne, c'est décider qu'un contrôle ne protègera rien.
 */
const EXEMPTIONS: Readonly<Record<string, string>> = {
  // Itère `BLOG_POSTS`, que `src/content/blog/index.ts` déclare TABLEAU VIDE
  // depuis le 2026-07-03 : le blog est passé en base (Article/
  // ArticleTranslation) ce jour-là. Elle contrôle donc la qualité AEO
  // d'articles qui ne vivent plus là, et rend « 0 articles vérifiés …
  // ✓ all clear ». La câbler ajouterait une gate VERTE qui ne mesure rien —
  // c'est-à-dire de la fausse assurance, pire que pas de gate.
  // ⛔ DETTE : la rebrancher sur Article/ArticleTranslation, ou la supprimer.
  "posts:check":
    "sujet déménagé en base le 2026-07-03 — itère un tableau vide, « all clear » sur 0 article",

  // `linkinator http://localhost:3000 --recurse` exige un serveur VIVANT.
  // Gate A n'en a pas. Le câbler produirait un échec de connexion, pas une
  // mesure de liens. Reste un outil manuel, lancé contre un `next start` local.
  linkcheck: "exige un serveur vivant sur localhost:3000 — Gate A n'en a pas",

  // Délègue à `src/lib/__tests__/jsonld-validation.spec.ts` via `vitest run`.
  // Cette spec est DÉJÀ jouée par `pnpm test` en Gate A : la câbler en plus
  // ferait tourner les mêmes 11 tests deux fois. Ce n'est pas une orpheline,
  // c'est un raccourci de confort pour lancer une spec à la main.
  schemacheck: "délègue à jsonld-validation.spec.ts, déjà jouée par `pnpm test` en Gate A",
};

/** Lignes de CODE des workflows — commentaires retirés. */
function codeDesWorkflows(): string {
  if (!existsSync(WORKFLOWS)) return "";
  return readdirSync(WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => readFileSync(path.join(WORKFLOWS, f), "utf8"))
    .join("\n")
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
}

const SCRIPTS: ReadonlyArray<string> = Object.keys(
  (
    JSON.parse(readFileSync(path.join(RACINE, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts,
).filter((nom) => /check$/.test(nom));

const CODE = codeDesWorkflows();
const estCable = (nom: string): boolean =>
  CODE.includes(`pnpm ${nom}`) || CODE.includes(`npm run ${nom}`);

describe("Tout script de contrôle est appelé par une gate", () => {
  it("trouve bien des scripts à vérifier (le test ne peut pas passer à vide)", () => {
    // Sans ce contrôle, renommer la convention `*check` rendrait ce fichier
    // vert ET aveugle — le défaut même qu'il corrige.
    expect(
      SCRIPTS.length,
      "aucun script se terminant par « check » dans package.json — la convention a-t-elle changé ?",
    ).toBeGreaterThan(10);
    expect(CODE.length, "aucun workflow lu sous .github/workflows").toBeGreaterThan(1000);
  });

  it("aucun script de contrôle n'est orphelin", () => {
    const orphelines = SCRIPTS.filter((s) => !estCable(s) && !(s in EXEMPTIONS));
    expect(
      orphelines,
      `Ces scripts existent mais AUCUN workflow ne les exécute :\n${orphelines.join("\n")}\n\n` +
        `Une garde qu'on n'exécute pas n'arrête rien — elle enregistre la dérive.\n` +
        `Deux issues, et une seule est acceptable par défaut :\n` +
        `  1. la câbler dans .github/workflows/ci.yml (aligner le seuil D'ABORD si elle est rouge) ;\n` +
        `  2. l'ajouter à EXEMPTIONS avec une raison de FOND, mesurée, pas « on verra ».`,
    ).toEqual([]);
  });

  it("aucune exemption ne survit à son propre motif", () => {
    // Une exemption dont le script a été câblé entre-temps, ou supprimé de
    // package.json, est un commentaire qui ment. On la retire.
    const perimees = Object.keys(EXEMPTIONS).filter((s) => !SCRIPTS.includes(s) || estCable(s));
    expect(
      perimees,
      `Ces exemptions ne décrivent plus la réalité — retire-les :\n${perimees
        .map(
          (s) => `  ${s} — ${SCRIPTS.includes(s) ? "désormais CÂBLÉ" : "absent de package.json"}`,
        )
        .join("\n")}`,
    ).toEqual([]);
  });
});
