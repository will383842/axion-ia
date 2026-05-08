# MASTER ORCHESTRATOR — Certification Frontend Perfection 2026

> **À lancer dans une fenêtre Claude Code fraîche depuis `Axion-IA/axionia/`.**
> Phrase d'invocation : « Lance `_AUDIT/CERTIFICATION-FRONTEND-2026/00-MASTER-ORCHESTRATOR.md` »

---

## 0. Mission

Orchestrer la **certification complète frontend AxionIA niveau best-in-class 2026**, scale-ready (300K+ URLs), professionnel (standards SaaS premium), 100 % free-tier (Hetzner CX32 + Cloudflare Free), zéro régression.

**Sortie attendue** : verdict GO / NO-GO production avec scoring `/2600` (26 audits × 100 pts).

## 1. Contexte (lecture obligatoire avant tout)

### Stack

- Next 16 + React 19 + Tailwind 4 + next-intl FR/EN
- Prisma 5 + PostgreSQL 16 + Redis (containers Coolify)
- Hetzner Cloud CX32 + Caddy 2 + Cloudflare Free (ADR 0009)
- 4 342 HTML SSG actuels + **rampe à 100-300 nouvelles URLs/jour** (industrialisation pSEO)

### Doctrine intouchable

- Direction visuelle v3 figée (titleEm Fraunces italique + Header terracotta + hero-schema 576×576)
- Naming : « cabinet IA opérationnel » FR / « operational AI consultancy » EN
- Anti-doorway HCU sur villes non pilotes
- Aucun coût récurrent additionnel sans validation explicite Will

### Lectures préalables

- `CLAUDE.md` → `AGENTS.md` (« This is NOT the Next.js you know »)
- `Design.md` (doctrine v3)
- ADRs 0001-0009 dans `docs/adr/`
- `axionia_hosting_hetzner.md` (mémoire)
- `_AUDIT/CERTIFICATION-FRONTEND-2026/README.md`

## 2. Séquence d'exécution (6 vagues, ordre strict)

### Phase 0 — Bootstrap (toi, l'orchestrateur)

1. Lis le README du dossier
2. Liste les 26 prompts disponibles
3. Crée un fichier de tracking : `_AUDIT/CERTIFICATION-FRONTEND-2026/_RUN-LOG-YYYY-MM-DD.md`
4. Pour chaque audit : statut (todo / in_progress / done / blocked) + score / 100 + STOP & ASK ouverts

### Vague A — Foundations (Performance + Code)

| Ordre | Audit                  | Prompt                                        | STOP & ASK avant suite ?                        |
| ----- | ---------------------- | --------------------------------------------- | ----------------------------------------------- |
| A1    | Performance Web Vitals | `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` | ✅ Oui (résultats baseline + plan vagues V1-V6) |
| A2    | Code Health            | `_AUDIT/PROMPT-CODE-HEALTH-2026.md`           | ✅ Oui                                          |
| A3    | Architecture & DRY     | `03-ARCHITECTURE-DRY-2026.md`                 | ✅ Oui                                          |
| A4    | Centralisation SSOT    | `04-CENTRALISATION-SSOT-2026.md`              | ✅ Oui                                          |

**Critère passage Vague B** : score moyen Vague A ≥ 80/100 ET 0 STOP & ASK rouge.

### Vague B — Design & A11y & i18n

| Ordre | Audit                   | Prompt                                                                    | STOP & ASK |
| ----- | ----------------------- | ------------------------------------------------------------------------- | ---------- |
| B1    | Design System cohérence | (consolide 3 prompts existants : Visual Rhythm + Typography + Header Nav) | ✅         |
| B2    | A11y WCAG 2.2 AA + RGAA | `06-A11Y-WCAG22-RGAA-2026.md`                                             | ✅         |
| B3    | i18n parity + Intl.\*   | `14-I18N-PARITY-INTL-2026.md`                                             | ✅         |

**Critère passage Vague C** : 0 violation Axe-core + clés FR/EN strictement égales.

### Vague C — SEO/AEO/GEO + Linking + pSEO

| Ordre | Audit                          | Prompt                                     | STOP & ASK |
| ----- | ------------------------------ | ------------------------------------------ | ---------- |
| C1    | SEO Master                     | `_AUDIT/PROMPT-SEO-MASTER-2026.md`         | ✅         |
| C2    | AEO + GEO + LLMs               | `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md`        | ✅         |
| C3    | Navigation & UX                | `_AUDIT/PROMPT-HEADER-NAVIGATION-2026.md`  | ✅         |
| C4    | Internal Linking Graph         | `10-INTERNAL-LINKING-GRAPH-2026.md`        | ✅         |
| C5    | Page Quality E-E-A-T           | `_AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md` | ✅         |
| C6    | pSEO Industrialization Quality | `12-PSEO-INDUSTRIALIZATION-QUALITY.md`     | ✅         |

