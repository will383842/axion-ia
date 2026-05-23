# A6-02 — Gaps au seuil GO + Top 30 items rentables
## Date: 2026-05-22 | Score prod (origin/main e573da64): 3638/5000 | Gap GO: 862 pts
## Agent: A6-02 (AUDIT-ONLY — zéro commit, zéro modif code)
## Note: Score avec commits locaux non pushés = 3805/5000 (gap 695 pts) — push urgent recommandé

---

## 1. Analyse gaps par dimension

### Scores prod (origin/main e573da64 — sans commits locaux)

| Dimension | Score prod | Score GO cible | Gap prod | Difficulté | Levier principal |
|---|---|---|---|---|---|
| D-Ops | 580/1000 | 900 | **320** | Moyen | Console admin : CampaignTemplate, SSE, tableau croisé ville |
| D-Qual | 770/1000 | 900 | **130** | Moyen | KB 4 verticales, LLM-judge seuil, Featured Snippets |
| D-Visi | 778/1000 | 900 | **122** | Moyen-haut | GBP + adresse FR, Featured Snippets, backlinks |
| D-Archi | 796/1000 | 900 | **104** | Bas | lockDuration publish-worker, saga verification |
| D-Etat | 795/1000 | 900 | **105** | Bas | Wizard 5 étapes (commits locaux à pusher) |
| **TOTAL** | **3719/5000** | **4500** | **781** | | |

> Note : Les scores par dimension ci-dessus sont légèrement différents des scores cross-cutting (D-Ops 619, etc.) car le CROSS-CUTTING intègre les commits locaux non pushés (+167 pts). Les scores "prod pur" sont calculés depuis origin/main e573da64 seulement.

### Récapitulatif simplifié (scores prod retenus pour cet audit)

| Dimension | Score retenu | Gap |
|---|---|---|
| D-Etat | 795/1000 | 105 |
| D-Archi | 796/1000 | 104 |
| D-Visi | 778/1000 | 122 |
| D-Qual | 770/1000 | 130 |
| D-Ops | 580/1000 | 320 |
| **TOTAL** | **3719/5000** | **781** |

> Avec les commits locaux pushés (+167 pts) : 3805+195 pts d'actions immédiates = GO J+250 réaliste.

---

## 2. Méthodologie de calcul ROI

**ROI = gain estimé (pts) / effort Claude (heures)**

- Les gains sont estimés à partir des verdicts officiels P1→P5 et P6
- Les items "Levier Will" (sans code) sont listés séparément (section 5)
- Les exclusions Will (Wikidata, DPA Anthropic) ne figurent pas dans les calculs

---

## 3. Top 30 items — Triés par ROI décroissant

