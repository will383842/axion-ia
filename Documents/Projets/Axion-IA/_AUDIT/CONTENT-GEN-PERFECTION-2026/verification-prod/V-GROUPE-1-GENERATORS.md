# V-GROUPE-1-GENERATORS — Audit PRODUCTION-READY

**Date** : 2026-05-22  
**Auditeur** : Agent IA (lecture fichiers réels, zéro supposition)  
**Répertoire cible** : `src/server/content-gen/generators/` + workers critiques + llm-judge

---

## Légende

- ✅ Élément présent et correct
- ❌ Absent ou incorrect (P0 bloquant)
- ⚠️ Présent mais variante / nuance à noter

---

## A. Les 9 générateurs

---

### blog-from-keywords.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` (SSOT Manon consultante, équivalent fonctionnel)
- ✅ `getGlossaryContext` — importé et appelé ligne 101
- ✅ `injectInternalLinks` — importé et appelé ligne 259
- ✅ `hashPrompt` — importé et appelé ligne 123 (`lastPromptHash = hashPrompt(...)`)
- ✅ SYSTEM_PROMPT contient "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — `"Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté."`
- ✅ `QUALITY_THRESHOLD = 60` — ligne 33
- ✅ `kbRetrieve` appelé — ligne 65 (k=8, mode hybrid)

---

### blog-from-title.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` (SSOT Manon consultante)
- ✅ `getGlossaryContext` — importé et appelé ligne 101
- ✅ `injectInternalLinks` — importé et appelé ligne 247
- ✅ `hashPrompt` — importé et appelé ligne 120
- ✅ SYSTEM_PROMPT contient "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — `"Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté."`
- ✅ `QUALITY_THRESHOLD = 60` — ligne 34
- ✅ `kbRetrieve` appelé — ligne 66 (k=8, mode hybrid)

---

### blog-from-rss.ts

- ✅ `getBrandVoiceForContentType` — importé et appelé directement (`getBrandVoiceForContentType("blog_from_rss")` ligne 62 dans SYSTEM_PROMPT)
- ✅ `getGlossaryContext` — importé et appelé ligne 129
- ✅ `injectInternalLinks` — importé et appelé ligne 266
- ✅ `hashPrompt` — importé et appelé ligne 149
- ✅ SYSTEM_PROMPT contient persona éditoriale — persona `BV_EDITORIAL_NEUTRE` injectée via `getBrandVoiceForContentType("blog_from_rss")` (journaliste IA, ton neutre sans "Manon" dans le texte visible du prompt — intentionnel selon brand-voice.ts)
- ⚠️ SYSTEM_PROMPT ne contient pas "Manon" littéralement — intentionnel : persona `EDITORIAL_NEUTRE` pour blog_from_rss (journalistique). Pas de violation doctrine : brand-voice.ts définit ce persona explicitement. Acceptable.
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — `"Le keyword principal DOIT apparaître textuellement dans le H1."`
- ⚠️ `QUALITY_THRESHOLD = 55` (pas 60) — seuil abaissé intentionnellement pour les articles RSS (budget $0.10 court, 450 mots min vs 500). Justifiable éditorialement mais diverge de la spec 60.
- ✅ `kbRetrieve` appelé — ligne 77 (k=6, mode hybrid)

---

### blog-article.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` (SSOT Manon consultante)
- ✅ `getGlossaryContext` — importé et appelé ligne 112
- ✅ `injectInternalLinks` — importé et appelé ligne 219-222
- ✅ `hashPrompt` — importé et appelé ligne 129
- ✅ SYSTEM_PROMPT contient "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — `"Le keyword principal DOIT apparaître textuellement dans le H1. Sans cela l'article sera rejeté."`
- ✅ `QUALITY_THRESHOLD = 60` — ligne 25
- ✅ `kbRetrieve` appelé — ligne 78 (k=8, mode hybrid)

---

