# 01 — AUDIT DU PIPELINE DE GÉNÉRATION

Format : `[SÉVÉRITÉ] | Localisation | Problème | Impact`. Vérifié sur la vraie codebase.

## 1.1 — Orchestration & déclenchement

- ✅ **Orchestrateur central** : `content-orchestrator-worker.ts` (~824 l), cron BullMQ ~toutes les 15 min, pickup des campagnes `status='running'`. Enqueue structuré + `idempotencyKey` SHA256 (`campaign::slot::type::ancrage`) anti-doublon.
- ✅ **Verrous** : `acquireKeywordLock` (Redis, TTL 30 min) empêche 2 workers de générer le même mot-clé ; lock relâché au publish. Lock atomique DB `FOR UPDATE SKIP LOCKED` côté sélection mots-clés.
- ✅ **Retry** : defaults BullMQ `attempts:5`, backoff exponentiel 5 s. Kill-switch (`ContentGenConfig.kill_switch`) + hard-gate `assertKbReady()` (KB < 50 entrées / ratio canonical < 60 % / > 90 j sans ingest).

```
[MAJEUR] | content-orchestrator-worker.ts (mode build stub) | Pas de check explicite stub.invalid dans l'orchestrateur : en build/DB vide il peut tourner « à vide » sans erreur visible (les queries renvoient 0). | Boucles silencieuses possibles ; observabilité réduite.
[MINEUR] | content-gen-worker.ts:~302 | Dedup pré-IA skippé si `inputPayload.title` absent (cas blog_from_keywords sans titre initial). | Vérif titre-duplicate pré-LLM contournée (l'outline-dedup post-LLM reste actif).
```

## 1.2 — Construction du contexte

- ✅ Variables injectées : `vertical` (activité), `targetSecteur` (pain-matrix, commercial), `searchIntent` (échantillonné + **garde-fou** `allowKeywordIntent`), `anchorVilleSlug` (+ alentours), `targetAudienceSize/Organisation`, `targetLocale:"fr"`. Mot-clé via `selectKeywordRich` (rotation cluster-aware).
- ⚠️ **Langue** : FR forcé (EN désactivé 2026-05-16) → pas de variante multilingue générée (cohérent avec la décision produit, mais voir 07 sur hreflang).
- ⚠️ **Donnée intent mot-clé** : la colonne `keywords.search_intent` mélange un vocabulaire FR/custom (`transactionnel`, `sectoriel`, `aeo`…) non aligné sur l'enum `SearchIntent` (normalisation existe mais partielle). Cf. note keyword-selector.

## 1.3 — Prompts (21 types enregistrés)

21 générateurs : `blog_article` (3-appels plan→expand), `blog_from_keywords`, `blog_from_title`, `blog_from_rss`, `comparison`, `guide_pilier`, `qa_derived`, `faq_standalone`, `barometer_insight`, `landing_ville_*` (5) + 12 v7-phase8 (`long_tail`, `pain_point`, `vs_comparator`, `alternative_to`, `top_x_in_y`, `how_to`, `best_for`, `calculator_roi`, `glossary`, `what_is_x`, `faq_geo`, `case_study_local`).

- ✅ Les prompts demandent H1(=title)/H2/intro/FAQ/directAnswer + metaTitle 50-60 + metaDescription 140-155 + ton brand-voice Manon + answer-first (AEO) + anti-hype (doctrine). Sortie JSON strict. Cible de longueur par type.
- ⚠️ **SEO meta dans la même passe** : OK pour la plupart (metaTitle/metaDescription produits avec le plan). Le **JSON-LD/schema.org n'est PAS demandé au LLM** — il est construit côté page (`lib/seo.ts`) au rendu (bon choix : déterministe). À noter pour la grille du prompt qui le réclamait.

```
[MINEUR] | prompts (tous) | metaDescription cible « 140-155 » mais sorties réelles 107-144 (cf. 02) : la contrainte de longueur n'est pas respectée par le LLM et n'est pas re-tentée si trop courte. | Snippets SERP sous-optimisés (pattern qualité, cf. 02.2).
```

## 1.4 — Appels LLM

