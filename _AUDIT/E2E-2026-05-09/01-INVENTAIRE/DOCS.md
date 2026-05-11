# 01-INVENTAIRE — Documentation

## Racine `axionia/`

```
AGENTS.md       ← contient @AGENTS.md import / référencé par CLAUDE.md
CHANGELOG.md
CLAUDE.md       ← référentiel principal pour agents IA (importe AGENTS.md)
Design.md       ← direction visuelle commitée (ADR 0002 + 0007 + 0009)
README.md
SESSION_LOG.md  ← log itinérant
```

## `_AUDIT/` (128 entries — racine + sous-dossiers)

### Audits livrés (échantillon)

- `_AUDIT/AUDIT-PARITY-V14.md` (parity FR↔EN — référence)
- `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` (V1-V6 patches)
- `_AUDIT/AUDIT-FRONTEND-V14-2026-{A..G}.md` (audit V14 multi-volets)
- `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`
- `_AUDIT/AUDIT-OBSOLESCENCES-CONFLITS-2026-05-07.md`
- `_AUDIT/AUDIT-FINAL-VERDICT.md` (Sprint 24 verdict CONDITIONAL GO)
- `_AUDIT/AUDIT-FINAL-AGT-{DOCTRINE,OWASP,RGPD,WEBVITALS}.md`

### ADRs PROPOSITION

- `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`
- `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md`
- `_AUDIT/PLAN-AMENDMENTS-2026-05-08.md`

### Prompts d'audit (snapshot)

```
PROMPT-FRONTEND-AUDIT-V14-2026.md
PROMPT-SEO-AEO-GEO-2026.md
PROMPT-PAGE-PRESSE.md
PROMPT-FRONTEND-PARITY-CHECK.md
PROMPT-PAGE-AUDIT-PERFECT-2026.md
PROMPT-TYPOGRAPHY-2026.md
PROMPT-HEADER-NAVIGATION-2026.md
PROMPT-VISUAL-RHYTHM-2026.md
PROMPT-SEO-MASTER-2026.md
PROMPT-CODE-HEALTH-2026.md
PROMPT-WEB-VITALS-PERFECTION-2026.md
PROMPT-DOC-SYNC-V14.md
PROMPT-PLATFORM-VERIFICATION-COMPLETE-2026.md
PROMPT-DEPLOY-RELIABILITY-2026.md
PROMPT-PROD-SIGNOFF-COMPLEMENTAIRE-2026.md
PROMPT-E2E-DEEP-AUDIT-2026.md          ← celui-ci
```

### Skill suites

- `_AUDIT/01s-A-inventaire.md` → `01s-F-actions.md` (6 fichiers)
- `_AUDIT/01s-skills-deep-audit.md`

### Cert / Pages

- `_AUDIT/CERTIFICATION-FRONTEND-2026/` (dossier complet 23 fichiers, mémoire `axionia_certification_frontend_dossier`)
- `_AUDIT/E2E-2026-05-09/` ← **ce dossier (en cours)**

### Cutover & ops

- `_AUDIT/CHECKLIST-CUTOVER.md` (Sprint 24.1, 9 phases)
- `_AUDIT/DPA-REGISTER.md`

## `docs/` (3 sous-dossiers)

```
docs/adr/
docs/dpo-templates/
docs/ops/
```

### ADRs commitées (10)

```
0001-stack-initial.md
0002-design-pivot-editorial-v3.md
0003-lift-formation-ban.md
0004-typography-baseline-upgrade-v3-1.md
0005-navigation-mega-menu.md
0006-pseo-villes.md
0007-typography-hierarchy-v3-2.md
0008-vocabulary-intervention-coaching.md
0009-hosting-hetzner-cpx32-cloudflare-free.md
0010-telegram-pii-minimisation.md
```

→ ADRs ≈ 1 par décision majeure. Bon ratio. ADR 0007 (hero cap 88px), 0009 (Hetzner CPX32 + CF Free), 0010 (Telegram PII Sprint 24.1) particulièrement chargés.

### Ops runbooks

```
docs/ops/dns-records.md
docs/ops/runbook-deploy.md
docs/ops/runbook-incident.md
docs/ops/runbook-monitoring.md
```

→ Stack runbook complète. Sera audité dans AGT-14 MONITORING-DR + R-08 / R-09.

### DPO templates

- `docs/dpo-templates/` — 4 templates (mémoire `axionia_session_2026-05-09_sprint_24_1`).

## Volume estimé

- `_AUDIT/` : ~128 entrées (la majorité .md), volume ~MB.
- `docs/` : ~17 fichiers (10 ADR + 4 ops + 4 DPO + 1 index probable).
- Doctrine racine : 6 .md (CLAUDE/AGENTS/Design/README/CHANGELOG/SESSION_LOG).

## Cohérence doctrine ↔ code

Mémoire `axionia_doctrine_code_ssot` confirme : **code SSOT**. En cas de divergence, code prime. Les ADRs et `_AUDIT/` sont sources d'aide à la décision et historique, **pas source unique de vérité**.

## Citations

- `_AUDIT/` ls direct (sample ci-dessus).
- `docs/adr/00*.md` (10 ADRs commitées).
- `docs/ops/*.md` (4 runbooks).
- `CLAUDE.md` + `AGENTS.md` racine.
