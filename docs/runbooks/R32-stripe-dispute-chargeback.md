# R32 — Litige / chargeback Stripe (`charge.dispute.created`)

- **Code** : R32
- **Version** : 1.0
- **Date dernière maj** : 2026-05-16
- **Sévérité** : 🟠 **P0 — réponse obligatoire sous 7 jours calendaires**
- **Impact si non traité** : perte automatique du fonds + frais dispute Stripe ~15 € (montant retiré du solde Stripe et reversé au client). Au-delà du **dispute rate 1 %** mensuel, Stripe peut placer le compte en review / freeze.

## Trigger

Alerte Telegram automatique poussée par `src/app/api/stripe/webhook/route.ts:368` (`handleDisputeCreated`) :

```
🚨 LITIGE Stripe ouvert (dispute dp_xxx, montant 990.00 EUR, raison fraudulent).
Action requise dashboard Stripe.
```

Ou alerte Stripe Dashboard email à l'adresse owner du compte.

> Si tu vois l'alerte mais **pas de transition automatique du Booking** : c'est volontaire. L'admin doit intervenir manuellement pour produire l'evidence (le code ne peut pas savoir quel argument utiliser).

## Pré-requis

- Accès Stripe Dashboard (`dashboard.stripe.com`) avec rôle Administrator (Will direct ou compta déléguée)
- Accès admin Axion-IA : `https://axion-ia.com/fr/<ADMIN_URL_PREFIX>/paiements` (lecture Booking + Payment lié)
- Boîte `contact@axion-ia.com` opérationnelle (Zoho Mail) pour récupérer threads emails client
- Cloud R2 / Hetzner Storage : récupération PDF NDA + facture si nécessaire (DocuSeal upload signed PDF)
- 1Password : récupération évidences pré-archivées (snapshots écrans CGV, logs Calendrier, etc.)

## Cibles mesurées

- **Réponse evidence soumise sous J+5** (laisse 2j de marge avant deadline Stripe J+7)
- **Win rate dispute target** : ≥ 60 % (industrie 35-45 %, on vise meilleur via NDA signé + audit log hash-chain)
- **Dispute rate mensuel** : ≤ 0.5 % (alerte rouge ≥ 0.75 %)

## Étapes

### 1. Confirmer le diagnostic (5 min)

```bash
# Récupérer le dispute Stripe via API (lecture seule)
set -a && source .secrets/api-tokens.env && set +a
DISPUTE_ID="dp_xxx"  # depuis Telegram alert

curl -fsS "https://api.stripe.com/v1/disputes/${DISPUTE_ID}" \
  -u "${STRIPE_SECRET_KEY}:" \
  | jq '{id, status, amount, currency, reason, evidence_due_by, charge, payment_intent, livemode}'
```

Interpréter :

- `reason` parmi : `fraudulent` (vol carte), `unrecognized` (client ne reconnaît pas), `product_not_received`, `product_unacceptable`, `duplicate`, `subscription_canceled`, `credit_not_processed`, `general`.
- `evidence_due_by` : timestamp Unix → date deadline Stripe (J+7 généralement).
- `livemode` : `true` confirme mode LIVE (sinon test).
- `status` : `warning_needs_response` = action requise. `under_review` = evidence déjà soumise, attente Stripe. `won` / `lost` = terminé.

### 2. Identifier le Booking lié (5 min)

```bash
# Récupérer le charge → metadata Stripe contient bookingId
CHARGE_ID=$(curl -fsS "https://api.stripe.com/v1/disputes/${DISPUTE_ID}" \
  -u "${STRIPE_SECRET_KEY}:" | jq -r .charge)

curl -fsS "https://api.stripe.com/v1/charges/${CHARGE_ID}" \
  -u "${STRIPE_SECRET_KEY}:" \
  | jq '{id, amount, metadata, billing_details, payment_method_details: .payment_method_details.card | {country, last4, funding}}'
```

Le champ `metadata.bookingId` doit pointer vers un `Booking.id` Axion-IA.

