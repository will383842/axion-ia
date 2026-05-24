# VERDICT VÉRIFICATION SPRINT P3 — SEO/AEO/GEO

## Date : 2026-05-21

## HEAD audité : c553510d (P4 Phase PARALLÈLE)

## Commit P3 audité : 417befc2

## Score baseline pré-sprint : 689/1000

## Score sprint déclaré : ~745/1000

## **Score vérifié par cet audit : 761/1000** ✅

---

## Verdict global : 🟡 CONDITIONAL (≥ 700/1000)

Score 761/1000 = **CONDITIONAL GO**.
Deux items P0 à corriger avant de considérer P3 "clôturé" :

- blog/[slug] AuthorByline (P0)
- blog/[slug] ArticleTOC (P0)

---

## Scores par agent

| Agent                         | Score   | Max      | %         | Verdict                                |
| ----------------------------- | ------- | -------- | --------- | -------------------------------------- |
| V3-01 Spec QW 1-5             | 70      | 100      | 70%       | 🟡 (blog AuthorByline manquant)        |
| V3-02 Spec QW 6-10            | 78      | 100      | 78%       | 🟡 (isBasedOn callsite gap)            |
| V3-03 Featured Snippets TOC   | 110     | 120      | 92%       | ✅ (blog TOC absent = seul gap)        |
| V3-04 Anti-concurrence        | 55      | 80       | 69%       | 🟡 (axionai.fr = faux positif corrigé) |
| V3-05 Knowledge Graph         | 47      | 100      | 47%       | 🔴 (Wikidata + gaps Will)              |
| V3-06 AI Overviews sources    | 83      | 100      | 83%       | ✅                                     |
| V3-07 E-E-A-T signals         | 83      | 100      | 83%       | ✅ (blog AuthorByline = seul gap)      |
| V3-08 Web Vitals régression   | 80      | 80       | 100%      | ✅ PARFAIT                             |
| V3-09 Cross-sprint P4+P5      | 110     | 120      | 92%       | ✅                                     |
| V3-10 Actions Will + sécurité | 62      | 100      | 62%       | 🟡 (actions Will en attente)           |
| Cross-cutting orchestrateur   | 83      | 100      | 83%       | ✅                                     |
| **TOTAL**                     | **761** | **1000** | **76.1%** | **🟡 CONDITIONAL**                     |

---

## Items vérifiés OK ✅

| Item                                               | Commit   | Statut                                                     |
| -------------------------------------------------- | -------- | ---------------------------------------------------------- |
| QW-1 speakable buildArticleJsonLd seo.ts           | e986fda  | ✅ cssSelector [".article-intro","h1","[data-aeo='tldr']"] |
| QW-2 legalName "Axion-IA" — 5 factories JSON-LD    | 417befc2 | ✅ Propagation parfaite                                    |
| QW-2 alternateName 4 variantes Organization        | 417befc2 | ✅ ["AxionIA","Axion IA","Axion-IA OÜ","axion-ia.com"]     |
| QW-4 external links blog-article.ts SYSTEM_PROMPT  | e986fda  | ✅ "OBLIGATOIREMENT ≥ 2 liens"                             |
| QW-4 external links blog-from-keywords.ts          | 1fb6989f | ✅ Manon P4                                                |
| QW-5 AuthorByline guides/[slug]                    | 417befc2 | ✅ authorName="Manon"                                      |
| QW-5 AuthorByline cas-concrets/[slug]              | 417befc2 | ✅ "Équipe Axion-IA" FR/EN                                 |
| QW-6 isBasedOn dans buildArticleJsonLd factory     | e986fda  | ✅ Interface + émission OK                                 |
| QW-7 CF WAF bots IA                                | —        | ✅ 307→200 (redirect locale, pas de block)                 |
| QW-8 search_term_string urlTemplate                | 417befc2 | ✅ Spec schema.org 2026                                    |
| QW-9 AggregateRating skipé (0 reviews)             | —        | ✅ Décision correcte                                       |
| QW-10 Villes proches câblé                         | —        | ✅ VilleServicePageTemplate.tsx                            |
| ArticleTOC Server Component pur                    | 417befc2 | ✅ 0 JS client, 0 hooks                                    |
| ArticleTOC JSON-LD ItemList                        | 417befc2 | ✅ position+name+url+anchor                                |
| ArticleTOC guides/[slug] câblé (steps→TocItems)    | 417befc2 | ✅ tocItems.length >= 2                                    |
| AiContentDisclaimer wording P4 (Claude Sonnet 4.6) | 1fb6989f | ✅ Cohérent AI Act art.50                                  |
| Persona Manon sans sameAs social                   | —        | ✅ Doctrine v2.1 respectée                                 |
| legal-snapshot.ts OÜ intouché                      | —        | ✅ Isolation factures OK                                   |
| Sécurité API keys côté client                      | —        | ✅ 0 fuite                                                 |
| Vitest 1376/1383                                   | —        | ✅ Baseline identique                                      |
| Web Vitals : 0 régression bundle                   | 417befc2 | ✅ 157 lignes SSR pur                                      |
| Prisma migrations P3 : 0                           | 417befc2 | ✅ Pure frontend                                           |