**Critère passage Vague D** : Lighthouse SEO 100/100 sur 15 pages stratégiques + 0 lien interne cassé + 0 page orpheline.

### Vague D — SCALE (CRITIQUE pour 100-300 URLs/jour)

| Ordre | Audit                    | Prompt                              | STOP & ASK |
| ----- | ------------------------ | ----------------------------------- | ---------- |
| D1    | Content Pipeline Scale   | `13-CONTENT-PIPELINE-SCALE-2026.md` | ✅         |
| D2    | Scalability Infra        | `20-SCALABILITY-INFRA-2026.md`      | ✅         |
| D3    | Indexation Management    | `21-INDEXATION-MANAGEMENT-2026.md`  | ✅         |
| D4    | Cache Invalidation + ISR | `22-CACHE-INVALIDATION-ISR-2026.md` | ✅         |
| D5    | Quality Automation       | `23-QUALITY-AUTOMATION-2026.md`     | ✅         |

**Critère passage Vague E** : pipeline 100-300 URLs/jour démontré end-to-end + ISR fonctionnel + Cloudflare cache purge automatisé + quality gate auto pré-publish actif.

### Vague E — Tests, Sécu, Content, CRO, Légal

| Ordre | Audit                   | Prompt                             | STOP & ASK |
| ----- | ----------------------- | ---------------------------------- | ---------- |
| E1    | Security Frontend       | `15-SECURITY-FRONTEND-2026.md`     | ✅         |
| E2    | Tests & Coverage        | `16-TESTS-COVERAGE-2026.md`        | ✅         |
| E3    | Content Quality FR/EN   | `17-CONTENT-QUALITY-FR-EN-2026.md` | ✅         |
| E4    | CRO Conversion          | `18-CRO-CONVERSION-2026.md`        | ✅         |
| E5    | Legal Compliance + RGAA | `19-LEGAL-COMPLIANCE-RGAA-2026.md` | ✅         |

**Critère passage Vague F** : `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` 100 % vert.

### Vague F — Monitoring + Standards + Pro Coverage + GATE FINAL

| Ordre | Audit                        | Prompt                                | STOP & ASK                |
| ----- | ---------------------------- | ------------------------------------- | ------------------------- |
| F1    | Monitoring & Observability   | `24-MONITORING-OBSERVABILITY-2026.md` | ✅                        |
| F2    | Professional Standards       | `25-PROFESSIONAL-STANDARDS-2026.md`   | ✅                        |
| F3    | API Design + Forms + States  | `27-API-DESIGN-FORMS-STATES-2026.md`  | ✅                        |
| F4    | Data Resilience + DR         | `28-DATA-RESILIENCE-DR-2026.md`       | ✅                        |
| F5    | **FINAL CERTIFICATION GATE** | `26-FINAL-CERTIFICATION-GATE-2026.md` | ✅ Verdict final GO/NO-GO |

## 3. Tracking & livrables

### Fichier de tracking

À créer en début d'exécution : `_AUDIT/CERTIFICATION-FRONTEND-2026/_RUN-LOG-YYYY-MM-DD.md`

Format :

```markdown
# Run Certification Frontend YYYY-MM-DD

## Statut global

- Vague A : X/4 done · score moyen X/100
- Vague B : X/3 done · score moyen X/100
- Vague C : X/6 done · score moyen X/100
- Vague D : X/5 done · score moyen X/100
- Vague E : X/5 done · score moyen X/100
- Vague F : X/3 done · score moyen X/100
- **Total** : X/26 done · score global X/2600

## STOP & ASK ouverts

- [vague.audit] Question : ...

## Décisions Will

- [date] [vague.audit] Q : ... · R : ...

## GATE FINAL

- Statut : [PENDING / GO / NO-GO]
- Date : ...
- Blockers : ...
```

### Livrables agrégés

À la fin :

- `_AUDIT/CERTIFICATION-FRONTEND-2026/_SYNTHESE-CERTIFICATION-YYYY-MM-DD.md` — vue d'ensemble + scoring + verdict
- `_AUDIT/CERTIFICATION-FRONTEND-2026/_PATCHES-AGGREGES-YYYY-MM-DD.md` — toutes les diffs générées par les 26 audits, dédupliquées + priorisées
- `_AUDIT/CERTIFICATION-FRONTEND-2026/_ROADMAP-PATCHES-YYYY-MM-DD.md` — séquencement application post-certification

## 4. Règles transversales

