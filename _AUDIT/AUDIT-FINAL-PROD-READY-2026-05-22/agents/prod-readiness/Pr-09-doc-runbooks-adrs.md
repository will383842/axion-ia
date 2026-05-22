# Pr-09 — Documentation, Runbooks, ADRs

**HEAD** : 81f6ea0e
**Score** : 19 / 25

## Évidence

### Root docs
- `README.md` (8.5 KB, last modified 2026-05-15) — entrypoint nouveau dev.
- `CLAUDE.md` → réfère @AGENTS.md (single source).
- `AGENTS.md` 175+ lignes — performance budget Web Vitals 2026 + Build externalisé GH Actions ADR 0026 (stub.invalid contract complet) + EN locale désactivé procédure re-enable. Doctrine vivante.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `Design.md`, `SESSION_LOG.md` ✅ — racine docs complète.

### ADRs (Architectural Decision Records)
- **ADRs trouvés dans `_AUDIT/`** : 2 explicites visibles (`adr-0003-navigation-mega-menu-PROPOSITION.md`, `adr-0004-pseo-villes-PROPOSITION.md`) + `_AUDIT/KNOWLEDGE-BASE-2026/ADR-DRAFT.md`.
- **ADRs référencés mais non-trouvés en glob direct** : ADR 0009 (Hetzner CPX32 + Coolify + Caddy 2 + Cloudflare Free, cité `Caddyfile:11`), ADR 0026 (Build externalisé GH Actions GHCR, cité `AGENTS.md`), ADR 0027 (image-bank, cité mémoire 2026-05-20).
- **Script `scripts/adr-new.ts`** ✅ — outillage création ADR formalisé.
- **Mémoire 2026-05-17** mentionne "27+ ADRs acquis" — divergence vs glob actuel (visiblement stockés ailleurs ou nommage non-uniforme, non-bloquant pour audit mais polish documentaire à clarifier).

### Runbooks ops
- `_AUDIT/RUNBOOK-PG-RESTORE-DRILL-2026-05-16.md` ✅ (1 fichier formel "RUNBOOK").
- `_AUDIT/E2E-2026-05-09/02-AGENTS/AGT-14-MONITORING-DR.md` ✅ (monitoring + DR procedure).
- `_AUDIT/CERTIFICATION-FRONTEND-2026/28-DATA-RESILIENCE-DR-2026.md` ✅.
- `_AUDIT/DEPLOY-RECOVERY-2026-05-17/` 11 livrables (mémoire 2026-05-18) — runbook complet recovery deploy + autopilot scripts.
- `scripts/ops/` : `coolify-cancel-stuck.sh`, `disk-cleanup.sh`, `hetzner-coolify-health.sh` — outillage runbook actionnable.

### Documentation API
- Endpoints API exposés : `/api/healthz`, `/api/gdpr-export`, `/api/gdpr-erase`, `/api/vitals`, `/api/indexnow`, `/api/internal/kb/search`, `/api/internal/kb/ingest`, `/api/image-bank/import`, `/api/admin/*/export`, `/api/unsubscribe`, Auth.js `/api/auth/*`.
- Commentaires JSDoc inline détaillés (cf. `gdpr-erase/route.ts:1-20`, `healthz/route.ts:1-15`, `proxy.ts:1-13`).
- Pas d'OpenAPI/Swagger spec automatisée détectée. Pas un fail strict (private API admin), mais limite onboarding nouveau dev.

### _AUDIT/ corpus (audit-driven documentation)
- 50+ dossiers sous `_AUDIT/` couvrant chaque sprint audit/cert. Ex: `CONTENT-GEN-PERFECTION-2026/phase-1...phase-6`, `INTEGRATION-PERFECTION-2026-20260520/` (A1-A4, B1-B4, C1-C4 + VERDICT), `PERFECTION-2026-2026-05-22/VERDICT-SPRINT-PERFECTION-2026.md`, `KEYWORD-STRATEGY-AUDIT-2026/`, `META-CERT-2026-05-15/`, `PLATFORM-E2E-CERT-2026-05-15/`, `INDEXATION-DISCOVERY-2026-05-18/`, `DEPLOY-RECOVERY-2026-05-17/`, `image-bank-complet-2026/`, etc.

### Onboarding nouveau dev
- README.md → @AGENTS.md → corpus _AUDIT navigable.
- Scripts CLI documentés `package.json` scripts (anti-siren:check, anti-hex:check, use-client:check, content-gen:isolation-check, zod:check, i18n:check, bundle:check, lhci:autorun, prisma:generate, etc.).
- Pre-commit + pre-push hooks documentés (`.husky/pre-commit`, `.husky/pre-push`).

## Findings P0 / P1 / P2

- **P0** : aucun.
- **P1 (ADRs corpus consolidation)** : Mémoire dit "27+ ADRs acquis" mais glob `**/ADR-*.md` ou `**/adr-*.md` retourne seulement 3 fichiers + 1 draft. Les ADRs 0009 et 0026 sont cités dans le code et AGENTS.md mais ne sont pas trouvés en file system. Recommandation : centraliser tous ADRs sous `_AUDIT/adrs/0001-XX.md` ou `docs/adrs/` standard MADR.
- **P1 (OpenAPI/Swagger spec API)** : aucun spec OpenAPI 3 généré pour les endpoints REST (`/api/gdpr-*`, `/api/healthz`, `/api/vitals`, etc.). Pour onboarding tiers ou audit sécu externe, recommandation : générer `openapi.yaml` minimal via tsoa ou next-swagger-doc.
- **P1 (runbooks consolidation)** : runbooks éparpillés `_AUDIT/RUNBOOK-PG-...`, `_AUDIT/CERTIFICATION-.../28-DATA-RESILIENCE-DR-2026.md`, `_AUDIT/DEPLOY-RECOVERY-2026-05-17/`. Recommandation : index master `_AUDIT/RUNBOOKS-INDEX.md` listant tous les runbooks ops actifs avec cible (incident type + procédure).
- **P2 (Storybook)** : pas de Storybook détecté pour les composants Design System (`src/components/ui/`). Bonus, pas un fail.

## Verdict (paragraphe)

Documentation très riche corpus audit-driven `_AUDIT/` (50+ dossiers de cert/audit/perfection), AGENTS.md vivant doctrinal (Web Vitals 2026 + ADR 0026 stub.invalid + EN locale toggle), README + 6 docs racine. Scripts CLI outillés (anti-siren/anti-hex/use-client/zod/i18n/content-gen-isolation/bundle/lhci/adr-new) facilitent onboarding. Runbooks ops `_AUDIT/RUNBOOK-PG-RESTORE-DRILL` + `AGT-14-MONITORING-DR` + 11 livrables `DEPLOY-RECOVERY-2026-05-17`. Les principaux gaps sont (1) corpus ADRs non centralisé — 3 ADRs filesystem vs 27+ référencés en mémoire, ADRs 0009/0026 cités code mais introuvables glob ; (2) absence OpenAPI spec endpoints REST ; (3) runbooks éparpillés sans index master. Score 19/25 — solide pour usage interne + IA agents, polish ADR centralisation + OpenAPI à clore pour audit externe / scale équipe.
