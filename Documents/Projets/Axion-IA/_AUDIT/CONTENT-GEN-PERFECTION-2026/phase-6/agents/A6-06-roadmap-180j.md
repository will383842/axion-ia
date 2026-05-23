# A6-06 — Roadmap Sprint D (91-180 jours)
**Agent** : A6-06 | **Date** : 2026-05-22 | **HEAD** : e573da64 (origin/main)
**Mission** : AUDIT-ONLY — roadmap chiffrée Sprint D (J91-J180)
**Fenêtre** : 2026-08-19 → 2026-11-16
**Score entrant** : ~3966/5000 | **Score attendu** : +118 → ~4084/5000

---

## AVERTISSEMENT MÉTHODOLOGIQUE

Ce rapport distingue deux référentiels :

| Référentiel | Score | Source |
|-------------|-------|--------|
| **Baseline réelle J0** | 3638/5000 au 2026-05-22 (HEAD e573da64) | Audit A6-01 |
| **Projeté post-Sprint C (J90)** | ~3966/5000 | Hypothèse Sprints A+B+C cumulés |

Le score entrant Sprint D est **~3966/5000** (après les gains A+B+C : +113+135+80 = +328 pts depuis 3638). Les projections Sprint D ajoutent +118 pts → cible J180 : **~4084/5000**. Cette cible reste **CONDITIONNELLE** — le GO 4500 n'est pas atteint à J180 mais est estimé à J+270-300 (~février 2027).

---

## 1. Priorités Sprint D

### Vue d'ensemble temporelle

```
J91 ───────── J120 ──────────── J150 ──────────────── J180
│  Phase D-1  │     Phase D-2    │      Phase D-3      │
│  Qualité +  │   Scale +        │   Consolidation +   │
│  Architecture│   Visibilité    │   Monitoring        │
│ +3966→~4030 │  ~4030→~4060    │  ~4060→~4084        │
└─────────────┴─────────────────┴─────────────────────┘
```

### Tableau items × effort × gain × dimension

| # | Item Sprint D | Responsable | Effort | Gain pts | Dimension | Priorité |
|---|---------------|-------------|:------:|:--------:|-----------|----------|
| D1 | Rampe MAX_PUBLISH 100→200 art/j (caps Redis atomiques + circuit breakers) | Will (décision J+120) | 0h Will + 2h Claude | +15 | D-ARCHI | P0 |
| D2 | Bilingue EN implémentation (si D14=oui, fix next-intl v4.12+) | Claude | 20h | +30 | D-VISI | P1 conditionnel |
| D3 | Voyage AI RAG sémantique réel (si D18=oui, remplacement embeddings stub) | Claude | 15h | +20 | D-QUAL | P1 conditionnel |
| D4 | Backlinks autorité FR ×2 (pitch presse JDN/Frenchweb) | Will | 20h | +20 | D-VISI | P1 Will |
| D5 | Conférences Will IA (1 intervention documentée) | Will | variable | +10 | D-VISI | P2 Will |
| D6 | Page transparence IA publique (/transparence-ia, JSON-LD Policy) | Claude | 4h | +15 | D-ETAT | P1 |
| D7 | Mini-audit content-gen post-J+120 (8 agents ciblés, KPIs réels) | Claude | 8h | +5 | Toutes | P1 |
| D8 | Monthly cap Anthropic upgrade (si scale > 100/j) | Will | 15 min | +0 (déblocage) | D-ARCHI | P0 prérequis |
| D9 | Monitoring tonalité brand voice automatique (drift detection hebdo) | Claude | 8h | +10 | D-OPS | P2 |
| D10 | 120 villes landing pages optimisées (villes 40-120) | Claude | 10h | +8 | D-VISI | P2 |
| D11 | GSC API dashboard integration (Search Console reporting automatique) | Claude | 10h | +15 | D-OPS | P2 |
| D12 | KB verticales complétion avancée (200 faits/verticale × 5 secteurs) | Claude | 12h | +10 | D-QUAL | P2 |
| D13 | Tests coverage 85%→90% + disaster recovery test | Claude | 5h | +5 | D-ARCHI | P3 |

**Effort total Sprint D** : ~94h Claude + ~40h Will (actions humaines étalées J91-J180)

---

## 2. Gains estimés par dimension

### Tableau 5 dimensions Sprint D

