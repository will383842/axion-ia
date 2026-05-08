# Certification Frontend Perfection 2026 — Axion-IA

Dossier complet d'audits pour certifier le frontend Axion-IA niveau **best-in-class 2026**, **scale-ready** (jusqu'à 300K+ URLs) et **très professionnel** (standards SaaS premium).

## À qui s'adresse ce dossier

- **Will** (owner) : lance un audit avant chaque jalon majeur (V1 lancement, V2 scale, audit trimestriel).
- **Claude Code** (executor) : lit le master orchestrateur, exécute la séquence dans une fenêtre fraîche.
- **Futurs collaborateurs** : grok le standard qualité du projet en 30 min.

## Contexte projet (intouchable)

- Cabinet IA opérationnel B2B premium · OÜ Estonienne
- Hébergement : Hetzner Cloud CPX32 + Coolify + Caddy 2 + Cloudflare Free (ADR 0009)
- Stack : Next 16 + React 19 + Tailwind 4 + next-intl FR/EN + Prisma 5 + Postgres 16 + Redis
- Doctrine v3 visuelle figée (titleEm Fraunces, Header terracotta, hero-schema 576×576)
- pSEO villes/régions livré (4 342 HTML SSG) + **industrialisation 100-300 nouvelles URLs/jour à venir**

## Comment utiliser ce dossier

### Mode A — Certification complète avant jalon (V1 prod, V2 scale)

1. Ouvrir une fenêtre Claude Code fraîche
2. Coller : `Lance _AUDIT/CERTIFICATION-FRONTEND-2026/00-MASTER-ORCHESTRATOR.md`
3. Le master séquence les 26 audits avec STOP & ASK entre chaque vague
4. À la fin : gate `26-FINAL-CERTIFICATION-GATE.md` = GO/NO-GO

### Mode B — Audit partiel (vérification trimestrielle)

1. Choisir le ou les prompts pertinents (ex. `13-CONTENT-PIPELINE-SCALE.md` après gros rollout)
2. Coller dans une fenêtre fraîche : `Lance _AUDIT/CERTIFICATION-FRONTEND-2026/13-CONTENT-PIPELINE-SCALE.md`

### Mode C — Re-vérification spécifique (mensuel)

Lance les 3 prompts critiques scaling :

- `20-SCALABILITY-INFRA.md`
- `21-INDEXATION-MANAGEMENT.md`
- `23-QUALITY-AUTOMATION.md`

## Index des prompts

### Vague A — Performance & Code (foundations)

| #   | Prompt                 | Statut                                          | Cible                                              |
| --- | ---------------------- | ----------------------------------------------- | -------------------------------------------------- |
| 01  | Performance Web Vitals | → `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` | Lighthouse 100/100/100/100 + CrUX p75 vert         |
| 02  | Code Health & Quality  | → `_AUDIT/PROMPT-CODE-HEALTH-2026.md`           | TS strict + ESLint 0 warning + audit clean         |
| 03  | Architecture & DRY     | `03-ARCHITECTURE-DRY-2026.md`                   | Atomic design + naming + dead code                 |
| 04  | Centralisation SSOT    | `04-CENTRALISATION-SSOT-2026.md`                | Single source of truth (brand, prix, routes, copy) |

### Vague B — Design & A11y & i18n

| #   | Prompt                  | Statut                                                          | Cible                                        |
| --- | ----------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| 05  | Design System           | → 3 prompts existants (Visual Rhythm + Typography + Header Nav) | Doctrine v3 cohérente partout                |
| 06  | A11y WCAG 2.2 AA + RGAA | `06-A11Y-WCAG22-RGAA-2026.md`                                   | 0 violation Axe + screen reader OK           |
| 14  | i18n parity + Intl.\*   | `14-I18N-PARITY-INTL-2026.md`                                   | FR/EN clés strictement égales + Intl partout |

### Vague C — SEO/AEO/GEO + Linking + pSEO

