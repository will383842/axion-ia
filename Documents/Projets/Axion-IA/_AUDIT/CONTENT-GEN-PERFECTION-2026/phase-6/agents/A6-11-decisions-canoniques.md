# A6-11 — Décisions Canoniques Finales (D8–D22)
**Agent**: A6-11 | Pipeline Content-Gen Perfection AxionIA 2026
**Date**: 2026-05-22 | **HEAD**: e573da64 | **Score actuel**: 3638/5000 CONDITIONNEL
**Statut**: AUDIT-ONLY — zéro commit, zéro modification code

---

## 0. Décisions déjà tranchées (rappel condensé — NE PAS RE-DEMANDER)

| Code | Décision |
|------|----------|
| D-W1 | MAX_PUBLISH=30 initial, rampe progressive vers 500 |
| D-W3 | factoryAutoPublishAllBlogTypes ACTIVÉ |
| D-W4 | Embedding = OpenAI text-embedding-3-large |
| D-P5-1 | 6 presets CampaignTemplate validés |
| D-P5-2 | Seuil qualité 60/100 |
| D-P5-3 | Reporting email lundi 8h williamsjullin@gmail.com |
| D-P5-4 | Tableau croisé (pas heatmap) |
| D-P5-5 | MAX_PUBLISH manuel depuis UI |
| D-P5-6 | Sprint A puis B |
| D1 | Seuil REJECT 6.0/10 |
| D2 | 3 itérations guide_pilier+landing_ville / 2 autres types |
| D3 | Persona Manon |
| D4 | Wording "Claude Sonnet 4.6, Anthropic" |
| D5 | Reporting email (implémenté P5) |
| D7 | Société française pure |

**Exclusions absolues** : Wikidata Q-ID (renoncé), DPA Anthropic (reporté), CF WAF (acquis).

---

## 1. Décisions D8–D22 — 15 décisions à trancher

---

## D8 — Rampe MAX_PUBLISH 30→500 : quel calendrier ?

**Contexte**: Définir le rythme de montée en charge des publications automatiques après le palier initial de 30/j. Chaque semaine sans déclenchement HCU est une semaine de croissance potentielle.

**Options**:
- A: Agressif (J+7=40/j, J+14=60/j, J+21=80/j, J+28=100/j, J+35=150/j) si KPIs verts
- B: Prudent (J+14=50/j, J+30=75/j, J+60=100/j, J+90=150/j, J+180=200/j)
- C: Manuel depuis UI — Will ajuste selon observation KPIs chaque semaine

**Reco Claude**: **C (Manuel UI)** — D-P5-5 a déjà décidé "manuel depuis UI". Cadre suggéré : +10/j si K8 (taux indexation) > 70 % et aucune alerte HCU dans la semaine précédente. Le reporting email hebdo (D11 → D-P5-3) fournit les données nécessaires chaque lundi.

**Impact si non tranché**: Pas de cadence définie = Will improvise sans critères = risque HCU ou scale sous-optimal.

**Urgence**: Immédiate (avant Sprint A)

**Dépendances**: D11 (GSC) → D8 (données pour décision scale hebdo)

---

## D9 — KB sectorielle : ordre des 4 verticales restantes ?

**Contexte**: La Knowledge Base sectorielle alimente la qualité des contenus. 4 verticales restent à enrichir : `interventions_formations`, `un_a_un`, `implementations`, `sites_web_augmentes`.

**Options**:
- A: interventions_formations first (catalogue principal, ~50 cours, 50 % du contenu)
- B: un_a_un first (B2B sensible, fort différenciateur)
- C: implementations + sites_web_augmentes first (verticales jeunes)
- D: Toutes en parallèle (4 agents simultanés, 1 journée ~4h total)

**Reco Claude**: **D (Parallèle)** — 4 agents simultanés = 4h total vs ~32h séquentiel, qualité identique. Le pipeline a démontré la capacité multi-agents (audits P1-P6 en parallèle). interventions_formations est prioritaire en volume, mais les 3 autres n'ont aucun bloquant — autant les traiter en même temps.

**Impact si non tranché**: Contenus des 4 verticales restent sans KB enrichie = scores D-Qual stagnants.

**Urgence**: Sprint A

**Dépendances**: Aucune bloquante. Démarrable immédiatement.

---

## D10 — Adresse FR domiciliation : option choisie ?

