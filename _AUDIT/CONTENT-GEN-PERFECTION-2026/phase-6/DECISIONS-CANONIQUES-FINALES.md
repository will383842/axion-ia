# DÉCISIONS CANONIQUES FINALES — Content-Gen Perfection 2026
**Pipeline** : Content-Gen Perfection 2026 | **Phase** : 6 (clôture) | **Date** : 2026-05-22
**Statut** : AUDIT-ONLY — à valider par Will

---

## Décisions déjà tranchées (hors scope révision)

| Code | Décision | Valeur |
|---|---|---|
| D-W1 | MAX_PUBLISH rampe | 30 → 500 (manuel observation) |
| D-W3 | factoryAutoPublishAllBlogTypes | Activé |
| D-W4 | Embeddings | OpenAI text-embedding-3-large |
| D-P5-1 | Console admin seuil qualité | 60/100 |
| D-P5-2 | Console admin seuil alerte | 60 (gate publication) |
| D-P5-3 | Console admin presets | 6 presets validés |
| D-P5-4 | Console admin ordre sprint | A (quick wins 6h) puis B (CampaignTemplate 8-10h) |
| D-P5-5 | Console admin persona | Manon |
| D-P5-6 | Console admin email | Lundi 8h via P5 |
| D1 | Seuil qualité | 6.0 / 60 |
| D2 | Itérations | 3 itér pilier+landing / 2 autres |
| D3 | Persona | Manon |
| D4 | Wording transparence | Max Claude Sonnet 4.6 |
| D5 | Email cadence | Lundi 8h via P5 |
| D7 | Structure juridique | Société française pure |

**Exclusions absolues (décisions Will fermes) :**
- Wikidata Q-ID : RENONCÉ — ne jamais proposer
- DPA Anthropic : reporté indéfiniment
- CF WAF : déjà désactivé, aucune action requise

---

## Décisions D8–D21 — Recommandations finales

### D8 — Rampe MAX_PUBLISH 30 → 500 : calendrier
**Recommandation : C — Manuel via UI selon observation**

Conserver la flexibilité du contrôle manuel (UI admin déjà livrée, e573da6). Revue chaque lundi sur 4 semaines, ajustement selon impressions GSC hebdomadaires et absence de signal HCU. Aucun calendrier fixe ne peut anticiper la volatilité algorithmique Google 2026.

- Impact : +8 pts D-Scale
- Délai : Immédiat (observation J+7)
- Dépend de : D11 (GSC JSON pour les KPIs)

---

### D9 — KB sectorielle 4 verticales restantes : ordre
**Recommandation : A — interventions_formations first**

~60 % du CA, plus grand volume keywords long-tail B2B. ROI indexation maximal. Les verticales plus petites bénéficieront du maillage interne dès la densification du pilier principal.

- Impact : +46 pts D-Qual
- Délai : J+7
- Dépend de : D8

---

### D10 — Adresse FR domiciliation
**Recommandation : A — Sedomicilier (30€/mois)**

Meilleur rapport prix/qualité. Adresse Paris reconnue GBP. KBIS sous 48h. Débloque D17 (GBP) et Local Pack SEO. Souscription en ligne ~30 min.

- Impact : +25 pts D-Visi
- Délai : J+7
- Dépend de : D21 (SIREN)

---

### D11 — GSC service account JSON
**Recommandation : A — Cette semaine (30 min Will)**

Worker weekly-report déjà livré, attend uniquement la clé JSON. Signal indispensable pour piloter la rampe D8 sans être aveugle. Action autonome Will, aucun prérequis technique.

- Impact : +7 pts D-Visi
- Délai : Immédiat
- Dépend de : Rien

---

### D12 — Monthly cap Anthropic upgrade (~$1 500/mois)
**Recommandation : B — Avant scale >100/j (~J+30)**

Pas contraignant à 30/j. Anticiper J+25 pour marge. Évite toute interruption production lors du scale. Quelques clics portail Anthropic.

- Impact : +5 pts D-Archi
- Délai : J+30
- Dépend de : D8 (pace)

---

### D13 — Vérification P5 — lancer ou skipper
**Recommandation : C — Vérification light 1h**

Cibler uniquement les 4 P0 corrigés dans e573da6 : worker MAX_PUBLISH DB, checkAnomalies, prefill wizard, seuil 60. Confirme l'intégrité sans budget autopilot d'un audit complet redondant.

- Impact : +3 pts D-Qual
- Délai : Immédiat
- Dépend de : Rien

---

### D14 — Bilingue EN — Sprint S+7 priorité
**Recommandation : B — Q4 2026**

Bug next-intl v4.11 / Next.js 16.2 (boucle 307 routes EN pathnames FR≠EN) non résolu. Q4 2026 laisse le temps d'un fix upstream ou patch custom. Toggle `EN_LOCALE_ENABLED` déjà en place pour activation immédiate dès fix.

- Impact : +15 pts D-Etat
- Délai : J+90 (investigation Q3, activation Q4)
- Dépend de : Fix next-intl

---

### D15 — Audit content-gen 2027
**Recommandation : A — Autopilot Claude (méthode P1–P6)**

Méthode prouvée (3 598/5 000 score P6, reproductible). Gratuit hors coûts Anthropic budgétés. Programmer janvier 2027 via prompt self-contained identique au pipeline actuel.

