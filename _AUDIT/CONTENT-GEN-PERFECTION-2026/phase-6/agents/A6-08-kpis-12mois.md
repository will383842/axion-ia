# A6-08 — KPIs 12 mois Content-Gen Perfection 2026

**Agent** : A6-08  
**Phase** : 6 — Audit global pipeline content-gen  
**Date baseline** : 2026-05-22  
**Horizon** : Q3 2026 → Q2 2027 (12 mois)  
**Statut** : AUDIT-ONLY

---

## Tableau des 18 KPIs avec cibles trimestrielles

| #   | KPI                                          | Baseline 2026-05-22 | Cible Q3 26 (août) | Cible Q4 26 (nov) | Cible Q1 27 (fév) | Cible Q2 27 (mai) | Source mesure                                                                                                              |
| --- | -------------------------------------------- | ------------------- | ------------------ | ----------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Articles publiés cumulés                     | ~100                | ~2 800             | ~11 800           | ~38 800           | ~84 800           | DB `ContentArticle` WHERE status='published' COUNT                                                                         |
| 2   | Impressions GSC mensuelles                   | ~5 000              | ~50 000            | ~250 000          | ~800 000          | ~2 000 000        | Google Search Console → Performance → Impressions (28j glissants)                                                          |
| 3   | Taux indexation articles (%)                 | ~30 %               | ~65 %              | ~80 %             | ~88 %             | ~92 %             | GSC → Couverture → Indexées / Total soumises via sitemap                                                                   |
| 4   | Score pipeline /5000                         | ~3 715              | ~4 100             | ~4 250            | ~4 400            | ~4 500            | Audit Content-Gen Perfection — score agrégé phases 1-6                                                                     |
| 5   | Compliance AI Act (%)                        | ~95 %               | 100 %              | 100 %             | 100 %             | 100 %             | Script audit `pnpm audit:ai-act` — champs promptHash + AiContentDisclaimer + schema RESTRICT                               |
| 6   | Citations AI Overviews / mois                | ~2                  | ~20                | ~80               | ~250              | ~600              | Monitoring manuel Perplexity / SGE / Bing Copilot + outil BrightEdge/SE Ranking                                            |
| 7   | Position moyenne brand keywords              | ~30                 | ~15                | ~8                | ~5                | ~3                | GSC filtré sur queries brand « axion-ia » + variants — moyenne pondérée clics                                              |
| 8   | Taux rejection qualité (REJECT rate, %)      | ~15 %               | ~10 %              | ~7 %              | ~5 %              | ~3 %              | DB `ContentGenJob` WHERE result='rejected' / total — fenêtre 7j glissants                                                  |
| 9   | Score éditorial moyen articles publiés (/10) | ~7.2                | ~7.6               | ~7.9              | ~8.2              | ~8.5              | Moyenne `qualityScore` table `ContentArticle` WHERE status='published' (7j)                                                |
| 10  | Cost per article LLM ($)                     | ~$0.10              | ~$0.08             | ~$0.06            | ~$0.05            | ~$0.04            | Anthropic/OpenAI billing ÷ articles générés (mensuel)                                                                      |
| 11  | Workers uptime (%)                           | ~98 %               | ~99 %              | ~99.5 %           | ~99.5 %           | ~99.9 %           | BullMQ health + Sentry uptime monitor — moyenne mensuelle                                                                  |
| 12  | Campagnes actives                            | 1-3                 | ~10                | ~20               | ~35               | ~50               | DB `CoverageCampaign` WHERE status='active' COUNT                                                                          |
| 13  | Villes couvertes (articles publiés)          | ~39                 | ~80                | ~150              | ~300              | ~500              | DB villes DISTINCT WHERE EXISTS (article published)                                                                        |
| 14  | Verticales avec KB complète (/5)             | 1/5                 | 3/5                | 4/5               | 5/5               | 5/5 (V2)          | Audit manuel `src/server/content-gen/kb/` — 5 verticales : audits / interventions / implémentations / 1-to-1 / web-digital |
| 15  | GSC service account connecté (oui/non)       | Non                 | Oui                | Oui               | Oui               | Oui               | Vérification env var `GSC_SERVICE_ACCOUNT_JSON` + appel API GSC 200                                                        |
| 16  | Backlinks domaine autorité                   | ~5                  | ~20                | ~60               | ~150              | ~300              | Ahrefs / Majestic / Semrush — DR ≥ 30, dofollow uniquement                                                                 |
| 17  | Score D-Ops console admin (/1000)            | 593/1000            | ~700               | ~800              | ~880              | ~950              | Audit Content-Gen phase admin — grille D-Ops 12 critères                                                                   |
| 18  | Satisfaction Will (NPS qualitatif, /10)      | 7/10                | 8/10               | 8.5/10            | 9/10              | 9.5/10            | Évaluation qualitative hebdomadaire Will post-sprint                                                                       |

