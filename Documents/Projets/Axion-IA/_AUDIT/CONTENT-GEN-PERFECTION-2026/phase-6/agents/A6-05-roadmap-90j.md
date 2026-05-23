# A6-05 — Roadmap Sprint C (61-90 jours)

**Agent** : A6-05 | **Date** : 2026-05-22 | **HEAD** : e573da64 (origin/main)
**Mission** : AUDIT-ONLY — roadmap chiffrée J61-J90, zéro commit, zéro modif code
**Fenêtre** : 2026-07-21 → 2026-08-19 (J61-J90 depuis J0 = 2026-05-22)
**Score entrant Sprint C** : ~3 886/5 000 (post-Sprint B estimé)
**Objectif Sprint C** : +80 pts → **~3 966/5 000**
**Gap vers GO (4 500)** : −534 pts à J90

> **⚠️ CONTRAINTE CRITIQUE : AI Act art. 50 deadline 2026-08-02 (J+71)**
> Sprint C couvre J61-J90. La deadline tombe à J+71, soit **10 jours après le début du sprint**.
> Si Sprint A n'a pas livré `promptHash` en prod avant J61, c'est la **première tâche absolue Sprint C**.

---

## 1. Synthèse exécutive

| Indicateur | Valeur |
|------------|--------|
| Score début Sprint C (J61) | ~3 886 / 5 000 |
| Gain Sprint C estimé | +80 pts |
| Score fin Sprint C (J90 = 2026-08-19) | **~3 966 / 5 000** |
| Seuil GO | 4 500 / 5 000 |
| Écart résiduel à J90 | **−534 pts** |
| GO réaliste | **~J150-J180** (sprints D+E+F) |
| Contrainte critique | **AI Act art. 50 deadline J+71 = 2026-08-02** |
| Effort Claude Sprint C | **~25h** |
| Coût LLM production | **~$54** (3 000 art × $0.018) |

---

## 2. Tableau des priorités Sprint C

| # | Item | Type | Dates | Resp. | Effort | Gain pts | Dimension |
|---|------|------|-------|-------|--------|----------|-----------|
| **C-00** | **AI Act promptHash vérification en prod** | **P0 CRITIQUE** | **J61-J62** | **Claude** | **4h si gap** | **Compliance** | **D-ARCHI** |
| C-01 | Rampe MAX_PUBLISH 50→100 (si KPIs J60 verts) | Will | J61-J62 | Will | 5 min | +0 direct | Volume |
| C-02 | KB sectorielle 4e verticale complétion | Code | J62-J65 | Claude | 8h | +10 | D-QUAL |
| C-03 | Featured Snippets comparatif (si non livré Sprint B) | Code | J65-J68 | Claude | 4h | +15 | D-VISI |
| C-04 | Script monitoring qualité auto (dérive brand voice) | Code | J68-J71 | Claude | 4h | +10 | D-OPS |
| C-05 | Heatmap villes France (si D-P5-4 révisé par Will) | Code | J71-J75 | Claude | 8h | +10 | D-OPS |
| C-06 | Bilingue EN re-enable (CONDITIONNEL D14=oui) | Code | J71-J85 | Claude | 20h | +30 | D-VISI |
| C-07 | Audit content-gen mini (3 agents, tracker régression) | Audit | J82-J85 | Claude | 2h | — | Contrôle |
| C-08 | Préparation audit P6.2 automne 2026 | Audit | J85-J90 | Claude | 3h | — | Roadmap |

**Total effort Claude** : ~25h (base sans C-06) ou ~45h (avec EN re-enable C-06)

---

## 3. Plan semaine par semaine

### Semaine C-1 : J61-J67 (2026-07-21 → 2026-07-27)
**Thème : AI Act compliance + rampe volume + KB complétion**

#### J61-J62 — P0 CRITIQUE : Vérification AI Act promptHash en prod

**ACTION PREMIÈRE avant toute autre tâche Sprint C :**

```
SI DB ai_generated_content.promptHash IS NULL sur > 0 articles :
  → STOP toutes autres tâches
  → Claude livre promptHash en urgence (4h)
  → Deploy immédiat
  → Validation prod avant J+71 (2026-08-02)
```

