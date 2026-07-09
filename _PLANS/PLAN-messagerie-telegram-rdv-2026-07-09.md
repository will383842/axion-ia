# PLAN FINAL CONSOLIDÉ — Messagerie fiable + Telegram (3 flux, bidirectionnel) + RDV & calendrier

- **Date** : 2026-07-09
- **Statut** : Plan vérifié (21 agents : 12 audits + 5 conceptions + 2 critiques) + **faits prod confirmés en direct**
- **Périmètre** : les 5 demandes de Will
  1. Réponses fiables + confirmation « envoyé ✓ »
  2. Telegram sortant exhaustif (tous les messages), séparé en **3 flux** (RDV / Messages / Système)
  3. Réponse **bidirectionnelle depuis Telegram** synchronisée avec la console
  4. Onglet **« RV téléphonique »** consolidant tous les RDV
  5. **Vue calendrier** cliquable par date

---

## 0. ⚡ LE FAIT CENTRAL (vérifié en prod en direct)

**Le bug des réponses ET le « je ne reçois pas mes messages Telegram » ont la MÊME cause racine : les variables d'environnement sont présentes sur le container `worker` mais PAS sur le container `app` (ou désalignées).**

Vérifié en prod :
- Bot Telegram = **@axion_ia_notif_bot** (« Axion-IA Notifications »), actif, poste dans un **supergroupe** (chat_id `-100…`).
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` = **présents sur le worker uniquement**, **absents de l'app web**.
- Or `notify()` est appelé **depuis l'app web** (formulaires, contact, chatbot, Calendly, candidatures) → sans token → **notifications silencieusement perdues**.
- Même schéma probable pour `PII_ENCRYPTION_KEY` : si absente/désalignée sur le worker, `decryptPii(reply.toEmail)` renvoie `"[encrypted — key missing]"` → part comme adresse `to:` → **SMTP rejette → « Échec envoi »**.

➡️ **Une grande partie du problème se règle par la CONFIG (Coolify), pas par le code.** Le code ci-dessous rend ces échecs **visibles, non-silencieux et rejouables** ; la remédiation immédiate est un alignement des env vars sur l'app **et** le worker.

**Diagnostic exact à lancer (Étape 0, sans exposer de secret)** — lire l'`errorMsg` des réponses échouées :
```sql
SELECT delivery_status, error_msg, retry_count, failed_at
FROM submission_replies WHERE delivery_status = 'failed'
ORDER BY failed_at DESC LIMIT 5;
```
- `error_msg` mentionne `[encrypted — key missing]` / adresse invalide → **PII_ENCRYPTION_KEY worker**.
- erreur crypto (GCM auth) → **clé désalignée app↔worker**.
- `ECONNREFUSED` / timeout SMTP → **SMTP_HOST worker** (localhost dans le conteneur isolé).

---

## 1. Architecture Telegram décidée : 1 bot → 3 groupes

Décision Will : **réutiliser @axion_ia_notif_bot** et router vers **3 groupes Telegram** distincts (1 token, 1 webhook).

| Groupe | Contenu | Env |
|---|---|---|
| 📅 **RDV** | RDV Calendly, réservations | `TELEGRAM_CHAT_ID_RDV` |
| 💬 **Messages** | Tous les messages (12 types) + leads chatbot | `TELEGRAM_CHAT_ID_MESSAGES` |
| 🔔 **Système** | Incidents, backups, candidatures, newsletter, avis | `TELEGRAM_CHAT_ID_SYSTEM` (= chat actuel) |

Routage dans `src/server/notifications/routing.ts` (category → chat_id). Fallback : si un `CHAT_ID_*` manque, retomber sur `TELEGRAM_CHAT_ID` (rétro-compatible).

---

## 2. Brique A — Réponses fiables + confirmation « envoyé ✓ »

### Fiabiliser l'envoi (code)
- **`src/lib/pii-crypto.ts`** : exporter `PII_DECRYPT_PLACEHOLDER` + `isDecryptedEmailUsable(v)` (additif ; ne PAS transformer `decryptPii` en throw global).
- **`src/server/queue/queues.ts`** (`enqueueEmail`) : retourner `Job | null` (aujourd'hui no-op silencieux si queue indisponible → reply reste `pending` + faux `{ok:true}`).
- **`src/features/admin-submissions/reply-actions.ts`** :
  - Pré-vol : déchiffrer + valider l'email **avant** la transaction (échec clair `invalid_recipient`).
  - Retirer la PII (email clair) du payload de queue (fuite Redis, ignoré de toute façon).
  - Ne plus avaler l'échec d'enqueue → marquer la reply `failed` (rejouable).
  - Élargir le type de retour + nouvelle `getReplyDeliveryStatusAction(replyId)` (polling).
- **`src/server/queue/workers/email-worker.ts`** : garde `isDecryptedEmailUsable` avant `sendEmail` → `errorMsg` distinctif (`smtp:`/`crypto:`/`recipient:`), pas de retry inutile, **alerte Telegram** (groupe Système) si worker sans clé.
- **`src/server/queue/worker.ts`** : check boot non-fatal (alerter si `PII_ENCRYPTION_KEY` absente, **ne pas** `process.exit`).

### Confirmation à l'admin (UX — priorité #1)
- **`src/components/admin/contacts/ReplyComposer.tsx`** : machine d'états `idle → sending → queued → sent | failed`.
  - **sending** : champs + `×` + Annuler disabled, `aria-busy`.
  - **queued** : « Réponse enregistrée, envoi en cours ⏳ ».
  - **sent** : **« Réponse envoyée ✓ »** (vert) — via polling `getReplyDeliveryStatusAction` toutes les 2 s, max ~12 s.
  - **failed** : erreur FR mappée + `errorMsg` worker + bouton **« Réessayer »**.
  - `router.refresh()` à chaque transition (l'historique ne se met pas à jour aujourd'hui — bug) ; supprimer l'auto-fermeture 1,5 s.
- Tests `ReplyComposer.test.tsx` + `reply-actions.test.ts`.

### ⚠️ Config (sinon le code ne suffit pas)
- `PII_ENCRYPTION_KEY`, `SMTP_HOST`, `ADMIN_REPLY_FROM` alignés sur **app ET worker**. **C'est très probablement LE fix racine.**

---

## 3. Brique B — Telegram sortant exhaustif (3 flux)

- **Correctif scope** : `TELEGRAM_BOT_TOKEN` + 3 `TELEGRAM_CHAT_ID_*` sur **l'app web** (absents → tout perdu).
- **`routing.ts`** : mapper chaque `category` → groupe (RDV/Messages/Système).
- **Couverture exhaustive** : `notify()` déjà appelé par unified-contact (12 types), capturer-lead (chatbot), api/calendly, job-application, newsletter, review. **Test de couverture** qui échoue si un point d'entrée oublie l'appel.
- **`channels/telegram.ts`** : `chatId` paramétrable + retourner le `message_id` (requis pour le bidirectionnel). Garder fail-soft.

---

## 4. Brique C — Réponse depuis Telegram (bidirectionnel) — FAISABLE (complexité faible-moyenne)

1. **Boutons inline** sur pings RDV : `Confirmer` / `Refuser` / `Ouvrir admin` → mutent `Booking`/`Submission` + email, sans ouvrir le web.
2. **Réponse texte** : reply natif Telegram → `sendSubmissionReplyInternal` (refacto DRY de `replyToSubmissionAction`) → email client + `SubmissionReply` (apparaît en console). Marche en privacy mode.

Fichiers (cloisonnés) :
- `src/app/api/telegram/webhook/route.ts` (POST, `nodejs`, `force-dynamic`) — auth **double** (secret token timing-safe + allowlist `from.id`), dédup `update_id`, 200 < 100 ms, enqueue.
- `src/server/telegram/inbound/{verify,router,callback-data}.ts` — HMAC `callback_data` (≤ 64 o, 0 PII).
- `src/server/queue/workers/telegram-inbound-worker.ts` (BullMQ, retry, idempotent `actedAt`).
- Prisma `model TelegramThread { messageId, submissionId?, bookingId?, kind, actedAt… }` (additif, 0 PII, join FK) + migration additive.
- `scripts/telegram-set-webhook.ts` (setWebhook idempotent, `secret_token`).

---

## 5. Brique D — Onglet « RV téléphonique » + Vue calendrier

### Sources (2 entités, PAS de nouvelle table)
- `CalendlyEvent` (actif) + `Booking` (legacy gelé, lecture seule) → couche **normalisation read-only** → `UnifiedRdv` (namespacé `cal_`/`bk_`).
- ⚠️ `CalendlyEvent.startTime` souvent **null** → placement sur jour de capture + badge « heure ? ». Bucketing **Europe/Paris**.

### Onglet « RV téléphonique » (liste)
- Route `contacts/rendez-vous/page.tsx` (RSC). `AdminTable` + filtres `<form GET>` (0 JS client). Colonne Type/canal. Lignes → détail existant.

### Vue calendrier (clic date → détail)
- Route `contacts/rendez-vous/calendrier/page.tsx` (RSC).
- Extraire `buildMonthGrid()` → `src/lib/calendar-grid.ts` + `MonthGridCalendar.tsx` (RSC générique). CSS : **ajouter** `.admin-calendar-cell--rdv*` (0 régression Booking).
- Cellule = nb RDV + dots statut, cliquable → `?date=YYYY-MM-DD` → panneau « RDV du jour ». **100 % RSC, 0 lib, 0 KB client.**

### Fichiers
- `src/features/admin-rendezvous/{types,normalize,queries}.ts`, `src/lib/calendar-grid.ts`, `MonthGridCalendar.tsx`, 4 pages/composants `contacts/rendez-vous/`.
- Modifs : `admin-nav.ts` (groupe `rendez-vous`), `CalendrierV2.tsx` (import util), `admin.css`.

---

## 6. Brique E — Navigation finale
```
📅 Rendez-vous
   ├─ RV téléphonique   → /contacts/rendez-vous            (liste unifiée)
   ├─ Calendrier RDV    → /contacts/rendez-vous/calendrier
   └─ Appels Calendly   (existant — garder pour l'instant)
```

---

## 7. ⚠️ ACTIONS REQUISES DE WILL

1. **Créer 3 groupes Telegram** (« Axion 📅 RDV », « 💬 Messages », « 🔔 Système »), y **ajouter @axion_ia_notif_bot**, envoyer « test » dans chacun → je récupère les 3 `chat_id`.
2. **Env Coolify (scope RUN) sur app ET worker** :
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID_{RDV,MESSAGES,SYSTEM}`
   - **`PII_ENCRYPTION_KEY`** (aligner app↔worker = fix bug réponse), `SMTP_HOST`, `ADMIN_REPLY_FROM`
   - `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ALLOWED_USER_ID` (ton ID via @userinfobot)
3. **M'autoriser à lancer `telegram-set-webhook.ts`** après déploiement.
4. **Test E2E** final en prod.
5. Merge/PR.

*(Je ne peux pas créer les bots/groupes ni écrire les secrets Coolify — règle de sécurité. Je fournis le code + les valeurs à coller.)*

---

## 8. Tests / vérification
- **Unitaires (Gate A)** : reply (enqueue null → failed ; invalid_recipient ; payload sans PII ; composer sent/failed/polling/retry) ; telegram (callback-data ≤64o + HMAC ; verify secret+allowlist ; worker idempotent ; couverture notify) ; RDV (normalize purs, dayKey Paris ; buildMonthGrid non-régression).
- **Build-safety (ADR 0026)** : webhook + workers no-op avec `stub.invalid` ; `force-dynamic`.
- **E2E prod** : réponse console → ✓ + email ; réponse Telegram → SubmissionReply + email ; bouton Confirmer → mutation + email ; POST sans secret → 401 ; clic date → RDV du jour.
- **Gate A bloquant** (⚠️ `prettier --write` avant push). Backend/admin only → Web Vitals ≈ 0.

---

## 9. Ordre d'implémentation
1. **Brique A + config** (débloque les réponses) — code + Étape 0 diagnostic.
2. **Brique B** (scope + 3 groupes) — réception triée.
3. **Brique D+E** (RV + calendrier + nav) — code-only, sans blocage.
4. **Brique C** (bidirectionnel) — dépend groupes + secret + user ID.

Briques A, B, D, E = **implémentables en autopilote maintenant** (code). Activation Telegram quand l'infra est prête.

---

### Références
ADR 0010 (PII Telegram), 0026 (build stub), 0029 (hub notify), 0031 (reply system). Bot : @axion_ia_notif_bot. Fichiers : `src/server/notifications/*`, `src/features/admin-submissions/reply-actions.ts`, `src/features/admin-rendezvous/*` (nouveau), `CalendlyEvent`/`Booking`.
