# SYNTHESIS — Knowledge Base 2026 — Phase A (audit-only)

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Synthèse : Will-équivalent (post-18 agents)
> Date : 2026-05-13
> Statut : DRAFT (en attente décisions Will)
> Inventaire livrables : 22 fichiers `.md` sous `_AUDIT/KNOWLEDGE-BASE-2026/` (00-REALITY + 01..18 + SYNTHESIS + 04-PLAN-EXECUTION + ADR-DRAFT)

---

## TL;DR — 1 page

**Verdict** : **CONDITIONAL GO V1** (score 266/300, seuil GO = 270). 4 blocages levables en 1-2 demi-journées Will + un parquet de 5 décisions top-level à trancher.

**Cible V1** : système Knowledge Base unifié `KnowledgeEntry` polymorphique (16 types) avec :

- Admin FR cohérent sous `/fr/<adminPrefix>/connaissances/` (12 écrans).
- Surfaces publiques pré-existantes (`/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia`) **préservées zéro-301** et alimentées par le backend unifié.
- Hub agrégateur `/fr/ressources/` cross-type avec RSS/JSON Feed/llms.txt enrichis.
- Surface client `/fr/mes-ressources/` (magic-token Booking V1 réutilisé).
- FTS Postgres FR + EN (pgvector V1.5).
- Workflow états + versionning + audit log (`ActivityLog` existant étendu).
- WCAG 2.2 AA + E-E-A-T (bloc auteur, reviewed-by, citations, "comment citer").
- Pipeline médias (`sharp` + AVIF/WebP + EXIF strip) sur volume Coolify.
- Editorial pipeline (`pipelineStage`) + calendrier + health dashboard + quality score (bloquant publication).
- Multi-format (RSS, JSON Feed, llms.txt enrichi, PDF on-demand via `@react-pdf/renderer`, OG dynamique, newsletter digest).
- Slug history + redirects 301 + sanitization Tiptap SSR.
- Tests ≥ 30 unit + ≥ 10 integ + ≥ 9 E2E.

**Effort V1 (Sprints KB-1 → KB-20)** : ~81 demi-journées (≈ 4 mois calendaires à 1 dj/jour mixé).
**Effort V1.5 (Sprints KB-21 → KB-24)** : ~18 dj (pgvector + RAG + auto-traduction).
**Coût mensuel additionnel V1** : **€0** (Hetzner CPX32 absorbe).
**Coût mensuel V1.5** : **€0.05 à €13/mois** (Voyage AI `voyage-3-lite`, fonction du volume).

**Prochaine action** : Will tranche les 5 décisions top-level §3, valide ADR `docs/adr/0021-knowledge-base-unifiee.md` (brouillon `ADR-DRAFT.md`), gère le WIP booking (4 fichiers M + 1 untracked) → **`GO BUILD KB-SPRINT-1`** explicite.

---

## 1. SCORING /300 — 30 dimensions