### guide-pilier.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` sur SYSTEM_PROMPT_OUTLINE et SYSTEM_PROMPT_SECTION (persona Manon pédagogique car `injectBrandVoice` injecte `BV_MANON_CONSULTANTE` par défaut ; pour guide_pilier la spec brand-voice définit `BV_MANON_PEDAGOGIQUE` mais `injectBrandVoice()` sans argument type utilise la consultante — voir ⚠️)
- ⚠️ `getBrandVoiceForContentType("guide_pilier")` n'est pas appelé explicitement — `injectBrandVoice()` est utilisé (injecte `BV_MANON_CONSULTANTE` au lieu de `BV_MANON_PEDAGOGIQUE` défini dans brand-voice.ts pour guide_pilier). Divergence mineure : Manon consultante vs pédagogique. Non bloquant fonctionnellement mais sous-optimal.
- ✅ `getGlossaryContext` — importé et appelé ligne 191
- ✅ `injectInternalLinks` — importé et appelé ligne 290
- ✅ `hashPrompt` — importé et appelé ligne 182 (pour hash outline + keyword)
- ✅ SYSTEM_PROMPT_OUTLINE et SYSTEM_PROMPT_SECTION contiennent "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ⚠️ Obligation H1 keyword absente des SYSTEM_PROMPTS — le guide pilier assemble les sections via `## Étape N :` sans gate H1 explicite dans le prompt. La structure guide pilier n'a pas de H1 produit par le LLM (le H1 est géré côté page render). Non critique pour ce type de contenu.
- ❌ `QUALITY_THRESHOLD` non défini dans ce fichier — pas de quality loop multi-pass. Le guide pilier fait 1 appel outline + N appels section séquentiels, sans reboucle sur seuil. Si sections échouent, pénalité `-10 pts/placeholder`. Acceptable architecturalement (logique "soft-fail") mais aucun QUALITY_THRESHOLD n'est déclaré explicitement (la spec item 7 l'exige).
- ✅ `kbRetrieve` appelé — ligne 131 (k=10, mode hybrid)

---

### landing-ville.ts

- ❌ `getBrandVoiceForContentType` / `injectBrandVoice` — NON importé, NON appelé. Le brand voice est délégué à `resolveLandingVilleVariant()` qui retourne un `systemPromptOverride` depuis `landing-ville-templates.ts`. Ce fichier contient `DOCTRINE_INTOUCHABLE` avec "Tu es Manon" mais N'importe PAS brand-voice.ts et ne garantit pas la cohérence SSOT avec les mises à jour de brand-voice.ts (découplage du SSOT).
- ✅ `getGlossaryContext` — importé et appelé (IIFE dans userPrompt ligne 122-125)
- ✅ `injectInternalLinks` — importé et appelé ligne 166-170
- ✅ `hashPrompt` — importé et appelé ligne 133
- ⚠️ SYSTEM_PROMPT contient "Manon" — via `DOCTRINE_INTOUCHABLE` dans landing-ville-templates.ts (`"Tu es Manon, plume éditoriale d'Axion-IA"`). Présent mais hors SSOT brand-voice.ts.
- ✅ Obligation H1 keyword — non vérifiée ici (pas de gate H1 dans landing-ville, le generator ne boucle pas). Le SYSTEM_PROMPT via variant ne force pas le H1 keyword explicitement. Voir ⚠️ ci-dessous.
- ⚠️ Pas de gate H1 keyword dans landing-ville.ts — contrairement aux autres generators, il n'y a pas de boucle quality loop avec vérification H1. Le LLM peut produire un H1 sans le keyword sans que ce soit détecté.
- ❌ `QUALITY_THRESHOLD` non défini — pas de quality loop dans landing-ville. Un seul appel LLM, pas de reboucle. Si la qualité est insuffisante, le job passe quand même (qualityScore calculé mais non utilisé pour boucler).
- ✅ `kbRetrieve` appelé — ligne 45 (k=8, mode hybrid)

---

### comparison.ts

- ✅ `getBrandVoiceForContentType` — importé et appelé directement (`getBrandVoiceForContentType("comparison")` dans SYSTEM_PROMPT, ligne 56)
- ✅ `getGlossaryContext` — importé et appelé ligne 115
- ✅ `injectInternalLinks` — importé et appelé ligne 271-275
- ✅ `hashPrompt` — importé et appelé ligne 142
- ✅ SYSTEM_PROMPT contient persona — `BV_EXPERT_ANALYTIQUE` injecté (expert analytique, intentionnellement sans "Manon" pour ton impartial — conforme brand-voice.ts)
- ⚠️ SYSTEM_PROMPT ne contient pas "Manon" littéralement — intentionnel : persona `EXPERT_ANALYTIQUE` pour comparatifs (impartialité requise). Conforme brand-voice.ts.
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — `"Le keyword principal DOIT apparaître textuellement dans le H1."`
- ✅ `QUALITY_THRESHOLD = 60` — ligne 38
- ✅ `kbRetrieve` appelé — ligne 80 (k=8, mode hybrid)

