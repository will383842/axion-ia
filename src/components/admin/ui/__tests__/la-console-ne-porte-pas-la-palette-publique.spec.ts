/**
 * CLIQUET — la console ne se style pas avec la palette du site public.
 *
 * ## Le défaut mesuré (2026-09-06)
 *
 * `admin.css` porte, dans sa moitié basse, ~1250 lignes déplacées VERBATIM
 * depuis `globals.css` à la relocalisation de l'ADR 0028. Leur en-tête l'écrit
 * encore : « Pages temporaires V1 minimal. M9 livrera des composants stylisés
 * plus complets — ces classes seront remplacées à ce moment-là. » M9 est passé.
 * Elles sont toujours là, et elles référencent les jetons du site PUBLIC :
 * `--color-fg-muted`, `--color-border`, `--color-primary`, `--font-manrope`.
 *
 * 🔑 **Le test de jetons ne pouvait pas voir ça.** `admin-design-tokens.test.ts`
 * vérifie qu'un jeton référencé EXISTE. Ceux-ci existent parfaitement — ils
 * appartiennent simplement à un autre système. Une garde qui demande
 * « ce nom est-il défini ? » ne demandera jamais « est-ce le bon nom ? ».
 *
 * ### Ce que ça coûtait réellement
 *
 * · **Visible tout de suite** : `--font-manrope` était posé sur `.admin-textarea`,
 *   `.admin-tab` et la barre de l'éditeur riche. Manrope est la police
 *   ÉDITORIALE du site ; la console est en Inter depuis juin 2026. Toutes les
 *   zones de saisie longue de la console — la réponse à un contact, un gabarit
 *   d'e-mail — s'affichaient donc dans une autre police que le champ juste
 *   au-dessus. Ces trois règles étaient hors couche : elles écrasaient le
 *   `font-family: inherit` que `@layer base` pose sur les contrôles.
 *
 * · **Invisible, et c'est pire** : les couleurs. À la date de ce constat, huit
 *   paires valaient EXACTEMENT la même chose (`--color-fg-muted` et
 *   `--color-admin-fg-muted` résolvaient vers la même valeur). Rien ne se
 *   voyait, donc rien n'alertait — mais la console suivait la palette du site
 *   sans que personne ne l'ait décidé. Le jour où l'on retouche le beige du site
 *   public, la console bouge avec lui ; et le mode sombre de la console, lui,
 *   ne pourrait tout simplement pas atteindre ces 38 règles.
 *
 * Les 81 références dont la valeur était identique OCTET POUR OCTET ont été
 * migrées le 2026-09-06 — une substitution qui ne peut pas changer un pixel,
 * puisque les deux jetons résolvaient vers le même code hexadécimal. Les 38
 * règles ci-dessous portent les 10 jetons qui, eux, DIFFÈRENT : les basculer
 * changerait le rendu, ça se décide en le regardant. Elles sont donc gelées.
 *
 * ## Ce que ce fichier verrouille
 *
 * 1. **Les polices : tolérance zéro.** Aucune règle de la console ne référence
 *    un jeton de police publique. C'est réparé, donc c'est exigible.
 * 2. **Les couleurs : cliquet.** La liste ci-dessous ne peut que DIMINUER.
 *    Une règle nouvelle échoue ; une règle corrigée doit disparaître d'ici.
 *
 * ⚠️ On raisonne sur des lignes de CODE : les commentaires sont retirés avant
 * l'analyse. Cette en-tête cite elle-même `--font-manrope` et `--color-primary`,
 * et une garde qui confond une explication avec un usage est fausse — ce dépôt
 * l'a déjà payé (`test-statique-trouve-ses-propres-commentaires`).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const ADMIN_CSS = join(process.cwd(), "src", "app", "admin.css");

/**
 * Préfixes des jetons qui APPARTIENNENT à la console. Tout le reste est
 * emprunté au site public.
 */
const PREFIXES_ADMIN = [
  "--color-admin-",
  "--space-admin-",
  "--text-admin-",
  "--radius-admin-",
  "--shadow-admin-",
  "--control-admin-",
  "--lh-admin-",
  "--duration-admin",
  "--easing-admin",
  "--z-admin-",
  "--target-admin-",
  "--ring-admin-",
  "--font-admin",
  "--font-weight-admin-",
] as const;

function estJetonAdmin(nom: string): boolean {
  return PREFIXES_ADMIN.some((p) => nom.startsWith(p));
}

