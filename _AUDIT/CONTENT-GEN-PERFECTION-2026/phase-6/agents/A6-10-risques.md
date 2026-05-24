# A6-10 — Analyse risques & mitigations

**Agent** : A6-10-risques  
**Phase** : 6 (verdict global)  
**Date** : 2026-05-22  
**Score pipeline** : ~3715/5000 (CONDITIONNEL)  
**Regime prod** : 30 articles/jour (rampe progressive active)  
**Source de vérité code** : HEAD e573da64

---

## Perimetre et methode

Audit des 8 risques identifies pour le pipeline content-gen Axion-IA en regime scale 30→500/j. Chaque risque est evalue selon :

- **Severite** : impact maximal si le risque se materialise
- **Probabilite** : vraisemblance dans les 12 prochains mois
- **Priorite** : produit severite × probabilite, ajuste par delai legal le cas echeant

Verification code systematique pour chaque mitigation declaree "acquise".

---

## Risques detailles

### R1 — Regression HCU Google (scaled content)

**Severite** : HAUTE | **Probabilite** : MOYENNE | **Priorite** : Haute

Google a declenche des mises a jour HCU (Helpful Content Updates) en 2022, 2023, 2024 et 2025 ciblant le contenu genere a grande echelle sans valeur ajoutee demonstrable. A 30/j, le risque est limite. A 500/j, il devient statistiquement significant.

**Mitigations acquises (verifiees dans le code) :**

- Rampe progressive 30→500 avec paliers automatiques base sur articles publies : `<60 art → 30/j`, `<300 → 100/j`, `<600 → 200/j`, `>=600 → 500/j`. Code confirme dans `content-publish-worker.ts` via `getEffectivePublishCap()`.
- `MAX_PUBLISH_PER_DAY` lisible depuis DB (`readContentGenConfig`) ET env var override — double securite.
- Drip window 8h-22h CET uniquement (constantes `DRIP_HOUR_START_CET = 8`, `DRIP_HOUR_END_CET = 22`). Signal publication "humain" preserve.
- `checkAnomalies()` operationnel dans `content-monitoring-worker.ts` : 3 checks business toutes les 15 min via `Promise.allSettled` (fail-soft). Check 1 : chute score qualite >15 pts sur 1h vs heure precedente. Checks 2-3 inclus.
- LLM-judge multi-dimensions avec seuil REJECT < 6.0 — filtre editorialcote generation.
- Weekly report worker (`content-weekly-report-worker.ts`) collecte `avgQualityScore`, `rejected`, `quarantined`, anomalies.

**Mitigations restantes (actions recommandees) :**

- Tableau de bord GSC Impressions/CTR/Position hebdomadaire avec alerte si drop >20% sur les 15 pages strategiques (non automatise — action manuelle Will).
- Seuil alerte automatique GSC via API Search Console pas encore implemente (J+90 recommande).
- Diversification types de contenu a 300/j : mix blog + FAQ + comparatifs + cas-concrets pour eviter pattern algorithmique.
- Audit HCU trimestriel (premier : J+90 apres passage 100/j).

**Delai action** : Monitoring GSC = Immediat. Audit HCU = J+90.

---

### R2 — Derive cout LLM au-dela du budget

**Severite** : MOYENNE | **Probabilite** : MOYENNE | **Priorite** : Moyenne

A 500/j × ~$0.02/article moyen (Sonnet 4.6) = $10/j = $300/mois. Hors pic ou retry storms, le budget peut etre depasse si les caps mensuels ne sont pas remontes avec le volume.

**Mitigations acquises (verifiees dans le code) :**

- `cost-tracker.ts` implemente le cycle complet : `assertCostCapAvailable()` pre-call avec check 80% → alerte Telegram `MONITORING`, check 100% → `handleCostCapHit()` cascade : disable provider + Telegram `INCIDENT` + kill switch global si plus aucun provider `role=text` actif.
- `trackCost()` transactionnel atomic (Prisma `$transaction`) : un seul row `CostLedger` + increment `currentMonthSpentUsd` — zero desynchro possible.
- `resetMonthlyCostCounters()` pour cron 1er du mois.
- Alertes Telegram fonctionnelles (tag `MONITORING` + `INCIDENT`).
- Trail d'audit `cost_cap_events` (50 derniers evenements) accessible depuis dashboard admin `/content-gen/settings/providers`.

**Mitigations restantes (actions recommandees) :**