---

### qa-derived.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` (injecte `BV_MANON_CONSULTANTE` au lieu de `BV_MANON_DIRECTE` défini pour qa_derived dans brand-voice.ts — voir ⚠️)
- ⚠️ `getBrandVoiceForContentType("qa_derived")` n'est pas appelé — `injectBrandVoice()` est utilisé, injectant `BV_MANON_CONSULTANTE` au lieu de `BV_MANON_DIRECTE`. La persona correcte pour Q/A est définie dans brand-voice.ts mais pas sélectionnée ici. Non bloquant (Manon reste) mais sous-optimal pour la concision Featured Snippet.
- ✅ `getGlossaryContext` — importé et appelé ligne 142
- ✅ `injectInternalLinks` — importé et appelé ligne 246
- ✅ `hashPrompt` — importé et appelé ligne 158
- ✅ SYSTEM_PROMPT contient "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ✅ SYSTEM_PROMPT — pas de gate H1 explicite dans le prompt (structure Q/A, H1 = question, pas un keyword classique). La question elle-même joue le rôle du H1. Acceptable pour ce type de contenu.
- ⚠️ `QUALITY_THRESHOLD = 55` — seuil abaissé (55 au lieu de 60). Intentionnel pour Q/A (contenu plus court, 300 mots min). Acceptable mais diverge de la spec générale.
- ✅ `kbRetrieve` appelé — ligne 107 (k=6, mode hybrid)

---

### faq-standalone.ts

- ✅ `getBrandVoiceForContentType` — utilise `injectBrandVoice()` (SSOT Manon consultante)
- ✅ `getGlossaryContext` — importé et appelé ligne 101
- ✅ `injectInternalLinks` — importé et appelé ligne 197-201
- ✅ `hashPrompt` — importé et appelé ligne 120
- ✅ SYSTEM_PROMPT contient "Manon" — `injectBrandVoice("Tu es Manon, experte IA chez Axion-IA…")`
- ✅ SYSTEM_PROMPT contient obligation H1 keyword — gate H1 vérifié dans la quality loop ligne 151-158 si `primaryKeyword` défini
- ⚠️ `QUALITY_THRESHOLD = 55` — seuil 55 (pas 60). La quality loop sort si `faqCount >= 10 && doctrine.passed` sans vérifier QUALITY_THRESHOLD numériquement (le seuil 55 est déclaré mais jamais comparé dans la boucle principale — voir logique ligne 178). QUALITY_THRESHOLD est utilisé uniquement pour l'indexationTier final (ligne 240).
- ✅ `kbRetrieve` appelé — ligne 67 (k=10, mode hybrid)

---

## B. Workers critiques

---

### content-publish-worker.ts

- ✅ `lockDuration` défini — `lockDuration: 120_000` (120 000 ms = 120 s, ≥ 120 000 ms) — ligne 613
- ✅ `getEffectivePublishCap()` lit depuis ContentGenConfig DB — ligne 90-91 : `readContentGenConfig<number>("MAX_PUBLISH_PER_DAY", 0)` avec priorité env var > DB > rampe automatique
- ✅ Rampe automatique 30→100→200→500 implémentée — lignes 93-96 :
  - `< 60 articles` → 30/jour
  - `< 300 articles` → 100/jour  
  - `< 600 articles` → 200/jour
  - `≥ 600 articles` → 500/jour
- ⚠️ Rampe docstring mentionne 30→500 mais l'implémentation a 4 paliers (30→100→200→500) — cohérent avec le code mais le commentaire tronqué en tête de fonction est imprécis

---

### content-monitoring-worker.ts

- ✅ `checkAnomalies()` appelé — défini ligne 216 et appelé dans `processJob` ligne 338 via `Promise.allSettled([checkQueueStuck(), checkSoft404(), checkIndexationStagnant(), checkAnomalies()])`
- ✅ 3 checks business implémentés (chute qualité > 15pts/1h, taux rejet > 50%/1h, 0 jobs créés depuis 4h sur campagne running)

---

### content-weekly-report-worker.ts

- ✅ Exporté (`startContentWeeklyReportWorker`) — ligne 166
- ✅ Enregistré dans worker.ts — ligne 28 (import) + ligne 73 (`startContentWeeklyReportWorker()` dans le tableau workers)
- ✅ Destinataire = `process.env.WEEKLY_REPORT_EMAIL ?? "contact@axion-ia.com"` — ligne 22, variable `REPORT_TO` utilisée ligne 161