| #   | Prompt                         | Statut                                       | Cible                                              |
| --- | ------------------------------ | -------------------------------------------- | -------------------------------------------------- |
| 07  | SEO Technique                  | → `_AUDIT/PROMPT-SEO-MASTER-2026.md`         | 100/100 SEO Lighthouse + sitemap + structured data |
| 08  | AEO + GEO + LLMs               | → `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md`        | FAQ schemas + llms.txt + E-E-A-T                   |
| 09  | Navigation & UX                | → `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md`  | Mega menu + breadcrumbs + Pagefind                 |
| 10  | Internal Linking Graph         | `10-INTERNAL-LINKING-GRAPH-2026.md`          | 0 orphan + click depth ≤ 3 + anchor diversity      |
| 11  | Page Quality E-E-A-T           | → `_AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md` | 100 critères × Top 15 pages                        |
| 12  | pSEO Industrialization Quality | `12-PSEO-INDUSTRIALIZATION-QUALITY.md`       | Anti-doorway HCU à 100K+ pages                     |

### Vague D — SCALE (le plus critique pour 100-300/jour)

| #   | Prompt                   | Statut                              | Cible                                                |
| --- | ------------------------ | ----------------------------------- | ---------------------------------------------------- |
| 13  | Content Pipeline Scale   | `13-CONTENT-PIPELINE-SCALE-2026.md` | Pipeline 100-300/jour automatisé end-to-end          |
| 20  | Scalability Infra        | `20-SCALABILITY-INFRA-2026.md`      | Build time + DB + CDN à 300K pages                   |
| 21  | Indexation Management    | `21-INDEXATION-MANAGEMENT-2026.md`  | Crawl budget + sitemap split + IndexNow              |
| 22  | Cache Invalidation + ISR | `22-CACHE-INVALIDATION-ISR-2026.md` | ISR Next 16 + Cloudflare purge per URL               |
| 23  | Quality Automation       | `23-QUALITY-AUTOMATION-2026.md`     | Quality scoring auto pré-publish + anomaly detection |

### Vague E — Tests, Sécu, Content, CRO, Légal

| #   | Prompt                  | Statut                             | Cible                                          |
| --- | ----------------------- | ---------------------------------- | ---------------------------------------------- |
| 15  | Security Frontend       | `15-SECURITY-FRONTEND-2026.md`     | Headers + CSP nonce + secrets + Sprint 16 prep |
| 16  | Tests & Coverage        | `16-TESTS-COVERAGE-2026.md`        | Vitest 80 % + Playwright e2e + Axe a11y        |
| 17  | Content Quality FR/EN   | `17-CONTENT-QUALITY-FR-EN-2026.md` | Spell + tone + pricing consistency             |
| 18  | CRO Conversion          | `18-CRO-CONVERSION-2026.md`        | Funnel + form UX + trust signals               |
| 19  | Legal Compliance + RGAA | `19-LEGAL-COMPLIANCE-RGAA-2026.md` | RGPD + RGAA + OÜ EE compliant                  |

### Vague F — Monitoring, Standards, Final Gate

| #   | Prompt                       | Statut                                | Cible                                               |
| --- | ---------------------------- | ------------------------------------- | --------------------------------------------------- |
| 24  | Monitoring & Observability   | `24-MONITORING-OBSERVABILITY-2026.md` | RUM + Search Console + uptime + alerting            |
| 25  | Professional Standards       | `25-PROFESSIONAL-STANDARDS-2026.md`   | ADRs + runbooks + postmortems + onboarding          |
| 27  | API Design + Forms + States  | `27-API-DESIGN-FORMS-STATES-2026.md`  | Server Actions shape + Zod symétrique + states cov. |
| 28  | Data Resilience + DR         | `28-DATA-RESILIENCE-DR-2026.md`       | Prisma queries + indexes + migration runbook + DR   |
| 26  | **FINAL CERTIFICATION GATE** | `26-FINAL-CERTIFICATION-GATE-2026.md` | GO/NO-GO checklist exécutable                       |

## Cadence recommandée