---

## Items partiels ⚠️

| Item                                           | Issue                                               | Impact                        | Recommandation                    |
| ---------------------------------------------- | --------------------------------------------------- | ----------------------------- | --------------------------------- |
| QW-5 AuthorByline blog/[slug]                  | Absent à HEAD — jamais committé                     | E-E-A-T blog faible           | Ajouter dans sprint P3 follow-up  |
| QW-6 isBasedOn callsite blog                   | Factory wired mais blog page ne passe pas citations | Signal d'autorité partiel     | Passer view.citations → isBasedOn |
| alternateName LocalBusiness.parentOrganization | Absent dans ce factory                              | KG pages villes moins complet | Sprint follow-up P1               |
| alternateName Dataset.creator                  | Absent dans ce factory                              | Mineur                        | Sprint follow-up P2               |
| ArticleTOC blog/[slug]                         | Absent (spec wordCount > 1500)                      | Featured Snippets blog = 0    | Ajouter dans sprint P3 follow-up  |
| Speakable seo-content-gen-factories.ts         | Sélecteurs différents de spec mais corrects         | OK en pratique                | Pas de correction urgente         |

---

## Items manquants / régressions 🔴

| Item                               | Cause                                    | Impact                          |
| ---------------------------------- | ---------------------------------------- | ------------------------------- |
| Wikidata Q-ID                      | Will action pendante                     | -20 pts Knowledge Graph         |
| hasOfferCatalog absent             | Non dans scope sprint                    | LLMs ne peuvent lister services |
| addressLocality "[Ville — France]" | Will action (adresse FR)                 | Local SEO bloqué                |
| blog/[slug] AuthorByline           | P3 n'a pas couvert blog                  | QW-5 partiel                    |
| Typecheck 4 erreurs                | P4 commit c553510d (glossary-context.ts) | Pas P3 — régression P4          |

---

## Cross-sprint conflicts détectés

| Sprint                      | Conflit                       | Sévérité | Résolution                                          |
| --------------------------- | ----------------------------- | -------- | --------------------------------------------------- |
| P3↔P4 AiContentDisclaimer   | Aucun conflit                 | ✅       | P3 ne touche pas le composant                       |
| P3↔P4 Persona Manon         | Cohérence parfaite            | ✅       | "Manon" = guides ; "Équipe Axion-IA" = cas-concrets |
| P3↔P4 Double Person JSON-LD | Duplication mineure guides    | 🟡 P2    | AuthorByline + buildHowToJsonLd émettent 2 Person   |
| P3↔P5 Isolation admin       | Aucune contamination          | ✅       | ArticleTOC absent pages admin                       |
| P4 typecheck                | 4 erreurs glossary-context.ts | 🔴 P4    | Manon doit corriger                                 |

