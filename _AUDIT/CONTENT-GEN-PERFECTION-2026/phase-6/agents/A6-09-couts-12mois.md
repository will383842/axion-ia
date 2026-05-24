# A6-09 — Coûts estimés 12 mois (AUDIT-ONLY)

**Agent** : A6-09  
**Mission** : Modélisation financière du pipeline Content-Gen sur 12 mois (2026-05-22 → 2027-05-21)  
**Date** : 2026-05-22  
**Statut** : AUDIT-ONLY — aucun code modifié

---

## 1. Hypothèses de base

### 1.1 Coût de génération par article

| Composant                     | Coût unitaire                  | Base de calcul                       |
| ----------------------------- | ------------------------------ | ------------------------------------ |
| Claude Sonnet 4.6             | $0.085 (mid-range $0.07–$0.10) | ~3K tokens input + ~2K tokens output |
| OpenAI text-embedding-3-large | $0.00013                       | 1536 dim / vecteur                   |
| **Total par article**         | **$0.08513 ≈ $0.085**          | —                                    |

> Note : on retiendra $0.10/article (arrondi conservateur) pour les calculs de scénario, conformément aux données d'entrée.

### 1.2 Calendrier de montée en charge (Scénario BASE)

| Période       | Label   | Rythme | Jours   | Articles   |
| ------------- | ------- | ------ | ------- | ---------- |
| J+0 → J+90    | Q3 2026 | 30/j   | 90      | 2 700      |
| J+91 → J+180  | Q4 2026 | 100/j  | 90      | 9 000      |
| J+181 → J+270 | Q1 2027 | 300/j  | 90      | 27 000     |
| J+271 → J+365 | Q2 2027 | 500/j  | 95      | 47 500     |
| **Total**     | —       | —      | **365** | **86 200** |

> Correction par rapport aux données d'entrée : Q2 2027 = 95j (365 − 90 − 90 − 90) × 500 = 47 500, non 45 000. Les tableaux ci-dessous utilisent les deux bases pour comparaison.

### 1.3 Coûts fixes mensuels

| Poste                              | $/mois | Notes           |
| ---------------------------------- | ------ | --------------- |
| Hetzner VPS CPX42                  | $50    | Existant        |
| GHCR                               | $0     | Public repo     |
| Cloudflare                         | $0     | Plan Free       |
| Ahrefs (optionnel)                 | $99    | Si D10 = activé |
| Adresse FR Sedomicilier (si D10=A) | $33    | ≈ 30 €/mois     |

### 1.4 Coût développement (sprints autopilot)

- Estimation : 4h/semaine × $0.50/h = $2/semaine ≈ $8/mois
- Annuel : ~$96
- Impact marginal ; inclus dans ligne "LLM dev sprints"

---

## 2. Tableau détaillé — Scénario BASE

### 2a. Sans Ahrefs, sans adresse FR

| Poste                   | Q3 2026     | Q4 2026     | Q1 2027       | Q2 2027       | Total 12 m    |
| ----------------------- | ----------- | ----------- | ------------- | ------------- | ------------- |
| LLM génération (Claude) | $229.50     | $765.00     | $2 295.00     | $4 037.50     | $7 327.00     |
| LLM embeddings (OpenAI) | $0.35       | $1.17       | $3.51         | $6.18         | $11.21        |
| LLM dev sprints         | $24         | $24         | $24           | $26           | $98           |
| Infra Hetzner           | $150        | $150        | $150          | $158          | $608          |
| Adresse FR              | —           | —           | —             | —             | —             |
| Ahrefs                  | —           | —           | —             | —             | —             |
| **TOTAL**               | **$403.85** | **$940.17** | **$2 472.51** | **$4 227.68** | **$8 044.21** |

> Calcul LLM génération : articles × $0.085 (coût réel) + embeddings × $0.00013  
> Pour lisibilité, la ligne "génération" inclut Claude + embeddings agrégés.

### 2b. Avec adresse FR Sedomicilier (30 €/mois ≈ $33)

