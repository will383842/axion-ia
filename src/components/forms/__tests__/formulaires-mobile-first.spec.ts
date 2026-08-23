/**
 * Garde-fou MOBILE-FIRST des formulaires publics — posé le 2026-08-22 après un
 * défaut mesuré en production sur `/fr/carrieres/<offre>/postuler`.
 *
 * ── Ce qui s'était passé ────────────────────────────────────────────────────
 *
 * Le formulaire de candidature à une offre d'emploi débordait du bord droit de
 * l'écran sur les téléphones étroits : +9 px à 360 px de large, +49 px à 320.
 * Comme la `<section>` porte `overflow-hidden`, ce n'était même pas scrollable
 * — le texte était COUPÉ. Un candidat sur un téléphone d'entrée de gamme
 * voyait un formulaire cassé.
 *
 * Deux causes, en série :
 *
 *   1. `<input type="file">` natif. Chrome lui donne une largeur intrinsèque
 *      incompressible (312 px mesurés : bouton « Choisir un fichier » +
 *      « Aucun fichier sélectionné »). Il ne rétrécit pas.
 *   2. `<fieldset>` — et lui seul parmi les conteneurs — porte
 *      `min-inline-size: min-content` dans la feuille de style du NAVIGATEUR.
 *      Il refuse donc de descendre sous la largeur minimale de son contenu,
 *      quoi qu'en dise son parent. Le fieldset se calait à 312 px dans un
 *      `<form>` de 246 px, et poussait toute la colonne hors de l'écran.
 *
 * ── Pourquoi un test STATIQUE ───────────────────────────────────────────────
 *
 * Un test de rendu ne verrait le défaut que sur la page qu'il visite, à la
 * largeur qu'il a choisie, et seulement si cette page est joignable (celle-ci
 * exige une offre en base). Le défaut, lui, est ARCHITECTURAL : il revient dès
 * qu'on écrit un `<fieldset>` sans garde ou qu'on rend un champ fichier natif
 * visible. C'est donc la règle d'écriture qu'on verrouille, pas une capture.
 *
 * Les deux règles ci-dessous sont vérifiées sur `src/components/forms/**`,
 * c'est-à-dire les formulaires PUBLICS (la console admin est hors périmètre :
 * elle est noindex et consultée au bureau).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FORMS_DIR = path.resolve(process.cwd(), "src", "components", "forms");

function fichiersTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dir)) {
    const abs = path.join(dir, entree);
    if (statSync(abs).isDirectory()) {
      if (entree === "__tests__") continue;
      out.push(...fichiersTsx(abs));
      continue;
    }
    if (!abs.endsWith(".tsx")) continue;
    if (abs.endsWith(".test.tsx") || abs.endsWith(".spec.tsx")) continue;
    out.push(abs);
  }
  return out;
}

/** Chemin lisible dans le message d'échec — un chemin absolu Windows ne dit rien. */
const court = (abs: string) => path.relative(process.cwd(), abs).replace(/\\/g, "/");

/**
 * 🔴 Masque les COMMENTAIRES avant toute recherche.
 *
 * Premier jet de ce test : il accusait ses propres explications. Le bloc de
 * doc ci-dessus cite `<fieldset>` et `<input type="file">` pour dire ce qu'il
 * ne faut pas écrire — et le test les comptait comme des violations, dans le
 * fichier même qui corrige le défaut. Un test statique qui lit la prose ne
 * mesure pas le code : il mesure sa propre documentation, et il devient
 * impossible d'expliquer une règle sans la violer.
 *
 * Les commentaires sont remplacés par des espaces (et non supprimés) pour que
 * les NUMÉROS DE LIGNE des messages d'échec restent justes. Les chaînes de
 * caractères, elles, sont conservées : c'est là que vivent les `className`.
 */
