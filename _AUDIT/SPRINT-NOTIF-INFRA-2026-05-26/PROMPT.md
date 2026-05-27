# Sprint — Notifications Infra + Contacts/Calendly (Axion-IA)

> **Date de création** : 2026-05-26
> **Auteur** : Will (via Claude Opus 4.7 1M context, conv préparatoire)
> **Branche cible** : `feat/notif-infra-contacts-calendly`
> **Ne PAS push sur main sans validation Will**

---

## Mission

Tu travailles sur `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (Next.js 16 App Router + React 19 + Prisma 5.22 + Postgres + BullMQ + Redis + next-intl v4.11).

**Lis impérativement** `axionia/CLAUDE.md` + `axionia/AGENTS.md` à la racine AVANT toute édition. Ils contiennent :
- Les contraintes Web Vitals 2026 (LCP ≤ 1800 ms, INP ≤ 100 ms, CLS = 0, First Load JS ≤ 75 KB gz)
- Le contrat magic-string `"stub.invalid"` (build externalisé GH Actions, Prisma/Redis Proxy build-time, BULLMQ_DISABLED=true en build)
- Le statut EN locale désactivé (proxy 301 EN→FR depuis 2026-05-16, **ne RIEN traduire en EN**)

Tu vas livrer 5 chantiers cohérents dans un seul Sprint, par phases, avec un commit propre à chaque palier. Push sur `feat/notif-infra-contacts-calendly`.

---

## ✅ Décisions Will pré-figées (mode AUTOPILOT — pas de STOP & ASK)

Will a tranché les 4 décisions ouvertes le 2026-05-26 avant le démarrage du sprint. **Tu n'as PAS à reposer ces questions**. Exécute selon ces décisions :

| Décision | Choix | Implication |
|---|---|---|
| **Calendly** | **Embed JS listener uniquement** sur `/appel` (option gratuite « code direct ») | Pas de Calendly Standard payant, pas de Zapier, pas de webhook HMAC, pas d'IMAP listener. On écoute les events `postMessage` émis par l'iframe Calendly côté client + POST notre endpoint. Capture **uniquement les créations** depuis `/appel`. Les annulations/reschedules ne sont pas captées (limitation acceptée — Will gère via Gmail manuellement). |
| **Rappel email Calendly custom** | **Skip** | Pas de Chantier 4. On garde les rappels natifs Calendly (24h + 1h). |
| **Reply-To pour réponses admin** | **`contact@axion-ia.com`** | Env var `ADMIN_REPLY_FROM=contact@axion-ia.com`. |
| **Notif Telegram audit-trail des réponses admin** | **Non** | Pas de `notify({ category: "ADMIN_REPLIED_TO_SUBMISSION" })`. Le statut delivery dans la timeline reply suffit. |

Si tu rencontres un trade-off imprévu (ex : conflit migration Prisma irréversible, dépendance npm cassée, breaking change Next.js 16 non documenté), tu peux poser une question via `AskUserQuestion`. **Sinon, autopilot strict — pas de pause.**

**Baseline test à préserver** : `pnpm vitest run` doit rester à minimum **1905/1912** (état Sprint A correctif 2026-05-25 commit `1a788014`). Tu en ajoutes ~15-20 nouveaux tests.

---

## Contexte état des lieux (déjà cartographié — NE PAS re-explorer)

### Telegram existant — à refactorer, pas remplacer
- **`src/lib/telegram.ts`** : module singleton `sendTelegram(msg)` + `alertOps()` + `alertIncident()`. Interface `TelegramMessage` avec ~15 tags canoniques (INTERVENTION, OPTION, OPTION CONFIRMÉE/REFUSÉE/EXPIRÉE, ANNULATION, AUDIT, AUTO, CONTACT, NEWSLETTER, DEPLOY, INCIDENT, BACKUP, MONITORING, SECURITY, STRIPE_EVENT, STRIPE_WEBHOOK_SIGNATURE_FAIL, QUOTE_REQUEST_RECEIVED). Fail-soft : retourne `false` si env vars manquants, jamais de throw. Synchrone avec timeout 5s.
- **Env vars existantes** : `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (`.env.example:44-46`, `src/env.ts:70-71` Zod optional).
- **Call-sites actuels** (à NE PAS casser) :
  - `src/features/unified-contact/actions.ts:207` (dispatch par type form)
  - `src/features/admin-options/actions.ts:214, 324` (confirmOption, refuseOption)
  - `src/features/newsletter/actions.ts:86, 154, 209` (3 events)
  - `src/features/admin-calendar/actions.ts:311` (cancelBookingAction)
  - `src/features/booking/admin-actions.ts:180, 517`
  - `src/features/booking/actions.ts:206` (createBookingAction)
  - `src/server/content-gen/shared/content-gen-alerts.ts:31+` (16 alertes auto MONITORING fire-and-forget)
- **Worker BullMQ Telegram** : ❌ inexistant aujourd'hui (envois sync uniquement).

### Admin sidebar — structure existante
- **`src/components/admin/AdminSidebar.tsx`** : 6 groupes (main, content, image-bank, engagement, ops, system). Interface `NavItem = { href, label, icon, group }`. SSR + `aria-current="page"`.
- **Page `/[locale]/(admin)/[adminPrefix]/submissions/`** existe déjà : listing V2 + filtres (type, status, locale, date, search) + détail `[id]/page.tsx` + export CSV + pagination 25.
- **Server Actions admin** : pattern `requireAdminWriteSession()` (RBAC super_admin/admin/editor) + Zod schema + Prisma + revalidatePath. Exemple `src/features/admin-submissions/actions.ts`.

### Modèles Prisma existants
- **`Submission`** (`prisma/schema.prisma:621-673`) : 21 cols, enums `SubmissionType` (audit/implementation/intervention/contact/quote_request) + `SubmissionStatus` (new/in_progress/processed/archived/qualifying/negotiating/converted/lost). Champ `details Json` polymorphe + `ipHash` (RGPD via `IP_HASH_SALT`).
- **`Booking`** (~50 cols Sprint X.1) : flow réservation interne (CalendarSlot, payment schedule). **N'a RIEN à voir avec Calendly** — c'est notre système interne paiement.
- **❌ Aucun modèle Calendly** aujourd'hui.

### Webhooks existants — patterns de référence
- **`src/app/api/stripe/webhook/route.ts`** : HMAC verify + outbox idempotence `StripeWebhookEvent` (UNIQUE constraint) + dispatch sync + return 200 immédiat.
- **`src/app/api/docuseal/webhook/route.ts`** : même pattern (HMAC-SHA256 X-Docuseal-Signature + outbox `DocusealWebhookEvent`).
- **❌ Aucun webhook Calendly** aujourd'hui. À créer en COPIANT ce pattern exact.

### BullMQ — convention
- `BULLMQ_DISABLED=true` → toutes les queues retournent `null` et les `enqueue*` no-op. Crucial pour build GH Actions stub.
- Pattern worker : `Worker` class + `getBullConnectionOrThrow()` + `concurrency` + `lockDuration` + `captureWorkerError()` dans `worker.on("failed")`.

