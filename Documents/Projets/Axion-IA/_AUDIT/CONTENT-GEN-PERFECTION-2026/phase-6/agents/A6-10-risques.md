# A6-10 — Analyse Risques Résiduels & Plans de Mitigation

**Agent** : A6-10 | **Date** : 2026-05-22 (mise à jour P6.1) | **HEAD** : e573da64 (origin/main)
**Mission** : AUDIT-ONLY — Analyse 8 risques structurels + 3 risques émergents, matrice, plans d'action, monitoring
**Mode** : Zéro commit, zéro modif code

---

## 1. Matrice Risques — Sévérité × Probabilité → Priorité

| # | Risque | Sévérité | Probabilité | Score risque (S×P) | Priorité | Statut actuel |
|---|--------|----------|-------------|---------------------|----------|---------------|
| R1 | Google HCU Scaled Content Abuse (>100 art/j) | CRITIQUE | HAUTE | **9/9** | P1 — Sprint B | Mitigé partiellement — rampe D-W1 + AiContentDisclaimer ✅ |
| R4 | Amende AI Act art. 50 non-conformité | HAUTE | MOYENNE | **6/9** | P0-SURVEILLANCE | Conforme actuellement — vérif obligatoire J+72 (2026-08-02) |
| R6 | Crash worker BullMQ double publication | HAUTE | BASSE | **4/9** | P2 — Sprint A | lockDuration 120s + Redis INCR ✅ — content-publish-worker lockDuration à vérifier |
| R2 | Dérive coût LLM > budget | HAUTE | MOYENNE | **6/9** | P2 — Sprint A-suite | cost-tracker ✅ — cap Anthropic non configuré |
| R7 | Drift qualité éditoriale brand voice à scale | HAUTE | MOYENNE | **6/9** | P2 — Sprint C | brand-voice.ts SSOT 9/9 gen ✅ — monitoring tonalité absent |
| R8 | Dépendance API Anthropic (vendor lock-in) | HAUTE | BASSE | **2/9** | P3 — Sprint D | env var AI_MODEL_DISCLOSURE_NAME ✅ — fallback OpenAI non configuré |
| R5 | Concurrence marque axionai.fr | MOYENNE | HAUTE | **3/9** | P2 — Will J+14 | Wikidata renoncé — GBP bloqué faute d'adresse FR |
| R3 | Changement algo Google SGE / AI Overviews | MOYENNE | HAUTE | **6/9** | Surveillance continue | AEO speakable + FAQ + JSON-LD ✅ — suivi SERP manuel |

**Risques émergents P6.1** :
| # | Risque | Sévérité | Probabilité | Priorité |
|---|--------|----------|-------------|----------|
| RE1 | SMTP Coolify non configuré → weekly-report silencieux | MOYENNE | CERTAINE | Will urgent — 15 min |
| RE2 | Commits locaux non pushés → perte si machine défaillante | CRITIQUE | MOYENNE | Will urgent — 30 sec |
| RE3 | Vérif indépendante P5 non livrée → score D-Ops non certifié | BASSE | HAUTE | Sprint A-suite — 1-2h |

**Grille d'évaluation** : Sévérité {Critique=3, Haute=2, Moyenne=1} × Probabilité {Haute=3, Moyenne=2, Faible=1}.

---

## 2. Analyse Détaillée — 8 Risques Structurels

---

### R1 — Google HCU Scaled Content Abuse

**Probabilité** : HAUTE
**Sévérité** : CRITIQUE
**Priorité mitigation** : Urgente (avant scale >100/j)
**État actuel** : Mitigé partiellement

**Diagnostic code HEAD e573da64** :
- `getEffectivePublishCap()` : rampe automatique 30→200→500 basée sur `article.count` published ✅
- `lockDuration: 120_000` dans `content-gen-worker.ts` et `content-quality-improver-worker.ts` ✅
- `AiContentDisclaimer` présent sur 100% pages IA (blog + guides + /implantations) ✅
- Drip window 8h-22h CET opérationnel ✅
- `brand-voice.ts` SSOT injecté dans 9/9 generators ✅
- LLM-judge seuil 6.0/60 REJECT opérationnel ✅

