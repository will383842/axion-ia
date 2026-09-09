// Garde-fou du système de design de la console — refonte UI 2026-08-01.
//
// POURQUOI CE TEST EXISTE
// -----------------------
// Une variable CSS absente ne casse rien bruyamment : la déclaration est
// simplement ignorée par le navigateur. Un `bg-[color:var(--color-admin-surface)]`
// dont le jeton n'existe pas donne un élément SANS FOND, pas une erreur. Idem
// pour une classe `.admin-*` jamais définie : le bouton s'affiche avec le rendu
// gris par défaut du système, au milieu d'une console stylée.
//
// C'est la panne la plus difficile à voir en revue de diff, et elle s'est déjà
// produite trois fois sur ce projet :
//   - `--color-admin-accent` : 84 fichiers, bouton « Approuver et envoyer »
//     rendu en texte blanc sur fond beige — invisible en production ;
//   - `--color-admin-error` : ~84 fichiers, messages d'échec sans couleur ;
//   - audit du 2026-08-01 : 25 jetons et 18 classes supplémentaires, soit
//     295 occurrences CSS muettes réparties sur une centaine de fichiers.
//
// Ce test scanne le code de la console et échoue si une référence ne
// correspond à aucune définition de `src/app/admin.css`.
//
// QUE FAIRE SI CE TEST ÉCHOUE
// ---------------------------
// Deux réparations possibles, jamais une troisième :
//   1. le nom référencé est le bon → définir le jeton/la classe dans
//      `src/app/admin.css` (un alias suffit souvent) ;
//   2. le nom est une coquille ou un synonyme → corriger la référence.
// Ne PAS ajouter à l'allowlist ci-dessous : elle est réservée aux chaînes
// `admin-*` qui ne sont pas des classes CSS (clés de cache, de stockage local,
// préfixe d'URL…).

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../../..");
const ADMIN_CSS = join(ROOT, "src/app/admin.css");
const SCAN_DIRS = [join(ROOT, "src/app/[locale]/(admin)"), join(ROOT, "src/components/admin")];

/**
 * Chaînes qui commencent par `admin-` mais ne désignent PAS une classe CSS :
 * clés de cache `unstable_cache`, clés `localStorage`, préfixe d'URL secret par
 * défaut, identifiants de déclencheur. Toute entrée ajoutée ici doit être
 * justifiée — sinon on masque précisément le bug que ce test traque.
 */
const NON_CSS_ADMIN_STRINGS = new Set([
  "admin-dev-x7k2n9", // valeur de repli de ADMIN_URL_PREFIX (layout admin)
  "admin-ci-build", // valeur de ADMIN_URL_PREFIX en intégration continue
  "admin-contacts-unread-count", // clé unstable_cache (layout admin)
  "admin-recompute", // identifiant de déclencheur (web-vitals)
  "admin-sidebar-collapsed", // clé localStorage (AdminSidebarNav)
  "admin-sidebar-groups-collapsed-v2", // clé localStorage (AdminSidebarNav)
  "admin-sidebar-mobile", // identifiant d'élément (AdminSidebarNav)
  "admin-content-gen-poles-collapsed-v1", // clé localStorage (content-gen)
  "admin-nav", // segment de chemin de module (@/lib/admin-nav)
  "admin-labels", // segment de chemin de module (content-gen/shared)
  "admin-form-state", // segment de chemin de module (features/payment-schedule)
  "admin-inbox", // segment de chemin de module (features/admin-inbox)
  "admin-auth", // segment de chemin de module
  "admin-tokens", // nom de couche CSS
  "admin-login", // nom de fenêtre window.open (AdminSessionExpiryWarning)
]);

/**
 * Classes purement « crochets » : posées pour être ciblées par un test, un
 * sélecteur d'impression ou un futur style, sans déclaration propre. Elles
 * accompagnent TOUJOURS des classes utilitaires qui portent le rendu réel.
 *
 * ⚠️ CETTE LISTE EST UNE DETTE, PAS UN CONFORT — 2026-08-02.
 *
 * Quatre entrées y figuraient à tort : `admin-confirm-modal`,
 * `admin-conflict-modal`, `admin-session-expiry-modal` et
 * `admin-table-empty-wrapper`. Elles n'accompagnaient AUCUNE utilitaire : elles
 * étaient la SEULE classe de leur élément. Les exempter revenait à écrire
 * « cet élément n'a pas besoin de style » là où il fallait lire « on ne l'a
 * pas encore stylé ».
 *
 * Résultat concret : les trois boîtes de dialogue de la console — celles où
 * l'on confirme une suppression — s'affichaient avec le style PAR DÉFAUT du
 * navigateur, sans rembourrage, sans ombre et sans voile. Le test était vert.
 *
 * Avant d'ajouter une entrée ici, vérifiez qu'une utilitaire porte bien le
 * rendu sur le MÊME élément. Sinon ce n'est pas un crochet, c'est un style
 * manquant.
 */
