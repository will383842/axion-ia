# CHANGELOG — Dédoublonnage des skills `axionia-*`

> Phase 1.S — déduplication des 3 sujets transverses détectés par l'audit `01s-skills-deep-audit.md` §5 P1.
> Date : 06/05/2026.
> Méthode : Edits ciblés + désignation d'un canon unique par sujet, avec renvois explicites.

---

## Sujet 1 — Touch targets WCAG 44×44

### Canon désigné

**`axionia-a11y/SKILL.md`** — section « 2. Touch targets WCAG 2.2 AA — canon unique pour Axion-IA ».

### Skills modifiés

| Skill                           | Action                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axionia-a11y/SKILL.md`         | **Canon enrichi** : ajout du marqueur « canon unique pour Axion-IA », règle générale, classes Tailwind de référence (Button/Link/icon-only/Checkbox), exceptions WCAG 2.2 (inline target, equivalent control, user-agent control, essential) avec note « on ne s'appuie sur aucune de ces exceptions sur Axion-IA », et tests (DevTools, axe-core, Lighthouse). |
| `axionia-design/SKILL.md`       | **Allégé** : la mention « touch targets ≥ 44×44px » dans la section Boutons est conservée comme rappel, complétée par une note « **Canon : `axionia-a11y`** — détail complet… » qui renvoie vers le canon.                                                                                                                                                      |
| `axionia-mobile-first/SKILL.md` | **Allégé** : la section « Touch targets — WCAG » a un bandeau canon en tête « **Canon : `axionia-a11y`** — règles complètes WCAG 2.2 AA touch targets ». Conservation du rappel essentiel mobile (44px min, espacement 8px, exemples Tailwind h-11 / py-3 px-4).                                                                                                |

### Delta

- Avant : 3 skills répétaient « 44×44px min + 8px d'espacement » avec des niveaux de détail variables (a11y un peu, design rien, mobile-first juste les chiffres). Les exceptions WCAG 2.2 n'étaient nulle part.
- Après : 1 canon exhaustif (a11y) + 2 rappels courts (design, mobile-first) qui renvoient vers le canon.

---

## Sujet 2 — Performance budgets (LCP/INP/CLS/JS first load/Lighthouse)

### Canon désigné

**`axionia-performance/SKILL.md`** — bandeau « Canon unique pour les performance budgets Axion-IA » en tête.

### Skills modifiés

| Skill                           | Action                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axionia-performance/SKILL.md`  | **Canon marqué** : ajout du bandeau « 🔴 Canon unique pour les performance budgets Axion-IA (LCP, INP, CLS, FCP, TTFB, JS first load, Lighthouse). Les skills `axionia-mobile-first` et `axionia-seo-aeo` ne contiennent qu'un rappel court avec renvoi vers ce fichier ». Le tableau exhaustif (LCP<1.8s, INP<80ms, CLS<0.05, FCP<1.2s, TTFB<200ms, JS<80kb, Lighthouse>95) reste tel quel. |
| `axionia-mobile-first/SKILL.md` | **Allégé** : section « Performance budgets — non négociables (v5) » renommée « Performance budgets — rappel mobile », bandeau canon ajouté, tableau réduit aux 5 métriques-clés (LCP, INP, CLS, JS first load, Lighthouse), retrait des lignes TTFB/TTI redondantes, retrait de la section Tactiques détaillée (gardé un sous-ensemble « Tactiques mobile spécifiques (rappel) »).           |
| `axionia-seo-aeo/SKILL.md`      | **Allégé** : section « Performance — Core Web Vitals » remplacée par un bandeau canon + une ligne synthétique « LCP < 1.8s · INP < 80ms · CLS < 0.05 · FCP < 1.2s · TTFB < 200ms · Lighthouse SEO = 100 ». Le tableau détaillé est retiré.                                                                                                                                                   |

### Delta