| Dimension | Score J90 (entrant) | Gains Sprint D | Score J180 (projeté) | Delta J90→J180 | Items contributeurs |
|-----------|:-------------------:|:--------------:|:--------------------:|:--------------:|---------------------|
| **D-ETAT** | ~870/1000 | +18 | **~888/1000** | +18 | D6 (page transparence +15), D7 (mini-audit +3 ajustement) |
| **D-ARCHI** | ~810/1000 | +20 | **~830/1000** | +20 | D1 (rampe +15), D8 (déblocage cap), D13 (tests +5) |
| **D-VISI** | ~830/1000 | +58 | **~888/1000** | +58 | D2 (EN +30 conditionnel), D4 (backlinks +20), D5 (conf +10), D10 (villes +8) |
| **D-QUAL** | ~782/1000 | +30 | **~812/1000** | +30 | D3 (RAG +20 conditionnel), D12 (KB +10) |
| **D-OPS** | ~674/1000 | +32 | **~706/1000** | +32 | D9 (brand voice monitoring +10), D11 (GSC dashboard +15), D7 (audit impact +7) |
| **TOTAL** | **~3966/5000** | **+158** | **~4084/5000** | **+118** | — |

> **Note sur l'écart +158 → +118** : 40 pts sont conditionnels (D2 bilingue EN dépend du fix next-intl, D3 RAG dépend de D18=oui). Si les deux items conditionnels sont livrés, le score J180 peut atteindre ~4124/5000. Si aucun des deux n'est livré, le score J180 plafonne à ~4044/5000. La valeur centrale retenue (+118 pts) intègre une probabilité 50% sur D2 et 50% sur D3.

### Scénarios J180

```
Scénario optimiste  (D2+D3 livrés)  : ~3966 + 158 = ~4124/5000  🟡
Scénario central    (1 sur 2)       : ~3966 + 118 = ~4084/5000  🟡
Scénario pessimiste (0 conditionnel): ~3966 + 68  = ~4034/5000  🟡 (GO > 466 pts manquants)
```

---

## 3. AI Act deadline rétrospective (2026-08-02 = J+71)

### Vérification compliance acquise en Sprint C

La deadline légale AI Act Article 50 (UE) tombe au **2026-08-02**, soit **J+71** par rapport à la baseline J0 = 2026-05-22. Cette date est **antérieure au début du Sprint D (J+91 = 2026-08-19)**. La compliance AI Act est donc un prérequis absolu des Sprints A/B/C, pas du Sprint D.

### Matrice compliance attendue à l'entrée Sprint D (J+91)

| Critère AI Act art. 50 | Statut requis à J+91 | Responsable sprint | Conséquence si KO |
|------------------------|----------------------|-------------------|-------------------|
| `promptHash` = SHA-256 du prompt LLM réel (non jobId) | ✅ DOIT être résolu Sprint A | Claude Sprint A | Bloquer scale > 30 art/j + risque amende |
| `ON DELETE RESTRICT` sur `generation_provenance.article_id` | ✅ DOIT être résolu Sprint A | Claude Sprint A | Intégrité traces provenance |
| `AiContentDisclaimer` présent 100% routes IA-générées | ✅ DOIT être résolu Sprint A/B | Claude | Non-conformité art. 50 |
| `aiGenerated: true` propagé JSON-LD tous types | ✅ Déjà conforme (QW-1 P1.5) | — | — |
| `GenerationProvenance` 6 ans retention | ✅ Déjà conforme | — | — |
| Monthly cap Anthropic ajusté avant scale | ✅ Will (15 min, avant J+91) | Will | Kill automatique pipeline à ~30% cible |

### Checkpoint SQL recommandé J+75 (post-deadline)

```sql
-- Vérification conformité AI Act post-deadline 2026-08-02
SELECT COUNT(*) AS non_compliant_hash
FROM generation_provenance
WHERE prompt_hash IS NULL
   OR prompt_hash LIKE '%stub%'
   OR LENGTH(prompt_hash) < 64;  -- SHA-256 = 64 hex chars

-- Attendu : 0 rows
-- Si > 0 : BLOQUER scale + escalade Will immédiate
```

### Verdict rétrospectif Sprint D