---

## Méthodologie de mesure par KPI

### KPI-1 — Articles publiés cumulés

**Logique de progression** :

- Q3 (J+0→J+90) : montée en cadence 30 art/j moyenne → +2 700 ≈ 2 800 cumulés
- Q4 (J+91→J+180) : rampe 100 art/j → +9 000 ≈ 11 800 cumulés
- Q1 (J+181→J+270) : régime 300 art/j → +27 000 ≈ 38 800 cumulés
- Q2 (J+271→J+365) : plateau 500 art/j → +46 000 ≈ 84 800 cumulés (objectif 80K ✅)

**Requête SQL** :

```sql
SELECT COUNT(*) FROM "ContentArticle" WHERE status = 'published';
```

**Fréquence** : quotidienne, dashboard admin `/content-gen/overview`.

**Risques** : déduplication doublons (SimHash gate P1.5), saturation DB sans partitionnement (trigger si > 50K rows sans index partiel).

---

### KPI-2 — Impressions GSC mensuelles

**Logique** : indexation progressive × croissance volume articles. Coefficient multiplicateur attendu :

- Q3 : ×10 (indexation articles batch 1 + sitemap soumis)
- Q4 : ×5 (base élargie + brand awareness)
- Q1 : ×3.2
- Q2 : ×2.5 (rendements décroissants longue traîne saturée)

**Source** : GSC API (après connexion D11 service account) → endpoint `searchConsole.data.query` dimensions `date`, agrégé mois.

**Proxy avant D11** : GSC UI manuel — export CSV mensuel, colonne Impressions, filtre période 28j.

**Alerte** : si impression plateau > 4 semaines sans croissance → audit couverture sitemap + délai crawl.

---

### KPI-3 — Taux indexation articles

**Méthode de calcul** :

```
taux = articles indexés GSC / articles soumis sitemap × 100
```

**Source** :

1. GSC → Couverture → « Indexées » (filtré par type URL = article)
2. Sitemap dynamique `axion-ia.com/sitemap-articles.xml` → count URLs

**Blocages connus** :

- Délai indexation Google 4-8 semaines pour contenus nouveaux domaines
- Quota crawl limité (< 1 000 pages/j attendu en Q3, montée en Q4 si autorité domaine progresse)
- Articles thin content rejetés → nécessite `qualityScore ≥ 6.0` gate (seuil D-P5-2)

**Actions si < cible** : soumettre URLs individuelles GSC API (après D11), vérifier canonical, corriger redirect loops EN.

---

### KPI-4 — Score pipeline /5000

**Composition du score** (rappel phases 1-6) :

- P1 Architecture chain : /800
- P2 Infra & workers : /700
- P3 SEO/AEO/GEO : /800
- P4 Éditorial & qualité : /700
- P5 Console admin : /1000
- P6 KPIs & gouvernance : /1000

**Progression** :

- Q3 : déploiement R6 schema.prisma (5 min fix critique) + D11 GSC → +385 pts estimés → ~4 100
- Q4 : KB verticales 3/5 + 150 villes + console score 800 → +150 → ~4 250
- Q1 : KB 5/5 + AIO monitoring automatisé + backlinks 150 → +150 → ~4 400
- Q2 : plateau excellence + audit 2027 prep → +100 → ~4 500

