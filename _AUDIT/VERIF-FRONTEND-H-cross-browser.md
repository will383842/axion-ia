# Annexe H — Cross-browser matrix

## Statut

❌ **Non exécutée à ce stade** (Sprint 21).

## Configuration Playwright actuelle

`playwright.config.ts` configure 3 projects desktop :

- **chromium** (Chrome/Edge engine)
- **webkit** (Safari engine)
- **firefox** (Gecko)

Tests existants : `tests/e2e/{i18n,smoke}.spec.ts` — non lancés en CI cross-browser à ce stade.

## Plan Sprint 21

### Matrice cible

| Plateforme                   | Statut                        |
| ---------------------------- | ----------------------------- |
| Chromium desktop             | À lancer                      |
| WebKit desktop               | À lancer                      |
| Firefox desktop              | À lancer                      |
| iPhone 14 Pro (Safari)       | À ajouter à playwright config |
| iPhone SE (Safari)           | À ajouter                     |
| Pixel 7 (Chrome Android)     | À ajouter                     |
| Samsung S22 (Chrome Android) | À ajouter                     |

### Viewports

`360 / 479 / 768 / 992 / 1280 / 1440 / 1920` — couvre xs / md / lg / xl / wide.

### Features sensibles à valider runtime

| Feature              | iOS Safari 17+ | Android Chrome | Notes                            |
| -------------------- | -------------- | -------------- | -------------------------------- |
| View Transitions API | ✅ via opt-in  | ✅             | non câblé encore (P2 NAV-015)    |
| AVIF                 | ✅ 16+         | ✅             | next/image config OK             |
| WebP fallback        | ✅             | ✅             | OK                               |
| `<dialog>` natif     | ✅ 15.4+       | ✅             | utilisé via Radix                |
| CSS `@container`     | ✅ 16+         | ✅             | non utilisé pour l'instant       |
| `font-display: swap` | ✅             | ✅             | Manrope + Inconsolata configurés |
| Speculation Rules    | ❌ Safari      | ✅             | non câblé encore                 |

### Tests offline / 3G slow

À lancer Sprint 21 : Network throttling slow 3G + simulation hors-ligne → vérifier que les pages rendent un skeleton ou un fallback, pas de page blanche.

## Findings actuels

**XBR-001 (P2)** · Matrice cross-browser non validée — Sprint 21 dependency.
**XBR-002 (P2)** · Mobiles physiques (iPhone 14, Pixel 7) non dans `playwright.config.ts` — à ajouter.
