# ADR 0031 — Reply system admin pour `Submission` (inbox unifiée)

- **Date** : 2026-05-26
- **Status** : Accepted
- **Sprint** : Notif Infra 2026-05-26 (PR `feat/notif-infra-contacts-calendly`)
- **Chantier** : 5 (sur 5 dans le sprint, marqué CRITIQUE dans le PROMPT)

## Contexte

Avant ce sprint, l'admin `/submissions/[id]` permet à Will de **lire** une
soumission (audit / intervention / contact / devis / implementation) et
d'éditer le workflow interne (status, internalNotes, assignedTo). Mais pour
**répondre** au lead, Will doit :

1. Copier l'email destinataire dans son client Gmail
2. Rédiger la réponse à la main
3. Pas de trace de la réponse dans l'admin (pas d'historique, pas de
   delivery status)
4. Pas de filtre "sans réponse" dans le listing

Résultat : à 50+ submissions/mois, Will perd des leads dans sa boîte Gmail
et ne sait plus rapidement qui attend une réponse.

## Décision

Implémentation d'un **reply system intégré** dans l'admin, avec :

- **Modèle dédié** `SubmissionReply` (1 Submission → N replies — historique
  multi-allers-retours)
- **Server Actions** pour répondre + archiver + retry envoi
- **UI** composer modal + timeline historique avec status delivery
- **Indicateurs inbox** : badge sidebar unread + filtres listing

### Modèle Prisma `SubmissionReply`

```prisma
model SubmissionReply {
  id                String   @id @default(cuid())
  submissionId      String
  repliedByUserId   String?  // FK AdminUser, ON DELETE SET NULL
  repliedByName     String   // snapshot immuable
  repliedAt         DateTime @default(now())
  toEmail           String   // snapshot — au cas où Submission.contactEmail change
  subject           String
  bodyHtml          String   @db.Text  // pre-rendu via React Email template
  bodyText          String   @db.Text  // multipart MIME
  deliveryStatus    SubmissionReplyStatus  @default(pending)
  providerMessageId String?
  sentAt            DateTime?
  failedAt          DateTime?
  errorMsg          String?  @db.Text
  retryCount        Int      @default(0)
  templateUsed      String?  // "default" | "audit_followup" | ...
  internalNote      String?  @db.Text  // privé admin, jamais envoyé

  submission        Submission  @relation(...)
  repliedByUser     AdminUser?  @relation(...)
}

enum SubmissionReplyStatus {
  pending sent delivered bounced complained failed
}
```

### Extensions `Submission` (additif strict)

5 colonnes ajoutées pour le filtre inbox sans recalcul :

```prisma
replyCount       Int       @default(0)   // count cache
firstRepliedAt   DateTime?                // snapshot 1er envoi réussi
lastRepliedAt    DateTime?                // snapshot dernier envoi réussi
needsAttention   Boolean   @default(true) // filtre inbox default
archivedAt       DateTime?                // archivage explicite
```

Plus l'index composite `(needsAttention, archivedAt)` pour le filtre default
"sans réponse + non archivé" (= to-do list Will).

### Server Actions

`src/features/admin-submissions/reply-actions.ts` :

- `replyToSubmissionAction` : RBAC → Zod → render template via React Email →
  create `SubmissionReply` (status=pending) + increment `replyCount` +
  `needsAttention=false` + status `new → in_progress` (transactional) →
  enqueue email job → revalidatePath