### STOP & ASK obligatoires

1. Avant chaque vague (A→B→C→D→E→F)
2. Avant tout patch (aucun audit n'applique sans GO)
3. Avant tout commit
4. Avant ajout dépendance npm
5. Avant patch infra (Caddy, Cloudflare, Coolify)
6. Avant tout coût récurrent

### Auto-skip si déjà OK

Si un audit retourne ≥ 95/100 sur 3 runs successifs (3 mois), il peut être skippé en certification trimestrielle (logger dans `_RUN-LOG`).

### Régression detection

Comparer chaque score avec le run précédent. Si chute > 10 pts → STOP & ASK obligatoire.

### Aucune dégradation des seuils

Lighthouse CI thresholds (`lighthouserc.json`) ne peuvent que se durcir, jamais se relâcher.

### Complémentarité prompts existants vs nouveaux

Les prompts existants `_AUDIT/PROMPT-*` (Web Vitals, Code Health, SEO Master, etc.) sont **référencés** par cet orchestrateur, **pas duplicate**. Les nouveaux prompts `_AUDIT/CERTIFICATION-FRONTEND-2026/XX-*` couvrent les **angles non couverts** par les existants :

- **PROMPT-CODE-HEALTH-2026** (existant, 160 critères) : TS strictness, complexité, code mort, deps, tests, conventions DX → **engineering interne**
- **03-ARCHITECTURE-DRY** (nouveau, 70 critères) : atomic design, project root, module boundaries, patterns code → **structure projet**
- **04-CENTRALISATION-SSOT** (nouveau, 60 critères) : single source of truth data + config → **data layer centralization**

Pas de chevauchement. Lance CODE-HEALTH **avant** 03 et 04 dans la Vague A.

## 5. Système de scoring unifié

**Une seule échelle : pourcentage 0-100 % par audit, agrégé en moyenne pondérée.**

### Niveau 1 — Score par audit

Chaque prompt audite sur `/N` (N = chapitres × 10 critères). Convertir en % (`score / N × 100`).

| Audit                                 | Total critères | Score max %  |
| ------------------------------------- | -------------- | ------------ |
| 03 Architecture DRY                   | 70             | 100 %        |
| 04 Centralisation SSOT                | 60             | 100 %        |
| 06 A11y                               | 60             | 100 %        |
| 10 Internal Linking                   | 50             | 100 %        |
| 12 pSEO Quality                       | 50             | 100 %        |
| 13 Content Pipeline                   | 80             | 100 %        |
| 14 i18n                               | 50             | 100 %        |
| 15 Security                           | 50             | 100 %        |
| 16 Tests                              | 50             | 100 %        |
| 17 Content Quality                    | 50             | 100 %        |
| 18 CRO                                | 50             | 100 %        |
| 19 Legal                              | 50             | 100 %        |
| 20 Scalability                        | 80             | 100 %        |
| 21 Indexation                         | 60             | 100 %        |
| 22 Cache ISR                          | 50             | 100 %        |
| 23 Quality Auto                       | 60             | 100 %        |
| 24 Monitoring                         | 50             | 100 %        |
| 25 Pro Standards                      | 100            | 100 %        |
| Externes (A1, A2, B1, C1, C2, C3, C5) | variable       | 100 % chacun |

### Niveau 2 — Agrégation orchestrateur (indicative)

Moyenne pondérée des audits par vague :

| Vague | Audits                | Pondération | Note                                 |
| ----- | --------------------- | ----------- | ------------------------------------ |
| A     | 4 (A1+A2+03+04)       | ×1          | Foundations                          |
| B     | 3 (B1+06+14)          | ×1          | Design + a11y + i18n                 |
| C     | 6 (C1+C2+C3+10+C5+12) | ×1          | SEO + linking + pSEO                 |
| D     | 5 (13+20+21+22+23)    | **×2**      | Scale (100-300 URLs/jour critique)   |
| E     | 5 (15+16+17+18+19)    | ×1          | Tests + sécu + content + CRO + légal |
| F     | 2 (24+25)             | ×1          | Monitoring + standards               |

**Agrégat orchestrateur** = moyenne pondérée % sur 25 audits = **score indicatif** seulement. Pas le verdict final.

### Niveau 3 — VERDICT FINAL via Gate 26

**Le verdict GO/NO-GO repose UNIQUEMENT sur le Gate 26** (`26-FINAL-CERTIFICATION-GATE-2026.md`), qui est une checklist exécutable de 315 critères pondérés produisant un score normalisé /100.

| Gate 26 score normalisé | Verdict                                                       |
| ----------------------- | ------------------------------------------------------------- |
| ≥ 95 %                  | **GO PROD** — best-in-class certifié 2026                     |
| 85-94 %                 | **GO conditionnel** — patches identifiés sous 7 jours         |
| 70-84 %                 | **NO-GO** — vague D ou E à reprendre intégralement            |
| < 70 %                  | **NO-GO STRICT** — refonte d'un ou plusieurs domaines requise |

**Le Gate 26 a sa propre logique de scoring détaillée dans le fichier 26.** L'agrégat orchestrateur (Niveau 2) sert de signal d'alerte précoce, pas de verdict.

## 6. Mode opératoire (toi, l'orchestrateur)

### Étape 1 : Préparer

1. Crée `_RUN-LOG-YYYY-MM-DD.md`
2. **Vérifie que les 18 prompts internes du dossier existent** :
   - `03-ARCHITECTURE-DRY-2026.md` à `26-FINAL-CERTIFICATION-GATE-2026.md` (cf. README pour liste complète)
3. **Vérifie que les 7 prompts externes référencés existent** :
   - `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md` (audit A1)
   - `_AUDIT/PROMPT-CODE-HEALTH-2026.md` (audit A2)
   - `_AUDIT/PROMPT-VISUAL-RHYTHM-2026.md` + `PROMPT-TYPOGRAPHY-2026.md` + `PROMPT-HEADER-NAVIGATION-2026.md` (audit B1 design)
   - `_AUDIT/PROMPT-SEO-MASTER-2026.md` (audit C1)
   - `_AUDIT/PROMPT-SEO-AEO-GEO-2026.md` (audit C2)
   - `_AUDIT/PROMPT-PAGE-AUDIT-PERFECT-2026.md` (audit C5)
4. **Si un prompt manque → STOP & ASK obligatoire** (ne pas continuer la certification incomplète, ne pas inventer un audit)
5. **Référencer les thresholds canoniques** : `_AUDIT/CERTIFICATION-FRONTEND-2026/README.md` § « Thresholds canoniques » fait foi pour TOUS les seuils chiffrés
6. `pnpm install && pnpm build` pour partir d'un état clean

### Étape 2 : Exécuter vague par vague

1. Annonce la vague qui démarre
2. Lance les audits de la vague (en série ou en parallèle si indépendants)
3. Pour chaque audit : sub-agent `general-purpose` avec le prompt cible
4. Collecte le score et les STOP & ASK
5. Mets à jour `_RUN-LOG`
6. STOP & ASK obligatoire avant vague suivante

### Étape 3 : Synthèse finale

1. Génère `_SYNTHESE-CERTIFICATION-YYYY-MM-DD.md`
2. Génère `_PATCHES-AGGREGES-YYYY-MM-DD.md`
3. Génère `_ROADMAP-PATCHES-YYYY-MM-DD.md`
4. Lance `26-FINAL-CERTIFICATION-GATE-2026.md` pour le verdict
5. Pose le verdict GO/NO-GO + justification

### Étape 4 : Mémoire

Crée la mémoire `axionia_certification_frontend_YYYY-MM-DD.md` avec :

- Score global
- Verdict
- Top 5 chantiers résultants
- Cadence recommandée prochaine certification

Ajoute la ligne dans `MEMORY.md`.

## 7. Cadence recommandée

| Cadence                             | Vagues à lancer                                             |
| ----------------------------------- | ----------------------------------------------------------- |
| **Avant V1 prod**                   | TOUTES (A→F)                                                |
| **Avant V2 scale (post-Sprint 23)** | TOUTES (A→F) avec focus Vague D                             |
| **Trimestriel**                     | Vague D + F (scaling + gate)                                |
| **Mensuel**                         | D3 (indexation) + D5 (quality automation) + F3 (gate light) |
| **Après gros rollout pSEO**         | C5, C6, D1, D3, D5                                          |
| **Après Sprint backend**            | A2, E1, E2                                                  |
| **Après changement design**         | B1, B2                                                      |

---

## STOP & ASK obligatoires de l'orchestrateur

1. Avant Phase 0 si certains prompts (`03-`, `04-`, `06-`, `10-`, `12-`, `13-`, `14-`, `15-`, `16-`, `17-`, `18-`, `19-`, `20-`, `21-`, `22-`, `23-`, `24-`, `25-`, `26-`) sont absents.
2. Avant chaque vague (A→F).
3. Si un audit retourne score < 50/100 (signal d'un problème majeur).
4. Si une régression > 10 pts détectée vs run précédent.
5. Avant la synthèse finale (montrer score brut au user).
6. Avant le verdict GATE FINAL.

---

**FIN DU MASTER ORCHESTRATOR.**
**Démarre par Phase 0 (bootstrap + tracking).**
