# ADR 0029 — Hub notifications centralisé (`@/server/notifications`)

- **Date** : 2026-05-26
- **Status** : Accepted
- **Sprint** : Notif Infra 2026-05-26 (PR `feat/notif-infra-contacts-calendly`)
- **Auteurs** : Will (vision produit) + Claude Opus 4.7 (implémentation autopilot)

## Contexte

Avant ce sprint, le projet exposait `src/lib/telegram.ts` (sender bas niveau)
avec une API string-typée :

```ts
await sendTelegram({ tag: "AUDIT", body: "Nouvelle demande ..." });
```

Cette API souffrait de 4 limitations :

1. **Pas de type-safety** : le `body` est une string libre — aucune garantie
   que les champs nécessaires (submissionId, email, ville...) sont présents.
2. **Pas de canal multiplex** : impossible de router un même event vers
   Telegram **et** Sentry breadcrumb **et** email selon la sévérité.
3. **Pas de déduplication** : un double-submit (network retry, idempotency
   key qui passe DB mais relance `notify`) → deux pings Telegram identiques.
4. **Pas de rate-limit par catégorie** : un flood `SECURITY_ALERT` pouvait
   spam le bot Telegram → Will perd la confiance dans les alertes.

## Décision

On introduit un **hub notifications** sous `src/server/notifications/` qui
expose une API unique typée :

```ts
import { notify } from "@/server/notifications";

await notify({
  category: "CONTACT_FORM_SUBMITTED",
  payload: { submissionId, contactName, contactEmail, formType, locale: "fr" },
  dedupKey: submissionId,
});
```

### Architecture

```
src/server/notifications/
├── index.ts            # API publique : notify(event) -> NotifyResult
├── types.ts            # Discriminated union NotificationEvent (~30 categories)
├── routing.ts          # (category) -> { channels[], severity, rateLimitPerHour? }
├── format.ts           # MarkdownV2 escape + Europe/Paris timezone
├── dedup.ts            # Redis SET NX EX (fail-open)
├── rate-limit.ts       # Redis INCR fixed-window (fail-open)
└── channels/
    ├── telegram.ts     # POST sendMessage parse_mode=MarkdownV2 timeout 3s
    ├── sentry.ts       # breadcrumb + captureMessage si severity >= error
    └── email.ts        # placeholder V1 (caller utilise enqueueEmail direct)
```

### Garanties contractuelles

- **Soft-fail** : `notify()` ne throw JAMAIS. Retourne un `NotifyResult` qui
  reporte l'état de chaque canal (sent / queued / skipped / failed).
- **Type-safe** : la `category` force le shape du `payload` via discriminated
  union — l'IDE refuse `category: "CALENDLY_INVITEE_CREATED"` sans
  `eventStartTime`, `inviteeEmail`, etc.
- **BUILD-safe** : si `REDIS_URL` contient `stub.invalid` (build GH Actions
  externalisé — ADR 0026), dedup + rate-limit deviennent no-op silencieux.
  Tests Vitest aussi.
- **Routing par défaut** : table simple `Record<NotificationCategory, ...>`
  modifiable plus tard via env vars / table admin sans toucher aux call-sites.

### Mode synchrone vs asynchrone

- `severity ∈ ["info", "warn"]` → **sync** (latence acceptable < 200 ms pour
  Server Action utilisateur — form submit, booking).
- `severity ∈ ["error", "critical"]` → **fire-and-forget** (Promise détachée
  via `void`). Pas de queue BullMQ dédiée en V1 : coût d'un fetch Telegram
  vs détacher la Promise est marginal ; on évite une 6ème queue et le risque
  de drift de routing. Si retry + audit-trail persistent deviennent
  prioritaires, Sprint+1 ajoutera `notificationsQueue`.

### Catalogue typé (extrait)

~30 catégories couvrant :

- Formulaires publics : `CONTACT_FORM_SUBMITTED`, `AUDIT_REQUEST_SUBMITTED`,
  `INTERVENTION_REQUEST_SUBMITTED`, `IMPLEMENTATION_REQUEST_SUBMITTED`,
  `QUOTE_REQUEST_RECEIVED`
