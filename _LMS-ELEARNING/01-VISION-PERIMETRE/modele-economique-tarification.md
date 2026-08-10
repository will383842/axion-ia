# Modèle économique & tarification — LMS e-learning Axion-IA

> **But du document.** Décrire **comment l'e-learning se vend, se facture et se finance**, en branchant le LMS sur l'infrastructure tarifaire et comptable **déjà existante** d'Axion-IA. Ce document décrit la **structure** (modes de vente, articulation `pricing.ts`, régime de TVA, facturation, séquencement MVP/V1) — **pas les montants** (les montants vivent dans la SSOT `pricing.ts` et la config admin, jamais en dur dans le code LMS).
>
> Respecte les ADR : auth hybride (0001), multi-tenant V2 (0002), CPF/EDOF gated (0003), **Stripe éteint au MVP** (0004), migrations additives (0008). Code cloisonné `src/server/elearning/**` (0007).
>
> **Convention de lecture :** 🟢 **EXISTANT** = à réutiliser tel quel / étendre · 🔵 **NEUF** = à construire sous `src/server/elearning/**`.

---

## 1. Principe directeur : aucune duplication de la couche prix/compta

Axion-IA possède déjà **deux mondes** complets et indépendants côté prix & facturation. Le LMS **ne crée pas un troisième monde** : il se branche sur celui qui correspond à sa nature juridique (une **action de formation**).

| Monde                                                                       | SSOT prix                                                             | Modèle facture                                                                       | TVA                                                                   | Usage                                         | Statut |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------- | ------ |
| **Prestations site** (audit, interventions, 1-to-1, implémentation, codage) | 🟢 `src/content/pricing.ts`                                           | 🟢 `Invoice` (tied `Booking`, Stripe X.1) + `src/lib/invoice-pdf.tsx`                | snapshot `vatRate`/`vatReverseCharge`                                 | Réservation `/reserver`, paiement CB/virement | LIVE   |
| **Organisme de formation (Qualiopi)**                                       | 🟢 `src/content/pricing.ts` (`FORMATION_PRICE_MATRIX`) + config admin | 🟢 `FactureFormation` (`schema.prisma:5760`) + `generateDocument` → `DocumentGenere` | 🟢 SSOT `src/server/qualiopi/legal/tva.ts` (régime `exoneration_261`) | Sessions, conventions, OPCO, 1-to-1 AFEST     | LIVE   |

**Décision structurante (cette spec).** L'e-learning est une **action de formation à distance (FOAD)**. Il s'adosse donc au **monde Organisme de formation** :

- **Prix** : nouveau bloc dans la SSOT 🟢 `pricing.ts` (cf. §3), jamais de montant en dur dans `src/server/elearning/**`.
- **Facture** : on **réutilise `FactureFormation`** (et son moteur `genererFactureCoaching`-like) plutôt que `Invoice` (lié `Booking`, hors-scope LMS). On ajoute un FK additif `elearningOrderId` (cf. §6).
- **TVA** : on **réutilise intégralement** 🟢 `src/server/qualiopi/legal/tva.ts` — le régime `exoneration_261` (art. 261-4-4° CGI) y est déjà modélisé (cf. §5).

> Pourquoi pas `Invoice` (Booking) ? Parce que `Invoice` est structurellement couplé à `Booking` (`bookingId` non-nullable, `schema.prisma:1699`) et à la numérotation `AXION-2026-NNNN` du tunnel de réservation. Le e-learning n'a pas de `Booking`. `FactureFormation` est déjà découplé (`sessionId` **et** `coachingContractId` nullable depuis le 1-to-1 AFEST) → c'est le bon point d'extension, additif.

---

## 2. Les 4 modes de vente

### 2.1 Vue d'ensemble

```
┌─ Mode A — OFFERT (participant de session) ───────── prix 0, octroi auto, pas de facture e-learning
├─ Mode B — VENTE INDIVIDUELLE (particulier/pro) ──── 1 cours, 1 apprenant, facture FactureFormation
├─ Mode C — PACK ENTREPRISE (N sièges) ────────────── 1 commande, N accès, 1 facture entreprise
└─ Mode D — ABONNEMENT (optionnel, V1+) ───────────── accès catalogue/temps, récurrent (gated)
```