| # | Item | Dim | Gain pts estimé | Effort Claude (h) | Effort Will | Dépendances | ROI (pts/h) |
|---|---|---|---|---|---|---|---|
| 1 | `lockDuration` fix content-publish-worker (10 min) | D-Archi | +10 | 0.17h | 0 | Aucune | **58.8** |
| 2 | CTA "Nouvelle campagne" terracotta #c24a1b persistant toutes sous-pages | D-Ops | +15 | 1h | 0 | CSS admin-v2 | **15.0** |
| 3 | P0-2 lockDuration fix quality-improver-worker (10 min) | D-Archi | +10 | 0.17h | 0 | Aucune | **58.8** |
| 4 | AuthorByline EEAT sur pages restantes (cas-concrets, landing) | D-Visi | +8 | 1h | 0 | Composant existant | **8.0** |
| 5 | P0-7 Telegram webhook REJECT-P0 (alerte rejet immédiat) | D-Qual | +8 | 1h | Bot token actif | Aucune | **8.0** |
| 6 | git push origin main (commits 023266f9 + 5d8e8b6f + 7236dfd0) | D-Etat/D-Archi/D-Ops | +167 | 0h | 0.01h (30 sec) | Aucune | **~infini** |
| 7 | Coolify env var `WEEKLY_REPORT_EMAIL` (active weekly-report D-P5-3) | D-Ops | +20 | 0h | 0.25h (15 min) | Worker déjà codé | **~infini** |
| 8 | Progress bars visuelles CoverageDetailV2 (articles/cap + ETA velocity) | D-Ops | +17 | 2h | 0 | Compteurs DB | **8.5** |
| 9 | Export CSV tableau croisé ville × type | D-Ops | +10 | 2h | 0 | Tableau croisé (item 16) | **5.0** |
| 10 | Alert badge sidebar dynamique (anomaly detection batch) | D-Ops | +15 | 3h | 0 | ContentGenConfig clé alert_count | **5.0** |
| 11 | P0-5 / P1-9 Regroupement dashboard ≤7 liens (loi de Hick) | D-Ops | +10 | 2h | 0 | Aucune | **5.0** |
| 12 | Section campagnes actives sur dashboard (3-5 cartes running) | D-Ops | +15 | 3h | 0 | Prisma findMany running | **5.0** |
| 13 | MAX_PUBLISH_PER_DAY champ UI dédié BatchesV2 | D-Ops | +10 | 2h | 0 | Worker lit déjà depuis DB | **5.0** |
| 14 | Barre progression 39/120 villes (villes avec articles publiés vs cible) | D-Ops | +15 | 3h | 0 | Prisma groupBy anchorVilleSlug | **5.0** |
| 15 | P1-2 Validation post-LLM H1 gate (reject si H1 absent/dupliqué) | D-Qual | +10 | 2h | 0 | Aucune | **5.0** |
| 16 | P1-6 Tableau croisé ville × articles × verticale (groupBy anchorVilleSlug) | D-Ops | +25 | 6h | 0 | Campagnes actives en DB | **4.2** |
| 17 | Dashboard polling SSE 15s — compteurs BullMQ temps réel | D-Ops | +20 | 5h | 0 | Server Component → SSE | **4.0** |
| 18 | Onboarding wizard déclenché à 0 campagnes (redirection auto) | D-Ops | +8 | 2h | 0 | OnboardingV2 existe, non câblé | **4.0** |
| 19 | Mobile hamburger nav sidebar admin (responsive breakpoint) | D-Ops | +8 | 2h | 0 | CSS admin-v2 | **4.0** |
| 20 | KB seed script `seed-kb-facts.ts` — 4 verticales × 50 facts min | D-Qual | +25 | 7h | ~1h relecture facts | Verticales KB existantes | **3.6** |
| 21 | P1-5 ArticleFeedback thumbs up/down (schema + endpoint + UI) | D-Ops | +20 | 6h | 0 | schema.prisma ArticleFeedback absent | **3.3** |
| 22 | P1-1 6 CampaignTemplate presets en DB (schema + seed + UI cards) | D-Ops | +40 | 10h | 0 | schema.prisma CampaignTemplate absent | **4.0** |
| 23 | Featured Snippets prompt dédié comparison.ts (tableau HTML + réponse 40-50 mots) | D-Visi | +25 | 6h | Décision D22 (lever no-table gate comparison.ts) | comparison.ts existant | **4.2** |
| 24 | Sources externes ≥2 liens outbound dans articles blog (blog-article.ts prompt) | D-Visi | +8 | 2h | 0 | Aucune | **4.0** |
| 25 | Logs viewer admin (BullMQ job logs filtrable statut/campagne) | D-Ops | +15 | 5h | 0 | BullMQ API déjà intégré | **3.0** |
| 26 | FAQ structured data sur pages hors FAQ_GLOBAL (landing_ville, guides) | D-Visi | +10 | 3h | 0 | FAQPage JSON-LD existant sur /faq | **3.3** |
| 27 | GSC reporting intégration (service account JSON → indexation scores) | D-Ops | +25 | 8h | GSC JSON (30 min Will, item D11) | Service account actif | **3.1** |
| 28 | LLM-judge calibration vérification seuil 6.0/60 (D1=6.0 validé Will) | D-Qual | +20 | 7h | 0 | Seuil 60/100 déjà en DB | **2.9** |
| 29 | Reporting email hebdo lundi 8h (nodemailer + template résumé campagnes) | D-Ops | +15 | 5h | SMTP config Coolify (15 min) | WEEKLY_REPORT_EMAIL (item 7) | **3.0** |
| 30 | Coverage tests workers : +30% → 80% (quality-improver + fact-check) | D-Etat | +10 | 8h | 0 | Aucune | **1.25** |