const HOOK_ONLY_CLASSES = new Set([
  "admin-layout-v2",
  "admin-page-shell",
  "admin-page-header",
  "admin-card-v2",
  "admin-badge-v2",
  "admin-stat-card",
  "admin-empty-state",
  "admin-error-state",
  "admin-loading-state",
  "admin-breadcrumbs",
  "admin-filter-tabs",
  "admin-filter-chip",
  "admin-form-section",
  "admin-bulk-actions",
  "admin-undo-toast",
  "admin-autosave-indicator",
  "admin-keyboard-hint",
  "admin-notifications-dropdown",
  "admin-user-menu",
  "admin-topbar",
  "admin-inline-edit-view",
  "admin-inline-edit-edit",
  "admin-confirm-title",
  "admin-confirm-desc",
  "admin-confirm-type-input",
  "admin-conflict-title",
  "admin-conflict-desc",
  "admin-session-expiry-title",
  "admin-session-expiry-desc",
  "admin-field-email-hint",
]);

/**
 * Combinaisons `.admin-*` + utilitaire Tailwind INERTE encore tolérées.
 *
 * Il y en avait 17 au moment de la refonte UI 2026-08-01, chacune un défaut
 * silencieux réel : `admin-input w-20` laissait le champ en pleine largeur au
 * lieu de 6 rem, `admin-button-ghost text-red-600` laissait le bouton de
 * suppression en noir. Toutes ont été remplacées par des modificateurs définis
 * dans admin.css (`.admin-button-block`, `.admin-button-ghost-danger`,
 * `.admin-input-w-sm`, `.admin-input-w-md`), au même niveau de cascade.
 *
 * La liste était alors vide — mais le contrôle EXCLUAIT les valeurs arbitraires
 * (`text-[color:var(--…)]`, `w-[70px]`), qui vivent pourtant dans la même couche
 * `utilities` et sont donc tout aussi inertes. Le 2026-08-01, la levée de cette
 * exclusion a révélé 25 combinaisons bien réelles, dont :
 *   - quatre boutons de suppression rendus en NOIR au lieu de rouge ;
 *   - le kill-switch de la génération de contenus et un bouton de suppression de
 *     publication rendus en terracotta ORDINAIRE — une action destructive
 *     indiscernable d'une action banale.
 * Ces sept-là sont corrigés (`.admin-button-danger`, `.admin-button-ghost-danger`).
 *
 * Les 22 restantes sont surtout des tailles de police et des largeurs de champ :
 * moins graves, mais tout aussi mortes. CLIQUET — cette liste ne doit que
 * DIMINUER. Corriger une entrée, c'est retirer sa ligne ci-dessous.
 */
const INERT_UTILITIES_BASELINE: readonly string[] = [
  // 🟢 VIDE depuis le 2026-09-06 — les 18 dernières entrées ont été corrigées.
  //
  // Ce qu'elles cachaient réellement, une fois ouvertes :
  //   · 7 champs demandaient la chasse fixe et ne l'ont JAMAIS eue (éditeurs de
  //     gabarit, de JSON, de llms.txt, identifiant Calendly) — leurs colonnes
  //     ne s'alignaient pas, ce qui est tout l'intérêt d'un éditeur pareil ;
  //   · 9 boutons d'action de ligne s'affichaient à la taille standard dans des
  //     listes denses conçues pour du compact ;
  //   · 1 champ de nombre restait aligné à gauche ;
  //   · 1 `inline-block` contredisait le `display:inline-flex` de sa classe.
  //
  // Remède : quatre modificateurs déclarés dans `admin.css` au MÊME niveau de
  // cascade que les classes qu'ils modifient — `.admin-input-sm`,
  // `.admin-input-mono`, `.admin-input-right`, `.admin-button-xs` — plus
  // `.admin-button-sm`, qui existait déjà et n'était pas utilisé.
  //
  // ⚠️ CETTE LISTE NE DOIT JAMAIS REPARTIR À LA HAUSSE. Une entrée ajoutée ici
  // est un style que l'auteur croit avoir posé et que personne ne verra. Si la
  // suite échoue sur une nouvelle combinaison, le remède est un modificateur
  // dans `admin.css`, pas une ligne de plus ci-dessous.
];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const cssSource = readFileSync(ADMIN_CSS, "utf8");
const files = SCAN_DIRS.flatMap(walk);