### Calendly inline widget — déjà livré (Sprint A 2026-05-25)
- **`src/app/[locale]/appel/page.tsx`** + **`src/components/booking/CalendlyInlineWidget.tsx`** : widget iframe inline, CSP déjà whitelisté (`assets.calendly.com`, `calendly.com`, `*.calendly.com`).
- Env var `NEXT_PUBLIC_CALENDLY_APPEL_URL` configurée par Will dans Coolify (scope BUILD+RUN).
- URL Calendly de Will : `https://calendly.com/williamsjullin/appel-decouverte`.

---


## Chantier 1 — Refactor Telegram en hub notifications robuste & évolutif

**Objectif** : transformer `src/lib/telegram.ts` (sender bas niveau) en `src/server/notifications/` (hub multi-canal, multi-severity, async, dédupliqué, rate-limité, retry). **Zéro régression** sur les ~9 call-sites existants.

### Architecture cible

```
src/server/notifications/
├── index.ts                      # API publique : notify(event)
├── types.ts                      # NotificationEvent (union typée), NotificationCategory, NotificationSeverity, NotificationChannel
├── catalog.ts                    # Catalogue typé de TOUS les events possibles
├── channels/
│   ├── telegram.ts               # Channel Telegram (wrap sendTelegram + retry + rate-limit)
│   ├── email.ts                  # Channel email (wrap enqueueEmail)
│   └── sentry.ts                 # Channel Sentry breadcrumb (severity ≥ error)
├── routing.ts                    # Routing : (category, severity) → channels[]
├── dedup.ts                      # Dédup Redis (clé = hash(category + dedup_key), TTL configurable)
├── rate-limit.ts                 # Token bucket Redis par catégorie
└── format.ts                     # Templates Telegram MarkdownV2 (titre + body + footer)
```

### API publique unique

```typescript
import { notify } from "@/server/notifications";

await notify({
  category: "CONTACT_FORM_SUBMITTED",       // typé strict via union de literals
  severity: "info",                          // "info" | "warn" | "error" | "critical"
  payload: { submissionId, contactName, contactEmail, formType },
  dedupKey: submissionId,                    // optionnel — empêche doublon dans TTL
  channels: ["telegram"],                    // optionnel — override routing
  force: false,                              // optionnel — bypass rate-limit
});
```

### Catalogue d'events typé (CRUCIAL — pas de magic strings)

Crée une union TS literal de TOUS les events possibles. Discriminated union sur `category` → TypeScript force le bon shape du `payload`.

```typescript
export type NotificationEvent =
  // === Existants à migrer ===
  | { category: "CONTACT_FORM_SUBMITTED"; payload: { submissionId: string; contactName: string; contactEmail: string; formType: string } }
  | { category: "AUDIT_REQUEST_SUBMITTED"; payload: { submissionId: string; companyName?: string; details: Record<string, unknown> } }
  | { category: "INTERVENTION_REQUEST_SUBMITTED"; payload: { submissionId: string; urgency?: string } }
  | { category: "IMPLEMENTATION_REQUEST_SUBMITTED"; payload: { submissionId: string; scope?: string } }
  | { category: "QUOTE_REQUEST_RECEIVED"; payload: { submissionId: string; budget?: string } }
  | { category: "NEWSLETTER_PENDING" | "NEWSLETTER_CONFIRMED" | "NEWSLETTER_UNSUBSCRIBED"; payload: { email: string } }
  | { category: "BOOKING_CREATED"; payload: { bookingId: string; userId: string; serviceType: string } }
  | { category: "OPTION_CONFIRMED" | "OPTION_REFUSED" | "OPTION_EXPIRED"; payload: { bookingId: string; reason?: string } }
  | { category: "BOOKING_CANCELLED"; payload: { bookingId: string; reason?: string } }
  // === Calendly (Chantier 3) ===
  | { category: "CALENDLY_INVITEE_CREATED"; payload: { eventUri: string; inviteeEmail: string; inviteeName: string; eventStartTime: string; eventName: string } }
  | { category: "CALENDLY_INVITEE_CANCELED"; payload: { eventUri: string; inviteeEmail: string; reason?: string } }
  | { category: "CALENDLY_INVITEE_RESCHEDULED"; payload: { eventUri: string; inviteeEmail: string; oldStart: string; newStart: string } }
  // === Ops / infra (préparé pour futur) ===
  | { category: "DEPLOY_SUCCESS" | "DEPLOY_FAILED"; payload: { sha: string; duration?: number } }
  | { category: "BACKUP_SUCCESS" | "BACKUP_FAILED"; payload: { type: string; size?: number; error?: string } }
  | { category: "SECRET_ROTATION_NEEDED"; payload: { secretName: string; expiresAt: string } }
  | { category: "SECURITY_ALERT"; payload: { kind: string; ip?: string; details: Record<string, unknown> } }
  | { category: "DB_HEALTH_DEGRADED"; payload: { metric: string; value: number; threshold: number } }
  | { category: "SENTRY_ERROR_SPIKE"; payload: { errorRate: number; window: string } }
  | { category: "STRIPE_DISPUTE_CREATED"; payload: { paymentIntentId: string; amount: number } }
  | { category: "CONTENT_GEN_COST_CAP_REACHED"; payload: { spent: number; cap: number } }
  | { category: "CONTENT_GEN_PROVIDER_DOWN"; payload: { provider: string; error: string } };

export type NotificationCategory = NotificationEvent["category"];
export type NotificationSeverity = "info" | "warn" | "error" | "critical";
export type NotificationChannel = "telegram" | "email" | "sentry";
```

### Routing par défaut (table simple, modifiable via env vars plus tard)

```typescript
// src/server/notifications/routing.ts
const ROUTING: Record<NotificationCategory, { channels: NotificationChannel[]; severity: NotificationSeverity }> = {
  CONTACT_FORM_SUBMITTED:        { channels: ["telegram"],           severity: "info" },
  AUDIT_REQUEST_SUBMITTED:       { channels: ["telegram"],           severity: "info" },
  CALENDLY_INVITEE_CREATED:      { channels: ["telegram"],           severity: "info" },
  CALENDLY_INVITEE_CANCELED:     { channels: ["telegram"],           severity: "warn" },
  CALENDLY_INVITEE_RESCHEDULED:  { channels: ["telegram"],           severity: "info" },
  DEPLOY_FAILED:                 { channels: ["telegram", "sentry"], severity: "error" },
  BACKUP_FAILED:                 { channels: ["telegram", "sentry"], severity: "critical" },
  SECURITY_ALERT:                { channels: ["telegram", "sentry"], severity: "critical" },
  STRIPE_DISPUTE_CREATED:        { channels: ["telegram"],           severity: "warn" },
  // ... etc pour TOUTES les catégories
};
```

### Mode synchrone vs async

- **Sync (default actuel)** : pour events utilisateur (form submit, booking) où latence acceptable < 200 ms. Garde un `Promise.race` avec timeout 3s + fallback `console.warn`.
- **Async (via BullMQ queue `notifications`)** : pour fire-and-forget (deploy, backup, monitoring auto, content-gen alerts). Nouveau worker `src/server/queue/workers/notifications-worker.ts`.
- **Règle de décision** : si `severity ∈ ["info", "warn"]` ET appel depuis Server Action → sync. Sinon → async via queue.
- Si `BULLMQ_DISABLED=true` → fallback sync silencieux + log warn.

### Dédup + rate-limit (Redis)