---

## 4. Quick Wins (ROI > 5 pts/h, < 3h effort Claude)

Ces items représentent le meilleur ratio gain/effort et doivent être traités en **premier**.

| Rang ROI | Item | Dim | Gain pts | Effort Claude | ROI |
|---|---|---|---|---|---|
| 1 | git push origin main (sécurise +167 pts locaux) | Multi | +167 | 0h | infini |
| 2 | Coolify WEEKLY_REPORT_EMAIL (active worker) | D-Ops | +20 | 0h | infini (Will 15 min) |
| 3 | lockDuration content-publish-worker | D-Archi | +10 | 0.17h | **58.8** |
| 4 | P0-2 lockDuration quality-improver | D-Archi | +10 | 0.17h | **58.8** |
| 5 | CTA terracotta persistant | D-Ops | +15 | 1h | **15.0** |
| 6 | AuthorByline EEAT pages restantes | D-Visi | +8 | 1h | **8.0** |
| 7 | P0-7 Telegram REJECT-P0 webhook | D-Qual | +8 | 1h | **8.0** |
| 8 | Progress bars CoverageDetailV2 | D-Ops | +17 | 2h | **8.5** |
| 9 | Export CSV tableau croisé | D-Ops | +10 | 2h | **5.0** |
| 10 | Alert badge sidebar dynamique | D-Ops | +15 | 3h | **5.0** |

**Total Quick Wins 1-10 (hors push/SMTP) : +103 pts, ~11h Claude**
**Total avec push + SMTP : +290 pts, ~11h Claude + ~20 min Will**

---

## 5. Big Bets (gain > 30 pts, effort > 8h Claude)

| Item | Dim | Gain pts | Effort Claude | Notes |
|---|---|---|---|---|
| 6 CampaignTemplate presets en DB | D-Ops | +40 | 10h | Schema + seed + UI cards — meilleur gain absolu D-Ops |
| KB seed 4 verticales × 50 facts | D-Qual | +25 | 7h | Validation Will ~1h — débloque fact-check + KB search |
| GSC reporting intégration | D-Ops | +25 | 8h | Bloqué par D11 (service account JSON Will) |
| Tableau croisé ville × articles | D-Ops | +25 | 6h | Débloque aussi CSV export (+10 pts) en cascade |
| LLM-judge calibration seuil | D-Qual | +20 | 7h | D1=6.0/60 déjà validé Will |

**Total Big Bets : +135 pts, ~38h Claude**

---

## 6. Items dépendant d'actions Will (non code)

| Item Will | Gain pts | Effort Will | Notes |
|---|---|---|---|
| git push origin main | +167 | 30 sec | CRITIQUE — commits 023266f9, 5d8e8b6f, 7236dfd0 |
| Coolify env var `WEEKLY_REPORT_EMAIL` | +20 | 15 min | Active weekly-report D-P5-3 déjà codé |
| GSC service account JSON en Coolify (D11) | +7 | 30 min | Débloque GSC reporting (+25 pts code, item 27) |
| Décision D22 : lever no-table gate pour comparison.ts | +25 | 5 min | Débloque Featured Snippets (+25 pts code, item 23) |
| Adresse FR Sedomicilier 30€/mois (D10) | +7 | 30 min | Débloque GBP (+15 pts D-Visi) |
| GBP activation après adresse (D17) | +15 | 2h | Dépend D10 souscrite |
| SMTP Coolify (pour reporting hebdo, item 29) | +3 | 15 min | Variables SMTP_HOST/USER/PASS |
| **TOTAL Levier Will** | **+244 pts** | **~4h Will** | Dont 167 pts = push urgent |

---

## 7. Calcul trajectoire GO

### Situation de départ (prod origin/main e573da64)
- **Score prod** : 3638/5000
- **Seuil GO** : 4500/5000
- **Gap** : **862 points**

### Sprint A — Quick Wins + Architecture (J0-J30)
**Priorité : Push immédiat + items ROI > 5**

