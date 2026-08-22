/**
 * Verrou GEO-123 / GEO-122 — structure du document servi aux moteurs et aux
 * technologies d'assistance (audit GEO/AEO end-to-end du 2026-08-14).
 *
 * ## Le défaut que ce fichier existe pour empêcher
 *
 * Le layout `src/app/[locale]/layout.tsx` porte `<main id="main">`, cible du
 * lien d'évitement (`SkipToContent.tsx`). Quatre pages publiques ouvraient un
 * SECOND `<main>` à l'intérieur : `/appel`, `/catalogue`, `/galerie` et
 * `/galerie/[slug]`. Un document qui porte deux `<main>` imbriqués n'a plus de
 * contenu principal identifiable — ni pour un lecteur d'écran, ni pour les
 * extracteurs de contenu principal des moteurs de réponse.
 *
 * ## Pourquoi une garde STATIQUE
 *
 * Le rendu réel de ces pages exige next-intl, Prisma et un scope de requête :
 * les monter en test coûterait un harnais entier pour vérifier une propriété
 * qui est, elle, purement syntaxique. On lit donc la source.
 *
 * ⚠️ La garde axe existante ne couvre PAS ce cas : `landmark-one-main` n'est pas
 * dans son jeu de règles par défaut, et WCAG 2.5.3 (« Label in Name », GEO-122)
 * y est marquée expérimentale. C'est précisément pour ça que ce fichier existe.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE_LOCALE = path.resolve(process.cwd(), "src/app/[locale]");

/**
 * Le SEUL fichier autorisé à ouvrir un `<main>` sous `src/app/[locale]`.
 * C'est le repère unique du document et la cible du lien d'évitement.
 */
const PORTEUR_LEGITIME = "layout.tsx";

/**
 * Coquilles applicatives HORS surface publique indexable, qui portent encore
 * leur propre `<main>`.
 *
 * 🔴 Ce ne sont PAS des cas sains : elles sont imbriquées dans le `<main>` du
 * layout `[locale]` comme les autres. Elles sont exclues parce que leur
 * correction touche des interfaces `noindex` sans effet GEO. Les retirer de
 * cette liste sans corriger les fichiers fera rougir la garde — c'est voulu :
 * la dette reste visible.
 *
 * ✅ 2026-08-22 — LA CONSOLE D'ADMINISTRATION EST SOLDÉE. Ce n'était pas une
 * dette théorique : axe-core, lancé pour la première fois sur les quatre pages
 * Qualiopi de la console, rendait trois violations `moderate` PAR PAGE —
 * `landmark-main-is-top-level`, `landmark-no-duplicate-main`,
 * `landmark-unique`. Le groupe de routes `(admin)` n'ayant aucun `layout.tsx`
 * propre, il hérite de la coquille publique : le `<main>` de la console était
 * donc bel et bien imbriqué dans celui du site. Les deux `<main>` de
 * `(admin)/[adminPrefix]/layout.tsx` sont devenus des `<div>`, `.admin-main`
 * inchangé. L'exemption est retirée : ce que la garde protégeait n'existe plus.
 *
 * 🔑 La dette était visible depuis longtemps dans ce commentaire. Ce qui a
 * manqué, c'est qu'AUCUN outil ne la mesurait : le canari du test
 * d'accessibilité admin ne pouvait pas matcher, donc axe n'y était jamais passé.
 */
const COQUILLES_NON_PUBLIQUES = ["espace-ressources/layout.tsx"];

function fichiersTsx(racine: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(racine)) {
    const complet = path.join(racine, entree);
    if (statSync(complet).isDirectory()) {
      out.push(...fichiersTsx(complet));
    } else if (entree.endsWith(".tsx")) {
      out.push(complet);
    }
  }
  return out;
}

