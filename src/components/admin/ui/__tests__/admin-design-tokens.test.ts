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
  "admin-confirm-modal",
  "admin-confirm-title",
  "admin-confirm-desc",
  "admin-confirm-type-input",
  "admin-conflict-modal",
  "admin-conflict-title",
  "admin-conflict-desc",
  "admin-session-expiry-modal",
  "admin-session-expiry-title",
  "admin-session-expiry-desc",
  "admin-table-empty-wrapper",
  "admin-field-email-hint",
]);

/**
 * Combinaisons `.admin-*` + utilitaire Tailwind INERTE déjà présentes dans le
 * code au moment de la refonte UI 2026-08-01. Chacune est un défaut silencieux
 * réel : `admin-input w-20` laisse le champ en pleine largeur,
 * `admin-button-ghost text-red-600` laisse le bouton de suppression noir.
 *
 * Elles ne sont PAS corrigées ici : la vraie réparation est de faire passer
 * les classes `.admin-*` dans `@layer components`, où les utilitaires Tailwind
 * reprennent le dessus naturellement — changement de cascade qui touche toute
 * la console et mérite sa propre PR (couche 2 de la refonte), avec revue
 * visuelle. En attendant, cette liste sert de cliquet : elle ne doit que
 * diminuer.
 */
const INERT_UTILITIES_BASELINE: readonly string[] = [
  "src/app/[locale]/(admin)/[adminPrefix]/avis/[id]/page.tsx :: admin-button w-full",
  "src/app/[locale]/(admin)/[adminPrefix]/avis/[id]/page.tsx :: admin-button-ghost text-red-600",
  "src/app/[locale]/(admin)/[adminPrefix]/avis/[id]/page.tsx :: admin-button-ghost w-full",
  "src/app/[locale]/(admin)/[adminPrefix]/avis/[id]/page.tsx :: admin-button-ghost w-full text-red-600",
  "src/app/[locale]/(admin)/[adminPrefix]/avis/[id]/page.tsx :: admin-input w-full",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx :: admin-input px-2 py-1",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx :: admin-input px-3 py-2",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx :: admin-input w-20 px-2 py-1",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/campaigns/new/_v2/CampaignWizardV2.tsx :: admin-input w-24 px-2 py-1",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/cities-coverage/_v2/CitiesCoverageV2.tsx :: admin-input w-20",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/cities-order/_v3/CitiesOrderV3.tsx :: admin-input px-3 py-2",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage-map/_v2/CoverageMapV2.tsx :: admin-input px-3 py-2",
  "src/app/[locale]/(admin)/[adminPrefix]/content-gen/coverage/presets/_v2/CampaignPresetsV2.tsx :: admin-button-cta text-center",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/charge/page.tsx :: admin-input w-40",
  "src/app/[locale]/(admin)/[adminPrefix]/planning/previsionnel/page.tsx :: admin-input w-40",
  "src/components/admin/contacts/RetryFailedReplyButton.tsx :: admin-button-ghost text-sm",
  "src/components/admin/qualiopi/TrainerManageForm.tsx :: admin-button w-auto",
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
      // `.admin-button*` fixe largeur, marges internes, typographie, rayon, fond.
      {
        base: /^admin-button(-secondary|-ghost|-danger|-cta)?$/,
        utilities: /^(w|min-w|max-w|px|py|p|text|font|rounded|bg)-/,
      },
      // `.admin-input` fixe largeur, hauteur, marges internes, rayon, fond, bordure.
      {
        base: /^admin-input$/,
        utilities: /^(w|h|px|py|p|rounded|bg|border)-/,
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
          const dead = words.filter((w) => rule.utilities.test(w) && !w.includes("["));
          if (dead.length === 0) continue;
          const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
          offenders.add(`${rel} :: ${base} ${dead.join(" ")}`);
        }
      }
    }

    // Cliquet : la liste ne doit que DIMINUER. Si ce test échoue avec une
    // entrée en plus, c'est qu'une nouvelle combinaison inerte a été
    // introduite — utiliser un modificateur défini dans admin.css. Si une
    // entrée disparaît, retirer la ligne correspondante ci-dessous.
    expect([...offenders].sort()).toEqual(INERT_UTILITIES_BASELINE);
  });
});
