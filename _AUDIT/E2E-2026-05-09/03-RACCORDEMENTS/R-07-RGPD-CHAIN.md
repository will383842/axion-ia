# R-07 — RGPD CHAIN

## Diagramme ASCII

```
                  ┌──────────────────────────┐
                  │ Bannière cookies         │
                  │ /preferences-cookies     │
                  │ ⚠️ AGT-09 P1 : copy      │
                  │ trompeur sans toggle     │
                  └────────┬─────────────────┘
                           │ consent stored
                           ▼
              ┌─────────────────────────────┐
              │ Cookie storage              │
              │ Plausible analytics         │
              │ (chargement après consent ?)│
              └────────┬────────────────────┘
                       ▼
              ┌─────────────────────────────┐
              │ Plausible self-host EU      │
              │ (sous-processeur ?)         │
              └─────────────────────────────┘

User-driven actions :
  ┌────────────────┐   ┌──────────────────────┐   ┌────────────────┐
  │ /mes-donnees   │ → │ /api/gdpr-export/    │ → │ email avec     │
  │ (P1 form abs.) │   │ request POST         │   │ HMAC URL signée│
  └────────────────┘   │ rate-limit + Zod     │   └────────┬───────┘
                       │ + Turnstile          │            │
                       │ ⚠️ AGT-09 P0 lien    │            ▼
                       │ pointe /mes-donnees/ │   ┌────────────────┐
                       │ export QUI N'EXISTE  │   │ /api/gdpr-     │
                       │ PAS                  │   │ export GET     │
                       └──────────────────────┘   │ (token signé)  │
                                                  └────────────────┘

Newsletter :
  /api/unsubscribe (GET+POST One-Click RFC 8058) ✅ AGT-09 confirme
  /confirmation/newsletter double opt-in token unique

Retention :
  BullMQ retention-purge-worker cron `0 3 * * *`
  scopes: Submission, Booking (deletedAt), NewsletterSubscriber, ActivityLog
  audit trail emailHash SHA-256 (AGT-09)

Sous-processeurs :
  Hetzner DE ✅ legal.ts
  Cloudflare US/EU Free ✅ legal.ts
  Telegram ✅ legal.ts (PII redacted ADR 0010)
  PowerMTA + MailWizz ✅ legal.ts
  Backblaze R2 ⚠️ retiré code MAIS reste mentionné AGT-12 dans scripts/backup-postgres-r2.sh
  Sentry ⚠️ AGT-09 P1 absent legal.ts
```

## Findings clés

1. **AGT-09 P0** `/mes-donnees/export` page inexistante mais référencée en email → flow self-service GDPR cassé bout-en-bout.
2. **AGT-09 P0** DPA Hetzner + Cloudflare "🟡 à signer / à accepter" (`_AUDIT/DPA-REGISTER.md:18-19,45`) → conformité Art. 28 non démontrée formellement (Action Will hors code, ~1 h).
3. **AGT-09 P1** Sentry absent sous-processeurs legal.ts (mais aggravé par AGT-14 P0 PII scrub absent !).
4. **AGT-09 P1** Contradiction "pas de transfert hors UE" vs Cloudflare/Telegram listés (Cloudflare a infra US et Telegram = Dubai).
5. **AGT-09 P1** Sentry sans `beforeSend` PII scrubber — confirme et croise AGT-14 P0-M2.
6. **AGT-09 P1** `prisma.Submission` sans `consentVersion` → trace consent versioning manquante.
7. **AGT-09 P1** `registrikood`/EU VAT toujours "sur demande" → mentions légales incomplètes.
8. **Confirmations positives** : Backblaze code OK retiré (grep 0 src/), PII Telegram redaction sur 10 sites publics OK, RFC 8058 unsubscribe complet, retention purge worker câblé, double opt-in newsletter ok, admin erase actions implémentées.

## Cohérence chaîne

✅ Erase + Export + Unsubscribe : APIs implémentées.
✅ Retention purge automatique RGPD.
✅ Double opt-in newsletter.
✅ PII redaction Telegram (ADR 0010).
⚠️ 2 P0 RGPD = 1 code (export page 404) + 1 admin (DPA non signés).
⚠️ Aggravation par AGT-14 P0 : Sentry `sendDefaultPii` non explicite + `beforeSend` absent → IP, cookies, headers Authorization fuient par défaut sur erreurs prod.
