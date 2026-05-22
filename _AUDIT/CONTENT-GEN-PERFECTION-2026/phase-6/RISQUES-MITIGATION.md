# RISQUES-MITIGATION — Content-Gen Perfection 2026

**Pipeline** : Content-Gen Axion-IA  
**Date audit** : 2026-05-22  
**Score** : ~3715/5000 CONDITIONNEL  
**Regime prod** : 30 articles/jour (rampe progressive 30→500 active)  
**HEAD** : e573da64  
**Source detaillee** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/agents/A6-10-risques.md`

---

## Synthese executive

Le pipeline est en production avec des mitigations solides sur les 8 risques identifies. **Aucun risque n'est en etat "non mitige"**. Les 2 risques prioritaires (R4 AI Act + R7 Qualite scale) ont des actions concretes a declencher dans les 30 prochains jours.

**Verdict risques** : CONDITIONNEL — GO sous reserve de 5 actions prioritaires listees ci-dessous.

---

## Risques par niveau de priorite

### Priorite 1 — Actions immediates ou J+30

#### R4 — Non-conformite AI Act art. 50 (deadline J+72 = 2026-08-02)
**Severite** : CRITIQUE | **Probabilite** : FAIBLE | **Priorite** : Critique

**Mitigations acquises :**
- `AiContentDisclaimer` composant deploye sur blog, guides, cas-concrets, glossaire, presse, centre-aide
- `aiGenerated: true` dans JSON-LD (tous les generators)
- `GenerationProvenance` + `provenance-logger.ts` : trace audit complete (promptHash reel, model, cost)
- Route RGPD droit a l'oubli `/api/admin/articles/[id]/forget` operationnelle
- Schema Prisma RESTRICT sur relations provenance (commit e573da64)

**Mitigations restantes (actions recommandees) :**
- Check conformite manuel avant 2026-08-02 : 5 articles prod, verification `AiContentDisclaimer` visible + JSON-LD `aiGenerated:true` en source
- Verifier `/charte-editoriale` mention AI Act art. 50 explicite
- DPA Anthropic (reporte J+180 — decision Will)

**Delai action** : J+72 au plus tard (2026-08-02). NON NEGOCIABLE.

---

#### R1 — Regression HCU Google (scaled content)
**Severite** : HAUTE | **Probabilite** : MOYENNE | **Priorite** : Haute

**Mitigations acquises :**
- Rampe progressive automatique : 30/j → 100/j → 200/j → 500/j basee sur articles publies
- `MAX_PUBLISH_PER_DAY` DB + env var override (double securite)
- Drip window 8h-22h CET — signal "publication humaine"
- `checkAnomalies()` toutes les 15 min (chute score qualite, reject spike, pipeline stall)
- LLM-judge REJECT < 6.0 : filtre editorial pre-publication

**Mitigations restantes (actions recommandees) :**
- Setup GSC impressions/CTR weekly avec alerte si drop >20% sur les 15 pages strategiques
- Diversification types de contenu a 300/j (mix blog + FAQ + comparatifs + cas-concrets)
- Audit HCU trimestriel (premier : J+90 apres passage 100/j)

**Delai action** : Monitoring GSC = Immediat. Audit HCU = J+90.

---

#### R7 — Drift qualite editoriale a 500/j
**Severite** : MOYENNE | **Probabilite** : HAUTE | **Priorite** : Haute

**Mitigations acquises :**
- `brand-voice.ts` SSOT injecte dans les 8 generators
- LLM-judge 7 dimensions, seuils : publish >= 8.5 / improve 6.0-8.4 / reject < 6.0
- `checkAnomalies()` : alerte Telegram si chute score >15 pts sur 1h
- Weekly report : `avgQualityScore`, `rejected`, `quarantined` par email

**Mitigations restantes (actions recommandees) :**
- Formaliser review humain mensuel : Will lit 5-10 articles aleatoires → process ecrit
- Enrichir weekly report avec breakdown par type de contenu (blog vs FAQ vs guide vs landing-ville)
- Envisager judge sur modele distinct pour articles borderline 6.0-7.0 (anti self-judge bias)
- Verifier prompt LLM-judge vs nouvelles guidelines HCU Google trimestriellement

**Delai action** : Process review humain = Immediat. Enrichissement rapport = J+30.

---

#### R2 — Derive cout LLM au-dela du budget
**Severite** : MOYENNE | **Probabilite** : MOYENNE | **Priorite** : Moyenne

**Mitigations acquises :**
- `assertCostCapAvailable()` pre-call : alerte Telegram a 80%, desactivation + kill switch a 100%
- `trackCost()` transactionnel atomic — zero desynchro
- Trail d'audit `cost_cap_events` (50 derniers evenements) dashboard admin
- `resetMonthlyCostCounters()` pour cron 1er du mois

**Mitigations restantes (actions recommandees) :**
- Upgrader cap mensuel Anthropic Console avant passage 100/j (D12 — action Will)
- Ajouter budget alert Anthropic natif en complement du Telegram applicatif
- Verifier que le cron `resetMonthlyCostCounters()` est bien schedule (confirmer dans cron-worker)

**Delai action** : Upgrade cap = avant J+30. Cron reset = Immediat si non schedule.

---

### Priorite 2 — Actions J+60 a J+90

#### R5 — Concurrent axionai.fr capture brand
**Severite** : MOYENNE | **Probabilite** : MOYENNE | **Priorite** : Moyenne

**NOTE : Wikidata = decision Will ferme (renoncement). Document comme decision assumee, hors scope action technique.**

**Mitigations acquises :**
- `alternateName` + `legalName` dans JSON-LD Organization (`lib/brand.ts`, `lib/seo.ts`)
- `sameAs` vers domaine canonique `axion-ia.com`
- Hreflang FR canonique sur pages strategiques

**Mitigations restantes (actions recommandees) :**
- Google Business Profile (GBP) apres adresse FR confirmee (D10)
- Mentions presse B2B FR (ancrage entite index de connaissances Google, non Wikidata)
- Monitoring SERP branded "Axion IA" hebdomadaire

**Delai action** : GBP = apres D10. Monitoring branded = Immediat.

---

#### R6 — Crash worker BullMQ / double publication
**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

**Mitigations acquises :**
- `lockDuration: 120_000` dans `content-gen-worker.ts` (2 min vs defaut 30s)
- Redis INCR atomique pour compteurs journaliers
- Saga post-publish transactionnel (Prisma + IndexNow + Google Indexing)
- `removeOnFail: { count: 26 }` + `removeOnComplete` configures

**Mitigations restantes (actions recommandees) :**
- Verifier `lockDuration` dans `content-publish-worker.ts` (non confirme a l'inspection code)
- Test de chaos : simuler crash worker pendant publication en staging avant 200/j
- Monitoring BullMQ jobs stalled (Bull Board ou alerte custom)

**Delai action** : Verification lockDuration = Immediat. Chaos test = J+60.

---

#### R8 — Dependance API Anthropic (vendor lock-in)
**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

**Mitigations acquises :**
- Architecture multi-provider (`ProviderConfig`, `ProviderKey`) — extensible sans code change
- Fallback chain automatique si provider desactive
- Kill switch global gracieux (pause, pas crash)
- `AI_MODEL_DISCLOSURE_NAME` env var (changement modele affiche sans redeploy)

**Mitigations restantes (actions recommandees) :**
- Ajouter OpenAI GPT-4o-mini comme provider `role=text` secondaire dans le seed DB
- Monitoring SLA Anthropic `status.anthropic.com` → webhook Telegram
- Test de basculement provider en staging

**Delai action** : Provider fallback seed = J+60. Monitoring SLA = J+30.

---

### Priorite 3 — Actions J+180 ou vigilance continue

#### R3 — Changement algo Google SGE / AI Overviews
**Severite** : MOYENNE | **Probabilite** : FAIBLE | **Priorite** : Basse

**Mitigations acquises :**
- `FAQPage` + `QAPage` + `speakable` JSON-LD operationnels
- `AuthorByline` EEAT signal deploye
- `AiContentDisclaimer` transparence (signal EEAT renforce depuis 2025)
- `isBasedOn` schema dans `seo-content-gen-factories.ts`

**Mitigations restantes (actions recommandees) :**
- Strategie backlinks autorite FR (Les Echos, JDN, L'Usine Digitale)
- Suivi Citations AI Overviews
- Veille Google algo via Search Central Blog RSS → Telegram

**Delai action** : J+180 (risque faible, impact indirect).

---

## Matrice risques 3x3

```
                        PROBABILITE
                  Faible      Moyenne      Haute
               ┌───────────┬────────────┬──────────┐
 C R I T I Q U E│    R4     │            │          │
 (amende legal) │ AI Act    │            │          │
               ├───────────┼────────────┼──────────┤
 H A U T E     │           │    R1      │          │
 (trafic/revenu)│           │  HCU Goo  │          │
               ├───────────┼────────────┼──────────┤
 M O Y E N N E │ R3  R6  R8│  R2   R5  │   R7     │
 (partiel/cout) │SGE/Bul/Lock│Cout/Brand│Qualite   │
               └───────────┴────────────┴──────────┘