- `archiveSubmissionAction` + `unarchiveSubmissionAction` (idempotent)
- `bulkArchiveSubmissionsAction` (jusqu'à 500 items)
- `markNeedsAttentionAction` (toggle inbox highlight)
- `retryFailedReplyAction` : reset `failed/bounced → pending` + re-enqueue

Toutes guardées par `requireAdminWriteSession()` (super_admin / admin / editor).

### Email worker handler dédié

`src/server/queue/workers/email-worker.ts` — branche `submission-reply` :

- Lit `SubmissionReply` depuis la DB (HTML/text figés au moment du
  `replyToSubmissionAction`)
- Envoie via `sendEmail` avec `replyTo: process.env.ADMIN_REPLY_FROM ??
"contact@axion-ia.com"` (décision Will figée)
- Sync `deliveryStatus = sent` + `sentAt` + `providerMessageId` (Message-ID
  SMTP) + `Submission.firstRepliedAt/lastRepliedAt` en transaction
- Catch → `deliveryStatus = failed` + `failedAt` + `errorMsg` + `retryCount++`,
  puis throw → BullMQ retry backoff exponentiel (5 attempts default queue)

### Template React Email

`src/lib/email/templates/submission-reply.tsx` — branded Axion-IA :

- Header brand uppercase + h1 sujet
- Body markdown léger (paragraphes + `**bold**` + `*italic*` + `[label](url)`)
  rendu sans dépendance externe (pas de `react-markdown` — Will écrit du texte
  simple, pas la peine d'alourdir le bundle)
- Signature défaut "Williams Jullin / Axion-IA · cabinet IA opérationnel"
- Quote optionnel du message initial style "─ Votre message initial"
- Footer EmailLayout standard (contact, copyright, hreflang)

### UI admin

`src/components/admin/contacts/` :

- **`ReplyComposer.tsx`** (Client) — modal/sheet `role="dialog" aria-modal`
  ouverte depuis bouton "✉️ Répondre" dans header détail. Sélecteur template
  (default / audit_followup / intervention_followup / custom) + subject +
  body markdown + `internalNote` privé.
- **`ReplyHistory.tsx`** (Server) — timeline triée `repliedAt desc`. Status
  visuel (icon + label + tone) : `pending 🟡` / `sent 🟢` / `delivered ✅` /
  `bounced ⚠️` / `failed 🔴` / `complained 🚨`. Accordion `<details>` pour
  contenu plain-text (pas d'injection HTML brute en V1).
- **`RetryFailedReplyButton.tsx`** (Client) — déclenche
  `retryFailedReplyAction` (failed/bounced uniquement).

### Badge sidebar unread

`AdminSidebarNav` reçoit un nouveau prop `unreadContactsCount` calculé au
render SSR du layout admin via :

```ts
prisma.submission.count({ where: { needsAttention: true, archivedAt: null } });
```

Badge rouge `bg-red-500` sur l'entrée `/contacts/messages` quand > 0. Format
"99+" si > 99 pour éviter overflow visuel.

V1 recalcule à chaque render SSR (layout `force-dynamic`). Si volumétrie
augmente, wrap dans `unstable_cache 30s` — out of scope V1.

## Décisions Will pré-figées (autopilot)

| Question                                      | Décision                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Reply-To pour réponses admin                  | `contact@axion-ia.com` (env `ADMIN_REPLY_FROM`)                                                    |
| Notif Telegram audit-trail des réponses admin | **Non** (status delivery dans timeline suffit) → `channels: []` pour `ADMIN_REPLIED_TO_SUBMISSION` |
| Threading entrant (IMAP listener)             | **Hors scope V1** — Will lit les réponses user dans Gmail manuellement                             |

## Threading entrant (V2 future)

Quand un user répond à un email envoyé via ce système :

- Le `Reply-To` pointe vers `contact@axion-ia.com`
- La réponse arrive dans la boîte Gmail/IMAP de Will
- **Pas de threading automatique en V1** — Will lit la réponse dans Gmail
  et soit re-clique "Répondre" dans l'admin, soit copie le contenu dans
  `internalNote` de la submission

V2 future possible : IMAP listener → parse `In-Reply-To` / `References`
headers → match `Message-ID` → créer un model `SubmissionIncomingReply` lié.
Effort estimé : 1-2 semaines (IMAP IDLE + MIME parser + déduplication).

## Conséquences

### Positives

- **Inbox opérationnelle** : Will voit instantanément qui n'a pas reçu de
  réponse (filtre default + badge sidebar).
- **Audit-trail complet** : historique multi-replies persisté en DB +
  delivery status par message.
- **Zero perte** : si email worker échoue, retry auto BullMQ + bouton retry
  manuel UI.
- **Branding cohérent** : template Axion-IA via EmailLayout commun.

### Négatives / trade-offs assumés

- **Pas de threading entrant en V1** — Will doit jongler entre admin et
  Gmail pour suivre une conversation. Acceptable pour 50+ leads/mois ;
  V2 si le volume justifie.
- **Délivrabilité dépend de PowerMTA** local (déjà configuré SPF + DKIM +
  DMARC).
- **Markdown léger custom** vs react-markdown : trade-off poids bundle.
  Si Will veut des images / tableaux / listes complexes en V2, on switchera
  vers react-markdown.

## Migration

Migration Prisma additive (cf. `prisma/migrations/20260526220000_*`) :

- ADD COLUMN avec DEFAULT sur `Submission` (5 nouvelles cols)
- CREATE TABLE `submission_replies` + enum `submission_reply_status`
- Index composite `submissions_needs_attention_archived_at_idx`
- FK ON DELETE CASCADE (Submission) + SET NULL (AdminUser)

100% rétrocompat — l'ancienne route `/submissions/[id]` redirige `301` vers
`/contacts/messages/[id]` mais le composant `SubmissionDetailContent` reste
backward-compatible.

## Tests

`src/features/admin-submissions/__tests__/reply-actions.test.ts` — 11 cas :

- `replyToSubmissionAction` happy path
- RBAC : non-admin → unauthorized
- Submission introuvable → submission_not_found
- Zod validation : subject vide
- Archive single
- Archive RBAC fail
- Bulk archive (3 items)
- Bulk archive ids vide → archived=0
- `markNeedsAttentionAction` toggle
- `retryFailedReplyAction` happy path
- `retryFailedReplyAction` on sent reply → not_retryable

**11/11 verts.**

## Actions Will post-merge

- Coolify env vars (scope RUN, pas de redeploy car pas inliné client) :
  - `ADMIN_REPLY_FROM=contact@axion-ia.com`
  - `ADMIN_REPLY_FROM_NAME=Axion-IA`
- Migration DB : `pnpm prisma migrate deploy` (auto via Coolify entrypoint)
- Test end-to-end manuel : remplir form `/contact` → cliquer "Répondre" dans
  l'admin → composer message → envoyer → vérifier delivery status timeline

## Références

- Sprint plan : `_AUDIT/SPRINT-NOTIF-INFRA-2026-05-26/PROMPT.md` §5 Chantier 5
- ADR 0029 — Hub notifications (utilisé pour notif post-reply, channels: [])
