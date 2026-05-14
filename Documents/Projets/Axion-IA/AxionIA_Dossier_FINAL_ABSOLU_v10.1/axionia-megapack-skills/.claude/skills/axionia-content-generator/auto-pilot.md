# Mode autopilote — Content Generator V1 (v2.5 post-S0ter)

> Cf. § 24 du master prompt `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (v2.5). Ce fichier est le résumé opérationnel + référence rapide.
>
> **Patch S0ter 2026-05-14** : KB V4 codée mergée (KB-1→KB-20 commit `bd0f831`). content-gen consomme via helpers `axionia/src/lib/knowledge/*` et alimente via `POST /api/internal/kb/ingest` HMAC. Embedding Voyage AI dim 1024. Web Vitals intégré. Manon v2.1 portrait IA disclosed + zéro réseau social.

## Pré-requis fournis par Will AVANT lancement

- [ ] **4 clés API** en `.env.local` + Coolify : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `UNSPLASH_ACCESS_KEY` (`OPENAI_IMAGE_API_KEY` OBSOLÈTE v2.0)
- [x] **Profil Manon (Q13)** ✅ RÉSOLU 2026-05-14 : Option 4 portrait IA disclosed + photo `axionia/public/auteurs/manon.png` + bio validée OK tel quel + aucun réseau social
- [ ] **Clé `KB_INGEST_SECRET`** (HMAC ingest API factory) — env var Coolify
- [ ] **`KB_AUTO_PUBLISH=true`** Coolify env var pour publication auto sans review
- [ ] **KB ready** (≥ 50 entries publiées `KnowledgeEntry`) OU `KB_BYPASS=true` — KB V4 mergée bd0f831 a déjà un corpus initial
- [ ] Accès git push origin/main OK
- [ ] Token Coolify API valide

## Défauts d'autorité (13 STOP & ASK auto-résolus)

| Q | Décision auto |
|---|---|
| Q1 budgets | $200 OpenAI + $100 Anthropic + $80 Perplexity + $0 Unsplash = **$380/mois** (révisé v2.0) |
| Q2 modèle text | `gpt-4o` primaire, `gpt-4o-mini` < 800 mots |
| Q3 embeddings | **Voyage AI `voyage-3-lite` dim 1024** (CORRIGÉ S0ter — était OpenAI 512). Helper `@/lib/knowledge/embeddings`. |
| Q4 images | **Unsplash uniquement** (v2.0 — pas de génération IA) |
| Q5 STOP avant gen keywords | OUI (auto-approve 24h sans réponse) |
| Q6 STOP avant gen pilier | OUI (auto-approve 24h sans réponse) |
| Q7 Auto-publish RSS tier-2 si score ≥ 60 | OUI |
| Q8 Rôle admin | super_admin V1 |
| Q9 Cron daily-target autopilot | off default |
| Q10 Q/R groupées articles (FAQ embed) | OUI |
| Q11 RSS sources V1 | LeMondeInfo, ZDNet FR, Usine Digitale, JournalDuNet, Frenchweb |
| Q12 Indexing API Google | **V1 (v2.4) — activé grey-area avec logging** |
| Q12bis OPENAI_IMAGE_API_KEY | **OBSOLÈTE v2.0** (Unsplash uniquement) |
| Q13 Profil Manon | ✅ **RÉSOLU 2026-05-14** : Option 4 portrait IA disclosed + photo placée + bio validée + zéro réseau social. Plus de gate humain bloquant. |

### Défauts d'autorité v1.7 (nouveaux paramètres)

| Paramètre | Défaut |
|---|---|
| Distribution couverture 5 types | blog_from_title 30 % / blog_from_keywords 25 % / comparison 20 % / faq_standalone 15 % / guide_pilier 10 % |
| Distribution intention recherche | informational 45 % / commercial_investigation 30 % / local 15 % / transactional 10 % / navigational 0 % |
| Profil audience mix par défaut | « Mixte équilibré » (pme entreprise 40 / tpe entreprise 20 / eti entreprise 15 / pme école 5 / grande université 5 / pme mairie 5 / pme ce 5 / autres 5) |
| Boucle d'amélioration qualité | ON, seuil déclenchement 75, score minimum 40, max passages auto 2, cost cap $50/mois |
| Auto-création pages Q/R | ON, seuil mots minimum 300, auto-promotion tier-1 CTR > 1 % à 90 j |
| Tier par défaut RSS actualités | tier-2 auto-publié si score ≥ 60, rétrogradation auto si CTR < 2 % à J+30 |
| Anti-doublon cosine seuil | 0.85 (durci v1.7) |
| Anti-doublon Levenshtein seuil titre | 0.85 contre 5 000 derniers |
| Time decay même topic | 12 mois minimum avant re-traitement |
| Concurrency worker boucle qualité | 3 (séparé du worker principal à 5) |

## Pipeline d'exécution

```
Phase 0 reality-check → S1 → GATE → S2 → GATE → S3 → GATE → S4 → GATE → S5 → GATE → S6 → GATE FINAL
```

Chaque GATE de sprint = `pnpm prisma migrate deploy` + `pnpm typecheck` + `pnpm test:unit` + `pnpm verify:all` + `pnpm content-gen:isolation-check` + commit Conventional + push + Coolify deploy + log.

GATE final Sprint 6 ajoute : `pnpm content-gen:exit-check` (parcourt checklist § 22, score / 80 items).

GATE FINAL Sprint 6 :
- Score ≥ 160/200 = 🟢 GO PROD
- 140-159 = 🟡 NEAR-GO + sprint correctif S6.1
- < 140 = 🔴 NO-GO + STOP ASK

## Critères STOP durci (8 cas)

1. Gate sprint FAIL
2. Coût mensuel > 80 % cap
3. 3 commits consécutifs failed
4. Provider down > 30 min
5. Migration Prisma destructive
6. Modification SSOT (`pricing.ts`, `regions.ts`, etc.)
7. Suppression > 100 LOC hors content-gen
8. Q13 Manon manquant au démarrage

## Logs

Journal : `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md` (créer au démarrage si absent). Format :

```markdown
## Sprint N — YYYY-MM-DD HH:MM → YYYY-MM-DD HH:MM
- AGT-X : ✅/❌ description courte. Hash commit.
- GATE SN : ✅ PASS / ❌ FAIL (raison).
- Coût Claude API session : $X.XX
- Statuts ContentGenJob possibles dans logs (v1.7) :
  queued | running | generating_text | generating_image | quality_improving |
  needs_review | approved | publishing | published | failed | cancelled
- CoverageCampaign statuts possibles (v1.7) :
  draft | queued | running | paused | completed | failed | cancelled
- Next : Sprint N+1 OR STOP raison.
```

Reprise après interruption : nouvelle session lit ce log + autopilot.md + master prompt → reprend au sprint où le log s'arrête.

## Phrase d'invocation

```
Skill: axionia-content-generator (mode AUTOPILOTE)

Tu es en mode autopilote bout-en-bout. Lis dans l'ordre :
1. .claude/skills/axionia-content-generator/SKILL.md
2. .claude/skills/axionia-content-generator/auto-pilot.md (ce fichier)
3. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 24
4. _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md
5. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (créer si absent)

Applique les défauts § 24.2 pour les 13 STOP & ASK. Q13 Manon = SEUL gate
humain bloquant.

Phase 0 reality-check § 2.1. Si KO → STOP ciblé.
Si log montre Sprint N passé → reprends Sprint N+1.
Sinon démarre Sprint 1.

À chaque sprint : agents AGT-A..H en // → verify:all → commit Conventional →
push origin/main → Coolify deploy → log → sprint suivant immédiatement.

Critères STOP durci § 24.4. Hors ces 8 cas, avance sans demande inutile.

Cible : Sprint 6 → Verdict 🟢 GO PROD score ≥ 160/200.

Doctrine intouchable : AxionIA-centric ≥ 95 %, FR-only, auteur Manon,
anti-doorway HCU, checklist SEO/AEO 60+ items, Web Vitals stricts,
SLO p50 landing ville ≤ 90 s.

Mode : 🛠️ BUILD + AUTOPILOTE.
```

## Garde-fous coûts session Claude

- Budget tokens Claude estimé : ~$50-150 sur l'ensemble des sessions cumulées pour V1 complet.
- Aucune génération de contenu pendant l'autopilote — l'autopilote BUILD l'outil, il ne RUN pas.
- Première vraie génération test : Sprint 2 Gate (1 landing ville test, ~$0.50).

## Réversibilité

- `STOP AUTOPILOTE` → résume état + commit current WIP + log final
- Audit intermédiaire à la demande → Pass B mid-stream
- Modifier défauts § 24.2 → reprise avec nouvelles valeurs
- Rollback Sprint N → `git revert <commit>` + reprise S(N-1)
