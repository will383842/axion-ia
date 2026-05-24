# ROADMAP 60J — Sprint B (J31-J60)

## Date : 2026-05-22 | Score entrant : ~3840/5000 | Score sortant estimé : ~3940-3970/5000

---

### Objectif sprint

Après la consolidation opérationnelle du Sprint A (J0-J30), le Sprint B monte en puissance sur la
visibilité (Featured Snippets), la qualité éditoriale (prompts partials verticaux), la feedback loop
(ArticleFeedback), l'observabilité (Logs viewer) et l'acquisition locale (adresse FR).

Gain cible : **+100 à +130 pts** pour atteindre ~3940-3970/5000.

---

### Items inclus

| #   | Item                                                       | Dimension | Effort Claude   | Effort Will    | Gain pts                  | Coût $         | Dépendances                   |
| --- | ---------------------------------------------------------- | --------- | --------------- | -------------- | ------------------------- | -------------- | ----------------------------- |
| A   | comparison.ts Featured Snippets (Q-A pairs + tableaux)     | D-Visi    | 4h              | 30 min         | +30                       | ~$0            | Aucune                        |
| B   | Prompts partials `_vertical-{v}.ts` (4 verticales)         | D-Qual    | 8h              | 1h review      | +20                       | ~$0            | KB verticales J0-J30          |
| C   | Feedback ArticleFeedback model + UI (pouce haut/bas)       | D-Ops     | 6h              | 30 min         | +20                       | ~$0            | Aucune                        |
| D   | Logs viewer admin (BullMQ job logs paginés)                | D-Ops     | 5h              | 0              | +15                       | ~$0            | Aucune                        |
| E   | Heatmap France couverture articles par ville               | D-Ops     | 8h              | 30 min         | +15                       | ~$0            | Tableau croisé J0-J30         |
| F   | Adresse FR domiciliation (Will — action externe)           | D-Visi    | 0               | 1h (démarches) | +10                       | ~$30/mois      | Aucune                        |
| G   | Mini-audit qualité intermédiaire (10 articles échantillon) | D-Qual    | 3h              | 30 min         | +10                       | ~$2            | 30+ articles générés          |
| H   | Rampe 30→100 art/j (config MAX_PUBLISH, BullMQ)            | D-Etat    | 30 min (config) | 30 min         | +0 (compte sur volume Q3) | $270/trimestre | CampaignTemplate opérationnel |

---

### Planning semaines

#### Semaine 5 (J31-J37) — Visibilité & Qualité

- **J31-J32** : comparison.ts Featured Snippets (A) — générateur complet avec extraction Q-A, tableaux comparatifs, structured data HowTo/FAQ
- **J33-J36** : Prompts partials `_vertical-{v}.ts` × 4 (B) — un fichier partiel par verticale injectant le contexte métier dans tous les générateurs
- **J37** : Will review prompts + test génération 5 articles par verticale

Sous-total S5 : **+50 pts** (D-Visi +30, D-Qual +20)

#### Semaine 6 (J38-J44) — Feedback loop & Observabilité

- **J38-J41** : ArticleFeedback model Prisma + migration + API PATCH + composant UI sidebar article (C)
- **J42-J44** : Logs viewer admin — pagination BullMQ logs, filtre par worker/statut/date, export CSV (D)

Sous-total S6 : **+35 pts** (D-Ops +35)

#### Semaine 7 (J45-J51) — Heatmap + Audit intermédiaire

- **J45-J50** : Heatmap France (E) — SVG départements + intensité couverture par articles publiés, filtre par verticale, export PNG
- **J51** : Mini-audit qualité 10 articles échantillon (G) — LLM-judge score moyen, détection dérives, rapport markdown

Sous-total S7 : **+25 pts** (D-Ops +15, D-Qual +10)

#### Semaine 8 (J52-J60) — Adresse FR + Rampe

- **J52-J54** : Will — démarches adresse domiciliation Paris (F) : signer contrat WeWork ou équivalent ~$30/mois
- **J55** : Config MAX_PUBLISH → 100 art/j + vérif BullMQ concurrency (H)
- **J56-J57** : Tests charge génération 100 art/j en staging (1 journée de run)
- **J58-J60** : Ajustements post-test + monitoring Sentry workers

Sous-total S8 : **+10 pts** (D-Visi +10)

---

### Coût total sprint

| Poste                                                    | Montant        |
| -------------------------------------------------------- | -------------- |
| Tokens Claude (dev)                                      | ~$5-10         |
| Génération articles 100 art/j × 30j = 3000 articles (Q3) | ~$300          |
| Adresse domiciliation (Will)                             | ~$90 (3 mois)  |
| Mini-audit qualité LLM-judge                             | ~$2            |
| Infra (VPS existant)                                     | $0 incrémental |
| **Total sprint J31-J60**                                 | **~$400-405**  |

---

### Score estimé post-sprint

| Dimension | Avant     | Après     | Delta                                |
| --------- | --------- | --------- | ------------------------------------ |
| D-Etat    | ~803      | ~803      | +0 (volume compte Q3 non évalué ici) |
| D-Archi   | ~816      | ~816      | +0                                   |
| D-Visi    | ~782      | ~822      | +40                                  |
| D-Qual    | ~799      | ~829      | +30                                  |
| D-Ops     | ~640      | ~690      | +50                                  |
| **TOTAL** | **~3840** | **~3960** | **+120**                             |

> Fourchette optimiste (adresse J52, heatmap complète) : **~3970/5000**
> Fourchette conservatrice (heatmap partielle, adresse J61) : **~3930/5000**

---

### Risques

| Risque                                                    | Probabilité | Mitigation                                                             |
| --------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- |
| comparison.ts non indexé Google (Featured Snippets lents) | Haute       | Intégrer IndexNow immédiat + ping GSC dès publication                  |
| ArticleFeedback peu utilisé (0 trafic organique J31)      | Moyenne     | Utiliser en interne pour audit qualité — valeur même sans utilisateurs |
| Adresse domiciliation délai administratif                 | Moyenne     | WeWork Paris : activation J+2 max — prévoir J52 pour signature         |
| Rampe 100 art/j dépasse coût projeté                      | Faible      | Stop-loss : si $400 tokens/mois, revenir à 60/j                        |
| Logs viewer performance (BullMQ 100k jobs)                | Faible      | Pagination 50 items + index Redis TTL 7j                               |

---

### Dépendances inter-sprints

```
Sprint A (J0-J30)
  └─ KB verticales → Prompts partials _vertical-{v}.ts (item B)
  └─ Tableau croisé → Heatmap France (item E)
  └─ CampaignTemplate → Rampe 100 art/j (item H)
```
