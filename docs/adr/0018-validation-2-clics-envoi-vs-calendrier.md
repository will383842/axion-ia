# ADR 0018 — Validation admin en 2 clics distincts (Envoi contrat vs Calendrier)

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-02-admin-organisation.md` §5, `agent-03-state-machine.md` §3, `03-ARCHITECTURE-CIBLE.md` §5.5 + §5.11.4, `STOP-AND-ASK.md` D37 / D49 / D50 / D51 / D52 / D55

---

## Contexte

Le parcours A (calendrier visiteur) déclenche une suite de transitions admin entre la réception d'une option visiteur et la confirmation finale d'un booking dans le calendrier exécutif. L'audit initial proposait **1 seul clic admin** (« Confirmer ») fusionnant : envoi contrat + demande acompte + apparition sur calendrier opérationnel.

Will a rejeté ce design pour 4 raisons (D49) :

1. **Clarté UX admin** : « Envoyer le contrat » ≠ « Voir apparaître la réservation sur mon calendrier ». Confusion mentale.
2. **Délai naturel** entre les 2 étapes : entre le clic 1 (envoi) et le clic 2 (validation finale), il s'écoule typiquement 1-10 jours (paiement acompte client + retour signature contrat).
3. **Pas de slot calendrier bloqué prématurément** : tant que l'acompte n'est pas reçu, Will ne veut **pas** voir le slot bloqué dans son calendrier exécutif (pour pouvoir gérer les multi-options, ADR 0017).
4. **Critère bloquant clair** pour le passage 🔴 (confirmé) = **paiement acompte reçu**, pas la signature contrat (qui peut se faire le jour J physiquement).

## Décision

### 2 clics admin distincts dans le drawer `/admin/reservations/:id`

#### Clic 1 — « Envoi contrat + demande acompte »

**Bouton** : `📧 Envoyer contrat + acompte`
**Localisation** : drawer admin booking, section « Actions principales ».
**Pré-requis** : option_pending OR awaiting_admin_validation (D55 — saisie admin valeurs facturation préalable).

**Transition** : `option_pending` → `contract_payment_sent`.

**Effets** :

1. Génération PDF contrat (`react-pdf` template `ContractTemplate`).
2. Upload PDF Hetzner Storage Box (`contracts/{bookingId}/v1.pdf`).
3. Soumission DocuSeal (`POST /api/submissions` — cf. ADR 0014).
4. Création Stripe Checkout Session pour l'acompte (cf. ADR 0013), ou génération RIB email si `manual_wire`.
5. Email client envoyé :
   - Lien signature DocuSeal.
   - Lien paiement Stripe (ou RIB si manual).
   - Mention « Le créneau est en option jusqu'à réception de l'acompte ».
6. Notification Telegram Will (« Contrat + acompte envoyés à Client X pour Booking Y »).
7. Audit log `BookingTransition(from='option_pending', to='contract_payment_sent', userId=Will, ...)`.

**Le slot n'est PAS bloqué côté calendrier exécutif à ce stade.** Will reste libre de gérer d'autres options sur le même slot (ADR 0017).

#### Clic 2 — « Valider sur le calendrier »

**Bouton** : `✅ Valider sur le calendrier`
**Localisation** : drawer admin booking, section « Actions principales ».
**Pré-requis** : `awaiting_admin_validation` (cf. point suivant).

**Transition** : `awaiting_admin_validation` → `confirmed`.

**Effets** :

1. Slot **bloqué officiellement** dans le calendrier exécutif Will.
2. Toutes les autres `BookingOption` sur le même slot transitionnent en `lost_other_won` (ADR 0017).
3. Emails « slot perdu + alternatives » envoyés aux concurrents.
4. Email client « Réservation confirmée — voici les prochaines étapes » envoyé.
5. Calendrier ICS attachment (lien `webcal://` AxionIA-managed).
6. Notification Telegram Will.
7. Audit log.

### État intermédiaire `awaiting_admin_validation` (D51)

Entre clic 1 et clic 2, le booking passe par un état dédié :

```
option_pending
    │ [clic 1 admin : Envoi contrat + acompte]
    ▼
contract_payment_sent
    │ [client paie acompte — webhook Stripe OU saisie admin manuel]
    ▼
awaiting_admin_validation  ← ÉTAT INTERMÉDIAIRE
    │ [clic 2 admin : Valider sur le calendrier]
    ▼
confirmed
```

L'état `awaiting_admin_validation` signale à Will (vue admin Dashboard « Aujourd'hui ») qu'**un booking est prêt à être confirmé**, condition réunie (acompte reçu).