- `dedup.ts` : `await isDuplicate(category, dedupKey, ttlSeconds = 300)` — `SET key NX EX ttl`. Si déjà set → return true → skip envoi. Empêche les doubles webhooks Calendly (réseau retry).
- `rate-limit.ts` : token bucket par catégorie. Ex `CONTENT_GEN_COST_CAP_REACHED` → max 1/heure. Bypass via `force: true`.
- Si `REDIS_URL` contient `stub.invalid` → no-op (pas de dédup en build, OK).

### Format Telegram MarkdownV2 (CRUCIAL — caractères à échapper)

Telegram MarkdownV2 requiert l'échappement de : `_ * [ ] ( ) ~ \` > # + - = | { } . !`

Crée `src/server/notifications/format.ts` avec :
- `escapeMarkdownV2(text: string): string` (regex sur les 18 caractères ci-dessus)
- `formatNotification(event: NotificationEvent, severity: NotificationSeverity): string` qui produit :
  - **Header** : `[{SEVERITY_EMOJI}] *{TITLE}*` (ex `[🟢] *Nouvelle réservation Calendly*`)
  - **Body** : key/value formatés (nom, email, horaire en `Europe/Paris` via `Intl.DateTimeFormat`)
  - **Footer** : `🕐 {timestamp Europe/Paris}` + `🏷️ {category}`

Emojis severity : `info=🟢`, `warn=🟡`, `error=🔴`, `critical=🚨`

### Migration des call-sites existants (zéro régression)

- `src/lib/telegram.ts` devient un thin wrapper `@deprecated` qui mappe les anciens tags vers `notify()`. Les ~9 call-sites continuent à fonctionner via `sendTelegram(msg)`.
- En PARALLÈLE, migre 2-3 call-sites pilotes vers `notify()` direct :
  - `src/features/unified-contact/actions.ts:207` (dispatch contact)
  - `src/features/newsletter/actions.ts` (1 event suffit pour démo)
  - `src/features/admin-calendar/actions.ts:311` (cancelBookingAction)
- Les autres restent sur `sendTelegram` legacy, migrés en Sprint+1 (out of scope).

### Tests Chantier 1

- `src/server/notifications/__tests__/notify.test.ts` : 6 cas (sync send, async queue, dedup hit, dedup miss, channel down → fail-soft, env vars manquantes → fail-soft).
- `src/server/notifications/__tests__/routing.test.ts` : assert routing par catégorie correct.
- `src/server/notifications/__tests__/format.test.ts` : assert escapeMarkdownV2 + format Europe/Paris.
- Mock Redis + fetch Telegram avec `vi.mock`.

### Critères d'acceptation Chantier 1

- ✅ Aucun call-site existant ne casse (`pnpm typecheck` 0 erreur, `pnpm vitest` ≥ 1905/1912 + nouveaux tests).
- ✅ Nouveau code TOUT sous `src/server/notifications/` (rien hors de cette racine sauf wrapper deprecated dans `src/lib/telegram.ts`).
- ✅ Aucun `string` arbitraire pour `category` — toujours le type union.
- ✅ `BULLMQ_DISABLED=true` + `REDIS_URL=stub.invalid` → tout est no-op silencieux (build GH Actions passe).
- ✅ Doc ADR `docs/adr/0027-notifications-hub.md` (~80 lignes).

---

## Chantier 2 — Admin page « Contacts & Messages » avec sous-onglets

**Objectif** : transformer `/admin/submissions` en page mère avec 2 (ou 3) sous-onglets pour vue unifiée Will.

### Routes cibles

```
/[locale]/(admin)/[adminPrefix]/contacts/
├── page.tsx              # Redirige vers /contacts/messages (default tab)
├── layout.tsx            # Tabs sticky en haut : Messages | RDV Calendly | (optionnel) Newsletter
├── messages/
│   ├── page.tsx          # = ancienne /submissions (listing + filtres + export CSV)
│   └── [id]/
│       └── page.tsx      # = ancienne /submissions/[id]
└── calendly/
    ├── page.tsx          # Listing CalendlyEvent (créé Chantier 3)
    └── [eventUri]/
        └── page.tsx      # Détail d'un RDV Calendly
```

### Préservation rétrocompat

- `/[locale]/(admin)/[adminPrefix]/submissions/**` doit continuer à fonctionner via **redirect 301** vers `/contacts/messages/**` (liens dans sidebar et emails admin peuvent pointer ici).
- Mécanisme : créer `src/app/[locale]/(admin)/[adminPrefix]/submissions/page.tsx` qui fait `redirect("/contacts/messages")` (Next.js redirect helper) + idem pour `[id]/page.tsx`.
- Modifie `src/components/admin/AdminSidebar.tsx` : remplace l'entrée « Submissions » par « Contacts & Messages » (`Inbox` icon Lucide), groupe `main`.

### Composant tabs réutilisable

- Crée `src/components/admin/AdminTabs.tsx` : tabs SSR (pas de client component si possible — utiliser `headers()` ou prop `currentTab`).
- Style : underline terracotta sur l'actif, `aria-current="page"`, focus visible (a11y).
- A11y : roles tablist/tab/tabpanel, navigation clavier (arrow keys) si client component nécessaire.

### Sous-onglet Messages

- Réutilise EXACTEMENT le composant `SubmissionsV2.tsx` existant. Pas de duplication. Juste path moved.
- Ajoute un filtre supplémentaire « Source » (form contact / audit / devis / intervention / implementation) dans `SubmissionFilters.tsx` si pas déjà présent.

### Sous-onglet RDV Calendly

- **Si Chantier 3 skippé** → page placeholder « Connexion Calendly à venir » + lien export CSV manuel + lien dashboard Calendly natif (`https://calendly.com/event_types/`).
- **Si Chantier 3 livré** → listing :
  - Colonnes : Date RDV, Invitee (nom + email), Statut (scheduled/canceled/rescheduled), Type event, Source UTM, Notes
  - Filtres : Statut, période (date picker), recherche email
  - Détail : payload Calendly complet (JSON viewer) + lien iframe vers dashboard Calendly natif + bouton « Lier à une Submission existante » (search + select)

### Tests Chantier 2

- 1 test E2E Playwright `e2e/admin-contacts-tabs.spec.ts` : login admin → /contacts → vérifier tabs → cliquer Messages → vérifier listing → cliquer RDV Calendly → vérifier listing (ou placeholder).
- 1 test unit `src/components/admin/__tests__/AdminTabs.test.tsx`.

### Critères d'acceptation Chantier 2

- ✅ Sidebar mise à jour, label « Contacts & Messages », icône `Inbox`.
- ✅ Anciennes URLs `/submissions/**` → 301 vers `/contacts/messages/**`.
- ✅ AdminTabs réutilisable + accessible (a11y : tabs roles, focus visible, aria-current).
- ✅ Zero régression sur SubmissionsV2 (filtres, pagination, export CSV).
- ✅ Web Vitals respectés (admin = CSP strict + JS critique uniquement, pas de hydration superflue).

---

## Chantier 3 — Calendly Embed JS Listener (option gratuite « code direct »)

**Décision figée** : pas de webhook officiel (Calendly Free), pas de Zapier, pas d'IMAP listener. On utilise uniquement les events `postMessage` émis par l'iframe Calendly côté client. **Capture les créations depuis `/appel` uniquement** — annulations/reschedules non captées (Will gère via Gmail).

### 3.1 Modèle Prisma `CalendlyEvent`