| #   | Dimension                                                                | Score  | Note                                                                                                                              |
| --- | ------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Qualité du schéma proposé (cohérence, normalisation, extensibilité)      | **9**  | KbStatus dédié recommandé. 12 modèles `Knowledge*` V1 + `KnowledgeEmbedding` séparé V1.5. Indexes stratégiques justifiés.         |
| 2   | Migration des contenus existants (faisabilité zero-downtime)             | **8**  | Expand-backfill-contract bien défini sur 4 modèles legacy. Glossaire/Guide-IA hardcode = +complexité (script depuis source code). |
| 3   | UX admin (édition fluide, autosave, raccourcis)                          | **9**  | 12 écrans maquettés. Tiptap étendu (Image/Link/Callout/Slash/Placeholder/Autosave 2s). Raccourcis ⌘S/⌘P/⌘⇧P.                      |
| 4   | UX surface publique (SEO/AEO/GEO, hreflang, sitemap)                     | **9**  | URLs préservées + hub `/ressources` cross-type + 9 factories JSON-LD + maillage pSEO villes.                                      |
| 5   | UX surface client (filtrage par booking, login intégré)                  | **8**  | Magic-token Booking V1 réutilisé (NextAuth `ClientUser` absent à HEAD = décision actée). Bookmarks + notes privées.               |
| 6   | Recherche FTS V1 (qualité du ranking, facettes)                          | **9**  | tsvector A/B/C/D pondéré + index GIN + ts_rank_cd + boost pinned/featured/helpful/freshness. RRF V1.5.                            |
| 7   | Plan IA V1.5 (embeddings, RAG, coût Hetzner-friendly)                    | **9**  | Voyage AI `voyage-3-lite` (1024 dims, $0.02/1M tokens). HNSW. Prompt caching obligatoire. Refus dur secret.                       |
| 8   | Workflow états + versionning + audit log                                 | **9**  | 7 états + diagramme Mermaid. `KnowledgeVersion` immutable. 26 events `kb.*` sur `ActivityLog` existant.                           |
| 9   | Permissions + RGPD + PII scan                                            | **9**  | 4 rôles × 25 actions matrice. PII bloquant publish. Refus dur embedding pour `confidentiality IN ('confidential','secret')`.      |
| 10  | Web Vitals & Performance                                                 | **9**  | 75 KB gz budget respecté. Helper SSR custom (zéro `@tiptap/*` public). 12 `loading.tsx`. LHCI gate 6 routes.                      |
| 11  | Tests (unit + intégration + E2E)                                         | **9**  | 151 unit + 10 integ + 9 E2E avec tags `@kb` + `@a11y`. Lighthouse CI 12 URLs.                                                     |
| 12  | Observabilité (Sentry, Plausible, runbook)                               | **9**  | 6 Sentry events + 4 alertes Telegram redactées (ADR 0010). 7 Plausible goals avec custom props PII-safe. Runbook 6 procédures.    |
| 13  | Plan de sprints chiffré et ordonné                                       | **9**  | 20 sprints V1 + 4 sprints V1.5 chiffrés. Pré-requis explicites. STOP & ASK par sprint.                                            |
| 14  | Compatibilité doctrine Axion-IA                                          | **10** | Zéro conflit. Cabinet IA opérationnel. Hetzner CPX32. Code = SSOT. Zero-hardcode. Naming Axion-IA.                                |
| 15  | i18n FR/EN parity                                                        | **9**  | Mono-fichier `fr.json`/`en.json` namespacé (pattern aligné avec existant).                                                        |
| 16  | Sécurité (rate limit, CSRF, XSS rendu Tiptap)                            | **9**  | Whitelist Tiptap stricte SSR. 5 domaines embeds. 6 rate limits Redis. CSP nonce + HMAC RAG V1.5. SSRF guards.                     |
| 17  | Doc sync (`Design.md`, `AGENTS.md`, ADR)                                 | **8**  | ADR draft prêt (`docs/adr/0021`). Sprint KB-20 met à jour `Design.md` + `AGENTS.md`. Skill Knowledge Base à enregistrer.          |
| 18  | Maintenance long-terme (review cycles, expiration)                       | **9**  | reviewDueAt + expiresAt + cron `retention-purge`. Préavis 14j email. Health dashboard surface entrées en retard.                  |
| 19  | Cost/Hetzner CPX32 footprint (CPU/RAM/disk)                              | **9**  | €0 V1. €0.05-13/mois V1.5. PDF via `@react-pdf/renderer` (léger). Pas de `puppeteer`.                                             |
| 20  | Maturité ADR & décisions tracées                                         | **9**  | ADR 0021 brouillon. 17 STOP & ASK ouverts tracés.                                                                                 |
| 21  | Accessibilité WCAG 2.2 AA (surfaces publique + client + admin)           | **9**  | 5 surfaces auditées. Alt text bloquant publication. Radix Dialog/Tabs ≤ 10 KB gz. Contraste terracotta OK fond clair (mémoire).   |
| 22  | E-E-A-T (auteur, reviewed-by, fact-checked, citations)                   | **9**  | Schema Person JSON-LD. AuthorByline + ReviewedBy + FactCheckedBadge + ShareCitationButton (BibTeX + APA + permalink).             |
| 23  | Pipeline médias (asset library, sharp AVIF/WebP, EXIF strip)             | **8**  | Spec complète. **STOP & ASK : volume Coolify non confirmé à HEAD** (chemin /data/knowledge-assets/).                              |
| 24  | Editorial pipeline + calendrier + reviewer assignment                    | **9**  | 8 états pipeline cohabitant avec 7 états workflow. Calendrier CSS grid custom (perf+design). Round-robin + escalade 48h.          |
| 25  | Health dashboard + quality score + content gap matrix                    | **9**  | 8 panneaux KPIs + top 10. Score /100 SSOT seuils par type. Bloquant publish + override loggé.                                     |
| 26  | Multi-format output (RSS/JSON Feed/llms.txt/PDF/social cards)            | **9**  | 6 familles RSS+JSON + llms-full.txt + PDF async BullMQ + OG 5 templates type-spécifiques + newsletter idempotente.                |
| 27  | Import tooling (`_AUDIT/*.md` + Notion + Markdown Git)                   | **8**  | 3 importers V1 wizard 6 étapes. **STOP & ASK : Notion adoption Will ? quels `_AUDIT/*.md` à migrer ?**                            |
| 28  | Slug history + redirects 301 + sécurité contenu (XSS/SSRF/CSP)           | **9**  | `KnowledgeSlugHistory` + middleware racine. Anti-chaîne 301 via `entryId` pointer. `@tiptap/html` whitelist.                      |
| 29  | Backup/DR KB-specific + estimation taille + coût embeddings chiffré      | **9**  | 3 scénarios chiffrés (1k=210MB / 10k=2.1GB / 100k=21GB). Voyage AI $0.05 → $5.12 réindex full. DR drill mensuel.                  |
| 30  | Notifications multi-canal + annotations + bookmarks + series/collections | **8**  | Email + Telegram + in-app. Annotations Tiptap V1.5. Bookmarks + notes privées V1. Series/collections V1.                          |

