# PROMPT — VÉRIFICATION GLOBALE P1.5 FINAL
# Cohérence · Connectivité · Opérabilité · Conformité
# Mode : AUDIT-ONLY (zéro commit, zéro modification)

---

## CONTEXTE

Le Sprint P1.5 (Phase A + Phase B) a livré les composants suivants sur origin/main (branche `main`, repo `will383842/axion-ia`) :

| Commit | Item |
|---|---|
| `ffdb49a6` | Phase A — lift double HOLD compliance (aiGenerated JSON-LD + drip 30/jour + AiContentDisclaimer) |
| `fb87f6bb` | Phase A follow-up — seed isAiGenerated fix |
| `ce13e497` | B.1 — P0-5 internalLinkCount passé aux 4 generators |
| `e1c0af75` | B.2 — P0-10 pauseCampaign() purge BullMQ |
| `994017be` | B.3 — verticale sites_web_augmentes (Prisma enum + hub) |
| `c08d3aff` | B.4 — P0-9 GenerationProvenance model + service |
| `B.5` | P0-7 keywords 747 seeds → selectKeyword + title validation |
| `P0-4` | Image hero pipeline assignment depuis image-bank |
| `P0-6` | SimHash couches 3+4 + OpenAI embeddings pgvector HNSW |
| `P0-3` | LLM-as-judge Claude Sonnet reviewer multi-dimensionnel |

**Ta mission** : vérifier que TOUT est cohérent, connecté, fonctionnel et opérationnel de bout en bout. Pas d'audit de fond (déjà fait en P1). Pas de nouveaux développements. QA gate uniquement.

---

## MODE OPÉRATOIRE

