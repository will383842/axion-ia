# PHASE 4 VERDICT — QUALITÉ ÉDITORIALE & TEMPLATES
## Date : 2026-05-21 | HEAD : 37ca0147 | Score P1.5 baseline : ~770-820/1000

---

## Score final : 438/800 → **547/1000 (extrapolé) — NO-GO 🔴**

> Seuils : GO ≥ 900 / CONDITIONNEL 750-899 / NO-GO < 750
> Score hors bonus : 425/770 (55.2%) | Score avec bonus A4-10 : 438/800 (54.8%)

---

## Tableau scores par agent

| Agent | Score Max | Score Obtenu | % | Verdict |
|---|---|---|---|---|
| A4-01 Templates 7 types | /120 | 52 | 43% | 🔴 NO-GO |
| A4-02 Qualité textuelle mesurable | /100 | 49 | 49% | 🔴 NO-GO |
| A4-03 Keyword dans le titre | /80 | 47 | 59% | 🟠 SPRINT |
| A4-04 KB & Fact-checking | /100 | 68 | 68% | 🟠 SPRINT |
| A4-05 Liens internes/externes/suggested | /80 | 34 | 43% | 🔴 NO-GO |
| A4-06 Brand voice & persona | /70 | 46 | 66% | 🟠 SPRINT |
| A4-07 LLM-judge calibration | /80 | 56 | 70% | 🟠 SPRINT |
| A4-08 Image hero pertinence | /70 | 39 | 56% | 🟠 SPRINT |
| A4-09 Bilingue FR/EN qualité | /70 | 34 | 49% | 🔴 NO-GO |
| A4-10 Feedback loop (bonus) | /30 | 13 | 43% | 🟡 partiel |
| **TOTAL** | **/800** | **438** | **54.8%** | **🔴 NO-GO** |

---

## Verdict GO/NO-GO automatique par dimension

| Critère NO-GO automatique | Verdict | Justification |
|---|---|---|
| Image générée par IA trouvée | ✅ CONFORME | Aucune trace DALL-E/Midjourney — règle absolue respectée |
| Taux keyword dans H1 < 60% | ⚠️ INCERTAIN | 0 articles disponibles en FS ; estimation code 70-85% ; plan SQL fourni |
| Absence totale de KB | ✅ CONFORME | KB existe (68/100), FTS fonctionnel, 1/5 verticales en fichier TS |
| Reviewer LLM 100% GO | ⚠️ INCERTAIN | Boucle improve cassée (SYS-3) → stats verdicts non fiables ; monitoring absent |
| Aucun AiContentDisclaimer | ❌ **PARTIEL** | Absent sur 39 pages /implantations/[ville] — **P0 AI Act** |

---

## P0 BLOQUANTS (résoudre avant toute publication à grande échelle)

### P0-1 : 4/9 générateurs sont des stubs landing-ville (A4-01)
- `comparison.ts`, `blog-from-rss.ts`, `qa-derived.ts`, `blog-from-title.ts` délèguent à `landing-ville-generator`
- Contenu RSS = contenu landing, contenu comparatif = contenu landing
- **Fix** : créer générateurs dédiés avec prompts distincts
- **Effort** : 2-3 jours

### P0-2 : Boucle improve ré-évalue le même contenu sans le modifier (A4-07)
- `content-quality-improver-worker.ts` : deux passes identiques → coût double, amélioration nulle
- Rend les stats REJECT/IMPROVE/GO non fiables
- **Fix** : passer `issues[]` du verdict 1 au prompt de ré-génération
- **Effort** : 4 heures

### P0-3 : Regex `internalLinkCount` compte 0 liens systématiquement (A4-05)
- Pattern Markdown appliqué sur HTML → SEO-score "liens internes" toujours 0
- `parseBody()` strip le HTML des articles DB → détruit les `<a href>` générés
- `citationCount` jamais passé à `computeSeoScore()` → sources toujours 0
- **Fix** : corriger regex + parseBody + câbler citationCount
- **Effort** : 2 heures

### P0-4 : 0 image hero assignée en production — mismatch slugs verticales (A4-08)
- `VERTICAL_TO_IMAGE_MODULE` : `"audit"` ≠ `"audits"`, `"interventions-formations"` ≠ `"interventions"`, etc.
- Query DB retourne 0 résultats → fallback générique systématique
- **Fix** : aligner les slugs + test intégration avec seed réel
- **Effort** : 1 heure