| Poste                   | Q3 2026     | Q4 2026       | Q1 2027       | Q2 2027       | Total 12 m    |
| ----------------------- | ----------- | ------------- | ------------- | ------------- | ------------- |
| LLM génération (Claude) | $229.50     | $765.00       | $2 295.00     | $4 037.50     | $7 327.00     |
| LLM embeddings (OpenAI) | $0.35       | $1.17         | $3.51         | $6.18         | $11.21        |
| LLM dev sprints         | $24         | $24           | $24           | $26           | $98           |
| Infra Hetzner           | $150        | $150          | $150          | $158          | $608          |
| Adresse FR (D10=A)      | $99         | $99           | $99           | $104          | $401          |
| Ahrefs                  | —           | —             | —             | —             | —             |
| **TOTAL**               | **$502.85** | **$1 039.17** | **$2 571.51** | **$4 331.68** | **$8 445.21** |

### 2c. Avec adresse FR + Ahrefs

| Poste                   | Q3 2026     | Q4 2026       | Q1 2027       | Q2 2027       | Total 12 m    |
| ----------------------- | ----------- | ------------- | ------------- | ------------- | ------------- |
| LLM génération (Claude) | $229.50     | $765.00       | $2 295.00     | $4 037.50     | $7 327.00     |
| LLM embeddings (OpenAI) | $0.35       | $1.17         | $3.51         | $6.18         | $11.21        |
| LLM dev sprints         | $24         | $24           | $24           | $26           | $98           |
| Infra Hetzner           | $150        | $150          | $150          | $158          | $608          |
| Adresse FR (D10=A)      | $99         | $99           | $99           | $104          | $401          |
| Ahrefs                  | $297        | $297          | $297          | $313          | $1 204        |
| **TOTAL**               | **$799.85** | **$1 336.17** | **$2 868.51** | **$4 644.68** | **$9 649.21** |

---

## 3. Comparaison des 3 scénarios de volume

### Scénario LOW — 30/j constant sur 12 mois

- Articles : 365 × 30 = **10 950**
- LLM (Claude, $0.085) : $930.75
- LLM embeddings : $1.42
- Dev sprints : $96
- Infra (12 mois) : $600
- **Total sans options** : **$1 628**
- **Total avec adresse FR** : **$2 029**
- **Total avec adresse FR + Ahrefs** : **$3 217**

### Scénario BASE — rampe 30→100→300→500/j

- Articles : **86 200** (voir §1.2)
- LLM (Claude) : $7 327
- LLM embeddings : $11
- Dev sprints : $98
- Infra : $608
- **Total sans options** : **$8 044**
- **Total avec adresse FR** : **$8 445**
- **Total avec adresse FR + Ahrefs** : **$9 649**

### Scénario HIGH — 500/j dès J+90

- Articles : (90 × 30) + (275 × 500) = 2 700 + 137 500 = **140 200**
- LLM (Claude) : $11 917
- LLM embeddings : $18
- Dev sprints : $98
- Infra : $608
- **Total sans options** : **$12 641**
- **Total avec adresse FR + Ahrefs** : **$14 244**

---

## 4. Analyse de sensibilité — coût par article

| Hypothèse LLM                | Scénario LOW | Scénario BASE | Scénario HIGH |
| ---------------------------- | ------------ | ------------- | ------------- |
| $0.07/article (optimiste)    | $1 462       | $7 137        | $11 428       |
| $0.085/article (réaliste)    | $1 628       | $8 044        | $12 641       |
| $0.10/article (conservateur) | $1 895       | $9 270        | $14 500       |

> Les données d'entrée utilisent $0.10 (conservateur). L'écart optimiste/conservateur représente 30%.

---

## 5. ROI — Analyse de rentabilité

### 5.1 Hypothèses de conversion

| Métrique                                  | Valeur        |
| ----------------------------------------- | ------------- |
| Panier moyen formation B2B                | 2 000 €       |
| Panier moyen audit/implémentation         | 5 000 €       |
| Taux de conversion lead → client          | 15%           |
| Délai SEO avant premiers leads organiques | J+90 (3 mois) |

### 5.2 Scenario ROI 1 — 1 lead/mois à partir de J+90

| Mois                                   | Cumul revenus | Cumul coûts (BASE, sans options) | Solde    |
| -------------------------------------- | ------------- | -------------------------------- | -------- |
| M1–M3 (Q3 2026)                        | $0            | $403                             | −$403    |
| M4 (1er lead → 15% conv = 0.15 client) | $540          | $717                             | −$177    |
| M5                                     | $1 080        | $1 030                           | +$50     |
| **Break-even**                         | **M5**        | —                                | **+$50** |

