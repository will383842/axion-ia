# DÉCISIONS CANONIQUES FINALES — Phase 6
## Date : 2026-05-22 (màj méta-audit + D22 ajoutée) | 15 décisions D8-D22
## HEAD : e573da64 | Score : 3638/5000 CONDITIONNEL

> **Décisions déjà tranchées (NE PAS RE-DEMANDER)** :
> D-W1 à D-W5, D-P5-1 à D-P5-6, D1-D5, D7 (société FR pure).
> **Exclusions absolues** : Wikidata ❌, DPA Anthropic ❌ (reporté), CF WAF ✅ (acquis).

---

## DÉCISIONS URGENTES (à trancher avant Sprint A — J0-J7)

## D8 — Rampe MAX_PUBLISH 30→500 : quel calendrier ?
**Contexte**: Montée en charge publications automatiques après palier initial 30/j.
**Options**:
- A: Agressif (J+7=40/j → J+35=150/j) si KPIs verts
- B: Prudent (J+14=50/j → J+180=200/j)
- C: Manuel depuis UI — Will ajuste chaque semaine selon KPIs
**Reco Claude**: **C (Manuel UI)** — D-P5-5 a décidé "manuel depuis UI". Cadre suggéré : +10/j si K8 (taux indexation) > 70 % et aucune alerte HCU dans la semaine précédente.
**Impact si non tranché**: Scale improvised sans critères = risque HCU ou sous-performance business.
**Urgence**: Immédiate (avant Sprint A — cadre à définir avant 1er lundi reporting)

---

## D9 — KB sectorielle : ordre des 4 verticales restantes ?
**Contexte**: 4 verticales `interventions_formations`, `un_a_un`, `implementations`, `sites_web_augmentes` sans KB enrichie = scores D-Qual stagnants.
**Options**:
- A: interventions_formations first (~50 cours, 50 % du contenu)
- B: un_a_un first (B2B sensible, différenciateur fort)
- C: implementations + sites_web_augmentes first (verticales jeunes)
- D: Toutes en parallèle (4 agents simultanés, ~4h total vs 32h séquentiel)
**Reco Claude**: **D (Parallèle)** — 4 agents simultanés = même qualité en 4h. Pipeline multi-agents éprouvé sur audits P1-P6.
**Impact si non tranché**: Contenus des 4 verticales sans KB = D-Qual stagnant sur 50 % du pipeline.
**Urgence**: Sprint A

---

## D10 — Adresse FR domiciliation : option choisie ?
**Contexte**: Sans adresse physique française, GBP, JSON-LD PostalAddress, Local Pack Google et crédibilité B2B bloqués.
**Options**:
- A: Sedomicilier ~30€/mois (Paris 8e — rapport qualité/prix optimal)
- B: Kandbaz ~35€/mois (inclus service téléphone)
- C: WeWork Paris ~300€/mois (justifié seulement si CA > 10K€/mois)
- D: Reporter (0€ — perd GBP + Local SEO pendant X mois)
**Reco Claude**: **A (Sedomicilier 30€/mois)** — 360€/an pour déverrouiller GBP (Local Pack), JSON-LD PostalAddress (E-E-A-T), crédibilité B2B = ROI exceptionnel. Option D bloque toute la chaîne Local SEO.
**Impact si non tranché**: D17 (GBP) et D21 (SIREN) bloqués = 0 Local Pack Google = marché B2B FR local invisible.
**Urgence**: Immédiate

---

## D11 — GSC service account JSON : quand créer ?
**Contexte**: Prérequis technique du reporting email automatique (D-P5-3) et mesure K5/K6/K7/K8 programmatiquement.
**Options**:
- A: Cette semaine (30 min Will — débloque reporting hebdo + KPIs J+7)
- B: Mois prochain (après Sprint A — Sprint A sans KPIs automatisés)
- C: Quand reporting email P5 activé (dépendance circulaire)
**Reco Claude**: **A (Cette semaine)** — 30 min Will, prérequis direct D-P5-3. Sans GSC, reporting email incomplet, D8 sans données. Option C = dépendance circulaire.
**Impact si non tranché**: Scale aveugle — D8 sans données GSC = décisions improvised.
**Urgence**: Immédiate (J0 — prérequis critique)

