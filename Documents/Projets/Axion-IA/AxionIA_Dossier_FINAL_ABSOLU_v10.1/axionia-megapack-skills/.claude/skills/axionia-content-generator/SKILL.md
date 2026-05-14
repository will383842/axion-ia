---
name: axionia-content-generator
description: Construire / étendre / auditer le générateur de contenus Axion-IA (spec maître `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` v2.4 — Unsplash uniquement + Manon persona éditoriale transparente + photo IA disclosed v2.1 + Google Indexing API V1 + sitemap perfection). Outil jumeau du skill `axionia-connaissances` (base de connaissances, prompt séparé `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` V3 — existe déjà). Le content-generator CONSOMME la KB en lecture seule. Concepts clés v1.7 — Campagnes de couverture (§ 25) pour saturer 1 ville/département avec N contenus diversifiés selon distribution % éditable depuis admin. Pipeline 1 = landings villes (cockpit géo, indépendant). Pipeline 2 = actualités RSS (Schema NewsArticle, URL `/fr/actualites/[slug]`, sitemap-news.xml). Pipeline 3 = campagnes 5 types pilotables (blog_from_title, blog_from_keywords, comparison, faq_standalone, guide_pilier — distribution % admin). Intention de recherche (§ 26) pilier transverse — chaque contenu DOIT avoir un searchIntent classifié (informational / commercial_investigation / transactional / navigational / local) qui aligne slug + meta + structure + CTA + JSON-LD. Boucle d'amélioration qualité (§ 27) si score 40-74 → repassage automatique ciblé max 2× (économie tokens). Q/R post-process automatique (§ 29) chaque contenu génère 8 Q/R + chaque Q/R devient page indexable `/fr/faq/[slug]` (≥ 300 mots anti-thin, QAPage Speakable JSON-LD). Anti-doublon 4 couches (§ 25.5) Levenshtein + topic fingerprint + embedding cosine ≥ 0.85 + similarity-monitor admin. 100 % pilotage admin (16+ sections sous `/[adminPrefix]/content-gen/`). Multi-campagnes en parallèle. Auteur canonique = Manon (FR-only, table AuthorProfile éditable admin). Anti-doorway HCU, perfection SEO/AEO/GEO 2026 (60+ items checklist + llms.txt + IndexNow + canonical FR + 9 schemas JSON-LD + NewsArticle pour actualités + QAPage pour Q/R). Web Vitals stricts (LCP ≤ 1800ms, INP ≤ 100ms, CLS = 0, JS ≤ 75 KB gz). Mode autopilote (§ 24) avec 13 STOP & ASK défauts — seul Q13 Manon est gate humain. SLO génération : landing ville p50 ≤ 90 s, blog 1500 mots p50 ≤ 40 s. Déclencheurs : « content generator », « génération de contenus », « content factory », « campagne de couverture », « landing villes », « publication automatisée », « Manon » comme auteur, « pSEO industrialisation », « 2150 villes », « AEO 2026 », « llms.txt », « indexnow », « intention de recherche », « boucle qualité », « actualités RSS », « similarity monitor », « kanban publication », ou toute extension / audit / debug de module sous `src/server/content-gen/*`, `src/app/[locale]/(admin)/[adminPrefix]/content-gen/*`, `src/components/admin/content-gen/*`, `src/server/queue/workers/content-*`, `prisma/seeds/content-gen/*`, `scripts/content-gen/*`, `tests/content-gen/*`, `docs/content-gen/*`.
---

# Skill : Générateur de contenus Axion-IA (v1.7 skill / v2.4 master / v2.1 Manon)

## Quand l'invoquer

Déclenche ce skill quand l'utilisateur demande l'un des éléments suivants :

- Construire / modifier / auditer le générateur de contenus (console admin sous `/[adminPrefix]/content-gen/*`, services dans `src/server/content-gen/*`, workers dans `src/server/queue/workers/content-gen-*`)
- Créer / lancer / suivre une **campagne de couverture** sur une ville / département / région
- Générer ou produire en masse des pages d'atterrissage villes (cockpit géographique France interactif)
- Produire articles de blog, comparatifs, guides piliers, FAQ standalone via l'outil
- Configurer providers IA (OpenAI GPT-4o, Anthropic Claude 4.x, Perplexity Sonar, Unsplash) — toggles, plafonds de coût, kill switch
- Gérer Manon comme auteur canonique (JSON-LD Person, photo, signature, fiche auteur, page `/fr/equipe/manon`)
- Implémenter / auditer la **checklist SEO/AEO/GEO** (60+ items § 9.7 de la spec maître)
- Implémenter / auditer **l'indexation perfection 2026** (sitemap split, IndexNow, Google Indexing API, llms.txt, `.md` machine-readable, sitemap-news.xml pour actualités, sitemap-faq.xml pour Q/R)
- Optimiser la **rapidité de génération** (streaming, prompt caching, anti-cascade, génération d'image en parallèle)
- Consulter la base de connaissances (LECTURE SEULE — voir `references/kb-doctrine.md`)
- Configurer la **distribution % par type** depuis l'admin
- Configurer le **mix d'audiences** (taille INSEE × type d'organisation)
- Lancer la **boucle d'amélioration qualité** sur contenus tier-2
- Pilotage **dashboard kanban** publications (brouillon / en revue / publié / refusé)

