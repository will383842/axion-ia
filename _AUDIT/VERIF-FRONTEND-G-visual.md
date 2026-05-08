# Annexe G — Visual regression baselines

## Statut

❌ **Non exécutée à ce stade.**

## Raison

Les tests Playwright `tests/e2e/` (i18n + smoke) tournent sans baseline visuelle (`.png` snapshots Playwright). Le système visual regression complet (`@playwright/test` `toHaveScreenshot()`) n'a pas été mis en place dans Sprint 14.

## Plan Sprint 21

À déclencher dans Sprint 21 (Tests E2E + LHCI + ZAP) :

1. **Bootstrap baselines** : exécuter `pnpm test:e2e --update-snapshots` sur 30 pages clés × 4 viewports (375 / 768 / 992 / 1280) × 3 navigateurs (Chromium / WebKit / Firefox) = ~360 baselines.
2. **CI gate** : ajouter step Playwright avec seuil diff < 0.1 % par snapshot.
3. **Viewports prioritaires** : 360 (mobile S22), 375 (iPhone 14), 768 (tablet), 992 (lg breakpoint), 1280 (Container max-w), 1440, 1920.
4. **Pages prioritaires** :
   - Home FR + EN
   - 3 modules listings + page phare Essentielle
   - 1 cas concret slug + 1 article blog slug
   - /reserver + /roi + /audit/demande
   - /contact + /faq + /a-propos
   - 1 page légale
   - 404 + 500
5. **Diff threshold** : 0.1 % avec masque sur éléments dynamiques (date, slugs).

## Findings actuels

**VIS-001 (P2)** · Visual regression non bootstrappé — bloqué jusqu'à Sprint 21 par design (pas de browsers headless en local hors Sprint test).