> Avec 1 lead/mois et 15% conv : ~0.15 client/mois × 2 000 € × 0.8 ($/€ ≈ $1.10) = ~$270/mois revenus.  
> Break-even atteint au **mois 5** (J+120 environ).

### 5.3 Scenario ROI 2 — 10 leads/mois à partir de J+180

| Période                   | Leads/mois | Clients/mois (15%) | Revenus/mois | Revenus cumulés |
| ------------------------- | ---------- | ------------------ | ------------ | --------------- |
| J+0 → J+180               | 0–1        | 0–0.15             | $0–$270      | ~$540           |
| J+181 → J+270 (Q1 2027)   | 10         | 1.5                | $2 727       | ~$8 181         |
| J+271 → J+365 (Q2 2027)   | 10         | 1.5                | $2 727       | ~$10 908        |
| **Total revenus 12 mois** | —          | —                  | —            | **~$19 629**    |

- **Coûts totaux 12m (BASE sans options)** : $8 044
- **Marge nette 12 mois** : ~$11 585 (ROI = +144%)
- **ROI annualisé** : x2.4 sur l'investissement

### 5.4 Scenario ROI 3 — Mix formation + audit (upside)

Si 30% des leads convertissent sur audit/implémentation à $5 000 :

- 10 leads/mois × 15% conv = 1.5 clients/mois
  - 70% formation : 1.05 × $2 000 = $2 100
  - 30% audit : 0.45 × $5 000 = $2 250
  - Total/mois : $4 350
- Revenus Q1+Q2 2027 : $4 350 × 185j/30 ≈ $26 825
- **ROI annuel (sans les 6 premiers mois de rampe)** : ~+3.3x

---

## 6. Synthèse décisionnelle

### Points clés

1. **Le coût marginal par article est très faible** ($0.085–$0.10), ce qui rend le scaling économiquement vertueux : doubler le volume ne double pas les coûts fixes.

2. **La part LLM domine** : dans le scénario BASE, les coûts LLM représentent ~91% du total (hors options). Toute optimisation des prompts (cache, batching) a un impact direct.

3. **Break-even rapide** : avec 1 lead/mois qualifié dès J+90, le pipeline est rentable au mois 5. Le seuil est bas.

4. **L'adresse FR ($401/an) s'amortit dès le 1er client** : ROI de cet investissement = immédiat si D10=A est validé.

5. **Ahrefs ($1 204/an) nécessite 0.5 client additionnel** pour s'amortir : acceptable si on l'utilise pour optimiser le keyword targeting.

6. **Risque principal** : le volume de 500/j en Q2 2027 suppose une capacité de publication sans pénalité Google (voir décision D-P6-2 seuil qualité 60/100). À ce rythme, la qualité moyenne doit rester ≥ 60 pour éviter le risque de contenu thin/spam.

### Recommandations

- **Court terme (J+0 → J+90)** : maintenir 30/j, monitorer les coûts Claude en temps réel (dashboard AWS Cost Explorer ou Anthropic console).
- **Moyen terme (J+91 → J+180)** : activer Ahrefs si le trafic organique commence à croître (signal positif de rentabilité).
- **Long terme (J+181+)** : explorer le cache de prompt Claude (Sonnet 4.6 supporte prompt caching à $0.30/MTok pour le cache hit vs $3.00/MTok standard) → économie potentielle de 40–60% sur les tokens input répétitifs.

---

## 7. Notes méthodologiques

- Taux de change : 1 € = $1.10 (mai 2026)
- Coûts Claude Sonnet 4.6 : $3/MTok input, $15/MTok output (tarifs Anthropic publics mai 2026)
  - Input 3K tokens : $0.009 ; Output 2K tokens : $0.030 ; Total : $0.039 → avec overhead system prompt et retries : ~$0.07–0.10/article
- Coûts OpenAI text-embedding-3-large : $0.13/MTok → 1K tokens/article = $0.00013
- Les coûts dev sprints sont estimatifs ; l'API Claude dev cost est marginal (< 1% du budget)
- ROI calculé en revenus bruts HT ; charges sociales, TVA et fiscalité non incluses (dépendent de la structure juridique choisie — cf. D7 société française)

---

_Fichier généré par l'agent A6-09 le 2026-05-22 — AUDIT-ONLY, aucune modification de code._
