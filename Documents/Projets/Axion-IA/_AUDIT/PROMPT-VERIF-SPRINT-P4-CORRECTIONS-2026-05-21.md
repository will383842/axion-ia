# PROMPT VÉRIFICATION SPRINT P4 — QUALITÉ ÉDITORIALE & TEMPLATES
## AxionIA Content-Gen Perfection 2026 — Audit post-sprint P4

**Date création** : 2026-05-21
**Sprint vérifié** : `_AUDIT/PROMPT-SPRINT-P4-CORRECTIONS-2026-05-21.md`
**Verdict de référence à valider** : `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/VERDICT-SPRINT-P4-CORRECTIONS.md`
**Score baseline pré-sprint** : 547/1000
**Score cible post-sprint** : ≥ 775/1000
**Mode** : **AUDIT-ONLY strict**
**Effort estimé** : 5-7h autopilot (10 sous-agents parallèles + tests fonctionnels intensifs)

---

## 0. PRINCIPE GÉNÉRAL

Vérification 4 objectifs :

1. **Spec compliance** — chaque P0/P1 du prompt P4 implémenté correctement ?
2. **Décisions Will D1-D5 appliquées** — seuil REJECT 6.0, itérations 3/2, persona Manon, wording AI Act transparence max, reporting hors scope P4 ?
3. **Tests fonctionnels réels** — générer articles de chaque type → vérifier persona Manon dans système prompt + AiContentDisclaimer wording exact + seuil REJECT comportement + itérations boucle improve.
4. **Cross-sprint impact** — P4 modifie generators + KB + reviewer → vérifier que P3 (SEO components) et P5 (admin UI) consomment bien ces changements sans casse.

Tu DOIS produire verdict scoré `/1000` honnête. Pas d'auto-complaisance.

---

## 1. CONTEXTE — À LIRE AVANT

### État repo
- **Remote** : `https://github.com/will383842/axion-ia.git`
- **HEAD origin/main pré-sprint** : `0906722`
- **HEAD origin/main au lancement vérif** : à découvrir

