# 🔄 PROMPT AUDIT A2 — Régression V1 → V2 (Content Generator Axion-IA)

> Audit dédié : vérifier que les Sprints 7-12 V2 (livrés) ne cassent
> AUCUN use case V1 livré (Sprints 1-6 + tag v1.0.1).
>
> Mode AUDIT-ONLY strict. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT A2 — Régression V1 → V2)

Tu es l'auditeur régression. V1 (Sprints 1-6) tag v1.0.1-content-gen +
audit V1 correctifs `5cc22ad` ont été livrés. V2 (Sprints 7-12) a été
livré dans des sessions séparées. Ton job : vérifier que V2 N'A RIEN
CASSÉ de ce qui marchait en V1.

CONTEXTE :
- V1 (§ 3.1 master prompt) : 7 types content, 3 providers, console admin,
  pipeline RSS, anti-plagiat, KB lite, tracking coûts, tier-2 default
- V2 (§ 3.2 master prompt) : auto-pilot daily_target, migration FS→DB
  Article, ISR Next 16, Indexing API Google + IndexNow auto tier-1,
  Search Console+Plausible promo auto, multi-modèles compétition,
  KB avancée, KeywordTracker, QualityDashboard, fact-check V2,
  embeddings dedup cosine < 0.85

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition code, aucun commit, aucun migrate
- Tu LIS : code V1 (commits ≤ 5cc22ad) vs code V2 (commits > 5cc22ad)
- Tu LANCES : pnpm typecheck + pnpm test + git diff inter-tags
- Si bug détecté → noter, NE PAS fix
- Seul livrable : `_AUDIT/CONTENT-GEN-AUDIT-A2-REGRESSION-2026-XX-XX.md`

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. .claude/skills/axionia-content-generator/SKILL.md
2. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md
   • § 3.1 scope V1 (référence baseline régression)
   • § 3.2 scope V2 (ce qui a été ajouté)
   • § 22 EXIT V1 checklist (use cases V1 à préserver)
3. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (sprints livrés + dates)
4. _AUDIT/CONTENT-GEN-V1-AUDIT-COMPLET-2026-05-14.md (verdict V1 = 196/200)
5. docs/adr/0021-content-gen-v1-skeleton-vs-deep-impl.md (items V1 skeleton
   que V2 devait étoffer SANS casser)
6. docs/content-gen/EXIT-V1-CHECKLIST.md (80+ items A-J validés V1)
7. Si présents : ADR 0022+ (V2 décisions architecturales)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 0 — Setup baseline V1 vs HEAD V2                          ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -50
git tag -l "v*-content-gen" | sort -V
git rev-parse v1.0.1-content-gen  # baseline V1
git rev-parse HEAD                  # HEAD V2

# Diff entre V1 et V2
git diff v1.0.1-content-gen..HEAD --stat | head -50
git log v1.0.1-content-gen..HEAD --oneline
```

Note :
- Commit baseline V1 (tag v1.0.1) : SHA1
- Commit HEAD V2 : SHA1
- Nb commits V2 ajoutés
- Nb fichiers modifiés / ajoutés / supprimés

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 1 — Régression sur tests (suite vitest)                   ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
cd axionia/
pnpm typecheck                     # Doit passer (V2 type-safe)
pnpm test --run                    # 673+ verts baseline V1 maintenu ?
pnpm content-gen:isolation-check   # Isolation V2 préservée ?
pnpm anti-siren:check
pnpm anti-hex:check
pnpm use-client:check
pnpm verify:all
```

Vérifier :
- [ ] Tous les tests V1 existants passent ENCORE (pas supprimés/désactivés)
- [ ] Nouveaux tests V2 ajoutés (Sprint 7-12 doit ajouter ~50+ tests)
- [ ] Coverage content-gen identique ou supérieur vs V1 baseline
- [ ] Aucun `it.skip()` ou `describe.skip()` injustifié ajouté V2

Compter :
- Tests V1 baseline (`git checkout v1.0.1-content-gen && pnpm test --run`)
- Tests V2 actuels
- Delta : devrait être positif

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 2 — Régression sur schema Prisma                          ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git diff v1.0.1-content-gen..HEAD prisma/schema.prisma
git diff v1.0.1-content-gen..HEAD prisma/migrations/ --stat
```

Vérifier :
- [ ] **Aucune colonne V1 supprimée** (`ALTER TABLE ... DROP COLUMN`)
- [ ] **Aucun model V1 supprimé** (`DROP TABLE`)
- [ ] Toutes les nouvelles colonnes V2 sont nullable ou ont default
      (pas de breaking sur data V1 existante)
- [ ] Nouveaux enums V2 ajoutés, pas modifications enum V1 (rename
      = breaking)
- [ ] FK Article ↔ ContentGenJob préservées (V1 ↔ V2 cohérent)
- [ ] Migrations V2 séquencées correctement (pas d'overlap timestamp)
- [ ] Index V1 toujours présents (perf préservée)
- [ ] @@map snake_case preserved

Cross-check § 3.2 V2 :
- Table `KeywordTracking` ajoutée ?
- Embeddings column pgvector ajoutée à Article ou table dédiée ?
- Si table dédiée : FK Article correcte ?

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 3 — Régression sur Server Actions (signatures)            ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE Server Action V1 dans `src/server/actions/content-gen/` :

```bash
# Liste actions V1 baseline
git show v1.0.1-content-gen:src/server/actions/content-gen/ \
  | xargs -I {} grep -h "^export async function" {}