| Groupe | Items | Gain pts | Effort Claude | Effort Will |
|---|---|---|---|---|
| Push + Will immédiats | git push + SMTP + D11 + D22 | +214 | 0h | ~1h |
| Quick wins code (items 1-10 table) | lockDuration×2, CTA, AuthorByline, Telegram, Progress bars, Export CSV, Alert badge | +103 | 11h | 0 |
| Dashboard Ops mid (items 11-19) | Regroupement, Section actives, MAX_PUBLISH UI, Barre villes, H1 gate, Onboarding, Mobile | +86 | 17h | 0 |
| **Sous-total Sprint A** | **~20 items** | **+403 pts** | **28h** | **~1h** |

**Score estimé fin Sprint A : 3638 + 403 = ~4041/5000 — CONDITIONNEL**

### Sprint B — Big Items + Contenu (J31-J60)

| Groupe | Items | Gain pts | Effort Claude |
|---|---|---|---|
| KB seed 4 verticales | seed-kb-facts.ts | +25 | 7h |
| CampaignTemplate 6 presets | Schema + seed + UI | +40 | 10h |
| Featured Snippets comparison.ts (si D22=A) | Prompt tableau HTML | +25 | 6h |
| Tableau croisé ville × articles | groupBy anchorVilleSlug | +25 | 6h |
| ArticleFeedback thumbs up/down | Schema + endpoint + UI | +20 | 6h |
| Dashboard SSE 15s | Server Component → SSE | +20 | 5h |
| LLM-judge calibration | Seuil 6.0/60 vérification | +20 | 7h |
| Sources externes blog (≥2 liens) | Prompt update blog-article.ts | +8 | 2h |
| FAQ structured data landing/guides | FAQPage JSON-LD injection | +10 | 3h |
| GSC reporting (si D11 actif) | Service + dashboard widget | +25 | 8h |
| **Sous-total Sprint B** | **10 items** | **+218 pts** | **60h** |

**Score estimé fin Sprint B : 4041 + 218 = ~4259/5000 — CONDITIONNEL**

### Sprint C — GO Final (J61-J90)

| Groupe | Items | Gain pts | Effort Claude |
|---|---|---|---|
| Logs viewer admin | BullMQ UI filtrable | +15 | 5h |
| Reporting email hebdo | nodemailer + template | +15 | 5h |
| Coverage tests 80% | quality-improver + fact-check | +10 | 8h |
| GBP activation (si D10 actif) | JSON-LD Organisation + GBP | +15 | 2h |
| Backlinks #1 trimestriel (JDN/Frenchweb) | Article invité | +20 | 4h (rédaction) |
| Compliance AI Act J+72 check | Audit checklist | +10 | 3h |
| Structured data AEO Speakable + HowTo | Injection generators | +20 | 6h |
| Crawlability freshness (<24h sitemap) | Cron + ping | +15 | 4h |
| **Sous-total Sprint C** | **8 items** | **+120 pts** | **37h** |

**Score estimé fin Sprint C : 4259 + 120 = ~4379/5000 — CONDITIONNEL (proche GO)**

### Sprint D — GO Sécurisé (J91-J150)

| Groupe | Items | Gain pts | Effort Claude |
|---|---|---|---|
| Monitoring SLA workers (alertes 99.5%) | Webhook + dashboard | +15 | 6h |
| Internal links graph mesure ≥5/article | Compteur + rapport | +15 | 4h |
| Landing pages pSEO qualité tier-1 (10 pilotes) | Templates + génération | +20 | 8h |
| Coverage tests 90%+ E2E workers | Tests intégration | +15 | 12h |
| Dynamic OG image sociale | Génération serveur | +12 | 4h |
| Bilingue EN quality (si locale réactivée D14) | Generators EN | +25 | 20h |
| Tampon polish + corrections scoring | Misc | +20 | 10h |
| **Sous-total Sprint D** | **7 items** | **+122 pts** | **64h** |

**Score estimé fin Sprint D : 4379 + 122 = ~4501/5000 — GO 4500 atteint**

---

## 8. Récapitulatif effort total GO