## Que faire

1. **Lire la spec maître d'abord** (obligatoire) : `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (~40 000 mots, 29 sections — v1.7). C'est la source unique de vérité.
2. **Lire la spec data model** : `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md` (acté Will 2026-05-08).
3. **Note Base de connaissances** : la KB **existe déjà** — prompt maître `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` V3 (~1377 lignes, 18 agents, 24 sprints) + skill actif `axionia-connaissances` dans `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-connaissances/SKILL.md`. Le content-generator **consomme** la KB en lecture seule via `src/server/content-gen/kb-client.ts` (gate dur ≥ 300 chunks). Pour ingérer/éditer la KB → utiliser le skill `axionia-connaissances` dans une session séparée.
4. **Reality-check § 2.1** de la spec maître avant tout code : vérifier que Prisma 5.22, BullMQ, `regions.ts`, `villes/data/*.ts`, layout admin, `src/lib/seo.ts` existent toujours.
5. **Poser les 13 STOP & ASK** du § 20 de la spec maître et **attendre les réponses Will** avant tout code.
6. **Puis exécuter Sprint 1** selon § 17 (Foundations DB + Providers + Quality) avec les 8 agents parallèles AGT-A..H selon § 16.

## Contraintes intouchables (§ 21 de la spec maître)

- Naming : **Axion-IA** partout
- OÜ estonienne — **0 SIREN/SIRET/RCS** dans contenus générés
- Doctrine **≥ 95 % AxionIA-centric**, ≤ 5 % données INSEE
- Palette intouchable : terracotta `#C45A3E`, crème `#FAF7F2`, ink `#1F1B16`
- **FR uniquement** (décision v1.2) — aucune génération EN
- **Auteur = Manon** sur tous les contenus générés
- Anti-doorway HCU : tier-2/3 noindex, sitemap tier-1 only
- Budget perf LCP ≤ 1 800 ms p75, INP ≤ 100 ms p75, CLS = 0, First Load JS ≤ 75 KB gz/route
- WCAG 2.2 AA
- Tarifs strictement via `formatAmount()` SSOT (jamais en dur)
- Aucune modification SSOT (`pricing.ts`, `regions.ts`, `interventions.ts`, `audit-taxonomy.ts`, `implementation.ts`) sans STOP & ASK

## Cloisonnement répertoires (§ 4.1bis spec maître)

