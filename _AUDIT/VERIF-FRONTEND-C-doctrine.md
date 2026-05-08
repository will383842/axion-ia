# Annexe C — Doctrine Webflow (ADR 0001)

**Source agent** : AGT-DESIGN
**Conformité globale** : **82 %**

## Détails par axe (1-11)

| #   | Axe                                                             | Statut                                            |
| --- | --------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Webflow Blue `#146ef5` unique CTA primaire                      | ✅                                                |
| 2   | Module-color mapping (M1 Blue, M2 Orange, M3 Purple, Cas Green) | ⚠️ visuellement faible                            |
| 3   | Aucune section ne combine 3+ couleurs                           | ✅                                                |
| 4   | Radius > 8px = 0 hors `rounded-full`                            | ⚠️ rounded-md sur Card+Calendar (cf. P0)          |
| 5   | `--shadow-card` 5-couches                                       | ✅ tokens · ⚠️ pas system-wide sur Dialog/Popover |
| 6   | `translate-x-[6px]` hover sur CTA primaires                     | ✅ via classe `cta-translate`                     |
| 7   | Polices uniquement Manrope + Inconsolata                        | ✅ aucune autre famille trouvée                   |
| 8   | Breakpoints xs:479 / md:768 / lg:992 / xl:1280                  | ✅ via `@theme` Tailwind v4                       |
| 9   | `<Container>` max-w 1280                                        | ✅ `max-w-[1280px]`                               |
| 10  | Eyebrow uppercase 12.8px tracking 1.28px                        | ✅                                                |
| 11  | Tokens via Tailwind, jamais hex en dur                          | ✅ `pnpm anti-hex:check` OK                       |

## Findings P0 (1)

**DSN-001 · Radius incohérent Button vs Card** : `Button` utilise `rounded-sm` (4px), `Card` (`src/components/ui/card.tsx:11`) et `HouseCalendar` (`src/components/calendar/HouseCalendar.tsx:1`) utilisent `rounded-md` (6px). ADR 0001 stipule conservatif 4-8px mais sans incohérence intra-système.

- **Action** : remplacer `rounded-md` par `rounded-sm` sur Card + HouseCalendar. Garder `rounded-md` sur badges/accents seulement.
- **Effort** : ~30 min.

## Findings P1 (2)

**DSN-002 · Module-color mapping faible visuellement** : les accents M2/M3 ne colorent que l'eyebrow + une stat. Les hero, cards, CTAs restent bleus primaires → un visiteur ne distingue pas instantanément M1/M2/M3.

- **Action** : ajouter accent-color border-left ou accent bar en haut du `<ProductHero>` par module.
- **Effort** : ~1 h.

**DSN-003 · `--shadow-card` pas system-wide** : tokens définis mais Dialog/Popover/DropdownMenu (Radix wrappers) utilisent les ombres par défaut Radix.

- **Action** : appliquer `shadow-card` ou `shadow-elevated` sur les wrappers Radix élevés.
- **Effort** : ~1 h.

## Findings P2

| ID      | Titre                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| DSN-004 | Button variant `link` sans `cta-translate` — choix design intentionnel mais non documenté |
| DSN-005 | FeatureGrid `rounded-md` sur badges accent — confirmer intention vs vendor-default        |
| DSN-006 | Page démo `/design` contient `rounded-lg` à titre showcase — risque copie-collé           |

## Tension premium B2B ↔ Webflow Blue

> ADR 0001 a flagué cette tension comme « surveillée après Sprint 5 ».

**Statut** : **DISSONANCE MINEURE détectée**. La palette Webflow Blue (`#146ef5`) projette une image plus startup/maker-friendly que cabinet IA premium B2B visant CxO.

**Atténuations possibles** :

- Variante CTA primaire plus sobre (`#0055d4` déjà défini comme `--color-primary-hover`).
- Cadrer Webflow Blue en **secondary accent** uniquement, primary plus profond.
- Ou amplifier discipline modulaire (M2/M3 accents) pour casser la mono-bleu visuel.

**Recommandation** : laisser tel quel jusqu'au walkthrough Will (chapitre 23). Décision différée.

## Top 3 risques design

1. **Radius hierarchy fractured** (P0-DSN-001) — fix 30 min, impact cohésion système.
2. **Module-color mapping faible** (P1-DSN-002) — visiteur confond les 3 offerings.
3. **Tension Webflow Blue ↔ premium B2B** — risque objection design lors reviews client (à monitor).