- ✅ **Modèles** : OpenAI (gpt-4o / gpt-4o-mini) + Anthropic (sonnet-4-6 / opus-4-8 / haiku-4-5) via router providers. Pricing centralisé, **cost-tracking atomique** (`CostLedger` + `assertCostCapAvailable` pré-appel) + **circuit breaker** (5 échecs/30 s) + retry backoff (10/30/60 s) + timeouts (30 s OpenAI, 60 s Anthropic) + rate-limit 429 géré.
- ⚠️ **Température** : ~0.4 (plan) / 0.5 (expansion), **hardcodée** dans les générateurs.

```
[MAJEUR] | providers/openai.ts, anthropic.ts | `finish_reason` n'est PAS inspecté : un `length` (troncature LLM) est persisté tel quel sans retry. | Corps incomplets possibles ; atténué par les gates word-count + l'archi 3-appels, mais pas détecté explicitement.
[MAJEUR] | générateurs + content-gen-worker.ts:~495 | Température (et autres réglages) configurable seulement si un `ContentTemplate` est explicitement appliqué ; campagnes sans template → réglages immuables sans redeploy. | Pas d'ajustement de ton/créativité depuis la console pour le flux nominal.
[MINEUR] | content-orchestrator-worker.ts:~40 | Singleton queue Redis non explicitement fermé à l'arrêt worker. | Fuite de connexion possible en cas de restarts fréquents.
```

## 1.5 — Post-traitement

```
[REFUTÉ — NON une vulnérabilité] | « HTML LLM non sanitisé → XSS persistant »
VÉRIFICATION (grep exhaustif) : la sanitisation est appliquée À DEUX endroits (defense-in-depth) :
 (1) GÉNÉRATION — chaque générateur appelle `sanitizeContentGenHtml()` AVANT de retourner son bodyHtml :
     blog-article.ts:412, blog-from-keywords.ts:391, comparison.ts:421, faq-standalone.ts:244,
     blog-from-rss.ts:364, blog-from-title.ts:389, barometer-insight.ts:399, guide-pilier.ts:303,
     qa-derived.ts:94/96/104/279, v7-phase8-shared.ts:254 (= TOUS les générateurs).
 (2) RENDU — chaque page re-sanitise AVANT dangerouslySetInnerHTML :
     blog/[slug]/page.tsx:288→549, actualites/[slug]/page.tsx:297, guides/[slug]/page.tsx:159.
Le sanitizer (DOMPurify, html-sanitizer.ts) bloque script/iframe/svg/on*/javascript:/data:text-html,
FORBID h1, rel/noopener trust-tier. 17 tests anti-XSS. → Le body STOCKÉ est déjà propre.
CONCLUSION : Agent generation + agent backend ont signalé un CRITIQUE XSS en ne grepant QUE
content-gen-worker/publish-worker (qui en effet n'appellent pas le sanitizer) — mais l'amont (générateurs)
ET l'aval (rendu) le font. Aucune action P0 requise. (Defense-in-depth ✅.)
```

- ✅ Liens internes : `injectInternalLinks` + catalogue (`ALL_EXTERNAL_LINKS` ~2400 liens vérifiés) ; `appendSourcesSection` (citations déterministes). Liens internes catalogués (cibles connues).
- ✅ Images : hero via `selectHeroImage` (Unsplash primaire → image-bank fallback) + alt généré. Encodage entités géré par DOMPurify.

```
[MAJEUR] | content-publish-worker.ts (~300) | Le hero (filepath/alt/source) lu depuis `outputJsonRaw` n'est pas re-validé avant insert (URL Unsplash hotlinkée). | Risque d'images héro mortes en prod si l'URL Unsplash expire / CDN purge.
[MINEUR] | content-publish-worker.ts | Les liens internes injectés sont catalogués (cibles connues) mais il n'y a pas de vérification HTTP « la cible existe » au publish. | Faible : le catalogue est maintenu, mais une route retirée pourrait laisser un lien mort.
```

### Bilan Étape 1

1 CRITIQUE **réfuté** (XSS), 0 CRITIQUE réel, ~5 MAJEURS (finish_reason, température figée, hero non validé, stub-loop, stub silencieux), quelques MINEURS. **Pipeline robuste et mature** ; les vrais axes = troncature LLM non détectée + configurabilité température + validation hero.
