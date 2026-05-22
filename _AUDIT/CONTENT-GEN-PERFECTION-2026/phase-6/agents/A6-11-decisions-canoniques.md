# A6-11 — Décisions Canoniques D8–D21
**Agent** : A6-11 | **Pipeline** : Content-Gen Perfection 2026 Phase 6 | **Date** : 2026-05-22
**Mode** : AUDIT-ONLY

---

## Contexte

Ce document recense les 14 décisions ouvertes D8–D21 restant à trancher après validation des décisions D-W1, D-W3, D-W4, D-P5-1 à D-P5-6, D1–D5 et D7. Chaque décision présente les options disponibles, la recommandation Claude motivée, l'impact score estimé, le délai recommandé et les dépendances éventuelles.

**Exclusions absolues confirmées (décisions Will fermes) :**
- Wikidata Q-ID : RENONCÉ définitivement
- DPA Anthropic : reporté indéfiniment
- CF WAF : déjà désactivé, aucune action requise

---

## Décisions D8–D21

#### D8 — Rampe MAX_PUBLISH 30 → 500 : calendrier
**Options** : A (agressif J+7/14/21/28/35) / B (prudent J+14/30/60/120/180) / C (manuel UI selon observation)
**Recommandation Claude** : **C** — Le volume de publication optimal dépend de signaux GSC hebdomadaires (impressions, CTR, HCU penalty risk) qu'aucun calendrier fixe ne peut anticiper. L'UI admin dispose déjà du contrôle manuel depuis e573da6 ; conserver cette flexibilité est la posture la plus sûre face à la volatilité algorithmique Google 2026. Une revue chaque lundi matin sur 4 semaines suffit pour monter à 500 sans risque.
**Impact score** : +8 pts D-Scale (business)
**Délai recommandé** : Immédiat (activer l'observation, première revue J+7)
**Dépendances** : D11 (GSC service account JSON pour les KPIs hebdomadaires)

---

#### D9 — KB sectorielle 4 verticales restantes : ordre
**Options** : A (interventions_formations first) / B (un_a_un first) / C (implementations + sites_web_augmentes first) / D (tous en parallèle)
**Recommandation Claude** : **A** — `interventions_formations` représente ~60 % du CA et concentre le plus grand volume de keywords long-tail B2B (formations IA, accompagnement, intra-entreprise). Indexer cette verticale en premier maximise le ROI immédiat en termes d'impressions GSC et de leads qualifiés. Les verticales plus petites bénéficieront du maillage interne dès que le pilier principal sera dense.
**Impact score** : +46 pts D-Qual
**Délai recommandé** : J+7 (lancement dès validation D8)
**Dépendances** : D8 (volume quotidien requis pour peupler la KB rapidement)

---

#### D10 — Adresse FR domiciliation
**Options** : A (Sedomicilier 30€/mois) / B (Kandbaz 35€/mois) / C (WeWork Paris 300€/mois) / D (reporter)
**Recommandation Claude** : **A** — Sedomicilier offre le meilleur rapport prix/valeur pour une domiciliation légale Paris (adresse reconnue Google Business Profile, facturation B2B conforme, KBIS disponible sous 48h). La différence de 5€/mois vs Kandbaz est négligeable ; WeWork à 300€/mois est disproportionné pour l'étape actuelle. Cette décision débloque GBP (D17) et le Local Pack SEO.
**Impact score** : +25 pts D-Visi (Local SEO + GBP)
**Délai recommandé** : J+7 (souscription en ligne ~30 min)
**Dépendances** : D21 (SIREN requis pour la souscription domiciliation)

---

#### D11 — GSC service account JSON
**Options** : A (cette semaine, 30 min Will) / B (mois prochain) / C (quand reporting email P5 activé)
**Recommandation Claude** : **A** — Le worker weekly-report est déjà livré et attend uniquement la clé JSON du service account GSC. 30 minutes d'effort Will cette semaine activent le monitoring KPIs automatique (impressions, CTR, position moyenne) indispensable pour piloter D8 (rampe MAX_PUBLISH). Sans ce signal, les décisions de scale sont aveugles.
**Impact score** : +7 pts D-Visi (reporting auto)
**Délai recommandé** : Immédiat (cette semaine)
**Dépendances** : Aucune (action Will autonome)

---

#### D12 — Monthly cap Anthropic upgrade (~$1 500/mois)
**Options** : A (maintenant) / B (avant scale >100/j, ~J+30) / C (quand monitoring le justifie)
**Recommandation Claude** : **B** — À 30 publications/jour, le cap actuel n'est pas contraignant. Anticiper l'upgrade ~J+30 (avant de dépasser 100/j) évite toute interruption de service en production et laisse le temps de valider la qualité des contenus avant de scaler les coûts. L'upgrade se fait en quelques clics sur le portail Anthropic.
**Impact score** : +5 pts D-Archi (guardrail budget)
**Délai recommandé** : J+30 (préparer J+25 pour marge)
**Dépendances** : D8 (pace de montée en volume)

---

#### D13 — Vérification P5 — lancer ou skipper
**Options** : A (vérif complète ~3h) / B (skipper) / C (vérification light 1h)
**Recommandation Claude** : **C** — Le sprint P5 a livré 4 correctifs P0 (commit e573da6) déjà vérifiés conceptuellement. Une vérification light (~1h) ciblant uniquement les 4 P0 en code (worker MAX_PUBLISH DB, checkAnomalies, prefill wizard, seuil 60) confirme l'intégrité sans consommer le budget autopilot d'un audit complet inutile à ce stade.
**Impact score** : +3 pts D-Qual (rigueur process)
**Délai recommandé** : Immédiat (avant lancement des sprints S+7)
**Dépendances** : Aucune

---

#### D14 — Bilingue EN — Sprint S+7 priorité
**Options** : A (Q3 2026) / B (Q4 2026) / C (reporter 2027) / D (jamais, FR-only)
**Recommandation Claude** : **B** — Le bug next-intl v4.11 / Next.js 16.2 (boucle 307 sur routes EN pathnames FR≠EN) est un bloquant technique non résolu. Viser Q4 2026 laisse le temps d'un fix upstream ou d'un patch custom, et aligne la priorité EN avec la maturité FR (volume suffisant pour justifier la traduction). La toggle `EN_LOCALE_ENABLED` est déjà en place.
**Impact score** : +15 pts D-Etat (expansion)
**Délai recommandé** : J+90 (investigation bug next-intl Q3, activation Q4)
**Dépendances** : Fix next-intl / Next.js upstream ou patch custom

---

#### D15 — Audit content-gen 2027
**Options** : A (autopilot Claude, méthode P1-P6) / B (cabinet externe ~5 000€) / C (hybride)
**Recommandation Claude** : **A** — La méthode multi-agents P1–P6 est prouvée (score final 3 598/5 000, 14 livrables phases), reproductible et gratuite hors coûts Anthropic déjà budgétés. Un cabinet externe ajouterait un coût non justifiable quand la méthode interne produit des livrables comparables. Programmer l'audit janvier 2027 via un prompt self-contained identique.
**Impact score** : +10 pts D-Qual (amélioration continue)
**Délai recommandé** : J+240 (janvier 2027)
**Dépendances** : Aucune (programmer rappel calendrier)

---

#### D16 — Backlinks stratégie
**Options** : A (pitch presse JDN/Frenchweb) / B (articles invités blogs IA) / C (conférences Will) / D (les 3 combinés)
**Recommandation Claude** : **D** — Les trois canaux sont complémentaires et non exclusifs : presse = autorité domaine rapide, articles invités = volume liens thématiques, conférences = E-E-A-T expérience directe Will. Le rythme 1 action/mois est soutenable sans mobiliser plus de 4h/mois. ROI cumulatif estimé +20 pts D-Visi sur 12 mois vs +8 pts pour un canal unique.
**Impact score** : +20 pts D-Visi (E-E-A-T, citations)
**Délai recommandé** : J+14 (premier pitch presse), puis cadence mensuelle
**Dépendances** : D20 (page /transparence-ia renforce la crédibilité pour les pitches presse)

---

#### D17 — GBP après adresse FR
**Options** : A (dès adresse souscrite) / B (après 3 mois validation domicile) / C (après collecte 5 reviews)
**Recommandation Claude** : **A** — Google Business Profile accepte les domiciliations légales françaises dès souscription (Sedomicilier fournit un justificatif de domicile immédiat). Attendre 3 mois ou 5 reviews retarde inutilement l'entrée dans le Local Pack. La fiche GBP peut déjà collecter des reviews pendant la période de montée en autorité.
**Impact score** : +15 pts D-Visi (Local Pack)
**Délai recommandé** : J+7 à J+10 (dès réception justificatif Sedomicilier)
**Dépendances** : D10 (adresse souscrite), D21 (SIREN pour GBP vérification)

---

#### D18 — Voyage AI RAG sémantique réel
**Options** : A (oui Q3) / B (reporter Q4) / C (jamais, KB FTS Postgres suffit)
**Recommandation Claude** : **C** — Le stack actuel combine FTS Postgres + pgvector IVFFlat (embeddings text-embedding-3-large 3 072 dim, D-W4 validé). Ce pipeline couvre les besoins fact-check et similarité sémantique sans coût supplémentaire. Voyage AI ajouterait une dépendance externe et ~$50–200/mois pour un gain marginal non mesurable à ce stade de volume.
**Impact score** : +0 pts (évite dette technique inutile)
**Délai recommandé** : N/A (décision ferme)
**Dépendances** : Aucune

---

#### D19 — Domain EN strategy (si D14=B)
**Options** : A (sous-domaine en.axion-ia.com) / B (/en/ chemin, déjà configuré) / C (domaine séparé axion-ai.com)
**Recommandation Claude** : **B** — Le routing `/en/` est déjà entièrement configuré dans `routing.ts` avec tous les `pathnames` mappings FR/EN. Un sous-domaine ou domaine séparé nécessiterait une refonte du middleware et perdrait le SEO de consolidation de domaine. Le fix next-intl suffira pour activer `/en/` sans migration de structure.
**Impact score** : +8 pts D-Etat (cohérence architecture)
**Délai recommandé** : J+90 (avec D14=B, Q4 2026)
**Dépendances** : D14 (fix next-intl prérequis)

---

#### D20 — Transparence IA — page dédiée
**Options** : A (page /transparence-ia avec métriques publiques) / B (section blog éducative) / C (silence, AiContentDisclaimer minimal)
**Recommandation Claude** : **A** — Une page `/transparence-ia` dédiée est un différenciateur B2B fort : elle affiche les métriques qualité (seuil 60/100, fact-check, AiContentDisclaimer, conformité AI Act), renforce l'E-E-A-T Google, et positionne Axion-IA comme leader responsable vs concurrents silencieux. Le `AiContentDisclaimer` seul est nécessaire mais insuffisant pour le positioning B2B.
**Impact score** : +12 pts D-Brand (B2B trust, EEAT)
**Délai recommandé** : J+30 (après stabilisation volume publication)
**Dépendances** : D21 (SIREN à afficher sur la page pour crédibilité légale)

---

#### D21 — SIREN/SIRET France
**Options** : A (dès création société FR) / B (après 6 mois activité) / C (pas urgent)
**Recommandation Claude** : **A** — D7 a tranché : société française pure. Le SIREN est requis immédiatement pour : JSON-LD `legalIdentifier` (conformité schema.org R6 critique signalée P6), facturation B2B légale, souscription domiciliation Sedomicilier (D10), création GBP (D17), page /transparence-ia (D20). Retarder bloque 4 autres décisions en cascade.
**Impact score** : +15 pts D-Legal (JSON-LD, facturation, conformité)
**Délai recommandé** : Immédiat (démarches INPI/CFE, délai légal 5–10j ouvrés)
**Dépendances** : D7 (déjà validé = société FR)

---

## Récapitulatif one-liner

```
Si OK recommandations Claude : D8=C, D9=A, D10=A, D11=A, D12=B, D13=C, D14=B, D15=A, D16=D, D17=A, D18=C, D19=B, D20=A, D21=A
```

---

## Tableau de synthèse

| Décision | Option reco | Impact score | Délai | Dépend de |
|---|---|---|---|---|
| D8 Rampe MAX_PUBLISH | C Manuel | +8 pts D-Scale | Immédiat | D11 |
| D9 KB verticales ordre | A interventions_formations | +46 pts D-Qual | J+7 | D8 |
| D10 Adresse FR | A Sedomicilier | +25 pts D-Visi | J+7 | D21 |
| D11 GSC JSON | A Cette semaine | +7 pts D-Visi | Immédiat | — |
| D12 Cap Anthropic | B J+30 | +5 pts D-Archi | J+30 | D8 |
| D13 Vérif P5 | C Light 1h | +3 pts D-Qual | Immédiat | — |
| D14 EN locale | B Q4 2026 | +15 pts D-Etat | J+90 | Fix next-intl |
| D15 Audit 2027 | A Autopilot | +10 pts D-Qual | J+240 | — |
| D16 Backlinks | D Les 3 | +20 pts D-Visi | J+14 | D20 |
| D17 GBP | A Dès adresse | +15 pts D-Visi | J+7–10 | D10, D21 |
| D18 Voyage AI | C Jamais | +0 | N/A | — |
| D19 Domain EN | B /en/ chemin | +8 pts D-Etat | J+90 | D14 |
| D20 Transparence IA | A Page dédiée | +12 pts D-Brand | J+30 | D21 |
| D21 SIREN/SIRET | A Immédiat | +15 pts D-Legal | Immédiat | D7 ✓ |

**Total impact cumulé** : +189 pts (sur décisions D8–D21, hors D18)

---

*Produit par A6-11 — Pipeline Content-Gen Perfection 2026 Phase 6 — 2026-05-22*
