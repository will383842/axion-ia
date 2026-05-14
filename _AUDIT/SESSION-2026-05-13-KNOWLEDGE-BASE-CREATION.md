# SESSION 2026-05-13 + 2026-05-14 — Création système Knowledge Base + pivot V4 Factory Industrielle

> Conversation Claude Code archivée pour reprise sans perte de contexte.
>
> **Mise à jour 2026-05-14** : Will pivote le scope vers Knowledge Factory Industrielle (100 entrées/jour automatiques, FR uniquement, écosystème IA en entreprise). Prompt master patché V3 → V4 (1377 → 1633 lignes). Skill `axionia-connaissances` actualisé. Voir §V4 ci-dessous.

---

## 🔄 PIVOT V4 — 2026-05-14

### Confirmation Will

> « tout sera 100% automatique. avec publication automatique, génération du seo, aeo, geo, metatitle etc etc etc entirèement automatique de bout en bout. »
> « 100 CONTENUS PAR JOUR »
> « POur le mment aucune traduction car uniquement en francais »
> « il ne faut pas que ca cabinet IA opérationnel mais tout ce qui se rapporte aux entreprise qui vuellent implémenter l'ia, les uaotmatisation, former leur personnel, etc etc »

### Implications actées V4

1. **Volume cible** : 100 entrées/jour × 365 = 36 500/an (vs 2-4/semaine initial).
2. **Production** : 100% automatique via `PROMPT-CONTENT-GENERATOR-MASTER-2026.md`. Zéro review humain V1.
3. **Langue** : FR uniquement V1. Architecture multilingue préservée, EN activable V2 (KB-23).
4. **Scope élargi** : 12 nouveaux types KB pour écosystème IA en entreprise :
   - `automation_recipe` (~8000/an)
   - `tool_review` (~3000/an)
   - `industry_use_case` (~6000/an)
   - `comparison` (~2000/an)
   - `implementation_playbook` (~1500/an)
   - `prompt_pattern` (~5000/an)
   - `roi_calculator_template` (~500/an)
   - `intervention_module` (~2000/an) — **jamais « training »/« formation »** (doctrine `axionia-core`)
   - `competence_boost` (~3000/an)
   - `secteur_brief` (~500/an)
   - `dept_brief` (~500/an)
   - `metier_brief` (~1500/an)
5. **pgvector promu V1.5 → V1 obligatoire** (sprint KB-12.5 intercalé) car indispensable pour dedup à ce volume.
6. **Pipeline éditorial humain (KB-13/14/15/16/17/18 V3) refondu V4** :
   - KB-13 : Quality gates automatiques (heuristiques + LLM scoring) + dedup pgvector + monitoring (vs review humain)
   - KB-14 : Auto-génération SEO/AEO/GEO complète (meta titles, descriptions, JSON-LD, OG, AEO bloc, GEO entités)
   - KB-15 : API ingest `/api/internal/kb/ingest` + intégration Content Generator (HMAC + idempotency + queue BullMQ)
   - KB-16 : Auto-publish + distribution multi-format auto (RSS/JSON/llms.txt/newsletter/sitemap/IndexNow)
   - KB-17 : Observabilité factory + alerting + **DR massif** (bouton « dépublier tout entre T1 et T2 »)
   - KB-18 : pSEO templates par type + slugs auto + canonicals (anti-doorway HCU 2024)
7. **V1.5 IA refondue** :
   - KB-21 : RAG endpoint + auto-suggestions + auto-tagging (RAG ready dès V1.5)
   - KB-22 : Auto-amélioration continue (A/B variants + recyclage low-performers)
   - KB-23 : Auto-traduction FR→EN + activation EN parity
   - KB-24 : **Chatbot public Axion-IA propulsé par RAG KB** (promu)
8. **Safeguards anti-dérive (CRITIQUES V1)** :
   - Kill switch global `KB_AUTO_PUBLISH=false` env var
   - Volume gate (> 150/heure → bascule `audience='team'`)
   - Quality fail rate gate (> 20% batch → revue manuelle)
   - Dedup match rate gate (> 30% → alerte factory déraillée)
   - PII scan bloquant strict
   - Audit log immuable avec `source.factoryId`/`promptId`/`modelUsed`/`cost`
   - Sentry events `kb.*`
   - Plausible goals
   - Rate limit 200 req/min/factory + circuit breaker
