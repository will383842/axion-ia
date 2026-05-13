# ADR 0020 — Migration data V0 → V1 (script obligatoire Sprint X.4)

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `03-ARCHITECTURE-CIBLE.md` §5.18, `STOP-AND-ASK.md` D63

---

## Contexte

L'admin AxionIA V0 (M9 actuel, déployé prod 2026-05-09) gère déjà des `Booking` avec une enum simple :

```prisma
// V0 actuel
enum BookingStatus {
  pending
  confirmed
  cancelled
  postponed
}
```

V1 Booking introduit une enum étendue (~23 valeurs effectives, cf. `03-ARCHITECTURE-CIBLE.md` §5.5.1) :

```prisma
// V1 cible
enum BookingStatus {
  draft
  option_pending
  contract_payment_sent
  awaiting_admin_validation   // D51
  confirmed
  paid_deposit
  paid_invoice_1
  paid_invoice_2
  paid_in_full
  delivered
  invoice_final_sent
  closed
  cancelled_by_client
  cancelled_by_admin
  postponed
  paused                       // D61
  refunded
  lost_other_won
  expired_no_action
  expired_no_payment
  // ... et plus
}
```

Sans script de migration :

- Les Bookings V0 `confirmed` (passés) n'auraient ni `Payment` ni `Invoice` rétroactifs → broken dans les vues `/admin/paiements` et `/admin/factures`.
- Les Bookings V0 `pending` (futurs) n'auraient pas de cohérence avec la state machine V1.
- Les exports RGPD `/api/gdpr-export` casseraient sur ces lignes.
- Les sauvegardes pré-V1 perdraient leur signification (snapshot legal non capturé).

Will a tranché D63 : **migration obligatoire** dans Sprint X.4, livrable bloquant pour le déploiement V1 en prod.

## Décision

### Script `scripts/migrate-bookings-v0-to-v1.ts` — idempotent

#### Périmètre

- Tous les Bookings V0 existants en prod.
- Crée des `Payment` rétroactifs marqués `historical=true` pour les bookings V0 `confirmed`.
- Crée des `Invoice` rétroactives pour les bookings V0 `confirmed` (avec `legalSnapshot` reconstitué).
- Préserve les Bookings V0 `cancelled` et `postponed` (mapping direct).
- Ne touche pas les Bookings futurs créés via V1 (filtre par `createdAt < deploymentDate`).

#### Mapping V0 → V1 (cf. §5.18.2)