### P0-5 : AiContentDisclaimer absent sur 39 pages /implantations/[ville] (A4-06)
- Pages IA-assistées sans mention AI Act art. 50
- **Deadline légale : août 2026 (3 mois)**
- **Fix** : injecter dans city-layout.tsx + landing-ville-templates DOCTRINE_INTOUCHABLE
- **Effort** : 1 heure

### P0-6 : Quarantaine absente post-fact-check (A4-04)
- Un article avec `factCheckScore = 20/100` reste publié sans alerte ni blocage
- Verdicts individuels non persistés (seul score agrégé sauvé)
- RAG vectoriel non fonctionnel (Voyage AI stub SHA-256)
- **Fix** : gate factCheckScore < 50 → quarantaine, persister claims individuels
- **Effort** : 4 heures

### P0-7 : Reject silencieux après cap itérations (A4-07)
- Après 2 itérations, un REJECT (violation AI Act, SIREN hardcodé) atterrit en `needs_review` sans distinction ni escalade humaine
- **Fix** : distinguer REJECT-P0 (alerte immédiate) vs REJECT-qualité (needs_review)
- **Effort** : 2 heures

---

## P1 PRIORITAIRES (sprint 1-2 semaines)

| P1 | Agent | Description | Effort |
|---|---|---|---|
| P1-1 | A4-02 | Activer `OPENAI_EMBEDDINGS_ENABLED=true` en staging (déduplication sémantique) | 1h config |
| P1-2 | A4-03 | Ajouter instruction "keyword DOIT apparaître en H1" dans system prompts blog/landing/pilier | 45 min |
| P1-3 | A4-03 | Valider keyword dans `metaTitle` (balise `<title>` HTML) — actuellement non vérifié | 2h |
| P1-4 | A4-04 | Câbler Voyage AI vectoriel (vraie clé API) pour RAG sémantique | 2h |
| P1-5 | A4-06 | Créer fichier `brand-voice.ts` SSOT centralisé + injecter dans les 7 générateurs | 4h |
| P1-6 | A4-06 | Unifier persona auteur : résoudre incohérence blog "expert anonyme" vs loader "Manon" | 2h |
| P1-7 | A4-06 | Injecter les 60 termes du glossaire dans les prompts (expansion acronymes LLM/RAG/NLP) | 3h |
| P1-8 | A4-07 | Abaisser température reviewer de 0.2 → 0.0 pour cohérence maximale | 30 min |
| P1-9 | A4-07 | Ajouter monitoring distribution verdicts (GO/IMPROVE/REJECT) dans dashboard qualité | 4h |
| P1-10 | A4-08 | Gérer images secondaires pour guide_pilier et landing_ville (bodyHtml enrichi) | 6h |
| P1-11 | A4-09 | Fix hreflang layout.tsx (toujours déclare `en: "/en"` même si locale désactivée) | 1h |
| P1-12 | A4-05 | Créer catalogue URL pages existantes → injection liens internes contextuels (non LLM-dépendant) | 8h |
| P1-13 | A4-10 | Câbler `alertCampaignDone()` dans content-gen-worker.ts | 2h |
| P1-14 | A4-02 | Ajouter TTR (Type-Token Ratio, npm `natural`) + seuil > 0.70 | 4h |

---

## P2 POLISH (backlog long terme)

- A4-01 : Factoriser le system prompt de ton commun entre les 7 générateurs (DRY)
- A4-02 : Détection voix passive FR (npm `compromise`) — cible < 20%
- A4-02 : Variation longueur phrases (écart-type > 5) — rythme narratif
- A4-04 : Vérification 404 des URLs citées par Perplexity post-publication
- A4-05 : Composant frontend "Articles suggérés" (React, Schema ItemList) — actuellement absent
- A4-07 : Reviewer séparé avec contexte minimal vs même modèle (anti-biais self-judge)
- A4-08 : alt EN automatique (traduire altFr → altEn dans le pipeline)
- A4-08 : `figcaption` pour images secondaires (valeur éditoriale vs alt text)
- A4-09 : Worker de traduction EN quand `KB_LOCALE = fr_en` activé
- A4-09 : 747 keyword seeds EN distincts (longue traîne anglophone)
- A4-10 : Rapport hebdomadaire lundi 8h00 → email williamsjullin@gmail.com
- A4-10 : Active learning : réinjecter `reviewNotes` Will dans les re-prompts
- A4-10 : Détection dérive brand voice (embedding comparison vs articles référence)