9. **Infrastructure** :
   - CPX32 saturé à ~12-18 mois → **upgrade CPX42 prévu** (€11/mois) à valider mois 9
   - DB taille projetée : ~50-60 GB à 12 mois, ~100-130 GB à 24 mois
10. **Coût IA mensuel V1 ≈ €25/mois** (embeddings Voyage AI + quality scoring Haiku + auto-SEO Haiku + GEO entities) — sous budget Will (~€5-30/mois).
11. **Effort V1 révisé** : 81 dj → **~84 dj** (+3 dj pour pgvector promu V1 KB-12.5). Quasi iso-effort.

### Sections ajoutées au prompt master

- **§17 Knowledge Factory Industrielle** (architecture complète V4) :
  - 17.1 Diagramme ASCII flux ingestion automatique
  - 17.2 Spec API `/api/internal/kb/ingest` (HMAC, Zod, idempotency, rate limit, circuit breaker)
  - 17.3 Quality gates automatiques (heuristiques + LLM + dedup + PII)
  - 17.4 Auto-génération SEO/AEO/GEO de bout en bout
  - 17.5 Safeguards anti-dérive (10 obligatoires V1)
  - 17.6 Infrastructure & coûts chiffrés (CPX32 saturation + upgrade CPX42 + budget IA mensuel)
  - 17.7 Intégration Content Generator Master (interface contractuelle + SLA)
  - 17.8 Effort V4 révisé (delta vs V3)
- **§18 Décisions V4 actées** (12 décisions tabulées avec source + statut)

### État final du prompt V4

- **1633 lignes** (V3 = 1377, +256 lignes)
- **18 agents Phase A** (inchangé)
- **25 sprints** (KB-1 à KB-24 + KB-12.5 pgvector promu V1)
- **2 sections V4 nouvelles** (§17 + §18)
- **35 mentions V4/Factory/automatique**

---

## SESSION ORIGINALE 2026-05-13 (V3)

---

## 🎯 Objectif initial Will

> « Je dois créer un knowledge pour Axion-IA extrêmement complet, professionnel, scalable, modifiable et que je puisse compléter au fur et à mesure. L'idéal serait de pouvoir le gérer depuis la console d'administration d'Axion-IA. Peux-tu me faire un prompt extrêmement complet pour créer le skill à la perfection ? »

---

## 📦 Livrables créés dans cette session

### 1. Prompt master (V3, 1377 lignes)

**Path** : `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
**Version** : V3 perfection extrême FR-first (post-reality-check repo)
**Évolution** : V1 (360 lignes) → V2 (692 lignes) → V3 (1377 lignes)

**Caractéristiques** :

- 17 sections principales §0 → §16
- 18 agents parallèles Phase A
- 22 livrables Markdown attendus dans `_AUDIT/KNOWLEDGE-BASE-2026/`
- 35 critères de perfection V1
- Scoring /300 (30 dimensions × /10) — GO ≥ 270, CONDITIONAL 225-269, NO-GO < 225
- 24 sprints chiffrés (KB-1 à KB-24)
- Effort V1 : 81 demi-journées (~3-6 semaines)
- Effort V1.5 : 18 demi-journées
- Coût additionnel V1 : 0 € (CPX32 absorbe)
- Coût additionnel V1.5 : 5-30 €/mois (embeddings)

**Sections-clés ajoutées en V3** :

- §9 Doctrine linguistique stricte (FR-first admin, EN parity public, identifiers EN)
- §10 Stratégie backend unifié vs surfaces publiques EXISTANTES préservées
- §11 Structure de dossiers cible exhaustive (ASCII tree complet)
- §12 Naming conventions (enums DB + URLs FR/EN)
- §13 Plan d'implémentation bout-en-bout (24 sprints chiffrés)
- §14 Risques & mitigations top 12

### 2. Skill Claude Code

**Path** : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-connaissances/SKILL.md`
**Lignes** : 300
**Naming** : `axionia-connaissances` (cohérent avec autres skills `axionia-*` actifs)

