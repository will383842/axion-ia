# R-05 — FORMS CHAIN (/reserver, /contact, newsletter)

## Diagramme ASCII

```
┌─────────────────────────────────────────────────┐
│ src/components/forms/                           │
│ AuditForm BookingForm ContactForm               │
│ ImplementationForm NewsletterForm RoiForm       │
│ React Hook Form + zodResolver                   │
│ ⚠️ React Compiler skip (RHF watch())            │
│ ⚠️ Turnstile widget NON injecté AGT-10 P0       │
│ ⚠️ Honeypot HTML caché ABSENT AGT-10 P1         │
└──────────────────┬──────────────────────────────┘
                   │ submit FormData
                   ▼
┌─────────────────────────────────────────────────┐
│ src/features/<domain>/actions.ts                │
│ (audit, booking, contact, implementation,       │
│  newsletter — 5 server actions publiques)       │
│ 1. Zod safeParse (75 actions parseées)          │
│ 2. verifyTurnstile (fail-closed prod)           │
│ 3. rate-limit Redis sliding-window              │
│ 4. checkHoneypot (champ "website" formData)     │
└────┬─────────────────┬───────────────────────┬──┘
     │                 │                       │
     ▼                 ▼                       ▼
┌──────────┐  ┌──────────────────┐  ┌─────────────────────┐
│ Prisma   │  │ BullMQ           │  │ Telegram alert      │
│ Booking/ │  │ email-worker     │  │ via lib/telegram.ts │
│ Submission│  │ (Nodemailer +   │  │ PII redacted ADR    │
│ insert   │  │  PowerMTA)       │  │ 0010 Sprint 24.1    │
└──────────┘  │ (Resend INTERDIT)│  └─────────────────────┘
              └──────────────────┘
                   ▼
              ┌──────────────────┐
              │ return { ok }    │
              │ form state UI    │
              │ ⚠️ pas de        │
              │ useFormStatus    │
              │ useActionState   │
              │ (AGT-10 P2)      │
              └──────────────────┘
```

## Findings clés

1. **AGT-10 P0** Turnstile widget client absent dans 6 forms (commentaire explicite `ContactForm.tsx:60-62`). Si secret set en prod → toutes soumissions échouent (`verifyTurnstile` rejette). **À cross-confirmer prod** : `TURNSTILE_SECRET_KEY` est-il set ? Si oui → P0 confirmé Pass B.
2. **AGT-10 P1** `createBookingAction` sans lock pessimiste vs `postOption48hAction` qui lock `FOR UPDATE` → double-click = 2 bookings + 2 emails.
3. **AGT-10 P1** Honeypot serveur `formData.get("website")` checké dans 7 sites mais **aucun input HTML caché** dans les 6 forms → anti-spam non opérationnel.
4. **AGT-08 0 P0** sur la sécurité : Argon2id + rate-limit + CSRF Auth.js + form-action CSP = défense solide.
5. **AGT-10 P2** `useOptimistic` + `useFormStatus` absents → progressive enhancement non implémenté.
6. **AGT-09 P0** Page `/mes-donnees/export` référencée en dur dans `gdpr-export/request/route.ts:48` mais inexistante → 404 sur lien email RGPD.

## Cohérence chaîne

✅ 75 actions Zod safe-parsed (AGT-10).
✅ PII redaction Telegram sur 10 call-sites publics (AGT-09 confirme ADR 0010).
✅ Rate-limit Redis large couverture (AGT-08).
✅ Discriminated unions `{ ok, error }` cohérentes 100 %.
✅ `prisma.$transaction` atomique partout (AGT-11).
⚠️ 3 P0 fonctionnels concentrés sur le flow : Turnstile cassé + booking double-submit + /mes-donnees/export 404.