---

## D13 — Sprint A lancement : immédiat ou après observation ?
**Contexte**: Sprint A ~15h Claude, AI Act deadline 2026-08-02 (J+72). Commits P5 récents (e573da64) en prod.
**Options**:
- A: Immédiat cette semaine (urgence maximale AI Act)
- B: Pause 2 semaines observation (perd 14 jours critiques)
- C: Vérification légère 2h (typecheck + smoke + K15) puis Sprint A immédiat
**Reco Claude**: **C (Vérification 2h puis Sprint A)** — 2h pour vérifier base stable avant Sprint A. Option A sans filet = risque P0 résiduel. Option B = 14 jours perdus avec deadline J+72 non négociable.
**Impact si non tranché**: AI Act deadline 2026-08-02 non respectée = risque légal.
**Urgence**: Immédiate (J0)

---

## D21 — Priorité D-Ops vs D-Visi en Sprint A ?
**Contexte**: Sprint A alloue ~15h Claude entre D-Ops (gap ~420 pts, pipeline robustesse, autonome) et D-Visi (SEO impact leads, mais bloqué par D10/D11 non encore activés).
**Options**:
- A: D-Ops en priorité (gap plus grand, ROI pipeline immédiat, zéro dépendance externe)
- B: D-Visi en priorité (SEO impact direct, mais bloque sur D10/D11 non faits)
- C: Mix 50/50 (ni l'un ni l'autre pleinement livré)
**Reco Claude**: **A (D-Ops prioritaire)** — Gap D-Ops plus grand (+420 pts). D-Visi dépend de D10/D11 (non encore activés). D-Ops = livrables autonomes, ROI immédiat mesurable. D-Visi = Sprint B quand D10/D11 seront prêts.
**Impact si non tranché**: Sprint A mal alloué sur items bloqués = sous-performance.
**Urgence**: Immédiate (Sprint A allocation)

---

## DÉCISIONS À COURT TERME (Sprint A-B — J7–J60)

## D12 — Monthly cap Anthropic upgrade (~$1500/mois) : quand ?
**Contexte**: Limite mensuelle API Anthropic peut bloquer pipeline lors du scale > 100 articles/jour.
**Options**:
- A: Maintenant (préventif — paye headroom non utilisé)
- B: Avant scale > 100/j (~J+30 Sprint B)
- C: Quand cost-tracker alerte 80 % cap actuel (réactif — risque coupure si alerte ratée)
**Reco Claude**: **B (Avant scale > 100/j)** — À 30/j actuel le cap est suffisant. Demande à faire ~J+21-25. Caps recommandés : $200 (J0-30) → $500 (J31-90) → $1000 (J91-180) → $1500 (J181+).
**Impact si non tranché**: Coupure API Anthropic si scale atteint 100/j sans upgrade = perte production.
**Urgence**: Sprint A (décision maintenant, action à J+21-25)

---

## D17 — Google Business Profile : quand créer après adresse FR ?
**Contexte**: GBP est le levier principal du Local Pack Google. Vérification Google = 2-4 semaines (courrier ou appel). Prérequis : adresse physique vérifiable (D10).
**Options**:
- A: Dès adresse FR souscrite (2-4 semaines vérif → démarrer immédiatement)
- B: 3 mois après adresse (validation domicile — attente inutile)
- C: Après collecte 5 reviews clients (dépendance au CA)
**Reco Claude**: **A (Dès adresse souscrite)** — La vérification Google prend 2-4 semaines — autant démarrer dès D10 validé. Les reviews se collectent après création, pas avant.
**Impact si non tranché**: Local Pack inaccessible, K9 villes bloqué, trafic mobile FR manqué.
**Urgence**: Sprint A (dès D10 validé)

---