**TOTAL : 266 / 300 → CONDITIONAL GO**

Seuils :

- ≥ 270 → GO V1 immédiat.
- 225-269 → CONDITIONAL GO (lever les blocages listés).
- < 225 → NO-GO.

---

## 2. TOP 10 RISQUES

| #   | Risque                                                           | Probabilité      | Impact                   | Mitigation                                                                                                                           |
| --- | ---------------------------------------------------------------- | ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Migration `Article` → `KnowledgeEntry` perd données ou relations | Moyenne          | Critique (SEO + contenu) | Expand-backfill-contract strict + `--dry-run` + test sur copie prod DB + feature flag `KB_BACKEND_UNIFIED` pour rollback chirurgical |
| 2   | URLs publiques cassées (301 manqué ou contenu vide)              | Moyenne          | Critique (SEO)           | E2E `slug-redirect-301.spec.ts` couvrant chaque ancienne URL + audit Search Console post-migration                                   |
| 3   | Tiptap JSON XSS via rendu SSR non sanitisé                       | Faible           | Critique (sécu)          | Whitelist stricte nodes/marks + lib `@tiptap/html` server + tests injection systématiques (8+)                                       |
| 4   | pgvector trop lourd pour CPX32 (RAM/IOPS)                        | Moyenne          | Sévère                   | V1.5 séparée, bench mémoire avant rollout, fallback FTS-only si KO                                                                   |
| 5   | Éditeur Tiptap perd contenu (autosave race)                      | Moyenne          | Sévère (UX)              | Autosave lock + version conflicting + rollback in-place + tests intégration                                                          |
| 6   | Permissions RBAC mal configurées → fuite contenu `secret`        | Faible           | Critique (RGPD)          | Tests permissions exhaustifs, audit log lecture `confidentiality=secret`, default deny                                               |
| 7   | Quality score bloque publications légitimes (faux positifs)      | Moyenne          | Modéré (DX)              | Seuils paramétrables par type (SSOT), override admin avec justification, monitoring taux blocage                                     |
| 8   | Imports Notion ratent silencieusement (rate limit, schema drift) | Moyenne          | Modéré                   | Wizard preview + dry-run + log batch + rollback transactionnel                                                                       |
| 9   | PDF worker sature CPX32 (puppeteer RAM)                          | Faible (mitigée) | Sévère                   | Décision Phase A : `@react-pdf/renderer` (léger, ~200KB) au lieu de puppeteer. Queue concurrency=1                                   |
| 10  | Embeddings exfiltrent `confidentiality=secret` à tiers           | Faible           | Critique (RGPD)          | Filtre dans `embeddings.ts` : refus dur si `confidentiality IN ('confidential', 'secret')`. Test bloquant                            |