Si les Sprints A+B+C ont été correctement exécutés, le Sprint D **entre en conformité AI Act**. Aucun item AI Act majeur n'est attendu dans Sprint D. Le seul item lié est **D6 (page transparence IA publique)** — recommandé mais non bloquant légalement à J+91.

---

## 4. Coûts Sprint D

### Tableau LLM + infra + adresse FR

| Poste | Base de calcul | Coût estimé |
|-------|----------------|-------------|
| **LLM génération articles (100→200 art/j × 90j)** | Rampe progressive : moy. 150 art/j × 90j = 13 500 articles × ~$0,006/article (Claude Sonnet 4.6) | **~$81** |
| **LLM développement Claude Code (Sprint D)** | ~94h × ~$1/h (Claude API tokens Sonnet 4.6) | **~$94** |
| **Embeddings dedup OpenAI** | 13 500 articles × text-embedding-3-large (~$0,00013/article) | **~$1,75** |
| **Embeddings KB Voyage AI** | Faible (KB incrémentale seulement) | **~$2** |
| **Infrastructure Hetzner CPX42** | 3 mois × ~40€/mois | **~$132** |
| **GitHub Actions (builds Docker)** | 3 mois × ~15€/mois | **~$50** |
| **Cloudflare Pro + R2** | 3 mois × ~25€/mois | **~$83** |
| **Adresse FR (si Sedomicilier ~30€/mois)** | 3 mois × 30€/mois | **~$99** |
| **Buffer +15% imprévus** | Sur total hors adresse | **~$54** |
| **TOTAL Sprint D (sans adresse FR)** | | **~$413** |
| **TOTAL Sprint D (avec adresse FR)** | | **~$512** |

> **Note caps LLM** : La rampe 100→200 art/j exige que Will ajuste les monthly caps Anthropic avant J+91 (actuellement ~$100/mois → cible $500-600/mois à 200 art/j). Sans cet ajustement, le pipeline sera kill automatiquement après ~30% du volume cible.

### Comparaison avec Sprints précédents

| Sprint | Durée | Art produits | Coût LLM prod | Coût dev |
|--------|-------|:------------:|:-------------:|:--------:|
| A+B+C (J0-J90) | 90j | ~6 300 | ~$38 | ~$200 |
| **Sprint D (J91-J180)** | **90j** | **~13 500** | **~$81** | **~$94** |
| Cumul J0-J180 | 180j | ~19 800 | ~$119 | ~$294 |

---

## 5. Jalons J+120 et J+180

### Jalon J+120 (2026-09-19) — Checkpoint mi-sprint

| Critère | Cible | GO si | NO-GO si |
|---------|-------|-------|----------|
| Score /5000 | ~4030/5000 | ≥ 3990 | < 3950 |
| Art/jour actifs | 150-200/j | ≥ 130/j | < 100/j |
| AI Act compliance | 100% | 4/4 critères verts | 1+ critère rouge |
| LLM monthly cap ajusté | Oui (Will) | Cap ≥ $500/mois | Cap encore à $100 |
| D6 page transparence | Livrée | Déployée en prod | Non démarrée |
| Mini-audit J+120 | Lancé | 8 agents exécutés | Non lancé |
| D-OPS score | ≥ 690/1000 | GSC API connecté | Dashboard absent |

**Si NO-GO J+120** : pauser la rampe à 100 art/j, diagnostiquer les blocages avant de poursuivre Sprint D.

### Jalon J+180 (2026-11-16) — Clôture Sprint D

| Critère | Cible | Seuil acceptable | Seuil alerte |
|---------|-------|-----------------|--------------|
| Score /5000 | ~4084 (central) | ≥ 4034 | < 3980 |
| D-ETAT | ~888/1000 | ≥ 870 | < 850 |
| D-ARCHI | ~830/1000 | ≥ 810 | < 790 |
| D-VISI | ~888/1000 | ≥ 860 | < 830 |
| D-QUAL | ~812/1000 | ≥ 790 | < 770 |
| D-OPS | ~706/1000 | ≥ 680 | < 650 |
| Art/jour stable | 200/j | ≥ 150/j | < 100/j |
| Articles cumulés | ~19 800 | ≥ 16 000 | < 12 000 |
| Villes actives | 80-100 | ≥ 60 | < 50 |
| Uptime pipeline 30j | ≥ 99% | ≥ 97% | < 95% |
| Impressions GSC /mois | ≥ 150K | ≥ 80K | < 40K |

