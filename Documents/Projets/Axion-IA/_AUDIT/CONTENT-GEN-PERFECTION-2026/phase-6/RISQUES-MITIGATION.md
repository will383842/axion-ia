# RISQUES RÉSIDUELS & PLAN DE MITIGATION — Phase 6
## Date : 2026-05-22 (mise à jour P6.1) | HEAD : e573da64 (origin/main)
## Auditeur : A6-10 — AUDIT-ONLY

---

## MATRICE RISQUES

| # | Risque | Sévérité | Probabilité | Priorité | Statut |
|---|--------|----------|-------------|----------|--------|
| RE2 | Commits locaux non pushés | 🔴 Critique | 🟡 Moyenne | P0 IMMÉDIAT | `git push origin main` — 30 sec |
| R1 | HCU Google scaled content (>100/j) | 🔴 Critique | 🟡 Haute | P1 — Sprint B | 🟡 Mitigé partiellement (rampe + AiContentDisclaimer) |
| R4 | AI Act art. 50 — deadline J+72 (2026-08-02) | 🔴 Haute | 🟢 Faible* | P0 vérif J+72 | ✅ Conforme actuellement — vérif Sprint C obligatoire |
| R2 | Dérive coût LLM > budget | 🟡 Haute | 🟡 Moyenne | P2 — Sprint A-suite | 🟡 Mitigé — cap prod non configuré |
| R6 | Crash worker BullMQ double publication | 🟡 Haute | 🟢 Faible | P2 — Sprint A-suite | 🟡 content-publish-worker lockDuration à vérifier |
| R7 | Dérive qualité brand voice à scale | 🟡 Haute | 🟡 Moyenne | P2 — Sprint B | 🟢 9/9 generators — monitoring absent |
| R8 | Lock-in vendor Anthropic | 🟡 Haute | 🟢 Faible | P3 — Sprint C | 🟡 env var prête — fallback OpenAI non configuré |
| R5 | Concurrent axionai.fr capture brand | 🟡 Moyenne | 🟡 Haute | P2 — Will J+14 | ⚠️ GBP bloqué faute adresse FR |
| R3 | Changement algo Google SGE / AI Overviews | 🟡 Moyenne | 🟡 Haute | Surveillance | 🟢 AEO/FAQ/JSON-LD opérationnel |
| RE1 | SMTP Coolify non configuré | 🟡 Moyenne | 🔴 Certaine | Will urgent 15 min | ❌ weekly-report silencieux |
| RE3 | Vérif P5 non livrée — score D-Ops estimé | 🟢 Basse | 🟡 Haute | Sprint A-suite | 🟡 Partiellement comblé e573da64 |

*\*Probabilité faible actuellement car conforme — devient moyenne si dérive schema.prisma ou perte commit local*

---

## R1 — Google HCU Scaled Content Abuse

**Probabilité** : HAUTE (Google a pénalisé des sites IA-heavy en 2024-2025)
**Sévérité** : CRITIQUE (déindexation possible)
**Priorité mitigation** : Urgente (avant scale >100 art/j)
**État actuel** : Mitigé partiellement

Mitigations actives (HEAD e573da64) :
- D-W1 rampe progressive 30→200→500 via `getEffectivePublishCap()` ✅
- SimHash déduplication 4 couches ✅
- LLM-judge REJECT 6.0/60 ✅ (acquis e573da64)
- `AiContentDisclaimer` 100% pages IA ✅
- Drip window 8h-22h CET ✅
- brand-voice.ts SSOT 9/9 generators ✅

Résiduel non mitigé :
- Monitoring impressions GSC automatisé absent (gsc-client.ts câblé mais non branché en alerte)
- AuthorByline EEAT absent sur quelques pages (cas-concrets, landing villes)
- `factoryAutoPublishAllBlogTypes` flag non gardé par GSC gate

**Mitigation recommandée** :
- GSC monitoring automatisé K8 — alerte si <50% indexation pendant 2 semaines → pause auto publications
- Dashboard D-OPS badge rouge si K8 <70%
- AuthorByline EEAT toutes pages (1h — Sprint A)
- Révision manuelle 5 articles/semaine par Will (2h/mois)

**Sprint cible** : Sprint A pour AuthorByline ; Sprint B pour GSC automatisé

---

## R2 — Dérive coût LLM > budget

**Probabilité** : MOYENNE (scale difficile à anticiper)
**Sévérité** : HAUTE ($1500/mois à 500 art/j)
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé techniquement — cap prod non configuré