**Auditeur** : audit trimestriel Content-Gen Perfection (même grille 6 phases).

---

### KPI-5 — Compliance AI Act (%)

**Composantes mesurées** :

| Sous-critère                           | Poids | Baseline   | Cible Q3 |
| -------------------------------------- | ----- | ---------- | -------- |
| `promptHash` présent sur 100% articles | 30%   | ✅ 100%    | 100%     |
| `AiContentDisclaimer` affiché          | 25%   | ✅ 100%    | 100%     |
| Schema RESTRICT (FK integrity)         | 20%   | ✅ fixé    | 100%     |
| DPA providers IA signé                 | 15%   | ❌ 0%      | 100%     |
| Audit log mutations > 20 art/j         | 10%   | ⚠️ partiel | 100%     |

**Deadline critique** : AI Act art. 50 → **2026-08-02** (J+72 depuis baseline). Cible Q3 = 100% obligatoire.

**Script d'audit** :

```bash
pnpm audit:ai-act  # vérifie tous les articles publiés last 7j
```

**Risque si miss** : non-conformité légale, potentiel retrait contenu par plateformes.

---

### KPI-6 — Citations AI Overviews / mois

**Définition** : mentions de axion-ia.com ou « Axion-IA » dans :

- Google AI Overviews (SGE)
- Bing Copilot réponses
- Perplexity citations
- ChatGPT browsing references

**Méthode de mesure** :

1. **Manuel Q3** : 20 requêtes/semaine testées (brand + "formation IA Paris" + "audit IA PME" etc.) → log spreadsheet
2. **Semi-auto Q4** : SE Ranking AI Monitor ou BrightEdge — alertes keyword avec source AIO
3. **Auto Q1-Q2** : API Perplexity Sonar + script scraping SERP SGE weekly

**Logique progression** : contenu AEO optimisé (Speakable, FAQ, HowTo JSON-LD) → autorité domaine → citations croissantes.

---

### KPI-7 — Position moyenne brand keywords

**Périmètre brand keywords** (liste fixe) :

- "axion-ia"
- "axion ia formation"
- "axion ia audit"
- "axion ia implémentation"
- "formation IA entreprise axion"

**Calcul** : GSC → filtrer queries contenant "axion" → moyenne pondérée par clics (pas impressions seules).

**Interprétation** :

- Position > 20 : notoriété insuffisante, SEO brand à renforcer (GMB, Wikidata, mentions presse)
- Position 5-10 : régime normal domaine 6-18 mois
- Position ≤ 3 : excellente notoriété brand

**Actions si stagnation** : soumettre Wikidata (D-W1 reporté), activer Google Business Profile, campagne mentions presse secteur IA.

---

### KPI-8 — Taux rejection qualité (REJECT rate)

**Définition** : articles générés rejetés par le gate qualité (score < 6.0/10) avant publication.

**Requête** :

```sql
SELECT
  COUNT(*) FILTER (WHERE result = 'rejected') * 100.0 / COUNT(*) AS reject_rate
FROM "ContentGenJob"
WHERE created_at >= NOW() - INTERVAL '7 days';
```

**Objectif décroissant** : amélioration continue des prompts + KB plus riches → moins de rejets.

**Seuil alerte** : REJECT rate > 20% sur 7j → investigation prompts + KB gaps.

**Tension** : baisser le seuil qualité < 6.0 augmenterait artificiellement le volume → interdit (D-P5-2 canonique).

---

### KPI-9 — Score éditorial moyen

**Source** : `qualityScore` colonne table `ContentArticle` (LLM-judge score 0-10, calculé par agent `llm-quality-judge.ts`).

**Composantes du score éditorial** :

- Factualité / zero invention : 30%
- Structure SEO (H1/H2/H3, liens internes) : 20%
- Pertinence verticale : 20%
- Originalité (SimHash distance ≥ 0.3) : 15%
- Lisibilité (Flesch-Kincaid adapté FR) : 15%

**Fenêtre glissante** : 7j (évite biais campagnes anciennes).

**Progression attendue** : enrichissement KB → meilleurs contextes → scores LLM-judge supérieurs.

---