- Upgrade cap mensuel Anthropic Console avant passage 100/j (D12 — action Will). Cap actuel inconnu — verifier dans Anthropic Console.
- Ajouter un budget alert Anthropic natif (email Anthropic a 80% cap) en complement du Telegram applicatif.
- `resetMonthlyCostCounters()` : verifier que le cron 1er du mois est bien schedule dans le worker cron (non visible dans le code inspecte).
- Dashboard cout mensuel projete (actuel × 30 / jours ecoules) pour anticipation.

**Delai action** : Upgrade cap Anthropic = avant J+30 (passage 100/j selon rampe). Cron reset = Immediat si pas encore schedule.

---

### R3 — Changement algo Google SGE / AI Overviews

**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

Google AI Overviews evolue trimestriellement. Un site bien reference peut perdre des clics organiques si Google "absorbe" la reponse dans ses AI Overviews. A contrario, les sources citees par les AI Overviews gagnent en autorite.

**Mitigations acquises (verifiees dans le code) :**

- `FAQPage` JSON-LD implemente (confirme dans `faq-standalone.ts`, pages `/faq/[slug]`).
- `QAPage` implemente via `qa-derived.ts`.
- `speakable` implemente (confirme dans `seo-content-gen-factories.ts`, `lib/seo.ts`).
- `AuthorByline` composant present dans `components/knowledge/public/AuthorByline.tsx` — signal EEAT.
- `AiContentDisclaimer` composant present dans `components/marketing/AiContentDisclaimer.tsx` — transparence et signal EEAT renforce.

**Mitigations restantes (actions recommandees) :**

