# AGT-VC8 — Sécurité + RGPD + Observabilité — Summary

**Score** : 72/100 — **Verdict** : 🟡 GO avec conditions

## Résumé

Bases sécurité Axion-IA SOLIDES (env.ts Zod prod-hardened, pii-redaction, sentry-pii-scrub, tiptap-sanitize, telegram). DPA Hetzner + CF signés. **Mais 5 modules content-gen à coder Sprint 1** (DOMPurify wrapper, anti-SIREN, cost cap, 13 Telegram alerts, logger centralisé) — ce sont des fonctionnalités à implémenter, pas des manques de spec.

## Findings clés

| ID | Sev | Item | Effort |
|---|---|---|---|
| VC8-001 | P1 | DOMPurify wrapper html-sanitizer.ts à coder | 2 h S1 |
| VC8-002 | P1 | Anti-SIREN doctrine-check.ts à coder | 2 h S1 |
| VC8-003 | P1 | Cost cap + kill switch CostLedger à coder | 3 h S1 |
| VC8-004 | P1 | 13 Telegram alerts content-gen à coder | 3 h S1 |
| VC8-005 | P1 | Logger centralisé JSON + Redis pub/sub SSE | 2 h S1 |
| VC8-006 | P2 | RBAC feature checks (V2) | 2 h S2 |
| VC8-007 | P2 | Conservation/retention durée à définir | 1 h S2 |

## Bases existantes conformes

- ✅ env.ts Zod prod-hardened (AUTH_SECRET 32+, ADMIN_URL_PREFIX 16+, refuse fallback dev_*)
- ✅ PII redaction (email/name/phone/contactLine) — utilisée webhooks
- ✅ Sentry beforeSend scrub (JWT/EMAIL/IP/PHONE + headers + breadcrumbs)
- ✅ Tiptap sanitize whitelist 45 balises
- ✅ Telegram helpers fail-soft + tags canoniques
- ✅ DPA Hetzner + Cloudflare signés (mémoire infra)
- ✅ CSRF auto via Next 16 Server Actions

## Note Pass B

Les P1 « à coder Sprint 1 » sont des **fonctionnalités à implémenter**, pas des manques de spec → ils ne devraient pas bloquer le verdict GO du master prompt (qui décrit correctement chaque module à coder).