### KPI-10 — Cost per article LLM ($)

**Calcul mensuel** :

```
CPA = (facture Anthropic + facture OpenAI) / articles publiés (mois)
```

**Baseline** : ~$0.10 = Sonnet 4.6 ~800 tokens input + ~1200 tokens output × 2 passes (gen + judge).

**Leviers d'optimisation** :

- Prompt caching (cache_control sur KB → -60% tokens input)
- Batch API Anthropic (async, -50% prix)
- Downgrade judge sur articles simples → Haiku (~×5 moins cher)
- Mutualisation prompts système (éviter re-send chaque call)

**Cible Q2 2027** : $0.04 = ÷2.5 via caching + batch. Au volume 500 art/j : ~$600/mois LLM.

**Seuil alerte** : CPA > $0.15 → audit drift prompts (tokens gonflés).

---

### KPI-11 — Workers uptime

**Scope** : 8 workers BullMQ critiques :

1. `publish-worker`
2. `content-gen-worker`
3. `orchestrator-worker`
4. `indexnow-worker`
5. `image-bank-worker` (image-bank V1)
6. `quality-judge-worker`
7. `kb-refresh-worker`
8. `campaign-scheduler-worker`

**Mesure** : Sentry uptime monitors (configurés Sprint S+4) + BullMQ `/api/admin/queues/health` endpoint.

**Calcul** : (minutes worker actif / minutes période) × 100, agrégé mensuel.

**SLA interne** :

- Q3 : 99% = max 7.2h downtime/mois acceptable (incidents maintenance)
- Q2 2027 : 99.9% = max 43.8 min/mois → requiert HA workers (2 replicas minimum)

**Actions si < 98%** : alerte PagerDuty-like (Sentry alert → webhook Telegram bot).

---

### KPI-12 — Campagnes actives

**Définition** : `CoverageCampaign` avec `status = 'active'` ET au moins 1 job généré dans les 7 derniers jours (évite campagnes fantômes).

**Requête** :

```sql
SELECT COUNT(DISTINCT c.id)
FROM "CoverageCampaign" c
JOIN "ContentGenJob" j ON j.campaign_id = c.id
WHERE c.status = 'active'
  AND j.created_at >= NOW() - INTERVAL '7 days';
```

**Progression** :

- Q3 : 10 campagnes = 3 secteurs × ~3 verticales + 1 blog RSS
- Q4 : 20 = scale villes + templates CampaignTemplate (D-P5 phase B)
- Q1 : 35 = KB 5 verticales × villes × 7 templates
- Q2 : 50 = régime industriel

---

### KPI-13 — Villes couvertes (articles publiés)

**Définition** : villes distinctes ayant AU MOINS 1 article publié (pas juste données économiques).

**Requête** :

```sql
SELECT COUNT(DISTINCT city_slug)
FROM "ContentArticle"
WHERE status = 'published'
  AND city_slug IS NOT NULL;
```

**Roadmap villes** :

- Baseline : 39 villes (economic-data pilotes, articles pas encore tous publiés)
- Q3 →80 : 41 nouvelles villes medium (50K-200K hab), copy templates existants
- Q4 →150 : préfectures + sous-préfectures (>30K hab)
- Q1 →300 : toutes communes >15K hab
- Q2 →500 : couverture quasi-exhaustive FR métropolitaine >10K hab

**Prérequis** : `economic-data/<slug>.ts` disponible ET campagne ville active.

---

### KPI-14 — Verticales avec KB complète (/5)

**5 verticales cibles** :

1. **Audits IA** — baseline : KB V1 partielle ✅
2. **Interventions / Formations** — manquant
3. **Implémentations** — manquant
4. **1-to-1 coaching** (naming `un-a-un`) — manquant
5. **Web & Digital IA** (`/codage-developpement`) — manquant

**Critères KB complète** (grille D-Ops) :

- ≥ 50 entités sectorielles chargées
- ≥ 20 cas concrets (case studies)
- ≥ 30 questions FAQ thématiques
- Glossaire ≥ 15 termes spécialisés
- Sources citables ≥ 10

**Calendrier** :

