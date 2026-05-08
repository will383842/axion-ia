# SPEC — Console admin · Calendrier · Réservations · Entreprises

**Date** : 2026-05-07
**Auteur** : Will + Claude (Opus 4.7)
**Statut** : addendum au brief `Wireframes-Briefs-Axion-IA/08-Console-Admin.md` (Sprint 20)
**Sprints concernés** : 15 (Prisma) → 17 (Server actions) → 20 (UI admin)

## Contexte

Le brief 08 décrit une console admin à 14 sections incluant un calendrier basique
et une gestion d'« options 48 h ». Décisions Will 2026-05-07 :

- Le mécanisme **option 48 h disparaît** au profit d'un workflow **acompte 50 % →
  solde** : la réservation passe par 6 états distincts.
- Le calendrier doit permettre de **bloquer/libérer manuellement des dates**, des
  **plages d'indisponibilités** (vacances, déplacements perso, formations
  internes), et de **modifier ou annuler une réservation confirmée**.
- Les **entreprises** sont des entités first-class avec leur propre vue (CRM
  léger) — un même client peut revenir, on doit voir son historique complet.
- La console doit avoir « tout ce qu'il faut pour le suivi complet » — pas
  uniquement la prise de réservation.

Cette spec **complète** le brief 08 sans le contredire ; les sections existantes
(Tableau de bord, Soumissions, Contenus, Newsletter, Paiements, Paramètres,
Utilisateurs) restent inchangées.

## Workflow de réservation — 6 états

```
pending  →  framed  →  deposit_paid  →  confirmed  →  completed
                                                          │
                                                          ↓
                                                       (no-op)

   ↓ (à tout moment hors completed)

cancelled  →  refunded
```

| État           | Quand                                          | Visible publiquement ?                            | Verrouille créneau ?                  |
| -------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `pending`      | Formulaire soumis sur `/reserver`              | Non (client a juste un message « pas confirmée ») | Oui (provisoire 7 j)                  |
| `framed`       | Will a effectué le call de cadrage             | Non                                               | Oui                                   |
| `deposit_paid` | Acompte 50 % reçu (virement / CB)              | **Oui** (cell `BOOKED` avec ville/secteur/taille) | **Oui** (irrévocable sauf annulation) |
| `confirmed`    | Email final J-7 envoyé                         | Oui                                               | Oui                                   |
| `completed`    | Intervention terminée + solde reçu             | Oui (historique)                                  | — (date passée)                       |
| `cancelled`    | Annulée par client ou admin                    | Non (cell redevient libre)                        | Non                                   |
| `refunded`     | Acompte remboursé suite annulation > 7 j avant | Non                                               | Non                                   |

**Auto-transitions** :