```bash
# Récupérer le Booking complet via admin (read-only, anon impossible)
# → utiliser l'UI admin /paiements ou exporter via Server Action
```

Si pas de `metadata.bookingId` → c'est un test Stripe ou un paiement orphelin. Vérifier `Payment` table directement :

```sql
SELECT * FROM payments WHERE provider_event_id LIKE '%${CHARGE_ID}%';
```

### 3. Décider de la stratégie (5 min)

| Cas                                                       | Recommandation                                 |
| --------------------------------------------------------- | ---------------------------------------------- |
| Service livré, NDA signé, client malhonnête               | **Contester** (win rate haut)                  |
| Service NON livré (cancel client, no-show, refund manqué) | **Accepter** (ne pas gaspiller temps + frais)  |
| Carte volée légitime (`fraudulent` + IP suspect)          | **Accepter** + refund proactif + bannir email  |
| Doublon technique (`duplicate`)                           | **Accepter** + vérifier idempotency-key cassée |

Logger la décision dans `_AUDIT/STRIPE-DISPUTES-LOG.md` (créer fichier si absent).

### 4. Si **CONTESTER** → rassembler l'evidence (30-60 min)

Stripe accepte les pièces suivantes (Evidence API) :

- `customer_email_address` (du Booking)
- `customer_name`
- `billing_address` (du Stripe charge)
- `customer_signature` (PDF NDA DocuSeal signé)
- `service_documentation` (PDF facture + CGV acceptées)
- `service_date` (date du rendez-vous booké)
- `receipt` (URL receipt Stripe ou capture)
- `customer_communication` (PDF/screenshots emails du client confirmant le service)
- `uncategorized_text` (narrative chronologique : "Le 2026-05-12, le client a réservé X. Le 2026-05-15, il a signé le NDA via DocuSeal (signature ID Y, hash Z). Le 2026-05-16, le service a été livré, etc.")

Ressources internes à exploiter :

```bash
# 1. PDF NDA signé DocuSeal
#    → Cloudflare R2 URL signée 90j (commit 50b06ff), via admin UI Booking detail

# 2. Audit log hash-chain (Sprint 17) — preuve d'intégrité immuable
#    → SELECT * FROM activity_log WHERE booking_id='xxx' ORDER BY ts ASC
#    → exporter en JSON + screenshot SHA-256 chain valid

# 3. Email thread Zoho (contact@axion-ia.com)
#    → recherche par adresse client → export EML/PDF des threads

# 4. Calendrier (rendez-vous tenu ?)
#    → screenshot de l'événement passé + invitation acceptée

# 5. Vidéo / enregistrement Meet (si conférence)
```

Soumettre via Dashboard (UI `Disputes > [ID] > Submit evidence`) OU API :

```bash
# Exemple API (uploader d'abord les PDF via /v1/files)
FILE_ID_NDA=$(curl -fsS https://files.stripe.com/v1/files \
  -u "${STRIPE_SECRET_KEY}:" \
  -F "purpose=dispute_evidence" \
  -F "file=@/tmp/nda-signed.pdf" | jq -r .id)

curl -fsS -X POST "https://api.stripe.com/v1/disputes/${DISPUTE_ID}" \
  -u "${STRIPE_SECRET_KEY}:" \
  -d "evidence[customer_signature]=${FILE_ID_NDA}" \
  -d "evidence[service_documentation]=${FILE_ID_INVOICE}" \
  -d "evidence[customer_email_address]=client@example.com" \
  -d "evidence[uncategorized_text]=Narrative complète..." \
  -d "submit=true"
```

> ⚠️ `submit=true` est **irréversible** — Stripe refusera tout edit après. Préparer toute l'evidence avant.

### 5. Si **ACCEPTER** → fermer rapidement (2 min)

```bash
curl -fsS -X POST "https://api.stripe.com/v1/disputes/${DISPUTE_ID}/close" \
  -u "${STRIPE_SECRET_KEY}:"
```