| Sprint | Durée | Items | Gain pts | Effort Claude | Effort Will |
|---|---|---|---|---|---|
| Sprint A | J0-J30 | ~20 items | +403 | 28h | ~1h |
| Sprint B | J31-J60 | 10 items | +218 | 60h | ~1h |
| Sprint C | J61-J90 | 8 items | +120 | 37h | ~3h |
| Sprint D | J91-J150 | 7 items | +122 | 64h | ~2h |
| **TOTAL** | **~150 jours** | **~45 items** | **+863 pts** | **~189h Claude** | **~7h Will** |

**Score projeté : 3638 + 863 = 4501/5000 — GO atteint avec marge +1**

> Scénario pessimiste (−15% sur chaque gain) : 863 × 0.85 = ~733 pts → 4371/5000 — sous GO mais proche.
> Mitigation pessimiste : avancer 2-3 items Sprint D en Sprint C.

---

## 9. Analyse risques GO

### Risques principaux

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Commits locaux perdus avant push | Faible | Critique (-167 pts) | Push immédiat — 30 sec |
| D22 non tranchée → Featured Snippets bloqués | Moyen | -25 pts Sprint B | Will décide D22=A en J+3 |
| D10 non souscrite → GBP bloqué | Moyen | -15 pts | Sedomicilier ~30€/mois, J+30 |
| AI Act deadline J+72 (2026-08-02) | Certain | Compliance légal | Audit checklist Sprint C — conforme actuellement |
| Scale >100/j HCU Google | Faible | -30 pts D-Visi | Rampe manuelle D8=C, GSC weekly |

### Dépendance critique sprint A

Le Sprint A est quasi-indépendant et réalisable sans aucune décision Will bloquante (hors push + 15 min SMTP). C'est le principal avantage de la trajectoire proposée : +403 pts en J+30 sans blocage.

---

## 10. Nouvelles découvertes P6.1 (intégrées dans ce rapport)

Ces items n'étaient pas dans l'analyse P6 originale (2026-05-21) :

### D-C2 — lockDuration absent content-publish-worker.ts
- Risque double-ping IndexNow si worker stalle
- Fix : 10 min, +10 pts D-Archi
- **Intégré** : item #1 dans Top 30 (ROI 58.8)

### D-C3 — SMTP Coolify manquant pour weekly-report
- Worker codé mais ne peut pas envoyer en prod
- Fix : 15 min Will, +20 pts D-Ops
- **Intégré** : item #7 "Levier Will" (ROI infini)

### D-C4 — Featured Snippets vs no-table gate incompatibles
- comparison.ts hard-gate incompatible avec tableaux HTML
- Décision D22 requise (lever gate comparison.ts uniquement)
- **Intégré** : item #23 dépendant D22 Will

### D-C5 — Commits locaux non pushés (167 pts à risque)
- 3 commits (023266f9, 5d8e8b6f, 7236dfd0) non sur origin/main
- **Intégré** : item #6 "push git" ROI infini, action urgente

---

## 11. Résumé exécutif — 5 lignes Will

1. **Gap GO** : 862 pts (score prod 3638/5000, seuil 4500) — avec push immédiat des commits locaux → gap réduit à 695 pts en 30 secondes.
2. **Quick Win #1** : `git push origin main` + `WEEKLY_REPORT_EMAIL` Coolify → +187 pts, effort Will < 20 min total.
3. **Principal levier** : D-Ops (580/1000) avec CampaignTemplate, tableau croisé, SSE, ArticleFeedback — 10 items pour +218 pts Sprint B.
4. **GO estimé** : Sprint A (J+30, 28h Claude) → 4041 pts, Sprint B (J+60) → 4259 pts, Sprint D (J+150) → 4501 pts GO.
5. **Risque unique critique** : commits locaux non pushés (167 pts en attente) — action urgente avant tout autre travail.

---

*A6-02 — Analyse Gaps & GO — Axion-IA Content-Gen Perfection 2026*
*Généré le 2026-05-22 — Claude Sonnet 4.6 — AUDIT-ONLY — Zéro commit — Zéro modif code*
*Remplace version du 2026-05-21 (score 3598/902 pts) — corrigé : 3638/862 pts*