### Fichiers à lire (ordre)
1. `_AUDIT/PROMPT-SPRINT-P4-CORRECTIONS-2026-05-21.md` (spec)
2. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/VERDICT-SPRINT-P4-CORRECTIONS.md` (verdict livré)
3. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/PHASE-4-VERDICT.md` (audit initial 547/1000)
4. `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/A4-01.md` à `A4-10.md`
5. Mémoire `axionia_p4_decisions_canoniques_2026-05-21.md` (D1-D5 validées)
6. Mémoire `axionia_sprint_p4_corrections_livre_2026-05-21.md`
7. Mémoire `axionia_bug5_generators_phase_abc_2026-05-21.md` (BUG-5 4 stubs déjà résolu, P0-1 hors scope sprint)

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code, install dep
- ✅ Lecture, diagnostics (`pnpm typecheck/lint/test`, `git log/diff`, `prisma migrate status`, `node -e`)
- ✅ Création de fichiers UNIQUEMENT dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/verification/`

---

## 2. SPAWN 10 SOUS-AGENTS PARALLÈLES

### V4-01 — Décisions Will D1-D5 appliquées (/150)
**CRITIQUE** — bloquant si D1-D5 mal appliqués.

#### D1 seuil REJECT = 6.0/60 (/30)
- Lire `src/server/content-gen/reviewer/llm-judge.ts` : constant `REJECT_THRESHOLD` ou lecture DB
- Si hardcoded : doit être `6.0` (échelle 0-10) ou lire `ContentGenConfig.key="quality_reject_threshold"` value `60` (échelle 100)
- Vérifier cohérence : pas de duplication d'échelle (0-10 ET 0-100 dans même worker)
- Test fonctionnel : article avec score 5.9 → status `quarantined_quality` ; score 6.1 → status `needs_review` ou `published`

#### D2 itérations 3/2 (/30)
- Lire `src/server/queue/workers/content-quality-improver-worker.ts`
- Logique attendue : `maxIterations = ['blog_pillar', 'landing_ville'].includes(contentType) ? 3 : 2`
- Vérifier qu'il n'y a PAS de hardcode `maxIterations = 2` partout
- Test fonctionnel : article blog_pillar échoue 3 fois → status `needs_review` ; article blog_from_keywords échoue 2 fois → status `needs_review`

#### D3 persona Manon (/40)
- Grep tous les SYSTEM_PROMPTs des 7 generators (`src/server/content-gen/generators/*.ts`)
- Doit contenir "Manon" et "experte IA chez Axion-IA"
- Aucun "expert anonyme" ou "expert contenu Axion-IA" résiduel
- Liste générators à vérifier : `blog-article.ts`, `blog-from-keywords.ts`, `blog-pillar.ts`, `landing-ville-generator.ts`, `blog-from-title.ts`, `blog-from-rss.ts`, `qa-derived.ts`, `comparison.ts`
- Test fonctionnel : générer 1 article → vérifier dans la signature/byline "Manon"

#### D4 wording AI Act = transparence max (/30)
- Lire composant `<AiContentDisclaimer />` (`src/components/seo/AiContentDisclaimer.tsx` ou équivalent)
- Wording exact attendu : `"Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."`
- Env var `AI_MODEL_DISCLOSURE_NAME` créée pour évolutivité (default `"Claude Sonnet 4.6"`) ?
- Si modèle hardcoded sans env var : -10 pts

#### D5 reporting hors scope P4 (/20)
- Vérifier que P4 n'a PAS créé `weekly-quality-report-worker.ts` (c'est le travail de P5)
- Si P4 a empiété sur P5 : -10 pts pour scope creep

### V4-02 — P0-2 boucle improve avec issues[] (/80)
**NOTE** : Commit pré-existant `0947d9e` "quality loop re-génère avec feedback LLM-judge (BUG 4)" sur origin/main. Vérifier si P4 a complété ou pas.

- Lire `content-quality-improver-worker.ts` : passe 2 reçoit-elle `verdict1.issues[]` ?
- Format prompt regen contient liste issues formatée (severity, section, suggestedFix) ?
- Test fonctionnel : créer article qualité 6.5 + issues → passe 2 doit produire score > 6.5 OU issues différentes (jamais identiques)
- Score : 80 max

### V4-03 — P0-3 internalLinkCount + parseBody (/80)
**NOTE** : Commit pré-existant `56decf0`. Vérifier complétude.

- Regex `internalLinkCount` détecte `<a href="...">` HTML ET `[text](url)` Markdown ?
- `parseBody()` préserve les `<a>` (pas de strip HTML agressif) ?
- `citationCount` câblé à `computeSeoScore()` ?
- Test fonctionnel : article avec 5 liens internes + 3 sources externes → `internalLinkCount=5`, `citationCount=3`
- Score : 80 max

### V4-04 — P0-4 mismatch slugs image hero (/70)
**NOTE** : Commit pré-existant `8d3d886`. Vérifier alignement complet.

- `VERTICAL_TO_IMAGE_MODULE` dans `assign-hero-image.ts` cohérent :
  - `audits` → `audits`
  - `interventions_formations` → `interventions-formations`
  - `implementations` → `implementations`
  - `un_a_un` → `un-a-un`
  - `sites_web_augmentes` → `sites-web-augmentes`
- Test fonctionnel : query DB par verticale → retourne ≥ 1 image (pas fallback)
- Score : 70 max

### V4-05 — P0-5 AiContentDisclaimer 39 pages /implantations (/70)
- Fichier `src/app/[locale]/implantations/[ville]/layout.tsx` ou `page.tsx` importe `<AiContentDisclaimer />` ?
- Wording correspond à D4 (transparence max) ?
- Test fonctionnel : `curl https://axion-ia.com/fr/implantations/paris` → vérifier présence wording dans HTML
- Vérifier 39 villes pilote (au moins 5 spot-checks : paris, lyon, marseille, toulouse, nice)
- Score : 70 max

### V4-06 — P0-6 quarantaine fact-check (/80)
- Gate dur si `factCheckScore < 50` → `publishStatus = "quarantined_factcheck"` ?
- Modèle `FactCheckClaim` créé dans Prisma ?
- Migration `20260521160000_add_factcheck_claims_and_kb_sectorielle` présente et `prisma migrate status` OK ?
- Claims individuels persistés (pas juste score agrégé) ?
- RAG Voyage AI : si stub SHA-256 reste, doit être documenté dans VERDICT comme `mode: stub`
- Test fonctionnel : article avec claims contradictoires → `factCheckScore < 50` → quarantained
- Score : 80 max

### V4-07 — P0-7 REJECT-P0 vs REJECT-qualité (/60)
- Distinction implémentée dans `content-quality-improver-worker.ts` ou `llm-judge.ts` ?
- REJECT-P0 (AI Act, SIREN hardcoded, données perso, offensant) → status `quarantined_critical` + alerte Telegram + email Will ?
- REJECT-qualité → status `needs_review` ?
- Test fonctionnel : article avec SIREN hardcoded → quarantained_critical
- Score : 60 max

### V4-08 — P1 prioritaires (P1-2/3/5/6/7/11/12) (/180)
- P1-2 keyword en H1 instruction prompts (~25 pts) — grep SYSTEM_PROMPTs
- P1-3 keyword dans metaTitle validation (~25 pts) — lire publish worker
- P1-5 brand-voice.ts SSOT (~30 pts) — fichier `src/server/content-gen/brand/brand-voice.ts` créé ? injectBrandVoice() câblée 7 generators ?
- P1-6 persona Manon unifié (~20 pts) — couvert par V4-01 D3
- P1-7 glossaire 60 termes dans prompts (~30 pts) — `getGlossaryContext()` créée + appelée
- P1-11 fix hreflang layout (~20 pts) — conditionne sur ENABLED_LOCALES
- P1-12 catalogue URL → liens internes (~30 pts) — `internal-link-catalog.ts` créé, post-process LLM
- Score : 180 max

### V4-09 — KB sectorielle pilote `audits` (/80)
- Fichier `src/data/kb/audits.ts` créé avec 50-100 facts ?
- Format `{ id, text, source, sourceUrl, verifiedAt, verticales[], cities?[], confidence }` ?
- Seed `prisma/seeds/content-gen/seed-kb-facts.ts` créé et exécutable ?
- 4 autres verticales (`interventions_formations`, `un_a_un`, `implementations`, `sites_web_augmentes`) documentées comme reportées Sprint S+7 ?
- Test fonctionnel : générer 1 article verticale `audits` → vérifier qu'il cite ≥ 1 fact KB
- Score : 80 max

### V4-10 — Cross-sprint impact P3+P5 (/150)
**CRITIQUE** — détecter conflits.

#### Croisement P4 ↔ P3
- `<AiContentDisclaimer />` wording identique au P3 verif ? Doit être strictement `"Cet article a été rédigé avec l'assistance de l'IA (Claude Sonnet 4.6, Anthropic) et relu par l'équipe Axion-IA."`
- Persona auteur "Manon, experte IA chez Axion-IA" identique dans SYSTEM_PROMPTs P4 ET dans `<AuthorByline />` instancié par P3 ? Différence textuelle = -30 pts
- `Person` JSON-LD : si P4 a modifié `buildAuthorJsonLd` et P3 aussi → vérifier 1 seule SSOT
- P4 ne doit PAS toucher `src/components/seo/*.tsx` (P3 territory) sauf `<AiContentDisclaimer />` qui est partagé

#### Croisement P4 ↔ P5
- Config `quality_reject_threshold` = 60 lisible depuis UI P5 (`BatchesV2` ou dashboard) ?
- Config `quality_max_iterations_long/short` lisibles depuis UI P5 ?
- P4 ne doit PAS toucher `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` (P5 territory)
- P4 ne doit PAS créer modèle `ArticleFeedback` (P5 territory)
- P4 ne doit PAS créer modèle `CampaignTemplate` (P5 territory)

#### Migrations Prisma cross-sprint
- P4 doit avoir migration `20260521160000_add_factcheck_claims_and_kb_sectorielle`
- P5 doit avoir migration `20260521150000_add_campaign_template_and_feedback`
- Timestamps cohérents (15h00 P5 < 16h00 P4) — pas de collision
- `prisma migrate status` → no drift, no pending
- `npx prisma validate` → schema valid

Score : 150 max

### Cross-cutting orchestrateur (/100)
- Cohérence inter-agents (V4-01 à V4-10) : 0 contradiction
- Tests effectués réels (génération articles, queries DB)
- Recommandations P0/P1/P2 prioritisées
- Score : 100 max

**TOTAL : 1000 pts**

---

## 3. GATES ANTI-RÉGRESSION OBLIGATOIRES

```powershell
pnpm typecheck   # 0 erreur (baseline P1.5)
pnpm lint        # 0 erreur (1 warning hors scope OK)
pnpm test        # vitest XXXX/XXXX — DOIT être ≥ baseline 1376/1383 + tests P4 ajoutés
pnpm content-gen:isolation-check  # 0 violation
pnpm prisma migrate status  # no drift, all migrations applied
pnpm prisma validate  # schema OK
```

**Si régression vs baseline P1.5 → PÉNALITÉ -100 pts** + détail dans verdict.

Vérifier aussi :
- `pnpm pre-commit` (hooks ×8 verts)
- pre-push hooks verts

---

## 4. TESTS FONCTIONNELS RÉELS (obligatoires)

### Test 1 — Générer 1 article par type (7 tests)
Pour chaque contentType : `blog_pillar`, `landing_ville`, `blog_from_keywords`, `blog_from_title`, `blog_from_rss`, `qa_derived`, `comparison` :

```powershell
# Adapter selon script disponible
pnpm content-gen:test-generate --type=<type> --vertical=audits --city=paris
```

Pour chaque article généré, vérifier :
- ✅ Persona "Manon, experte IA chez Axion-IA" mentionné dans signature/byline/prompt
- ✅ AiContentDisclaimer wording exact en bas
- ✅ ≥ 2 liens externes (cohérence P3 cross-sprint)
- ✅ Pas de fallback générique pour image hero
- ✅ `internalLinkCount > 0`, `citationCount ≥ 2`
- ✅ Keyword principal dans H1

### Test 2 — Boucle improve avec issues[]
- Forcer un article qualité 6.5 (score initial)
- Lire les logs : passe 2 reçoit-elle `issues[]` dans le prompt ?
- Score passe 2 doit être > 6.5 OU issues différentes
- Si pas amélioré : red flag P0-2 non résolu

### Test 3 — Seuil REJECT 6.0 + itérations 3/2
- Article blog_pillar qualité 5.8 → doit être REJECT après 3 itérations → status `quarantined_quality` ou `needs_review`
- Article blog_from_keywords qualité 5.8 → doit être REJECT après 2 itérations
- Vérifier `qualityImprovementAttempts` en DB

### Test 4 — Quarantaine fact-check
- Article avec claim hardcoded faux (ex: "L'INSEE a publié en 2030 que...") → `factCheckScore` doit être < 50 → quarantained
- Vérifier `factcheck_claims` table contient les claims individuels

### Test 5 — REJECT-P0 vs REJECT-qualité
- Article avec SIREN hardcoded `123 456 789` → REJECT-P0 → `quarantined_critical` + alerte Telegram (logs)
- Article qualité 5.5 sans P0 critique → REJECT-qualité → `needs_review`

### Test 6 — Brand voice SSOT
- Lire 3 articles différents types et verticales
- Tone cohérent (tutoiement, Manon, vocabulaire canonique, pas de "révolutionner"/"disruptif")
- Score subjectif sur 5 articles

### Test 7 — AiContentDisclaimer 39 pages
Spot check 5 villes :
```powershell
for ville in paris lyon marseille toulouse nice; do
  curl -s "https://axion-ia.com/fr/implantations/$ville" | grep -c "Claude Sonnet 4.6"
done
```
Doit retourner `1` pour chaque (présence du wording).

### Test 8 — Migration Prisma applicable
```powershell
pnpm prisma migrate status
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma
```
- `factcheck_claims` table existe en DB ?
- `kb_facts` table peuplée avec verticale `audits` (50-100 rows) ?

---

## 5. DOCTRINE COMPLIANCE

### Zero invention
- KB facts : sources vérifiables réelles (INSEE, DARES, etc.) ? Pas de stats inventées
- Glossaire 60 termes : définitions correctes ?

### Zero DALL-E
- Aucune image générée par IA dans les nouveaux articles
- Test : 5 articles random → vérifier `featuredImage` pointe vers image-bank réelle (`isAiGenerated=false`)

### Manon persona
- Pas de réseau social fake généré pour Manon (doctrine v2.1)
- Pas de bio "Will Jullin" ou autre vrai nom

### AI Act art. 50
- Wording transparence max présent partout
- `aiGenerated: true` JSON-LD (acquis P1.5)
- `GenerationProvenance` toujours traçant (P1.5 acquis)

### RGPD
- Pas de données personnelles dans KB facts
- IP hashées si KB recolte feedback (mais ArticleFeedback hors P4)

---

## 6. SÉCURITÉ

- Clés API server-only (pas leak client)
- KB facts SQL injection safe (Prisma parameterized OK)
- Reviewer LLM-judge ne reçoit pas de données personnelles dans contexte
- Telegram alerte REJECT-P0 utilise webhook env var, pas hardcoded

---

## 7. PERFORMANCE & COÛT

- Coût LLM par article :
  - Génération : baseline ~$0.03-0.06 (acquis P1.5)
  - Reviewer LLM-judge : baseline ~$0.03-0.06 (acquis P1.5)
  - Boucle improve : 3 itérations max pour pilier+landing = ~3× coût × 30% des articles → +30% coût moyen attendu
  - **Vérifier dans `cost_tracker` table** que coût moyen / article reste dans budget mensuel
- Bundle size delta minimal (P4 = backend principalement)
- Tests performance Web Vitals : pas de régression

---

## 8. LIVRABLES

### Structure
```
_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-4/verification/
├── VERDICT-VERIFICATION-SPRINT-P4.md
├── CROSS-CUTTING.md
└── agents/
    ├── V4-01.md  (Décisions Will D1-D5)
    ├── V4-02.md  (P0-2 boucle improve)
    ├── V4-03.md  (P0-3 internalLinkCount)
    ├── V4-04.md  (P0-4 image hero slugs)
    ├── V4-05.md  (P0-5 AiContentDisclaimer 39 villes)
    ├── V4-06.md  (P0-6 quarantaine fact-check)
    ├── V4-07.md  (P0-7 REJECT-P0 vs qualité)
    ├── V4-08.md  (P1 prioritaires)
    ├── V4-09.md  (KB pilote audits)
    └── V4-10.md  (Cross-sprint P3+P5)
```

### Format VERDICT-VERIFICATION-SPRINT-P4.md
```markdown
# VERDICT VÉRIFICATION SPRINT P4 — Qualité éditoriale
## Date : YYYY-MM-DD
## HEAD audité : <SHA>
## Score baseline pré-sprint : 547/1000
## Score sprint déclaré : XXX/1000
## **Score vérifié : XXX/1000**

## Verdict global
✅ GO si ≥ 775
🟡 CONDITIONAL si 700-774
🔴 RÉGRESSION si < 547

## Décisions Will D1-D5 — statut application
| Décision | Spec | Implémenté ? | Score |
|----------|------|--------------|-------|
| D1 seuil REJECT 6.0/60 | ... | ✅/⚠️/❌ | XX/30 |
| D2 itérations 3/2 | ... | ✅/⚠️/❌ | XX/30 |
| D3 persona Manon | ... | ✅/⚠️/❌ | XX/40 |
| D4 wording AI Act | ... | ✅/⚠️/❌ | XX/30 |
| D5 reporting hors scope | ... | ✅/⚠️/❌ | XX/20 |

## Scores par agent
| Agent | Score | Max |

## Items OK ✅
| Item | Commit | Statut |

## Items partiels ⚠️
| Item | Issue | Recommandation |

## Items manquants 🔴
| Item | Impact |

## Cross-sprint conflicts
| Sprint | Conflit | Sévérité |

## Tests fonctionnels résultats (8 tests)

## Gates anti-régression
- typecheck : ✅/❌
- vitest : XXXX/XXXX
- isolation-check : ✅/❌
- prisma migrate status : ✅/❌

## Coût LLM mensuel projeté (avec D2 itérations)
- Avant P4 : $X/mois
- Après P4 : $Y/mois (+Z%)

## Recommandations
## STOP & ASK Will
```

### Mémoire
Slug : `axionia_verif_sprint_p4_corrections_2026-05-21`

### MEMORY.md
```
- [🟢/🟡/🔴 AxionIA Vérif Sprint P4 LIVRÉE 2026-05-21 — score XXX/1000](axionia_verif_sprint_p4_corrections_2026-05-21.md) — Audit post-sprint P4 qualité éditoriale. D1-D5 appliquées XX/XX. KB pilote audits livré/manquant. Cross-sprint P3+P5 OK/conflits.
```

---

## 9. STOP & ASK FINAL

```
✅ Vérification Sprint P4 livrée.
- HEAD : <sha>
- Score vérifié : XXX/1000 (vs déclaré YYY)
- D1-D5 : X/5 appliquées correctement
- Tests fonctionnels : X/8 OK
- Cross-sprint conflicts : X items

📋 Régressions détectées :

🚀 Suite proposée :
[A] Sprint P4 follow-up (items manquants)
[B] Attendre vérifs P3+P5 → consolider P6
[C] Validation prod
```

---

## 10. PHRASE DE LANCEMENT

```
Lance la vérification décrite dans `_AUDIT/PROMPT-VERIF-SPRINT-P4-CORRECTIONS-2026-05-21.md`. Mode AUDIT-ONLY strict. Lire d'abord VERDICT-SPRINT-P4-CORRECTIONS.md + mémoire axionia_p4_decisions_canoniques_2026-05-21. Spawn 10 sous-agents V4-01 à V4-10. Tests fonctionnels obligatoires : 7 articles différents types + boucle improve + seuil REJECT + quarantaine fact-check + REJECT-P0 vs qualité + AiContentDisclaimer 5 villes + migration Prisma applicable. Gates anti-régression vs baseline P1.5 (typecheck 0, vitest 1376+/1383). Cross-sprint impact P3 (wording AI Act, persona Manon cohérence) + P5 (config DB lisible UI, scope creep). Termine par VERDICT-VERIFICATION-SPRINT-P4.md scoré /1000 + mémoire + STOP & ASK Will. Go.
```

---

*Vérification Sprint P4 — 5-7h autopilot — AUDIT-ONLY*