**Contexte**: Axion-IA est sans adresse physique française. Cela bloque GBP, JSON-LD `PostalAddress`, crédibilité B2B locale, Local Pack Google.

**Options**:
- A: Sedomicilier ~30€/mois (Paris 8e, rapport qualité/prix optimal)
- B: Kandbaz ~35€/mois (inclus service téléphone)
- C: WeWork Paris ~300€/mois (prestige — justifié seulement si CA > 10K€/mois)
- D: Reporter (0€ — perd GBP + Local SEO pendant X mois)

**Reco Claude**: **A (Sedomicilier 30€/mois)** — 360€/an pour déverrouiller GBP (Local Pack = 1er résultat mobile requêtes locales) + JSON-LD PostalAddress (signal E-E-A-T fort) + crédibilité B2B (mentions légales conformes). ROI exceptionnel. Option D est un frein direct à toute la chaîne Local SEO.

**Impact si non tranché**: D17 (GBP) et D21 (SIREN) bloqués = 0 Local Pack Google = marché B2B FR local invisible.

**Urgence**: Immédiate

**Dépendances**: D10 → D17 (GBP) → D21 (JSON-LD legalName complet)

---

## D11 — GSC service account JSON : quand créer ?

**Contexte**: Le Google Search Console service account JSON est le prérequis technique pour le reporting email automatique (D-P5-3) et pour mesurer K5/K6/K7/K8 programmatiquement.

**Options**:
- A: Cette semaine (30 min Will — prérequis reporting hebdo + KPIs mesurables dès J+7)
- B: Mois prochain (après Sprint A — Sprint A sans KPIs automatisés)
- C: Quand reporting email P5 activé (dépendance circulaire — le reporting nécessite GSC)

**Reco Claude**: **A (Cette semaine)** — 30 min Will, prérequis direct de D-P5-3 (reporting lundi 8h). Sans GSC service account, le reporting email ne peut pas inclure les KPIs d'indexation nécessaires pour D8. Option C = dépendance circulaire. Sprint A sans GSC = décisions de scale à l'aveugle.

**Impact si non tranché**: Reporting email hebdo incomplet, D8 (rampe scale) sans données = scale aveugle.

**Urgence**: Immédiate (J0 — prérequis critique)

**Dépendances**: D11 → D8 (décisions scale éclairées), D11 → D-P5-3 (reporting email complet)

---

## D12 — Monthly cap Anthropic upgrade (~$1500/mois) : quand ?

**Contexte**: La limite mensuelle API Anthropic peut bloquer le pipeline lors du scale > 100 articles/jour. Anticiper évite une interruption en production.

**Options**:
- A: Maintenant (préventif — paye du headroom non utilisé)
- B: Avant scale > 100/j (~J+30 Sprint B démarrage) — timing calibré sur le volume réel
- C: Quand cost-tracker alerte 80 % cap actuel (réactif — risque de coupure si alerte ratée)

**Reco Claude**: **B (Avant scale > 100/j)** — À 30/j actuel, cap actuel est suffisant. Option A gaspille du capital. Option C risque une coupure si l'alerte est manquée. Demande à faire ~J+21-25, avant d'atteindre 100/j. Caps recommandés : $200 (J0-30) → $500 (J31-90) → $1000 (J91-180) → $1500 (J181+).

**Impact si non tranché**: Coupure API Anthropic si scale atteint 100/j sans upgrade = perte de production.

**Urgence**: Sprint A (décision maintenant, action à J+21-25)

**Dépendances**: D8 (rampe scale) → D12 (timing upgrade cap)

---

## D13 — Sprint A lancement : immédiat ou après observation ?

**Contexte**: Sprint A couvre les quick wins content-gen (~15h Claude). AI Act deadline = 2026-08-02 (J+72). Les commits P5 récents (e573da64) sont en production.

**Options**:
- A: Immédiat cette semaine (AI Act deadline J+72 — urgence maximale)
- B: Pause 2 semaines observation prod (conservateur, perd 14 jours critiques)
- C: Vérification légère 2h (typecheck + smoke test + K15 compliance) puis Sprint A immédiat

**Reco Claude**: **C (Vérification 2h puis Sprint A)** — 2h pour vérifier typecheck + vitest + smoke prod avant lancer évite de démarrer Sprint A sur une base instable. Option A sans filet = risque si P0 résiduel. Option B perd 14 jours avec deadline J+72 non négociable. C = équilibre optimal risque/vitesse.

