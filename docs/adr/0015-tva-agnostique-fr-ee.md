# ADR 0015 — Architecture TVA agnostique FR vs EE

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-11-conformite-legale-v1.md` P0-4 + P0-5, `03-ARCHITECTURE-CIBLE.md` §5.8.1, `STOP-AND-ASK.md` Q2 / D15

---

## Contexte

La structure juridique d'Axion-IA n'est pas encore figée définitivement :

- **Scénario par défaut V1** : Axion-IA OÜ (Estonie), TVA EE non collectée si client UE B2B (reverse charge VAT), mention « TVA non applicable, art. 196 directive 2006/112/CE — autoliquidation par le preneur ».
- **Scénario alternatif possible** : structure FR (SAS, EURL, ou micro-entreprise), TVA FR 20 % collectée sur clients FR, reverse charge intra-UE B2B, exonération hors UE.
- **Scénario mixte futur** : holding EE + filiale FR pour facturation locale.

Si le code et les ADRs figeaient le scénario EE en dur, basculer plus tard imposerait :

- Refactor `legal.ts` (mentions légales, CGV, sous-processeurs).
- Refactor `Invoice.legalSnapshot` (template factures).
- Refactor `PricingConfig` (`vatRate` hardcodé 0%).
- Migration `Invoice` historiques (snapshot legal différent).

Will a tranché Q2 : **ne pas figer la structure juridique dans le code**. Toute mention TVA + mention légale + sous-processeurs passe par des champs configurables, alignés sur des scénarios définis dans `legal.ts:44`.

## Décision

### Architecture TVA agnostique — 3 champs configurables

#### 1. `PricingConfig.vatRate` (`Decimal(5,2)` — défaut `0.00`)

- EE par défaut : `0.00` (reverse charge).
- FR : `20.00` (taux normal) ou `5.50` / `10.00` (taux réduits le cas échéant).
- Hors UE : `0.00` (exonération art. 259-B CGI).
- **Modifiable depuis admin** `/admin/tarifs` sans déploiement.

#### 2. `PricingConfig.vatReverseCharge` (`Boolean` — défaut `true`)

- Si `true` + client B2B UE → applique automatiquement le reverse charge, ajoute la mention auto-liquidation.
- Si `false` → TVA collectée sur la facture.
- Géré dans `Invoice.legalSnapshot` au moment de l'émission (snapshot immuable).

#### 3. `PricingConfig.vatMention` (`Text` — défaut mention EE)

- Texte libre apposé sur les factures et CGV.
- Défaut EE : « TVA non applicable, art. 196 directive 2006/112/CE — autoliquidation par le preneur. Axion-IA OÜ, n° TVA EE… »
- Défaut FR : « TVA acquittée par Axion-IA SAS, n° TVA FR… »
- Multilingue : table `LegalTextTranslation` ou champ JSON `{fr: "...", en: "..."}`.

### `legal.ts:44` — scénario default = EE

Le fichier `src/content/legal.ts` ligne 44 (cf. `legal.ts` actuel) garde **EE comme scénario par défaut**. Aucune préférence FR/EE figée au-delà de ce default, qui peut être basculé via :

1. Modification `legal.ts:44` (1 ligne) + redéploiement.
2. Override DB par `SiteSetting.activeLegalScenario` (valeur `ee` | `fr` | `mixed`).

Les CGV et mentions légales lisent ce scénario actif et rendent les sections appropriées (conditionnels Markdown / MDX).

### `Invoice.legalSnapshot` — immutable

Chaque facture émise capture un **snapshot JSON** des champs légaux au moment de l'émission :

```json
{
  "scenario": "ee",
  "companyName": "Axion-IA OÜ",
  "companyAddress": "...",
  "companyRegistrationNumber": "...",
  "companyVatNumber": "EE...",
  "vatRate": 0.0,
  "vatReverseCharge": true,
  "vatMention": "TVA non applicable, art. 196 directive 2006/112/CE — ..."
}
```

Cela permet de basculer EE → FR sans impacter les factures historiques (qui restent valides juridiquement avec le snapshot capturé à l'époque).

### Hooks V2+ préservés

- **E-invoicing FR PPF/PDP** (réforme 2026-2027, §5.10.3) : sera ajouté sans casser EE.
- **VIES API** (validation TVA intracommunautaire, §5.10.4) : optionnel V1, hook prêt.
- **Multi-currency** (§5.10.5) : `PricingConfig.currency` accepte EUR par défaut + USD/GBP V2+.
- **Bascule mixte EE+FR** : holding + filiale, possible sans refactor (juste un 3e scénario `mixed`).

## Conséquences

### Techniques

- 0 hardcode de TVA dans le code applicatif (toutes les valeurs viennent de `PricingConfig`).
- Factures historiques préservées par `legalSnapshot` immuable.
- Migration `Invoice.legalSnapshot` rétroactive sur Booking V0 (cf. ADR 0020).
- Le générateur PDF `react-pdf` lit le snapshot, pas les valeurs courantes — garantit la cohérence historique.

### Business

- Will peut tester EE en V1 puis basculer FR sans refactor lourd (1 changement `legal.ts:44` + import nouveaux numéros TVA dans `PricingConfig`).
- Possibilité de servir des clients hors UE (États-Unis, Suisse, UK) sans devoir refactorer les CGV à chaque cas.
- Conformité préservée : chaque facture est juridiquement valide avec son snapshot.

### Conformité

- Snapshot immuable = preuve probante en cas de contrôle fiscal.
- Mention auto-liquidation présente si requise (art. 196 directive UE).
- E-invoicing FR PPF/PDP (réforme 2026-2027) : ajout en V2+ sans casser EE.
- Archivage 10 ans (Agent 11 P1-7) : factures stockées Hetzner Storage Box avec snapshot.

## Alternatives écartées

- **EE figé en dur dans le code** : impossible de basculer FR sans refactor 3-5 jours.
- **FR figé en dur dans le code** : même problème inverse.
- **Lib externe TVA (Stripe Tax, Avalara, TaxJar)** : payant, hors scope V1, sur-dimensionné.
- **Calcul TVA côté Stripe Checkout (`tax: { enabled: true }`)** : nécessite compte Stripe Tax activé (payant), opaque sur les overrides reverse charge spécifiques EE.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-11-conformite-legale-v1.md` P0-4 (CGV TVA-agnostique), P0-5 (mentions agnostiques)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.8.1 (CGV TVA-agnostique), §5.1.6 (Invoice), §5.1.16 (PricingConfig)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` Q2, D15
- `src/content/legal.ts` §44 (scénario default)
- ADR 0012 (matrice Q1–Q10), ADR 0016 (PricingConfig DB-managed)