- **AUDIT-ONLY strict** — aucun commit, aucune modification de fichier
- **Lecture seule** — lit les fichiers source, les migrations, les tests, les workers
- **10 agents parallèles** — chacun vérifie un périmètre précis
- **Livraison** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/RAPPORT-VERIFICATION-FINALE.md`
- **Verdict final** : GO ✅ / GO CONDITIONNEL ⚠️ / NO-GO 🔴 avec liste d'actions bloquantes

---

## SPAWN 10 AGENTS EN PARALLÈLE

---

### AGENT V-1 — Gates techniques

**Objectif** : vérifier que le repo compile, passe les tests et les hooks.

Vérifications :
1. `pnpm typecheck` → 0 erreur TypeScript attendu
2. `pnpm lint` → exit 0 attendu
3. `pnpm test --run` → tous les tests passent (compter : baseline était 1290/1290 après Phase A)
4. Pre-commit hooks × 4 (anti-siren, anti-hex, use-client, typecheck) → tous verts
5. Pre-push hooks (i18n check, zod check, vitest full) → tous verts
6. Migrations Prisma : `prisma migrate status` → aucune migration en attente non appliquée
7. `prisma validate` → schema.prisma valide
8. Build production : si possible lancer `pnpm build` ou au moins vérifier qu'aucun import cassé évident

**Score** : `/20` (3 pts typecheck/lint/tests + 2 pts hooks + 3 pts Prisma + 4 pts build + 8 pts bonus détail)

**Output** : liste de chaque gate avec résultat réel + tout warning non bloquant signalé.

---

### AGENT V-2 — Flow E2E pipeline génération

**Objectif** : tracer le chemin complet d'un article de bout en bout et vérifier que chaque étape est connectée.

Flow attendu (à vérifier dans le code) :
```
Campaign créée → Job lancé dans BullMQ
→ content-gen-worker.ts : lit campagne + verticale + cible
→ selectKeyword() : sélectionne 1 keyword depuis table Keyword (747 seeds)
→ Generator (selon type : blog/cas-concret/landing/faq) : génère HTML+MD
→ validateKeywordInTitle() : vérifie présence keyword dans title
→ assignHeroImage() : attribue image depuis image-bank (P0-4)
→ internalLinkCount : liens internes injectés (P0-5)
→ dedup-guard : SimHash couches 1→4 (P0-6) → GO/REJECT
→ llm-judge.ts : score qualité multi-dim (P0-3) → GO/IMPROVE/REJECT
→ content-quality-improver-worker.ts : boucle amélioration si score insuffisant
→ GenerationProvenance : enregistre hash + provider + model + timestamp (P0-9)
→ content-publish-worker.ts : publie si score ≥ seuil + drip 8h-22h CET + cap 30/jour
→ sitemap + IndexNow ping
```

Pour chaque étape : localiser le fichier exact, vérifier que l'appel existe réellement (pas un TODO/stub).

**Score** : `/30` (3 pts par étape × 10 étapes)

**Output** : tableau étape / fichier / statut (✅ connecté / ⚠️ stub / 🔴 absent).

---

### AGENT V-3 — Système keywords 747 seeds

**Objectif** : vérifier l'intégration complète du système de mots-clés.

Vérifications :
1. Table `Keyword` existe dans schema.prisma avec champs : `id`, `keyword`, `vertical`, `intent`, `contentType`, `sector`, `lastUsedAt`, `usageCount`, `priority`
2. Migration `add_keywords_table` appliquée (fichier SQL présent dans `prisma/migrations/`)
3. `src/server/content-gen/keyword-selector.ts` :
   - Fonction `selectKeyword(vertical, contentType, target)` implémentée (pas NO-OP)
   - Lock atomique ou mécanisme anti-collision si plusieurs campagnes parallèles
   - Mise à jour `lastUsedAt` + `usageCount` après sélection
4. Fonction `validateKeywordInTitle(title, keyword)` implémentée — vérifie présence réelle
5. Seeds : fichier(s) seed runner pour les 747 keywords existent dans `prisma/seeds/` ou équivalent
6. Integration dans `content-gen-worker.ts` : `selectKeyword` appelé avant appel generator
7. Si `selectKeyword` retourne null (aucun keyword dispo) : comportement défini (fallback ou skip)
8. KB (Knowledge Base) : vérifier que les generators continuent à utiliser la KB pour le contenu (pas régressé)

**Score** : `/20`

**Output** : chaque point avec résultat + signal d'alerte si keyword peut être null sans handler.

---

### AGENT V-4 — LLM-as-judge (P0-3)

**Objectif** : vérifier que le reviewer qualité est fonctionnel et branché.

Vérifications :
1. `src/server/content-gen/llm-judge.ts` existe et n'est pas un stub vide
2. Dimensions évaluées (vérifier dans le code) : originalité, pertinence keyword, lisibilité, densité liens, conformité brand voice, AI Act disclaimer présent, longueur suffisante — au minimum 4 dimensions sur 7 attendues
3. Le reviewer utilise un **modèle différent** du générateur (pas le même LLM qui génère ET juge)
4. Score retourné : format numérique ou enum (GO / IMPROVE / REJECT) utilisable par le worker
5. `content-quality-improver-worker.ts` : lit le score du judge + décide boucle amélioration
6. Seuil de score configurable (env var ou config) — pas hardcodé
7. Branchement dans `content-gen-worker.ts` : résultat judge → routing (publier / améliorer / rejeter)
8. En cas d'erreur LLM-judge (timeout, API error) : fallback défini (publier quand même ? rejeter ? logguer ?)
9. Coût maîtrisé : pas d'appel LLM-judge en double sur même contenu

**Score** : `/20`

**Output** : chaque point + estimation du coût par article si visible dans le code.

---

### AGENT V-5 — Image hero pipeline (P0-4)

**Objectif** : vérifier que chaque article publié reçoit une image hero depuis l'image-bank.

Vérifications :
1. Fonction/service `assignHeroImage` (ou équivalent) : fichier + fonction localisés
2. Logique de sélection : par verticale ? par secteur ? par tags ? aléatoire ? — vérifier la stratégie
3. Requête image-bank : utilise table `image_assets` (ou équivalent) pour trouver une image pertinente
4. Champ `heroImageId` (ou équivalent) posé sur l'article avant publication
5. Si aucune image trouvée pour la verticale : fallback défini (image générique ? skip ? erreur ?)
6. `is_ai_generated = false` respecté : la sélection n'attribue pas d'images IA (contrainte absolue projet)
7. Branchement dans le flow : `assignHeroImage` appelé AVANT `content-publish-worker`
8. Pages `/blog/[slug]` et `/cas-concrets/[slug]` : lisent le `heroImageId` et l'affichent (`<Image>` Next.js)

**Score** : `/15`

**Output** : chaque point + signal si le fallback "aucune image" peut bloquer la publication.

---

### AGENT V-6 — Anti-doublons SimHash + embeddings (P0-6)

**Objectif** : vérifier que les 4 couches de déduplication sont réellement actives (pas NO-OP).

Architecture attendue (4 couches) :
- **Couche 1** : title exact hash (déjà existant avant P1.5)
- **Couche 2** : SimHash 64-bit sur contenu texte
- **Couche 3** : SimHash outline templatique (structure H2/H3)
- **Couche 4** : OpenAI text-embedding-3-large → pgvector cosine similarity HNSW

Vérifications :
1. `src/server/content-gen/dedup-guard.ts` (ou équivalent) : les 4 couches sont appelées (pas juste couche 1)
2. Extension pgvector activée dans schema.prisma (`/// @db.Vector(3072)` ou `vector(3072)`)
3. Index HNSW présent dans la migration Prisma (opérateur cosine)
4. Champ `Article.embedding` (ou équivalent) de type vector(3072)
5. `src/server/content-gen/embedding-similarity.ts` (ou équivalent) : appel OpenAI `text-embedding-3-large` réel (pas mock)
6. Seuil de similarité configuré (ex. 0.95 → doublon) — pas hardcodé ou commenté
7. `topic-fingerprint.ts` : SimHash outline implémenté (pas fonction vide)
8. Résultat dédup : retourne UNIQUE / DUPLICATE / NEAR-DUPLICATE avec score
9. Aucun article ne peut être publié sans passer par dedup-guard