- Newsletter : `NEWSLETTER_PENDING/CONFIRMED/UNSUBSCRIBED`
- Booking interne : `BOOKING_CREATED`, `BOOKING_CANCELLED`,
  `OPTION_POSTED/CONFIRMED/REFUSED/EXPIRED`
- Calendly : `CALENDLY_INVITEE_CREATED/CANCELED/RESCHEDULED`
- Reply admin : `ADMIN_REPLIED_TO_SUBMISSION` (channels: [] — décision Will figée)
- Ops/infra : `DEPLOY_SUCCESS/FAILED`, `BACKUP_SUCCESS/FAILED`,
  `INCIDENT_DETECTED`, `SECURITY_ALERT` (rate-limit 12/h),
  `STRIPE_EVENT`, `STRIPE_WEBHOOK_SIGNATURE_FAIL`, `MONITORING_ALERT`

### Format Telegram MarkdownV2

Telegram MarkdownV2 réserve 18 caractères (`_ * [ ] ( ) ~ \` > # + - = | { } . !`)
qui doivent être échappés sinon `Bad Request: can't parse entities`. Le hub
applique l'échappement strict via regex avant l'envoi. Les emails contiennent
souvent des `.`et`-`→ tout passe par`escapeMarkdownV2`.

### Severity emojis

| Severity | Emoji |
| -------- | ----- |
| info     | 🟢    |
| warn     | 🟡    |
| error    | 🔴    |
| critical | 🚨    |

## Migration

`src/lib/telegram.ts` devient un thin wrapper `@deprecated` qui mappe les 18
anciens tags vers `notify()` via `mapTagToCategory()`. Les ~9 call-sites
legacy continuent à fonctionner sans modification (signature `sendTelegram` +
`alertOps` + `alertIncident` préservée).

3 call-sites pilotes migrés vers `notify()` direct dans ce sprint :

1. `src/features/unified-contact/actions.ts` — dispatch par type form
2. `src/features/newsletter/actions.ts` — `NEWSLETTER_PENDING`
3. `src/features/admin-calendar/actions.ts` — `cancelBookingAction`

Migration progressive des 6 call-sites restants en Sprint+1.

## Conséquences

### Positives

- **Audit-trail** : Sentry breadcrumb pour severity ≥ error → contexte
  enrichi dans Sentry replays sans pinger Telegram pour les events de
  fond.
- **Rate-limit anti-spam** : Will reçoit max N alertes Telegram/h par
  catégorie, le reste accumulé silencieusement.
- **Dédup réseau** : double-submit → 1 seul ping Telegram (via dedupKey).
- **Extensibilité** : ajouter un canal (Discord, SMS, Slack) = nouveau
  fichier `channels/<x>.ts` + entrée routing — aucun call-site impacté.

### Négatives / trade-offs assumés

- **Pas de queue BullMQ persistante** en V1 → si Telegram est down ET le
  process plante immédiatement après l'event critique → ping perdu. Mitigé
  par : Sentry breadcrumb conserve la trace pour severity ≥ error.
- **Migration progressive** des 6 call-sites restants = double maintenance
  (wrapper + nouveau hub) pendant ~1 sprint. Acceptable.

## Tests

- `__tests__/format.test.ts` — 9 cas (escape MarkdownV2 + formatNotification
  multi-catégories + severity emojis + Europe/Paris timezone)
- `__tests__/routing.test.ts` — 6 cas (channels par catégorie + sync vs async)
- `__tests__/notify.test.ts` — 7 cas (sync send / async queue / dedup hit /
  fail-soft env vars manquantes / fail-soft fetch throw / rate-limit / force bypass)

**22/22 verts.**

## Références

- Telegram Bot API MarkdownV2 : https://core.telegram.org/bots/api#markdownv2-style
- ADR 0026 — Build externalisé GHCR (contrat `stub.invalid`)
- Sprint plan : `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/PROMPT.md`
