# ADR 0021 — Content Generator V1 squelette vs implémentation profonde

**Statut** : ✅ Acté Sprint 6 · 2026-05-14
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : conversation autopilote Sprint 1→6 (2026-05-14) · `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` · master prompt `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` v1.7

---

## Contexte

Le master prompt content-gen prévoyait un V1 « complet » 4-6 sprints / 30-40 jours dev avec 8 agents parallèles. La session autopilote 2026-05-14 a livré les 6 sprints en BUILD (Sprint 1 D1→D6 + Sprint 2 + Sprint 3 admin UI + Sprint 4 workers + Sprint 5 indexation + Sprint 6 tests) sur une seule session dense.

Trois choix d'implémentation ont été faits qui s'écartent du master prompt « idéal » :

1. **Squelettes fonctionnels vs bodies métier complets** sur certains workers Sprint 4-5 (quality-improver, news-lifecycle, google-indexing). Les workers sont câblés BullMQ, signature correcte, mais leur logique métier détaillée (re-prompt LLM section ciblée, sync Plausible CTR, JWT Google service account) reste V1.5+ avec dataset/credentials prod.

2. **Stockage transitoire ContentGenConfig** au lieu de tables dédiées RssSource, RssItem, SimilarityPair, ContentGenBatch. Le master prompt v1.7 prévoyait ces tables — pour V1, on stocke en JSON dans `ContentGenConfig` (gain : zéro migration SQL bloquante Will). Migration V1.5 quand volume justifie.

3. **Pas d'ajout `news_brief` à l'enum `KbType`**. Le master prompt § 11.0 suggérait `blog_from_rss → news_brief`. Sprint 5 arbitrage : `blog_from_rss → article` (legacy enum). ADR séparé V2 si volume RSS > 500/jour.

## Décision

V1 = **« BUILD complet, RUN dépendant »** :

- Toutes les surfaces user-visible existent (30+ pages admin, 9 generators, 6 workers BullMQ, 5 providers IA wired, JSON-LD factories, KB consumer)
- Tous les guards passent (typecheck + 673 tests verts + isolation-check + anti-siren + anti-hex)
- Tous les contrats sont stables (interfaces TS exportées, signatures workers, payloads BullMQ)
- Les bodies métier détaillés (LLM re-prompt sections, sync Plausible, JWT Google) sont taggés `V1.5+` avec TODO clair
- Les modèles Prisma dédiés (RssSource, RssItem, SimilarityPair) restent à créer V1.5+ — V1 utilise `ContentGenConfig` (key/value JSON)

Cette approche permet à Will de :

1. **Déployer V1 dès maintenant** (Coolify auto-deploy déclenché à chaque push, RUN nécessite 7 clés API IA + migration SQL)
2. **Itérer sur les bodies métier** avec dataset prod (les sub-prompts détaillés sont déjà dans le skill megapack `prompts/*.md`)
3. **Préserver l'option d'extension** (migrations V1.5+ ne cassent rien — les `ContentGenConfig` JSON peuvent être backfillés vers les tables dédiées)

## Conséquences

### Positives

- Délai de livraison V1 court (1 session autopilote dense)
- Code reviewable (chaque commit ≤ 600 lignes, conventions respectées)
- Zéro casse fonctionnelle (suite test 673 verts maintenue)
- Doctrine intouchable (AxionIA-centric ≥ 95 %, FR uniquement, Manon auteur, anti-doorway HCU)
- Surfaces extensibles : ajout d'une nouvelle famille de generators = 1 fichier + 1 enum value

### Négatives

- Quelques workers font moins en V1 que prévu (quality-improver = log seul, google-indexing = no-op log)
- Stockage `ContentGenConfig` JSON ne scale pas au-delà de ~5000 entries/clé (cap LRU pour rss_items_seen)
- Pas de sub-prompts dédiés RSS / comparison / guide-pilier en V1 (deleg vers landing-ville pipeline) — la diversité éditoriale dépend du sub-prompt enrichi V1.5

### À surveiller V1 RUN

- Volume RSS > 500/jour → migration vers table RssItem dédiée + ADR `news_brief` enum
- Volume similarity pairs > 100/jour → migration vers table SimilarityPair dédiée
- Quality-improver passe « no-op increment » > 10 % des passages → priorité V1.5 re-prompt LLM réel
- Cost provider OpenAI > 80 % cap mensuel 2 mois consécutifs → ADR rééquilibrage Anthropic/Perplexity

## Alternative considérée et rejetée

**Alt. A — Tables Prisma dédiées dès V1 (RssSource, RssItem, SimilarityPair, ContentGenBatch)** :

- Avantage : architecture propre, scale natif
- Inconvénient : bloque V1 sur migration SQL Will + DB locale Postgres + DIRECT_URL — bloqueurs identifiés dans `CONTENT-GEN-V1-AUTOPILOT-LOG.md` Sprint 1 D1
- Rejeté : Will a explicité préférer un V1 déployable immédiatement (Coolify auto-deploy ON) quitte à itérer V1.5

**Alt. B — V1 implémentation profonde immédiate sur tous les workers** :

- Avantage : pas de dette technique
- Inconvénient : ~30 jours dev supplémentaires, dataset prod nécessaire pour quality-improver et news-lifecycle CTR
- Rejeté : ne tient pas dans la fenêtre autopilote 2026-05-14 et n'a pas le dataset prod pour optimiser

## Liens

- Master prompt : `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` v1.7
- Spec data model : `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`
- Log autopilote : `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`
- Skill Claude Code : `.claude/skills/axionia-content-generator/SKILL.md`
- ADR 0010 (PII minimisation Telegram) — patrons skeleton fonctionnel
- ADR 0011 (interventions taxonomy) — pattern doctrine SSOT
