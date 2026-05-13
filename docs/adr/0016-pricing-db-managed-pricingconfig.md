# ADR 0016 — Pricing DB-managed via table `PricingConfig`

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `03-ARCHITECTURE-CIBLE.md` §5.1.16 + §5.12, `STOP-AND-ASK.md` D35 / D38, mémoire `axionia_pricing_zero_hardcode_2026-05-08`

---

## Contexte

L'historique tarifaire AxionIA est passé par 3 stades :

1. **Pré-Sprint 14.10.2** : tarifs hardcodés dans ~30 fichiers (TSX, MDX, copy). Casse à chaque changement de prix.
2. **Sprint 14.10.2 → 14.10.5** : centralisation dans `src/content/pricing.ts` (SSOT TypeScript). 30 fichiers migrés. ADR 0008 + ADR 0011 actent l'architecture. Mémoire `axionia_pricing_zero_hardcode_2026-05-08` documente la doctrine « jamais hardcoder un montant ».
3. **Sprint 14.10.5+** : 8 helpers (`formatAmount`, `getEntryLabel`...), 96/96 tests verts, typecheck OK.

Le booking V1 introduit 5 nouveaux paramètres tarifaires variables :

- **Acompte %** par profil d'échéancier (D40, ADR 0012 Q10).
- **Délais d'expiration** (D52, ADR 0018).
- **Frais accessoires** par zone géographique (D38, §5.13).
- **TVA scénario actif** (ADR 0015).
- **Cap multi-options simultanées** (D34, ADR 0017).

Ces valeurs doivent être **modifiables sans déploiement** depuis l'admin (`/admin/tarifs`). Un fichier TS recompilé à chaque changement (`pricing.ts`) ne tient plus l'usage. Cas d'usage : Will baisse l'acompte de 30 % à 25 % un soir → doit pouvoir le faire en 30 s, pas en 5 min de déploiement Coolify.

## Décision

### Migration partielle : `pricing.ts` (code) → `PricingConfig` (DB) pour la partie variable

#### 1. SSOT déplacée code → DB pour la partie variable

La table Prisma `PricingConfig` devient la **source de vérité runtime** pour :

- Montants en euros (`amountCents` Decimal).
- Pourcentages d'acompte (`depositPercent`).
- Taux TVA (`vatRate`, `vatReverseCharge`, `vatMention`) — ADR 0015.
- Délais (`optionExpirationDays`, `contractCutoffDays`).
- Caps numériques (`maxConcurrentOptions`).
- Frais accessoires (mode + zones, JSON).
- Échéanciers par défaut (`PaymentScheduleProfile` joint).

Schema cible (cf. `03-ARCHITECTURE-CIBLE.md` §5.1.16) — extrait :

```prisma
model PricingConfig {
  id                          String   @id @default(cuid())
  key                         String   @unique  // ex: "essentielle.1j.standard"
  amountCents                 Int
  currency                    String   @default("EUR")
  vatRate                     Decimal  @default(0)  @db.Decimal(5, 2)
  vatReverseCharge            Boolean  @default(true)
  vatMention                  String?
  depositPercent              Decimal? @db.Decimal(5, 2)
  paymentScheduleProfileId    String?
  feesMode                    String?  // "real_costs" | "flat_rate_by_zone" | "included"
  feesByZone                  Json?    // {zone1: 50000, zone2: 80000, ...}
  notes                       String?
  updatedAt                   DateTime @updatedAt
  updatedBy                   String?
}
```

#### 2. SSOT code conservée pour la partie structurale

Ce qui reste dans `pricing.ts` (code) :

- **Enum types** (`PricingTier`, `InterventionFormat`, etc.) — TypeScript-safe.
- **Mapping interventions** (key → format → tier) — relié à `interventions-taxonomy.ts`.
- **Helpers de formatage** (`formatAmount`, `getEntryLabel`, etc.) — purs, sans I/O.
- **Mentions canoniques** (`INTERVENTION_FEES_NOTE`) — texte légal stable.