**Justification** : Calendly = source externe. On crée une table dédiée pour persister les events captés + raw payload pour debug. Lien possible vers `Submission` via FK nullable `linkedSubmissionId`.

```prisma
model CalendlyEvent {
  id                  String              @id @default(cuid())
  // Identifiant Calendly — extrait du payload Embed JS event_scheduled
  eventTypeName       String              // "Appel découverte 30 min"
  eventTypeSlug       String              // ex "appel-decouverte" (depuis URL Calendly)
  status              CalendlyEventStatus @default(scheduled)
  startTime           DateTime?           // Embed JS ne fournit pas tjrs précis — best effort
  endTime             DateTime?
  timezone            String              @default("Europe/Paris")
  // Invitee (extrait du payload Embed JS si dispo, sinon vide — Will complète manuellement via admin)
  inviteeName         String?
  inviteeEmail        String?             @db.Citext
  inviteePhone        String?
  // Métadonnées
  source              CalendlyEventSource @default(embed_js) // embed_js | manual_import | future_webhook
  rawPayload          Json                // payload complet du postMessage event
  pageUrl             String?             // URL où l'event a été capté (ex "https://axion-ia.com/fr/appel")
  utmSource           String?
  utmCampaign         String?
  utmMedium           String?
  referrer            String?
  // Lien Submission optionnel (match manuel par Will dans l'admin)
  linkedSubmissionId  String?
  // Tracking
  capturedAt          DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  notes               String?             @db.Text // notes admin manuelles

  linkedSubmission    Submission?         @relation(fields: [linkedSubmissionId], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([startTime])
  @@index([inviteeEmail])
  @@index([capturedAt])
  @@map("calendly_events")
}

enum CalendlyEventStatus {
  scheduled    // créé via Embed JS, par défaut
  canceled     // marqué manuellement par Will dans l'admin (Calendly Free ne notifie pas)
  completed    // marqué manuellement post-call
  no_show      // marqué manuellement post-call
}

enum CalendlyEventSource {
  embed_js      // capté via postMessage iframe Calendly (V1 par défaut)
  manual_import // ajouté manuellement par Will via admin
  webhook       // réservé pour V2 future si upgrade Standard
}
```

**Dédup côté serveur (sans outbox)** : pas de `payloadHash` car le payload Embed JS n'est pas signé et peut différer entre 2 events identiques. À la place, on utilise une **fenêtre de dédup logique** : si une `CalendlyEvent` existe déjà avec même `inviteeEmail` + `eventTypeSlug` + capturée dans les 60 dernières secondes → skip (rate-limit côté `notify()` via dedupKey du hub Chantier 1).

**Migration** : `pnpm prisma migrate dev --name add_calendly_events_v1` puis `pnpm prisma generate`.

**Règle additive stricte** (cf. AGENTS.md drift contract) : pas de DROP, pas de RENAME, pas de NOT NULL sans default.

**Mise à jour `Submission`** : ajouter la relation inverse `calendlyEvents CalendlyEvent[]` (back-relation pour Prisma client).

### 3.2 Listener côté client sur `/appel`

**Crée `src/components/booking/CalendlyEventCapture.tsx`** (Client component) :

```typescript
"use client";
// Écoute les events postMessage émis par l'iframe Calendly (Embed JS API officielle).
// Documentation : https://help.calendly.com/hc/en-us/articles/360020052833-Advanced-embed-options
//
// Events utiles :
//   - calendly.profile_page_viewed
//   - calendly.event_type_viewed
//   - calendly.date_and_time_selected
//   - calendly.event_scheduled  ← LE golden event (réservation confirmée)
//
// Sécurité : on vérifie strictement event.origin avant de traiter le message.
// Performance : aucun impact LCP (listener passif, attaché après mount).

import { useEffect } from "react";

interface CalendlyEventCaptureProps {
  /** URL Calendly active (pour extraire eventTypeSlug). */
  readonly calendlyUrl: string;
  /** UTM/referrer pour tracking attribution. */
  readonly trackingContext: {
    utmSource?: string;
    utmCampaign?: string;
    utmMedium?: string;
    referrer?: string;
    pageUrl: string;
  };
}

function isCalendlyEvent(e: MessageEvent): boolean {
  return (
    typeof e.data === "object" &&
    e.data !== null &&
    "event" in e.data &&
    typeof (e.data as { event: unknown }).event === "string" &&
    (e.data as { event: string }).event.startsWith("calendly.")
  );
}

export function CalendlyEventCapture({ calendlyUrl, trackingContext }: CalendlyEventCaptureProps) {
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      // Origin check strict — Calendly publie depuis calendly.com
      if (!e.origin.endsWith("calendly.com")) return;
      if (!isCalendlyEvent(e)) return;

      const eventName = (e.data as { event: string }).event;

      // On capte seulement event_scheduled (création) — les autres sont juste analytics
      if (eventName !== "calendly.event_scheduled") return;

      const payload = (e.data as { payload: unknown }).payload;

      // Extraire eventTypeSlug depuis l'URL Calendly
      const eventTypeSlug = new URL(calendlyUrl).pathname.split("/").pop() ?? "unknown";

      try {
        await fetch("/api/calendly/client-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName,
            payload,
            eventTypeSlug,
            ...trackingContext,
          }),
          keepalive: true, // survit à un navigateClose immédiat
        });
      } catch {
        // fail-soft : si POST échoue, Will a quand même l'email Calendly direct
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [calendlyUrl, trackingContext]);

  return null; // pas de UI
}
```

**Intégration dans `/appel`** : monte `<CalendlyEventCapture />` à côté du `<CalendlyInlineWidget />` dans `src/app/[locale]/appel/page.tsx`. Récup les UTM/referrer côté Server Component via `searchParams` et `headers()`, passe-les en props.

### 3.3 Endpoint serveur `/api/calendly/client-event`

**`src/app/api/calendly/client-event/route.ts`** :

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notify } from "@/server/notifications";
import { rateLimitByIp } from "@/lib/rate-limit"; // helper existant projet
import { hashIp } from "@/lib/security/ip-hash";   // helper existant projet

const ClientEventSchema = z.object({
  eventName: z.literal("calendly.event_scheduled"),
  payload: z.unknown(),                // payload Calendly libre (forme peut varier)
  eventTypeSlug: z.string().min(1).max(100),
  utmSource: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  referrer: z.string().max(500).optional(),
  pageUrl: z.string().url().max(500),
});

export const runtime = "nodejs"; // besoin Prisma

