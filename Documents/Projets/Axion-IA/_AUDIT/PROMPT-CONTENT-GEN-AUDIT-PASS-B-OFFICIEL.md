# 🏛️ PROMPT AUDIT PASS B OFFICIEL — Content Generator Axion-IA

> Pass B audit final selon master prompt § 22 EXIT V1 + § 19 scoring /200.
> 5 agents parallèles AUDIT-ONLY indépendant.
>
> Mode AUDIT-ONLY STRICT. Production : 1 rapport `.md` unique.

---

```
Skill : axionia-content-generator (mode 🔒 PASS B AUDIT OFFICIEL § 22)

Tu es l'auditeur Pass B officiel défini au master prompt § 17 Sprint 6
+ § 22 EXIT V1 + § 19 scoring /200. V1 (Sprints 1-6) + V2 (Sprints 7-12)
livrés. Audit indépendant pour valider GO PROD.

⛔ MODE AUDIT-ONLY STRICT :
- Aucune édition code, aucun commit, aucun push
- Tu LIS le code + lances guards CI read-only
- Si bug → noter, NE PAS fix (sprint correctif séparé sera lancé par Will)
- Seul livrable : `_AUDIT/CONTENT-GEN-PASS-B-VERDICT-2026-XX-XX.md`

CONTEXTE :
- V1 tag : v1.0.1-content-gen (commit 5cc22ad)
- V2 tag : commit HEAD (à identifier)
- Audit V1 du 2026-05-14 : score 196/200 (audit interne + correctifs)
- Audit Pass B = validation TIERCE indépendante des correctifs internes

╔═══════════════════════════════════════════════════════════════════════╗
║                  LECTURE OBLIGATOIRE                                  ║
╚═══════════════════════════════════════════════════════════════════════╝

1. .claude/skills/axionia-content-generator/SKILL.md
2. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md
   • § 16 méthodologie 8 agents (Pass B = 5 agents conservés)
   • § 17 Sprint 6 — Pass B audit final
   • § 19 scoring /200 + gates par sprint
   • § 21 contraintes intouchables
   • § 22 checklist EXIT V1 (80+ items A-J)
3. _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md
4. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md
5. _AUDIT/CONTENT-GEN-V1-AUDIT-COMPLET-2026-05-14.md
6. docs/adr/0021-content-gen-v1-skeleton-vs-deep-impl.md
7. docs/content-gen/EXIT-V1-CHECKLIST.md

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — Setup                                      ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status
git log --oneline -20
git tag -l "v*-content-gen" | sort -V
git rev-parse HEAD
```

╔═══════════════════════════════════════════════════════════════════════╗
║          PHASE 1 — 5 AGENTS PARALLÈLES PASS B (§ 17 + § 19)          ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
🔐 AGENT SEC — Sécurité + RBAC + RGPD (40 pts)
────────────────────────────────────────────────────────────────────────
- Toutes Server Actions content-gen avec requireAdmin() première ligne
- CSP nonce respecté (pas inline généré)
- HTML sanitize via sanitizeContentGenHtml avant insert DB
- Aucune fuite PII client dans prompts (pii-redaction utilisée)
- Aucun secret en clair commité
- HMAC ingest KB timing-safe
- Rôle admin éditorial restreint
- RGPD : prompts loggés PII anonymisée
- CORS strict routes API content-gen
- Headers OWASP top 10
- INDEXNOW_KEY fichier public/{key}.txt aligné env

────────────────────────────────────────────────────────────────────────
📚 AGENT DOCTRINE — Doctrine + SEO/AEO/GEO + Manon (50 pts)
────────────────────────────────────────────────────────────────────────
- Naming Axion-IA partout (0 occurrence "AxionIA" non-doctrine-check)
- FR uniquement UI admin + content-gen workers
- Manon canonical : zéro réseau social + IA disclosed + isPersona +
  personaDisclaimer
- AxionIA-centric ≥ 95 % ratio (doctrine-check)
- Anti-doorway HCU 2024 : tier-2 default + tier-1 promotion humaine
- Mot "formation" banni → "intervention"
- Tarifs SSOT via formatAmount()
- Palette intouchable (var --color-terracotta)
- 10 factories JSON-LD complètes + testées
- llms.txt + sitemap split + IndexNow ping wirés
- Checklist 60+ items § 9.7 master prompt

────────────────────────────────────────────────────────────────────────
⚡ AGENT PERF — Web Vitals + bundle + Lighthouse (30 pts)
────────────────────────────────────────────────────────────────────────
- pnpm lhci passe routes critiques (LCP ≤ 1800ms, INP ≤ 100ms, CLS = 0)
- Bundle First Load JS ≤ 75 KB gz/route (110 KB /reserver)
- Aucun "use client" injustifié (pnpm use-client:check)
- React Server Components lourds lazy-loadés
- Pas de Date.now() dans render (purity)
- Images AVIF/WebP/JPG 3 widths via sharp pipeline
- Web Vitals RUM table WebVitalSample peuplée
- Pas de console.log() actif en prod

