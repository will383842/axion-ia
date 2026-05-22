# SC-30 — Cleanup final données TEST*E2E*\*

**Mode** : code-level (aucune donnée test créée car runtime indisponible) — **Verdict** : 🟢 OK (code) + ⚪ N/A (runtime)

## Étapes prévues runtime

1. DELETE FROM articles WHERE slug LIKE 'test-e2e-%';
2. DELETE FROM content*gen_jobs WHERE campaign_id IN (SELECT id FROM coverage_campaigns WHERE name LIKE 'TEST_E2E*%');
3. DELETE FROM generation_provenance WHERE article_id NOT IN (SELECT id FROM articles);
4. DELETE FROM coverage*campaigns WHERE name LIKE 'TEST_E2E*%';
5. Restaurer `MAX_PUBLISH_PER_DAY=30` (si modifié SC-23)
6. Restaurer cost caps (si modifiés SC-29)
7. Vérifier cohérence DB

## Cartographie FK (schema.prisma)

| Table source                                        | FK                     | onDelete                                  | Impact cleanup                                         |
| --------------------------------------------------- | ---------------------- | ----------------------------------------- | ------------------------------------------------------ |
| `BookingOption.slotId` → `CalendarSlot`             | Cascade                | Cascade                                   | OK                                                     |
| `GenerationProvenance.articleId` → `Article`        | **Restrict** L982      | **Bloque DELETE Article si trace existe** | ⚠️ Cleanup SC-30 ordre 3 doit précéder DELETE Articles |
| `FactCheckClaim.articleId` → `Article`              | Cascade L1015          | Cascade                                   | OK                                                     |
| `ArticleSlugHistory.articleId` → `Article`          | Cascade L1060          | Cascade                                   | OK                                                     |
| `ArticleTagOnArticle` → `Article`/`ArticleTag`      | Cascade L1088-1089     | Cascade                                   | OK                                                     |
| `Payment.bookingId` → `Booking`                     | Restrict L1488         | Bloque                                    | OK (hors scope test)                                   |
| `Invoice.bookingId` → `Booking`                     | Restrict L1541         | Bloque                                    | OK (hors scope test)                                   |
| `ExternalLinkUsage.externalLinkId` → `ExternalLink` | **FK MANQUANTE** L3702 | N/A                                       | ⚠️ Orphelin possible mais hors scope cleanup TEST_E2E  |

## 🔴 Risques cleanup

1. **`GenerationProvenance.articleId` Restrict** : ordre DELETE doit être :
   - 1. `GenerationProvenance` WHERE article_id IN (...)
   - 2. `FactCheckClaim` (Cascade — automatique)
   - 3. `Articles` WHERE slug LIKE 'test-e2e-%'
   - 4. `ContentGenJob` WHERE campaign_id IN (...)
   - 5. `CoverageCampaign` WHERE name LIKE 'TEST*E2E*%'
   - L'ordre proposé dans le prompt fonctionne car GenerationProvenance précède Articles ✅

## Verdict 🟢 OK (code) + ⚪ N/A (runtime)

Cleanup faisable, ordre correct dans le prompt. Aucune donnée TEST*E2E*\* créée pendant cet audit (runtime indisponible), donc CLEANUP-LOG.md = 0 row delete.

## Note transversale

Le schema utilise mix Cascade (editorial) + Restrict (financial). Pas de doctrine unifiée — à standardiser éventuellement.
