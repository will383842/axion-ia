# Certification Frontend Perfection 2026 — AxionIA

Dossier complet d'audits pour certifier le frontend AxionIA niveau **best-in-class 2026**, **scale-ready** (jusqu'à 300K+ URLs) et **très professionnel** (standards SaaS premium).

## À qui s'adresse ce dossier

- **Will** (owner) : lance un audit avant chaque jalon majeur (V1 lancement, V2 scale, audit trimestriel).
- **Claude Code** (executor) : lit le master orchestrateur, exécute la séquence dans une fenêtre fraîche.
- **Futurs collaborateurs** : grok le standard qualité du projet en 30 min.

## Contexte projet (intouchable)

- Cabinet IA opérationnel B2B premium · OÜ Estonienne
- Hébergement : Hetzner Cloud CX32 + Coolify + Caddy 2 + Cloudflare Free (ADR 0009)
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

| #   | Prompt                       | Statut                                | Cible                                      |
| --- | ---------------------------- | ------------------------------------- | ------------------------------------------ |
| 24  | Monitoring & Observability   | `24-MONITORING-OBSERVABILITY-2026.md` | RUM + Search Console + uptime + alerting   |
| 25  | Professional Standards       | `25-PROFESSIONAL-STANDARDS-2026.md`   | ADRs + runbooks + postmortems + onboarding |
| 26  | **FINAL CERTIFICATION GATE** | `26-FINAL-CERTIFICATION-GATE-2026.md` | GO/NO-GO checklist exécutable              |

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

## Contraintes intouchables (toutes les certifications)

- Doctrine v3 visuelle figée (Design.md, ADR 0002, 0007)
- Naming « cabinet IA opérationnel » FR / « operational AI consultancy » EN
- Hetzner CX32 + CF Free (ADR 0009) — aucun coût récurrent additionnel sans validation
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

- ADR 0009 hosting : `docs/adr/0009-hosting-hetzner-cx32-cloudflare-free.md`
- Mémoire hosting : `axionia_hosting_hetzner.md` (Claude memory)
- Mémoire prompt Web Vitals : `axionia_prompt_web_vitals.md`
- Audit séquence canonique : `axionia_audit_sequence.md`
- Pattern audit : `axionia_audit_pattern.md` (empiler dédiés vs patcher existant)