**Score** : `/20`

**Output** : chaque couche avec statut (✅ actif / ⚠️ partiel / 🔴 NO-OP).

---

### AGENT V-7 — GenerationProvenance AI Act (P0-9)

**Objectif** : vérifier la traçabilité 6 ans exigée par l'AI Act art. 50.

Vérifications :
1. Modèle Prisma `GenerationProvenance` (ou équivalent) existe avec champs : `articleId`, `provider`, `modelId`, `promptHash`, `generatedAt`, `qualityScore`, `provenanceHash` (hash chainé pour intégrité)
2. Migration correspondante présente et cohérente avec le schema
3. `src/server/content-gen/generation-provenance.ts` : service qui crée l'enregistrement
4. Enregistrement créé pour **chaque** article généré — pas seulement ceux publiés
5. `provenanceHash` : mécanisme de hash chainé (ou équivalent) pour détection de falsification
6. Rétention 6 ans : pas de purge automatique sur cette table (ou purge après 6 ans minimum)
7. Accessible depuis l'admin : au moins une page ou endpoint pour consulter la provenance d'un article
8. Compatible avec `aiGenerated:true` JSON-LD déjà posé en Phase A

**Score** : `/15`

---

### AGENT V-8 — Nouvelles fonctionnalités (P0-5, P0-10, verticale)

**Objectif** : vérifier les 3 items plus courts livrés en Phase B.

**P0-5 internalLinkCount** :
1. Les 4 generators (blog, cas-concret, landing, faq) reçoivent bien `internalLinkCount` comme paramètre
2. La valeur est utilisée dans le prompt ou la logique (pas ignorée)
3. Valeur par défaut définie si non fournie

**P0-10 pauseCampaign() BullMQ purge** :
1. Fonction `pauseCampaign(campaignId)` (ou équivalent) : purge les jobs BullMQ en attente pour cette campagne
2. Ne supprime pas les jobs déjà `completed` ou `failed` (uniquement `waiting` + `delayed`)
3. Accessible depuis l'API admin (endpoint ou Server Action)
4. Pas de risque de purger des jobs d'une autre campagne par erreur

