# 00 — MANIFEST AUDIT CONTENT-GEN DEEP V2.0 — 2026-05-18

> AUDIT-ONLY STRICT. Zéro modification code, zéro commit, zéro push.
> Working dir : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
> HEAD git : `9c1adaa` (confirmé) + 5 commits supplémentaires vs prompt (cf. ci-dessous).
> Baseline `pnpm typecheck` : **exit 0** ✅ (confirmé background).
> Baseline `pnpm vitest run` : en cours (sera consigné dans 02-VERDICT-GLOBAL.md).
> Prompt source : `_AUDIT/PROMPT-CONTENT-GEN-DEEP-AUDIT-END-TO-END-2026.md`.

---

## 0. Référence chronologique commits 2026-05-18

15 commits sur main entre `c5d5c20` et `9c1adaa` (10 du prompt + 5 hotfix/hardening supplémentaires).

| #   | SHA       | Message                                                                      | Couvert prompt                                                            |
| --- | --------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `c5d5c20` | feat(seo): wire Article.aiGenerated:true JSON-LD (AI Act art. 50 P0-5)       | ✅ #1                                                                     |
| 2   | `09087f2` | feat(ops): coolify-system-restart workflow (SSH + docker restart)            | ⚠️ ≠ libellé prompt #2                                                    |
| 3   | `a9d3168` | feat(audit): p1 quick wins batch — city domination 2026-05-18                | ✅ #3                                                                     |
| 4   | `bde935e` | chore(lint): fix 4370 erreurs ESLint parasites + hardening globalIgnores     | ➕ hors prompt                                                            |
| 5   | `80c2004` | fix(admin): disable custom speculation rules — fix admin error boundary      | ➕ hors prompt                                                            |
| 6   | `e4d1128` | feat(audit): p1-5 + p1-2 — soft-404 gate + course schema                     | ✅ #4                                                                     |
| 7   | `34e3c54` | feat(audit): p1-6 + p1-9 — topicFingerprint + content-gen audit log soc2     | ✅ #5                                                                     |
| 8   | `9ba6945` | feat(audit): p1-21 — charte editoriale + corrections pages eeat 2026         | ✅ #6                                                                     |
| 9   | `89bcbba` | feat(ops): coolify-force-recreate workflow                                   | ➕ hors prompt                                                            |
| 10  | `bf02916` | fix(audit): verification profonde — sync doctrine-check + tests soc2         | ✅ #7                                                                     |
| 11  | `b80eef1` | fix(admin): return null on RSC prefetch when no session                      | ➕ hors prompt                                                            |
| 12  | `4d9efbf` | feat(audit): sprint s+2 — un-a-un industrialisation + strat ville perfection | ✅ #8                                                                     |
| 13  | `424e9a5` | fix(ops): coolify-force-recreate pulls latest + overrides local tag          | ⚠️ ≠ libellé prompt #9 (mentionedCities hotfix non identifié sous ce SHA) |
| 14  | `9432e16` | fix(admin): skip middleware redirect on RSC prefetch                         | ➕ hors prompt                                                            |
| 15  | `9c1adaa` | fix(audit): hub ville — ajout 4e card un-a-un + servicesContext.unAUn        | ✅ #10                                                                    |

⚠️ **Drift prompt vs réalité** :

- Le hotfix `mentionedCities publish-worker` est attribué à `424e9a5` dans le prompt mais le SHA correspond en fait à un fix Coolify. Voir audit cross-check 8.1 (06-CROISEMENTS-CROSS-CHECKS.md) pour identifier où le hotfix mentionedCities a réellement été appliqué.
- 5 commits supplémentaires d'ops/admin/lint que le prompt n'identifie pas.

---

## 1. Livrables produits (25 fichiers)