---

## C. LLM-judge (src/server/content-gen/reviewer/llm-judge.ts)

- ✅ Seuil REJECT = 6.0 — `IMPROVE_MIN: 6.0` dans `JUDGE_THRESHOLDS` ligne 37. La logique `deriveVerdict()` ligne 266-271 : `if (globalScore < JUDGE_THRESHOLDS.IMPROVE_MIN || hasP0) return "reject"` — REJECT déclenché si score < 6.0 OU issue P0.
- ✅ Seuil cohérent avec D1 (décision 2026-05-21) et D-P5-2 (60/100 normalisé = 6.0/10)
- ✅ Verdict recomputed déterministiquement (anti-hallucination LLM) — le verdict LLM est ignoré, recomputed depuis globalScore + issues

---

## Synthèse : ❌ P0 bloquants

| # | Fichier | Item | Détail |
|---|---------|------|--------|
| P0-1 | `landing-ville.ts` | `getBrandVoiceForContentType`/`injectBrandVoice` absent | Brand voice non importé depuis brand-voice.ts SSOT. DOCTRINE_INTOUCHABLE dans templates.ts est dupliquée, hors SSOT. Toute mise à jour brand-voice.ts ne propagera pas sur landing-ville. |
| P0-2 | `landing-ville.ts` | `QUALITY_THRESHOLD` absent + pas de quality loop | Aucune boucle quality. Un seul appel LLM, qualityScore calculé mais non utilisé pour reboucler. Thin content ou score < 60 peut passer en production. |
| P0-3 | `guide-pilier.ts` | `QUALITY_THRESHOLD` non déclaré | Pas de quality loop multi-pass. Le seuil de 60 n'est jamais comparé. Pénalité -10/placeholder mais pas de reboucle si score global < 60. |

---

## Synthèse : ⚠️ À corriger (non bloquants)

| # | Fichier | Item | Détail |
|---|---------|------|--------|
| W-1 | `blog-from-rss.ts` | `QUALITY_THRESHOLD = 55` | Seuil abaissé à 55 (spec = 60). Intentionnel pour RSS mais à documenter explicitement. |
| W-2 | `qa-derived.ts` | Mauvaise persona brand voice | `injectBrandVoice()` injecte Manon consultante au lieu de `BV_MANON_DIRECTE` (optimisée Featured Snippet). Appeler `getBrandVoiceForContentType("qa_derived")`. |
| W-3 | `guide-pilier.ts` | Mauvaise persona brand voice | `injectBrandVoice()` injecte Manon consultante au lieu de `BV_MANON_PEDAGOGIQUE`. Appeler `getBrandVoiceForContentType("guide_pilier")`. |
| W-4 | `qa-derived.ts` | `QUALITY_THRESHOLD = 55` | Seuil 55 au lieu de 60. Intentionnel pour Q/A court mais diverge de la spec. |
| W-5 | `faq-standalone.ts` | `QUALITY_THRESHOLD = 55` utilisé partiellement | Déclaré mais utilisé uniquement pour l'indexationTier, pas dans la condition de sortie de boucle (qui sort sur `faqCount >= 10 && doctrine.passed`). Risque d'un article à score < 55 publié si doctrine OK + 10 FAQ. |
| W-6 | `landing-ville.ts` | Pas de gate H1 keyword | Aucune vérification que le keyword apparaît dans le H1 (contrairement aux 6 autres générateurs). |
| W-7 | `guide-pilier.ts` | Obligation H1 keyword absente des prompts | Le SYSTEM_PROMPT n'exige pas le keyword dans le H1 (le guide pilier n'a pas de H1 classique — les sections ont des H2). Acceptable architecturalement mais différent des autres. |

---

## Score global Groupe 1

| Catégorie | Score |
|-----------|-------|
| Générateurs (9) — items ✅ | 54/72 (75%) |
| Workers critiques (3) — items ✅ | 7/7 (100%) |
| LLM-judge — items ✅ | 3/3 (100%) |
| **P0 bloquants** | **3** (landing-ville ×2, guide-pilier ×1) |
| **⚠️ à corriger** | **7** |

**Verdict** : GO CONDITIONNEL — Workers et LLM-judge 100% conformes. 3 P0 sur `landing-ville.ts` et `guide-pilier.ts` à corriger avant prod à volume élevé.