Pas de remboursement à émettre côté nous : Stripe a déjà retiré le montant. Le `charge.refunded` ne sera **pas** déclenché (c'est un chargeback, pas un refund).

Côté Axion-IA, le Booking doit basculer :

```sql
-- Manuellement via admin UI /paiements/[id]/transition
UPDATE bookings
SET status='disputed_lost', dispute_id='${DISPUTE_ID}', updated_at=NOW()
WHERE id='${BOOKING_ID}';

-- Alternative : via Server Action applyTransition() pour respecter state-machine
```

### 6. Suivre l'état du dispute (passif)

Stripe rendra son verdict sous 2-12 semaines selon la banque émettrice. Webhook automatique :

- `charge.dispute.closed` → final verdict
- `charge.dispute.updated` → status changement (under_review, charge_refunded, won, lost)

Côté webhook `route.ts:43-49`, on ne souscrit actuellement **que** `charge.dispute.created`. Pour automatiser le suivi :

→ TODO P1 : étendre `KNOWN_EVENTS` avec `charge.dispute.closed` + `charge.dispute.updated` + handler MAJ Booking status auto.

### 7. Post-mortem (10 min)

Ajouter une entrée dans `_AUDIT/STRIPE-DISPUTES-LOG.md` :

```markdown
## dp_xxx — YYYY-MM-DD

- **Booking** : `<bookingId>` (client `<email>`)
- **Reason** : `fraudulent` (ou autre)
- **Amount** : XXX EUR
- **Strategy** : CONTESTER / ACCEPTER
- **Evidence soumise** : NDA + facture + threads emails (3 PDFs)
- **Submit date** : YYYY-MM-DD
- **Outcome** : WON / LOST / pending
- **Lessons** :
  - …
- **Action préventive** : …
```

## Métriques dispute rate mensuel

Source : Stripe Dashboard → Disputes → Filter par mois.

Cibles :

- ≤ 0.5 % = vert (cible interne)
- 0.5-0.75 % = jaune (alerte Telegram suggérée)
- ≥ 0.75 % = rouge (immédiat : review CGV + flow vente)
- ≥ 1.0 % = Stripe peut placer le compte en review forcé

→ TODO P2 : worker BullMQ `stripe-dispute-rate-monitor` (cron weekly Monday 03:00 UTC) qui calcule le ratio et alerte si > seuil.

## Vérifications post-fix

- [ ] Evidence soumise dans Stripe Dashboard (status `under_review`)
- [ ] Booking status mis à jour côté admin (`disputed_pending` ou `disputed_lost` ou `disputed_won`)
- [ ] Entrée loggée dans `_AUDIT/STRIPE-DISPUTES-LOG.md`
- [ ] Si pattern récurrent : créer ADR sur durcissement flow (ex. exiger 3DS forçé)
- [ ] Si client malhonnête identifié : ajouter email à blocklist (DB ou Cloudflare WAF)
- [ ] Si carte volée : vérifier que l'IP du paiement n'a pas tenté d'autres bookings (rate-limit / fraude pattern)

## Prévention

- **3DS forcé** : configurer Stripe Radar rule "Request 3DS authentication on all charges ≥ 200 EUR"
- **Stripe Radar** : activer "Block all payments with high risk score" (default ≥ 75)
- **Idempotency-Key** Booking submit : déjà câblée (commit `9146546` batch 8) — évite les disputes `duplicate`
- **CGV opt-in obligatoire** : déjà câblée Booking form (champ `acceptedTerms` required)
- **NDA pré-RDV** : déjà câblé (DocuSeal séquentielle `78ad11a`)
- **Audit log hash-chain** Sprint 17 : preuve d'intégrité immuable en cas de contestation

## Références

- Stripe Disputes API : https://stripe.com/docs/api/disputes
- Stripe Evidence types : https://stripe.com/docs/disputes/responding
- Code handler : `src/app/api/stripe/webhook/route.ts:368-373` (`handleDisputeCreated`)
- ADR 0013 — Stripe Checkout hybride manuel
- R28 — DPA renewal (incluant DPA Stripe annuel)