Mitigations actives (HEAD e573da64) :
- `cost-tracker.ts` avec alertes Telegram 80% budget ✅ (acquis e573da64)
- `handleCostCapHit()` désactivation provider + kill switch global ✅
- Désactivation automatique à 100% du cap mensuel ✅

Résiduel : Cap DB `ContentGenConfig.MAX_PUBLISH_PER_DAY` non configuré en Coolify prod avant scale >100/j. Dérive ponctuelle possible de $100-200 (latence Telegram ~5 min avant kill switch).

**Mitigation recommandée** :
- D12=B (Will J+30) : Upgrade cap Anthropic $1500/mois en Coolify avant scale
- Monitoring coût hebdo dans dashboard D-OPS (Sprint B — 3h)
- Alert seuil $1000/mois dans weekly-report email (Sprint A-suite — 1h)

**Sprint cible** : Will J+30 (D12) ; Sprint B pour dashboard

---

## R3 — Changement Google SGE / AI Overviews algo

**Probabilité** : HAUTE (Google change l'algo ~4x/an)
**Sévérité** : MOYENNE (content toujours indexé mais moins cités en AI Overviews)
**Priorité mitigation** : Surveillance continue
**État actuel** : Bien mitigé pour AEO/GEO court terme

Mitigations actives :
- AEO diversifié : speakable, FAQ, search_term_string, structured data ✅ (acquis P3+S+7)
- E-E-A-T Manon AuthorByline ✅ (acquis P3/P4)
- JSON-LD aiGenerated:true + AiContentDisclaimer ✅
- Monitoring SERP : manuel uniquement

**Mitigation recommandée** :
- Orienter production vers contenus navigationnels (marque + services) au-delà de l'informationnel
- Backlinks entités JSON-LD pour que axion-ia.com soit cité comme source dans AI Overviews
- Suivi Google Search Labs trimestriel (Will 30 min/trimestre)
- Ratio contenu humain/IA ≥ 30% (pages piliers Manon + Will)

**Sprint cible** : Surveillance continue — aucune action code immédiate

---

## R4 — Amende AI Act art. 50 non-conformité

**Probabilité** : BASSE (compliance acquise) → MOYENNE si dérive schema.prisma non pushé
**Sévérité** : HAUTE (jusqu'à €15M ou 3% CA)
**Priorité mitigation** : Urgente (deadline 2026-08-02 = J+72)
**État actuel** : Conforme actuellement — vérif J+72 obligatoire Sprint C

Mitigations actives (HEAD e573da64 + commits locaux) :
- `AiContentDisclaimer` permanent 100% pages IA ✅ (acquis 364f2c6)
- JSON-LD `aiGenerated:true` ✅ (acquis e0b1973)
- `promptHash` réel implémenté dans 9/9 generators ✅ (vérifié code A6-10 P6.0)
- `GenerationProvenance` table `onDelete: Restrict` en DB ✅ (acquis commit 023266f9 local)

ALERTE : schema.prisma RESTRICT non pushé → si machine défaillante avant push, risque de drift FK au prochain `prisma migrate dev`.

**Mitigation recommandée** :
- Push `git push origin main` IMMÉDIAT (30 sec) — sécurise schema.prisma RESTRICT
- Checklist compliance AI Act art. 50 complète avant J+72 (Sprint C — 2h)
- Test automatique assert FK `generation_provenance_article_id_fkey` = RESTRICT en CI (Sprint A-suite — 2h)

**Sprint cible** : Will IMMÉDIAT (git push) ; Sprint C pour checklist J+72

---

## R5 — Concurrence marque sans adresse FR

**Probabilité** : HAUTE (axionai.fr existe et capture potentielle brand)
**Sévérité** : MOYENNE (confusion marque possible)
**Priorité mitigation** : Normale
**État actuel** : Mitigé passivement — GBP bloqué faute d'adresse FR

Mitigations actives :
- `brand.ts` : `legalName: "Axion-IA"` + `alternateName: ["Axion IA", "AxionIA"]` ✅ (acquis P3)
- JSON-LD Organisation avec `sameAs` backlinks autorité ✅
- Wikidata : RENONCÉ (décision W-2 définitive assumée)

Résiduel : GBP non activable sans adresse FR. Sans Knowledge Panel Google propre, axionai.fr peut capturer "Axion IA" à horizon 6 mois si concurrent actif avec backlinks.

**Mitigation recommandée** :
- D10=A (Will J+14) : Sedomicilier ~30€/mois Paris 8e — débloque GBP + JSON-LD PostalAddress
- D17=A (Will J+30) : GBP vérifié + photos + posts mensuels (dès adresse souscrite)
- LinkedIn company page complète (Will J+7 — 1h)
- 2 mentions presse tier-2 FR minimum (JDN, BFM Business, Frenchweb) — Will J+30

**Sprint cible** : Will J+7 à J+30

---

## R6 — Crash worker BullMQ (double publication)

**Probabilité** : BASSE (mitigations acquises)
**Sévérité** : HAUTE (articles dupliqués, coût LLM doublé)
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé — content-publish-worker lockDuration à vérifier (gap D-C2 P6.1)

Mitigations actives (HEAD e573da64) :
- `lockDuration: 120_000` dans `content-gen-worker.ts:698` ✅
- `lockDuration: 120_000` dans `content-quality-improver-worker.ts:346` ✅
- Redis INCR atomique (P0-4) ✅
- Saga post-publish try/catch best-effort ✅

Gap identifié P6.1 : `content-publish-worker.ts` — `lockDuration` potentiellement absent. Double-ping IndexNow possible si stalle.

**Mitigation recommandée** :
- Vérifier et ajouter `lockDuration: 120_000` dans `content-publish-worker.ts` WorkerOptions (Sprint A-suite — 10 min)
- Augmenter lockDuration quality-improver à `180_000` (3 min) si Claude Sonnet peut dépasser 2 min (Sprint A-suite — 5 min)
- Alerte Telegram si job stall détecté (Sprint A-suite — 2h)

**Sprint cible** : Sprint A-suite (J0-J7)

---

## R7 — Drift qualité éditoriale (perte cohérence brand voice à scale)

**Probabilité** : MOYENNE (brand voice peut dériver sur volume >200/j)
**Sévérité** : HAUTE (réputation Axion-IA)
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé — monitoring tonalité absent

Mitigations actives (HEAD e573da64) :
- `brand-voice.ts` SSOT avec `injectBrandVoice()` dans 9/9 generators ✅ (acquis post-P4+S+7)
- Persona Manon dans 9/9 generators ✅
- Seuil REJECT 6.0/60 LLM-judge ✅ (acquis e573da64)
- 7 dimensions LLM-judge évaluées ✅

Résiduel : À 200-500 art/j, même avec LLM-judge, tendance leniency possible (judge sur-calibré). Absence de monitoring automatique de la tonalité dans le dashboard.

**Mitigation recommandée** :
- Monitoring tonalité K4 dans dashboard admin (Sprint B — 4h)
- Audit brand voice mensuel : tirage aléatoire 10 articles par Will (2h/mois)
- Recalibration LLM-judge si <15% reject rate — signe de sur-permissivité (Sprint B — 2h)
- A/B test prompts brand voice (Sprint D — 8h)

**Sprint cible** : Sprint B (monitoring) ; Sprint D (A/B test)

---

## R8 — Dépendance API Anthropic (vendor lock-in)

**Probabilité** : BASSE (Anthropic stable, uptime 99.9%+)
**Sévérité** : HAUTE (si Anthropic change pricing ou modèle retiré)
**Priorité mitigation** : Surveillance
**État actuel** : Partiellement mitigé — fallback OpenAI non configuré en prod

Mitigations actives :
- `AI_MODEL_DISCLOSURE_NAME` env var : changement modèle sans code modification ✅ (acquis post-P4)
- `ANTHROPIC_MODEL` configurable ✅
- `provider-router.ts` : abstraction provider déjà en place (OpenAI, Anthropic, Perplexity) ✅
- `openai.ts` provider présent mais non activé en fallback automatique

Résiduel : En cas de panne Anthropic >4h, les jobs BullMQ s'accumulent sans failover automatique. Pas de circuit breaker configuré.

**Mitigation recommandée** :
- Configuration fallback OpenAI GPT-4o dans provider-router (Sprint C — 3h)
- Circuit breaker Anthropic → auto-switch OpenAI si >5 errors/10 min (Sprint C — 4h)
- Budget OpenAI backup ~$200/mois (Will J+60 — 10 min)
- Monitoring pricing Anthropic trimestriel (Will — 30 min/trimestre)

**Sprint cible** : Sprint C (J61-J90)

---

## RISQUES ÉMERGENTS

### RE1 — SMTP Coolify non configuré → weekly-report silencieux

**Probabilité** : CERTAINE | **Sévérité** : MOYENNE | **Priorité** : Will urgent 15 min

Le worker `content-weekly-report-worker.ts` est livré mais ne peut pas envoyer en production sans `WEEKLY_REPORT_EMAIL` en Coolify. Le reporting hebdomadaire D-P5-3 est silencieux.

**Mitigation** : Coolify → Env vars → `WEEKLY_REPORT_EMAIL=williamsjullin@gmail.com` (scope RUN) → Restart container.

**Sprint cible** : Will IMMÉDIAT (15 min)

---

### RE2 — Commits locaux non pushés → perte potentielle si machine défaillante

**Probabilité** : MOYENNE | **Sévérité** : CRITIQUE (+167 pts non sécurisés) | **Priorité** : Will urgent 30 sec

Commits 023266f9, 5d8e8b6f, 7236dfd0 (wizard 5 étapes, schema.prisma RESTRICT, Telegram REJECT-P0, weekly-report, blog-article S+7) uniquement en local.

**Mitigation** : `git push origin main` — 30 secondes.

**Sprint cible** : Will IMMÉDIAT — avant toute autre action

---

### RE3 — Vérification indépendante P5 non livrée → score D-Ops estimé

**Probabilité** : HAUTE | **Sévérité** : BASSE | **Priorité** : Sprint A-suite 1-2h

Le score D-Ops 619/1000 est estimé suite aux 4 P0 corrigés (e573da64) mais sans vérification indépendante formelle (D13=C = vérif light 1h requise).

**Mitigation** : Agent vérification indépendante P5 (2 agents // — 2h) en Sprint A-suite J+1.

**Sprint cible** : Sprint A-suite (J0-J7)

---

## TABLEAU DE SUIVI — KPI D'ALERTE

| Risque | KPI | Seuil WARNING | Seuil CRITIQUE | Fréquence | Outil |
|--------|-----|---------------|----------------|-----------|-------|
| R1 HCU | K8 % articles indexés/publiés | < 70% | < 50% (2 semaines) | Quotidienne | GSC |
| R1 HCU | K7 position moyenne brand | > 15 | > 25 | Hebdomadaire | GSC |
| R2 Coût | Monthly spend Anthropic | > $1000/mois | > $1400/mois | Quotidienne | cost-tracker + Telegram |
| R4 AI Act | checklist art. 50 | Dérive détectée | Non conforme | Unique J+72 | Sprint C |
| R5 Brand | KP Google "Axion IA" | Concurrent aparaît | Concurrent vérifié | Mensuelle | Google Search |
| R6 BullMQ | Job stall rate quality-improver | > 1% | > 5% | Quotidienne | BullMQ admin |
| R7 Brand | % articles rejetés LLM-judge | < 5% (leniency) | < 2% | Hebdomadaire | Dashboard K4 |
| R8 Anthropic | Error rate API | > 2%/heure | > 10%/heure | Temps réel | Sentry + Telegram |
| RE1 SMTP | weekly-report reçu lundi | Email non reçu | > 2 semaines | Hebdomadaire | Boîte email Will |

---

## RISQUES ACCEPTÉS PAR WILL

| Acceptation | Risque | Conditions d'annulation |
|-------------|--------|-------------------------|
| W-1 | factoryAutoPublishAllBlogTypes ON (D-W3) | K8 < 50% pendant 2 semaines → pause + STOP & ASK Will |
| W-2 | Wikidata RENONCÉ (D-W5) | Concurrent Knowledge Panel Google → reconsidérer Wikidata |
| W-3 | DPA Anthropic reporté (D-W2) | Audit DPA obligatoire à J+90 |

---

## RISQUES ÉMERGENTS HORIZON 6-18 MOIS

| Risque futur | Horizon | Probabilité | Mitigation préventive |
|--------------|---------|-------------|----------------------|
| Google SGE v2 France (zero-click informationnel) | Q3 2026 | 40% | Contenus navigationnels + speakable AEO |
| Claude 5 tarif × 3 (hypothèse pricing) | H2 2026 | 20% | env var AI_MODEL_DISCLOSURE_NAME + fallback OpenAI Sprint C |
| Pénalité Google Core Update IA >70% | Post-août 2026 | 30% | Ratio humain/IA ≥ 30% + AiContentDisclaimer |
| AI Search Perplexity/ChatGPT Search | 2026 | Haute | llms.txt + robots.txt déjà optimisés |
| Fuite API key Anthropic GH Actions | Tout moment | 5% | Rotation trimestrielle + monitoring usage |
| Concurrence IA content gen FR B2B | 2026-2027 | Haute | Différenciation 5 verticales + Manon non-commoditisable |

---

*RISQUES-MITIGATION.md — Mis à jour P6.1 — 2026-05-22*
*HEAD audité : e573da64 (origin/main) | Commits locaux : 023266f9, 5d8e8b6f, 7236dfd0 (non pushés)*
*Source : agents/A6-10-risques.md + PHASE-6-VERDICT-GLOBAL.md + analyse code HEAD*