Tout le code content-generator DOIT vivre dans des dossiers dédiés :
- `src/server/content-gen/**`
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**`
- `src/components/admin/content-gen/**`
- `src/server/queue/workers/content-*-worker.ts`
- `prisma/seeds/content-gen/**` + `prisma/migrations/*_content_gen_*`
- `scripts/content-gen/**`
- `tests/content-gen/**` + `docs/content-gen/**`
- `public/illustrations/generated/content-gen/**`

`pnpm content-gen:isolation-check` échoue si un fichier hors zones est touché.

## Sous-prompts disponibles (ce dossier)

- `prompts/landing-ville.md` — landing ville (Pipeline 1)
- `prompts/blog-article.md` — blog (4 sources : titre / mots-clés / RSS / pilier)
- `prompts/comparatif.md` — comparatif (Pipeline 3)
- `prompts/guide-pilier.md` — guide pilier (Pipeline 3, 2 étapes avec STOP outline)
- `prompts/qa-derived.md` — extraction Q/R (post-process auto v1.7)
- `prompts/faq-standalone.md` — FAQ standalone (Pipeline 3)
- `checklists/seo-aeo-60-items.md` — validation HTML 60+ items par URL
- `checklists/web-vitals.md` — budget Lighthouse + RUM
- `checklists/exit-v1.md` — critères Sprint 6 GO
- `references/manon-person.md` — **v2.1** JSON-LD Person canonique (Option 4 portrait IA disclosed + zéro réseau social + AuthorProfile schema extension)
- `references/doctrine-axionia.md` — extrait de doctrine pour prompts
- `references/kb-doctrine.md` — **v2.0** contrat consommation + alimentation KB V4 réelle (`KnowledgeEntry`, pas `KbDocument`/`KbChunk` obsolètes)
- `references/web-vitals-integration.md` — **🆕 Sprint S0bis** pipeline RUM + lab + alerts Telegram + WebVitalSample schema
- `references/skill-orchestration.md` — **🆕 Sprint S0bis** matrice de délégation aux 9 siblings axionia-*

Chargés à la demande par Claude lors de l'implémentation. Ne remplacent jamais la spec maître.

## Orchestration inter-skills (Sprint S0bis 2026-05-14)

Le content-generator n'est pas autonome. Il **coordonne** avec 9 siblings `axionia-*`. Détails dans `references/skill-orchestration.md`. Résumé :

| Quand | Skill à charger |
|---|---|
| Toujours au début de session | `axionia-core` (doctrine globale, mot « formation » banni) |
| KB CRUD admin, RGPD, factory ingest API | `axionia-connaissances` (jumeau KB V4) |
| Migrations Prisma hors content-gen | `axionia-database` |
| Stack Next 16 / BullMQ / Coolify | `axionia-stack` |
| Mobile-first + Web Vitals UI patterns | `axionia-mobile-first` |
| Palette, typo, hero schemas (intouchables) | `axionia-design` |
| FR/EN, hreflang, sitemap multilingue | `axionia-i18n` |
| Templates email post-publish | `axionia-emails` |
| Schemas génériques meta (le content-gen prime) | `axionia-seo-aeo` |

⚠️ **Frontière KB nette** :
- Content-gen **lit** la KB via `KnowledgeEntry` (RAG) **ET écrit** des entrées tier-1 via `kb-feeder.ts` avec `sourceFactoryId="content-gen-v1"`
- Skill `axionia-connaissances` est propriétaire du schéma KB, de l'admin, de la RGPD, du DR massif
- **Ne JAMAIS** créer de tables `KbDocument` ou `KbChunk` — artefacts obsolètes du master pré-V4. Voir `references/kb-doctrine.md`.

## Phrases d'invocation

### A. Mode standard (Will valide chaque STOP & ASK manuellement)

```
Skill : axionia-content-generator

Lis intégralement _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md (spec maître BUILD v1.7).
Puis lis _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md (data model acté). La KB existe déjà
(axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md) — content-generator la consomme en
lecture seule via kb-client.ts (§ 11 de la spec maître).

Avant tout code, fais le reality-check § 2.1 (prisma, BullMQ, regions.ts, villes/data,
layout admin). Pose-moi les 13 STOP & ASK du § 20 et attends mes réponses.

Mode : 🛠️ BUILD (pas AUDIT-ONLY).
Doctrine : AxionIA-centric ≥ 95 %, FR uniquement, auteur = Manon, anti-doorway HCU,
checklist SEO/AEO 60+ items § 9.7, Web Vitals § 9.10, rapidité génération § 9.11,
campagnes de couverture § 25, intention recherche § 26, boucle qualité § 27,
actualités RSS § 28, Q/R post-process § 29.

Sprint en cours : [à préciser — défaut S1 Foundations DB + Providers]
Agents à lancer en parallèle : selon § 16 (AGT-A à AGT-H).
```

### B. Mode AUTOPILOTE (Claude exécute Sprint 1→6 sans pause sauf Q13 Manon)

```
Skill : axionia-content-generator (mode AUTOPILOTE)

Tu es en mode autopilote bout-en-bout. Lis dans l'ordre :
1. .claude/skills/axionia-content-generator/SKILL.md
2. .claude/skills/axionia-content-generator/auto-pilot.md
3. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 24 + § 25 + § 26 + § 27 + § 28 + § 29
4. _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md
5. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (créer si absent)

Applique les défauts § 24.2 + § 25-29 pour les STOP & ASK. Q13 Manon = SEUL gate humain
bloquant.

Phase 0 reality-check § 2.1. Si KO → STOP ciblé.
Si log montre Sprint N passé → reprends Sprint N+1.
Sinon démarre Sprint 1.

À chaque sprint : agents AGT-A..H en // → pnpm verify:all + pnpm content-gen:isolation-check
→ commit Conventional → push origin/main → Coolify deploy → log → sprint suivant
immédiatement.

Critères STOP durci § 24.4. Hors ces 8 cas, avance sans demande inutile.

Cible : Sprint 6 → Verdict 🟢 GO PROD score ≥ 160/200.

Doctrine intouchable : AxionIA-centric ≥ 95 %, FR uniquement, auteur Manon,
anti-doorway HCU, checklist SEO/AEO 60+ items, Web Vitals stricts,
SLO p50 landing ville ≤ 90 s, intention recherche systématique, Q/R post-process
auto, boucle qualité ON.

Mode : 🛠️ BUILD + AUTOPILOTE.
```

## Maintenance

Quand la spec maître est patchée, bump la ligne version dans son header (`Date : vX.Y`) et mettre à jour `~/.claude/projects/.../memory/axionia_prompt_content_generator_master.md` avec le résumé du diff. Ce fichier SKILL.md NE doit PAS être mis à jour sauf si les conditions de déclenchement ou l'arborescence des dossiers change.