**Décision J+180** : Si score ≥ 4034 ET pipeline stable → lancer Sprint E (J181-J365). Si score < 3980 → sprint correctif d'urgence avant Sprint E.

### GO 4500 — Timing depuis J+180

```
Score central J+180 : ~4084/5000
Seuil GO           :  4500/5000
                      ──────────
Gap résiduel       :   ~416 pts

Plafonds naturels bloquant GO :
  [1] Wikidata renoncé (décision Will 2026-05-21) → ~34 pts bloqués
  [2] EN locale désactivée (bug next-intl)         → ~15 pts si non résolu Sprint D
  [3] Backlinks autorité insuffisants               → ~20 pts bloqués si outreach Will < 3 articles

Sans lever ces plafonds → GO max théorique ~4430/5000 (88.6%)
Pour GO 4500 → lever au moins 2 plafonds + Sprint E complet → J+270-300 (~fév 2027)
```

---

## Annexes

### A. Dépendances Will (actions humaines Sprint D)

| Item | Effort Will | Impact | Deadline |
|------|:---:|--------|----------|
| Monthly cap Anthropic ajusté ($500/mois) | 15 min | Déblocage rampe 200 art/j | **Avant J+91** |
| DPA Anthropic signé (console.anthropic.com) | 5 min | Compliance RGPD art.28 | **Avant J+91** |
| GSC service account JSON | 30 min | Dashboard D-OPS +15 pts | Avant Phase D-2 |
| Rampe MAX_PUBLISH 200 activée (env var Coolify) | 10 min | Scale effectif | Après checkpoint J+120 |
| Backlinks outreach presse FR (JDN/Frenchweb) | 20h étalées | +20 pts D-VISI | J+120 → J+180 |
| Conférences IA (1 intervention) | variable | +10 pts D-VISI | J+91 → J+180 |
| Décision D14 (bilingue EN : oui/non) | 1h réflexion | +30 pts D-VISI si oui | J+91 (urgent) |
| Décision D18 (Voyage AI RAG réel : oui/non) | 1h réflexion | +20 pts D-QUAL si oui | J+91 |

### B. Risques Sprint D

| Risque | Probabilité | Impact | Mitigation |
|--------|:-----------:|--------|-----------|
| Google HCU/SGE pénalise contenus IA sans EEAT | 30% | −50 pts D-VISI | LLM-judge strict + AuthorByline + backlinks |
| Scale 100→200 art/j → OOM BullMQ | 25% | Pipeline down | Throttle +10 art/j par semaine, monitoring Sentry |
| D-OPS stagne sous 680 (dashboard non câblé) | 20% | GO repoussé à J+320+ | GSC API priorité P1 Phase D-2 |
| Bilingue EN non résolu (bug next-intl persiste) | 50% | −30 pts D-VISI | EN reste en 301 redirect, gains reportés |
| Coût LLM dérive (> $300 sur 90j) | 20% | Budget dépassé | Alertes Telegram 80%+100% monthly cap actives |

### C. Jalons de vérification intermédiaires

| Jalon | Date estimée | Critère |
|-------|-------------|---------|
| J+75 | 2026-08-05 | SQL compliance AI Act → 0 rows non-conformes |
| J+91 | 2026-08-19 | Entrée Sprint D : score ≥ 3966 + pipeline 100 art/j stable |
| J+105 | 2026-09-02 | D6 page transparence déployée en prod |
| J+120 | 2026-09-19 | Checkpoint mi-sprint (cf. §5 Jalon J+120) |
| J+150 | 2026-10-19 | Phase D-2 : 80 villes actives + GSC dashboard connecté |
| J+165 | 2026-11-03 | Mini-audit raffiné (8 agents) → ajustement Phase D-3 |
| J+180 | 2026-11-16 | Clôture Sprint D → décision GO Sprint E (cf. §5 Jalon J+180) |

---

*Rapport A6-06 — AUDIT-ONLY — zéro commit — zéro modif code*
*Agent : Claude Sonnet 4.6 — 2026-05-22 — Axion-IA Content-Gen Perfection 2026*
*Sources* : A6-01 (baseline 3638/5000), A6-02 (gaps GO), A6-03/04/05 (roadmaps A+B+C), prompt pipeline perfection 2026