# Comparer signatures avec HEAD V2
```

Vérifier :
- [ ] **Aucune signature V1 changée** (params ordre, types) — sinon callers
      pages V1 cassent
- [ ] **Aucune Server Action V1 supprimée** (callers UI cassent)
- [ ] Nouvelles Server Actions V2 ajoutées (KeywordTracker CRUD, etc.)
- [ ] Returns types backward-compatible (ajout champs OK, suppression NON)
- [ ] requireAdmin() toujours en première ligne (pas de bypass V2)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 4 — Régression sur pages admin (routes + UI)              ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
# Lister routes V1
git ls-tree -r v1.0.1-content-gen --name-only \
  | grep "src/app/.*content-gen.*page.tsx" | sort > /tmp/routes-v1.txt

# Lister routes V2
find src/app/[locale]/(admin)/[adminPrefix]/content-gen \
  -name "page.tsx" | sort > /tmp/routes-v2.txt

# Diff
diff /tmp/routes-v1.txt /tmp/routes-v2.txt
```

Vérifier :
- [ ] **Aucune page V1 supprimée** (44 pages V1 toujours là)
- [ ] Nouvelles pages V2 ajoutées (`/keyword-tracking`, `/quality`,
      `/web-vitals`, `/projection-cout`, `/aeo-tests`, `/multi-models`)
- [ ] `revalidatePath()` cibles préservées (URLs V1 toujours rafraîchies)
- [ ] Nav admin layout enrichi (entrée V2 ajoutées) sans suppression V1

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 5 — Régression sur workers BullMQ                         ║
╚═══════════════════════════════════════════════════════════════════════╝

Workers V1 (audit complet 2026-05-14) :
- content-gen-worker, content-orchestrator-worker, content-publish-worker,
  content-quality-improver-worker, content-rss-fetch-worker,
  content-similarity-monitor-worker, content-news-lifecycle-worker,
  content-indexnow-worker, content-google-indexing-worker, content-qa-extract-worker

Workers V2 attendus (§ 13.2 master + V2 scope) :
- content-tier-lifecycle-worker (mensuel, promote/demote selon CTR)
- content-multi-models-compete-worker (si livré Sprint 11)
- content-search-console-sync-worker (daily CTR sync)
- content-plausible-sync-worker (daily viewCount sync)
- content-fact-check-worker (Sprint 12 fact-checking Perplexity)
- content-keyword-tracker-sync-worker (hebdo GSC + SerpAPI)
- content-aeo-tester-worker (hebdo 50 prompts × 5 LLMs)

Vérifier :
- [ ] Tous workers V1 toujours présents (`ls src/server/queue/workers/`)
- [ ] Workers V2 ajoutés (selon livraison)
- [ ] worker.ts main() boot tous les workers V1+V2
- [ ] `bootRepeatableJobs()` configure crons V1 + V2 nouveaux
- [ ] Aucune queue V1 supprimée / renommée
- [ ] Aucun BullMQ jobId V1 renommé (sinon perte historique)

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 6 — Régression flows end-to-end V1                        ║
╚═══════════════════════════════════════════════════════════════════════╝

Pour CHAQUE flow V1 critique (audit OPERATIONNEL-FLOWS), vérifier qu'il
fonctionne TOUJOURS en V2 :

| Flow V1 | Toujours fonctionnel V2 ? | Notes |
|---------|---------------------------|-------|
| G1 — Génération unitaire manuelle | | |
| G3 — Campagne couverture région | | |
| G4 — RSS pipeline blog_from_rss | | |
| G5 — Q/R post-process auto | | |
| G6 — Boucle qualité re-prompt | | |
| P1 — Auto-publication tier-2 | | |
| P2 — Approve tier-2 manuel | | |
| P3 — Promote tier-1 manuel | | |
| D1 — Reject manuel | | |
| D7 — Cancel campagne | | |
| D8 — Kill switch | | |
| M3 — Édition profil Manon | | |
| R2 — Retry failed job | | |