Checklist compliance AI Act art. 50 à valider :
- `AiGeneratedContent.promptHash` non null sur tous articles publiés
- Champ `aiGenerated: true` dans JSON-LD de chaque article
- Composant `AiContentDisclaimer` visible sur toutes pages générées IA
- Mention "Généré par Claude Sonnet 4.6" dans metadata publication
- `provider`, `model`, `promptVersion` loggés (audit trail complet)
- Backfill articles existants sans disclaimer (script 2h si > 0 articles non couverts)

**Si Sprint A a livré promptHash** : passer directement à C-01.

#### J61-J62 — Décision rampe MAX_PUBLISH 50→100 (Will, 5 min)

**STOP & ASK obligatoire :**

| KPI à vérifier | Seuil GO | Source |
|----------------|----------|--------|
| Score moyen articles J31-J60 | ≥ 7.0/10 | DB `ai_content_reviews.avg(overallScore)` |
| Taux rejet sur J31-J60 | ≤ 15% | DB (seuil plus strict qu'à J45) |
| 0 pénalité Google (J0-J60) | Confirmé Will | GSC → Sécurité et actions manuelles |
| 0 chute trafic organique > 20% | Confirmé Will | GSC → Performances → Clics |
| Coût LLM Sprint B | ≤ $27 estimé ± 20% | Dashboard coûts |

Si tous verts → Will valide `MAX_PUBLISH_PER_DAY = 100` dans BatchesV2 UI.
**Si rampe activée** : 100 art/j × 30j Sprint C = 3 000 articles, $54 LLM prod.
**Si rampe non activée** : 50 art/j × 30j = 1 500 articles, $27 LLM prod.

#### J62-J65 — KB 4e verticale complétion (8h Claude)
- Selon décision D-P5-1 : identifier la verticale manquante (coaching-individuel, web-digital, autre)
- Fichier `src/server/content-gen/kb/[verticale]-facts.ts`
- 10 facts vérifiés + sources primaires (INSEE, Syntec, etc.)
- Intégration `kb-context-builder.ts`
- **Gain : +10 pts D-QUAL**

**Score fin semaine C-1 : ~3 896/5 000**

---

### Semaine C-2 : J68-J74 (2026-07-28 → 2026-08-03)
**Thème : Featured Snippets + Monitoring qualité — Deadline AI Act J+71**

#### J65-J68 — Featured Snippets comparatif (4h Claude, si non livré Sprint B)
- Si B-12 livré en Sprint B : sauter cet item
- Prompt système `comparison.ts` avec contrainte tableau HTML + JSON-LD `Table` + `ItemList`
- **Gain : +15 pts D-VISI** (conditionnel — non comptabilisé si déjà livré Sprint B)

#### J68-J71 — Script monitoring qualité auto (4h Claude)
- Worker `quality-monitor-worker.ts` : scan hebdomadaire des articles publiés
- Métriques : dérive brand voice (diff vs template référence), score moyen LLM-judge, taux near-duplicate (SimHash), distribution des topics
- Alerte Telegram si dérive > 10% sur brand voice ou score < 6.5
- Rapport JSON dans `ContentGenConfig.key = "quality_monitor_report_YYYY-MM-DD"`
- **Gain : +10 pts D-OPS**

### Jalon J+71 (2026-08-02) — DEADLINE AI ACT ART. 50 ⚠️

**Vérification impérative ce jour-là :**

| Exigence | Validation |
|----------|-----------|
| `promptHash` non null sur 100% articles publiés | `SELECT COUNT(*) FROM ai_generated_content WHERE prompt_hash IS NULL` = 0 |
| `aiGenerated: true` dans JSON-LD tous articles | Vérification échantillon 20 articles via Google Rich Results Test |
| `AiContentDisclaimer` visible | Capture écran 5 pages articles, présence du composant |
| Audit trail complet | `SELECT DISTINCT provider, model FROM ai_generated_content` → valeurs réelles |

**Sanction max AI Act** : 7,5 M€ ou 1,5% CA mondial (art. 50 §2 + art. 99 §3).

**Si un point est manquant à J+71 :**
```
STOP toutes autres tâches Sprint C
→ Claude : correction en urgence (2-4h)
→ Deploy immédiat
→ Re-validation avant J+72
```

**Score fin semaine C-2 : ~3 911/5 000**

---

### Semaine C-3 : J75-J81 (2026-08-04 → 2026-08-10)
**Thème : Heatmap villes + (EN conditionnel)**

#### J71-J75 — Heatmap villes France (8h Claude, si D-P5-4 révisé)

**Conditionnel : exécuter seulement si Will décide de réactiver D-P5-4 (couverture géographique étendue)**

- Page `/content-gen/geo/heatmap`
- Carte France SVG avec densité articles publiés par département + ville
- Couleur : vert si ≥ 10 articles indexables, orange si 1-9, rouge si 0
- Filtres par verticale + type contenu
- Requête Prisma agrégée : `groupBy(['city_slug'], { _count: { id: true } })`
- **Gain (si D-P5-4 révisé) : +10 pts D-OPS**
- **Gain (si D-P5-4 inchangé) : 0 pts** — item non livrable

#### J71-J85 — Bilingue EN re-enable (20h Claude, CONDITIONNEL D14=oui)

**Conditionnel : exécuter seulement si Will décide D14=oui ET bug next-intl fixé**

**Prérequis avant exécution :**
1. Bug 307 self-loop next-intl v4.11+ corrigé (upgrade next-intl ou patch middleware)
2. Will confirme D14=oui via env var Coolify `EN_LOCALE_ENABLED=true`
3. Test `/en/about` → 200 (au lieu de 301 vers `/fr/a-propos`)

**Plan si D14=oui :**
- Retirer le bloc proxy.ts redirect `/en/*` → 301
- Vérifier hreflang `en` dans metadata (`src/lib/seo.ts`) déjà en place
- Review 20 articles EN générés : brand voice EN, facts, meta descriptions
- **Gain (si D14=oui) : +30 pts D-VISI**
- **Gain (si D14=non) : 0 pts** — EN reste désactivé, proxy.ts intact

**Score fin semaine C-3 : ~3 921/5 000** (sans EN) ou **~3 951/5 000** (avec EN)

---

### Semaine C-4 : J82-J90 (2026-08-11 → 2026-08-19)
**Thème : Audit qualité + préparation P6.2**

#### J82-J85 — Audit content-gen mini (3 agents, 2h Claude)
- Agent 1 : D-QUAL — score moyen LLM-judge sur 100 articles J61-J82, taux near-duplicate
- Agent 2 : D-OPS — logs BullMQ (jobs failed > 5% ?), SSE opérationnel, monitoring qualité actif
- Agent 3 : D-ARCHI — promptHash couverture 100%, schema.prisma migrations synchro
- Rapport dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/sprint-c-j85-checkup.md`
- **Verdict : dérive/stable → go/no-go Sprint D**

#### J85-J90 — Préparation audit P6.2 automne 2026 (3h Claude)
- Mise à jour `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/A6-12-recommandation-finale.md`
- Score projeté P6.2 : ~4 000-4 100 / 5 000
- Identification items Sprint D prioritaires (écart GO −534 pts)
- Proposition dates P6.2 : automne 2026 (~J+180 = fin novembre 2026)

**Score fin semaine C-4 : ~3 966/5 000**

---

## 4. Tableau des gains par dimension

| Dimension | Score entrant C | Items Sprint C | Gain | Score sortant C | Écart GO |
|-----------|----------------|----------------|------|----------------|----------|
| D-ETAT | 795 | (non ciblé) | +0 | **795** | −205 |
| D-ARCHI | 806 | C-00 (AI Act compliance) | +5 | **811** | −189 |
| D-VISI | 818 | C-03 (snippets, si gap) + C-06 (EN, cond.) | +0-45 | **818-863** | −182 à −137 |
| D-QUAL | 815 | C-02 (KB 4e verticale) | +10 | **825** | −175 |
| D-OPS | 615 | C-04 (monitoring auto) + C-05 (heatmap, cond.) | +10-20 | **625-635** | −375 à −365 |
| **TOTAL** | **3 849** | | **+25-80** | **~3 883-3 966** | **−534 à −617** |

> Scénario base (sans EN D14, sans heatmap, sans snippets si livré B) : +25 pts
> Scénario optimiste (avec EN + heatmap) : +80 pts
> **Objectif affiché : +80 pts** — requiert D14=oui + D-P5-4 révisé + snippets non livrés Sprint B

```
D-ETAT  [████████████████████████████████████████░░░░░░░░░░]   795 → 795
D-ARCHI [████████████████████████████████████████░░░░░░░░░░]   806 → 811
D-VISI  [████████████████████████████████████████░░░░░░░░░░]   818 → 818+ (cond.)
D-QUAL  [████████████████████████████████████████░░░░░░░░░░]   815 → 825
D-OPS   [████████████████████████████████░░░░░░░░░░░░░░░░░░]   615 → 625-635
         ────────────────────────────────────────────────────
TOTAL   [█████████████████████████████████████░░░░░░░░░░░░░]  ~3 966/5 000  79.3%

Seuil GO  (4 500) : ──────────────────────────────────────────────────── 90.0%
Position J90      : ──────────────────────────────────────── 79.3% (−10.7%)
```

---

## 5. Effort et coûts Sprint C

### 5.1 Effort développement Claude

| Item | Effort | Coût dev estimé |
|------|--------|----------------|
| C-00 AI Act vérif/fix (si gap) | 4h conditionnels | ~$1.20 |
| C-02 KB 4e verticale | 8h | ~$2.50 |
| C-03 Featured Snippets (si gap B) | 4h conditionnels | ~$1.20 |
| C-04 Script monitoring qualité | 4h | ~$1.20 |
| C-05 Heatmap villes (si D-P5-4) | 8h conditionnels | ~$2.50 |
| C-06 EN re-enable (si D14=oui) | 20h conditionnels | ~$6.00 |
| C-07 Audit mini J82-J85 | 2h | ~$0.60 |
| C-08 Préparation P6.2 | 3h | ~$0.90 |
| **Total Claude (base sans conditionnels)** | **~17h** | **~$5.40** |
| **Total Claude (optimiste tout livré)** | **~53h** | **~$16.10** |

### 5.2 Coût production articles

| Scénario | Volume | Coût/article | Coût LLM prod |
|----------|--------|--------------|---------------|
| Rampe 100 art/j × 30j | 3 000 articles | $0.018 | **~$54** |
| Flat 50 art/j × 30j (si rampe non activée) | 1 500 articles | $0.018 | **~$27** |

### 5.3 Effort Will Sprint C

| Tâche | Effort Will | Coût estimé |
|-------|-------------|-------------|
| Décision rampe J61-J62 | 30 min | — |
| Décision D14 EN (J65) | 30 min | — |
| Décision D-P5-4 heatmap (J65) | 30 min | — |
| Validation AI Act J+71 | 1h | ~40€ |
| Revue audit mini J82-J85 | 1h | ~40€ |
| **Total Will** | **~3h30** | **~80€** |

### 5.4 Récapitulatif coûts Sprint C

| Poste | Montant |
|-------|---------|
| Développement Claude API (base) | ~$5 (~5€) |
| Développement Claude API (optimiste) | ~$16 (~15€) |
| Production articles (rampe 100) | ~$54 (~50€) |
| Production articles (flat 50) | ~$27 (~25€) |
| Temps Will | ~80€ |
| **Total Sprint C (rampe + base dev)** | **~135€** |
| **Total Sprint C (rampe + optimiste dev)** | **~145€** |

---

## 6. Jalons mesurables Sprint C

| Jalon | Date | Critère mesurable | Responsable |
|-------|------|-------------------|-------------|
| J61 — Rampe décidée | 2026-07-21 | MAX_PUBLISH_PER_DAY en DB = 100 ou décision documentée | Will |
| J62 — AI Act check effectué | 2026-07-22 | Rapport checklist AI Act (5 points verts ou fix en cours) | Claude |
| J65 — KB 4e verticale livrée | 2026-07-25 | Fichier `kb/[verticale]-facts.ts` + intégration `kb-context-builder.ts` | Claude |
| J71 — Monitoring qualité actif | 2026-07-31 | Worker `quality-monitor-worker.ts` déployé, premier rapport JSON en DB | Claude |
| **J+71 (2026-08-02)** | **2026-08-02** | **AI Act : promptHash 100% en prod, disclaimer visible, audit trail** | **Claude + Will** |
| J75 — Heatmap ou EN (conditionnel) | 2026-08-04 | Item conditionnel livré si décision Will oui | Claude |
| J85 — Audit mini Sprint C | 2026-08-13 | Rapport `sprint-c-j85-checkup.md` + verdict dérive/stable | Claude |
| J90 — Score vérifié Sprint C | 2026-08-19 | Audit agent → score ≥ 3 966/5 000 | Claude |

---

## 7. Décisions bloquantes Will — Sprint C

Ces décisions doivent être tranchées avant J65 pour permettre la planification des semaines C-2 à C-4 :

| ID | Décision | Deadline | Impact score | Options |
|----|----------|----------|--------------|---------|
| D-W1 | Rampe MAX_PUBLISH 50→100 (5 KPIs verts J60 ?) | J61 | +volume (3 000 art Sprint C) | GO/WAIT/STOP |
| D14 | EN locale re-enable (bug next-intl fixé ?) | J65 | +30 pts D-VISI | OUI/NON |
| D-P5-4 | Heatmap villes France (réactiver scope géo ?) | J65 | +10 pts D-OPS | OUI/NON |

**Recommandation** : Trancher D14 et D-P5-4 ensemble à J65 après revue du score Sprint B. La décision D14 est la plus impactante (+30 pts).

---

## 8. Risques Sprint C

### R1 — AI Act deadline manquée J+71 (PROBABILITÉ BASSE si Sprint A livré, CRITIQUE si non)
**Description** : Si `promptHash` n'est pas en prod au 2026-08-02, sanction administrative possible (CNIL + DGA IA France).
**Mitigation** : C-00 est la première tâche de Sprint C. Sprint A doit avoir livré — mais Sprint C absorbe le gap si nécessaire.
**Impact si non mitigé** : Risque légal 7,5 M€ — arrêt immédiat de la production de contenu IA.

### R2 — Core Update Google entre J61-J90 (PROBABILITÉ 40-60%)
**Description** : Période estivale (juillet-août) moins fréquente en Core Update, mais probable sur la fenêtre 30j.
**Mitigation** : Monitoring quotidien GSC Will. Rollback `MAX_PUBLISH=0` en 2 clics. Script monitoring qualité (C-04) détecte dérives avant Google.

| Niveau | Seuil | Action |
|--------|-------|--------|
| Niveau 1 — Trafic −10% à −20% sur 7j | Modéré | Réduire 100→30/j, audit 50 articles |
| Niveau 2 — Trafic −30% à −50% | Sévère | STOP prod, audit forensique 200 articles |
| Niveau 3 — Pénalité manuelle GSC | Critique | Demande reconsidération + sprint correctif |

### R3 — D14 (EN) non réalisable (bug next-intl non fixé) (PROBABILITÉ HAUTE)
**Description** : Le bug 307 self-loop next-intl v4.11 n'est pas encore résolu. Si D14=oui mais bug persiste, C-06 ne peut pas être livré.
**Mitigation** : Investiguer fix next-intl v4.12+ avant J65. Si non fixable, reporter EN à Sprint D et compenser par autres items C-03/C-05.
**Impact** : −30 pts D-VISI Sprint C si D14 impossible.

### R4 — Saturation DB PostgreSQL (PROBABILITÉ MOYENNE)
**Description** : 3 000 articles Sprint C + embeddings 3072 dim × float32 ≈ 36 MB vecteurs supplémentaires.
**Mitigation** : Monitoring taille DB avant J75. Index IVFFlat en place. VACUUM cron hebdomadaire.

---

## 9. Analyse honnête : GO 4 500 non atteint à J90

**Constat** : À J90 (fin Sprint C), le score plafonne à ~3 966/5 000. Il manque **534 points** pour le seuil GO 4 500.

### Pourquoi l'écart persiste

1. **Indexation lente** : Les 3 000 articles Sprint C génèrent de la visibilité GSC sur 6-12 mois — les gains SEO se matérialisent J+90 à J+180, pas pendant Sprint C.

2. **Wikidata exclu** : La décision Will exclut Wikidata (~15-20 pts D-ARCHI/D-VISI). Ce levier reste disponible en Sprint D si la décision est révisée.

3. **D-OPS plafond** : D-OPS reste à ~620-635 sur 1000 à J90. Le plafond est structurel : les 380 pts restants D-OPS nécessitent des fonctionnalités avancées (reporting email hebdo, alertes multi-canaux, métriques attribution).

4. **EN locale** : Si D14=non, ~30 pts D-VISI restent verrouillés.

### Chemin réaliste vers GO 4 500

```
J60  (fin Sprint B)  : ~3 886 / 5 000  ← post-Sprint B
J90  (fin Sprint C)  : ~3 966 / 5 000  ← post-Sprint C
J120 (Sprint D)      : ~4 050 / 5 000  ← items EN + D-OPS avancé
J150 (Sprint E)      : ~4 250 / 5 000  ← maturité backlinks + indexation volumétrique
J180 (Sprint F)      : ~4 500+ / 5 000 ← GO (cible fin 2026-T1 / début 2027-T1)
```

**Sprint D (J91-J120) — items à prioriser pour accélérer :**
- Rapport email hebdo lundi 8h (4h Claude, +20 pts D-OPS)
- Alertes multi-canaux (Telegram + email, 4h Claude, +10 pts D-OPS)
- Attribution organique articles → prospects (8h Claude, +25 pts D-OPS)
- Backlinks maturité phase 1 (indexation, +15 pts D-VISI)
- EN locale (si D14=oui, sprint D, +30 pts si non livré C)
- **Total Sprint D estimé : ~100 pts**

---

## 10. Tableau de bord hebdomadaire Sprint C

Métriques à surveiller chaque semaine :

| Métrique | Source | Cible J61-J90 | Alerte |
|----------|--------|---------------|--------|
| Trafic organique GSC | Search Console | +3-5%/sem | −10%/sem → investigation |
| LLM-judge moyen | Admin console | ≥ 7.0/10 | < 6.5 → STOP rampe |
| Articles publiés/j | BullMQ stats | 50 ou 100 | 0 ou > 110 → bug |
| Brand voice drift | Monitoring C-04 (actif J71+) | < 5% | > 10% → patch prompts |
| `promptHash` couverture | DB `ai_generated_content` | 100% | < 100% avant J+71 = P0 |
| Taux embeddings | Admin console | 100% | < 95% → backfill |
| Coût LLM cumulé | Dashboard coûts B-04 | ≤ $54 sprint C | > $60 → audit consommation |

---

## 11. Synthèse finale

### Sprint C (J61-J90) en 5 points

1. **Score cible J90** : ~3 966 / 5 000 (+80 pts sur base 3 886) — requiert D14=oui + D-P5-4 révisé
2. **Jalon critique J+71 (2026-08-02)** : AI Act art. 50 — `promptHash` DOIT être en prod (sanction 7,5 M€)
3. **Décision J61** : Rampe 100 art/j conditionnelle à 5 KPIs verts J0-J60
4. **GO 4 500 non atteint à J90** : Écart −534 pts — réaliste à ~J165-J180 (Sprints D+E+F)
5. **Coût Sprint C total** : ~135-145€ (dev Claude + prod articles + temps Will)

### Chemin critique vers GO

```
J+71 (2026-08-02) : AI Act compliance (non négociable, sanction 7,5M€)
J61  : Décision rampe 100/j (binaire GO/WAIT)
J85  : Audit mini qualité (verdict dérive/stable → go/no-go Sprint D)
J90  : Score ~3 966 (post-Sprint C)
J120 : Sprint D → ~4 050-4 100
J180 : GO 4 500 (cible réaliste)
```

---

*Rapport A6-05 — AUDIT-ONLY — zéro commit — zéro modif code*
*Agent : Claude Sonnet 4.6 — 2026-05-22 — Pipeline Content-Gen Perfection Axion-IA 2026*
