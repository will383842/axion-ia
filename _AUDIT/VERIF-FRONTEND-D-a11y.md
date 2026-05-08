# Annexe D — Accessibilité WCAG 2.2 AA

**Source agent** : AGT-A11Y
**Tests démontrables** : 14 axes statiques.
**À valider runtime Sprint 21** : axe-core sur 75 templates · NVDA + VoiceOver · Lighthouse a11y · contrastes mesurés (suspect : `text-gray-700` sur `bg-bg`).

## Couverture par axe

| Axe                           | Statut                                                               |
| ----------------------------- | -------------------------------------------------------------------- |
| 1. `<main id="main">` unique  | ✅ `layout.tsx:113`                                                  |
| 2. Skip-to-content            | ✅ `SkipToContent.tsx`, focus-visible ring                           |
| 3. Lang attribute             | ✅ `<html lang={locale} dir="ltr">`                                  |
| 4. Headings hiérarchie        | ❌ **11 pages listing sans h1** (P0)                                 |
| 5. Touch targets ≥ 44×44      | ⚠️ multiples cibles < 44 (P1)                                        |
| 6. `prefers-reduced-motion`   | ⚠️ override global OK · `cta-translate` non neutralisé en hover (P2) |
| 7. Focus visible              | ✅ `focus-visible:ring-*` partout, aucun `focus:outline-none` nu     |
| 8. `aria-*` natifs            | ✅ pas de redondance sur boutons natifs                              |
| 9. Form errors `role="alert"` | ⚠️ `aria-invalid` manquant AuditForm + ImplementationForm (P1)       |
| 10. Images `alt`              | ✅ une seule `<img>` (TeamGrid avec alt explicite)                   |
| 11. `<Sheet>` mobile drawer   | ⚠️ MobileNav réimplémenté sans focus trap (P1)                       |
| 12. Calendrier ARIA           | ⚠️ `aria-pressed` sur `gridcell` invalide (P2, ESLint warning)       |
| 13. RoiSimulator ARIA         | ✅ sliders aria-valuetext, résultats aria-live                       |
| 14. AVIF/WebP fallback        | ✅ `next.config.ts:27`                                               |

## Findings P0 (1)

**A11Y-001 · 11 pages listing sans `<h1>`** :
Les pages `/audit`, `/contact`, `/reserver`, `/implementation`, `/interventions`, `/roi`, `/blog`, `/cas-concrets`, `/a-propos`, `/faq`, `/centre-aide` commencent par `<Section>` qui rend `<h2>` (`Section.tsx:35`). Aucun `<h1>` n'est posé en début de page.

- **Violation** : WCAG 1.3.1 (Info and Relationships) + 2.4.6 (Headings and Labels).
- **Action** : ajouter un `<Hero variant="transverse">` ou rendre le 1ʳᵉ `<Section>` configurable (`as="h1"`) sur ces 11 pages.
- **Effort** : ~2 h.

## Findings P1 (4)

**A11Y-002 · Touch targets < 44×44** :

- `Header.tsx:26` logo `h-8 w-8` (32px), `Footer.tsx:48` logo `h-9 w-9` (36px)
- `Header.tsx:51` CTA `px-4 py-2.5 text-sm` ≈ 38-40px
- `HouseCalendar.tsx:119,130` chevrons `h-10 w-10` (40px)
- `dialog.tsx:48` + `sheet.tsx:66` close button `h-9 w-9` (36px)
- `TestimonialsCarousel.tsx:74,82` flèches `h-10 w-10`
- `button.tsx:23` size `sm: h-9` (36px)
- Footer links `text-sm` sans padding
- **Action** : passer logos à `h-11 w-11` (44px), CTA Header `py-3` (44px), flèches `h-11 w-11`, close `h-11 w-11`, button size `sm` à 44px ou hidden mobile.

**A11Y-003 · Focus trap absent dans MobileNav** :
`MobileNav.tsx` est `<div role="dialog" aria-modal="true">` maison. Escape OK + focus initial OK + restore OK. **Mais Tab peut sortir du dialog** vers le contenu sous-jacent.

- **Action** : migrer vers `<Sheet>` Radix (déjà dans le codebase).
- **Effort** : ~1 h.

**A11Y-004 · `aria-invalid` manquant AuditForm + ImplementationForm** :
RadioGroups + champs métier ne portent pas `aria-invalid={!!errors.X}` quand validation échoue. Erreurs s'affichent mais l'input n'est pas marqué invalide pour AT.

- **Action** : ajouter `aria-invalid` sur tous les contrôles de ces 2 forms.

**A11Y-005 · Footer h2 colonnes polluent hiérarchie** :
`Footer.tsx:91` rend `<h2>` au même niveau que les `<h2>` de Section. Pollue la table des matières screen reader.

- **Action** : passer Footer titles colonnes à `<h3>` ou utiliser `<p>` semantic visually-h2.

## Findings P2

| ID       | Titre                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A11Y-006 | `cta-translate:hover` translate-x non neutralisé en `prefers-reduced-motion` (transition coupée mais translate final subsiste) |
| A11Y-007 | `aria-pressed` sur `role="gridcell"` invalide (HouseCalendar) — ESLint warning connu                                           |
| A11Y-008 | `tabs.tsx:31` `h-10` < 44px                                                                                                    |
| A11Y-009 | Pages listing : nav internes sans `<nav aria-label>` distinctifs                                                               |

## À valider runtime Sprint 21

1. axe-core sur 75 templates (couleur contrast, ordre tab réel, landmarks).
2. NVDA + VoiceOver sur 6 composants critiques (HouseCalendar, RoiSimulator, MobileNav, AuditForm, ImplementationForm, TestimonialsCarousel).
3. Keyboard manuel sur 15 pages.
4. Lighthouse a11y score sur 30 URLs.
5. **Contrast `text-gray-700` sur `bg-bg`** (suspect, à mesurer).
