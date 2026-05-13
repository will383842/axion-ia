# ADR 0017 — Multi-options simultanées sur même slot — cap configurable défaut 3

**Statut** : ✅ Acté Sprint X.0 booking-v1 · 2026-05-13
**Décideur** : Will (gérant Axion-IA OÜ)
**Contexte sources** : audit booking V2.3 — `agent-03-state-machine.md` §4, `03-ARCHITECTURE-CIBLE.md` §5.11.2, `STOP-AND-ASK.md` D34

---

## Contexte

Le calendrier visiteur (`/reserver`) doit gérer le cas où plusieurs prospects sont intéressés par **le même slot** (par exemple : 3 entreprises veulent réserver Will le mardi 17 juin 9h-17h pour une formation Essentielle 1j).

Deux paradigmes possibles :

### Paradigme A — « Premier arrivé, premier servi » (exclusivité immédiate)

Dès qu'un visiteur sélectionne un slot, le slot est **bloqué** pour les autres (status `held`). TTL 15 min : si pas de paiement acompte dans le délai, le slot redevient `available`. Modèle classique réservation hôtelière / spectacle.

**Problèmes V1** :

- Frustration des prospects bloqués (le 2e arrivé voit « slot indisponible » alors que rien n'est confirmé).
- Race condition si TTL expire pendant la signature contrat.
- Will n'a pas la main pour décider entre 2 prospects intéressants (perd opportunité commerciale).

### Paradigme B — « Multi-options simultanées » (cap configurable, Will décide)

Plusieurs `BookingOption` peuvent exister sur le même slot, jusqu'à un **cap configurable** (défaut 3). Will arbitre manuellement et confirme **le booking gagnant**. Les autres options passent en `lost_other_won` avec email auto proposant des dates alternatives.

**Avantages V1** :

- Will reste maître de la sélection (pas de pilote auto biaisé par l'ordre d'arrivée).
- Pas de race condition (transitions explicites par Will).
- Le visiteur sait qu'il est en concurrence (transparent UX) — incitation à confirmer rapidement (cf. ADR 0018, clic 1).

Will a tranché Paradigme B (D34).

## Décision

### Cap configurable `SiteSetting.maxConcurrentOptionsPerSlot` (défaut 3)

#### 1. Configuration

- Stocké dans `SiteSetting` (DB) avec clé `maxConcurrentOptionsPerSlot`, défaut `3`.
- Override possible par type de slot via `CapacityWindow.maxOptions` (V1.5+) — V1 = cap global.
- Modifiable depuis admin `/admin/parametres/booking`.

#### 2. Calendrier visiteur — affichage

- Un slot affiche `available` tant que `count(BookingOption WHERE slotId=X AND status='option_pending') < cap`.
- Quand le cap est atteint : status visiteur `held_by_others` (libellé visiteur « Plusieurs personnes intéressées par ce créneau, choisissez une alternative »).
- Aucun visiteur ne voit l'identité des autres prospects (RGPD).

#### 3. Pas de course à la signature

- Le statut `option_pending` peut coexister sur plusieurs `BookingOption` du même slot.
- **C'est Will qui valide manuellement** depuis `/admin/reservations` (D49, ADR 0018).
- Aucun système n'auto-confirme le « premier qui a signé / payé ».

#### 4. Transition à la validation Will

Quand Will clique « Valider sur le calendrier » sur un booking concurrent :

1. Booking gagnant : `option_pending` → `awaiting_admin_validation` → `confirmed`.
2. **Autres options sur le même slot** : transition automatique `option_pending` → `lost_other_won`.
3. Email auto envoyé aux perdants avec :
   - Notification empathique (« Désolés, le créneau a été pris par un autre client »).
   - 3 dates alternatives proposées (le système suggère les 3 prochains slots disponibles du même `interventionFormat`).
   - Code promo optionnel (`SiteSetting.lostOptionPromoCode` — défaut vide V1).
4. Si l'option avait été payée (acompte reçu) avant la défaite : la transition `lost_other_won` déclenche un **remboursement automatique** Stripe (D6 confirmé) ou une saisie admin manuelle pour les modes `manual_*`.

#### 5. Cas particulier : booking parcours B (D44)

- Les Bookings parcours B (devis qualifié) **ne réservent PAS de slot** tant qu'ils sont en négo (D45). Le cap multi-options ne s'applique pas à eux.
- Quand un Booking parcours B est confirmé, **il prend prioritairement** un slot, transitionnant les options parcours A concurrentes en `lost_other_won` (mêmes mécanismes que ci-dessus).

#### 6. Compteur visiteur (optionnel V1.5+)

Hook préservé : afficher au visiteur « 2 autres personnes consultent ce créneau » (effet d'urgence soft). V1 = pas de compteur (transparence min). V1.5+ : compteur côté visiteur via SSE ou polling 30s.

## Conséquences

### Techniques

- Index Prisma critique : `BookingOption(slotId, status)` — pour `COUNT` rapide en page calendrier (`03-ARCHITECTURE-CIBLE.md` §5.1.21).
- Server Action `validateBookingFromOption(bookingId)` doit batcher les transitions `lost_other_won` dans une seule transaction Prisma.
- Webhook Stripe doit gérer `refund.created` pour les options perdantes payées.
- Email template `option-lost-other-won.{fr,en}.mjml` nouveau (cf. Sprint X.13).

### Business

- Will garde le contrôle commercial total (peut choisir le « meilleur » prospect — fit secteur, panier, urgence).
- Pas de slot bloqué inutilement (un prospect qui hésite ne pénalise pas les autres).
- Risque : 2 prospects sérieux peuvent se sentir frustrés si tous deux échouent à un même slot. Mitigation : email empathique + dates alternatives + code promo optionnel.

### UX visiteur

- Transparent : le visiteur sait qu'il est en option (statut affiché « En attente de confirmation Axion-IA »).
- Incitation à payer l'acompte vite (cf. ADR 0018 — paiement = critère bloquant, pas signature).
- Pas de surprise : email immédiat à la création de l'option avec rappel du caractère non-définitif.

## Alternatives écartées

- **Paradigme A « premier arrivé » exclusif** : retire le contrôle commercial à Will, frustration UX.
- **Cap = 1 (exclusivité comme A)** : équivaut au paradigme A, rejeté.
- **Cap illimité** : ingérable, Will pourrait avoir 10 options sur un slot.
- **Cap = 5 par défaut** : trop, augmente le bruit admin et la frustration visiteur (5 perdants email).
- **Cap = 2** : trop restrictif, perd des opportunités commerciales.
- **Auto-confirmation au paiement** : retire la décision Will, biais ordre d'arrivée, rejeté.

## Liens

- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/agent-03-state-machine.md` §4 (multi-options diagramme)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/03-ARCHITECTURE-CIBLE.md` §5.11.2 (Will-B multi-options simultanées), §5.1.4 (BookingOption), §5.1.19 (SiteSetting), §5.1.21 (index partiels critiques)
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/STOP-AND-ASK.md` D34
- ADR 0018 (validation 2 clics — où s'arrête la course aux options)