Tous les modes convergent vers **un seul objet d'octroi d'accès** : l'`ElearningEnrollment` (cf. `03-DATA-MODEL/02-schema-progression-tracking.md`). C'est la **commande** (`ElearningOrder`, 🔵 §6) qui diffère selon le mode, pas l'accès lui-même.

### 2.2 Mode A — Offert aux participants d'une session 🟢+🔵

**Intention métier.** Un cours e-learning adossé à une `Formation`/`TrainingSession` (présentiel ou live) est **inclus** dans le prix de la session déjà facturée. Le e-learning = ressource amont (pré-requis) ou aval (consolidation, FOAD blended). **Aucune facture e-learning distincte** : la valeur est déjà dans la `FactureFormation` de la session.

**Mécanique.**

- Le lien existe déjà dans le data model : `ElearningCourse.formationId` → `Formation` (cf. `03-DATA-MODEL/01`).
- À la réalisation/inscription d'une session (🟢 `Enrollment`), un worker octroie automatiquement l'accès e-learning.
- **NEUF** : worker 🔵 `src/server/queue/workers/elearning-grant-worker.ts` — déclenché sur `Enrollment.statut` (ex. `confirmee`/`realisee`), crée un `ElearningEnrollment` par stagiaire pour le(s) cours liés à la `Formation`.
- `ElearningOrder` correspondant : `mode = offert`, `montantHtCents = 0`, `factureId = null`.

**Comptabilité.** Pas de produit e-learning séparé (déjà compté dans la session). Le e-learning reste **traçable** comme livrable FOAD (preuves Qualiopi Ind.11/Ind.19) mais n'a pas de ligne de chiffre d'affaires propre.

### 2.3 Mode B — Vente individuelle 🔵

**Intention métier.** Un particulier ou un pro achète **un cours** pour **lui-même** (B2C ou B2B mono-siège). C'est le mode finançable « vente directe » du MVP.

**Mécanique.**

- Prix lu dans 🟢 `pricing.ts` (cf. §3, nouveau bloc `ELEARNING_TIERS`).
- `ElearningOrder` : `mode = individuel`, `seats = 1`, `buyerEmail`, `buyerType` (`particulier` | `pro`).
- **MVP (Stripe éteint)** : statut `en_attente_paiement` → admin encaisse le virement → bouton « Marquer payé & ouvrir l'accès » (réutilise le pattern 🟢 `markInvoicePaidManuallyAction`) → octroi `ElearningEnrollment` + émission `FactureFormation`.
- **V1 (Stripe allumé)** : Checkout CB → webhook → octroi auto (cf. §7).

**Facture.** `FactureFormation` (TVA selon régime, cf. §5). Destinataire = l'acheteur (particulier sans SIRET autorisé).

### 2.4 Mode C — Pack entreprise (N sièges) 🔵

**Intention métier.** Une entreprise achète **N accès** à un (ou plusieurs) cours pour ses équipes. **Une commande, N accès, UNE facture entreprise.** C'est le mode B2B principal (OPCO-finançable). Multi-tenant cloisonné = **V2** (ADR-0002) ; au **MVP/V1**, Axion-IA ouvre et suit les accès côté console admin (import CSV).

**Mécanique.**