/** Toute déclaration `--nom: valeur` du fichier de design de la console. */
const definedTokens = new Set(
  [...cssSource.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string),
);

/** Tout sélecteur de classe `.admin-…` déclaré dans le fichier. */
const definedClasses = new Set(
  [...cssSource.matchAll(/\.(admin-[a-z0-9-]+)/g)].map((m) => m[1] as string),
);

describe("système de design de la console admin", () => {
  it("expose au moins tous les jetons de base (le fichier a bien été lu)", () => {
    expect(definedTokens.has("--color-admin-bg")).toBe(true);
    expect(definedClasses.has("admin-button")).toBe(true);
    expect(files.length).toBeGreaterThan(200);
  });

  it("ne référence aucun jeton `--*-admin-*` non défini dans admin.css", () => {
    const offenders = new Map<string, string[]>();

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // Capture `var(--x-admin-y)` SANS valeur de repli. Un `var(--x, repli)`
      // reste sûr même si le jeton manque, on ne l'exige donc pas.
      // Les noms construits dynamiquement (`var(--color-admin-rail-${k})`) ne
      // matchent pas : `${` sort de la classe de caractères.
      for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]*admin[a-z0-9-]*)\s*\)/g)) {
        const token = m[1] as string;
        if (definedTokens.has(token)) continue;
        const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
        offenders.set(token, [...(offenders.get(token) ?? []), rel]);
      }
    }

    const report = [...offenders.entries()]
      .map(([token, where]) => `${token} → ${where.length} fichier(s), ex. ${where[0]}`)
      .sort();
    expect(report).toEqual([]);
  });

  it("ne pose aucune classe `admin-*` non définie dans admin.css", () => {
    const offenders = new Map<string, string[]>();

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      // On n'inspecte que les littéraux entre guillemets doubles qui
      // ressemblent à une liste de classes : pas de `/` (chemins de module),
      // pas de `(` ni de `--` (valeurs `var(...)` déjà couvertes plus haut).
      for (const m of src.matchAll(/"([^"\n]*)"/g)) {
        const literal = m[1] as string;
        if (!literal.includes("admin-")) continue;
        for (const word of literal.split(/\s+/)) {
          if (!/^admin-[a-z0-9-]+$/.test(word)) continue;
          if (definedClasses.has(word)) continue;
          if (HOOK_ONLY_CLASSES.has(word)) continue;
          if (NON_CSS_ADMIN_STRINGS.has(word)) continue;
          const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
          offenders.set(word, [...(offenders.get(word) ?? []), rel]);
        }
      }
    }

    const report = [...offenders.entries()]
      .map(([cls, where]) => `.${cls} → ${where.length} usage(s), ex. ${where[0]}`)
      .sort();
    expect(report).toEqual([]);
  });

  // Les classes `.admin-*` de admin.css sont volontairement HORS COUCHE CSS.
  // Une règle hors couche l'emporte sur toute règle en couche, donc sur
  // `utilities` où vivent les classes Tailwind — quelle que soit la
  // spécificité. Un `className="admin-button w-full"` produit donc un bouton
  // de largeur automatique : la classe est présente, elle ne fait rien, et
  // rien ne le signale. Le remède est un modificateur défini dans admin.css
  // (`.admin-button-block`), au même niveau de cascade.
  it("ne combine pas une classe `.admin-*` avec un utilitaire Tailwind qu'elle neutralise", () => {
    // Pour chaque famille de classes, les propriétés qu'elle fixe et les
    // préfixes d'utilitaires Tailwind qui deviendraient donc inertes.
    const CONFLICTS: Array<{ base: RegExp; utilities: RegExp }> = [
      // `.admin-button*` fixe largeur, marges internes, typographie, rayon, fond,
      // ET la mise en page interne (`display: inline-flex`, `align-items`,
      // `justify-content`, `gap`) — ajoutée le 2026-08-01 après qu'un
      // `admin-button-ghost … gap-[var(--space-admin-2)]` posé le même jour se
      // soit révélé inerte : la classe impose déjà `gap: var(--space-admin-4)`.
      {
        base: /^admin-button(-secondary|-ghost|-danger|-cta)?$/,
        utilities:
          /^(w|min-w|max-w|px|py|p|text|font|rounded|bg|items|justify|gap)-|^(inline-flex|flex|inline-block|block|grid)$/,
      },
      // `.admin-input` fixe largeur, hauteur, marges internes, rayon, fond,
      // bordure et typographie.
      {
        base: /^admin-input$/,
        utilities: /^(w|h|px|py|p|rounded|bg|border|text|font)-/,
      },
    ];

    const offenders = new Set<string>();

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/"([^"\n]*)"/g)) {
        const words = (m[1] as string).split(/\s+/).filter(Boolean);
        for (const rule of CONFLICTS) {
          const base = words.find((w) => rule.base.test(w));
          if (!base) continue;
          // Les valeurs ARBITRAIRES (`text-[color:var(--…)]`, `w-[70px]`) étaient
          // exclues ici. C'était le trou principal : elles vivent dans la même
          // couche `utilities` et sont donc tout aussi inertes. L'exclusion
          // masquait 22 combinaisons réelles, dont des boutons de suppression
          // rendus en noir et un kill-switch rendu en terracotta ordinaire.
          // Seuls les modificateurs d'admin.css sont légitimes à côté d'une base.
          const dead = words.filter((w) => rule.utilities.test(w) && !w.startsWith("admin-"));
          if (dead.length === 0) continue;
          const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
          offenders.add(`${rel} :: ${base} ${dead.join(" ")}`);
        }
      }
    }

    // ⚠️ L'ÉGALITÉ STRICTE ÉTAIT UN PIÈGE — corrigée le 2026-08-02.
    //
    // `toEqual(BASELINE)` échoue AUSSI quand la liste rétrécit. Deux personnes
    // qui corrigent chacune une combinaison inerte passent au vert séparément,
    // et rendent `main` rouge une fois fusionnées — pour avoir fait exactement
    // ce que le cliquet demande. Le même piège existait sur le cliquet
    // anti-emoji (retiré le 2026-08-25) et avait déjà coûté un correctif à chaud.
    //
    // Ce qu'un cliquet doit interdire, c'est la RÉGRESSION, pas le progrès. On
    // n'exige donc plus que la liste soit identique : on exige qu'aucune
    // combinaison NOUVELLE n'apparaisse. Baisser la ligne de base reste utile
    // pour verrouiller le terrain gagné, mais l'oublier ne bloque personne.
    const nouvelles = [...offenders].sort().filter((o) => !INERT_UTILITIES_BASELINE.includes(o));
    expect(
      nouvelles,
      "Nouvelle(s) combinaison(s) `.admin-*` + utilitaire Tailwind INERTE.\n" +
        "L'utilitaire ne peint rien : `.admin-*` vit hors couche et bat `utilities`.\n" +
        "Remède : un modificateur défini dans admin.css, au même niveau de cascade.",
    ).toEqual([]);
  });

  // La console a sa propre palette (ivoire, mocha, terracotta) exposée par des
  // jetons. Vingt fichiers — site-explorer, keyword-strategy, documents de
  // console — peignaient en dur avec la palette Tailwind par défaut : tuiles
  // bleu/vert/violet et gris FROIDS au milieu d'une interface chaude. Ils
  // étaient reconnaissables au premier coup d'œil comme « une autre
  // application ». Normalisés le 2026-08-01 (couche 3).
  //
  // Les valeurs arbitraires restent autorisées (`bg-[color:var(--…)]`,
  // `text-[#…]` étant déjà interdit par le contrôle anti-hex) : seules les
  // classes de la palette NOMMÉE de Tailwind sont refusées.
  it("n'utilise aucune couleur de la palette Tailwind par défaut", () => {
    const PALETTE =
      /\b(text|bg|border|ring|divide|from|via|to|outline|decoration|shadow|accent|caret|fill|stroke)-(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|\d{3})\b/g;

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const line of src.split(/\r?\n/)) {
        // Les commentaires citent parfois une classe pour expliquer ce qui a
        // été retiré — les compter serait un faux positif.
        const code = line.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
        for (const m of code.matchAll(PALETTE)) {
          offenders.push(`${file.slice(ROOT.length + 1).replace(/\\/g, "/")} :: ${m[0]}`);
        }
      }
    }
    expect([...new Set(offenders)].sort()).toEqual([]);
  });
});