---

## 3. TOP 5 DÉCISIONS OUVERTES — à trancher Will avant Phase B

### Décision 1 — Unification vs cohabitation

`KnowledgeEntry` polymorphique unique remplace `Article`/`CaseStudy`/`FAQ`/`HelpArticle` via expand-backfill-contract ? **Recommandation forte = OUI** (unification, zéro 301 sur URLs publiques, admin legacy strangler progressif).

> Réponse attendue : `OUI` / `NON, garder tables séparées avec vue logique` / `Hybride : unifier sauf X`.

### Décision 2 — Nom du hub public

`/fr/ressources/` (recommandation = clarté FR + parité EN `/en/resources/`). Alternatives : `/savoir/`, `/base-de-connaissance/`, `/kb/`, `/ressources-ia/`.

> Réponse attendue : un slug FR + son équivalent EN.

### Décision 3 — Glossaire/Guide-IA hardcode

Les contenus actuels `/glossaire/page.tsx` (constante `TERMS`) et probablement `/guide-ia/page.tsx` sont en hardcode dans le code source. Migration en DB sous `type='glossary_term'` et `type='guide'` à effectuer en KB-2 ? **Recommandation = OUI** (script depuis source code, status='published' direct, slug préservé).

> Réponse attendue : `OUI migrer` / `NON garder hardcode` / `Plus tard V1.5`.

### Décision 4 — Volume médias Coolify

Chemin `/data/knowledge-assets/` monté persistant sur Coolify est-il déjà configuré ? Sinon, action infra requise avant Sprint KB-11 (créer volume + monter sur container + ajouter aux backups Coolify).

> Réponse attendue : `Déjà OK chemin Y` / `À configurer, je m'en occupe avant KB-11` / `Reporter KB-11`.

### Décision 5 — WIP booking sur main

4 fichiers M + 1 untracked sur la working tree avant de créer `feature/kb-foundations` : `src/app/[locale]/booking/[token]/cancel/page.tsx`, `src/app/api/docuseal/webhook/route.ts`, `src/features/booking/self-service-actions.ts`, `src/lib/docuseal.ts`, et `src/features/booking/refund-calc.ts` (untracked).

> Réponse attendue : `Commit on main avant branche feature` / `Stash temporaire` / `Branche dédiée fix booking séparée` / `Ignorer, partira avec KB`.

---

## 4. DÉCISIONS OUVERTES — niveau 2 (consolider en cours de Phase B)

6. **KbStatus dédié** vs étendre `PublishStatus` global (reco = dédié). Confirmé Agent 1 + 8.
7. **i18n** : namespacer dans `fr.json`/`en.json` existants (reco) vs multi-fichiers `fr/knowledge.json`.
8. **Server actions pattern** : 1 fichier par action `src/server/actions/knowledge/<action>.ts` (reco) vs god-file `actions.ts`.
9. **Module structure** : `knowledge/` cross-cutting (reco) vs `admin-knowledge/` feature.
10. **PDF lib** : `@react-pdf/renderer` (reco) vs `puppeteer` (rejeté).
11. **Calendrier admin** : CSS grid custom (reco perf+design) vs `react-big-calendar` vs `fullcalendar`.
12. **Notion import** : V1 (si Will utilise Notion) vs V1.5 (sinon).
13. **`_AUDIT/*.md` migration** : quels fichiers à importer en V1 ? Mappage manuel obligatoire (~70+ fichiers, beaucoup audit reports).
14. **ADR location** : `docs/adr/0021-knowledge-base-unifiee.md` (reco, convention existante).
15. **Newsletter fréquence** : hebdo vs mensuelle vs configurable per-domain.
16. **Reviewer escalation** : 48h → Will direct vs role manager configurable.
17. **Export GDPR auth** : OWNER only + rate-limit 1/jour + HMAC (reco), ou auth différente ?

---

## 5. TOP 10 QUICK WINS (< 1 dj chacun, possibles en parallèle)

