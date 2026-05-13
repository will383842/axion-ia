# ADR 0019 — Modes manuels D64 togglables (résilience opérationnelle)

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-06-automatisations.md` §4, `03-ARCHITECTURE-CIBLE.md` §5.11.4 + §5.1.19, `STOP-AND-ASK.md` D64

---

## Contexte

L'audit Booking V1 a fait apparaître **5 scénarios de panne ou démarrage** où les automatisations (Stripe, DocuSeal, emails MailWizz/PMTA) sont indisponibles ou non encore configurées :

1. **J0 démarrage prod** : DPA Stripe pas encore signé, KYB en cours → impossible de basculer en mode LIVE. Will doit pouvoir **continuer à prendre des bookings** en mode 100 % manuel (virement, facture papier).
2. **Panne Stripe ponctuelle** (API HTTP 500, ou compte suspendu après dispute) : Will doit pouvoir **finaliser les paiements en cours** sans attendre le retour de Stripe.
3. **Panne DocuSeal** (container Docker tombé, certificat SSL expiré, bug v2 introduit) : Will doit pouvoir **continuer à signer les contrats** physiquement ou via un PDF email manuel.
4. **Panne MailWizz / PMTA** : Will doit pouvoir **envoyer un email manuel** depuis Outlook / Gmail si besoin.
5. **Cas client spécifique** : un client veut **payer cash** (manual_cash, ADR 0013) ou **fournir un contrat custom** (manual upload PDF signé) — case-by-case.

La doctrine V1 doit donc être : **toute automatisation est désactivable et a un fallback manuel équivalent dans l'admin**. C'est le **principe D64** (Décision 64 de l'audit).

## Décision

### 4 toggles `SiteSetting` (paramétrables admin)

#### 1. `paymentAutomationEnabled` (Boolean, défaut `true`)

- `true` → Stripe Checkout activé pour tous les bookings (mode défaut `stripe`).
- `false` → tous les nouveaux bookings démarrent en mode `manual_wire` (RIB envoyé au client par email, validation admin à réception).
- Bouton **« Saisir paiement manuel »** dans le drawer booking — **toujours disponible** même si le toggle est `true`.

#### 2. `signatureAutomationEnabled` (Boolean, défaut `true`)

- `true` → DocuSeal submission auto à clic 1 « Envoi contrat ».
- `false` → contrat envoyé en PDF (téléchargeable depuis email client) avec mention « Signature physique le jour J ». Pas de DocuSeal submission créée.
- Bouton **« Uploader contrat signé »** dans le drawer booking — **toujours disponible** (Will scanne le contrat signé physique et l'upload).

#### 3. `automaticEmailsEnabled` (Boolean, défaut `true`)

- `true` → tous les emails transactionnels envoyés via PMTA + MailWizz (templates MJML).
- `false` → les emails sont **générés** (rendu MJML → HTML + texte clair) et stockés dans `BookingEmailQueue` avec status `pending_manual_send`. Will copie-colle le contenu dans Outlook/Gmail et envoie manuellement.
- Bouton **« Envoyer email manuel »** dans le drawer booking — toujours disponible (rendu template à la volée pour copy-paste).

#### 4. `automaticInvoiceGenerationEnabled` (Boolean, défaut `true`)

- `true` → facture PDF générée auto via `react-pdf` à la transition `paid_invoice_*`.
- `false` → facture **template Word/Excel** téléchargeable depuis admin, Will la remplit manuellement et l'envoie via Outlook + l'upload dans `Invoice.pdfUrl`.
- Bouton **« Générer facture template »** dans le drawer booking — toujours disponible (génère un PDF/Word vierge avec les données client préfillées).

### Overrides par booking — `Booking.overrides` JSONB

Une override locale (1 booking) écrase le default global :

```json
{
  "paymentAutomationEnabled": false,
  "signatureAutomationEnabled": false,
  "reason": "Client grand compte X — paiement OPCO + signature interne process",
  "setBy": "willId",
  "setAt": "2026-05-15T10:32:00Z"
}
```

UI : section « Modes manuels (avancé) » dans le drawer booking, masquée par défaut, dépliée à la demande.

### Overrides par client — `Client.preferences` JSONB

Une override client (sur tous ses futurs bookings) :

```json
{
  "paymentAutomationEnabled": false,
  "reason": "Client paie systématiquement par virement OPCO",
  "preferredPaymentProvider": "manual_wire"
}
```

UI : section « Préférences client (avancé) » dans la fiche client `/admin/clients/:id`.

### Boutons admin universels — toujours disponibles

Indépendamment des toggles, **4 boutons** sont toujours présents dans le drawer booking :

| Bouton                        | Action                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `💳 Saisir paiement manuel`   | Ouvre modale : montant, méthode (wire/check/cash), date encaissement, note. Crée `Payment(provider='manual_*', status='succeeded')`. |
| `📄 Uploader contrat signé`   | Ouvre modale : drag-drop PDF, version automatique (`v1`, `v2`...). Met à jour `ContractDocument.status='signed'`.                    |
| `🧾 Générer facture template` | Génère PDF/Word vierge avec données pré-remplies pour saisie manuelle.                                                               |
| `✉️ Envoyer email manuel`     | Ouvre modale : choix template, rendu HTML+texte, bouton « Copier » + « Marquer comme envoyé ».                                       |

Ces 4 boutons garantissent que **toute panne d'automatisation est récupérable manuellement** sans bloquer la business.

### Précédence d'application

1. `Booking.overrides` (le plus spécifique).
2. `Client.preferences`.
3. `SiteSetting` (global).
4. Défaut hardcodé `true`.

Hook V2+ : table d'audit `SiteSettingHistory` pour tracer toutes les modifications de toggles avec userId + timestamp.

## Conséquences

### Techniques

- 4 colonnes `SiteSetting` ajoutées (Boolean, défaut `true`).
- 2 colonnes JSONB ajoutées (`Booking.overrides`, `Client.preferences`).
- 4 boutons universels = 4 server actions + 4 modales admin.
- Helper TS centralisé : `getBookingMode(booking): ResolvedBookingMode` qui résout la chaîne de précédence.
- Cron `booking-expire-options` et `booking-expire-no-payment` tiennent compte des modes manuels (un booking 100 % manuel peut prendre 30 j de paiement OPCO — l'expiration doit être désactivable per-booking).

### Business

- **Démarrage prod possible J0** même sans DPA Stripe signé (mode 100 % manuel).
- **Résilience** : panne Stripe / DocuSeal / MailWizz = pas de blocage business.
- **Cas clients spécifiques** : OPCO, grands comptes, secteur public, dirigeants persos — tous gérables.
- **Audit trail préservé** : chaque paiement / signature / facture manuel logge le mode utilisé (`manualConfirmedBy`, `manualConfirmedAt`, etc.) pour conformité.

### UX admin

- Avantage : confort psychologique (Will sait qu'il a un plan B sur chaque automatisation).
- Inconvénient : surface admin légèrement plus dense (4 boutons supplémentaires). Mitigation : design clair, section « Actions principales » vs « Actions manuelles » (collapsible).

### Conformité

- Tous les paiements manuels conservent leur `Payment.provider` traçable.
- Tous les contrats uploadés manuellement préservent leur audit trail (`ContractDocument.history` JSONB : qui a uploadé quand).
- Toutes les factures manuelles ont un PDF stocké Hetzner (même remplie à la main) — archivage 10 ans préservé.

## Alternatives écartées

- **Tout auto V1 sans mode manuel** : démarrage prod impossible sans DPA Stripe + KYB validé (J+5 min). Rejeté.
- **Toggles globaux uniquement (pas d'override per-booking ou per-client)** : trop rigide, ne gère pas les cas grands comptes spécifiques.
- **Mode manuel = checkbox dans le formulaire visiteur** : confusion UX (le visiteur n'a pas à connaître la mécanique back-office).
- **CLI admin pour basculer les toggles** : trop barrière, Will veut un toggle visuel admin.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-06-automatisations.md` §4 (modes manuels)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.11.4 (saisie admin avant envoi), §5.1.19 (SiteSetting)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D64
- ADR 0013 (Stripe + hybride manuel), ADR 0014 (DocuSeal), ADR 0018 (validation 2 clics)