/**
 * Le fichier privé de ses commentaires ET de son bloc de déclaration.
 *
 * `@layer admin-tokens` est le SEUL endroit où la console a le droit de
 * nommer un jeton du site public : c'est là qu'elle emprunte sa fonte de
 * chasse fixe (`--font-admin-mono: var(--font-inconsolata, …)`). Le laisser
 * dans le balayage ferait échouer la garde sur le point d'emprunt unique
 * qu'elle a justement pour but d'établir. Tout le reste du fichier — les
 * règles — est analysé.
 */
function codeCss(): string {
  const sansCommentaires = readFileSync(ADMIN_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const debut = sansCommentaires.indexOf("@layer admin-tokens");
  if (debut < 0) return sansCommentaires;
  let profondeur = 0;
  let i = sansCommentaires.indexOf("{", debut);
  for (; i < sansCommentaires.length; i++) {
    if (sansCommentaires[i] === "{") profondeur++;
    else if (sansCommentaires[i] === "}" && --profondeur === 0) break;
  }
  return sansCommentaires.slice(0, debut) + sansCommentaires.slice(i + 1);
}

/**
 * Associe à chaque référence de jeton non-admin le sélecteur de la règle qui
 * la porte. Analyse ligne à ligne : `admin.css` est écrit par Prettier, donc
 * une accolade ouvrante termine toujours la liste de sélecteurs.
 */
function reglesSurPalettePublique(css: string, famille: "color" | "font"): string[] {
  const trouvees = new Set<string>();
  let selecteur = "";
  for (const ligne of css.split("\n")) {
    const ouvre = ligne.indexOf("{");
    if (ouvre >= 0) {
      selecteur = `${selecteur} ${ligne.slice(0, ouvre)}`.trim().replace(/\s+/g, " ");
    }
    for (const m of ligne.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      const jeton = m[1] as string;
      if (!jeton.startsWith(`--${famille}-`)) continue;
      if (estJetonAdmin(jeton)) continue;
      if (selecteur) trouvees.add(selecteur);
    }
    if (ligne.includes("}")) selecteur = "";
    else if (ouvre < 0 && ligne.trim() && !ligne.includes(":")) {
      selecteur = `${selecteur} ${ligne}`.trim().replace(/\s+/g, " ");
    }
  }
  return [...trouvees].sort();
}

/**
 * Les 38 règles encore sur la palette publique au 2026-09-06.
 *
 * CETTE LISTE NE DOIT QUE DIMINUER. Elle porte 10 jetons dont la valeur
 * DIFFÈRE de leur équivalent admin — `--color-bg`, `--color-terracotta`,
 * `--color-sage`, `--color-error`, `--color-warning`, `--color-success`,
 * et leurs déclinaisons `-soft` / `-deep`. Corriger une entrée demande de
 * regarder l'écran, pas seulement le fichier.
 */
const RATTRAPAGE_COULEURS_PUBLIQUES: readonly string[] = [
  ".admin-2fa-code",
  ".admin-alert-badge",
  ".admin-badge-active",
  ".admin-badge-admin",
  ".admin-badge-reader",
  ".admin-badge-super_admin",
  ".admin-badge-suspended",
  ".admin-calendar-cell-blocked",
  ".admin-calendar-cell-empty",
  ".admin-calendar-cell-link:hover",
  ".admin-calendar-cell-prereserved",
  ".admin-calendar-cell-reserved",
  ".admin-calendar-cell-validated",
  '.admin-cmdk-item[data-selected="true"], .admin-cmdk-item:hover',
  ".admin-cmdk-trigger:hover",
  ".admin-form-block",
  ".admin-input-toggle:hover",
  ".admin-json",
  ".admin-kpi-link:hover",
  ".admin-layout",
  ".admin-reschedule-booking:hover",
  ".admin-reschedule-slot-available",
  ".admin-reschedule-slot-blocked",
  ".admin-reschedule-slot-over",
  ".admin-reschedule-slot-reserved",
  ".admin-severity-critical",
  ".admin-severity-warning",
  ".admin-status-degraded, .admin-status-down",
  ".admin-status-down",
  ".admin-status-ok",
  ".admin-status-pill",
  ".admin-tags-grid",
  ".admin-urgency-critical",
  ".admin-urgency-high",
  ".admin-urgency-medium td:first-child::before",
  ".tiptap-content code",
  ".tiptap-toolbar",
  ".tiptap-toolbar .tiptap-btn-active",
];

describe("la console ne se style pas avec la palette du site public", () => {
  const css = codeCss();

  it("🔑 CONTRE-TÉMOIN : l'analyse voit réellement des règles", () => {
    // Sans ceci, un `admin.css` renommé ou un analyseur cassé rendrait une
    // liste vide, et les deux tests suivants passeraient au vert sans avoir
    // examiné une seule règle. Un zéro doit toujours pouvoir être distingué
    // de « je ne mesure rien ».
    const toutesRegles = css.split("\n").filter((l) => l.includes("{")).length;
    expect(toutesRegles, "l'analyse ne trouve plus aucune règle dans admin.css").toBeGreaterThan(
      300,
    );
    const avecJetonsAdmin = reglesSurPalettePublique(
      css.replace(/--color-admin-/g, "--color-"),
      "color",
    );
    expect(
      avecJetonsAdmin.length,
      "en neutralisant le préfixe admin, l'analyse devrait voir BEAUCOUP de règles — " +
        "si elle n'en voit pas, c'est l'analyseur qui est cassé, pas le fichier qui est propre",
    ).toBeGreaterThan(100);
  });

  it("n'emprunte la fonte publique QU'À UN SEUL endroit — la déclaration du jeton", () => {
    // Le bloc de déclaration est retiré du balayage ci-dessus. Ce test le
    // regarde donc à part : la console emprunte bien l'Inconsolata du site
    // (il n'y en a qu'une), mais elle doit le faire une fois, dans son propre
    // jeton, et jamais depuis une règle. Sans cette vérification, l'exclusion
    // du bloc serait un angle mort au lieu d'être une exception cadrée.
    const brut = readFileSync(ADMIN_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const emprunts = [...brut.matchAll(/var\(\s*--font-inconsolata/g)];
    expect(
      emprunts.length,
      "la fonte de chasse fixe du site public doit être empruntée EXACTEMENT une fois, " +
        "dans la déclaration de `--font-admin-mono`",
    ).toBe(1);
    expect(
      brut.includes("--font-admin-mono: var(--font-inconsolata"),
      "l'unique emprunt doit être celui de `--font-admin-mono`",
    ).toBe(true);
  });

  it("ne référence AUCUN jeton de police du site public", () => {
    const fautives = reglesSurPalettePublique(css, "font");
    expect(
      fautives,
      "🔴 Une règle de la console impose une police du site PUBLIC.\n" +
        "\n" +
        "   La console est en Inter (`--font-admin`) et en Inconsolata pour la\n" +
        "   chasse fixe (`--font-admin-mono`). `--font-manrope`, `--font-sans`,\n" +
        "   `--font-serif`, `--font-fraunces` et `--font-mono` appartiennent au\n" +
        "   site éditorial : posés ici, ils rendent le texte concerné dans une\n" +
        "   AUTRE police que le reste de l'écran — et comme ces règles sont hors\n" +
        "   couche, elles écrasent le `font-family: inherit` de `@layer base`.\n" +
        "\n" +
        "   Remède : retirer la déclaration (l'héritage donne Inter), ou pointer\n" +
        "   `var(--font-admin-mono)` s'il s'agit vraiment de chasse fixe.",
    ).toEqual([]);
  });

  it("n'ajoute AUCUNE nouvelle règle sur la palette de couleurs publique", () => {
    const fautives = reglesSurPalettePublique(css, "color");
    const nouvelles = fautives.filter((r) => !RATTRAPAGE_COULEURS_PUBLIQUES.includes(r));
    expect(
      nouvelles,
      "🔴 Une règle de la console se style avec la palette du site PUBLIC.\n" +
        "\n" +
        "   Ce n'est pas une faute de frappe : ces jetons existent, donc\n" +
        "   `admin-design-tokens.test.ts` les accepte. Ils appartiennent\n" +
        "   simplement à l'autre système. Conséquences : la console suit les\n" +
        "   retouches du site sans décision, et un futur mode sombre de la\n" +
        "   console n'atteindra pas cette règle.\n" +
        "\n" +
        "   Remède : utiliser le jeton `--color-admin-*` correspondant. S'il\n" +
        "   n'existe pas, le déclarer dans `@layer admin-tokens` (admin.css).\n" +
        "   NE PAS ajouter la règle au rattrapage ci-dessous : cette liste est\n" +
        "   une dette gelée, pas une porte d'entrée.",
    ).toEqual([]);
  });

  it("le rattrapage ne contient aucune entrée périmée", () => {
    const fautives = reglesSurPalettePublique(css, "color");
    const perimees = RATTRAPAGE_COULEURS_PUBLIQUES.filter((r) => !fautives.includes(r));
    expect(
      perimees,
      "🟢 Ces règles ont été corrigées : retirez-les de RATTRAPAGE_COULEURS_PUBLIQUES.\n" +
        "\n" +
        "   Un cliquet qui garde ses entrées corrigées ne mesure plus la dette :\n" +
        "   il la surestime, et la prochaine régression pourra se glisser dans\n" +
        "   une ligne que plus personne ne relit.",
    ).toEqual([]);
  });
});