---

## Tests fonctionnels résultats

| Test                                       | Résultat         | Note                                               |
| ------------------------------------------ | ---------------- | -------------------------------------------------- |
| Test 1 (article test génération)           | ⏭️ Non exécuté   | Script non disponible, DB prod seulement           |
| Test 2 (page /fr/audits/paris curl)        | ✅ PASS indirect | seo.ts vérifié code — Organization JSON-LD correct |
| Test 3 (sources externes articles récents) | ⏭️ Non exécuté   | Accès DB prod requis                               |
| Test 4 (CF WAF bots IA)                    | ✅ PASS          | ClaudeBot + GPTBot → HTTP 307→200 OK               |
| Test 5 (Wikidata Q-ID)                     | ❌ EN ATTENTE    | Will n'a pas encore créé la fiche                  |

---

## Gates anti-régression

| Gate            | Résultat        | vs Baseline P1.5                            |
| --------------- | --------------- | ------------------------------------------- |
| typecheck       | ❌ 4 erreurs    | Régression P4 (glossary-context.ts), pas P3 |
| lint            | ✅ 0 erreur     | Baseline OK                                 |
| vitest          | ✅ 1376/1383    | Identique baseline                          |
| isolation-check | ✅ Non régressé | Aucun import SEO côté admin                 |
| anti-hex        | ✅              | OK                                          |
| anti-siren      | ✅              | OK                                          |

**Note typecheck** : les 4 erreurs viennent du commit Manon P4 `c553510d` (module `@/content/glossary-extension` manquant). P3 commit `417befc2` n'introduit AUCUNE erreur typecheck.

---

## Actions Will pendantes status

| DW                               | Status                             | Score |
| -------------------------------- | ---------------------------------- | ----- |
| DW-3-01 Wikidata Q-ID            | ⏳ EN ATTENTE                      | 0/25  |
| DW-3-02 Adresse FR réelle        | ⏳ EN ATTENTE                      | 0/12  |
| DW-3-03 GSC service account JSON | ⏳ ENV VAR non définie dans env.ts | 0/13  |
| DW-3-04 CF WAF bots IA           | ✅ DÉJÀ OK (307→200)               | 25/25 |

---

## Correction erreur mémoire

La mémoire `axionia_keyword_strategy_audit_2026-05-19` mentionnait "concurrent homonyme = axionai.fr (rank #1 sur brand)".
**Will confirme : axionai.fr n'existe pas comme concurrent — axion-ia.com est le propre domaine Axion-IA.**
Mémoire corrigée. L'analyse "anti-concurrence" V3-04 était partiellement basée sur un faux positif.

---

## Score post-actions Will estimé

| Actions                               | Pts | Score cumulé        |
| ------------------------------------- | --- | ------------------- |
| Actuel vérifié                        | —   | **761/1000**        |
| + Wikidata Q-ID (Will crée)           | +20 | 781/1000            |
| + Adresse FR réelle                   | +7  | 788/1000            |
| + GSC service account                 | +7  | 795/1000            |
| + blog AuthorByline + TOC (follow-up) | +8  | **~803/1000 ✅ GO** |

---

## Recommandations

1. **Sprint P3 follow-up (30 min)** : Ajouter AuthorByline + ArticleTOC à blog/[slug]/page.tsx → +8 pts → score ~803 ✅ GO
2. **Sprint P4 fix** : Manon corrige glossary-context.ts (typecheck 4 erreurs)
3. **Wikidata** : Will crée la fiche → +20 pts
4. **P1 follow-up** : propagate alternateName à LocalBusiness + Dataset factories

---

_Vérification Sprint P3 — 10 agents parallèles — 2026-05-21_