### Critère bloquant unique = paiement acompte reçu (D50)

Le passage `contract_payment_sent` → `awaiting_admin_validation` est conditionné **uniquement** au paiement de l'acompte :

- ✅ **Bloquant** : `Payment WHERE bookingId=X AND status='succeeded' AND scheduleIndex=0`.
- ⏳ **Non-bloquant** (optionnel) : signature contrat DocuSeal. Si signé, badge vert s'affiche, mais Will peut valider sans (cas où la signature physique se fait le jour J — usuel en B2B grand compte).

#### Justification — signature physique jour J

Will a constaté dans son business V0 que **~30 % des contrats** sont signés physiquement le matin du jour J (formation présentielle) plutôt qu'à distance avant. Forcer la signature DocuSeal comme bloquant ferait perdre 30 % des bookings.

### Délais d'expirations configurables (D52)

2 délais paramétrables depuis admin (`SiteSetting`, défauts en seed) :

| Setting                                  | Défaut   | Effet à expiration                                                                                                                                                                   |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `optionExpirationDaysIfNothingReceived`  | **5 j**  | Si à J+5 après création option : ni signature ni paiement → `option_pending` → `expired_no_action`. Slot libéré, email client « Option expirée, recommencez si toujours intéressé ». |
| `contractSignedWithoutDepositCutoffDays` | **10 j** | Si à J+10 après envoi contrat (clic 1) : contrat signé MAIS acompte non payé → `contract_payment_sent` → `expired_no_payment`. Slot libéré, email client + Will notifié.             |

Modifiable depuis admin `/admin/parametres/booking`. Hook V2+ : délais par type d'intervention (Conférence = 30j, Essentielle = 5j).

### Saisie admin obligatoire avant clic 1 (D55)

Avant que Will puisse cliquer « Envoi contrat + acompte », un **écran de saisie admin** s'affiche pour valider/compléter :

- Montant final (override possible vs PricingConfig).
- Adresse facturation (CompanyName, VAT, address).
- Adresse intervention (Place name, address, distance auto OSM).
- Notes admin (commentaire libre).
- Choix `Payment.provider` (stripe par défaut, ou manual\_\*).
- Choix `PaymentScheduleProfile` (default suggéré, override possible).

Ces données alimentent le contrat (PDF) et la facture future. Voir `agent-02-admin-organisation.md` §6 et `03-ARCHITECTURE-CIBLE.md` §5.11.4.

## Conséquences

### Techniques

- 2 boutons distincts dans le drawer admin (vs 1 unique au design initial).
- État `awaiting_admin_validation` ajouté à l'enum `BookingStatus` (D51).
- Cron job `booking-expire-options` (J+5) + `booking-expire-no-payment` (J+10) configurables.
- 2 templates email nouveaux : `option-expired-no-action.{fr,en}.mjml`, `option-expired-no-payment.{fr,en}.mjml`.
- État `awaiting_admin_validation` visible Dashboard Aujourd'hui (filtre dédié — Sprint X.14).

### Business

- Will reste maître de l'arbitrage final (validation explicite, jamais auto).
- Pas de slot bloqué prématurément (cap multi-options préservé — ADR 0017).
- Flexibilité signature physique J0 (gain 30 % bookings B2B trad).
- Délais paramétrables = adaptation par usage sans deploy.

### UX admin

- Clarté mentale : « Envoi » ≠ « Validation ».
- Dashboard Aujourd'hui affiche les bookings en `awaiting_admin_validation` en orange (action requise).
- Audit trail complet : qui a cliqué quoi quand (`BookingTransition` event sourcing — §5.1.20).

## Alternatives écartées

- **1 clic unique « Confirmer »** : confusion UX, slot bloqué trop tôt, perd 30 % bookings signature J0.
- **3 clics (Envoi / Acompte reçu / Validation)** : redondant — l'acompte reçu est détecté automatiquement par le webhook Stripe ou la saisie admin manuelle.
- **Critère bloquant = signature contrat** : perd 30 % bookings B2B trad.
- **Critère bloquant = signature OR acompte** : trop laxiste, risque de slot confirmé sans paiement (cas où client signe mais ne paie jamais).

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-02-admin-organisation.md` §5 (drawer admin), §6 (saisie admin)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-03-state-machine.md` §3 (transitions)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.5 (state machine), §5.11.4 (saisie admin), §5.1.2 (BookingStatus enum)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D37, D49, D50, D51, D52, D55
- ADR 0013 (Stripe paiement), ADR 0014 (DocuSeal signature), ADR 0017 (multi-options), ADR 0019 (modes manuels D64)