```

**Zones d'action prioritaire** :
- Critique/Faible (R4) : deadline legale non negociable → traiter en premier
- Haute/Moyenne (R1) : risque business fort → monitoring ongoing
- Moyenne/Haute (R7) : seul risque combinant impact et probabilite eleve → process continu

---

## Checklist actions par horizon

### Immediat (avant J+7)
- [ ] R4 : verifier `lockDuration` dans `content-publish-worker.ts`
- [ ] R1 : configurer monitoring GSC impressions/CTR weekly
- [ ] R5 : setup monitoring SERP branded "Axion IA"
- [ ] R2 : verifier que cron `resetMonthlyCostCounters()` est schedule
- [ ] R7 : formaliser process review humain mensuel (5-10 articles)

### J+30
- [ ] R2 : upgrader cap mensuel Anthropic Console avant 100/j
- [ ] R7 : enrichir weekly report breakdown par type de contenu
- [ ] R8 : abonnement monitoring SLA Anthropic → Telegram

### J+60 a J+72
- [ ] R4 : check conformite AI Act manuel (5 articles prod, visuel + JSON-LD)
- [ ] R4 : verifier `/charte-editoriale` mention art. 50 explicite
- [ ] R6 : test de chaos crash worker en staging
- [ ] R8 : ajouter provider fallback OpenAI seed DB

### J+90
- [ ] R1 : audit HCU trimestriel (apres passage 100/j)
- [ ] R7 : review prompt LLM-judge vs nouvelles guidelines HCU

### J+180
- [ ] R4 : DPA Anthropic (decision Will)
- [ ] R3 : backlinks autorite FR (3-5 mentions presse B2B)
- [ ] R5 : GBP apres adresse FR (D10)

---

## Risques non couverts (hors scope pipeline content-gen)

Les risques suivants ont ete identifies comme hors scope de ce pipeline et traites ailleurs :

- **Saturation disque VPS** : couvert par ADR 0026 (build GitHub Actions + GHCR)
- **Boucle 307 locale EN** : couvert par `src/proxy.ts` + decision reinactivation EN locale (AGENTS.md)
- **Coolify zombie queue** : couvert par `coolify-zombie-cleanup.yml` cron daily
- **Conformite RGPD generale** : couvert par Sprint securite-rgpd S+1 (PR #14)

---

*Document de synthese phase 6 — AUDIT-ONLY — 2026-05-22*  
*Source detaillee : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-6/agents/A6-10-risques.md`*