Le helper `pricing.ts` change de signature :

```ts
// Avant
export function getPrice(key: PricingKey): { amount: number; currency: string } { ... }

// Après
export async function getPrice(key: PricingKey): Promise<PricingSnapshot> {
  return await db.pricingConfig.findUniqueOrThrow({ where: { key } });
}
```

Les pages publiques (`/interventions/*`, `/reserver`, `/contact`) lisent désormais en DB via cache Redis (`pricing:{key}` TTL 60s) pour éviter de surcharger la DB à chaque rendering.

#### 3. Revalidation automatique pages publiques

Quand l'admin modifie un prix via `/admin/tarifs` :

1. Server Action `updatePricingConfig(key, amountCents)` valide + persiste.
2. Invalidation cache Redis (`pricing:*`).
3. `revalidatePath('/interventions', 'layout')` + `revalidatePath('/reserver', 'layout')` + revalidation routes pSEO concernées.
4. Toast admin « Tarifs mis à jour, propagation en cours (~30s) ».

#### 4. Audit log

Chaque modification logge dans `PricingConfigHistory` :

- Snapshot avant / après (JSONB diff).
- userId admin.
- Timestamp.
- Raison (champ texte optionnel).

Hook V2+ : workflow d'approbation 2-eyes pour modifications > 1000 € (§5.10.8).

#### 5. Seed initial

L'install V1 seed `PricingConfig` à partir des valeurs actuelles de `pricing.ts` (Sprint X.1 livrable). Workflow :

- Script `scripts/seed-pricing-from-code.ts` lit `pricing.ts` + insère dans `PricingConfig`.
- Idempotent (UPSERT par `key`).
- Exécuté 1 fois en prod après migration Prisma.

## Conséquences

### Techniques

- 1 table Prisma nouvelle (`PricingConfig`) + 1 table d'audit (`PricingConfigHistory`).
- Helpers `pricing.ts` deviennent async — refactor TBD Sprint X.1.
- Cache Redis nécessaire pour perf (TTL 60s).
- Revalidation incrementale Next 16 sur pages publiques (cf. budget Web Vitals : `revalidatePath` ne casse pas LCP — tests Sprint X.10).
- 0 hardcode tarifaire restant dans le code (sauf `pricing.ts` qui devient un thin wrapper async).

### Business

- Will peut modifier un prix en 30 s sans deploy.
- Auditabilité totale (qui a changé quoi, quand, pourquoi).
- Préparation V2 admin DB-managed taxonomie (`/admin/catalog`, cf. ADR 0011 §V2).

### Conformité

- Snapshot prix immuable capturé dans `Invoice.legalSnapshot` + `Quote.pricingSnapshot` à l'émission → factures et devis historiques préservés même si Will modifie le tarif courant ultérieurement.
- Auditabilité prix : `PricingConfigHistory` permet de prouver le prix affiché à un instant T (utile en cas de litige client).

## Alternatives écartées

- **Tout en code (`pricing.ts` figé)** : régression vs Sprint 14.10.5, impossible de modifier sans deploy.
- **Tout en DB (suppression complète `pricing.ts`)** : perte de typage TypeScript-safe sur les enums (catastrophique pour le DX).
- **Fichier JSON statique en filesystem** (`pricing.json` lu à chaud) : fragile, pas d'audit log, pas de transactions.
- **Stripe Products API** (créer un Product Stripe par tier) : couplage fort à Stripe, latence API à chaque page render, hors scope.
- **CMS externe (Sanity, Strapi)** : sur-dimensionné, latence accrue, redondant avec admin AxionIA.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.1.16 (PricingConfig), §5.12 (Pricing dynamique workflow), §5.13 (Frais accessoires), §5.14 (Échéanciers)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D35, D38
- `src/content/pricing.ts` (SSOT code historique — devient thin wrapper async)
- Mémoire : `axionia_pricing_centralization`, `axionia_pricing_zero_hardcode_2026-05-08`
- ADR 0015 (TVA agnostique), ADR 0017 (cap multi-options)