---

## STOP & ASK WILL — Décisions canoniques

### D1 — Seuil LLM-judge REJECT
**Contexte :** Seuil REJECT actuel = 7.0 → taux de rejet théorique ~30%, trop élevé pour une factory de contenu. Recommandé : 6.0 (taux reject sain 10-20%).
- **Option A :** Conserver 7.0 (si Will veut une qualité maximale dès le départ, quitte à rejeter 30%)
- **Option B :** Abaisser à 6.0 (équilibre qualité/volume — recommandé)
- **Option C :** Abaisser à 5.5 (priorité volume, qualité minimale garantie)

### D2 — Nombre d'itérations improve
**ATTENTION :** Fixer d'abord SYS-3 (boucle cassée). Ensuite :
- **Option A :** 2 itérations (économie ~30% tokens)
- **Option B :** 3 itérations pour pilier + landing uniquement (coût +15%)
- **Option C :** 3 itérations pour tous les types (coût +30%)

### D3 — Persona auteur E-E-A-T
**Contexte :** Manon est définie en JSON-LD mais les generators blog utilisent "expert contenu Axion-IA" anonyme → incohérence E-E-A-T.
- **Option A :** "Équipe Axion-IA" générique (simple, compatible RGPD)
- **Option B :** Persona Manon unifié sur tous les types (cohérence maximale)
- **Option C :** Will Jullin nommément (autorité E-E-A-T forte si confort public)

### D4 — Wording mention humaine AI Act ⚠️ URGENT (deadline août 2026)
**Wording actuel :** "Cet article a été rédigé avec l'assistance de l'IA et relu par l'équipe Axion-IA."
- **Option A :** Conserver wording actuel (conforme art. 50 minimum)
- **Option B :** Ajouter "généré avec Claude Sonnet 4.6 (Anthropic)" — option légale maximale, transparence totale
- **Option C :** Ajouter opt-out training (RGPD + AI Act combiné) — complexité +

### D5 — Reporting qualité hebdomadaire Will
**Contexte :** Données disponibles en DB, 0 rapport automatique actuellement. `alertCampaignDone()` codée mais jamais appelée.
- **Option A :** Email automatique lundi 8h00 → williamsjullin@gmail.com
- **Option B :** Dashboard admin `/content-gen/quality` uniquement (déjà partiellement en place)
- **Option C :** Telegram + dashboard (canal Telegram Axion-IA déjà utilisé pour alertes)

### D6 — Priorité sprint correctif P4 ← DÉCISION CLEF
**Contexte :** Score 438/800 = NO-GO 🔴. 7 P0 identifiés dont 5 sont des quick wins (< 4h chacun). Les P0 sont indépendants de Phase B.
- **Option A :** Sprint correctif P4 immédiat (~2 jours pour les 7 P0 + quick wins)
- **Option B :** Finir Phase B d'abord, puis sprint P4 (~24-32h délai)
- **Option C ⭐ Recommandée :** Traiter P0-3/4/5/7 (total ~4h, quick wins purs) en parallèle de Phase B, puis P0-1/2/6 après Phase B

---

## Prochaine étape recommandée

**Sprint correctif P4-QUICK (Option C recommandée) — 4h** :
1. Fix regex internalLinkCount (P0-3) — 30 min
2. Fix mismatch slugs image hero (P0-4) — 1h
3. Inject AiContentDisclaimer city-layout (P0-5) — 1h
4. Fix reject silencieux tier-decisions (P0-7) — 2h

Puis, en parallèle de Phase B :
5. Fix boucle improve (P0-2) — 4h
6. Quarantaine fact-check (P0-6) — 4h

Enfin, post-Phase B :
7. Générateurs dédiés comparatif + rss-based (P0-1) — 2-3j

**Score projeté après sprint P4-QUICK** : ~500/800 → ~625/1000 (encore CONDITIONNEL 🟡)
**Score projeté après sprint P4-COMPLET** : ~620/800 → ~775/1000 (CONDITIONNEL 🟡 limite GO)

---

*Audit Phase 4 — 10 agents parallèles — 2026-05-21 — Axion-IA content-gen qualité éditoriale*
*AUDIT-ONLY : zéro commit, zéro modification source*