| V0 status   | V1 status (mapping)          | Effets additionnels                                                                                                                                                  |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`   | `option_pending`             | Pas de paiement créé. Statut éphémère, sera mis à jour selon timing.                                                                                                 |
| `confirmed` | `paid_in_full` (présomption) | Crée `Payment(provider='manual_wire', status='succeeded', historical=true)`. Crée `Invoice(status='paid', legalSnapshot=reconstructedFromLegalTs, historical=true)`. |
| `cancelled` | `cancelled_by_admin`         | Pas de paiement créé.                                                                                                                                                |
| `postponed` | `postponed`                  | Pas de paiement créé. Slot conservé.                                                                                                                                 |

#### Garanties

1. **Idempotent** : exécuter le script 2 fois ne crée pas de doublons. Check `Payment.bookingId + Payment.historical=true` → si existe, skip.
2. **Dry-run mode** : option `--dry-run` affiche les modifs sans toucher la DB. Utilisé pour validation Will.
3. **Test snapshot dev avant prod** : Will exécute d'abord sur snapshot Hetzner restauré en dev, audit le diff, puis exécute en prod.
4. **Backup avant exécution** : Coolify snapshot DB Postgres pris automatiquement avant.
5. **Audit log** : chaque création `Payment/Invoice historique` logge dans `BookingTransition(type='historical_migration', migratedAt=now())`.
6. **Reversible** : table dédiée `MigrationV0ToV1Log` capture les bookingId modifiés. Script `rollback-bookings-v0-to-v1.ts` (livré dans Sprint X.4 aussi) permet de revenir en arrière.

#### Reconstruction `legalSnapshot` historique

Les factures historiques (V0 confirmed) n'avaient pas de snapshot legal capturé. Le script :

1. Lit `legal.ts:44` au moment de l'exécution (scénario actif V1).
2. Capture en `Invoice.legalSnapshot` avec mention `reconstructed=true`.
3. Note dans `Invoice.notes` : « Snapshot legal reconstruit lors de la migration V0→V1 le YYYY-MM-DD ».

Limitation : si Will a changé de structure juridique entre la date du booking V0 et la migration, le snapshot reconstruit ne reflète pas le scénario en vigueur à l'époque. Mitigation : Will peut éditer manuellement le snapshot post-migration via `/admin/factures/:id` (champ JSONB éditable).

#### Effort estimé (§5.18.4)

- Développement : 1 jour (`migrate-bookings-v0-to-v1.ts` + `rollback-bookings-v0-to-v1.ts` + tests unitaires).
- Test dev snapshot : 0.5 jour (Will + Claude review du dry-run).
- Exécution prod : 0.5 jour (Coolify maintenance window 30 min, monitoring 4 h post-deploy).
- **Total Sprint X.4 : 2 jours** (incl. dans les 4 j du Sprint X.4 state machine).

### Inclusion dans Sprint X.4 — livrable obligatoire

Le Sprint X.4 (State machine deposit-validation gated, 4 j) inclut **obligatoirement** :

1. Implémentation de la state machine V1 (transitions + guards).
2. Migration des `Booking` V0 → V1.
3. Migration des indexes Prisma (cf. §5.1.21).
4. Tests E2E sur snapshot dev de prod.

Aucun déploiement V1 prod sans validation Will du dry-run en dev.

## Conséquences

### Techniques

- 2 scripts TS nouveaux (~300 lignes chacun) dans `scripts/`.
- 1 table d'audit nouvelle (`MigrationV0ToV1Log`, ~7 colonnes).
- Migration Prisma `add_v1_columns_and_indexes.sql` accompagnée par script.
- Tests unitaires obligatoires (cover 4 V0 statuts × idempotence × rollback = 12 cas minimum).

### Business

- Continuité totale des données : Will n'a pas à ressaisir les bookings passés.
- Vues `/admin/paiements` et `/admin/factures` fonctionnent immédiatement post-V1 (avec les bookings V0 visibles avec mention « historique »).
- Audit trail préservé pour conformité (RGPD, archivage 10 ans).

### Conformité

- Factures historiques reconstituées avec `legalSnapshot` cohérent (même reconstruit a posteriori).
- Auditabilité totale via `MigrationV0ToV1Log` et `BookingTransition(type='historical_migration')`.
- Rollback possible 30 j post-déploiement (suffisant pour détecter régressions).

### Risques mitigés

- **Risque** : script échoue à mi-chemin → état incohérent. Mitigation : exécution dans une transaction Prisma `$transaction(...)` complète ; rollback auto si erreur.
- **Risque** : double exécution en prod → doublons. Mitigation : check idempotence par `Payment.historical=true + bookingId`.
- **Risque** : suppression accidentelle d'un Booking V0. Mitigation : aucune `DELETE` dans le script — uniquement `UPDATE` + `INSERT`.
- **Risque** : Will change d'avis post-migration. Mitigation : script `rollback-bookings-v0-to-v1.ts` valide 30 j.

## Alternatives écartées

- **Pas de migration (suppression des Bookings V0)** : perte de données business + violation archivage 10 ans + rupture conformité.
- **Migration manuelle (Will saisit chaque booking V0 dans V1)** : insoutenable au-delà de 5-10 bookings.
- **Migration partielle (seulement les futurs bookings, ignorer passés)** : casse les vues admin (paiements / factures vides pour bookings V0 confirmés).
- **Soft-delete des Bookings V0 (archive séparée)** : complique les exports RGPD + l'audit.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.18 (Migration data V0 → V1)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D63
- ADR 0015 (TVA agnostique — pour reconstruction legalSnapshot)
- ADR 0018 (state machine V1 — pour mapping V0 → V1 statuses)
- Memory : `axionia_session_2026-05-11_e2e_audit_p0_sprint` (prod V1 déployée 2026-05-11, base de la V0 actuelle)