────────────────────────────────────────────────────────────────────────
🧬 AGENT COHERENCE — Cross-imports + Prisma + workers + flows e2e (50 pts)
────────────────────────────────────────────────────────────────────────
- pnpm content-gen:isolation-check OK
- 16+ models content-gen alignés + 16+ enums Prisma
- Toutes valeurs enum reflétées UI constantes (STATUSES, etc.)
- 11+ workers BullMQ tous wired worker.ts main()
- bootRepeatableJobs configure tous crons content-gen
- 44+ pages admin présentes sans route 404
- 15+ Server Actions modules cohérents
- 9 generators avec sub-prompts distincts (V2 vs V1 delegation)
- Routes publiques content-gen présentes (/equipe/, /blog/, /actualites/, /faq/)
- Flow campagne → review → publish → IndexNow câblé E2E

────────────────────────────────────────────────────────────────────────
🧪 AGENT TESTS — Suite tests + CI gates + isolation (30 pts)
────────────────────────────────────────────────────────────────────────
- pnpm typecheck OK
- pnpm test 673+ verts (suite complète maintenue V1)
- Coverage content-gen ≥ 60 %
- Tests E2E Playwright smoke (5 scénarios)
- Tests integration providers + workers + quality modules
- Pre-commit hooks tous PASS
- pnpm verify:all exit 0
- pnpm build (Next 16 production) exit 0 — toutes routes générées
- Coolify auto-deploy workflow présent + secrets configurés
- Healthcheck route /api/health (ou /content-gen/health)

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 2 — Synthèse + verdict /200                    ║
╚═══════════════════════════════════════════════════════════════════════╝

Rapport `_AUDIT/CONTENT-GEN-PASS-B-VERDICT-2026-XX-XX.md` :

```markdown
# Content Generator — Pass B audit final officiel (YYYY-MM-DD)

## 1. Contexte
- V1 tag v1.0.1-content-gen + V2 commits HEAD
- Audit V1 interne 196/200 (2026-05-14)
- Pass B = validation TIERCE indépendante

## 2. Scoring /200 (réf § 19.1 master prompt)

| Agent | Pondération | Score | Findings |
|-------|-------------|-------|----------|
| SEC Sécurité + RBAC + RGPD | 40 | XX/40 | ... |
| DOCTRINE + SEO/AEO/GEO + Manon | 50 | XX/50 | ... |
| PERF Web Vitals + bundle | 30 | XX/30 | ... |
| COHERENCE cross-imports + Prisma | 50 | XX/50 | ... |
| TESTS + CI gates | 30 | XX/30 | ... |
| **TOTAL** | **200** | **XXX/200** | **YY %** |

## 3. Verdict (§ 19.2 gates)

🟢 **GO PROD UNCONDITIONAL** : ≥ 180/200 (90 %) + 0 P0 ouvert
🟢 **GO PROD CONDITIONAL** : ≥ 160/200 + ≤ 3 P1 corrigeables 48h
🟡 **NEAR-GO** : 140-159/200 ou ≥ 1 P0 avec workaround
❌ **NO-GO** : < 140/200 ou ≥ 2 P0 sans workaround

## 4. Top 15 findings priorisés P0/P1/P2/P3

| # | Priorité | Agent | Description | File:Line | Effort fix |

## 5. Cohérence vs audit V1 interne
- Score V1 interne : 196/200 (2026-05-14)
- Score Pass B tiers : XXX/200
- Delta : +/- YY pts
- Régressions introduites par V2 ? (à croiser avec audit A2)

## 6. Items SKELETON V1 acceptés (ADR 0021)
NE PAS comptabiliser comme bugs (déjà documentés roadmap V2).

## 7. Bloqueurs Will infrastructure
[liste 7 clés API + migration + INDEXNOW + DPA + ...]

## 8. Recommandations pré-prod
- P0 : ... (fix obligatoire)
- P1 : ... (sous 48h)
- P2 : ... (itération continue)

## 9. Verdict global
🟢 / 🟡 / ❌ — décision Will GO/NO-GO

## 10. Métadonnées
- Durée : X h
- Fichiers scannés : Y
- Issues détectées : Z
```

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER                                     ║
╚═══════════════════════════════════════════════════════════════════════╝

Mode : 🔒 AUDIT-ONLY STRICT. Production rapport unique. Aucun fix.
```