**Impact si non tranché**: AI Act deadline 2026-08-02 non respectée = risque légal, et/ou Sprint A lancé sur base instable.

**Urgence**: Immédiate (J0)

**Dépendances**: D11 (GSC idéalement prêt avant Sprint A pour mesurer l'effet)

---

## D14 — Bilingue EN locale : quelle priorité ?

**Contexte**: Locale EN désactivé depuis 2026-05-16 (bug next-intl v4.11 + Next.js 16.2, boucle 307). Code complet, messages EN en place, proxy.ts redirige /en/* → /fr/*. Bug bloquant non résolu.

**Options**:
- A: Prioritaire Q3 2026 (sprint dédié next-intl fix dès juillet)
- B: Prioritaire Q4 2026 (après stabilisation scale FR) — reco Claude
- C: Reporté 2027 (FR-only long terme)
- D: Jamais (FR-only stratégie définitive, simplification code)

**Reco Claude**: **B (Q4 2026)** — Marché FR prioritaire : 0 % visibilité actuelle, tout l'effort doit aller sur FR jusqu'à impressions GSC > 10K/mois. Bug next-intl = sprint non trivial (~8-12h investigation + fix). Q4 2026 = après scale FR prouvé. Option A = prématuré. Option D = ferme une porte sans bénéfice clair.

**Impact si non tranché**: Marché international B2B inaccessible. D-Etat stagne (-15 pts vs potentiel).

**Urgence**: Long terme (décision sprint B)

**Dépendances**: D14 → D19 (architecture URL EN si réactivé)

---

## D15 — Audit content-gen 2027 : Claude autopilot ou cabinet externe ?

**Contexte**: Un audit annuel maintient qualité et conformité. La question est qui conduit cet audit 2027.

**Options**:
- A: Autopilot Claude (méthode P1-P6 reproductible, ~$50-100 tokens, $0 extra)
- B: Cabinet externe ~5K€ (preuve audit tiers, crédibilité B2B)
- C: Hybride Claude audit + 1j consultant validation (~1-2K€)

**Reco Claude**: **A (Autopilot Claude)** — La méthode P1-P6 est documentée, éprouvée, reproductible (score passé de ~531 à ~3638+). Même méthode en mai 2027 = score comparatif parfaitement calibré. Option B à 5K€ justifiable uniquement si Axion-IA vend des audits IA à ses clients. Option C valide si Option B devient pertinente commercialement.

**Impact si non tranché**: Pas d'audit 2027 = conformité non vérifiée, dette qualité silencieuse.

**Urgence**: Long terme (>12 mois)

**Dépendances**: Aucune.

---

## D16 — Backlinks autorité FR : quelle stratégie ?

**Contexte**: E-E-A-T et DA d'axion-ia.com actuellement faibles. Les backlinks qualité sont le levier principal pour les requêtes compétitives IA FR.

**Options**:
- A: Pitch presse JDN/Frenchweb (1-2/trimestre)
- B: Articles invités blogs IA FR (2/mois)
- C: Conférences Will (VivaTech, AI Summit Paris, 1-2/an)
- D: Combinaison A+B+C (1 action/mois, cadence réaliste)

**Reco Claude**: **D (Combinaison A+B+C)** — E-E-A-T est un signal cumulatif, aucun canal seul ne suffit. JDN/Frenchweb = autorité domaine forte. Articles invités = liens contextuels pertinents. Conférences Will = preuve physique d'expertise (Author E-E-A-T fort pour AEO). 1 action/mois = rythme réaliste. En 6 mois : ~6 backlinks haute autorité + mentions presse + bio conférence.

**Impact si non tranché**: DA stagne, AI Overviews eligibility faible, requêtes compétitives hors portée.

**Urgence**: Sprint B (démarrage cadence mensuelle)

**Dépendances**: D20 (page transparence = asset pitch presse D16)

---

## D17 — Google Business Profile : quand créer après adresse FR ?

**Contexte**: GBP est le levier principal du Local Pack Google. Sans adresse physique vérifiée, impossible de créer/vérifier un GBP. Vérification Google = 2-4 semaines (courrier ou appel).

**Options**:
- A: Dès adresse FR souscrite (vérification Google prend 2-4 semaines → créer le plus tôt)
- B: 3 mois après adresse (validation domicile — attente inutile)
- C: Après collecte 5 reviews clients (dépendance au CA)

**Reco Claude**: **A (Dès adresse souscrite)** — La vérification Google elle-même prend 2-4 semaines — autant démarrer immédiatement après D10. Les 5 reviews se collectent après création du profil, pas avant. GBP = multiplicateur de visibilité Local Pack = trafic B2B mobile FR.

**Impact si non tranché**: Local Pack Google inaccessible, K9 villes bloqué.

**Urgence**: Sprint A (dès D10 validé)

**Dépendances**: D10 → D17 (adresse d'abord, impératif)

---

## D18 — Voyage AI RAG sémantique réel : activer ?

**Contexte**: Pipeline actuel = FTS Postgres + SHA-256 + OpenAI text-embedding-3-large (D-W4). Voyage AI proposerait des embeddings contextuels additionnels (~$0.10/1000 docs) pour un RAG plus sémantique.

**Options**:
- A: Oui Q3 2026 (~15h dev, +12 pts D-Archi, +20 pts D-Qual)
- B: Reporter Q4 2026 (après KB sectorielle 4 verticales, preuves de besoin)
- C: Jamais pour l'instant (KB FTS Postgres suffit, OpenAI embeddings déjà en place)

**Reco Claude**: **B (Reporter Q4 2026)** — KB sectorielle 4 verticales (D9) doit d'abord enrichir la base factuelle. OpenAI text-embedding-3-large est déjà en place — ajouter Voyage AI = double couche non justifiée avant preuve de besoin (doublons sémantiques non détectés sur KPI). Reconsidérer Q4 si KPIs qualité stagnent malgré KB enrichie.

**Impact si non tranché**: Pas de régression — FTS Postgres + OpenAI embeddings couvre 95 % des besoins actuels.

**Urgence**: Long terme (décision Sprint D)

**Dépendances**: D9 (KB sectorielle) → D18 (RAG seulement après KB complète)

---

## D19 — Domain strategy EN (si D14 = A ou B) ?

**Contexte**: Si locale EN réactivé (D14), quelle structure d'URL ? Le code actuel implémente déjà /en/ via proxy.ts (proxy.ts + en-to-fr-redirect.ts).

**Options**:
- A: Sous-domaine en.axion-ia.com (traité comme site séparé par Google — dilue l'autorité)
- B: Chemin /en/ (proxy.ts déjà configuré, SEO authority consolidé)
- C: Domaine séparé axion-ai.com (pire SEO — divise autorité sur 2 domaines)

**Reco Claude**: **B (Chemin /en/ — déjà configuré)** — Implémentation déjà faite dans proxy.ts et routing.ts. Option A divise l'autorité domaine. Option C est la pire option SEO. Option B consolide tout le SEO sur axion-ia.com avec effort minimal de réactivation.

**Impact si non tranché**: Conditionnel à D14. Si D14=B (Q4), décision à réviser en Sprint D.

**Urgence**: Long terme (conditionnel D14)

**Dépendances**: D14 → D19

---

## D20 — Communication "transparence IA" : quelle stratégie ?

**Contexte**: AI Act article 50 (deadline 2026-08-02) impose la déclaration de contenu généré par IA. AiContentDisclaimer minimal déjà implémenté. L'opportunité est d'aller au-delà pour en faire un avantage compétitif.

**Options**:
- A: Page dédiée /transparence-ia avec métriques publiques (modèle, volume articles, score qualité moyen)
- B: Section blog éducative seule (articles IA + démarche Axion)
- C: Silence (AiContentDisclaimer minimal — compliance uniquement)

**Reco Claude**: **A (Page /transparence-ia)** — Trust signal B2B fort + AEO booster AI Overviews + différenciation marché FR. La page /transparence-ia avec métriques publiées est un pitch commercial fort pour les prospects B2B et un asset pour D16 (pitch presse). Blog éducatif (B) est complémentaire, à combiner avec A dans Sprint A. Option C = minimum légal déjà acquis, gâche une opportunité.

**Impact si non tranché**: E-E-A-T faible, opportunité pitch presse manquée, AI Overviews eligibility sous-optimale.

**Urgence**: Sprint A (synergique deadline AI Act)

**Dépendances**: D20 → D16 (page transparence = asset pitch presse)

---

## D21 — Priorité D-Ops vs D-Visi en Sprint A ?

**Contexte**: Sprint A doit allouer ~15h Claude entre deux dimensions : D-Ops (score gap ~420 pts, pipeline robustesse) et D-Visi (SEO impact direct leads mais bloqué par actions Will D10/D11).

**Options**:
- A: D-Ops en priorité (gap plus grand, ROI pipeline immédiat, indépendant actions Will)
- B: D-Visi en priorité (SEO impact direct leads, mais bloque sur D10/D11 non encore faits)
- C: Mix 50/50 (équilibré mais ni l'un ni l'autre pleinement livré)

**Reco Claude**: **A (D-Ops prioritaire)** — Gap D-Ops est le plus grand (+420 pts potentiels). D-Visi dépend de D10 (adresse FR) et D11 (GSC) que Will n'a pas encore activés — démarrer D-Visi maintenant = travail partiel. D-Ops = pipeline robustesse + monitoring + AI Act compliance = livrables autonomes, zéro dépendance externe. ROI immédiat mesurable.

**Impact si non tranché**: Sprint A mal alloué = 15h sur des items bloqués par actions Will = sous-performance.

**Urgence**: Immédiate (Sprint A allocation)

**Dépendances**: D11 (GSC) débloque D-Visi → Sprint B peut alors prioriser D-Visi

---

## D22 — comparison.ts : lever le no-table gate ?

**Contexte**: Le prompt comparison.ts interdit les tableaux (no-table gate global). Or un article comparatif sans tableau est moins utile pour l'utilisateur et moins éligible aux Featured Snippets Google (format tableau = rich result).

**Options**:
- A: Exception ciblée au gate no-table pour comparison.ts uniquement
- B: Garder no-table global (renonce aux Featured Snippets comparaison — listes/prose uniquement)
- C: Créer un type `comparison-table.ts` séparé avec gate propre (over-engineering pour 1 générateur)

**Reco Claude**: **A (Exception localisée comparison.ts)** — Le gate no-table a été créé pour éviter les "tableaux Wikipedia" dans les articles génériques. Les tableaux de comparaison sont le format naturel et attendu pour les articles comparison (ex: "ChatGPT vs Mistral vs Claude"). L'exception est ciblée, le gate reste actif sur tous les autres générateurs. Potentiel +20-30 pts D-Visi sur Featured Snippets comparison. Option C = over-engineering pour un seul générateur.

**Impact si non tranché**: comparison.ts génère des listes moins lisibles, potentiel Featured Snippets tableaux manqué (-20-30 pts D-Visi).

**Urgence**: Sprint B (comparison.ts implémentation)

**Dépendances**: Sprint B comparison.ts gate update

---

## 2. Priorité des décisions

### URGENT — Cette semaine (J0–J7)

| Code | Décision | Raison | Effort Will |
|------|----------|--------|-------------|
| **D11** | GSC service account JSON | Prérequis blocking D-P5-3 + D8 | 30 min |
| **D13** | Sprint A lancement | AI Act deadline 2026-08-02 (J+72) | Go signal |
| **D10** | Adresse FR domiciliation | Débloque D17 (GBP), D21 (SIREN) | 30 min inscription |
| **D21** | Priorité Sprint A (D-Ops vs D-Visi) | Allocation 15h Claude Sprint A | Décision 2 min |

### SPRINT A — J7–J14

| Code | Décision | Raison |
|------|----------|--------|
| **D9** | KB sectorielle ordre | Démarrage immédiat avec Sprint A, ~4h agents parallèles |
| **D20** | Transparence IA page | AI Act deadline, synergique Sprint A |
| **D17** | GBP (dès D10 fait) | Délai vérification Google 2-4 semaines → démarrer tôt |

### MOYEN TERME — J+14–J+60 (Sprint B)

| Code | Décision | Raison |
|------|----------|--------|
| **D8** | Rampe MAX_PUBLISH | Manuel hebdo avec reporting D11/D-P5-3 |
| **D12** | Anthropic cap upgrade | Avant d'atteindre 100/j (~J+21-25) |
| **D16** | Backlinks stratégie | Cadence mensuelle, démarrage Sprint B |
| **D22** | comparison.ts no-table | Sprint B comparison.ts implémentation |

### LONG TERME — Q3–Q4 2026+

| Code | Décision | Raison |
|------|----------|--------|
| **D14** | Bilingue EN Q4 | Après stabilisation scale FR |
| **D18** | Voyage AI RAG | Reporter Q4 — KB d'abord |
| **D19** | Domain strategy EN | Conditionnel D14 |
| **D15** | Audit 2027 | Horizon >12 mois |

---

## 3. Chaînes de dépendances critiques

```
CHAÎNE 1 — LOCAL SEO (la plus critique, actions Will requises):
D10 (adresse FR souscrite) → D17 (GBP création J+0) → 2-4 sem vérif Google
→ D21 (SIREN = constitution société FR, 1-3 mois) → GBP officiel + JSON-LD complet
ROI: Local Pack Google, +K9 villes, crédibilité B2B mentions légales

CHAÎNE 2 — SCALE ÉCLAIRÉ (data-driven):
D11 (GSC service account, 30 min) → D-P5-3 (reporting email hebdo lundi 8h opérationnel)
→ D8 (rampe scale: +10/j si K8>70% et pas d'alerte HCU) → D12 (cap upgrade avant 100/j)

CHAÎNE 3 — AI ACT + TRANSPARENCE (deadline légale):
D13 (Sprint A vérif 2h + go) → D20 (page transparence incluse Sprint A)
→ D16 (asset pitch presse) → Deadline 2026-08-02 (J+72)

CHAÎNE 4 — INTERNATIONAL (long terme):
D14 (décision EN Q4 2026) → D19 (architecture /en/ déjà configurée)
→ Sprint dédié fix bug next-intl → Réactivation locale EN

CHAÎNE 5 — QUALITÉ CONTENU:
D9 (KB 4 verticales en parallèle) → scores D-Qual +40 pts
→ D18 (RAG Q4 seulement si KPIs qualité stagnent après KB)

CHAÎNE 6 — comparison.ts:
D22 (exception no-table comparison.ts) → Sprint B comparison.ts
→ Featured Snippets tableaux Google → +20-30 pts D-Visi
```

---

## 4. Impact score estimé par décision

| Code | Décision | Delta score estimé |
|------|----------|--------------------|
| D13 | Sprint A immédiat (D-Ops prioritaire) | +60 pts |
| D9 | KB sectorielle 4 verticales parallèle | +40 pts |
| D10+D17 | Chaîne Local SEO (adresse + GBP) | +35 pts |
| D20 | Page transparence IA + blog | +25 pts (E-E-A-T, AI Overviews) |
| D16 | Backlinks 1 action/mois | +20 pts (sur 6 mois) |
| D22 | comparison.ts no-table exception | +20-30 pts (Featured Snippets) |
| D14 | EN Q4 2026 | +15 pts (si réactivé) |
| D18 | RAG Q4 (vs jamais = option C précédente) | +12 pts potentiels Q4 |
| D11 | GSC reporting | +20 pts indirect (décisions scale mieux calibrées) |
| D8 | Rampe manuel | 0 pts direct (governance) |
| D12 | Cap Anthropic | 0 pts direct (continuité) |
| D15 | Audit 2027 | 0 pts direct (long terme) |
| D19 | /en/ path | 0 pts (conditionnel D14) |

**Score projeté fin Sprint A** : 3638 + 60 + 40 + 25 = **~3763/5000**
**Score projeté fin Sprint B + Local SEO** : 3763 + 35 + 20 + 30 + 20 = **~3868/5000**
**Score projeté Q4 2026 (EN + RAG + backlinks)** : 3868 + 15 + 12 + 20 = **~3915/5000**
**Score projeté 2027 (audit complet)** : **~4200+/5000**

---

## 5. Résumé one-liner pour Will

**Réponse si toutes recommandations Claude acceptées :**
```
D8=C, D9=D, D10=A, D11=A, D12=B, D13=C, D14=B, D15=A, D16=D, D17=A, D18=B, D19=B, D20=A, D21=A, D22=A
```

Will peut aussi répondre : **"Go recommandations Claude"** → pipeline continue avec les defaults ci-dessus.

**3 décisions les plus urgentes cette semaine (J0-J7)** :
1. **D11 = A** (GSC service account, 30 min) — prérequis reporting email + décisions scale
2. **D13 = C** (vérif 2h + Sprint A) — AI Act deadline J+72 non négociable
3. **D10 = A** (Sedomicilier 30€/mois) — débloque toute la chaîne Local SEO

---

*Rapport généré par A6-11 le 2026-05-22 — AUDIT-ONLY, zéro commit, zéro modification code.*
*Pipeline Content-Gen Perfection AxionIA 2026 — Phase 6 Décisions Canoniques — HEAD e573da64.*