## D20 — Communication "transparence IA" : quelle stratégie ?
**Contexte**: AI Act article 50 (deadline 2026-08-02) impose déclaration contenu IA. AiContentDisclaimer minimal déjà implémenté. Opportunité d'en faire un avantage compétitif.
**Options**:
- A: Page dédiée /transparence-ia avec métriques publiques (modèle, volume, score moyen)
- B: Section blog éducative seule
- C: Silence (AiContentDisclaimer minimal — compliance uniquement)
**Reco Claude**: **A (Page /transparence-ia)** — Trust signal B2B fort + AEO booster AI Overviews + asset pitch presse D16. Blog éducatif (B) complémentaire à combiner avec A. Option C = gâche une opportunité différenciante.
**Impact si non tranché**: E-E-A-T sous-optimal, pitch presse sans asset, AI Overviews eligibility faible.
**Urgence**: Sprint A (synergique deadline AI Act)

---

## DÉCISIONS MOYEN TERME (Sprint B-C — J+60–J+180)

## D14 — Bilingue EN locale : quelle priorité ?
**Contexte**: Locale EN désactivé depuis 2026-05-16 (bug next-intl v4.11 + Next.js 16.2, boucle 307 self-redirect). Code complet et messages EN en place, mais bug bloquant non résolu.
**Options**:
- A: Prioritaire Q3 2026 (sprint dédié next-intl fix dès juillet)
- B: Prioritaire Q4 2026 (après stabilisation scale FR)
- C: Reporté 2027 (FR-only long terme)
- D: Jamais (FR-only définitif, simplification code)
**Reco Claude**: **D — ✅ DÉCISION WILL 2026-05-22** : FR uniquement, pas d'anglais prévu pour l'instant. Le code EN existant reste en place (réactivable en 1 env var si Will change d'avis), aucun sprint EN à planifier.
**Impact**: Zéro perte court terme — marché cible est FR. Réactivation future possible sans coût majeur.
**Urgence**: Aucune (décision figée)

---

## D16 — Backlinks autorité FR : quelle stratégie ?
**Contexte**: E-E-A-T et DA d'axion-ia.com actuellement faibles. Backlinks qualité = levier principal pour requêtes compétitives IA FR.
**Options**:
- A: Pitch presse JDN/Frenchweb (1-2/trimestre)
- B: Articles invités blogs IA FR (2/mois)
- C: Conférences Will (VivaTech, AI Summit Paris, 1-2/an)
- D: Combinaison A+B+C (1 action/mois, cadence réaliste)
**Reco Claude**: **D (Combinaison A+B+C)** — E-E-A-T est cumulatif, aucun canal seul ne suffit. 1 action/mois = rythme réaliste. En 6 mois : ~6 backlinks haute autorité + mentions presse + bio conférence.
**Impact si non tranché**: DA stagne, AI Overviews eligibility faible, requêtes compétitives hors portée.
**Urgence**: Sprint B (cadence mensuelle)

---

## D22 — comparison.ts : lever le no-table gate ?
**Contexte**: Gate no-table global interdit les tableaux dans tous les générateurs. Or les articles comparatifs sans tableau sont moins utiles et non éligibles aux Featured Snippets Google (format tableau = rich result).
**Options**:
- A: Exception ciblée au gate no-table pour comparison.ts uniquement
- B: Garder no-table global (renonce aux Featured Snippets comparaison — listes/prose)
- C: Créer un type `comparison-table.ts` séparé avec gate propre
**Reco Claude**: **A (Exception localisée comparison.ts)** — Le gate no-table cible les "tableaux Wikipedia" génériques. Les tableaux de comparaison (ChatGPT vs Mistral vs Claude) sont le format naturel attendu. Exception ciblée = gate reste actif sur tous les autres générateurs. Potentiel +20-30 pts D-Visi Featured Snippets. Option C = over-engineering pour 1 seul générateur.
**Impact si non tranché**: comparison.ts génère des listes moins lisibles, Featured Snippets tableaux manqués (-20-30 pts D-Visi).
**Urgence**: Sprint B (comparison.ts implémentation)

---

## DÉCISIONS LONG TERME (Sprint D-E — Q4 2026+)

## D15 — Audit content-gen 2027 : Claude autopilot ou cabinet externe ?
**Contexte**: Audit annuel pour maintenir qualité et conformité du pipeline. Question du conducteur.
**Options**:
- A: Autopilot Claude (méthode P1-P6 reproductible, ~$50-100 tokens, $0 extra)
- B: Cabinet externe ~5K€ (preuve audit tiers, crédibilité B2B)
- C: Hybride Claude audit + 1j consultant validation (~1-2K€)
**Reco Claude**: **A (Autopilot Claude)** — Méthode éprouvée, documentée, reproductible. Score comparatif parfaitement calibré. Option B justifiable seulement si Axion-IA vend des audits IA (signal légitimité externe).
**Impact si non tranché**: Pas d'audit 2027 = conformité non vérifiée, dette qualité silencieuse.
**Urgence**: Long terme (>12 mois)

---

## D18 — Voyage AI RAG sémantique réel : activer ?
**Contexte**: Pipeline actuel = FTS Postgres + SHA-256 + OpenAI text-embedding-3-large (D-W4). Voyage AI = couche d'embeddings additionnels pour RAG sémantique (~$0.10/1000 docs).
**Options**:
- A: Oui Q3 2026 (~15h dev, +12 pts D-Archi, +20 pts D-Qual)
- B: Reporter Q4 2026 (après KB sectorielle 4 verticales, preuves de besoin)
- C: Jamais pour l'instant (KB FTS Postgres suffit, OpenAI déjà en place)
**Reco Claude**: **B (Reporter Q4 2026)** — KB sectorielle (D9) doit d'abord enrichir la base factuelle. OpenAI text-embedding-3-large déjà en place. Voyage AI = double couche non justifiée avant preuve de besoin sur KPIs qualité. Reconsidérer Q4 si KPIs qualité stagnent après KB.
**Impact si non tranché**: Pas de régression — FTS + OpenAI couvre 95 % des besoins actuels.
**Urgence**: Long terme (Sprint D)

---

## D19 — Domain strategy EN (si D14 = A ou B) ?
**Contexte**: Si locale EN réactivé (D14), architecture URL à choisir. proxy.ts + routing.ts configurés pour /en/ déjà en place.
**Options**:
- A: Sous-domaine en.axion-ia.com (divise autorité domaine — Google traite comme site séparé)
- B: Chemin /en/ (proxy.ts déjà configuré, SEO authority consolidé sur axion-ia.com)
- C: Domaine séparé axion-ai.com (pire SEO — divise autorité sur 2 domaines)
**Reco Claude**: **B (Chemin /en/ — déjà configuré)** — Implémentation existante dans proxy.ts, zéro effort supplémentaire. Options A et C diluent l'autorité domaine construite sur axion-ia.com.
**Impact si non tranché**: Conditionnel à D14. Si D14=B (Q4), à réviser en Sprint D.
**Urgence**: Long terme (conditionnel D14)

---

## RÉSUMÉ POUR WILL

**One-liner si toutes recommandations Claude acceptées :**
```
D8=C, D9=D, D10=A, D11=A, D12=B, D13=C, D14=D, D15=A, D16=D, D17=A, D18=B, D19=B, D20=A, D21=A, D22=A
```

**Ou simplement : "Go recommandations Claude"** → pipeline continue avec les defaults ci-dessus.

---

**Chaînes de dépendances critiques** :
- `D10` (adresse) → `D17` (GBP) → `D21` (SIREN) = Local SEO complet
- `D11` (GSC) → `D-P5-3` (reporting email) → `D8` (rampe scale éclairée)
- `D13` (Sprint A go) → `D20` (transparence IA) → `D16` (pitch presse)
- `D14` (EN Q4) → `D19` (domain /en/)
- `D9` (KB 4 verticales) → `D18` (RAG seulement si KB insuffisante)

---

**Décisions les plus urgentes (à trancher dans les 7 prochains jours)** :
1. **D13** = C — Vérification légère 2h puis Sprint A (AI Act deadline J+72) — PRIORITÉ 1
2. **D11** = A — GSC service account JSON (30 min Will)
3. **D10** = A — Adresse FR Sedomicilier 30€/mois
4. **D21** = A — D-Ops prioritaire en Sprint A