- Prix : `ELEARNING_TIERS` peut porter un **prix par siège** + une **grille dégressive par volume** (cf. §3.3), exprimée en structure, montants en SSOT.
- `ElearningOrder` : `mode = pack_entreprise`, `seats = N`, `clientId` → 🟢 `Client` (CRM SIRET/OPCO existant). `ElearningCourse.ownerClientId` reste **null** (catalogue global ; `ownerClientId` est réservé aux cours **réservés/privés** d'un client, pas au simple achat de sièges).
- **Provisioning des sièges** : import CSV (liste nominative) → création/rattachement 🟢 `Trainee` + `ElearningEnrollment` par personne (cf. `04-BACKEND/06-import-masse-provisioning.md`). Sièges non encore attribués = `ElearningSeat` en pool (🔵, cf. §6).
- **Financement OPCO** : `ElearningOrder.financementType` (🟢 enum `FinancementType`), `numeroDossierOpco`, `subrogation` → la `FactureFormation` est adressée à l'OPCO si subrogation (réutilise la logique de `genererFactureCoaching`).

**Facture.** UNE `FactureFormation`, destinataire = `Client` (ou OPCO si subrogation). `lignes` = `[{ designation: "Accès e-learning <cours> — N sièges", quantite: N, prixUnitaireHtCents, tauxTvaPercent? }]`.

### 2.5 Mode D — Abonnement (optionnel, V1+) 🔵 (gated)

**Intention métier.** Accès **catalogue** ou **temps** récurrent (mensuel/annuel), individuel ou entreprise. **Non prioritaire** : à n'activer que si un besoin commercial concret émerge.

**Mécanique & garde-fous.**

- `ElearningOrder.mode = abonnement` + champ `recurrence` (`mensuel` | `annuel`) + `accessExpiresAt` calculé.
- **MVP/V1 : abonnement = renouvellement manuel** (pas de prélèvement automatique : Stripe Subscriptions hors-scope tant que `STRIPE_ENABLED=false`). On modélise la structure (champ `recurrence`, `ElearningEntitlement` à durée) mais le **prélèvement récurrent CB est V2** (avec Stripe Billing).
- **Conformité FOAD** : un abonnement « catalogue illimité » brouille la notion d'**action de formation à durée définie** (D.6313-3-1 §2 exige une durée moyenne) et le **certificat de réalisation** (heures réalisées). → L'abonnement convient au **non-finançable** (auto-formation B2C) ; pour le **finançable**, on facture toujours un **parcours borné** (Mode B/C). Flag 🔵 `ELEARNING_SUBSCRIPTION_ENABLED=false` par défaut.

### 2.6 Matrice modes × propriétés

| Propriété             | A · Offert            | B · Individuel     | C · Pack entreprise                  | D · Abonnement                 |
| --------------------- | --------------------- | ------------------ | ------------------------------------ | ------------------------------ |
| `ElearningOrder.mode` | `offert`              | `individuel`       | `pack_entreprise`                    | `abonnement`                   |
| Sièges                | 1 (auto)              | 1                  | N                                    | 1..N                           |
| Prix source           | — (inclus session)    | `ELEARNING_TIERS`  | `ELEARNING_TIERS` + grille volume    | `ELEARNING_TIERS` récurrent    |
| Facture               | aucune (dans session) | `FactureFormation` | `FactureFormation` (entreprise/OPCO) | `FactureFormation` par période |
| Financement           | (session)             | direct / OPCO / FT | OPCO / direct                        | direct (rarement OPCO)         |
| Octroi                | worker auto           | manuel/CB          | import CSV                           | renouvellement                 |
| MVP ?                 | ✅                    | ✅                 | ✅                                   | ❌ (gated)                     |

---

## 3. Articulation avec `pricing.ts` (SSOT) 🟢→🔵

### 3.1 Règle d'or (déjà en vigueur dans le repo)

> _« Aucun prix hardcodé dans les pages ou copy. Tous les prix viennent de `pricing.ts`. Quand un prix change, on le modifie ICI et il se propage partout. »_ (`src/content/pricing.ts:1-10`)

Le LMS **étend** ce fichier ; il ne le contourne pas. **Aucun montant** n'apparaîtra dans `src/server/elearning/**`, ni dans les composants `src/components/elearning/**`, ni dans les pages catalogue.

### 3.2 Nouveau bloc `ELEARNING_TIERS` (additif, dans `pricing.ts`) 🔵

On suit le pattern existant `PricingTier` / `INTERVENTION_TIERS` / `FORMATION_PRICE_MATRIX`. Le type `PricingTier` (`pricing.ts:40`) est **déjà compatible** (`priceFlat`, `priceMin/Max`, `onQuote`, `recurrenceFr/En`, `durationFr/En`, `audienceSizes`).

```ts
// === E-LEARNING — accès cours asynchrones (FOAD). Ajout additif dans pricing.ts ===
// SSOT du prix d'accès e-learning. Montants HT en EUR (comme tout le fichier).
export const ELEARNING_TIERS: ReadonlyArray<PricingTier> = [
  {
    id: "elearning-acces-individuel", // Mode B — 1 cours, 1 apprenant
    labelFr: "Accès individuel",
    // priceFlat: <SSOT>,               // ← montant ici, jamais dans le LMS
    durationFr: "Accès <N> mois",
    descriptionFr: "Accès individuel à un parcours e-learning à la demande.",
    descriptionEn: "Individual on-demand access to one e-learning track.",
    audienceSizes: ["tpe", "pme"],
  },
  {
    id: "elearning-siege-entreprise", // Mode C — prix unitaire par siège
    labelFr: "Siège entreprise",
    descriptionFr: "Tarif par siège pour les packs équipe (grille dégressive par volume).",
    descriptionEn: "Per-seat price for team packs (volume discount grid).",
    audienceSizes: ["pme", "eti", "grande-entreprise"],
  },
  {
    id: "elearning-abonnement", // Mode D — récurrent (gated)
    labelFr: "Abonnement catalogue",
    recurrenceFr: "/mois",
    onQuote: true, // tant que non activé
    descriptionFr: "Accès récurrent au catalogue e-learning.",
    descriptionEn: "Recurring access to the e-learning catalog.",
    audienceSizes: ["pme", "eti"],
  },
] as const;

// Exposé dans PRICING_CATEGORIES / PRICING (additif) :
//   export const PRICING_CATEGORIES = { ...existant, elearning: ELEARNING_TIERS };
```

Helpers réutilisés **tels quels** : `getEntryTier`, `getEntryPriceEur`, `formatPrice`, `formatAmount`, `getFromLabel` (`pricing.ts:877-1015`). → CTA « À partir de … » et JSON-LD `Course.offers.price` dérivent automatiquement.

### 3.3 Grille dégressive par volume (Mode C) 🔵

Deux options, **pas de montant en dur** :

- **Option simple (recommandée MVP)** : un `priceFlat` par siège dans `elearning-siege-entreprise`, remise volume **gérée côté devis admin** (champ `remisePct` sur `ElearningOrder`, saisi manuellement). Zéro complexité tarifaire.
- **Option matricielle (V1)** : une `ELEARNING_VOLUME_MATRIX` sur le modèle de `FORMATION_PRICE_MATRIX` (`pricing.ts:1053`), p.ex. `bracket sièges → prix unitaire`. Helper `getElearningSeatPrice(courseTier, seats)`.

```ts
// V1 — grille volume (structure ; montants en SSOT)
export const ELEARNING_VOLUME_MATRIX: Record<"1-9" | "10-49" | "50+", number> = {
  "1-9": /* SSOT */ 0,
  "10-49": /* SSOT */ 0,
  "50+": /* SSOT */ 0,
};
export function getElearningSeatPriceCents(seats: number): number {
  /* lookup bracket */
}
```

### 3.4 Prix par cours vs prix global

- **MVP** : prix d'accès **par cours**. Le cours porte un pointeur de prix (pas le montant) : 🔵 `ElearningCourse.pricingTierId` (additif, nullable, ex. `"elearning-acces-individuel"`) + éventuel `priceOverrideCents` (nullable) pour un cours premium. Le **montant** reste résolu via `pricing.ts`.
- **Cohérence Qualiopi** : pour un cours **adossé à une `Formation`** vendue aussi en présentiel, le prix e-learning peut différer du présentiel (FOAD ≠ présentiel). Les deux restent dans la SSOT, séparés (`FORMATION_PRICE_MATRIX` pour le présentiel, `ELEARNING_TIERS` pour la FOAD).

### 3.5 V2 — `pricing.ts` devient une vue Prisma

Le fichier annonce déjà sa migration V2 vers une table alimentée par `/admin/pricing` (`pricing.ts:8-10`). Le bloc `ELEARNING_TIERS` suivra **sans casse** : l'API publique (types + helpers) reste stable. → ne pas anticiper, juste respecter les signatures.

---

## 4. Résolution de prix : chaîne d'appel (NEUF) 🔵

Service unique, pur, testable (pattern `tva.ts`/`pricing-resolver.ts`) :

```
src/server/elearning/pricing/elearning-pricing.ts   🔵
  └─ resolveElearningPrice({ courseId, mode, seats, remisePct? })
       → lit ElearningCourse.pricingTierId
       → getTierById(ELEARNING_TIERS, tierId)         // 🟢 helper existant
       → mode pack_entreprise : seats × prixSiège (× grille volume) − remise
       → retourne { totalHtCents, lignes[] }          // lignes = format FactureFormation
```

- **Entrée unique** de tout calcul de prix e-learning → aucune dispersion.
- Sortie = `lignes[]` au **format `LigneFacturable`** de 🟢 `tva.ts:76` (`{ quantite, prixUnitaireHtCents, tauxTvaPercent? }`) → branchement direct sur `computeTotauxFacture` (§5).
- Stub-aware (early-return si `stub.invalid`) comme tout le code DB-dependent.

---

## 5. TVA formation — exonération 261-4-4° CGI 🟢 (réutilisation totale)

### 5.1 La SSOT existe déjà : `src/server/qualiopi/legal/tva.ts`

Le LMS **n'écrit aucune logique TVA neuve**. Tout est dans 🟢 `tva.ts` :

- `RegimeTva = "assujetti" | "exoneration_261" | "franchise_293b"` (`tva.ts:28`).
- **`exoneration_261`** = exonération « formation professionnelle continue », **art. 261-4-4° CGI** (`tva.ts:11-15`, `REGIME_TVA_LABELS`). ⚠️ Le commentaire SSOT rappelle : **Qualiopi n'exonère PAS** ; l'exonération **nécessite l'attestation DREETS (Cerfa 3511) + NDA + BPF à jour**. Couvre **uniquement** les actions de FPC.
- `computeTotauxFacture(lignes, regime, tauxStandard)` (`tva.ts:102`) → ventilation HT/TVA/TTC par taux.
- `mentionTva(regime)` (`tva.ts:153`) → mention légale (« TVA non applicable, art. 261-4-4° du CGI » via `LEGAL_MENTIONS.factureExonerationTva`).
- Régime courant lu via 🟢 `getQualiopiConfig("regime_tva")` (config admin, évolutif) + `taux_tva_standard_percent`.

### 5.2 Application au e-learning

L'e-learning **est une action de formation** : si l'OF est en régime `exoneration_261`, **l'accès e-learning finançable est exonéré** au même titre que le présentiel. La FOAD ne change rien au régime (le **financeur** OPCO/CPF ne change pas la TVA — `tva.ts:10-11`).

**Cas mixtes (facture mixte).** Si un `ElearningOrder` mêle de la FPC exonérée et une prestation **non-FPC** (ex. licence logicielle, accès « loisir » non-certifiant, conseil), la ligne non-FPC porte un `tauxTvaPercent: 20` explicite (override par ligne, déjà géré `tva.ts:59-74`). Le e-learning **non-finançable / non-FPC** (B2C loisir) peut donc être **à 20 %** sur la même facture qu'une ligne FPC à 0 %. → La distinction se fait **par ligne**, pas par facture.

**Snapshot.** Comme `FactureFormation` (`schema.prisma:5782` `regimeTva` + `tvaExoneree`), la facture e-learning **fige** son régime à l'émission. Un changement de régime futur n'affecte que les nouvelles factures.

### 5.3 Ce qui est NEUF côté TVA : **rien de calculatoire**

Seul travail : **brancher** `resolveElearningPrice` (§4) sur `computeTotauxFacture` et passer `regimeTva` + `tauxStandard` lus de la config. Aucun nouveau taux, aucune nouvelle mention.

---

## 6. Facturation — réutiliser `FactureFormation` + nouvel `ElearningOrder` 🟢+🔵

### 6.1 `ElearningOrder` (NEUF) — l'objet « commande » 🔵

Manque dans le data model : la **commande** qui matérialise la vente (les 4 modes) et porte le lien vers la facture. À spécifier en détail dans `03-DATA-MODEL/05-schema-ecommerce-commandes.md` ; structure cible :

```prisma
enum ElearningOrderMode {
  offert            // Mode A — inclus session
  individuel        // Mode B
  pack_entreprise   // Mode C
  abonnement        // Mode D (gated)
}

enum ElearningOrderStatut {
  brouillon
  en_attente_paiement   // MVP virement
  payee                 // virement reçu OU CB confirmée
  acces_octroye         // ElearningEnrollment(s) créés
  annulee
  remboursee
}

model ElearningOrder {
  id            String   @id @default(uuid()) @db.Uuid
  mode          ElearningOrderMode
  statut        ElearningOrderStatut @default(brouillon)

  courseId      String?  @map("course_id") @db.Uuid     // null si abonnement catalogue
  course        ElearningCourse? @relation(fields: [courseId], references: [id], onDelete: SetNull)

  // Acheteur : particulier OU entreprise (CRM existant)
  buyerEmail    String?  @map("buyer_email") @db.Citext
  buyerType     String?  @map("buyer_type") @db.VarChar(20)   // particulier | pro
  clientId      String?  @map("client_id") @db.Uuid           // 🟢 Client CRM (Mode C)
  client        Client?  @relation(fields: [clientId], references: [id], onDelete: SetNull)

  seats         Int      @default(1)
  remisePct     Int?     @map("remise_pct")                   // remise volume manuelle (MVP)

  // Prix figé à la commande (résolu via pricing.ts → resolveElearningPrice)
  montantHtCents Int     @default(0) @map("montant_ht_cents")

  // Financement (🟢 enums existants réutilisés)
  financementType   FinancementType? @map("financement_type")
  numeroDossierOpco String?          @map("numero_dossier_opco") @db.VarChar(60)
  subrogation       Boolean          @default(false)

  // Paiement MVP virement vs futur Stripe
  paymentMode   String?  @map("payment_mode") @db.VarChar(30) // virement | cb | manuel
  paidAt        DateTime? @map("paid_at")

  // Lien facture (réutilise FactureFormation — voir 6.2)
  factureFormationId String? @map("facture_formation_id") @db.Uuid

  // Abonnement (Mode D)
  recurrence       String?   @map("recurrence") @db.VarChar(10)   // mensuel | annuel
  accessExpiresAt  DateTime? @map("access_expires_at")

  seats_pool    ElearningSeat[]        // sièges non encore attribués (Mode C)
  enrollments   ElearningEnrollment[]  // accès octroyés

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([statut])
  @@index([clientId])
  @@index([courseId])
  @@map("elearning_orders")
}

// Pool de sièges entreprise non encore nominatifs (Mode C, provisioning différé)
model ElearningSeat {
  id        String   @id @default(uuid()) @db.Uuid
  orderId   String   @map("order_id") @db.Uuid
  order     ElearningOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  traineeId String?  @map("trainee_id") @db.Uuid   // null = siège libre
  assignedAt DateTime? @map("assigned_at")
  @@index([orderId])
  @@map("elearning_seats")
}
```

> **Réutilisation enums :** `FinancementType` et `FactureFormationDestinataire` existent déjà (`schema.prisma`). On NE crée PAS de doublon.

### 6.2 Facture : extension additive de `FactureFormation` 🟢→🔵

`FactureFormation` (`schema.prisma:5760`) sait déjà facturer **sans `TrainingSession`** (`sessionId` nullable depuis le 1-to-1 AFEST). On ajoute **un seul FK additif nullable** :

```prisma
// model FactureFormation { ... }  (ADD COLUMN nullable — additif, ADR-0008)
  elearningOrderId String? @map("elearning_order_id") @db.Uuid
  elearningOrder   ElearningOrder? @relation(fields: [elearningOrderId], references: [id], onDelete: SetNull)
  @@index([elearningOrderId])
```

Tout le reste est **déjà là** : `destinataire`/`destinataireNom`/`Siret`/`Adresse`, `montantHtCents`, `regimeTva`, `montantTvaCents`, `montantTtcCents`, `lignes` (JSON), `subrogation`, `numeroDossierOpco`, `montantAideFranceTravailCents`, `statut`, `documentId`, `emiseAt`/`echeanceAt`.

### 6.3 Moteur de génération (NEUF, calqué sur `genererFactureCoaching`) 🔵

```
src/server/elearning/billing/generer-facture-elearning.ts   🔵
```

Copie quasi-conforme de 🟢 `src/server/qualiopi/coaching-afest/facturation-1to1.ts` :

1. `assertOrganismeComplet(identite, "facture")` 🟢 (garde-fou : pas de facture si identité OF incomplète).
2. `resolveElearningPrice(order)` (§4) → `lignes[]`.
3. `getQualiopiConfig("regime_tva")` + `computeTotauxFacture` 🟢 → ventilation TVA.
4. Numérotation atomique `formatDocumentNumber("facture", annee, n)` 🟢 (boucle anti-collision P2002, `MAX_ATTEMPTS=5`).
5. `generateDocument({ type: "facture", buildElement: FacturePdf })` 🟢 → PDF + `DocumentGenere` (archivage 10 ans).
6. `prisma.factureFormation.create({ ..., elearningOrderId })` + mise à jour `ElearningOrder.factureFormationId`.
7. Stub-aware (early-return `stub.invalid`).

→ **Réutilise le même template PDF** `FacturePdf` (`src/server/qualiopi/documents/templates/facture.tsx`), conforme art. 242 nonies A / L441-9 / D441-5, mention TVA via `regimeTva`. Aucun template neuf.

### 6.4 Certificat de réalisation ≠ facture

Important pour la conformité : la **facture** prouve la transaction ; le **certificat de réalisation** (modèle officiel, heures réalisées, obligatoire depuis 01/06/2020) prouve le **service fait**. Le certificat e-learning réutilise 🟢 `DocumentGenere` + QR (cf. `05-FRONTEND-APPRENANT/06-certificats-badges.md`). Les heures réalisées viennent du **tracking** (`LessonProgress`/temps serveur), pas de la commande.

---

## 7. MVP virement vs futur Stripe 🟢 (flag déjà en place)

### 7.1 État du flag

🟢 `isStripeConfigured()` (`src/lib/stripe.ts:72`) = `STRIPE_ENABLED === "true" && STRIPE_SECRET_KEY présent`. **Aujourd'hui `false`** (ADR-0004 ; bascule SAS française). Tout le code Stripe (`Invoice`/`Payment`/`Refund`/webhook/`StripeWebhookEvent`) existe mais dort.

### 7.2 MVP — virement + octroi manuel (Stripe éteint)

Flux **sans CB** :

```
1. Admin/visiteur crée ElearningOrder (mode B/C) → statut en_attente_paiement
2. genererFactureElearning() → FactureFormation (statut émise) + PDF + RIB
3. Client vire → admin clique « Marquer payé »  (pattern 🟢 markInvoicePaidManuallyAction)
   → ElearningOrder.statut = payee, paymentMode = "virement", paidAt
4. Worker elearning-grant-worker → ElearningEnrollment(s) + email magic-link (🟢 PortailAcces)
   → ElearningOrder.statut = acces_octroye
```

- **Octroi manuel 1-clic** (Mode B individuel) : action admin « Ouvrir l'accès » qui court-circuite le paiement (ex. accès offert, geste commercial) → `mode = individuel`/`offert`, pas de facture ou facture à 0.
- **Import masse** (Mode C) : CSV → pool `ElearningSeat` → octroi par lot (cf. `04-BACKEND/06`).

### 7.3 V1+ — Stripe allumé (sans refonte)

Le jour où Will a un compte Stripe : `STRIPE_ENABLED=true` + clés → Checkout CB pour Modes B/C :

```
ElearningOrder (en_attente_paiement) → Stripe Checkout → webhook checkout.session.completed
  → 🟢 StripeWebhookEvent (idempotence event.id) → ElearningOrder.statut = payee, paymentMode = "cb"
  → même worker elearning-grant-worker → octroi
```

- **Réutilisation** : singleton `getStripe()`, `STRIPE_API_VERSION` figée, `getWebhookSecret()`, table `StripeWebhookEvent` (idempotence). On ajoute un **handler e-learning** au route handler webhook existant (discriminé par metadata `elearningOrderId`).
- **Pas de `Payment`/`Booking`** pour l'e-learning : on **ne réutilise pas** le modèle `Payment` (couplé `bookingId`). L'état de paiement e-learning vit sur `ElearningOrder` (`statut`/`paymentMode`/`paidAt`) — plus simple et découplé. (Si un échéancier devient nécessaire, on l'ajoutera en V2 sans casser.)
- **Abonnement récurrent (Mode D)** : Stripe Billing/Subscriptions = **V2** (gated `ELEARNING_SUBSCRIPTION_ENABLED`).

### 7.4 Garde-fous de cohérence

- **Un seul chemin d'octroi** : tous les modes/paiements convergent vers `elearning-grant-worker` (jamais d'octroi dispersé).
- **Un seul chemin de facture** : `genererFactureElearning` (jamais de `factureFormation.create` ad hoc ailleurs).
- **Un seul chemin de prix** : `resolveElearningPrice` → `pricing.ts` (jamais de montant en dur).
- **Stub-aware** partout (build `stub.invalid`).
- **Migrations additives** : `ElearningOrder`/`ElearningSeat` = CREATE TABLE ; `FactureFormation.elearningOrderId` = ADD COLUMN nullable.

---

## 8. Financements (rappel structurel) 🟢

Le e-learning FOAD est **finançable dès le MVP** (OPCO + entreprise + vente directe), **hors CPF** (ADR-0003 : CPF exige une certification RNCP/RS, gated `EDOF_ENABLED`). Réutilisation directe :

| Financeur                     | Mécanique réutilisée                                                                                      | Statut |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| **Direct** (B2C/B2B)          | `ElearningOrder` → `FactureFormation` au client                                                           | MVP    |
| **OPCO**                      | `financementType` + `subrogation` + `numeroDossierOpco` → facture OPCO (logique `genererFactureCoaching`) | MVP    |
| **France Travail** (AIF/POEI) | `montantAideFranceTravailCents` 🟢 sur `FactureFormation`                                                 | MVP    |
| **CPF / EDOF**                | gated `EDOF_ENABLED` (entrée effective, service fait, FranceConnect+)                                     | V2     |

> Côté **OPCO**, pour payer : facture + relevé de dépenses + certificat de réalisation. La plateforme produit les trois (facture §6, certificat §6.4, preuves FOAD cf. `08-CONFORMITE`).

---

## 9. Console admin — où ça vit 🟢+🔵

- Nav : nouvelle section sous 🟢 `admin-nav.ts` (sidebar montée = `AdminSidebarNav.tsx`), pôle « E-learning » → sous-entrées « Commandes & accès », « Catalogue/prix », « Factures e-learning ».
- Pages 🔵 sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**` (RBAC 🟢 `requireAdminRead/Write/Publish`).
- Composants 🔵 `src/components/admin/elearning/**` (réutilisent `AdminPageShell`, `AdminTable`, `AdminBadge`, `StatCard`).
- Détail commandes/accès : `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md`.

---

## 10. Récap EXISTANT vs NEUF (économique)

| Brique                                                  | Statut                                           | Référence                                 |
| ------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| SSOT prix `pricing.ts` + helpers                        | 🟢 réutilisé / 🔵 bloc `ELEARNING_TIERS` additif | `src/content/pricing.ts`                  |
| SSOT TVA `tva.ts` (exo 261-4-4°)                        | 🟢 réutilisé tel quel                            | `src/server/qualiopi/legal/tva.ts`        |
| `FactureFormation` (facture OF)                         | 🟢 réutilisé + FK `elearningOrderId` additif     | `schema.prisma:5760`                      |
| Template PDF `FacturePdf`                               | 🟢 réutilisé                                     | `.../documents/templates/facture.tsx`     |
| Numérotation atomique facture                           | 🟢 réutilisé                                     | `formatDocumentNumber`                    |
| `DocumentGenere` + QR (archivage 10 ans)                | 🟢 réutilisé                                     | `schema.prisma`                           |
| Flag Stripe + singleton + webhook                       | 🟢 réutilisé (éteint MVP)                        | `src/lib/stripe.ts`, `StripeWebhookEvent` |
| Enums `FinancementType`, `FactureFormationDestinataire` | 🟢 réutilisés                                    | `schema.prisma`                           |
| Client CRM (SIRET/OPCO)                                 | 🟢 réutilisé (Mode C)                            | `schema.prisma:4890`                      |
| `ElearningOrder` + `ElearningSeat`                      | 🔵 neuf                                          | `03-DATA-MODEL/05-*`                      |
| `resolveElearningPrice` (résolution prix)               | 🔵 neuf                                          | `src/server/elearning/pricing/`           |
| `genererFactureElearning`                               | 🔵 neuf (calqué `genererFactureCoaching`)        | `src/server/elearning/billing/`           |
| `elearning-grant-worker` (octroi unifié)                | 🔵 neuf                                          | `src/server/queue/workers/`               |
| Section admin e-learning (commandes/factures)           | 🔵 neuf                                          | `.../(admin)/[adminPrefix]/elearning/**`  |

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0002 (multi-tenant V2), ADR-0003 (CPF gated), ADR-0004 (Stripe éteint), ADR-0008 (migrations additives)
- `01-VISION-PERIMETRE/perimetre-mvp-v1-v2.md` — ce qui est dans chaque phase
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse.formationId`/`ownerClientId`/`pricingTierId`
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (objet d'octroi), heures réalisées (certificat)
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — détail `ElearningOrder` / `ElearningSeat` / FK `FactureFormation`
- `03-DATA-MODEL/06-strategie-migrations.md` — additivité des migrations économiques
- `04-BACKEND/06-import-masse-provisioning.md` — provisioning des sièges (Mode C)
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — UI commandes/accès/factures
- `08-CONFORMITE/03-cpf-edof-readiness.md` — pourquoi le CPF est en V2
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — facture + certificat + preuves OPCO
- SSOT code : `src/content/pricing.ts` · `src/server/qualiopi/legal/tva.ts` · `src/server/qualiopi/coaching-afest/facturation-1to1.ts` · `src/lib/stripe.ts`