- `pending` sans framing au bout de **7 jours** → email rappel + alerte admin Telegram
- `framed` sans acompte sous **5 jours ouvrés** → email rappel + alerte admin
- `deposit_paid` à **J-7** → email confirmation finale → `confirmed`
- `confirmed` à **J+1** (lendemain de l'intervention) → email solde + facture → maintien `confirmed` jusqu'à paiement solde puis `completed`

## 3 nouvelles routes admin (au-delà du brief 08)

| Route                                  | Rôle                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| `/[ADMIN]/reservations`                | Liste filtrable de toutes les réservations + détail booking |
| `/[ADMIN]/calendrier/indisponibilites` | Plages d'indisponibilité (vacances, blocages perso)         |
| `/[ADMIN]/entreprises`                 | Annuaire entreprises (CRM léger) + détail entreprise        |

La sidebar ACTIVITÉ devient :

```
ACTIVITÉ
  📅 Calendrier
  📋 Réservations          [⓿ 3]   ← NEW (badge nb pending+framed)
  🚫 Indisponibilités              ← NEW (sous-page calendrier)
  🏢 Entreprises                    ← NEW
  📝 Soumissions           [3]
  💳 Paiements
```

⚠️ La section « Options 48 h » du brief 08 est **supprimée** (workflow obsolète).

---

## 1. Page `/[ADMIN]/calendrier` — Vue mois enrichie

Reprend la spec brief 08 §2 mais étendue :

### Vue mois (identique brief 08)

Grid 7 colonnes, mais avec **5 états visuels** (au lieu de 3) :

| État cell                   | Style                                                           | Action admin clic                                   |
| --------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| **Disponible**              | `bg-paper border-border`                                        | Modal « Bloquer cette date »                        |
| **Réservé (deposit_paid+)** | `bg-halo-warm border-terracotta/35` + chip ville/secteur/taille | Modal « Détail booking »                            |
| **Pending/framed**          | `bg-paper border-primary/40` + indicateur ⏳                    | Modal « Détail booking » avec actions de validation |
| **Indisponible (admin)**    | `bg-mocha-soft border-mocha/20` + 🚫                            | Modal « Libérer cette date »                        |
| **Passé**                   | `text-fg-muted line-through opacity-40`                         | Modal lecture seule (historique)                    |

### Actions globales

```
[+ Bloquer une date]      [+ Plage d'indisponibilité]      [Filtres ▾]
```

| Action                      | Comportement                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| **Bloquer une date**        | Modal date + raison (vacances / formation interne / personnel / autre) → crée un `unavailability` |
| **Plage d'indisponibilité** | Redirige vers `/calendrier/indisponibilites`                                                      |
| **Filtres**                 | Type intervention · État booking · Ville · Secteur                                                |

### Modal « Détail booking »

Onglets :

1. **Récap** : date · durée · intervention · entreprise · contact · état actuel
2. **Timeline** : tous les événements (créé, framed, acompte reçu, confirmé, etc.) horodatés
3. **Paiements** : acompte (montant, date, méthode, ref) · solde · refunds éventuels
4. **Communications** : tous les emails envoyés/reçus + Telegram pings
5. **Notes internes** : textarea avec historique horodaté

### Actions sur booking (selon état)

| État courant             | Actions disponibles                                                               |
| ------------------------ | --------------------------------------------------------------------------------- |
| `pending`                | Marquer comme framed · Demander info · Annuler                                    |
| `framed`                 | Enregistrer paiement acompte · Relancer client · Annuler                          |
| `deposit_paid`           | Modifier date (avec accord client) · Modifier ville · Annuler avec remboursement  |
| `confirmed`              | Modifier date (urgence uniquement) · Annuler avec remboursement · Marquer terminé |
| `completed`              | Enregistrer paiement solde · Émettre facture finale · Demander avis               |
| `cancelled` / `refunded` | Lecture seule · Restaurer si erreur                                               |

### Modal « Bloquer cette date »

Pour les dispos. Champ obligatoire :

- **Raison** (privée) : Vacances · Formation interne · Personnel · Autre
- **Message public** (optionnel) : « Indisponible » par défaut, peut être personnalisé pour affichage tooltip

→ crée un `unavailability` lié à la date. La cell passe à l'état `Indisponible (admin)`.

---

## 2. Page `/[ADMIN]/calendrier/indisponibilites` — Plages

Vue dédiée pour gérer les périodes longues (vacances, congés, retraite, etc.)
plutôt que jour par jour.

### Liste

```
┌──────────────────────────────────────────────────────────────────┐
│ Plages d'indisponibilité                  [+ Nouvelle plage]     │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Du            │ Au          │ Raison       │ Récurrence │ A.│   │
│ │ 15 juil. 26   │ 15 août 26  │ Vacances     │ Annuelle   │ M E│   │
│ │ 24 déc. 26    │ 5 janv. 27  │ Vacances     │ Annuelle   │ M E│   │
│ │ Tous les ven. │ —           │ Pas vendredi │ Hebdo      │ M E│   │
│ └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Modal « Nouvelle plage »

| Champ                  | Type                                                          |
| ---------------------- | ------------------------------------------------------------- |
| Nom interne            | text                                                          |
| Date début             | date                                                          |
| Date fin (optionnelle) | date                                                          |
| Récurrence             | aucune · hebdo (jours sélectionnables) · annuelle (date fixe) |
| Raison (privée)        | select + commentaire libre                                    |
| Message public         | text (par défaut « Indisponible »)                            |

→ crée un ou plusieurs `unavailability` selon la récurrence. Les cells du
calendrier basculent automatiquement.

### Cas spécifique « jours non travaillés »

Si l'admin veut bloquer **tous les samedis et dimanches**, c'est une plage
récurrente hebdomadaire. Décision Will 2026-05-07 : **week-end OUVERT par
défaut**. L'admin peut le fermer via cette page si besoin (déménagement,
contrainte personnelle).

---

## 3. Page `/[ADMIN]/reservations` — Liste & détail bookings

⚠️ **Section critique** — c'est ici que se passe le suivi quotidien.

### Liste

```
┌──────────────────────────────────────────────────────────────────┐
│ Réservations                                                     │
│                                                                  │
│ Filtres : [État ▾] [Intervention ▾] [Tier Essentielle ▾]         │
│           [Mois ▾] [Recherche]                                   │
│                                                                  │
│ Compteurs : 3 pending · 2 framed · 8 deposit_paid · 4 confirmed │
│ Essentielle : 5 intimiste · 8 standard · 3 complète             │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Date    │ Entreprise   │ Format               │ Prix  │ État  ││
│ │ 8 mai   │ Cabinet X    │ Essentielle Intimist │ 490   │ pend. ││
│ │ 15 mai  │ PME Y        │ Essentielle Standard │ 790   │ fram. ││
│ │ 22 mai  │ ETI Z        │ Équipes              │ —     │ d_p.  ││
│ │ 28 mai  │ Resto W      │ Conférence ½j        │ —     │ conf. ││
│ │ 4 juin  │ Cabinet K    │ Essentielle Complèt  │ 1190  │ pend. ││
│ └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**Filtre Tier Essentielle** : permet de segmenter rapidement les ventes Essentielle par tranche (suivi commercial : quel mix Intimiste / Standard / Complète ?). Disponible uniquement quand `interventionSlug = "essentielle"` est filtré.

| Détail        | Valeur                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pagination    | 20 par page · scroll infini optionnel                                                                                       |
| Tri           | Date asc/desc · Entreprise alpha · Montant                                                                                  |
| Export CSV    | Bouton « Exporter (filtres appliqués) »                                                                                     |
| Recherche     | Email, téléphone, nom entreprise, ref booking                                                                               |
| Filtre rapide | Pills « Aujourd'hui » · « Cette semaine » · « Mois en cours » · « En attente d'action » (pending+framed sans rappel récent) |

### Détail booking (page dédiée OU modal large)

Header :

```
┌──────────────────────────────────────────────────────────────────┐
│ Réservation #BK-2026-0042                            [État: framed] │
│ Cabinet Comptable Dupont · Lyon                                  │
│ Intervention Essentielle · 22 mai 2026 · 1 jour · 1 190 € HT    │
│                                                                  │
│ [Marquer framed] [Acompte reçu] [Demander info] [Annuler]        │
└──────────────────────────────────────────────────────────────────┘
```

5 onglets :

#### Onglet Récap

- Date, durée, intervention, état actuel
- Entreprise (lien vers fiche `/entreprises/<id>`)
- Contact principal (prénom, nom, fonction, email, téléphone)
- Contexte IA déclaré (utilise IA / outils / automatisations / intérêt audit)
- Commentaires libres du client
- Adresse intervention (ville, code postal, accès, parking)

#### Onglet Timeline

Liste verticale de tous les événements horodatés :

- Création (formulaire soumis)
- Call de cadrage effectué (manuel par admin)
- Acompte reçu (manuel ou auto via webhook Stripe)
- Email envoyé (chaque email tracké : confirmation, rappel, factures)
- État changé (pending → framed → deposit_paid → confirmed → completed)
- Modifications (date changée, ville changée, intervention changée)
- Notes internes ajoutées
- Annulation, remboursement

#### Onglet Paiements

- Acompte 50 % : montant, date, méthode (virement/CB), ref Stripe ou banque, facture PDF
- Solde 50 % : idem
- Frais déplacement forfaitaires : montant, date, ref, facture
- Refunds éventuels avec motif

Boutons : `Enregistrer paiement reçu` (si manuel) · `Émettre facture` · `Refund` (avec confirmation).

#### Onglet Communications

- Tous les emails (sujets + dates + boutons « Voir » qui rouvre le HTML envoyé)
- Tous les Telegram pings émis sur ce booking
- Boutons : `Renvoyer email confirmation` · `Envoyer email custom`

#### Onglet Notes internes

- Textarea append-only avec timestamp + auteur admin
- Visible uniquement aux rôles `admin` et `editor` (pas `viewer`)

### Actions globales sur booking

| Action            | Effet                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `Marquer framed`  | Transition pending → framed + email auto au client « call effectué, attente acompte »                  |
| `Acompte reçu`    | Transition framed → deposit_paid + email confirmation + cell calendrier passe en réservée publique     |
| `Confirmer J-7`   | (Auto cron) Email final + transition deposit_paid → confirmed                                          |
| `Marquer terminé` | confirmed → completed + email demande solde + facture proforma                                         |
| `Solde reçu`      | Marque le solde payé (n'change pas l'état completed)                                                   |
| `Modifier date`   | Modal avec nouveau créneau + check anti-chevauchement + email client + Telegram admin                  |
| `Annuler`         | Choix motif privé + alerte client par email + libération créneau + déclenche refund éventuel selon CGV |
| `Restaurer`       | Sur cancelled/refunded, restaure le booking dans son ancien état                                       |

---

## 4. Page `/[ADMIN]/entreprises` — Annuaire CRM

### Liste

```
┌──────────────────────────────────────────────────────────────────┐
│ Entreprises                              [+ Nouvelle entreprise] │
│                                                                  │
│ Filtres : [Secteur ▾] [Taille ▾] [Pays ▾] [Recherche]           │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ Nom           │ Secteur  │ Taille │ Ville      │ # Bookings │
│ │ Cabinet Dupont│ Conseil  │ 10-49  │ Lyon (FR)  │ 3       Voir│
│ │ Industrie XYZ │ Industrie│ 250-999│ Bordeaux   │ 1       Voir│
│ │ Hôtels &Co    │ Hôtelier │ 50-249 │ Marseille  │ 2       Voir│
│ └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

| Détail        | Valeur                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Création auto | Une entreprise est créée automatiquement à la première réservation, basée sur les infos saisies dans le form |
| Dédoublonnage | À la soumission, fuzzy match sur (nom + ville) → propose la fiche existante au lieu de créer une duplique    |
| Recherche     | nom, ville, contact email/téléphone, secteur                                                                 |
| Tri           | Alpha · Date dernier booking · Total bookings                                                                |
| Export CSV    | Toutes les colonnes + contacts liés                                                                          |

### Détail entreprise (page dédiée)

Header :

```
┌──────────────────────────────────────────────────────────────────┐
│ Cabinet Comptable Dupont                                         │
│ Conseil · 10-49 personnes · Lyon (FR)                            │
│                                                                  │
│ 3 réservations · 1 en cours · 2 270 € total facturé              │
└──────────────────────────────────────────────────────────────────┘
```

4 onglets :

#### Onglet Profil

- Nom, alias éventuels
- Secteur (éditable)
- Taille (éditable)
- Adresse, ville, pays
- Numéro registrikood / SIREN équivalent (libre texte)
- Site web
- Tags libres (« VIP », « groupe X », « secteur prioritaire »)

#### Onglet Contacts

- Liste des personnes connues : prénom, nom, fonction, email, téléphone, last seen
- Possibilité d'ajouter / éditer / archiver des contacts manuellement
- Marquer un contact comme « principal » pour les futures comm

#### Onglet Bookings

- Tous les bookings de l'entreprise (passés, en cours, futurs)
- État + date + intervention + montant
- Lien direct vers le détail booking

#### Onglet Notes

- Append-only avec timestamp + auteur admin

### Actions

| Action            | Effet                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `Fusionner avec…` | Sélectionne une autre fiche entreprise → fusion (transfère bookings et contacts, supprime la duplique) |
| `Archiver`        | Marque inactive (pas supprimée) — disparaît des listes par défaut, reste accessible                    |
| `Restaurer`       | Sur entreprise archivée                                                                                |
| `Email custom`    | Compose un email avec template à un contact de l'entreprise                                            |

---

## 5. Modèle Prisma minimal (Sprint 15)

```prisma
model Company {
  id          String   @id @default(cuid())
  name        String
  sector      String
  size        String   // "1-9" | "10-49" | "50-249" | "250-999" | "1000+"
  city        String
  country     String   // ISO-2 (FR, BE, CH, LU, …)
  address     String?
  website     String?
  registryId  String?  // registrikood, SIREN équivalent
  tags        String[]
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  contacts  Contact[]
  bookings  Booking[]
  notes     CompanyNote[]

  @@index([name, city])
  @@index([sector])
  @@index([archivedAt])
}

model Contact {
  id        String  @id @default(cuid())
  companyId String
  company   Company @relation(fields: [companyId], references: [id])
  firstName String
  lastName  String
  role      String?
  email     String
  phone     String?
  isPrimary Boolean @default(false)
  archivedAt DateTime?
  lastSeenAt DateTime?
  createdAt  DateTime @default(now())

  bookings Booking[] @relation("BookingContact")

  @@index([email])
}

model Booking {
  id              String        @id @default(cuid())
  reference       String        @unique // "BK-2026-0042"
  companyId       String
  company         Company       @relation(fields: [companyId], references: [id])
  primaryContactId String
  primaryContact  Contact       @relation("BookingContact", fields: [primaryContactId], references: [id])
  interventionSlug String       // "essentielle" | "equipes" | "managers" | "conference" | "dirigeants"
  /** Tier Essentielle uniquement — détermine le priceEur via la table
      ESSENTIELLE_TIERS (centralisée dans content/interventions.ts).
      Null pour les 4 autres formats (1 seul tarif sur devis). */
  tier            String?       // "intimiste" | "standard" | "complete" | null
  startDate       DateTime
  durationDays    Int           // 1 | 2
  city            String        // dénormalisé pour affichage rapide calendrier public
  status          BookingStatus // enum 6 états
  priceEur        Int           // en cents (490 € = 49000) — pour Essentielle, calculé depuis tier
  depositReceivedAt DateTime?
  balanceReceivedAt DateTime?
  cancelledAt     DateTime?
  cancellationReason String?
  aiContext       Json          // {usage, tools, hasAutomations, auditInterest, comments}
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  events     BookingEvent[]
  payments   Payment[]
  emails     EmailLog[]

  @@index([startDate])
  @@index([status])
  @@index([companyId])
  @@index([interventionSlug, tier]) // pour filtre admin "Essentielle Standard"
}

enum BookingStatus {
  pending
  framed
  deposit_paid
  confirmed
  completed
  cancelled
  refunded
}

model BookingEvent {
  id         String   @id @default(cuid())
  bookingId  String
  booking    Booking  @relation(fields: [bookingId], references: [id])
  type       String   // "created" | "framed" | "deposit_paid" | "email_sent" | …
  payload    Json
  authorId   String?  // admin user qui a déclenché (null si auto)
  createdAt  DateTime @default(now())

  @@index([bookingId, createdAt])
}

model Payment {
  id          String      @id @default(cuid())
  bookingId   String
  booking     Booking     @relation(fields: [bookingId], references: [id])
  type        PaymentType // "deposit" | "balance" | "travel_fee" | "refund"
  amountEur   Int         // cents
  method      String      // "transfer" | "card" | "manual"
  externalRef String?     // Stripe ref ou ref bancaire
  invoiceUrl  String?
  receivedAt  DateTime
  createdAt   DateTime    @default(now())
}

enum PaymentType {
  deposit
  balance
  travel_fee
  refund
}

model Unavailability {
  id              String   @id @default(cuid())
  startDate       DateTime
  endDate         DateTime?
  recurrenceType  String   // "none" | "weekly" | "yearly"
  recurrenceDays  Int[]    // [0..6] pour weekly (0=lundi)
  reason          String   // "vacation" | "internal_training" | "personal" | "other"
  publicMessage   String   @default("Indisponible")
  createdAt       DateTime @default(now())
  createdById     String

  @@index([startDate, endDate])
}

model CompanyNote {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  body      String
  authorId  String
  createdAt DateTime @default(now())
}

model EmailLog {
  id          String   @id @default(cuid())
  bookingId   String?
  booking     Booking? @relation(fields: [bookingId], references: [id])
  to          String
  subject     String
  templateKey String
  htmlSnapshot String  // pour rouvrir l'email envoyé
  status      String   // "sent" | "delivered" | "bounced"
  sentAt      DateTime @default(now())

  @@index([bookingId])
}
```

## 6. Notifications Telegram (Sprint 18)

Templates de pings admin pour chaque transition :

| Événement                   | Message                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `pending` (nouveau booking) | `🔔 [BK-2026-0042] Nouvelle demande · Cabinet Dupont · Essentielle · 22 mai · ouvrir` |
| `framed`                    | `📞 [BK-2026-0042] Cadrage effectué · attente acompte 50%`                            |
| `deposit_paid`              | `✅ [BK-2026-0042] Acompte reçu (1 190 €) · créneau verrouillé`                       |
| `confirmed`                 | `📅 [BK-2026-0042] Confirmé J-7 · client notifié`                                     |
| `cancelled`                 | `❌ [BK-2026-0042] Annulé · motif: ${reason}`                                         |
| `refund_emitted`            | `💸 [BK-2026-0042] Refund émis · ${amount} €`                                         |
| `pending > 5j sans framing` | `⚠️ [BK-2026-0042] En attente depuis 5j · à rappeler`                                 |
| `framed > 3j sans acompte`  | `⚠️ [BK-2026-0042] Cadré depuis 3j · acompte non reçu`                                |

## 7. Source unique des tarifs

Pour éviter toute duplication entre frontend et backend, la grille tarifaire
Essentielle est centralisée dans **un seul endroit** :

`axionia/src/content/interventions.ts` — exports :

- `ESSENTIELLE_TIERS` : 3 lignes (intimiste 490 € / standard 790 € / complète 1190 €)
- Type `EssentielleTier = "intimiste" | "standard" | "complete"`
- Type `EssentielleTierDef` (id + labelFr/En + sizeFr/En + priceEur + isFeatured)

Ce fichier est consommé par :

- Frontend `/interventions/essentielle/page.tsx` (3 cards CTAs)
- Frontend `BookingCalendar` (sélecteur tier dans step 1)
- **Backend Sprint 17** : `createBooking` server action lit `priceEur` depuis cette source
- **Backend Sprint 20** : console admin filtre par tier en lecture

Sprint 15 doit également créer une `seed.ts` qui populate Postgres avec
les mêmes 3 tiers (table de référence ou enum DB) — toute modification
des prix passe par `content/interventions.ts` puis sed → Prisma migration.

## 8. Mises à jour cross-spec

- **Brief 08** §3 « Options 48 h » : à **supprimer** au profit de cette spec.
- **Brief 08** §4 « Soumissions » : reste pour audit + implementation + contact ;
  les bookings ont leur propre section dédiée.
- **Mapping pages 02b** : ajouter 3 routes admin (`/reservations`, `/calendrier/indisponibilites`, `/entreprises`). Total = **17 sections** au lieu de 14.
- **PROMPT-CODAGE Sprint 15** : Prisma schema doit inclure les 8 nouveaux models ci-dessus.
- **PROMPT-CODAGE Sprint 17** : Server actions pour create-booking (depuis form public) + state transitions (admin-side) + create-unavailability + merge-companies.
- **PROMPT-CODAGE Sprint 20** : UI des 3 nouvelles pages + extension de `/calendrier`.

## 9. Estimation effort

| Sprint | Sujet                                                                                        | Effort estimé |
| ------ | -------------------------------------------------------------------------------------------- | ------------- |
| 15     | 8 nouveaux models Prisma + seeders + migrations                                              | 1 j           |
| 17     | Server actions create-booking, state transitions × 7, create-unavailability, merge-companies | 1.5 j         |
| 18     | Worker BullMQ pour auto-transitions (J-7, rappels) + Telegram templates                      | 0.5 j         |
| 19     | Templates emails (8 templates × FR/EN = 16)                                                  | 1 j           |
| 20     | UI admin · 3 pages dédiées + extension calendrier · ~ 500 lignes par page                    | 3 j           |

**Total** : ~7 jours de dev (cohérent avec roadmap M8-M9).

---

## Garde-fou

Cette spec ne doit **pas être codée frontend** dans cette session — c'est du
backend (Sprint 15-20). Le travail aujourd'hui est :

1. ✅ Calendrier public (`/reserver`) avec form multi-step → **fait**
2. ✅ Submit en `console.warn [booking:submit:stub]` → **fait**
3. ✅ Spec admin complète documentée → **ce fichier**

Quand Will démarre Sprint 15, il pointe ce fichier comme cahier des charges.
