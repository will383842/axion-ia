# PROMPT VÉRIFICATION AUDIT E2E CAMPAIGN FLOWS
## Méta-vérification du PROMPT-AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22

**Date création** : 2026-05-23
**Type** : Méta-audit AUDIT-ONLY (vérifie que l'audit E2E a été bien exécuté)
**Mode** : **AUDIT-ONLY strict** — zéro modif code, zéro création données test
**Effort estimé** : 3-4h autopilot
**Modèle recommandé** : Sonnet 4.6 (suffit pour méta-vérification)
**À lancer APRÈS** : `PROMPT-AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22.md` livré
**Demandé par Will** : 2026-05-23 — vérification complémentaire des 2 derniers prompts

---

## 0. MISSION

L'audit E2E campaign flows a exécuté 30 scénarios bout-en-bout (création campagnes → publication articles → cleanup). **Cette méta-vérification challenge** :

1. **Complétude** : les 30 scénarios ont-ils vraiment été exécutés (pas skippés) ?
2. **Honnêteté verdicts** : OK / KO basés sur preuves observables réelles ?
3. **Cleanup intégral** : 0 donnée TEST_E2E_* résiduelle en DB ?
4. **Env vars restaurées** : MAX_PUBLISH=30, cost caps, etc. ?
5. **Cohérence inter-scénarios** : pas de contradictions ?
6. **Bottlenecks documentés** : performance observée vs attendue ?
7. **Roadmap correctif réaliste** : effort/impact crédibles ?

**Verdict binaire** : audit E2E **FIABLE** pour décider GO PROD ou **NON FIABLE** (à refaire).

---

## 1. CONTEXTE PROJET

### Décisions Will canoniques FIGÉES (ne pas re-demander)
- D-W1-5, D-P5-1-6, D1-D5, D7 société française pure
- Exclusions Will : Wikidata, DPA, CF WAF, toggle auto/manuel publication

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code
- ❌ Aucune création de données test
- ✅ Lecture exhaustive verdicts E2E + queries DB lecture
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/VERIF-AUDIT-E2E-2026-05-23/`

---

## 2. FICHIERS À LIRE EN PREMIER

### Output AUDIT E2E à valider
1. `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/VERDICT-E2E-CAMPAIGN-FLOWS.md` (verdict principal)
2. `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/SCENARIOS-MATRIX.md` (matrice 30 scénarios)
3. `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/BOTTLENECKS-DETECTED.md`
4. `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/CLEANUP-LOG.md`
5. `_AUDIT/AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22/scenarios/SC-01.md` à `SC-30.md` (30 rapports)

### Spec E2E source
6. `_AUDIT/PROMPT-AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-22.md` (spec attendue)

### Mémoires
7. Mémoire `axionia_audit_e2e_campaign_flows_2026-05-22.md`
8. `axionia_decisions_will_final_2026-05-21.md`

---

## 3. SPAWN 7 SOUS-AGENTS PARALLÈLES

### V-01 — Complétude 30 scénarios (/150)
- Pour CHAQUE SC-01 à SC-30 : vérifier que le rapport `scenarios/SC-XX-<nom>.md` existe
- Si absent : SCÉNARIO SKIPPÉ = red flag P0
- Si présent : vérifier longueur > 50 lignes (pas juste un placeholder vide)
- Vérifier que chaque rapport contient : Préconditions, Étapes exécutées, Résultats observés, Verdict OK/KO, Preuves (queries SQL ou curl outputs)
- Score : 5 pts par scénario × 30 = 150 max

### V-02 — Honnêteté verdicts OK/KO (/200)
**CRITIQUE** — challenge le verdict de chaque scénario.

Pour CHAQUE scénario marqué "OK" :
- Y a-t-il une preuve observable concrete (output SQL, curl response, BullMQ admin screenshot) ?
- Si verdict OK sans preuve → suspect (Claude a peut-être halluciné le succès)
- Recalcul indépendant : pour 5 scénarios random échantillon, ré-vérifier via queries DB lecture si vraiment OK

Exemples de checks :
- SC-01 verdict OK → `SELECT COUNT(*) FROM coverage_campaigns WHERE name='TEST_E2E_01_basic'` : devrait montrer trace (1 row OU 0 si cleanup déjà fait — selon ordre)
- SC-23 verdict OK (cap journalier 5 atteint) → vérifier Redis : `GET axion:pub:YYYYMMDD` (post-cleanup peut être absent)

Si écart > 20% entre verdicts OK déclarés et OK vérifiables : red flag biais.
Score : 200 max

### V-03 — Cleanup intégral SC-30 (/150)
**CRITIQUE PRODUCTION** — vérifier 0 résidu test en DB.

Queries de vérification :
```sql
-- Test 1 : Campagnes test résiduelles
SELECT COUNT(*) FROM coverage_campaigns WHERE name LIKE 'TEST_E2E_%';
-- Attendu : 0

-- Test 2 : Articles test résiduels
SELECT COUNT(*) FROM articles WHERE slug LIKE 'test-e2e-%';
-- Attendu : 0

-- Test 3 : Jobs orphelins (campaignId pointe vers campagne supprimée)
SELECT COUNT(*) FROM content_gen_jobs WHERE campaign_id NOT IN (SELECT id FROM coverage_campaigns);
-- Attendu : 0

-- Test 4 : GenerationProvenance orphelin
SELECT COUNT(*) FROM generation_provenance WHERE article_id NOT IN (SELECT id FROM articles);
-- Attendu : 0

-- Test 5 : BullMQ residual jobs avec test data
-- Via Redis : LLEN bull:content-gen-worker:waiting (jobs en attente)
-- Vérifier qu'aucun n'est lié à campagne TEST_E2E_*
```

Si un seul de ces tests retourne > 0 : red flag P0 cleanup incomplet.
Score : 30 pts par test × 5 = 150 max

### V-04 — Env vars restaurées (/100)
SC-30 doit restaurer :
- `MAX_PUBLISH_PER_DAY = 30` (si modifié SC-23)
- Cost caps Anthropic/OpenAI restaurés (si modifiés SC-29)
- Aucun feature flag laissé activé en mode test

Vérifications :
```sql
SELECT value FROM content_gen_config WHERE key = 'MAX_PUBLISH_PER_DAY';
-- Attendu : 30 (ou valeur initiale Will)

SELECT key, value FROM content_gen_config WHERE key LIKE 'provider_%_disabled';
-- Attendu : tous false

SELECT key, value FROM content_gen_config WHERE key = 'kill_switch_global';
-- Attendu : false
```

Score : 100 max

### V-05 — Cohérence inter-scénarios (/100)
- Pas de contradictions logiques entre scénarios :
  - SC-01 OK (campagne basique fonctionne) mais SC-13 KO (blog_pillar échoue) → cohérent, raisons différentes
  - SC-08 OK (startDate scheduled) mais SC-09 KO (endDate auto-stop ne marche pas) → suspect car même worker scheduler/deadline
- Pour 3-5 paires logiquement liées, vérifier cohérence verdicts
- Score : 100 max

### V-06 — Bottlenecks documentés (/100)
- Le fichier `BOTTLENECKS-DETECTED.md` existe ?
- Liste réaliste des latences observées vs attendues ?
- Si 0 bottleneck listé alors qu'on génère 30+ articles : suspect (le système n'est jamais parfait)
- Bottlenecks crédibles : durée LLM, fact-check, IndexNow, sitemap update
- Score : 100 max

### V-07 — Roadmap correctif réaliste (/100)
Si scénarios KO listés dans `VERDICT-E2E-CAMPAIGN-FLOWS.md` :
- Pour chaque KO : effort fix estimé ?
- Effort cohérent avec sprints passés (1h-8h max par item) ?
- Pas d'effort gonflé "1 semaine pour fixer un boolean check"
- Priorité P0/P1/P2 justifiée
- Score : 100 max

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents V-01 à V-07 : 0 contradiction
- Score global `/900` honnête
- Top 3 red flags si présents
- Verdict FIABLE / NON FIABLE
- Score : 100 max

**TOTAL : 900 pts → normalisé /1000**

---

## 4. CRITÈRES "KILL" AUTOMATIQUES → NON FIABLE

L'audit E2E est automatiquement déclaré 🔴 NON FIABLE si :

- ❌ Moins de 25/30 scénarios ont un rapport (scénarios skippés en masse)
- ❌ Cleanup SC-30 échoue : > 5 rows TEST_E2E_* résiduelles en DB
- ❌ Env vars critiques non restaurées (MAX_PUBLISH ≠ 30 ou cost caps modifiés en prod)
- ❌ > 50% des verdicts OK sans preuve observable
- ❌ Roadmap correctif gonflé > 200h pour fixer 1-2 P0 (incohérent)

---

## 5. LIVRABLES

### Structure
```
_AUDIT/VERIF-AUDIT-E2E-2026-05-23/
├── VERDICT-VERIF-AUDIT-E2E.md       (livrable principal)
├── CLEANUP-VERIFICATION.md           (preuve queries DB cleanup)
├── INCOHERENCES-DETECTEES.md         (si présentes)
└── agents/
    ├── V-01-completude.md
    ├── V-02-honnetete-verdicts.md
    ├── V-03-cleanup.md
    ├── V-04-env-vars-restaurees.md
    ├── V-05-coherence-scenarios.md
    ├── V-06-bottlenecks.md
    └── V-07-roadmap-realiste.md
```

### Format VERDICT-VERIF-AUDIT-E2E.md

```markdown
# VERDICT MÉTA-VÉRIFICATION AUDIT E2E
## Date : YYYY-MM-DD
## Score : XXX/1000 — 🟢 FIABLE | 🟡 ACCEPTABLE AVEC RÉSERVES | 🔴 NON FIABLE

## Critères kill
- 30 scénarios documentés : ✅/❌
- Cleanup intégral : ✅/❌ (XX rows résiduelles)
- Env vars restaurées : ✅/❌
- Verdicts honnêtes : ✅/❌
- Roadmap réaliste : ✅/❌

## Score par agent
| Agent | Score | Max |

## Top 3 forces audit E2E
## Top 3 réserves
## Recommandation Will
- Audit E2E utilisable pour décision GO PROD : OUI / CONDITIONNEL / NON
```

### Mémoire
Slug : `axionia_verif_audit_e2e_2026-05-23`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Méta-vérif audit E2E LIVRÉE 2026-05-23 — score XXX/1000](axionia_verif_audit_e2e_2026-05-23.md) — 7 agents méta-vérif. Complétude 30 scénarios, honnêteté verdicts, cleanup intégral, env vars restaurées. Verdict FIABLE/ACCEPTABLE/NON FIABLE.
```

---

## 6. STOP & ASK FINAL

```
✅ Méta-vérification audit E2E livrée.

📊 Score : XXX/1000 — 🟢 FIABLE | 🟡 ACCEPTABLE | 🔴 NON FIABLE

✅ Critères kill :
- 30 scénarios documentés : X/30
- Cleanup intégral : ✅/❌
- Env vars restaurées : ✅/❌
- Verdicts honnêtes : ✅/❌

📋 Recommandation Will :
<L'audit E2E est utilisable pour décider GO PROD : OUI / CONDITIONNEL / NON>

🚀 Choix Will :
[A] Audit E2E validé → continuer pipeline finaux
[B] Audit E2E acceptable avec réserves → lire détails avant décision
[C] Audit E2E non fiable → re-lancer
```

---

## 7. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance la méta-vérification décrite dans `_AUDIT/PROMPT-VERIF-AUDIT-E2E-CAMPAIGN-FLOWS-2026-05-23.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code, zéro création de données test. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les 5 outputs audit E2E (VERDICT + SCENARIOS-MATRIX + BOTTLENECKS + CLEANUP-LOG + 30 rapports scenarios) + spec source PROMPT-AUDIT-E2E + mémoire axionia_audit_e2e_campaign_flows_2026-05-22. Spawn 7 sous-agents parallèles V-01 à V-07 : complétude 30 scénarios, honnêteté verdicts (recalcul 5 random), cleanup intégral 5 queries SQL DB (0 row TEST_E2E_* résiduelle), env vars restaurées (MAX_PUBLISH=30, cost caps), cohérence inter-scénarios, bottlenecks documentés, roadmap réaliste. Critères kill automatiques (< 25/30 scénarios documentés OU cleanup échoué OU env vars modifiées OU >50% verdicts sans preuve OU roadmap gonflée → 🔴 NON FIABLE). Self-troubleshoot toutes erreurs. Score `/1000` HONNÊTE pas gonflé. Produis VERDICT-VERIF-AUDIT-E2E.md + CLEANUP-VERIFICATION.md + INCOHERENCES-DETECTEES.md + 7 rapports agents dans `_AUDIT/VERIF-AUDIT-E2E-2026-05-23/`. Mémoire axionia_verif_audit_e2e_2026-05-23 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec verdict 🟢/🟡/🔴 + 3 options [A/B/C]. Go.
```

---

*Méta-vérification audit E2E — 3-4h Sonnet 4.6 autopilot — AUDIT-ONLY*