Si un flow V1 cassé en V2 → P0 régression bloquante.

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 7 — Régression doctrine intouchable                       ║
╚═══════════════════════════════════════════════════════════════════════╝

V1 a verrouillé :
- Naming Axion-IA partout
- FR uniquement
- Manon canonical (zéro réseau social)
- AxionIA-centric ≥ 95 %
- Anti-doorway HCU (tier-2 default)
- Tarifs SSOT formatAmount()
- Palette var --color-terracotta

V2 a-t-il INTRODUIT des violations ?

```bash
# Re-run doctrine checks sur HEAD V2
pnpm anti-siren:check
pnpm anti-hex:check

# Cross-check naming Axion-IA dans nouveaux fichiers V2
git diff v1.0.1-content-gen..HEAD --name-only | xargs grep -l "AxionIA[^_-]" 2>/dev/null

# Cross-check formation banni
git diff v1.0.1-content-gen..HEAD -- src/server/content-gen/ src/app/ \
  | grep -iE "^\+.*\bformation\b" | head -10
```

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 8 — Régression performance + bundle                       ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
# Bundle delta V1 → V2
cd axionia/
pnpm build > /tmp/build-v2.log 2>&1
grep "First Load JS" /tmp/build-v2.log

# Comparer avec build V1 (si disponible)
git checkout v1.0.1-content-gen
pnpm build > /tmp/build-v1.log 2>&1
git checkout main
diff /tmp/build-v1.log /tmp/build-v2.log
```

Vérifier :
- [ ] First Load JS routes content-gen ≤ V1 + 5 KB gz max (cible budget)
- [ ] Aucune route V1 a explosé > 75 KB gz (budget AGENTS.md)
- [ ] pnpm size-limit (si configuré) passe sans regression
- [ ] Web Vitals lab Lighthouse stable

╔═══════════════════════════════════════════════════════════════════════╗
║       PHASE 9 — Synthèse + verdict                                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-AUDIT-A2-REGRESSION-2026-XX-XX.md` :

```markdown
# Audit A2 — Régression V1 → V2 (YYYY-MM-DD)

## 1. Contexte
- Baseline V1 : commit `xxx` tag v1.0.1-content-gen
- HEAD V2 : commit `yyy`
- Délai V1 → V2 : X jours
- Commits ajoutés : ZZ
- Fichiers modifiés : AA / ajoutés : BB / supprimés : CC

## 2. Tests régression
| Métrique | V1 baseline | V2 actuel | Delta |
|----------|-------------|-----------|-------|
| Tests verts | 673 | XXX | +YY ou -YY |
| Coverage content-gen | XX % | YY % | +/-Z % |
| Suite duration | Xs | Ys | +/- |

## 3. Schema Prisma
| Action | Count | Détail |
|--------|-------|--------|
| Colonnes V1 supprimées | 0 ❌ | bug bloquant |
| Tables V1 supprimées | 0 ❌ | bug bloquant |
| Nouvelles tables V2 | XX | KeywordTracking, ... |
| Migrations V2 ajoutées | YY | _add_content_gen_v2_* |

## 4. Server Actions
| Signature V1 | V1 → V2 | Régression ? |
|--------------|---------|--------------|

## 5. Pages admin
| V1 (44) | V2 (XX) | Δ |

## 6. Workers BullMQ
| Worker V1 | Présent V2 ? |
| Worker V2 ajouté | Boot OK ? |

## 7. Flows e2e V1 préservés
[matrice 13+ flows × ✅/⚠️/❌]

## 8. Doctrine régressions
| Violation | Count | Sévérité |

## 9. Performance régressions
| Route | V1 (KB gz) | V2 (KB gz) | Delta | Budget OK ? |

## 10. Top régressions priorisées
| # | P0/P1 | Catégorie | Description | File:Line |

## 11. Verdict /100
- Tests verts maintenus : 20 pt
- Schema préservé (pas de DROP) : 20 pt
- Server Actions signatures stables : 15 pt
- Pages V1 présentes : 10 pt
- Workers V1 toujours bootés : 10 pt
- Flows e2e V1 fonctionnels : 15 pt
- Doctrine préservée : 5 pt
- Bundle ≤ V1+5 KB : 5 pt

🟢 ZÉRO RÉGRESSION : ≥ 90/100
🟡 RÉGRESSIONS MINEURES : 70-89/100
❌ RÉGRESSIONS BLOQUANTES : < 70/100

## 12. Recommandations
- P0 : régressions à fix AVANT prod
- P1 : suivi 48h
- P2 : itération V2.5

## 13. Métadonnées
- Durée : X h
- Commits parcourus : ZZ
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
```
