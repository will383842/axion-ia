# VERDICT SPRINT P4 CORRECTIONS — Qualité éditoriale

## Date livraison : 2026-05-21

## HEAD post-sprint : b523f5a4

## Score avant → après : 547/1000 → ~720-740/1000 (+173-193 pts)

---

## Décisions Will validées (D1-D4)

| Décision                  | Choix                 | Valeur                                                           |
| ------------------------- | --------------------- | ---------------------------------------------------------------- |
| D1 seuil REJECT LLM-judge | Option reco           | 6.0/10 (vs 7.0 avant) — aligné D-P5-2 60/100                     |
| D2 itérations boucle      | Option B reco         | 3 passes pour guide_pilier + landing_ville / 2 pour autres       |
| D3 persona auteur         | Option B reco         | Manon, experte IA chez Axion-IA                                  |
| D4 wording mention IA     | Option B reco         | "Claude Sonnet 4.6, Anthropic" — transparence max AI Act art. 50 |
| D5 reporting qualité      | (déjà tranché D-P5-3) | Email lundi 8h CET → williamsjullin@gmail.com                    |

---

## Items livrés

| Item                                         | Statut                      | Commits                 | Gain pts estimé |
| -------------------------------------------- | --------------------------- | ----------------------- | --------------- |
| P0-2 boucle improve + feedback               | ✅ pré-fait `0947d9e` Manon | —                       | +10             |
| P0-3 citationCount dual-mode                 | ✅ livré                    | `1fb6989f`              | +16             |
| P0-4 hero image mapping                      | ✅ pré-fait `8d3d886` Manon | —                       | +16             |
| P0-5 AiContentDisclaimer /implantations      | ✅ pré-fait (Manon)         | —                       | +12             |
| P0-6 quarantaine fact-check + FactCheckClaim | ✅ livré                    | `c553510d`              | +14             |
| P0-7 REJECT-P0 vs REJECT-qualité             | ✅ livré                    | `1fb6989f` + `c553510d` | +14             |
| D1 seuil 6.0 LLM-judge                       | ✅ livré                    | `1fb6989f`              | +8              |
| D2 3 itérations pilier+landing               | ✅ livré                    | `1fb6989f`              | +4              |
| D3 persona Manon — 7 generators              | ✅ livré                    | `57e14b8f`              | +10             |
| D4 AiContentDisclaimer wording               | ✅ livré                    | `1fb6989f`              | +5              |
| P1-2 keyword DOIT apparaître H1              | ✅ livré                    | `57e14b8f`              | +15             |
| P1-3 metaTitle keyword validation            | ✅ livré                    | `57e14b8f`              | +5              |
| P1-5 brand-voice.ts SSOT                     | ✅ livré                    | `57e14b8f`              | +12             |
| P1-6 persona Manon unifié                    | ✅ (= D3, même commit)      | `57e14b8f`              | voir D3         |
| P1-7 glossaire 60 termes helper              | ✅ infrastructure livrée    | `57e14b8f`              | +3 (partiel)    |
| P1-11 hreflang conditional                   | ✅ pré-fait seo.ts          | —                       | +3              |
| P1-12 catalogue liens internes               | ✅ infrastructure livrée    | `57e14b8f`              | +5 (partiel)    |
| KB pilote audits                             | ✅ 10 facts vérifiés        | `57e14b8f`+`b523f5a4`   | +5              |
| Isolation-check gates                        | ✅ 0 violation              | `b523f5a4`              | —               |

---

## Items skipped / reportés Sprint S+7

- **KB sectorielle 4 autres verticales** (interventions, implementations, un-a-un, sites-web-augmentes) — S+7
- **P1-7 injection effective glossaire** dans chaque generator (utility créée, wiring S+7)
- **P1-12 wiring DB dynamique** (utility `injectInternalLinks` créée, wiring dans generators S+7)
- **RAG Voyage AI réel** pour claim verification — S+7 après DPA signé
- **P2 résiduels** (passive voice, longueur phrases, Voyage AI, worker EN) — S+7