/**
 * Retire commentaires de bloc et de ligne : ils citent `<main>` en toutes
 * lettres, et une recherche naïve s'y trouverait elle-même.
 *
 * 🔴 Ne PAS ajouter de règle « commentaire JSX » (accolade + commentaire de
 * bloc + accolade). Essayée puis retirée : son `[\s\S]` paresseux saute d'une
 * accolade ouvrante à la première fin de commentaire suivie d'une accolade
 * fermante, **quelle que soit la distance** — sur `ServicesGrid.tsx` elle
 * emportait 7 Ko de code sur 12, et les assertions passaient au vert sur un
 * fichier vidé. La règle bloc ci-dessous suffit : elle
 * retire le corps du commentaire, les accolades résiduelles sont inoffensives
 * pour une recherche de sous-chaîne.
 */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const FICHIERS = fichiersTsx(RACINE_LOCALE);

describe("structure du document — un seul <main> (GEO-123)", () => {
  it("garde anti-test-vide : l'arborescence est bien parcourue", () => {
    // Un chemin qui change et une liste vide rendraient le test suivant vert
    // sans rien vérifier — c'est le mode d'échec n°1 de ce genre de garde.
    expect(FICHIERS.length, "aucun .tsx trouvé sous src/app/[locale]").toBeGreaterThan(100);
    const layout = FICHIERS.find((f) => path.basename(f) === PORTEUR_LEGITIME && !f.includes("("));
    expect(layout, "le layout [locale] est introuvable").toBeDefined();
  });

  it("le layout [locale] porte bien LE <main>, cible du lien d'évitement", () => {
    const src = readFileSync(path.join(RACINE_LOCALE, "layout.tsx"), "utf8");
    expect(
      /<main\s+id="main"/.test(src),
      'le repère unique `<main id="main">` a disparu du layout : le lien ' +
        "d'évitement de `SkipToContent.tsx` ne pointe plus sur rien.",
    ).toBe(true);
  });

  it("aucune autre page publique n'ouvre un <main>", () => {
    const fautifs: string[] = [];
    for (const fichier of FICHIERS) {
      const relatif = path.relative(RACINE_LOCALE, fichier).split(path.sep).join("/");
      if (relatif === PORTEUR_LEGITIME) continue;
      if (COQUILLES_NON_PUBLIQUES.includes(relatif)) continue;
      if (/<main[\s>]/.test(sansCommentaires(readFileSync(fichier, "utf8")))) {
        fautifs.push(relatif);
      }
    }
    expect(
      fautifs,
      "ces pages ouvrent un second `<main>`, imbriqué dans celui du layout : le " +
        "contenu principal du document n'est plus identifiable. Utiliser `<div>` " +
        "ou `<section aria-labelledby>`.",
    ).toEqual([]);
  });
});

describe("nom accessible des cartes de service — WCAG 2.5.3 (GEO-122)", () => {
  const SRC = sansCommentaires(
    readFileSync(path.resolve(process.cwd(), "src/components/services/ServicesGrid.tsx"), "utf8"),
  );

  it("la carte ne porte plus d'`aria-label` tronqué par défaut", () => {
    // L'ancien code posait `aria-label={cardAriaLabel?.(ctx) ?? ariaName}` :
    // sans libellé explicite, le nom accessible tombait sur le seul nom du
    // service, plus court que le texte visible de la carte.
    expect(
      /aria-label=\{cardAriaLabel\?\./.test(SRC),
      "le repli `aria-label` tronqué est revenu : le nom accessible redevient " +
        "plus court que le libellé visible (WCAG 2.5.3 échoué).",
    ).toBe(false);
  });

  it("le nom accessible pointe le titre VISIBLE via aria-labelledby", () => {
    expect(/aria-labelledby.*titleId|"aria-labelledby": titleId/.test(SRC)).toBe(true);
    expect(
      SRC.includes("id={titleId}"),
      "aucun élément ne porte `id={titleId}` : `aria-labelledby` pointerait dans le vide.",
    ).toBe(true);
  });

  it("un libellé explicite fourni par l'appelant reste prioritaire", () => {
    // `cardAriaLabel` est un choix délibéré de l'appelant, pas une troncature
    // accidentelle : le patch ne doit pas l'écraser.
    expect(SRC.includes("cardAriaLabel")).toBe(true);
  });
});