function masquerCommentaires(src: string): string {
  let out = "";
  let i = 0;
  let mode: "code" | "ligne" | "bloc" | "'" | '"' | "`" = "code";
  while (i < src.length) {
    const c = src[i]!;
    const d = src[i + 1];
    if (mode === "code") {
      if (c === "/" && d === "/") {
        mode = "ligne";
        out += "  ";
        i += 2;
      } else if (c === "/" && d === "*") {
        mode = "bloc";
        out += "  ";
        i += 2;
      } else if (c === "'" || c === '"' || c === "`") {
        mode = c;
        out += c;
        i += 1;
      } else {
        out += c;
        i += 1;
      }
      continue;
    }
    if (mode === "ligne") {
      if (c === "\n") mode = "code";
      out += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (mode === "bloc") {
      if (c === "*" && d === "/") {
        mode = "code";
        out += "  ";
        i += 2;
      } else {
        out += c === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    // Dans une chaîne : on garde le contenu tel quel.
    if (c === "\\") {
      out += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === mode) mode = "code";
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Numéro de ligne d'un index de caractère. Sans lui, le message dit « ce
 * fichier a un problème » et laisse chercher dans 950 lignes.
 */
function ligne(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

const FICHIERS = fichiersTsx(FORMS_DIR);

describe("Formulaires publics — mobile-first", () => {
  it("le corpus scanné n'est pas vide", () => {
    // Témoin : si un renommage de dossier vidait la liste, les deux tests
    // suivants passeraient au vert sans rien avoir vérifié.
    expect(FICHIERS.length).toBeGreaterThan(4);
  });

  it("chaque <fieldset> porte min-w-0 (sinon il refuse de rétrécir)", () => {
    const fautes: string[] = [];

    for (const abs of FICHIERS) {
      const src = masquerCommentaires(readFileSync(abs, "utf8"));
      // On lit la balise ouvrante entière, attributs compris.
      const re = /<fieldset\b[^>]*>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const balise = m[0];
        // La classe peut être un littéral (`className="min-w-0 …"`) ou une
        // constante du fichier (`className={FIELDSET}`) : dans le second cas on
        // vérifie que la constante elle-même contient `min-w-0`.
        const viaConstante = /className=\{([A-Z_][A-Za-z0-9_]*)\}/.exec(balise);
        let porteLaGarde = balise.includes("min-w-0");
        if (!porteLaGarde && viaConstante) {
          const nom = viaConstante[1];
          const decl = new RegExp(`const\\s+${nom}\\s*=\\s*["'\`]([^"'\`]*)["'\`]`).exec(src);
          porteLaGarde = !!decl && decl[1]!.includes("min-w-0");
        }
        if (!porteLaGarde) {
          fautes.push(
            `${court(abs)}:${ligne(src, m.index)} → ${balise.slice(0, 80)}\n` +
              `    Un <fieldset> porte min-inline-size:min-content (feuille de style navigateur) : ` +
              `sans min-w-0 il peut pousser toute la page hors de l'écran sur un téléphone étroit.`,
          );
        }
      }
    }

    expect(fautes, `\n${fautes.join("\n")}\n`).toEqual([]);
  });

  it('aucun <input type="file"> natif VISIBLE (largeur incompressible ~312 px)', () => {
    const fautes: string[] = [];

    for (const abs of FICHIERS) {
      const src = masquerCommentaires(readFileSync(abs, "utf8"));
      // Balise complète, y compris multi-lignes (le formatage prettier les casse).
      const re = /<input\b[^>]*?type="file"[^>]*?\/?>/gs;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const balise = m[0];
        if (!/className=\{?["'`][^"'`]*\bsr-only\b/.test(balise)) {
          fautes.push(
            `${court(abs)}:${ligne(src, m.index)}\n` +
              `    Le contrôle fichier natif ne rétrécit pas (312 px mesurés sous Chrome). ` +
              `Le masquer en \`sr-only\` et poser un <label htmlFor> stylé comme déclencheur ` +
              `— patron déjà en production dans ReviewSubmissionForm.tsx.`,
          );
        }
      }
    }

    expect(fautes, `\n${fautes.join("\n")}\n`).toEqual([]);
  });
});