- Impact : +10 pts D-Qual
- Délai : J+240 (janvier 2027)
- Dépend de : Rien (programmer rappel calendrier)

---

### D16 — Backlinks stratégie
**Recommandation : D — Les 3 combinés**

Presse (JDN/Frenchweb) + articles invités blogs IA + conférences Will sont complémentaires. Rythme 1 action/mois (~4h/mois). ROI cumulatif +20 pts vs +8 pts canal unique. Premier pitch presse J+14.

- Impact : +20 pts D-Visi
- Délai : J+14 (premier pitch), cadence mensuelle
- Dépend de : D20 (page /transparence-ia renforce crédibilité pitch)

---

### D17 — GBP après adresse FR
**Recommandation : A — Dès adresse souscrite**

Google accepte les domiciliations légales françaises (Sedomicilier fournit justificatif immédiat). Attendre retarde inutilement le Local Pack. La fiche GBP peut déjà collecter des reviews pendant la montée en autorité.

- Impact : +15 pts D-Visi
- Délai : J+7 à J+10 (dès réception justificatif)
- Dépend de : D10 (adresse), D21 (SIREN GBP)

---

### D18 — Voyage AI RAG sémantique réel
**Recommandation : C — Jamais (KB FTS Postgres suffit)**

Stack actuel : FTS Postgres + pgvector IVFFlat (text-embedding-3-large 3 072 dim, D-W4 validé) couvre les besoins. Voyage AI = dépendance externe + $50–200/mois pour gain marginal non mesurable à ce volume. Décision ferme.

- Impact : +0 (évite dette technique)
- Délai : N/A
- Dépend de : Rien

---

### D19 — Domain EN strategy (si D14=B)
**Recommandation : B — /en/ chemin (déjà configuré)**

Routing `/en/` entièrement configuré dans `routing.ts` avec tous les `pathnames` mappings. Sous-domaine ou domaine séparé = refonte middleware + perte consolidation SEO domaine. Fix next-intl suffira sans migration de structure.

- Impact : +8 pts D-Etat
- Délai : J+90 (avec D14)
- Dépend de : D14

---

### D20 — Transparence IA — page dédiée
**Recommandation : A — Page /transparence-ia avec métriques publiques**

Différenciateur B2B fort : métriques qualité publiques (seuil 60/100, fact-check, AiContentDisclaimer, conformité AI Act art. 50). Renforce E-E-A-T Google. AiContentDisclaimer seul = conformité minimale mais pas positioning B2B.

- Impact : +12 pts D-Brand
- Délai : J+30
- Dépend de : D21 (SIREN à afficher)

---

### D21 — SIREN/SIRET France
**Recommandation : A — Immédiat (dès création société FR)**

D7 validé = société française. SIREN requis pour : JSON-LD `legalIdentifier` (R6 critique schema.prisma P6), facturation B2B légale, souscription D10, GBP D17, page D20. Bloque 4 décisions en cascade si reporté. Délai légal INPI/CFE : 5–10 jours ouvrés.

- Impact : +15 pts D-Legal
- Délai : Immédiat
- Dépend de : D7 (déjà validé)

---

## Récapitulatif one-liner

```
D8=C, D9=A, D10=A, D11=A, D12=B, D13=C, D14=B, D15=A, D16=D, D17=A, D18=C, D19=B, D20=A, D21=A
```

---

## Ordre d'exécution recommandé (par dépendances)

**Immédiat (cette semaine) :**
1. D21 — Démarches SIREN (débloque D10, D17, D20)
2. D11 — GSC service account JSON (débloque pilotage D8)
3. D13 — Vérification light P5 (1h, avant sprint S+7)
4. D8 — Activer observation GSC hebdomadaire

**J+7 à J+10 :**
5. D10 — Sedomicilier souscription (prérequis : D21)
6. D9 — Lancer KB interventions_formations (prérequis : D8 stabilisé)
7. D17 — Créer fiche GBP (prérequis : D10 + D21)

**J+14 à J+30 :**
8. D16 — Premier pitch presse JDN/Frenchweb
9. D20 — Page /transparence-ia (prérequis : D21)
10. D12 — Préparer upgrade cap Anthropic (action J+25)

**J+90 :**
11. D14 — Investigation bug next-intl EN (cible activation Q4)
12. D19 — Architecture confirmée /en/ chemin

**J+240 :**
13. D15 — Programmer audit autopilot janvier 2027

**Fermé définitivement :**
14. D18 — Voyage AI : décision ferme C (jamais)

---

## Impact total D8–D21

| Dimension | Points gagnés |
|---|---|
| D-Scale (business) | +8 |
| D-Qual (qualité contenus) | +59 (+46 D9, +10 D15, +3 D13) |
| D-Visi (visibilité SEO) | +67 (+25 D10, +7 D11, +20 D16, +15 D17) |
| D-Archi (architecture) | +5 |
| D-Etat (état technique) | +23 (+15 D14, +8 D19) |
| D-Brand (marque B2B) | +12 |
| D-Legal (conformité) | +15 |
| **TOTAL** | **+189 pts** |

Score actuel P6 : **3 598 / 5 000**
Score projeté post D8–D21 : **~3 787 / 5 000** (+189 pts, ~75,7%)

---

*Produit par A6-11 — Pipeline Content-Gen Perfection 2026 Phase 6 — 2026-05-22*
*Source détaillée : `phase-6/agents/A6-11-decisions-canoniques.md`*