| Cadence                        | Prompts à lancer                           |
| ------------------------------ | ------------------------------------------ |
| **Avant V1 prod**              | TOUS (26 prompts via master orchestrateur) |
| **Avant V2 scale**             | TOUS + focus Vague D scale                 |
| **Trimestriel**                | 13, 20, 21, 22, 23 (scaling) + 26 (gate)   |
| **Mensuel**                    | 23 (quality automation) + 21 (indexation)  |
| **Après gros rollout pSEO**    | 12, 13, 21, 23                             |
| **Après Sprint backend (15+)** | 02, 15, 16                                 |
| **Après changement design**    | 05 (3 prompts) + 06                        |

## Thresholds canoniques (SSOT — référencer cette section partout)

Tous les prompts du dossier référencent ces seuils. **NE JAMAIS** les redéfinir dans un prompt individuel — pointer ici.

> **Doctrine SSOT (2026-05-08)** : **le code est la source de vérité**. Quand le code et un document divergent (lighthouserc.json, size-limit, next.config.ts, AGENTS.md, ce README), c'est ce document qui s'aligne sur le code, pas l'inverse — sauf décision explicite Will pour durcir le code. Les **cibles internes** ci-dessous sont des objectifs ; les **gates CI** sont les seuils réellement enforcés à un instant T.

### Performance & Web Vitals

**Cibles internes (objectif post-V6 Web Vitals)** :

- LCP p75 ≤ 1 800 ms · INP p75 ≤ 100 ms · CLS p75 ≤ 0,05
- TBT ≤ 150 ms Lighthouse lab
- TTFB p75 ≤ 100 ms via Cloudflare CDN
- Bundle initial route home ≤ 70 KB gzip
- Bundle initial route lourde (`/reserver`) ≤ 110 KB gzip
- Build prod < 10 min sur Hetzner CPX32

**Gates CI réellement enforced (état 2026-05-08)** :

- `lighthouserc.json` : Lighthouse perf/a11y/best-practices ≥ 0.95, SEO ≥ 1.0, LCP ≤ 2 500 ms, INP ≤ 200 ms, CLS ≤ 0.1, TBT ≤ 200 ms — **seuils Google « good »**, durcissement par paliers post-V6 (voir mémoire `axionia_audit_web_vitals_v3_v6_pending.md`).
- `package.json#size-limit` : 100 KB par chunk `.next/static/chunks/**/*.js` — **gate chunk-level**, pas route-level. Les budgets par route (70 / 110 KB) vivent dans `AGENTS.md` et sont vérifiés manuellement / via `pnpm bundle:check` jusqu'à mise en place d'un gate route-level dédié.
- AGENTS.md : SSOT Web Vitals 2026 par route — exception `/reserver` INP ≤ 150 ms et First Load ≤ 110 KB gz.

**Features Next 16 reportées (next.config.ts)** :

- PPR (Partial Prerendering) : deferred Sprint 17 (post-server-actions).
- ViewTransition API : deferred jusqu'à wrap explicite des routes.
- React Compiler : deferred PERF-004 (post-RUM baseline).

Les audits D2/D4/A1 **constatent** ces reports comme dette technique tracée, ils ne flagguent pas comme régression.

### Quality content (anti-doorway HCU)