- Avant : 3 skills répétaient les Core Web Vitals avec parfois des chiffres légèrement différents (mobile-first incluait TTI<3.5s, seo-aeo incluait FCP<1.2s, performance incluait tout). Risque de divergence.
- Après : 1 canon exhaustif (performance) + 2 rappels synthétiques (mobile-first, seo-aeo) qui renvoient vers le canon. Tactiques détaillées (Lighthouse CI, bundle analyzer, Web Vitals lib, optimisations Cloudflare, anti-patterns) restent uniquement dans le canon.

---

## Sujet 3 — Hreflang (génération + validation)

### Canon double

- **`axionia-i18n/SKILL.md`** = canon **GÉNÉRATION** (helpers Next.js, `alternates.languages` dans `generateMetadata`, sitemap multilingue avec `xhtml:link rel="alternate"`).
- **`seo-hreflang`** (skill générique cadenassé, non modifié) = canon **VALIDATION** post-build en CI (audit codes locale, x-default, cohérence bidirectionnelle).

### Skills modifiés

| Skill                      | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `axionia-i18n/SKILL.md`    | **Canon GÉNÉRATION marqué** : ajout du bandeau « 🔴 Canon GÉNÉRATION hreflang pour Axion-IA » dans la section « hreflang automatique », avec mention explicite que la validation est canon dans `seo-hreflang`.                                                                                                                                                                                                                                                              |
| `axionia-seo-aeo/SKILL.md` | **Allégé** : ajout d'un bandeau canon en tête de la section « Metadata par page » qui renvoie vers `axionia-i18n` (génération) + `seo-hreflang` (validation). Mention de `alternates.languages` dans `generateMetadata` conservée comme exemple opérationnel. La section « Sitemap multi-fichiers » conserve un bandeau canon vers `axionia-i18n` pour la logique multilingue, en gardant la spécificité SEO de la séparation par type de contenu (pages, blog, faq, cases). |
| `seo-hreflang`             | **Non touché** (skill générique cadenassé, déjà canon validation).                                                                                                                                                                                                                                                                                                                                                                                                           |

### Delta

- Avant : la stratégie hreflang était partagée entre `axionia-i18n` (génération côté Next.js) et `axionia-seo-aeo` (mention dans `generateMetadata` + sitemap), sans hiérarchie claire. La validation CI n'était mentionnée nulle part dans les skills `axionia-*`.
- Après : double canon explicité (i18n = génération, seo-hreflang = validation), seo-aeo allégé en deux endroits (metadata + sitemap) avec renvois croisés.

---

## Synthèse des fichiers touchés

| Fichier                         | Type d'action                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `axionia-a11y/SKILL.md`         | Canon enrichi (touch targets)                                                                      |
| `axionia-design/SKILL.md`       | Allégé + renvoi a11y                                                                               |
| `axionia-mobile-first/SKILL.md` | Allégé × 2 (touch targets + perf budgets) + renvois a11y et performance                            |
| `axionia-performance/SKILL.md`  | Canon marqué (perf budgets)                                                                        |
| `axionia-seo-aeo/SKILL.md`      | Allégé × 3 (perf + hreflang metadata + hreflang sitemap) + renvois performance, i18n, seo-hreflang |
| `axionia-i18n/SKILL.md`         | Canon génération marqué (hreflang)                                                                 |

**Non touchés** :

- `axionia-core/SKILL.md` (instruction explicite — déjà à jour avec règle de précédence)
- `seo-hreflang` (skill générique cadenassé, déjà canon validation)

## Contraintes respectées

- Aucune réécriture intégrale, uniquement Edits ciblés
- Structure des SKILL.md (frontmatter, sections, hiérarchie de titres) intacte
- Frontmatter `description` cohérent (non modifié sauf si justifié — ici non modifié)
- Chaque skill non-canon reste lisible en autonomie grâce au rappel court
- Chaque section dédoublonnée porte une note « **Canon : `axionia-X`** » au-dessus