export async function POST(req: Request) {
  // 1. Rate limit par IP (anti-spam : max 5 events / minute / IP)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = hashIp(ip);
  const allowed = await rateLimitByIp(`calendly-client-event:${ipHash}`, 5, 60);
  if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // 2. Parse + valide
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ClientEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  // 3. Dédup logique : si même eventTypeSlug + même IP capturé dans les 60s → skip
  const recentDup = await prisma.calendlyEvent.findFirst({
    where: {
      eventTypeSlug: parsed.data.eventTypeSlug,
      capturedAt: { gte: new Date(Date.now() - 60_000) },
      // on n'a pas d'inviteeEmail fiable depuis postMessage → on dédupe par IP+slug
      rawPayload: { path: ["_ipHash"], equals: ipHash } as never,
    },
  });
  if (recentDup) return NextResponse.json({ ok: true, deduped: true });

  // 4. Tenter d'extraire invitee.{name,email} depuis le payload (best-effort)
  const rawPayload = parsed.data.payload as Record<string, unknown> | undefined;
  const invitee = (rawPayload?.invitee ?? {}) as Record<string, unknown>;
  const inviteeName = typeof invitee.name === "string" ? invitee.name : undefined;
  const inviteeEmail = typeof invitee.email === "string" ? invitee.email : undefined;

  // 5. Persiste
  const event = await prisma.calendlyEvent.create({
    data: {
      eventTypeName: parsed.data.eventTypeSlug, // Will pourra renommer manuellement
      eventTypeSlug: parsed.data.eventTypeSlug,
      status: "scheduled",
      source: "embed_js",
      inviteeName,
      inviteeEmail,
      pageUrl: parsed.data.pageUrl,
      utmSource: parsed.data.utmSource,
      utmCampaign: parsed.data.utmCampaign,
      utmMedium: parsed.data.utmMedium,
      referrer: parsed.data.referrer,
      rawPayload: { ...rawPayload, _ipHash: ipHash } as never,
    },
  });

  // 6. Notif Telegram via hub
  await notify({
    category: "CALENDLY_INVITEE_CREATED",
    payload: {
      eventUri: event.id,
      inviteeEmail: inviteeEmail ?? "(non communiqué par Calendly Embed)",
      inviteeName: inviteeName ?? "(non communiqué)",
      eventStartTime: "(voir mail Calendly)", // Embed JS ne fournit pas startTime fiable
      eventName: parsed.data.eventTypeSlug,
    },
    dedupKey: event.id,
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
```

**Limitations honnêtes à mentionner dans l'UI admin** :
- L'email/nom de l'invitee n'est PAS toujours présent dans le payload `event_scheduled` (Calendly ne le passe pas systématiquement côté client pour des raisons RGPD).
- Will trouve l'email exact dans le mail de confirmation Calendly direct (sa boîte Gmail).
- Will peut compléter manuellement les champs `inviteeName`/`inviteeEmail`/`startTime` dans le détail admin si besoin de match Submission.

### 3.4 UI admin — sous-onglet RDV Calendly (`/admin/contacts/calendly`)

- Listing trié par `capturedAt` desc
- Colonnes : Date capture, Type event, Invitee (si présent), Page d'origine, UTM source, Statut, Action
- Filtres : Statut, période (date picker), recherche email
- Détail (`/admin/contacts/calendly/[id]`) :
  - Tous les champs en édition inline (Will peut compléter inviteeEmail/Name/startTime manuellement après lecture du mail Calendly)
  - JSON viewer du `rawPayload` pour debug
  - Bouton « Marquer canceled / completed / no_show »
  - Bouton « Lier à une Submission » (search by email + select)
  - Bouton « Ouvrir dans dashboard Calendly » (lien direct vers calendly.com/event/...)

**Important** : sur la page mère, **bandeau d'info honnête** :
> ℹ️ La capture Calendly fonctionne en mode client-side gratuit. Seules les **créations depuis /appel** sont captées automatiquement. Les annulations et déplacements doivent être marqués manuellement (consulter votre boîte Gmail pour les notifications Calendly officielles).

### 3.5 Bouton « Ajouter manuellement un RDV » (fallback)

Sur la page listing `/admin/contacts/calendly`, bouton « + Ajouter manuellement » qui ouvre un modal de création (Server Action `createManualCalendlyEventAction`) avec tous les champs vides → permet à Will d'enregistrer un RDV qu'il a reçu uniquement par email Calendly. `source = manual_import`.

### 3.6 Tests Chantier 3

- `src/app/api/calendly/client-event/__tests__/route.test.ts` : 6 cas
  1. POST valide → 200 + `CalendlyEvent` créé + notify appelé
  2. Rate limit dépassé → 429
  3. Payload invalide → 400
  4. JSON malformé → 400
  5. Dédup 60s → 200 deduped
  6. Payload sans invitee.email → 200 + `inviteeEmail=null` (acceptable)
- 1 test unit `CalendlyEventCapture.test.tsx` : simule postMessage + assert fetch appelé.
- Pas de test E2E Playwright pour ce chantier (l'iframe Calendly réelle nécessite un compte de test live, out of scope).

### Critères d'acceptation Chantier 3

- ✅ Listener `<CalendlyEventCapture />` monté sur `/appel`, sans impact LCP/INP/CLS.
- ✅ Origin check `e.origin.endsWith("calendly.com")` strict.
- ✅ Endpoint `/api/calendly/client-event` : rate-limit IP, Zod validation, dédup logique 60s.
- ✅ Persiste `CalendlyEvent` + déclenche notif Telegram via hub `notify()`.
- ✅ UI admin avec bandeau d'info sur les limitations (annulations non captées).
- ✅ Bouton « Ajouter manuellement » pour rattraper les events ratés.
- ✅ Doc ADR `docs/adr/0028-calendly-integration.md` mentionne explicitement la limite Free + le path d'upgrade vers Standard webhook V2 si Will change d'avis plus tard.

---

## Chantier 5 — Reply System & Inbox Management (CRITIQUE — non négociable)

**Objectif** : transformer l'admin Messages en vraie **boîte de réception opérationnelle** où Will peut répondre directement aux users, suivre le statut de delivery, voir d'un coup d'œil ce qui demande son attention, et archiver le bruit.

### 5.1 Modèle Prisma `SubmissionReply` (table dédiée, historique multi-réponses)

**Justification** : 1 Submission peut nécessiter plusieurs allers-retours (relance, complément d'info). Table dédiée = historique propre + multi-réponses + tracking delivery par message.

```prisma
model SubmissionReply {
  id                String                @id @default(cuid())
  submissionId      String
  repliedByUserId   String                // FK User (admin qui a envoyé)
  repliedByName     String                // snapshot du nom au moment de l'envoi (immuable même si user supprimé)
  repliedAt         DateTime              @default(now())
  toEmail           String                @db.Citext  // snapshot — au cas où contactEmail change
  subject           String
  bodyHtml          String                @db.Text    // HTML rendu (template React Email compilé)
  bodyText          String                @db.Text    // version plain text (multipart MIME)
  deliveryStatus    SubmissionReplyStatus @default(pending)
  providerMessageId String?               // Message-ID SMTP / id du provider (Resend, etc.)
  sentAt            DateTime?
  failedAt          DateTime?
  errorMsg          String?               @db.Text
  retryCount        Int                   @default(0)
  templateUsed      String?               // ex "default" | "audit_followup" | "custom"
  internalNote      String?               @db.Text    // note privée admin sur cette réponse

  submission        Submission            @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  repliedByUser     User?                 @relation(fields: [repliedByUserId], references: [id], onDelete: SetNull)

  @@index([submissionId])
  @@index([deliveryStatus])
  @@index([repliedAt])
  @@map("submission_replies")
}

enum SubmissionReplyStatus {
  pending     // en queue, pas encore envoyé
  sent        // SMTP 250 OK reçu (envoi accepté par MTA)
  delivered   // confirmation delivery via webhook bounce/delivery (si provider le supporte — sinon = sent)
  bounced     // hard bounce reçu
  complained  // spam complaint
  failed      // erreur définitive (4xx persistant ou 5xx)
}
```

**Mise à jour `Submission`** (champs additifs, computed cache pour query rapide) :
```prisma
model Submission {
  // ... existant ...
  replies            SubmissionReply[]
  replyCount         Int       @default(0)   // count cache (incrémenté à chaque reply)
  firstRepliedAt     DateTime?               // date du premier envoi réussi
  lastRepliedAt      DateTime?               // date du dernier envoi réussi
  needsAttention     Boolean   @default(true) // false dès qu'au moins 1 reply envoyé OU archivé
  archivedAt         DateTime?               // explicit timestamp (en plus du status="archived")
}
```

**Migration additive** : `pnpm prisma migrate dev --name add_submission_replies_v1`.

### 5.2 Server Actions admin (`src/features/admin-submissions/reply-actions.ts`)

```typescript
// Toutes guardées par requireAdminWriteSession() + Zod schema
"use server";

export async function replyToSubmissionAction(input: {
  submissionId: string;
  subject: string;
  bodyMarkdown: string;     // markdown qui sera rendu en HTML via React Email template
  template?: "default" | "audit_followup" | "intervention_followup" | "custom";
  internalNote?: string;
}): Promise<{ ok: true; replyId: string } | { ok: false; error: string }>;

export async function archiveSubmissionAction(id: string): Promise<void>;
export async function unarchiveSubmissionAction(id: string): Promise<void>;
export async function bulkArchiveSubmissionsAction(ids: string[]): Promise<{ archived: number }>;
export async function bulkUnarchiveSubmissionsAction(ids: string[]): Promise<{ unarchived: number }>;
export async function markNeedsAttentionAction(id: string, value: boolean): Promise<void>;
export async function retryFailedReplyAction(replyId: string): Promise<{ ok: boolean }>;
```

**`replyToSubmissionAction` flow** :
1. RBAC `requireAdminWriteSession()` → récup userId + name
2. Zod parse input
3. Fetch Submission (404 si absent)
4. Render template React Email (`src/lib/email/templates/submission-reply.tsx` — branded Axion-IA terracotta + signature « Williams Jullin · Axion-IA »)
5. Create `SubmissionReply` (status=pending) en transaction
6. Enqueue email via `enqueueEmail("submission-reply", to, locale, { replyId, ...payload })`
7. Update Submission : `replyCount++`, `needsAttention=false`, `status="in_progress"` si actuellement `new`
8. `revalidatePath("/admin/contacts/messages")` + `revalidatePath("/admin/contacts/messages/[id]")`
9. Notif Telegram (optionnel, severity info) : `notify({ category: "ADMIN_REPLIED_TO_SUBMISSION", ... })` — utile si tu veux audit trail des réponses admin
10. Return `{ ok: true, replyId }`

### 5.3 Email worker — extension

L'email worker existant (`src/server/queue/workers/email-worker.ts`) consomme la queue. Ajouter le handler pour template `"submission-reply"` :

```typescript
case "submission-reply": {
  const reply = await prisma.submissionReply.findUnique({ where: { id: payload.replyId } });
  if (!reply) throw new Error(`SubmissionReply ${payload.replyId} not found`);
  try {
    const result = await sendEmail({
      to: reply.toEmail,
      subject: reply.subject,
      html: reply.bodyHtml,
      text: reply.bodyText,
      replyTo: process.env.ADMIN_REPLY_FROM ?? "contact@axion-ia.com",
      headers: { "Message-ID": `<${reply.id}@axion-ia.com>` },
    });
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "sent",
        sentAt: new Date(),
        providerMessageId: result.messageId,
      },
    });
    await prisma.submission.update({
      where: { id: reply.submissionId },
      data: {
        firstRepliedAt: { set: reply.submission.firstRepliedAt ?? new Date() },
        lastRepliedAt: new Date(),
      },
    });
  } catch (e) {
    await prisma.submissionReply.update({
      where: { id: reply.id },
      data: {
        deliveryStatus: "failed",
        failedAt: new Date(),
        errorMsg: String(e),
        retryCount: { increment: 1 },
      },
    });
    throw e; // BullMQ retry avec backoff
  }
  break;
}
```

### 5.4 Template React Email (`src/lib/email/templates/submission-reply.tsx`)

Branded Axion-IA : header logo + bg canvas (#fef3e6) + heading terracotta (#c2410c) + body serif + signature « Williams Jullin · Axion-IA · axion-ia.com · +33 ... ». Plain-text fallback auto-généré via `@react-email/render`.

Props :
- `subject` (mis dans h1)
- `bodyMarkdown` rendu en HTML via `react-markdown` ou conversion simple (paragraphes + bold + italic + liens)
- `replySignature` (param locale, optionnel custom signature)
- `originalSubmissionExcerpt` (optionnel, quote du message initial du user, citation style mail client)

### 5.5 UI Admin — composants à créer

#### `src/components/admin/contacts/ReplyComposer.tsx` (Client component)

Modal/sheet ouverte depuis bouton « Répondre » dans la page détail submission.

Layout :
- Header : « Répondre à {contactName} <{contactEmail}> »
- Sélecteur template : « Réponse par défaut » | « Suivi audit » | « Suivi intervention » | « Personnalisée » (pré-remplit subject + body)
- Champ `subject` (input, défaut `Re: {original subject if exists else "Votre demande Axion-IA"}`)
- Champ `bodyMarkdown` (textarea avec markdown preview side-by-side, simple — pas de WYSIWYG lourd)
- Champ optionnel `internalNote` (visible que dans l'admin, jamais envoyé au user)
- Preview iframe rendant le template final avant envoi (refresh on blur)
- Bouton « Envoyer » (loading state + disabled pendant send)
- Bouton « Annuler »
- Affichage erreur Zod / server inline

Pas de upload de pièces jointes pour V1 (out of scope, complexité MIME multipart).

#### `src/components/admin/contacts/ReplyHistory.tsx` (Server component)

Timeline dans la page détail submission, sous le formulaire des infos contact, affichant TOUTES les replies :

```
┌─────────────────────────────────────────────────────────────┐
│ 📨 Réponse envoyée par Williams · 26/05/2026 14:32          │
│ Sujet : Re: Demande d'audit IA                              │
│ ✅ Envoyé (SMTP delivered)                                  │
│ [▼ Voir le contenu]                                         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ 📨 Réponse envoyée par Williams · 24/05/2026 09:15          │
│ Sujet : Re: Demande d'audit IA                              │
│ ⚠️ Bounced — adresse invalide                                │
│ [↻ Réessayer] [▼ Voir le contenu]                          │
└─────────────────────────────────────────────────────────────┘
```

Statuts visuels :
- `pending` 🟡 « En cours d'envoi »
- `sent` 🟢 « Envoyé »
- `delivered` ✅ « Delivered »
- `bounced` ⚠️ « Bounced — {errorMsg} » + bouton « Réessayer » (si toEmail corrigé)
- `failed` 🔴 « Échec — {errorMsg} » + bouton « Réessayer »
- `complained` 🚨 « Marqué comme spam »

### 5.6 UI Admin — listing avec indicateurs clairs (CRUCIAL)

Modifier `SubmissionsV2.tsx` (déjà existant) :

#### Colonne « Statut » enrichie

Badges visuels par submission :

| État | Badge | Couleur |
|---|---|---|
| Aucune réponse + status=`new` | 🔴 **Sans réponse** | Rouge terracotta |
| Aucune réponse + status=`in_progress` | 🟠 **En attente de réponse** | Orange |
| 1+ reply envoyée | 🟢 **Répondu** ({n} message{s}) | Vert |
| 1+ reply mais dernière bounced/failed | ⚠️ **Échec envoi** | Jaune warning |
| `status=archived` | 🗄️ **Archivé** | Gris |
| `status=converted` | 💎 **Converti** | Bleu |

#### Filtres additionnels (en plus des existants)

- **Statut réponse** : « Tous » / « Sans réponse » (default) / « Répondus » / « Échec envoi »
- **Inclure archivés** : checkbox off par défaut → masque les archivés du listing principal
- **Période réponse** : « Dernière réponse depuis... » (7j / 30j / custom)

Le default `Sans réponse + non archivé` = la « to-do list » de Will.

#### Actions bulk (multi-select)

Cases à cocher sur chaque ligne + barre d'actions sticky en bas qui apparaît au premier check :

- **Archiver la sélection** (N items)
- **Désarchiver la sélection** (visible si filtre = archivés)
- **Marquer comme nécessitant attention** (remet `needsAttention=true`)
- **Exporter CSV de la sélection**

### 5.7 Sidebar — badge compteur

Modifier `src/components/admin/AdminSidebar.tsx` : sur l'entrée « Contacts & Messages », afficher un badge rouge avec le nombre de submissions `needsAttention=true AND archivedAt IS NULL` (équivalent du badge unread d'une mailbox).

Server Component → query Prisma cachée 30s via `unstable_cache` pour éviter de hit la DB à chaque navigation.

### 5.8 Threading (out of scope V1, à documenter)

Si le user répond à un email envoyé via cette UI :
- Le `Reply-To` pointe vers `contact@axion-ia.com` (env var `ADMIN_REPLY_FROM`)
- La réponse user arrive dans la boîte Gmail/IMAP de Will
- **Pas de threading automatique en V1** (pas de IMAP listener → pas de fetch des réponses entrantes)
- Will lit la réponse dans Gmail et soit re-clique « Répondre » dans l'admin, soit copie le contenu dans `internalNote` de la submission

**À documenter clairement dans l'UI** : tooltip sur le bouton « Répondre » → « Les réponses du destinataire arrivent dans contact@axion-ia.com, à consulter dans Gmail. »

V2 future possible : IMAP listener → parse In-Reply-To/References headers → match `Message-ID` → créer un model `SubmissionIncomingReply` lié. **Hors scope V1**.

### 5.9 Env vars à ajouter

- `ADMIN_REPLY_FROM` : adresse Reply-To (default `contact@axion-ia.com`, scope RUN)
- `ADMIN_REPLY_FROM_NAME` : nom affiché (default `Axion-IA`, scope RUN)

### 5.10 Tests Chantier 5

- `src/features/admin-submissions/__tests__/reply-actions.test.ts` : 8 cas
  1. `replyToSubmissionAction` happy path → reply créée + email enqueué + submission updated
  2. RBAC : non-admin → throw
  3. Submission inexistante → 404
  4. Zod validation (subject vide, body vide) → erreur
  5. Archive + unarchive idempotent
  6. Bulk archive 10 items → tous archivés
  7. Retry failed reply → status reset to pending + ré-enqueue
  8. Mark needsAttention toggle
- `src/components/admin/contacts/__tests__/ReplyComposer.test.tsx` : render + submit + error display
- 1 E2E Playwright `e2e/admin-reply-submission.spec.ts` : login → ouvrir submission → cliquer Répondre → remplir → envoyer → vérifier badge « Répondu » + voir dans timeline

### 5.11 Critères d'acceptation Chantier 5

- ✅ Will peut répondre depuis `/admin/contacts/messages/[id]` sans quitter l'admin.
- ✅ Will voit instantanément quelles submissions n'ont pas reçu de réponse (filtre « Sans réponse » par défaut + badge sidebar).
- ✅ Will voit le statut delivery de chaque réponse envoyée (sent / bounced / failed) avec bouton retry.
- ✅ Historique complet des réponses dans la timeline (qui, quand, sujet, contenu, statut).
- ✅ Archive/désarchive instantané (un click) + bulk archive (10+ items en 1 action).
- ✅ Badge sidebar « Contacts & Messages » avec compteur unread temps-réel (revalidation 30s).
- ✅ Zero perte de données : si email worker échoue, retry auto BullMQ avec backoff. Si échec définitif, bouton retry manuel + alerte Telegram.
- ✅ Template email branded Axion-IA, HTML + plain-text, déliverabilité > 95% (SPF + DKIM + DMARC déjà configurés côté PowerMTA).
- ✅ `pnpm typecheck` 0 erreur + tests verts.

---

## Chantier 4 — Email de rappel Calendly custom — ❌ SKIPPED (décision Will figée)

**Décision figée** : Will a choisi de garder les rappels Calendly natifs (24h + 1h) et ne PAS implémenter de rappel custom Axion-IA. Risque de doublon perçu comme spam. **Ce chantier n'est PAS exécuté.**

Si Will change d'avis post-sprint, voici l'approche à appliquer dans un sprint futur :
- Désactiver les rappels Calendly natifs (Account → Workflows)
- Template React Email `src/lib/email/templates/calendly-reminder.tsx` (branded)
- Worker cron 15 min `src/server/queue/workers/calendly-reminder-worker.ts`
- Colonnes additives `reminder24hSentAt`, `reminder1hSentAt` sur `CalendlyEvent`

**Ne PAS implémenter ces éléments dans le sprint courant.**

---

## Plan de phases & commits (mode AUTOPILOT — aucun STOP & ASK intermédiaire)

Toutes les décisions ouvertes sont **déjà figées** ci-dessous dans la section « Décisions Will pré-figées (autopilot) ». Tu exécutes du début à la fin sans interruption.

1. **Phase 1** — Chantier 1 architecture hub notifications (types + catalogue + channels + dedup/rate-limit + format MarkdownV2 + tests unit).
   Commit : `feat(notif): hub notifications centralisé multi-canal multi-severity`

2. **Phase 2** — Wrapper `src/lib/telegram.ts` deprecated → `notify()` + migration 3 call-sites pilotes (unified-contact, newsletter, admin-calendar).
   Commit : `refactor(notif): telegram.ts wrapper @deprecated + migration 3 call-sites pilotes`

3. **Phase 3** — Chantier 2 (admin tabs `/contacts/{messages,calendly}` + redirect 301 `/submissions/**` → `/contacts/messages/**` + sidebar update).
   Commit : `feat(admin): page Contacts & Messages avec sous-onglets`

4. **Phase 4** — Chantier 5.1 modèle Prisma `SubmissionReply` + extensions `Submission` (replyCount, firstRepliedAt, lastRepliedAt, needsAttention, archivedAt) + migration additive.
   Commit : `feat(admin): modèle SubmissionReply + extensions Submission pour reply system`

5. **Phase 5** — Chantier 5.2-5.4 Server actions reply + email worker handler + template React Email branded.
   Commit : `feat(admin): server actions reply + email worker handler + template branded`

6. **Phase 6** — Chantier 5.5-5.7 UI ReplyComposer + ReplyHistory + badges listing + filtres « Sans réponse » + bulk archive + badge sidebar unread.
   Commit : `feat(admin): UI reply system + indicateurs inbox + bulk archive`

7. **Phase 7** — Chantier 3 Calendly Embed JS Listener (modèle Prisma `CalendlyEvent` + component `CalendlyEventCapture` + endpoint `/api/calendly/client-event` + UI admin avec bandeau limitations + bouton ajout manuel + tests).
   Commit : `feat(calendly): embed JS listener + endpoint client-event + admin listing`

8. **Phase 8 — SKIPPED** (Chantier 4 email rappel custom non implémenté, décision figée Will).

9. **Phase finale** — ADR 0027 (notifications-hub) + ADR 0028 (calendly-embed-js) + ADR 0029 (reply-system) + memory entries + push branche + ouvrir PR vers main via `gh pr create`.
   Commit : `docs(adr): 0027 notifications-hub + 0028 calendly-embed-js + 0029 reply-system`

**Règle autopilot stricte** : tu n'utilises `AskUserQuestion` que si tu rencontres un **vrai blocage technique non prévu** (ex : conflit migration Prisma irréversible, dépendance npm cassée, breaking change Next.js 16 non documenté). Sinon, **tu prends la décision raisonnable et tu continues**, en documentant le choix dans le commit + l'ADR.

---

## Stratégie de rollback

Si un chantier introduit une régression critique en prod après merge :

1. **Chantier 1 (notif hub)** : `git revert` du commit hub. Le wrapper deprecated `src/lib/telegram.ts` maintient les call-sites legacy → zéro impact.
2. **Chantier 2 (admin tabs)** : `git revert` du commit. Les redirects 301 disparaissent mais les liens directs `/admin/submissions` étaient préservés en parallèle.
3. **Chantier 3 (Embed JS listener Calendly)** : retirer le composant `<CalendlyEventCapture />` de `/appel/page.tsx` → events plus captés. Le endpoint `/api/calendly/client-event` reste vivant mais inutilisé. Les données déjà persistées restent en DB. Migration Prisma additive → no need to rollback schema.
4. **Chantier 5 (reply system)** : `git revert` du commit migration + commits UI. La table `submission_replies` peut rester en DB (additive). Les colonnes ajoutées à `Submission` (`replyCount`, `firstRepliedAt`, etc.) restent inertes si l'UI revert.

---

## Contraintes globales (à NE PAS oublier)

- 🚫 NE PAS toucher au contrat magic-string `"stub.invalid"` (cf. `axionia/AGENTS.md`).
- 🚫 NE PAS générer/traduire de contenu EN — règle absolue Will, EN locale désactivée en proxy depuis 2026-05-16.
- 🚫 NE PAS push sur main sans validation Will — tout sur `feat/notif-infra-contacts-calendly`.
- ✅ Respecter Web Vitals (admin = CSP strict + minimal JS).
- ✅ `pnpm typecheck` 0 erreur à chaque commit.
- ✅ `pnpm vitest run` baseline 1905/1912 préservée + ~15-20 nouveaux tests ajoutés.
- ✅ Env vars `NEXT_PUBLIC_*` = inlinées au build → scope **BUILD + RUN** dans Coolify.
- ✅ Env vars secrets (Telegram bot token, `ADMIN_REPLY_FROM`, etc.) = scope **RUN only** (pas inliné côté client, redeploy non requis pour update).
- ✅ Si `BULLMQ_DISABLED=true` → tout le hub notif fallback sync silencieux (build GH Actions).
- ✅ Aucune nouvelle dépendance npm sans justification forte (le hub se fait avec stdlib + Prisma + ioredis déjà présents).
- ✅ Timezone partout : `Europe/Paris` via `Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris" })`.
- ✅ RGPD : `inviteeEmail` est PII → considère ajouter un cron de purge des `CalendlyEvent` complétés > 24 mois (out of scope mais à documenter dans ADR).
- ✅ Migrations Prisma : additif uniquement (CREATE/ADD COLUMN nullable). Pas de DROP/RENAME/NOT NULL sans default.

---

## Actions Will (à lister à la fin du Sprint dans la PR description)

Toutes les décisions sont figées en autopilot. Will n'a aucune décision à prendre pendant le sprint. Post-merge, Will doit :

1. **Coolify env vars (scope RUN only, pas de redeploy requis car pas inliné client)** :
   - `ADMIN_REPLY_FROM=contact@axion-ia.com`
   - `ADMIN_REPLY_FROM_NAME=Axion-IA`
   - (Telegram env vars `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` déjà configurées)
2. **Vérification post-deploy** :
   - `/fr/admin/contacts/messages` accessible avec listing existant intact
   - `/fr/admin/contacts/calendly` affiche bandeau d'info + listing vide initial
   - Anciens liens `/fr/admin/submissions/*` → 301 vers `/fr/admin/contacts/messages/*`
   - Sidebar admin affiche « Contacts & Messages » avec badge unread
3. **Test end-to-end manuel** :
   - Remplir formulaire `/contact` côté public → notif Telegram reçue + submission visible dans `/admin/contacts/messages` avec badge « Sans réponse »
   - Cliquer « Répondre » dans le détail → composer un message → envoyer → vérifier delivery status dans la timeline
   - Vérifier que le badge passe à « Répondu (1) »
   - Archiver la submission → disparaît du listing par défaut
   - Désarchiver → réapparaît
   - Ouvrir `/fr/appel` côté public en navigation privée → faire une vraie réservation Calendly de test → vérifier notif Telegram + visible dans `/admin/contacts/calendly` (rappel : annulations non captées, c'est normal)
4. **Optionnel — Si Will veut Calendly Standard plus tard** :
   - Upgrade compte Calendly Standard (12 €/mois)
   - Créer webhook subscription dans Calendly Dev Console
   - Suivre le path d'upgrade documenté dans `docs/adr/0028-calendly-embed-js.md` § « Upgrade path V2 »

---

## Livrables attendus

- Branche `feat/notif-infra-contacts-calendly` pushée origin.
- PR ouverte via `gh pr create` avec description complète, screenshots admin, liste Actions Will post-merge.
- 3 ADR markdown :
  - `docs/adr/0027-notifications-hub.md`
  - `docs/adr/0028-calendly-embed-js.md` (avec section « Upgrade path V2 » documentant la migration future vers webhook officiel Standard si Will change d'avis)
  - `docs/adr/0029-reply-system.md` (avec section « V2 future » documentant IMAP listener pour threading entrant)
- Memory entry MEMORY.md mise à jour avec le résultat du sprint.
- `pnpm typecheck` + `pnpm vitest run` verts (baseline 1905/1912 + ~25-30 nouveaux tests).
- Aucune régression sur les 9 call-sites Telegram existants (preuve via grep + smoke test 3 call-sites pilotes migrés).

---

## Démarrage

Commence par :
1. Lire `axionia/CLAUDE.md` + `axionia/AGENTS.md` + `axionia/src/lib/telegram.ts` + `axionia/prisma/schema.prisma` (modèle Submission + Booking + WebhookEvent existants Stripe/DocuSeal).
2. Créer la branche `feat/notif-infra-contacts-calendly` depuis main.
3. Attaquer Phase 1.

Tiens-moi au courant via 1 phrase de status entre chaque phase. Si tu hésites sur un trade-off architectural majeur (sync vs async, choix Calendly), demande-moi via `AskUserQuestion` avant de coder.