- Min word count gold standard : **800 mots** par page indexable
- Uniqueness Jaccard 5-grams : **≥ 0,7 distinct** vs corpus existant (chaque page distincte d'au moins 30 % des autres)
- Lecture grade FR Flesch-Kincaid : ≥ 60
- Densité par mot-clé : < 3 %

### Indexation & SEO

- Indexation rate à J+30 ≥ 80 % des nouvelles URLs
- Time-to-index per page ≤ 7 jours
- Sitemap split max 50 000 URLs / fichier
- Sitemap < 10 MB / fichier (gzippé si > 1 MB)
- Click depth max 3 depuis home pour 95 % pages indexables
- Click depth max 4 pour 100 %

### Cache & infra

- Cache hit rate Cloudflare ≥ 90 %
- Time-to-fresh post-publish ≤ 60 sec via Cloudflare
- Origin pull rate ≤ 10 % du traffic total
- Bandwidth Hetzner usage ≤ 50 % de 20 TB/mois
- Disk Hetzner ≤ 80 % avant alerting

### Quality automation

- Lighthouse sampling : **1 % des nouvelles pages quotidien** (sample stratifié par région + template)
- Régression alert : Lighthouse drop > 10 pts vs baseline
- Bundle delta gate : > +5 KB gzip vs main = block PR
- Bundle delta hard fail : > +20 KB gzip = block sans STOP & ASK
- Anomaly alert : indexation drop > 10 %, RUM LCP p75 hausse > 20 %, error rate > 1 %, uptime < 99,9 %, disk > 80 %, RAM > 85 %, CPU > 80 % sustained

### Tests coverage

- Vitest coverage `lib/` ≥ 80 %
- Vitest coverage `hooks/` ≥ 80 %
- Vitest coverage `utils/` ≥ 90 %
- Playwright e2e : 5 parcours critiques minimum
- Axe-core a11y : 0 violation sur 15 pages stratégiques

### File structure

- File size max : 400 LOC (sinon split)
- Folder depth max : 4 niveaux
- Function length max : 50 LOC (sinon refactor)
- Cyclomatic complexity max : 10

### Cadences ops chiffrées

- Backup auto Coolify : daily, retention 30j minimum
- Restore drill : trimestriel obligatoire (RTO < 1h, RPO < 24h)
- Secrets rotation : DB password annuel, API tokens trimestriel, Auth.js secret semestriel
- Dependabot : weekly grouped PRs
- `pnpm outdated` audit : trimestriel
- DR drill complet : semestriel
- Postmortem : obligatoire pour incident > 30 min downtime
- Sample manual content review : 5 villes random / mois

### Système de scoring unifié

**Système unique appliqué partout** : chaque prompt audite sur `/N` (N = chapitres × 10 critères). Le master orchestrator agrège en pourcentage (0-100 %), pas en valeur absolue. Le gate final 26 est un **audit indépendant** de validation finale, scoré séparément (315 critères checklist exécutable).

| Niveau                   | Source       | Output                                    |
| ------------------------ | ------------ | ----------------------------------------- |
| Audit individuel         | Prompt 03-25 | Score % par audit                         |
| Agrégation orchestrateur | Master 00    | Moyenne pondérée % global (Vague D ×2)    |
| Validation finale        | Gate 26      | Checklist 315 critères → verdict GO/NO-GO |

**Verdict GO/NO-GO basé sur Gate 26 uniquement** (pas sur l'agrégation orchestrateur, qui est indicative).

---

## Contraintes intouchables (toutes les certifications)

- Doctrine v3 visuelle figée (Design.md, ADR 0002, 0007)
- Naming « cabinet IA opérationnel » FR / « operational AI consultancy » EN
- Hetzner CPX32 + CF Free (ADR 0009) — aucun coût récurrent additionnel sans validation
- Anti-doorway HCU sur villes non pilotes
- Lighthouse CI seuils existants ne se relâchent jamais (uniquement se durcissent)
- 100 % outils OSS / Free tier / déjà budgété

## STOP & ASK obligatoires (transversal)

Tous les prompts respectent :

1. Lecture seule en Phase A (mesure)
2. Diagnostic + plan patches en Phase B-C
3. STOP & ASK avant tout patch (Phase D)
4. Application par vagues après GO explicite
5. Validation finale avec metrics before/after

Aucun audit n'applique de patch sans GO du user.

## Liens externes

- ADR 0009 hosting : `docs/adr/0009-hosting-hetzner-cpx32-cloudflare-free.md`
- Mémoire hosting : `axionia_hosting_hetzner.md` (Claude memory)
- Mémoire prompt Web Vitals : `axionia_prompt_web_vitals.md`
- Audit séquence canonique : `axionia_audit_sequence.md`
- Pattern audit : `axionia_audit_pattern.md` (empiler dédiés vs patcher existant)