**Frontmatter description** : trigger phrases FR explicites (« knowledge base », « base de connaissances », « /connaissances/ », « KnowledgeEntry », « lance l'audit KB », « GO BUILD KB-SPRINT »).

**Contenu** :

- Doctrine intouchable (12 règles)
- Phrases d'invocation Phase A et Phase B
- Table des 18 agents
- Plan d'implémentation 24 sprints en résumé
- Architecture URL (publiques + admin)
- Enums types KB
- Structure de dossiers résumée
- Risques top 5
- Critères de succès V1
- Stratégie de rollout
- Skills connexes à charger en complément

---

## ✅ Décisions architecturales actées

### Modèle de données

- **Modèle racine unique** : `KnowledgeEntry` polymorphique (`type` enum à 16 valeurs).
- **Migration depuis modèles existants** : `Article` + `ArticleTranslation` + `ArticleTag` + `ArticleTagOnArticle`, `CaseStudy` + `CaseStudyTranslation`, `FAQ`, `HelpArticle` + `HelpArticleTranslation`, `Category` — **modèles RÉELS du repo** (V1/V2 inventaient `BlogPost`/`FaqEntry`, V3 corrigé).
- **Stratégie migration** : expand-backfill-contract strict (zero downtime).
- **Tables associées** : `KnowledgeTranslation`, `KnowledgeTag`, `KnowledgeVersion`, `KnowledgeRelation`, `KnowledgeAsset`, `KnowledgeBookmark`, `KnowledgeSlugHistory`, `KnowledgeFeedback`, `KnowledgeEmbedding` (V1.5).

### URLs

- **URLs publiques PRÉSERVÉES** (zéro 301) : `/blog/`, `/cas-concrets/`, `/centre-aide/`, `/faq/`, `/glossaire/`, `/guide-ia/`. KB = backend unifié qui les alimente, pas remplacement.
- **Nouveau hub agrégateur** : `/fr/ressources/` + `/en/resources/`.
- **Surface client** : `/fr/mes-ressources/` (login NextAuth).
- **Admin FR cohérent** : `/fr/<adminPrefix>/connaissances/` + sous-routes FR (`/nouvelle`, `/[id]`, `/calendrier`, `/sante`, `/medias`, `/imports`, `/etiquettes`, `/auteurs`, `/files-attente-revue`, `/parametres`).
- **Admin legacy** (`/blog`, `/help`, `/case-studies`, `/faq`, `/categories`) conservé en V1, marqué legacy, redirigé progressivement (Strangler).

### Stack

- **Editor** : Tiptap JSON (cohérent admin existant).
- **Recherche V1** : Postgres FTS (`tsvector` + GIN + `unaccent` + `pg_trgm`).
- **Recherche V1.5** : pgvector + embeddings + hybrid search RRF.
- **Embeddings** : Anthropic Voyage AI avec prompt caching (skill `claude-api`).
- **Workers** : BullMQ existants étendus (`knowledge-image-process`, `knowledge-pdf-generate`, `knowledge-newsletter-digest`, `knowledge-broken-links`, `knowledge-review-expiry`, `knowledge-retention-purge`, `knowledge-asset-gc`, `knowledge-embedding-reindex`, `knowledge-import-process`).
- **PDF** : `@react-pdf/renderer` (léger, décision finale à confirmer Phase A avec bench RAM CPX32).
- **Validation** : Zod sur chaque server action.
- **Tests** : Vitest unit + intégration, Playwright E2E, axe-core a11y, Lighthouse CI.

### Doctrine linguistique

- **URLs publiques** : FR-first (`/blog`, `/cas-concrets`, `/glossaire`) + EN parity (slugs traduits).
- **URLs admin** : FR cohérent (`/connaissances/`, `/calendrier`, `/sante`, `/medias`, …).
- **Libellés UI** : i18n via `src/messages/{fr,en}/knowledge.json`.
- **Identifiers code** : EN/camelCase (`KnowledgeEntry`, `publishedAt`).
- **Enums DB** : EN snake_case (`type='case_study'`, `audience='client'`).
- **Commit messages** : EN (Conventional Commits).
- **Docs `_AUDIT/*.md`** : FR.

### Gouvernance

- **Confidentialité par défaut** : nouvelle entrée naît en `audience='team'` + `confidentiality='internal'`.
- **PII scan bloquant** : `pii-redaction.ts` obligatoire avant publication ou export.
- **Embeddings interdits** sur `confidentiality IN ('confidential', 'secret')`.
- **Workflow états** : `draft → review → published → archived` + `deprecated` + `scheduled`.
- **Versionning** : 1 row immutable par save, diff via lib, rollback 1-click.
- **Quality score /100** : seuils par type SSOT, bloque publication si < seuil.
- **Permissions RBAC** : `OWNER`, `EDITOR`, `REVIEWER`, `READER`.

---

## 🔍 Vérifications passées

- ✅ Numérotation sections §0 → §16 sans doublon ni trou
- ✅ 18 agents bien numérotés 1 → 18, Tests en dernier (§18)
- ✅ 24 sprints uniques KB-1 → KB-24
- ✅ Zéro résidu `/knowledge/` admin (tous remplacés par `/connaissances/`)
- ✅ Modèles Prisma réels (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`) — plus aucun `BlogPost`/`FaqEntry` fantôme
- ✅ 37 occurrences `/connaissances/` admin FR cohérent
- ✅ Skill frontmatter YAML valide
- ✅ Skill placé à côté des autres `axionia-*` actifs (`axionia-core`, `axionia-database`, `axionia-stack`, etc.)
- ✅ Hiérarchie en cas de conflit documentée

---

## 🚀 Roadmap d'implémentation — autopilot par blocs (7 phrases)

> Mode recommandé : autopilot par blocs avec gates humains. Total ~3-6 semaines au lieu de 3 mois sprint-par-sprint.

### Phrase 1 — Phase A audit (1-2h, zéro risque)

```
Lance le prompt axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md en mode AUDIT-FIRST.
Reality check + 18 agents parallèles + synthèse + plan + ADR. Stoppe avec STOP & ASK.
```

### Phrase 2 — Bloc Fondations + décisions (KB-1 à KB-4)

```
Décisions Will : [tes 5 réponses au STOP & ASK].

Enchaîne en autopilot KB-1, KB-2 (expand-only, pas le contract), KB-3, KB-4 sur
branche feature/kb-foundations. ARRÊT après KB-4. Ne touche pas main. Ne déploie
pas en prod.

Garde-fous : tests verts obligatoires, pnpm typecheck/lint OK, commits atomiques
sur la branche feature seulement. Avant KB-2 affiche-moi le plan migration et
attends "GO KB-2".
```

### Phrase 3 — Bloc Migration data + surfaces (KB-5 à KB-6)

```
Sauvegarde Coolify prise (snapshot Hetzner [ID]).
Enchaîne KB-5 (migration CaseStudy/FAQ/HelpArticle) puis KB-6 (routes publiques
branchées sur backend unifié). ARRÊT après KB-6.

Garde-fous : expand-backfill-contract strict, feature flag KB_BACKEND_UNIFIED
par route défaut OFF, après KB-6 run pnpm lhci sur 5 routes pivot. Si Web Vitals
dégrade au-delà du budget AGENTS.md, STOP + rollback flag.
```

### Phrase 4 — Bloc Surfaces nouvelles (KB-7 à KB-10)

```
Enchaîne KB-7 (FTS), KB-8 (hub /ressources/), KB-9 (surface client), KB-10
(WCAG 2.2 AA + E-E-A-T). ARRÊT après KB-10.

Garde-fous : KB-8 hub /ressources/ en noindex 7 jours, retire noindex
uniquement sur mon "GO INDEXATION /ressources/". KB-10 axe-core CI obligatoire.
```

### Phrase 5 — Bloc Enrichissement (KB-11 à KB-16)

```
Enchaîne KB-11 à KB-16 (médias, slug history, pipeline éditorial, multi-format,
imports, templates éditeur). ARRÊT après KB-16.

Garde-fous : KB-11 volume Coolify provisionné, KB-13 quality score seuils SSOT,
KB-14 décide @react-pdf vs puppeteer avec bench RAM CPX32 explicite dans report.
```

### Phrase 6 — Bloc Polish + prod (KB-17 à KB-20)

```
Enchaîne KB-17 à KB-20 (notifications, annotations, RGPD/DR, tests E2E + LHCI).
ARRÊT après KB-20 avec V1-BILAN.md.

Garde-fous : KB-19 DR drill obligatoire sur staging, KB-20 CI doit être verte.
```

### Phrase 7 — Validation V1 + décision V1.5

```
Phase V1 livrée. Lis V1-BILAN.md, propose la décision GO/NO-GO production publique
+ recommandation sur le lancement V1.5 (KB-21 à KB-24). Liste les pistes V2+ par
ROI estimé.
```

---

## 🟣 Phrases V1.5 IA augmentation (optionnel, après V1 stable ≥ 2 semaines)

```
GO BUILD KB-SPRINT-21 — pgvector + embeddings Anthropic Voyage AI (prompt caching)
+ recherche hybride FTS + cosine RRF.

GO BUILD KB-SPRINT-22 — RAG endpoint /api/internal/kb/rag + auto-suggestions admin
+ auto-tagging IA.

GO BUILD KB-SPRINT-23 — auto-traduction FR→EN (Claude Haiku 4.5 cached) + alt text
IA vision + review humaine bloquante.

GO BUILD KB-SPRINT-24 — ePub export + plagiarism check via embeddings cosine +
brand voice check via LLM cached.

[Final] Phase V1.5 livrée. Produis V1.5-BILAN.md.
```

---

## 🧠 Décisions Will par défaut (si pas envie de trancher)

| Question STOP & ASK probable           | Réponse recommandée                                     |
| -------------------------------------- | ------------------------------------------------------- |
| Unifier les modèles existants ?        | **Oui, unifier** sous `KnowledgeEntry` polymorphique    |
| pgvector V1 ou V1.5 ?                  | **V1.5** (sépare le risque CPX32)                       |
| Admin legacy : Big Bang ou Strangler ? | **Strangler** (cohabitation puis migration progressive) |
| Nom hub public : `/ressources/` ?      | **Oui `/ressources/`** (cohérent doctrine FR)           |
| Lib PDF (`@react-pdf` ou puppeteer) ?  | **`@react-pdf/renderer`** (léger pour CPX32)            |
| Modèle embeddings V1.5 ?               | **Anthropic Voyage AI** avec prompt caching             |

---

## ⚠️ Pourquoi pas tout en une session ?

4 verrous physiques honnêtement expliqués à Will :

1. **Limite contexte Claude** : 20 sprints × ~115k tokens = ~2.3M tokens. Dépasse fenêtre 1M. Blocage vers KB-8/10.
2. **Site LIVE en prod** : auto-deploy GitHub Actions → chaque commit = déploiement public immédiat. Régression Web Vitals visible Search Console sous 24-48h.
3. **Migrations data irréversibles** : KB-2 et KB-5 touchent `Article`/`CaseStudy`/`FAQ`/`HelpArticle` prod. Snapshot Hetzner manuel obligatoire (responsabilité Will RGPD).
4. **Décisions architecturales** : lib PDF, modèle embedding, naming définitif — nécessitent Will. Si Claude tranche seul → choix figé dans le code.

**Trinité incompatible** : « maintenant » + « parfait » + « opérationnel dès fin » ne peut pas tenir dans une seule session.

---

## 📅 Calendrier réaliste

| Jalon                          | Quand            | Effort                   |
| ------------------------------ | ---------------- | ------------------------ |
| Phase A audit livrée           | J0 (aujourd'hui) | 1-2h Claude              |
| Fondations testables local     | J0 (aujourd'hui) | +2h Claude               |
| Migration data + surfaces prod | J+3 à J+7        | ~12h Claude              |
| Surfaces nouvelles + WCAG      | J+7 à J+14       | ~14h Claude              |
| Enrichissement complet         | J+14 à J+30      | ~22h Claude              |
| Polish + prod ready            | J+30 à J+45      | ~14h Claude              |
| **🏁 V1 publique**             | **J+30 à J+45**  | **~64h Claude cumulées** |
| V1.5 IA augmentation           | J+60 à J+75      | ~18h Claude              |

---

## 🔗 Liens utiles

- **Prompt master** : `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
- **Skill Claude Code** : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/axionia-megapack-skills/.claude/skills/axionia-connaissances/SKILL.md`
- **Mémoire** : `~/.claude/projects/C--Users-willi/memory/axionia_prompt_knowledge_base.md`
- **Index mémoire** : `~/.claude/projects/C--Users-willi/memory/MEMORY.md`

---

## ▶️ Prochaine action

**Quand tu es prêt**, ouvre une nouvelle conversation et colle :

```
Contexte : je vais implémenter le système Knowledge Base d'Axion-IA défini dans
le prompt master `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (V3, 1377 lignes,
18 agents, 24 sprints chiffrés). Le skill `axionia-connaissances` est actif dans
le megapack. Voir `axionia/_AUDIT/SESSION-2026-05-13-KNOWLEDGE-BASE-CREATION.md`
pour la roadmap complète.

Lance la Phrase 1 (Phase A audit) maintenant.
```

Le skill `axionia-connaissances` s'activera automatiquement et chargera le prompt master.

---

**Fin de session.** Tous les artefacts sont sur disque. Reprise possible à tout moment sans perte de contexte.
