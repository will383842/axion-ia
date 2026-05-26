# ADR 0030 — Capture Calendly via Embed JS (option gratuite)

- **Date** : 2026-05-26
- **Status** : Accepted
- **Sprint** : Notif Infra 2026-05-26 (PR `feat/notif-infra-contacts-calendly`)
- **Chantier** : 3 (sur 5 dans le sprint)

## Contexte

Will utilise Calendly **Free** (plan gratuit) — le widget inline est configuré
sur `/appel`, l'URL `NEXT_PUBLIC_CALENDLY_APPEL_URL` est injectée en build-arg
GHCR. Les réservations sont entièrement gérées par Calendly côté SaaS.

Problème : Will souhaite **être notifié sur Telegram** à chaque réservation
(notification temps-réel à côté du mail Calendly natif), **persister les
événements dans la DB** (analytics + lien optionnel à une `Submission` existante),
et exposer un listing admin.

Options envisagées :

| Option                                                        | Coût          | Complexité               | Décision Will       |
| ------------------------------------------------------------- | ------------- | ------------------------ | ------------------- |
| **A** — Calendly Standard ($12/mois) + webhook officiel signé | 144 €/an      | basse                    | ❌                  |
| **B** — Zapier (Free / Pro)                                   | 0 → 20 €/mois | moyenne                  | ❌                  |
| **C** — IMAP listener Gmail (parse emails Calendly entrants)  | 0             | élevée (parsing fragile) | ❌                  |
| **D** — Embed JS `postMessage` listener (code direct)         | 0             | basse                    | ✅ figée 2026-05-26 |

## Décision

**Option D — Embed JS `postMessage` listener client-side**, avec persistance
serveur + notif via hub typé (`@/server/notifications` — ADR 0029).

### Architecture

1. **Client component** `src/components/booking/CalendlyEventCapture.tsx` :
   - Listener `window.addEventListener("message", ...)` post-mount via `useEffect`
   - Origin check strict : `e.origin.endsWith("calendly.com")` (rejette les
     events forgés depuis un autre iframe)
   - Filtre `event === "calendly.event_scheduled"` uniquement (les autres
     events Calendly comme `profile_page_viewed`, `event_type_viewed`,
     `date_and_time_selected` sont purement analytics et ne sont pas
     persistés)
   - POST `/api/calendly/client-event` avec `keepalive: true` (survit à un
     navigateClose immédiat post-réservation)
   - Fail-soft : si POST KO, Will reçoit toujours le mail Calendly direct

2. **API route** `src/app/api/calendly/client-event/route.ts` :
   - Node runtime (Prisma + ioredis requis)
   - Rate-limit IP : 5 events/min/IP (anti-spam)
   - Zod validation stricte sur `eventName`, `payload`, `eventTypeSlug`,
     UTM, pageUrl
   - Dédup logique 60 s : si `eventTypeSlug + ipHash` capturé dans les 60
     dernières secondes → return `200 deduped` (anti-double-submit)
   - Persiste `CalendlyEvent` (table dédiée — cf. schéma ci-dessous)
   - Déclenche `notify({ category: "CALENDLY_INVITEE_CREATED" })`

3. **Modèle Prisma** `CalendlyEvent` (additif) :
   - `eventTypeName` + `eventTypeSlug` (édition manuelle Will possible)
   - `status` enum : `scheduled` (default) / `canceled` / `completed` / `no_show`
   - `source` enum : `embed_js` (V1) / `manual_import` / `webhook` (V2 future)
   - `rawPayload Json` pour debug + future re-process
   - `linkedSubmissionId` FK optionnelle (match manuel admin)
   - UTM tracking + referrer

### Limitations honnêtes (à mentionner dans l'UI admin)

- **Annulations / reschedules** : Calendly Free ne notifie PAS le widget JS
  → ces events ne sont **pas captés automatiquement**. Will les marque
  manuellement dans l'admin après consultation de sa boîte Gmail
  (notifications Calendly natives).
- **PII partielle** : Calendly Embed JS ne fournit pas systématiquement
  `invitee.email` / `invitee.name` dans le payload `event_scheduled` (raisons
  RGPD). Le hub persiste ce qui est disponible ; Will complète manuellement
  via l'admin si besoin de match `Submission`.
- **Bandeau d'info** affiché sur `/admin/contacts/calendly` pour rappeler ces
  contraintes.

## Conséquences

### Positives

- **Coût zéro** : reste sur Calendly Free.
- **Temps-réel** : notif Telegram < 2 s après réservation côté user.
- **Audit-trail DB** : `CalendlyEvent` permet analytics (taux conversion
  /appel, UTM attribution, etc.) sans recours à un export Calendly.
- **Réversible** : si Will change d'avis, le composant `CalendlyEventCapture`
  peut être désactivé en retirant le mount sur `/appel/page.tsx`. La table
  `CalendlyEvent` peut rester en place (additive — cf. drift contract).

### Négatives / trade-offs assumés

- **Annulations non captées** automatiquement (documenté).
- **PII partielle** — Will complète manuellement (documenté).
- **Dépendance API Embed JS Calendly** non documentée comme stable : si
  Calendly change le shape du `postMessage`, on perd la capture. Mitigé par :
  hub fail-soft (Will recevra toujours le mail Calendly direct), test
  unitaire sur le Zod schema.

## Upgrade path V2 (futur, si Will change d'avis)

Si Will upgrade vers Calendly Standard ($12/mois) :

1. Créer un webhook subscription dans Calendly Dev Console (URL
   `https://axion-ia.com/api/calendly/webhook`, secret signing key)
2. Créer `src/app/api/calendly/webhook/route.ts` (pattern Stripe : HMAC
   verify + outbox `CalendlyWebhookEvent` pour idempotence)
3. `CalendlyEvent.source = "webhook"` pour les events captés via webhook
4. Le listener Embed JS peut rester actif comme **fallback** (dédup 60 s
   évite les doublons si les deux capturent le même event).

Effort estimé : ~3-4 h.

## Tests

`src/app/api/calendly/client-event/__tests__/route.test.ts` — 6 cas :

- Happy path (200 + event créé + notify appelé avec category correcte)
- Rate-limit dépassé → 429
- JSON invalide → 400 `invalid_json`
- Payload Zod invalide (mauvais eventName) → 400 `invalid_payload`
- Dédup 60 s → 200 `deduped` (pas de create, pas de notify)
- Payload sans `invitee.email` → 200 + champs PII omis

**6/6 verts.**

## Actions Will post-merge

- Vérifier que `NEXT_PUBLIC_CALENDLY_APPEL_URL` est bien défini en Coolify
  scope **BUILD + RUN** (sinon le component `CalendlyEventCapture` ne se
  monte pas — cf. `if (CALENDLY_APPEL_URL)`).
- Tester en navigation privée : faire une vraie réservation Calendly de test
  → vérifier notif Telegram + visible dans `/admin/contacts/calendly`.

## Références

- Documentation Calendly Advanced Embed : https://help.calendly.com/hc/en-us/articles/360020052833-Advanced-embed-options
- ADR 0029 — Hub notifications (utilisé pour le `notify()`)
- Sprint plan : `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/PROMPT.md`