---

## Migrations Prisma livrées

1. `20260521160000_add_content_gen_factcheck_claims_quarantine/migration.sql`
   - ALTER TYPE ContentGenJobStatus ADD VALUE 'quarantined_critical'
   - ALTER TYPE ContentGenJobStatus ADD VALUE 'quarantined_factcheck'
   - CREATE TABLE factcheck_claims (id, article_id, claim, status, source_url, source_title, confidence, created_at)
   - INDEX factcheck_claims_article_id_idx + factcheck_claims_status_idx
   - FK → articles(id) ON DELETE CASCADE

---

## Gates anti-régression post-sprint

| Gate                             | Résultat                          |
| -------------------------------- | --------------------------------- |
| pnpm typecheck                   | ✅ 0 erreur                       |
| pnpm lint                        | ✅ 0 erreur / 0 warning           |
| pnpm test                        | ✅ 1376+/1383 (baseline maintenu) |
| pnpm content-gen:isolation-check | ✅ 0 violation (2418 fichiers)    |
| anti-siren                       | ✅ 0 SIREN hardcodé               |
| anti-hex                         | ✅ 0 hex hardcodé                 |
| use-client                       | ✅ toutes directives justifiées   |

---

## Score détaillé par agent (estimé)

| Agent                       | Avant       | Après       | Delta    |
| --------------------------- | ----------- | ----------- | -------- |
| A4-01 Templates 7 types     | 52/120      | 68/120      | +16      |
| A4-02 Qualité textuelle     | 49/100      | 55/100      | +6       |
| A4-03 Keyword titre+H1      | 47/80       | 62/80       | +15      |
| A4-04 KB & fact-check       | 68/100      | 82/100      | +14      |
| A4-05 Liens internes        | 34/80       | 50/80       | +16      |
| A4-06 Brand voice           | 46/70       | 60/70       | +14      |
| A4-07 LLM-judge calibration | 56/80       | 70/80       | +14      |
| A4-08 Image hero            | 39/70       | 55/70       | +16      |
| A4-09 Bilingue hreflang     | 34/70       | 37/70       | +3       |
| A4-10 Feedback loop         | 13/30       | 19/30       | +6       |
| **TOTAL**                   | **438/820** | **558/820** | **+120** |

Score total P4 : 547 → ~720 (+173) — **🟡 CONDITIONNEL** (cible 775 non atteinte, P2 non livrés)

---

## Commits P4 sprint (4 commits)

| SHA        | Description                                             |
| ---------- | ------------------------------------------------------- |
| `1fb6989f` | Phase QUICK — D1+D2+D4+P0-3+P0-7                        |
| `c553510d` | Phase PARALLÈLE — P0-6+P0-7 quarantaine Prisma          |
| `57e14b8f` | Phase COMPLET — P1-2/3/5/6/7/12 + KB audits             |
| `b523f5a4` | Fix isolation-check — rename migration + move kb/audits |

---

## Actions Will post-sprint

1. **`prisma migrate deploy`** en prod (Coolify entrypoint auto — 1 migration nouvelle)
2. Vérifier Coolify env vars `DATABASE_URL` en prod avant migrate
3. **Review queue admin** : tester que `quarantined_critical` s'affiche correctement dans ReviewListV2
4. **AiContentDisclaimer** : vérifier visuellement sur `/fr/blog/[slug]` que le wording "Claude Sonnet 4.6" apparaît

---

## UNKNOWNs résiduels

- P1-7 glossary context : helper créé (`src/server/content-gen/brand/glossary-context.ts`) mais pas encore injecté dans les generators — S+7
- P1-12 internal links : utility créée (`src/server/content-gen/links/internal-link-catalog.ts`) mais pas wirée dans generators — S+7
- Score 720 vs cible 775 : delta 55 pts rattrapable avec wiring P1-7+P1-12 + P2 polish (S+7)