**Verticale `sites_web_augmentes`** :
1. Enum Prisma `Vertical` inclut `sites_web_augmentes`
2. Migration correspondante présente
3. `pricing.ts` (ou équivalent) : la verticale est référencée
4. Page hub existe (au moins une route `/[locale]/sites-web-augmentes` ou équivalent)
5. Les generators acceptent cette verticale sans erreur TypeScript

**Score** : `/15`

---

### AGENT V-9 — Conformité compliance (AI Act + Google Policy)

**Objectif** : vérifier que les fixes Phase A sont toujours en place et que Phase B n'a pas créé de régression compliance.

Vérifications :
1. `/blog/[slug]/page.tsx` : JSON-LD contient `aiGenerated:true` ET `additionalType` (Phase A QW-1)
2. `/cas-concrets/[slug]/page.tsx` : `AiContentDisclaimer` présent + `aiGenerated:true` JSON-LD (Phase A QW-6)
3. `content-publish-worker.ts` : `MAX_PUBLISH_PER_DAY` lu depuis env (pas hardcodé à 30) + drip `moveToDelayed` actif entre 8h-22h CET
4. `GenerationProvenance` : tous les articles publiés après Phase B ont une provenance enregistrée
5. Aucune page nouvellement créée (verticale `sites_web_augmentes`, hub, etc.) ne manque de mention disclaimer AI
6. `factoryAutoPublishAllBlogTypes` : toujours ON (décision D-W3 Will) — noter le risque résiduel A18 dans le rapport
7. DB SQL pending : rappeler que `UPDATE image_assets SET is_ai_generated=false WHERE is_ai_generated=true AND ai_model IS NULL` reste à exécuter manuellement par Will

**Score** : `/15`

---

### AGENT V-10 — Cohérence globale + convergence Manon

**Objectif** : vérifier qu'il n'y a pas de dead code, stubs NO-OP, imports cassés, ni conflits avec les sessions parallèles Manon.

Vérifications :
1. Aucun `TODO: Phase B` ou `// NOT IMPLEMENTED` restant dans les fichiers livrés
2. Aucun import qui pointe vers un fichier inexistant (vérifier les nouveaux fichiers créés)
3. Pas de doublon de fonction entre les nouveaux services (ex. deux `selectKeyword` dans deux fichiers différents)
4. Convergence Manon : fichiers `villes/copy/*.ts` et `image-bank/seed-images.ts` — vérifier qu'ils n'ont PAS été touchés par Phase B
5. Sprint S+5 P2 local (commit `6aaa57f` en attente) : vérifier qu'aucun fichier de Phase B ne conflit avec ce commit en attente
6. Aucun `run_logs.txt` ou artefact runtime commité par erreur
7. `CHANGELOG` ou `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` mis à jour pour refléter les nouvelles capacités
8. Tous les nouveaux services sont enregistrés dans l'injection de dépendances ou le barrel export si le projet utilise ce pattern

**Score** : `/10`

---

### AGENT V-11 — Zero Mock · Zero Invention · Production Ready

**Objectif** : vérifier qu'aucun composant livré ne repose sur des données inventées, des mocks, des stubs, ou des valeurs hardcodées non configurables. Tout doit être prêt pour la production réelle.

**Zero Mock / Zero Fake data** :
1. `llm-judge.ts` : appel LLM réel (pas `MOCK_LLM_JUDGE=true` ou retour hardcodé `score: 9`)
2. `embedding-similarity.ts` : appel OpenAI Embeddings API réel (pas vecteur zéro ou random)
3. `keyword-selector.ts` : requête DB réelle (pas liste hardcodée de keywords en mémoire)
4. `assignHeroImage` : requête image-bank DB réelle (pas image placeholder hardcodée)
5. `GenerationProvenance` : enregistrement DB réel (pas `console.log` seulement)
6. `pauseCampaign` : appel BullMQ réel (pas flag en mémoire)
7. Seeds keywords : les 747 seeds sont dans un fichier seed réel exécutable (`prisma db seed` ou script) — pas juste un TODO