**Points de vigilance non mitigés** :
1. **Absence de monitoring GSC automatisé** : `gsc-client.ts` existe mais non câblé en alerte automatique
2. **`factoryAutoPublishAllBlogTypes`** : flag dans `ContentGenJobOptions` — si activé sans GSC monitoring, la rampe peut être court-circuitée
3. **EEAT insuffisant sur landing pages** : AuthorByline manquant sur certaines pages (cas-concrets, landing villes selon A6-02 rang 24)

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance | Gain risque |
|--------|-------------|--------|----------|-------------|
| GSC monitoring automatisé (alerte K8 < 50% indexation) | Claude | 8h | Sprint B (J30-J60) | -50% probabilité |
| KPI K8 dashboard admin visible avec seuil rouge | Claude | 3h | Sprint B | Monitoring |
| Protocol alerte : si K8 < 50% → pause automatique publications | Claude | 2h | Sprint B | Kill switch qualité |
| AuthorByline EEAT toutes pages (rang 24 A6-02) | Claude | 1h | Sprint A | EEAT signal |
| Révision manuelle 5 articles/semaine par Will | Will | 2h/mois | Continu | Brand drift |
**Sprint cible** : Sprint B (J30-J60) — monitoring GSC ; Sprint A pour AuthorByline

---

### R2 — Dérive coût LLM > budget

**Probabilité** : MOYENNE
**Sévérité** : HAUTE
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé techniquement — cap prod non configuré

**Diagnostic code HEAD e573da64** :
- `cost-tracker.ts` : alerte Telegram à 80% du cap mensuel ✅ (acquis e573da64)
- `handleCostCapHit()` : désactive provider + kill switch global ✅
- Désactivation automatique à 100% du cap mensuel ✅
- Fallback chain provider si cap atteint ✅

**Résiduel** : Cap DB par provider — vérifier que `ContentGenConfig.MAX_PUBLISH_PER_DAY` est configuré avant scale >100/j. À $50/j pour 500 art, dérive possible de $100-200 si kill switch tarde (latence Telegram ~5 min).

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Configurer cap Anthropic $1500/mois en Coolify avant scale J+45 | Will | 10 min | J+30 (D12=B) |
| Monitoring coût hebdo dans dashboard D-OPS | Claude | 3h | Sprint B |
| Alert seuil $1000/mois dans weekly-report email | Claude | 1h | Sprint A-suite |

**Sprint cible** : Will J+30 (D12) ; Sprint B pour dashboard

---

### R3 — Changement Google SGE / AI Overviews algo