| #   | Fichier                                         | Contenu                                              | Section prompt | Status |
| --- | ----------------------------------------------- | ---------------------------------------------------- | -------------- | ------ |
| 00  | `00-MANIFEST.md`                                | Ce fichier — index + baseline + drift commits        | —              | ✅     |
| 01  | `01-EXEC-SUMMARY-WILL.md`                       | ≤ 2 pages, langage simple Will                       | §13 + §14      | ✅     |
| 02  | `02-VERDICT-GLOBAL.md`                          | Score /1200 (12 types × 100)                         | §13            | ✅     |
| 03  | `03-STOP-AND-ASK-WILL.md`                       | Décisions ouvertes                                   | §13            | ✅     |
| 04  | `04-FLOW-MASTER-MERMAID.md`                     | Diagrammes flow master + 12 types                    | §13            | ✅     |
| 05  | `05-VILLES-DEPARTEMENTS-REGIONS.md`             | Tableaux Top 50 + 95 dépts + 13 régions              | §7             | ✅     |
| 06  | `06-CROISEMENTS-CROSS-CHECKS.md`                | 12 cross-checks fact-based                           | §8             | ✅     |
| 07  | `07-TESTS-INVENTORY-GAPS.md`                    | Tests existants + gaps                               | §9             | ✅     |
| 08  | `08-WORKERS-BULLMQ-AUDIT.md`                    | 15+ workers BullMQ                                   | §3             | ✅     |
| 09  | `09-ADMIN-UI-CONTENT-GEN.md`                    | 30+ sous-pages V1 + V2                               | §4             | ✅     |
| 10  | `10-MONITORING-OBSERVABILITE.md`                | GenerationLog, SOC2, Sentry, Telegram, cost ledger   | §5             | ✅     |
| 11  | `11-INDEXATION-DISCOVERY.md`                    | robots, sitemap, llms/ai/security.txt, IndexNow, GSC | §6             | ✅     |
| 12  | `12-TYPE-1-ARTICLES-BLOG.md`                    | Articles blog factory                                | §2             | ✅     |
| 13  | `13-TYPE-2-ACTUALITES-RSS.md`                   | RSS news pipeline                                    | §2             | ✅     |
| 14  | `14-TYPE-3-LANDING-PAGES-VILLE-4-VERTICALES.md` | 4 verticales × villes                                | §2             | ✅     |
| 15  | `15-TYPE-4-KB-ENTRIES.md`                       | KB V4                                                | §2             | ✅     |
| 16  | `16-TYPE-5-CAS-CONCRETS.md`                     | Cas concrets                                         | §2             | ✅     |
| 17  | `17-TYPE-6-FAQ-ITEMS.md`                        | FAQ items                                            | §2             | ✅     |
| 18  | `18-TYPE-7-COMPARAISONS-GUIDES.md`              | Comparaisons + guides piliers                        | §2             | ✅     |
| 19  | `19-TYPE-8-PRESSE.md`                           | Pages presse                                         | §2             | ✅     |
| 20  | `20-TYPE-9-STACK-IA.md`                         | Stack IA outils                                      | §2             | ✅     |
| 21  | `21-TYPE-10-PAR-FONCTION.md`                    | Pages par-fonction                                   | §2             | ✅     |
| 22  | `22-TYPE-11-GLOSSAIRE.md`                       | Glossaire IA                                         | §2             | ✅     |
| 23  | `23-TYPE-12-CENTRE-AIDE.md`                     | Centre d'aide                                        | §2             | ✅     |
| 99  | `99-ROADMAP-COMPLETION.md`                      | Roadmap P0-P3 + effort + ROI                         | §13            | ✅     |

**Total = 25 fichiers ≥ 22 requis** ✅

---

## 2. Inventaire socle (état découvert)

| Domaine                      | Nombre              | Détail                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generators content-gen       | **11**              | blog-article, blog-from-keywords, blog-from-rss, blog-from-title, comparison, faq-standalone, guide-pilier, landing-ville, landing-ville-templates (helper), qa-derived, types (helper) — cf. `src/server/content-gen/generators/`                     |
| Workers BullMQ (total)       | **25**              | dont **15** content-gen-spécifiques (cf. `08-WORKERS-BULLMQ-AUDIT.md`)                                                                                                                                                                                 |
| Modèles Prisma               | **86**              | dont ~35 content-related (cf. `prisma/schema.prisma`)                                                                                                                                                                                                  |
| Sous-pages admin content-gen | **21 dirs racines** | + sous-routes (orchestrator, coverage, geo, jobs, kb-readonly, keyword-tracking, landing-variants, onboarding, publications, publications-status, quality, queue, review-queue, rss, settings ×13, similarity-monitor, templates, costs, author, \_v2) |
| Régions data files           | **13**              | métropole : ile-de-france, auvergne-rhone-alpes, paca, occitanie, nouvelle-aquitaine, hauts-de-france, grand-est, pays-de-la-loire, bretagne, normandie, bourgogne-franche-comte, centre-val-de-loire, corse                                           |
| Villes copy gold standard    | **1**               | `paris.ts` uniquement (Tier-1 = 1 ; Tier-2 = 0 ; Tier-3 = ~2280)                                                                                                                                                                                       |
| Lignes données villes        | **26 003**          | data files (sans copy)                                                                                                                                                                                                                                 |

---

## 3. Mode opératoire de cet audit

- **Stratégie** : sub-agents parallélisés (Explore + general-purpose) pour produire chaque livrable, supervisé par cette session.
- **Fact-based** : chaque assertion citée `fichier.ts:ligne`.
- **Inconnues** : tagguées `**UNKNOWN — requires fact-check**` avec commande/SQL/URL à exécuter.
- **Anti-modification** : zéro `git add`, zéro `git commit`, zéro `git push`, zéro mutation DB, zéro mise à jour migration.
- **Anti-régression CI** : typecheck exit 0 ✅ confirmé baseline ; vitest count consigné dans 02.

---

## 4. Prochaines actions (post-audit)

1. **Will lit** `01-EXEC-SUMMARY-WILL.md` (≤ 2 pages, simple).
2. **Will tranche** les décisions `03-STOP-AND-ASK-WILL.md`.
3. **Sprint S+3 EXECUTION** déclenché via prompt séparé si validation.

---

**Manifest scellé** — 25 livrables produits sous `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/`.