**Zero Invention / Zero Hallucination** :
8. Vérifier que les generators utilisent toujours la KB (Knowledge Base) comme source — pas de génération libre sans ancrage KB
9. `llm-judge.ts` : vérifie présence de sources/KB dans le contenu (dimension fact-grounding)
10. Aucun fichier de contenu statique créé avec du texte inventé (villes, secteurs, descriptions) — tout vient de sources réelles ou de la DB

**Production Ready** :
11. Toutes les clés API requises sont lues depuis `process.env` (jamais hardcodées) : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, clé IndexNow
12. Toutes les variables d'environnement nouvelles ajoutées en Phase B sont documentées dans `.env.example` ou équivalent
13. Aucun `console.log` de debug temporaire dans les fichiers livrés (remplacé par logger structuré)
14. Gestion d'erreur sur chaque appel externe (LLM, OpenAI Embeddings, image-bank query) : pas de crash silencieux
15. Pas de `process.exit()` ou throw non catchée dans les workers BullMQ
16. `MAX_PUBLISH_PER_DAY` : valeur par défaut saine si env var absente (30, pas 0 ni Infinity)
17. pgvector : extension activée dans la migration (pas supposée pré-existante sans vérification)
18. Rate limiting sur l'appel OpenAI Embeddings : pas de burst non maîtrisé si plusieurs campagnes parallèles tournent en même temps

**Score** : `/20`

**Output** : liste de chaque point avec statut + tout mock ou donnée inventée trouvée signalée en P0 bloquant.

---

## SCORING GLOBAL

| Agent | Domaine | Score max |
|---|---|---|
| V-1 | Gates techniques | /20 |
| V-2 | Flow E2E pipeline | /30 |
| V-3 | Keywords 747 seeds | /20 |
| V-4 | LLM-as-judge | /20 |
| V-5 | Image hero pipeline | /15 |
| V-6 | SimHash + embeddings | /20 |
| V-7 | GenerationProvenance | /15 |
| V-8 | P0-5 / P0-10 / verticale | /15 |
| V-9 | Compliance AI Act + Google | /15 |
| V-10 | Cohérence globale | /10 |
| V-11 | Zero Mock + Production Ready | /20 |
| **TOTAL** | | **/200** |

### Seuils de décision

| Score | Verdict | Action |
|---|---|---|
| ≥ 180/200 (90%) | ✅ **GO** — lancer P2/P3/P4 | Procéder immédiatement |
| 160–179/200 (80-89%) | ⚠️ **GO CONDITIONNEL** — P0 résiduels à corriger | Corriger avant P2/P3/P4 |
| < 160/200 (< 80%) | 🔴 **NO-GO** — Phase B.2 requise | Nouvelle passe correctifs |

> **Règle absolue** : si V-11 identifie UN mock ou UNE donnée inventée en production → NO-GO automatique, indépendamment du score total.

---

## LIVRAISON

Créer `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/RAPPORT-VERIFICATION-FINALE.md` avec :

1. **Score par agent** (tableau récapitulatif)
2. **Score global / verdict GO / NO-GO**
3. **Liste des points bloquants** (P0) avec fichier + ligne exacte
4. **Liste des points non bloquants** (P1) à noter pour P2/P3/P4
5. **Actions manuelles Will** (rappel SQL + DPA Anthropic + toute autre)
6. **Phrase de lancement P2/P3/P4** prête à copier-coller si GO

Puis mettre à jour :
- `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/VERDICT-P1.5.md` avec score Phase B réel
- Mémoire `axionia_prompt_content_gen_perfection_2026-05-21.md`
- `_AUDIT/CONVERSATION-LOG-CONTENT-GEN-PERFECTION-2026-05-21.md`

---

## PHRASE DE LANCEMENT

Coller dans une nouvelle conversation Claude Code après la fin de Phase B :

> Lance le prompt `_AUDIT/PROMPT-VERIFICATION-P1.5-FINAL.md`. Mode AUDIT-ONLY strict, zéro commit. Spawn 11 agents V-1 à V-11 en parallèle. Livre `RAPPORT-VERIFICATION-FINALE.md` + verdict GO/NO-GO + score /200. Zero mock et zero données inventées sont des P0 automatiques. Go.