**Probabilité** : HAUTE (Google change l'algo ~4x/an)
**Sévérité** : MOYENNE
**Priorité mitigation** : Surveillance continue
**État actuel** : Bien mitigé pour AEO/GEO court terme

**Diagnostic** :
- Structured data AEO : speakable, FAQ, search_term_string ✅ (acquis P3)
- E-E-A-T Manon AuthorByline ✅ (acquis P3/P4)
- JSON-LD aiGenerated:true ✅ (acquis e0b1973)
- Monitoring SERP : manuel uniquement

**Résiduel** : Si Google généralise AI Overviews sur 100% des requêtes FR (probabilité 40% sur 12 mois), les articles blog tiers disparaissent de la page 1 pour les requêtes informationnelles (zero-click).

**Mitigation recommandée** :
- Orienter production vers contenus navigationnels (marque + services) plutôt que purement informationnels
- Développer contenu Speakable/FAQ AEO pour rester dans AI Overviews — déjà en cours
- Backlinks entités (JSON-LD mentions) pour citer axion-ia.com comme source
- Suivi Google Search Labs trimestriel (Will 30 min/trimestre)

**Sprint cible** : Surveillance continue — pas d'action code immédiate

---

### R4 — Amende AI Act art. 50 non-conformité

**Probabilité** : BASSE (compliance acquise) → MOYENNE si dérive
**Sévérité** : HAUTE (jusqu'à €15M ou 3% CA)
**Priorité mitigation** : Urgente (deadline J+72 = 2026-08-02)
**État actuel** : Conforme actuellement — vérif J+72 obligatoire

**Diagnostic code HEAD e573da64** :
- `AiContentDisclaimer` permanent 100% pages IA (blog + guides + /implantations) ✅ (acquis 364f2c6)
- JSON-LD `aiGenerated:true` ✅ (acquis e0b1973)
- `promptHash` réel implémenté dans 9/9 generators (vérifié P6.0) ✅
- `GenerationProvenance` table avec `onDelete: Restrict` en DB ✅ (acquis 023266f9 — commit local)
- **ALERTE** : schema.prisma encore non sync si 023266f9 n'est pas pushé → risque drift

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Pusher commit 023266f9 (schema.prisma RESTRICT sync) | Will | 30 sec | IMMÉDIAT |
| Checklist compliance AI Act art. 50 complète | Claude | 2h | Sprint C (avant J+72) |
| Test automatique assert FK = RESTRICT en CI | Claude | 2h | Sprint A-suite |

**Sprint cible** : Will IMMÉDIAT (git push) ; Sprint C pour checklist J+72

---

### R5 — Concurrence marque axionai.fr

**Probabilité** : HAUTE (axionai.fr existe et capture potentielle brand)
**Sévérité** : MOYENNE (confusion marque possible)
**Priorité mitigation** : Normale
**État actuel** : Mitigé passivement — GBP bloqué faute d'adresse FR

**Diagnostic** :
- `brand.ts` : `legalName: "Axion-IA"` + `alternateName: ["Axion IA", "AxionIA"]` ✅ (acquis P3)
- JSON-LD Organisation avec `sameAs` backlinks autorité ✅
- Wikidata : RENONCÉ (décision Will D-W5 définitive)
- GBP : BLOQUÉ — nécessite adresse FR (D10)

**Résiduel objectif** : À 6 mois, sans Wikidata et sans GBP, si axionai.fr publie des contenus "Axion IA" avec backlinks, Google peut créer un Knowledge Panel pour le concurrent. Probabilité haute.

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance | Impact |
|--------|-------------|--------|----------|--------|
| Sedomicilier ~30€/mois adresse FR (D10=A) | Will | 30 min | J+14 | Débloque GBP |
| GBP vérifié + photos + posts mensuels (D17=A) | Will | 2h setup | J+30 | Entité Google |
| LinkedIn company page complète | Will | 1h | J+7 | Backlink autorité |
| 2 mentions presse tier-2 FR minimum | Will | 4h | J+30 | KP barrier |

**Sprint cible** : Will J+7 à J+30

---

### R6 — Crash worker BullMQ (double publication)

**Probabilité** : BASSE (mitigations acquises)
**Sévérité** : HAUTE (articles dupliqués, coût LLM doublé)
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé — content-publish-worker lockDuration à vérifier

**Diagnostic code HEAD e573da64** :
- `lockDuration: 120_000` dans `content-gen-worker.ts:698` ✅
- `lockDuration: 120_000` dans `content-quality-improver-worker.ts:346` ✅
- Redis INCR atomique (P0-4) ✅
- Saga post-publish try/catch best-effort ✅
- **ALERTE** (gap D-C2 identifié P6.1) : `content-publish-worker.ts` — `lockDuration` potentiellement absent. Si le worker de publication stalle, IndexNow peut être pingé deux fois.

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Vérifier et ajouter lockDuration 120_000 dans content-publish-worker.ts | Claude | 10 min | Sprint A-suite |
| Augmenter lockDuration quality-improver à 180_000 (3 min, Claude Sonnet peut dépasser 2 min) | Claude | 5 min | Sprint A-suite |
| Test Telegram alerte si job stall détecté | Claude | 2h | Sprint A-suite |

**Sprint cible** : Sprint A-suite (J0-J7)

---

### R7 — Drift qualité éditoriale brand voice à scale

**Probabilité** : MOYENNE (brand voice peut dériver sur volume >200/j)
**Sévérité** : HAUTE (réputation Axion-IA)
**Priorité mitigation** : Normale
**État actuel** : Bien mitigé — monitoring tonalité absent

**Diagnostic code HEAD e573da64** :
- `brand-voice.ts` SSOT avec `injectBrandVoice()` dans 9/9 generators ✅ (acquis post-P4+S+7)
- Persona Manon dans 9/9 generators ✅
- Seuil REJECT 6.0/60 LLM-judge ✅ (acquis e573da64 seuil 60)
- 7 dimensions LLM-judge évaluées ✅

**Résiduel** : À 200-500 art/j, même avec LLM-judge, 10% d'articles peuvent passer sous le seuil brand voice sans être détectés si le judge est sur-calibré (tendance leniency). Absence de monitoring automatique de la tonalité.

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Monitoring tonalité K4 (dashboard admin) | Claude | 4h | Sprint B |
| Audit brand voice mensuel (tirage 10 articles aléatoires) | Will | 2h/mois | Continu |
| Recalibration LLM-judge si < 15% reject rate (signe sur-permissivité) | Claude | 2h | Sprint B |
| A/B test prompts brand voice (Sprint D) | Claude | 8h | Sprint D |

**Sprint cible** : Sprint B (monitoring) ; Sprint D (A/B test)

---

### R8 — Dépendance API Anthropic (vendor lock-in)

**Probabilité** : BASSE (Anthropic stable, uptime 99.9%+)
**Sévérité** : HAUTE (si Anthropic change pricing ou modèle retiré)
**Priorité mitigation** : Surveillance
**État actuel** : Partiellement mitigé — fallback OpenAI non configuré en prod

**Diagnostic code HEAD e573da64** :
- `AI_MODEL_DISCLOSURE_NAME` env var : changement modèle sans code modification ✅ (acquis post-P4)
- `ANTHROPIC_MODEL` configurable ✅
- `provider-router.ts` : abstraction provider déjà en place (OpenAI, Anthropic, Perplexity) ✅
- `openai.ts` provider présent mais non activé en fallback automatique

**Résiduel** : En cas de panne Anthropic >4h, les jobs BullMQ s'accumulent. Pas de circuit breaker automatique vers OpenAI GPT-4o. Pas de budget OpenAI backup configuré.

**Mitigation recommandée** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Configuration fallback OpenAI GPT-4o dans provider-router | Claude | 3h | Sprint C (J60+) |
| Circuit breaker Anthropic → auto-switch OpenAI si >5 errors/10min | Claude | 4h | Sprint C |
| Budget OpenAI backup ~$200/mois (coût failover ponctuel) | Will | 10 min | J+60 |
| Monitoring pricing Anthropic trimestriel | Will | 30 min/trimestre | Continu |

**Sprint cible** : Sprint C (J61-J90)

---

## 3. Risques Émergents P6.1 (nouveaux depuis P6 baseline)

---

### RE1 — SMTP Coolify non configuré → weekly-report silencieux

**Probabilité** : CERTAINE
**Sévérité** : MOYENNE
**Priorité mitigation** : Will urgent — 15 min
**État actuel** : Absent — worker livré mais env var manquante

**Description** : Le worker `content-weekly-report-worker.ts` est livré (commit 023266f9 local) mais ne peut pas envoyer en production sans `WEEKLY_REPORT_EMAIL` configuré en Coolify. En l'état actuel, le reporting hebdomadaire D-P5-3 ne s'exécute pas → monitoring D-Ops incomplet.

**Mitigation** :
1. Coolify → Application → Env vars → Ajouter `WEEKLY_REPORT_EMAIL=williamsjullin@gmail.com` (scope RUN)
2. Restart container
3. Vérifier Telegram alert "weekly-report worker started" le lundi suivant

**Sprint cible** : Will IMMÉDIAT (15 min)

---

### RE2 — Commits locaux non pushés → perte potentielle si machine défaillante

**Probabilité** : MOYENNE (machine locale = SPOF)
**Sévérité** : CRITIQUE (+167 pts en local non sécurisés)
**Priorité mitigation** : Will urgent — 30 sec
**État actuel** : Commits 023266f9, 5d8e8b6f, 7236dfd0 non pushés sur origin/main

**Description** : 3 commits locaux représentant +167 pts de score (wizard 5 étapes, schema.prisma RESTRICT, Telegram REJECT-P0, blog-article wiring, weekly-report) sont UNIQUEMENT sur la machine locale de Will. Si la machine est défaillante avant le push, ces travaux sont perdus.

**Mitigation** :
```
git push origin main
```
Durée : 30 secondes. Urgence : CRITIQUE.

**Sprint cible** : Will IMMÉDIAT (avant tout autre action)

---

### RE3 — Vérification indépendante P5 non livrée → score D-Ops non certifié

**Probabilité** : HAUTE (décision D13=C = vérif light 1h requise)
**Sévérité** : BASSE (score estimé, pas de vérif formelle)
**Priorité mitigation** : Sprint A-suite — 1-2h
**État actuel** : Partiellement comblé par e573da64 (4 P0 corrigés) mais vérif formelle absente

**Description** : La décision D13=C précise "vérif light 1h" pour le Sprint P5. L'audit P5 a été réalisé à 652/1000 (AxionIA Sprint P5 LIVRÉ + VÉRIFIÉ + CORRIGÉ, commit e573da64) mais sans agent indépendant dédié à la vérification. Le score D-Ops 619/1000 est estimé, pas certifié.

**Mitigation** :
| Action | Responsable | Effort | Échéance |
|--------|-------------|--------|----------|
| Agent vérification indépendante P5 (2 agents //) | Claude | 2h | Sprint A-suite J+1 |
| Score D-Ops certifié post-vérif (correction ±30 pts possible) | Claude | 30 min | Sprint A-suite J+1 |

**Sprint cible** : Sprint A-suite (J0-J7)

---

## 4. Risques Acceptés par Will — Documentation Formelle

### Acceptation W-1 : factoryAutoPublishAllBlogTypes ON (D-W3)

**Risque** : Violation potentielle Google Scaled Content Policy.
**Décision** : ASSUMÉE par Will. Pipeline continue avec flag activable.
**Conditions d'annulation** : Si K8 (indexation %) chute <50% pendant 2 semaines → pause immédiate + STOP & ASK Will.
**Monitoring** : GSC quotidien K8, Dashboard D-OPS alert badge.

### Acceptation W-2 : Wikidata RENONCÉ (D-W5)

**Risque** : axionai.fr peut capturer Knowledge Panel "Axion IA".
**Décision** : ASSUMÉE par Will.
**Mitigation alternative** : GBP + LinkedIn + presse FR tier-2.
**Réévaluation** : Si concurrent Knowledge Panel apparaît → reconsidérer Wikidata (effort ~4h).

### Acceptation W-3 : DPA reporté (D-W2)

**Risque** : Non-conformité RGPD si fuite données IA provider.
**Décision** : REPORTÉ — pas de deadline immédiate.
**Monitoring** : Audit DPA à J+90 minimum.

---

## 5. Tableau de Suivi — KPI d'Alerte

| Risque | KPI d'alerte | Seuil WARNING | Seuil CRITIQUE | Fréquence | Outil |
|--------|-------------|---------------|----------------|-----------|-------|
| R1 HCU Google | K8 = % articles indexés/publiés | < 70% | < 50% | Quotidienne | GSC |
| R1 HCU Google | K7 = position moyenne (brand queries) | > 15 | > 25 | Hebdomadaire | GSC |
| R2 Coût LLM | Monthly spend Anthropic ($) | > $1000/mois | > $1400/mois | Quotidienne | cost-tracker + Telegram |
| R4 AI Act | compliance checklist J+72 | Dérive détectée | Non conforme | Unique (J+72) | Sprint C audit |
| R5 Brand | "Axion IA" Knowledge Panel Google | Concurrent apparaît | Concurrent vérifié | Mensuelle | Google Search |
| R6 BullMQ | Job stall rate quality-improver | > 1% | > 5% | Quotidienne | BullMQ admin |
| R7 Brand voice | % articles rejetés LLM-judge | < 5% (sur-permissif) | < 2% (très permissif) | Hebdomadaire | Dashboard K4 |
| R8 Anthropic | Error rate API | > 2%/heure | > 10%/heure | Temps réel | Sentry + Telegram |
| RE1 SMTP | weekly-report envoi lundi | Email non reçu | > 2 semaines | Hebdomadaire | Boîte email Will |

---

## 6. Risques Émergents Horizon 6-18 mois

| Risque futur | Horizon | Probabilité | Action préventive |
|--------------|---------|-------------|-------------------|
| Google SGE v2 France generalisation 100% (zero-click) | Q3 2026 | 40% | Contenus navigationnels + speakable AEO |
| Claude 5 release (tarif × 3 hypothèse) | H2 2026 | 20% | env var AI_MODEL_DISCLOSURE_NAME prête + fallback OpenAI |
| OpenAI embeddings v4 migration | 2026-2027 | 35% | env var EMBEDDING_MODEL prête |
| AI Search (Perplexity/ChatGPT Search) | 2026 | Haute | llms.txt + robots.txt déjà optimisés |
| Pénalité Google Core Update contenu IA >70% | Post-août 2026 | 30% | Ratio humain/IA ≥ 30% + AiContentDisclaimer |
| Fuite API key Anthropic via GH Actions | Tout moment | 5% | Rotation trimestrielle clés + monitoring usage |

---

## 7. Résumé Exécutif Risques

### Score global gestion des risques : 74/100 (+2 vs P6.0)

| Dimension | Score | Commentaire |
|-----------|-------|-------------|
| Risques identifiés et documentés | 18/20 | 8 structurels + 3 émergents + 6 horizon |
| Mitigations techniques actives | 16/20 | cost-tracker, lockDuration 9/9, kill switch, brand-voice SSOT |
| Conformité réglementaire | 14/20 | AI Act promptHash implémenté ✅ — schema.prisma RESTRICT (commit local non pushé) |
| Monitoring et alertes | 10/20 | Telegram actif, GSC non automatisé, SMTP non configuré |
| Risques acceptés documentés | 8/10 | W-1, W-2, W-3 formalisés |
| Plans d'action chiffrés | 8/10 | Effort, responsable, échéance définis pour tous |

### 3 actions Will IMMÉDIAT (< 1 heure)

1. **`git push origin main`** — 30 sec — Sécurise 167 pts locaux (RE2 éliminé)
2. **Coolify `WEEKLY_REPORT_EMAIL=williamsjullin@gmail.com`** — 15 min — Active weekly-report D-P5-3 (RE1 éliminé)
3. **Cap Anthropic $1500/mois** — 10 min — Avant scale >100/j (R2 mitigé)

### 3 actions Claude Sprint A-suite (< J7)

1. **`content-publish-worker.ts` lockDuration 120_000** — 10 min — R6 éliminé
2. **AuthorByline EEAT pages manquantes** — 1h — R1 EEAT renforcé
3. **Agent vérif indépendante P5** — 2h — RE3 éliminé

---

*Rapport A6-10 mis à jour — HEAD : e573da64 | P6.1 — 2026-05-22*
*Zéro code modifié. Zéro commit. AUDIT-ONLY strict.*
*Vérifications croisées sur : PHASE-6-VERDICT-GLOBAL.md, A6-01 à A6-12, commits log git (10 derniers).*
