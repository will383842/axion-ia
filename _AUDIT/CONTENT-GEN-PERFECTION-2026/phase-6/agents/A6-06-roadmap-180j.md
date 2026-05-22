# ROADMAP 180J — Sprint D (J91-J180)
## Date : 2026-05-22 | Score entrant : ~4049/5000 | Score sortant estimé : ~4215-4315/5000

---

### Objectif sprint

Trimestre de l'accélération : scale 100→300 art/j, bilingue EN si décision D14=oui, audit
content-gen intermédiaire pour évaluer la trajectoire GO (4500), consolidation D-Visi via
backlinks trimestriel et vérification post-deadline AI Act.

Gain cible : **+150 à +200 pts** pour atteindre ~4215-4315/5000.

---

### Items inclus

| # | Item | Dimension | Effort Claude | Effort Will | Gain pts | Coût $ | Dépendances |
|---|------|-----------|---------------|-------------|----------|--------|-------------|
| A | Audit content-gen intermédiaire (40 agents // ~Phase 1.5) | Toutes | 6h | 2h | +0 (mesure) | ~$10 | 3000+ articles publiés |
| B | Bilingue EN sprint S+7 (si D14=oui) | D-Etat | 30h | 4h | +15 | ~$30 dev | Bug next-intl fixé ou contourné |
| C | Scale 100→300 art/j (config + BullMQ workers ×3) | D-Etat | 3h | 1h | +20 | $900/trimestre | Infra stable 100/j confirmée |
| D | Backlinks trimestriel #1 (outreach × 10 cibles) | D-Visi | 8h (copy) | 5h | +20 | ~$0 | GBP actif + contenu live |
| E | Vérification post-deadline AI Act (check audit) | D-Archi | 2h | 30 min | +5 | ~$1 | Deadline J72 passée |
| F | Audit qualité #3 (200 articles, LLM-judge) | D-Qual | 6h | 1h | +20 | ~$20 | 3000+ articles publiés |
| G | Optimisation prompts post-audit #3 | D-Qual | 6h | 1h | +20 | ~$0 | Audit qualité #3 (item F) |
| H | GBP posts hebdomadaires automatisés (RSS → GBP API) | D-Visi | 4h | 30 min | +10 | ~$0 | GBP actif (J61-J90) |
| I | Featured Snippets monitoring (GSC clicks position 0) | D-Visi | 3h | 0 | +10 | ~$0 | GSC service account actif |
| J | CampaignTemplate V2 (presets sectoriels + sous-verticales) | D-Ops | 6h | 1h | +15 | ~$0 | CampaignTemplate V1 |
| K | Rapports hebdomadaires enrichis (D-W1 metrics) | D-Ops | 3h | 0 | +10 | ~$0 | Rampe 300/j active |
| L | Scale infra si nécessaire (VPS upgrade ou workers distrib.) | D-Ops | 2h (config) | 2h | +0 (prérequis) | ~$50/mois | Charge 300/j confirmée |

---

### Planning par mois

#### Mois 4 (J91-J120) — Audit intermédiaire + Scale 300/j

**J91-J97 : Audit content-gen intermédiaire (item A)**
- 40 agents parallèles : évaluation score toutes dimensions
- Rapport `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/agents/A6-AUDIT-INTERMEDIAIRE-J91.md`
- Score attendu confirmé ou révisé selon réalité terrain
- Décision : trajectoire GO J250 réaliste ou correctifs supplémentaires nécessaires

**J98-J105 : Scale 100→300 art/j (item C)**
- Config MAX_PUBLISH=300 progressif (100→150→200→300 sur 4 semaines)
- BullMQ workers concurrency ×3 (3 processeurs parallèles publish worker)
- Alertes Sentry seuil d'erreur + budget tokens cap mensuel

**J106-J120 : Backlinks trimestriel #1 (item D) + GBP posts auto (item H)**
- Identification 10 cibles backlinks Q3 : médias IA FR (siecledigital.fr, journaldunet.com, etc.) + RH/formation + tech
- Rédaction pitchs + articles guest posts × 5 (3h/article Claude)
- GBP RSS→Posts API : publication automatique 1 post/semaine depuis flux RSS articles

Sous-total Mois 4 : **+50 pts** (D-Etat +20, D-Visi +10, D-Ops +10, D-Archi +5 post-audit)

#### Mois 5 (J121-J150) — Bilingue EN + Qualité

**J121-J150 : Bilingue EN sprint S+7 — conditionnel D14=oui (item B)**

> Si D14=oui (réactivation locale EN) :
> - J121-J125 : Fix bug next-intl 307 self-loop (patch middleware ou upgrade)
> - J126-J135 : Génération articles EN via traduction automatique (générateurs bilingues)
> - J136-J140 : Hreflang EN correctif + sitemaps EN
> - J141-J145 : Test QA locale EN (10 URLs clés)
> - Gain : **+15 pts D-Etat**

> Si D14=non (EN localisé reste désactivé) :
> - Effort réalloué sur optimisation générateurs existants (+10 pts D-Qual)

**J121-J150 (en parallèle ou si D14=non) : Audit qualité #3 (item F) + optimisation prompts (item G)**
- LLM-judge 200 articles : score moyen cible > 72/100
- Identification patterns d'erreur (hallucinations, répétitions, ton)
- Mise à jour prompts partials `_vertical-{v}.ts` + générateurs affectés

Sous-total Mois 5 : **+35-50 pts** (D-Etat +0-15, D-Qual +35-40)

#### Mois 6 (J151-J180) — Visibilité avancée + Featured Snippets

**J151-J160 : Featured Snippets monitoring (item I) + CampaignTemplate V2 (item J)**
- GSC API : extraction clicks positions 0-3, identification URLs comparison.ts performantes
- Rapport hebdomadaire enrichi avec métriques Featured Snippets
- CampaignTemplate V2 : 3 nouveaux presets (landing secteur + FAQ sous-verticale + cas concret multi-ville)

**J161-J170 : Backlinks trimestriel #1 suivi (item D suite)**
- Relances guest posts en attente
- Publication des articles acceptés
- Mesure impact DA/DR domaines référents (ahrefs ou équivalent)

**J171-J180 : Infra scale + Rapports enrichis (items K, L)**
- Si charge 300/j stable × 30j : validation infra OK
- Si peak RAM > 12 GB : évaluation upgrade CPX52 Hetzner (~$60/mois)
- Rapports hebdomadaires V2 : métriques D-W1 (articles/j, score qualité moyen, GSC impressions)

Sous-total Mois 6 : **+65-100 pts** (D-Visi +30, D-Ops +25, D-Qual +10)

---

### Coût total sprint

| Poste | Montant |
|-------|---------|
| Tokens Claude (dev / audits / backlinks copy) | ~$30-50 |
| Génération articles 300 art/j × 90j = 27 000 articles (Q4) | ~$2 700 |
| Audit qualité #3 LLM-judge 200 articles | ~$20 |
| Audit intermédiaire 40 agents | ~$10 |
| Bilingue EN dev (si D14=oui) | ~$30 |
| Infra upgrade si nécessaire | ~$0-150 (3 mois delta) |
| **Total sprint J91-J180** | **~$2 800-2 960** |

> Note : Le coût dominant est la génération à 300/j. Budget tokens Q4 = $900 sur 3 mois
> (27k articles × $0.10/article). Vérifier avec cap mensuel BullMQ.

---

### Score estimé post-sprint

| Dimension | Avant | Après | Delta |
|-----------|-------|-------|-------|
| D-Etat | ~803 | ~838 | +35 (scale 300/j + EN si D14=oui) |
| D-Archi | ~831 | ~836 | +5 (vérif AI Act) |
| D-Visi | ~857 | ~897 | +40 (backlinks + GBP + Featured Snippets) |
| D-Qual | ~844 | ~904 | +60 (audit #3 + optimisation prompts) |
| D-Ops | ~716 | ~776 | +60 (CampaignTemplate V2 + rapports + scale) |
| **TOTAL** | **~4049** | **~4251** | **+202** |

> Fourchette optimiste (D14=oui, backlinks acceptés, qualité > 75/100) : **~4315/5000**
> Fourchette conservatrice (D14=non, backlinks lents) : **~4200/5000**

---

### Gate GO intermédiaire J91

L'audit intermédiaire J91 donne un signal précis sur la trajectoire GO (4500) :

| Score J91 | Interprétation | Action |
|-----------|----------------|--------|
| > 4200 | Trajectoire GO J250 confirmée | Continuer roadmap as-is |
| 4100-4200 | GO J270-J280 légèrement décalé | Accélérer backlinks + prompts |
| < 4100 | Écart plus grand qu'anticipé | STOP & ASK Will — Sprint correctif prioritaire |

---

### Risques

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Scale 300/j dépasse budget tokens ($1000+/mois) | Faible | Cap BullMQ strict + alert Sentry si > $800/mois |
| Bilingue EN bug next-intl non résolu J121 | Moyenne | Reporter à J181+ si fix pas disponible |
| Audit intermédiaire révèle score < 3900 | Faible | Sprint correctif J91-J105 prioritaire avant scale |
| Backlinks très lents (délai publication 3+ mois) | Haute | Prévoir 6 mois pour voir impact DA — normal |
| GBP posts API quota dépassé | Faible | 1 post/semaine = 4/mois bien en dessous quota 10/j |

---

### Dépendances inter-sprints

```
Sprint C (J61-J90)
  └─ GBP actif → GBP posts auto (item H)
  └─ Adresse FR → Backlinks locaux (item D)
  └─ AI Act J72 → Vérification post-deadline (item E)
  └─ Rampe 100/j stable → Scale 300/j (item C)

Sprint B (J31-J60)
  └─ CampaignTemplate V1 → CampaignTemplate V2 (item J)
  └─ Adresse FR → Backlinks (item D)

Décision externe
  └─ D14 (Will) → Bilingue EN sprint (item B)
```
