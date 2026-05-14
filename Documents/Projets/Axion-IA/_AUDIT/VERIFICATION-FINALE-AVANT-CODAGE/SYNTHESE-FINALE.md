# Synthèse finale — Vérification pré-implémentation Content Generator Axion-IA

**Date** : 2026-05-14 09:50
**Mode** : 🚫 AUDIT-ONLY strict (zéro modification hors `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/`)
**Score global** : **173 / 200**
**Verdict** : 🟡 **NEAR-GO** — Sprint correctif S0 (1 jour) avant Sprint 1

> **Cible visée** : ≥ 180/200 (🟢 GO PROD-READY).
> **Écart** : 7 points seulement, principalement causés par 2 bugs SEO pré-existants et une incohérence structurelle mineure du master prompt.

---

## Score par catégorie (Pass B appliqué)

| Catégorie | Poids | Brut /100 | Pass B /100 | Pondéré |
|---|---|---|---|---|
| **Cohérence master prompt** (VC1) | 20 | 72 | 80 | **16.0** |
| **Architecture & DB Prisma** (VC2) | 25 | 94 | 94 | **23.5** |
| **Pipeline content-gen** (VC3) | 25 | 87 | 92 | **23.0** |
| **SEO/AEO/GEO 2026** (VC4) | 30 | 80.5 | 80.5 | **24.15** |
| **Admin UI + autopilote** (VC5) | 25 | 92 | 92 | **23.0** |
| **Plan Sprint 1 faisabilité** (VC6) | 20 | 88.6 | 88.6 | **17.72** |
| **Skill + 10 seeds** (VC7) | 20 | 95 | 95 | **19.0** |
| **Sécurité + RGPD + obs** (VC8) | 15 | 72 | 80 | **12.0** |
| **Cohérence transverse Pass B** | 20 | — | 75 | **15.0** |
| **TOTAL** | **200** | — | — | **173.37** |

---

## Pass B croisement — ajustements appliqués

### P0 rétrogradés en INFO (faux positifs)

- **VC1-020** « SKILL.md + auto-pilot.md non vérifiés exister » → Phase 0 + VC5 + VC7 confirment les 16 fichiers présents et cohérents v1.7.
- **VC3 (4 P0)** « IProvider / search-intent-validator / quality loop / quality modules source » → ce sont des **fonctionnalités à coder Sprint 1**, pas des manques de spec. Le master prompt décrit chaque module ; absence de code applicatif = normal en mode AUDIT-ONLY pré-implémentation.

### P0 finaux corroborés (≥ 2 sources)

1. **P0-1 — Bugs SEO pré-existants** : `/sitemap.xml` 404 + `og:image` localhost (corroboré VC4 + VC6 + mémoire `[[axionia_bugs_seo_preexistants_2026-05-09]]` + plan Sprint 1 silencieux).
2. **P0-2 — Manon Q13 gate humain** : Will doit fournir option visuelle + bio validée (corroboré VC2 + VC5 + VC7 + VC4 — bloqueur autopilote).

---

## Top 5 P1 à fixer avant ou pendant Sprint 1

| ID | Sev | Item | Effort |
|---|---|---|---|
| VC6-003 | P1 | Commit #22 libellé `gpt-image-1` contradicte Unsplash-only acté v2.0 | 5 min |
| VC1-002 | P1 | Section § 24 master prompt physiquement après § 25-29 (inversion) | 1 h |
| VC2-002 | P1 | Enum `ContentGenJobStatus` manque valeur `quality_improving` v1.7 | 5 min |
| VC4-003 | P1 | Twitter handle Manon = placeholder à confirmer ou retirer balise | 30 min |
| VC4-005 | P1 | Anti-AI-detection 6 signaux non spécifiés en validation (doctrine-check.ts) | 3 h Sprint 1 |

## Top 8 autres P1 (à intégrer Sprint 1 sans Sprint S0 dédié)

- VC1-013 SearchIntent enum manque ref explicite § 5.1
- VC2-001 5 tables Coverage/Audience/Author/Banned non re-listées § 5.1
- VC4-004 Google Indexing API V1 = grey-area (JobPosting-only officiel)
- VC6-001 Day 1 Sprint 1 surchargé 4 commits / 8 h
- VC6-005 Clés API Will à confirmer Day 1 reality-check
- VC7-001 SKILL.md description v2.0 vs titre v1.7
- VC8-001 à VC8-005 (5 modules à coder Sprint 1 : DOMPurify, anti-SIREN, cost cap, Telegram 13 alerts, logger)
- llms.txt pages[] cardinalité à définir (50 villes top max)

---

## Forces majeures (à conserver)

- ✅ **Architecture DB Prisma exhaustive** (21 tables + 16 enums + 15 sub-folders + isolation-check + seeds 100%)
- ✅ **Admin UI 20+ sections** + cockpit géo 4 zones + 5 modes coloriage + SSE realtime
- ✅ **Autopilote 13 STOP & ASK** avec défauts v2.0 + Q13 unique gate humain + 8 critères STOP durci
- ✅ **JSON-LD 24+ schemas** + Speakable + Featured Snippet 3 formats + sitemap perfection v2.4
- ✅ **Bases sécurité solides** (env.ts Zod, PII redaction, Sentry scrub, sanitize, DPA Hetzner+CF)
- ✅ **16 fichiers skill + 10 seeds** pré-remplis cohérents v1.7
- ✅ **Plan Sprint 1 Day-by-Day** 30 commits + DAG inter-agents AGT-A → B/E/F optimal

---

## Cohérence transverse (Pass B = 15/20)

**Inversions/contradictions détectées** :
- Section § 24 master prompt physiquement après § 25-29 (P1)
- Commit #22 plan Sprint 1 mentionne `gpt-image-1` retiré v2.0 (P1)
- SKILL.md description v2.0 vs titre v1.7 (P1)
- Faux positifs P0 VC1-020 et VC3 (4 modules) détectés et rétrogradés en Pass B

**Cohérences confirmées** :
- FR-only v1.2 partout
- Manon persona transparente v2.0
- Unsplash uniquement v2.0
- 4 landings/ville v2.1
- Keywords templates dynamiques v2.1 (80 vs 500 statiques v2.0)
- Indexing API V1 v2.4
- SearchIntent + Boucle qualité + Q/R auto + RSS NewsArticle ancrés en sections Sprint

---

## Verdict

🟡 **NEAR-GO score 173/200** — Sprint correctif **S0 d'1 journée** avant Sprint 1.

**Pour passer GO PROD-READY (≥ 180/200)** : fixer les 2 P0 + 4 P1 cosmétiques listés dans `PLAN-CORRECTIF.md` (effort total **6-7 h**). Aucune refonte architecturale nécessaire.

→ Voir `PLAN-CORRECTIF.md` puis `WHAT-TO-DO-NOW.md`.