- Q3 : + Interventions/Formations + 1-to-1 → 3/5
- Q4 : + Implémentations → 4/5
- Q1 : + Web & Digital IA → 5/5 complet
- Q2 : V2 KB (enrichissement profond, cas concrets réels clients) → 5/5 enrichi

---

### KPI-15 — GSC service account connecté

**Statut** : décision D11 (verdict P6) — non encore fait.

**Étapes** :

1. Créer service account GCP project `axion-ia-gsc`
2. Déléguer accès GSC → ajouter l'email service account en lecteur GSC
3. Télécharger JSON key → secret Coolify `GSC_SERVICE_ACCOUNT_JSON`
4. Activer dans code : `src/lib/gsc-client.ts` (stub existant)
5. Tester : `GET /api/admin/gsc/status` → 200

**Impact** : débloque KPI-2 automatisé, KPI-3 précis, monitoring indexation dashboard admin.

**Critère binaire** : vérification `process.env.GSC_SERVICE_ACCOUNT_JSON` non-null + appel GSC API réussi.

---

### KPI-16 — Backlinks domaine autorité

**Définition** : backlinks dofollow provenant de domaines DR ≥ 30 (Ahrefs metric).

**Sources cibles** :

- Articles invités blogs IA / RH / PME
- Mentions presse (PR Newswire FR, Maddyness, FrenchWeb)
- Annuaires officiels (BPI France, CCI)
- Partenariats écosystème (éditeurs logiciels IA)
- Pages ressources universités / grandes écoles IA

**Mesure** : Ahrefs Site Explorer → Backlinks → Dofollow → DR ≥ 30, unique domains.

**Proxy si pas Ahrefs** : Majestic Fresh Index, ou Semrush Backlink Analytics.

**Fréquence** : mensuelle.

**Leviers Q3** : 3 articles invités (Maddyness / FrenchWeb / blog partenaire) + listing BPI / CCI Île-de-France.

---

### KPI-17 — Score D-Ops console admin (/1000)

**Grille D-Ops 12 critères** (extrait audit P5) :

| Critère                    | Poids | Baseline |
| -------------------------- | ----- | -------- |
| Vue globale campaigns      | 100   | 70       |
| Éditeur articles inline    | 80    | 40       |
| Dashboard KPIs temps réel  | 100   | 60       |
| Wizard campagne (UX)       | 80    | 65       |
| Prefill intelligent        | 70    | 55       |
| Monitoring workers BullMQ  | 80    | 60       |
| Gestion KB verticales      | 80    | 35       |
| Qualité-gate visualisation | 80    | 50       |
| Alertes anomalies          | 70    | 40       |
| Export/rapports            | 60    | 30       |
| Audit trail actions        | 80    | 68       |
| UX mobile admin            | 20    | 10       |

**Score actuel** : 583/1000 (légère révision baseline après audit précis).

**Progression** :

- Q3 →700 : KPIs temps réel + monitoring workers amélioré + wizard UX
- Q4 →800 : KB management UI + éditeur inline + prefill V2
- Q1 →880 : alertes auto + export rapports + audit trail complet
- Q2 →950 : mobile admin + polish UX + intégration GSC dashboard

---

### KPI-18 — Satisfaction Will (NPS qualitatif)

**Méthode** : évaluation subjective Will post-sprint sur 3 dimensions :

1. **Fiabilité** : pipeline tourne sans intervention manuelle (3.5 pts)
2. **Qualité output** : articles publiés correspondent aux attentes éditoriales (3.5 pts)
3. **Vélocité** : cadence articles conforme aux objectifs déclarés (3 pts)

**Score** : /10 déclaratif, collecté en début de session sprint review.

**Progression attendue** :

- Q3 →8.0 : pipeline stable + AI Act compliant + GSC connecté
- Q4 →8.5 : 150 villes + campagnes autonomes + dashboard complet
- Q1 →9.0 : 5 KB verticales + AIO citations mesurées + console 880
- Q2 →9.5 : objectif 80K articles atteint + audit 2027 lancé

**Alerte** : score < 7 sur 2 sprints consécutifs → retrospective P0 immédiate.