- Strategie backlinks autorite FR : 3-5 mentions presse B2B (Les Echos, JDN, L'Usine Digitale) — non engage a ce jour.
- Suivi Citations AI Overviews via outil dedie (ex. AI Overview Tracker) — pas implemente.
- Schema `isBasedOn` pour articles avec sources primaires : verifie present dans `seo-content-gen-factories.ts`, a valider sur 100% des generators.
- Veille Google algo : abonnement Search Central Blog RSS → Telegram (non automatise).

**Delai action** : J+180 (risque faible, impact indirect).

---

### R4 — Non-conformite AI Act art. 50 (deadline 2026-08-02 = J+72)

**Severite** : CRITIQUE | **Probabilite** : FAIBLE | **Priorite** : Critique (deadline ferme)

L'article 50 de l'AI Act impose : (a) divulgation claire que le contenu est genere par IA si perceptible comme tel par un humain moyen, (b) marquage des deepfakes. Deadline d'application : 2026-08-02. Amende maximale : 7.5M€ ou 1.5% CA mondial.

**Mitigations acquises (verifiees dans le code) :**

- `AiContentDisclaimer` composant present et deploye sur les pages articles (confirme dans `blog/[slug]/page.tsx`, `guides/[slug]/page.tsx`, `cas-concrets/[slug]/page.tsx`, `glossaire/[slug]/page.tsx`, etc.).
- `aiGenerated: true` dans JSON-LD (confirme dans `seo-content-gen-factories.ts` et generators).
- `GenerationProvenance` table et service `provenance-logger.ts` operationnels — trace audit complete : promptHash reel, model, timestamp, cost.
- `promptHash` reel implementé (confirme dans 9 generators + `content-gen-worker.ts`).
- Schema Prisma avec contrainte `RESTRICT` sur les relations de provenance (R6 critique note dans verdict P6, corrige commit e573da64).
- Route RGPD droit a l'oubli `/api/admin/articles/[id]/forget` presente.

**Mitigations restantes (actions recommandees) :**

- Check manuel J+72 (avant 2026-08-02) : parcourir 5 articles publies en prod, verifier que `AiContentDisclaimer` s'affiche visuellement et que le JSON-LD `aiGenerated:true` est present en source.
- Verifier la page `/charte-editoriale` a jour avec mention explicite AI Act art. 50.
- Si scale > 100/j avant J+72 : accelerer l'audit de conformite.
- DPA (Data Processing Agreement) avec Anthropic — reporté (decision Will) : a signer avant J+180 pour conformite RGPD complete.

**Delai action** : Check conformite = J+72 au plus tard (2026-08-02). DPA = J+180.

---

### R5 — Concurrent axionai.fr capture brand

**Severite** : MOYENNE | **Probabilite** : MOYENNE | **Priorite** : Moyenne

Un concurrent homonyme ou un typosquatter pourrait capturer les recherches branded "Axion IA" et confondre les prospects. La non-presence sur Wikidata (decision Will ferme) laisse la definition de l'entite aux moteurs seuls.

**NOTE : Wikidata = decision Will ferme (renoncement). Ce risque est documente comme "decision assumee, hors scope action technique".**

**Mitigations acquises (verifiees dans le code) :**

- `alternateName` implemente dans `lib/brand.ts` et `lib/seo.ts` (confirme).
- `legalName` implemente (confirme dans les memes fichiers).
- JSON-LD Organization avec `sameAs` vers domaine canonique `axion-ia.com`.
- Hreflang sur toutes les pages strategiques (FR canonique).

**Mitigations restantes (actions recommandees) :**

- Google Business Profile (GBP) : creation apres adresse physique FR confirmee (D10 — decision Will pendante).
- Mention presse B2B FR pour ancrage entite dans l'index de connaissances Google (non Wikidata).
- Backlinks autorite depuis partenaires certifies (organismes formation, associations IA FR).
- Surveiller les resultats Google branded "Axion IA" hebdomadairement.

**Delai action** : GBP = apres D10. Monitoring branded = Immediat.

---

### R6 — Crash worker BullMQ / double publication

**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

Un crash worker pendant la phase post-generation (avant ou pendant la publication) pourrait entrainer une double publication ou un job zombie. Les doublons SEO degradent l'autorite du domaine.

**Mitigations acquises (verifiees dans le code) :**

- `lockDuration: 120_000` (2 min) dans `content-gen-worker.ts` — etendu par rapport au defaut BullMQ 30s, couvre les appels LLM longs (30-90s).
- Redis `INCR` atomique pour compteurs journaliers (confirme dans `content-publish-worker.ts`).
- Saga post-publish implemente (le flow publie en transaction Prisma + IndexNow + Google Indexing API).
- Keyword lock cleanup (confirme via Grep `lockDuration` dans `content-quality-improver-worker.ts`).
- `removeOnFail: { count: 26 }` et `removeOnComplete` configures — evite saturation Redis sur high-volume.

**Mitigations restantes (actions recommandees) :**

- Test de chaos : simuler crash worker pendant publication (non realise). A faire en staging avant passage 200/j.
- Monitoring BullMQ dashboard (Bull Board) : verifier que les jobs `stalled` sont alertes.
- Verifier que `lockDuration: 120_000` est aussi present dans `content-publish-worker.ts` (non confirme lors de l'inspection — lockDuration non trouve dans ce fichier specifiquement).

**Delai action** : Chaos test = J+60. Check lockDuration publish-worker = Immediat.

---

### R7 — Drift qualite editoriale a 500/j

**Severite** : MOYENNE | **Probabilite** : MOYENNE | **Priorite** : Haute

A haut volume, la qualite editoriale peut deriver : repetition de structures, perte de specificite metier, dilution du brand-voice. Le LLM-judge peut lui-meme deriver si son prompt n'est pas verifie periodiquement.

**Mitigations acquises (verifiees dans le code) :**

- `brand-voice.ts` implemente comme SSOT et injecte dans tous les 8 generators (confirme via Grep dans `blog-article.ts`, `guide-pilier.ts`, `landing-ville.ts`, `comparison.ts`, etc.).
- `llm-judge.ts` operationnel avec 7 dimensions : `factual_accuracy`, `depth`, `originality`, `readability`, `seo_completeness`, `value_to_reader`, `tone_axionia_alignment`.
- Seuils fermes : publish >= 8.5, improve 6.0-8.4, reject < 6.0. Constante `JUDGE_THRESHOLDS.IMPROVE_MIN = 6.0` et `PUBLISH_MIN = 8.5` verifiees dans `llm-judge.ts`.
- `checkAnomalies()` : check 1 = chute score qualite >15 pts sur 1h vs heure precedente, avec alerte Telegram.
- Weekly report : `avgQualityScore`, `rejected`, `quarantined` collectes et envoyes par email.
- Quarantaine `quarantined_critical` et `quarantined_factcheck` statuts Prisma.

**Mitigations restantes (actions recommandees) :**

- Monitoring tonalite automatise (weekly) : le rapport hebdo envoie `avgQualityScore` mais pas de breakdown par type de contenu (blog vs FAQ vs guide) — enrichir le rapport.
- Review humain mensuel : Will lire 5-10 articles publies aleatoirement — non formalise dans un process.
- Self-judge bias : le generator et le judge utilisent tous deux Claude Sonnet 4.6. Envisager un judge sur un modele distinct (ex. GPT-4o) pour les articles a score borderline (6.0-7.0).
- Drift prompt LLM-judge : verifier le prompt du judge trimestriellement vs nouvelles guidelines HCU Google.

**Delai action** : Enrichissement weekly report = J+30. Review humain mensuel = Immediat (process a formaliser).

---

### R8 — Dependance API Anthropic (vendor lock-in)

**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

Une indisponibilite Anthropic prolongee (>4h) bloque completement la generation. Une hausse tarifaire Anthropic significative impacte le business model.

**Mitigations acquises (verifiees dans le code) :**

- Architecture multi-provider via `ProviderConfig` et `ProviderKey` enum — la table DB permet d'ajouter des providers sans code change.
- `handleCostCapHit()` desactive le provider et laisse la fallback chain prendre le relais automatiquement.
- `AI_MODEL_DISCLOSURE_NAME` env var declaree dans le code (permet de changer le nom affiche sans redeploy).
- Kill switch global avec desactivation grace (`ContentGenConfig.kill_switch`) — la production ne crashe pas, elle se met en pause proprement.

**Mitigations restantes (actions recommandees) :**

- Provider de fallback concret : ajouter OpenAI GPT-4o-mini comme provider `role=text` secondaire dans `ProviderConfig` (seed DB). La logique applicative supporte deja le fallback — seul le seed manque.
- SLA monitoring Anthropic : abonnement au status page Anthropic (`status.anthropic.com`) avec alerte webhook → Telegram.
- Test de basculement provider : simuler une desactivation Anthropic en staging pour valider la fallback chain.
- Clause contractuelle : verifier les CGU Anthropic (30j preavis de changement tarifaire ?).

**Delai action** : Provider fallback seed = J+60. Monitoring SLA = J+30.

---

## Matrice de risques 3x3

```
                   PROBABILITE
                   Faible      Moyenne     Haute
                  ┌───────────┬───────────┬───────────┐
SEVERITE  Haute   │           │    R1     │           │
                  │           │ (HCU)     │           │
                  ├───────────┼───────────┼───────────┤
          Moyenne │ R3  R6  R8│  R2  R5  │   R7      │
                  │(SGE/Bul/V)│(Cout/Brand│(Qualite)  │
                  ├───────────┼───────────┼───────────┤
          Critique│    R4     │           │           │
                  │ (AI Act)  │           │           │
                  └───────────┴───────────┴───────────┘
```

**Lecture** : R4 est Critique/Faible → priorite absolue du fait de la deadline legale J+72, pas de la probabilite. R7 est le seul risque Moyenne/Haute → surveillance accrue en regime scale.

---

## Tableau recapitulatif

| ID  | Risque                        | Severite | Prob    | Priorite | Delai action   |
| --- | ----------------------------- | -------- | ------- | -------- | -------------- |
| R1  | Regression HCU Google         | HAUTE    | MOYENNE | Haute    | GSC = Immediat |
| R2  | Derive cout LLM               | MOYENNE  | MOYENNE | Moyenne  | J+30           |
| R3  | Changement algo SGE           | MOYENNE  | FAIBLE  | Basse    | J+180          |
| R4  | Non-conformite AI Act art. 50 | CRITIQUE | FAIBLE  | Critique | J+72 ferme     |
| R5  | Concurrent axionai.fr         | MOYENNE  | MOYENNE | Moyenne  | GBP post-D10   |
| R6  | Crash BullMQ / double pub     | MOYENNE  | FAIBLE  | Basse    | J+60           |
| R7  | Drift qualite 500/j           | MOYENNE  | HAUTE   | Haute    | J+30           |
| R8  | Vendor lock-in Anthropic      | MOYENNE  | FAIBLE  | Basse    | J+60           |

---

## Actions prioritaires (top 5)

1. **R4 — J+72** : check conformite AI Act manuel en prod (5 articles, verification visuelle `AiContentDisclaimer` + JSON-LD `aiGenerated:true`).
2. **R1 — Immediat** : setup monitoring GSC impressions/CTR weekly avec seuil alerte >20% drop.
3. **R7 — J+30** : formaliser review humain mensuel (5-10 articles aleatoires) + enrichir weekly report par type de contenu.
4. **R2 — J+30** : verifier et upgrader cap mensuel Anthropic Console avant passage 100/j.
5. **R6 — Immediat** : verifier presence de `lockDuration` dans `content-publish-worker.ts` (non confirme a l'inspection).

---

_Agent A6-10 — AUDIT-ONLY — 2026-05-22_