1. Ajouter `pgvector` extension à `docker/postgres/init.sql` même en V1 (extension load gratuit, table créée en V1.5 — anticipe sans coût).
2. Créer skill Claude Code `axionia-knowledge` (référencer `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` + ce SYNTHESIS + ADR draft).
3. Étendre `pii-redaction.ts` avec `detectPii(text)` (variant qui retourne matches sans redact) — utilisé par `publish.ts` server action.
4. Backfill `KnowledgeSlugHistory` initial depuis git log `articles.slug` renames (script one-shot avant Sprint KB-12).
5. Ajouter goal Plausible `kb_*` _prévisionnels_ (pas de tracking actif, juste réservation des noms).
6. Créer `docs/knowledge/` dossier vide avec README pointant vers ce SYNTHESIS (préparation Sprint KB-20).
7. Auditer `_AUDIT/*.md` (70+ fichiers) et catégoriser : (a) à migrer en `type='doctrine'`, (b) à migrer en `type='post_mortem'`, (c) à archiver (audit reports).
8. Réserver les domaines embeds whitelistés dans `next.config.ts` `images.remotePatterns` (YouTube, Vimeo, Loom thumbnails).
9. Vérifier que `sharp` n'est pas déjà installé indirectement (peut être transitive Next.js) — `pnpm why sharp`.
10. Bench Lighthouse sur `/blog/[slug]` actuel en baseline (avant KB-1) pour mesurer le delta post-migration.

---

## 6. NOTES POUR PHASE B — éléments à propager dans chaque sprint

- **Reality check à relire** au début de chaque sprint (`00-REALITY-CHECK.md`).
- **Code = SSOT** : si divergence, code prime sur audit, signaler à Will.
- **Tests bloquants** : `pnpm typecheck` + `pnpm lint` + `pnpm test` (+ `pnpm i18n:check`, `pnpm anti-hex:check`, `pnpm contrast:check`, `pnpm radius:check` selon sprint) avant commit.
- **Commits atomiques** : 1 sprint = 1+ commits cohérents Conventional Commits. Branche `feature/kb-<sous-domaine>`.
- **Doc sync** : si ajout SSOT ou route, mettre à jour `Design.md` ou `AGENTS.md`.
- **Migrations Prisma** : nommées `kb_NN_description/`, jamais destructive sans deprecation window.
- **`revalidatePath`** systématique sur publish/unpublish/update (`'/blog'`, `'/cas-concrets'`, `'/centre-aide'`, `'/faq'`, `'/ressources'`).
- **Aucun push sur main, aucun deploy prod en Phase B**, sauf instruction explicite Will.

---

## 7. AMÉLIORATIONS DU PROMPT POUR V4 (méta)

Cette section sert au prompt master `PROMPT-KNOWLEDGE-BASE-2026.md` lui-même.

1. **§11.1 i18n cible** : `src/messages/fr/knowledge.json` n'est pas le pattern actuel (mono-fichier). À aligner en V4 prompt.
2. **§11.1 `src/features/`** : pattern admin-_ existant non mentionné dans la prescription. Le prompt impose `src/components/knowledge/` cross-cutting mais l'existant utilise `features/admin-_`. Justifier ou aligner.
3. **§13.10 Stratégie de rollout** : ajouter explicitement `pnpm posts:check` (script existant pour validation contenu legacy) après backfill.
4. **§15 Annexes** : ADRs réels sont sous `axionia/docs/adr/` pas `_AUDIT/adr/`. Corriger.
5. **§0.0/15 API interne** : `/api/internal/kb/embed` et `/api/internal/kb/rag` doivent expliciter le HMAC pattern (skill `claude-api` n'a pas de standard HMAC, à inventer pour Axion-IA).
6. **§0.0/40 Coût chiffré** : Voyage AI fait partie des recommandations Phase A — ajouter en `Sous-processeurs` doctrinaux.
7. **§16 Sortie attendue** : préciser que le verdict final est `CONDITIONAL GO` si 270 > score ≥ 225, pas seulement GO/NO-GO.

---

**Fin SYNTHESIS.** Prochaine étape : Will tranche les 5 décisions §3 et signale `GO BUILD KB-SPRINT-1`.