---

## Récapitulatif progression globale

| Trimestre | Fin        | Articles cumulés | Impressions/mois | Score /5000 | Compliance AI Act          |
| --------- | ---------- | ---------------- | ---------------- | ----------- | -------------------------- |
| Baseline  | 2026-05-22 | ~100             | ~5 000           | 3 715       | 95%                        |
| Q3 2026   | 2026-08-22 | ~2 800           | ~50 000          | ~4 100      | **100%** (deadline légale) |
| Q4 2026   | 2026-11-22 | ~11 800          | ~250 000         | ~4 250      | 100%                       |
| Q1 2027   | 2027-02-22 | ~38 800          | ~800 000         | ~4 400      | 100%                       |
| Q2 2027   | 2027-05-22 | ~84 800          | ~2 000 000       | ~4 500      | 100%                       |

---

## Risques et hypothèses

### Hypothèses critiques

1. **Indexation Google** : hypothèse que Google indexe ~65% du contenu à Q3 — fortement dépendant de l'autorité domaine acquise. Si indexation < 40% → réviser cibles impressions à la baisse ×2.
2. **Pas de pénalité Google** : production à 500 art/j sans pénalité thin content. Mitigation : gate qualité ≥ 6.0/10 strict (D-P5-2), SimHash doublons, diversification angles.
3. **AI Act deadline** : 2026-08-02 est une contrainte légale hard — la cible 100% compliance Q3 est non-négociable.
4. **Infrastructure workers** : montée 30→500 art/j nécessite scaling horizontal BullMQ (min 3 workers gen + 2 workers publish à Q2).
5. **LLM pricing** : basé sur Anthropic Sonnet 4.6 tarifs actuels. Variation > 30% prix → réviser CPA cibles.

### Risques classés par impact

| Risque                         | Probabilité | Impact    | Mitigation                                                |
| ------------------------------ | ----------- | --------- | --------------------------------------------------------- |
| Google spam filter déclenché   | Moyen       | Très fort | Gate qualité strict + diversité angles + ramp progressive |
| AI Act non-compliant à J+72    | Faible      | Très fort | Track D11 DPA + promptHash audit hebdo                    |
| Workers OOM sous charge        | Moyen       | Fort      | Scale horizontal + RAM monitoring + job batching          |
| LLM hallucination non détectée | Faible      | Fort      | LLM-judge double-pass + fact-check gate                   |
| Coût LLM dérive > $2K/mois     | Faible      | Moyen     | CPA monitoring quotidien + alert threshold                |
| GSC service account bloqué     | Faible      | Moyen     | API key rotation + fallback UI manuel                     |

---

## Dashboard recommandé — vue admin

**Page** : `/[locale]/(admin)/[adminPrefix]/content-gen/kpis`

**Widgets suggérés** :

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  Articles publiés   │  Impressions GSC    │  Score pipeline     │
│  84 823 / 84 800 ✅ │  1.98M / 2M 🟡      │  4 487 / 5000 ✅    │
│  Cible Q2 2027      │  Cible Q2 2027      │  Cible Q2 2027      │
└─────────────────────┴─────────────────────┴─────────────────────┘
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  AI Act compliance  │  REJECT rate (7j)   │  CPA LLM            │
│  100% ✅            │  3.1% ✅            │  $0.041 ✅          │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

---

## Revue trimestrielle — checklist

**Fréquence** : audit complet tous les 3 mois (dates : 2026-08-22, 2026-11-22, 2027-02-22, 2027-05-22)

- [ ] Mettre à jour baselines réelles (SQL + GSC export)
- [ ] Comparer vs cibles trimestrielles → delta ± %
- [ ] Identifier KPIs décrochés (> -20% vs cible)
- [ ] Réviser cibles suivantes si contexte changé (Google algo update, pricing LLM, décision business)
- [ ] Produire rapport diff `A6-08-kpis-12mois-vQ{N}.md`
- [ ] Valider avec Will lors du sprint review trimestriel

---

_Agent A6-08 — Audit ONLY — 2026-05-22_  
_Prochain audit trimestriel : 2026-08-22_
