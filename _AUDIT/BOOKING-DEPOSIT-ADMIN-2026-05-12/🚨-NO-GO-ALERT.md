# 🚨 NO-GO ALERT — Lancement deposit-validation-gated impossible en l'état (V2.3)

> Audit Axion-IA — **cabinet IA opérationnel B2B premium** — V2.1 LIVE — Booking Deposit-Validation-Gated + Admin Console 2026 — 2026-05-12.
> HEAD `ff3ccbc`. Mode AUDIT-ONLY 1-GATE — verdict final.
>
> **Note** : ce livrable a été **réécrit en V2.3** post-itération ultime D59-D63 (`ULTIMATE-AUDIT.md`). Couvre désormais : échec paiement échéances (D59), drag-drop reschedule admin (D60), suspension `paused` (D61), versioning contrat (D62), migration data V0→V1 (D63), force majeure définition étendue, V1.5 versioning CGV par booking.

---

## Verdict

### 🔴 NO-GO

**Score pondéré : 37.5 / 100** (cf. `SYNTHESE-FINALE.md` § 1).
**P0 ≥ 36** identifiés transversalement (cf. agents 1→11).

Seuils prompt § 7.2 :

- 🟢 GO ≥ 85 % ET zéro P0.
- 🟡 GO conditionnel ≥ 70 % ET P0 ≤ 3.
- 🔴 NO-GO < 70 % OU P0 ≥ 4.

→ Verdict 🔴 sans ambiguïté.

---

## Ce qui est réellement en NO-GO

**Pas la plateforme V2.1 elle-même.** Le site `https://axion-ia.com` est live, monitoring OK, deploy auto-GitHub Actions OK, Sprint 24 + 24.1 ont durci RGPD + sécurité (CSP nonce, COEP, JWT revocation, PII redaction Telegram, retention purge). L'infra Hetzner CPX32 + Cloudflare Free + Coolify est stable.

**Ce qui est en NO-GO** : la **promesse deposit-gated** affichée publiquement dans `interventions.ts:220-236`, `audit/page.tsx`, et la CGV (`legal.ts:104-188`) — acompte 50 %, facture immédiate, call de cadrage, créneau verrouillé après acompte — n'a **aucun support code** :

- ❌ Package `stripe` non installé (`package.json` confirmé Phase 0 §7.1).
- ❌ Tables `Payment`, `Invoice`, `Refund`, `StripeWebhookEvent` inexistantes (`prisma/schema.prisma` confirmé).
- ❌ Aucun provider de signature électronique en V0 (la cible V1 retient **DocuSeal self-hosted gratuit**, pas Yousign payant).
- ❌ Tables `ContractDocument`, `ContractTemplate`, `Quote`, `DocusealWebhookEvent` inexistantes.
- ❌ Table `CadrageMeeting` inexistante (cadrage promis sur 29 fichiers, 0 implémentation).
- ❌ `BookingStatus` enum a 4 valeurs (`pending/confirmed/cancelled/postponed`) vs **~25 valeurs effectives cibles V1** (incl. `awaiting_admin_validation` D51 + `installment_overdue` D59 + `disputed` D59 + `paused` D61).
- ❌ `confirmed` posé **avant** tout paiement (`admin-options/actions.ts:184`) — viole invariant cible « confirmed ⇒ payment.succeeded + clic Will validation calendrier D49 ».
- ❌ Aucune saisie admin (frais + édition contrat Tiptap) avant envoi du contrat parcours A (D55).
- ❌ Aucun écran "Prêts à valider" dans dashboard admin (D49) — pas de 2ème clic Will distinct.
- ❌ Numérotation factures absente (lock advisory Postgres requis pour CGI 242 nonies A FR / Raamatupidamise seadus EE).
- ❌ Webhook signature Stripe inexistant (table non créée car Stripe non installé).
- ❌ Sous-processeurs Stripe + DocuSeal + Hetzner Storage Box non déclarés dans `legal.ts:230` → non-conformité art. 13.1.e + 28 RGPD dès la 1ʳᵉ transaction.
- ❌ Aucun tracking visiteur (UTM/referrer/`referrerCity`) → `Submission.referer` jamais persistée, Plausible exporté mais jamais appelé.
- ❌ CGV ne formalisent ni acompte non-remboursable, ni politique d'annulation J-15, ni force majeure Will, ni cession de droits, ni clause résolution J+10 D53.
- ❌ Aucun délai configurable admin (D52 — `optionExpirationDaysIfNothingReceived` 5j + `contractSignedWithoutDepositCutoffDays` 10j).
- ❌ Aucun mobile responsive admin, pas de Cmd+K, pas de drawer client, pas de heatmap capacité (D23), pas de géo-awareness (D24).
- ❌ ~19 jobs cron manquants sur **~24 cibles V1** (`deposit-reminder`, `cadrage-reminder`, `j7-invoice`, `j1-reminder`, `refund-trigger`, `capacity-recompute`, `negotiation-stalled-reminder` D48, `contract-signed-without-deposit-reminder` D48, `option-expiration-rien-recu` D52, `contract-signed-without-deposit-cancel` D52, **`installment-overdue-escalation` D59 #24**, **`paused-resume-reminder` D61 #25**). Cron `booking-j1-debrief` retiré V1 (D57).
- ❌ ~25 templates emails manquants V1 (suite Stripe + DocuSeal + cadrage + balance + parcours B + itération ultime) — **~36 nouveaux V1 strictement requis** (+ ~14 existants V0 = **~50 au total**), dont 5 templates parcours B + nouveaux D49/D52 + **6 templates itération ultime D59-D62** (`booking-rescheduled-by-admin` #52, `booking-paused-confirmation` #53, `booking-resumed-notification` #54, `contract-version-updated` #55, `installment-overdue-soft` #56, `installment-overdue-firm` #57, `installment-disputed-notice` #58).
- ❌ **Aucune gestion échec paiement échéances 2/3** (D59) : pas d'état `installment_overdue` ni `disputed`, pas de cron escalade J+3/J+15/J+30/J+45.
- ❌ **Aucune Server Action `rescheduleBookingByAdminAction`** (D60) avec invariants statut + audit log + email auto.
- ❌ **Aucune gestion suspension `paused`** (D61) : pas de statut, pas de colonnes `pausedAt/pausedUntil/pauseReason`, pas d'actions pause/resume, pas de cron rappel reprise.
- ❌ **Aucun versioning contrat post-envoi** (D62) : pas de `cancelAndReissueContractAction`, pas de `createContractAddendumAction`, pas de colonnes `version/previousVersionId/isAddendum`.
- ❌ **Aucun script migration data V0 → V1** (D63) : risque trous données Booking V0 historiques + pas de Payment/Invoice rétroactifs `isHistorical=true`.
- ❌ **Aucun parcours visiteur dédié aux formats > 5 000 € HT / sur-devis (D44 parcours B)** : route `/demande-devis` (FR) / `/request-quote` (EN) absente, Server Action `submitQuoteRequestAction` (V4) absente, Server Action admin `createBookingFromSubmissionAction` (A16) absente, drawer admin unifié B (D47) absent. Les leads IA Custom (8-50 k€), transformation collective custom et packs annuels tombent sur `/contact` ou `/reserver` non adaptés → friction massive, lead perdu OU promesse intenable.
- ❌ Pricing hardcodé dans `pricing.ts` (cible V1 : `PricingConfig` DB modifiable admin).
- ❌ Aucun système de frais accessoires (déplacement / hôtel / repas / autres).
- ❌ Aucun échéancier configurable.
- ❌ Aucun système de suivi paiements pro (tableau / fiche / relances / audit log / export CSV).

---

## Risque immédiat à mitiger (non-build)

Indépendamment du build V1 complet, **la copy publique mensongère** est un risque légal immédiat (publicité trompeuse art. L121-2 Code de la consommation FR + équivalent EE) :

> « Acompte 50 % + facture immédiate + créneau verrouillé après acompte »
> affiché sur `/interventions`, `/audit`, et dans la CGV.

Aucun de ces engagements n'est tenu : pas d'acompte (pas de Stripe), pas de facture (pas de PDF), créneau verrouillé avant tout paiement (`admin-options/actions.ts:184`).

**Mitigation possible avant build V1 (~1-2 j)** :

- Soit retirer ces mentions de `interventions.ts` + CGV (« option en attente de validation William sous 24-48h » au lieu de « acompte 50 % »).
- Soit ajouter un bandeau temporaire « Système de réservation en cours d'évolution — paiement post-validation William en différé, contactez-nous » sur `/reserver`.

**Cette mitigation ne débloque pas le deposit-gated**, mais retire le risque légal en attendant V1.

---

## Action recommandée — 2 voies

### Voie A — Build V1 complet (recommandé)

**Effort** : **~54-60 j ingé + 0,5j Will** (20 sprints, X.0 → X.20 + X.5bis parcours B). Bilan vs ~52-58j post-D49-D58 : ajouts itération ultime D59 + D60 + D61 + D62 + D63 = +2-3j absorbés dans sprints existants X.3 + X.4 + X.9 + X.12 + X.13.
**Délai** : **10-12 semaines** avec 1 dev plein temps.
**Plan détaillé** : `04-PLAN-EXECUTION.md`.
**Délivrable** : système deposit-validation-gated propre couvrant **2 parcours visiteur** : A (calendrier direct → clic Will "Envoi contrat + demande acompte" D49 avec saisie admin D55 → trigger AUTO → état `awaiting_admin_validation` D51 dès paiement → clic Will "Valider sur le calendrier" D49 → slot 🔴) et B (formulaire qualifié `/demande-devis` → négo hors-app → drawer admin unifié → envoi unifié devis + contrat + lien paiement → identique parcours A à partir de `awaiting_admin_validation`). Conforme, automatisé, mobile-friendly admin, observable, pricing DB-managé, factures email PJ uniquement (D56), notifications Will Telegram+console uniquement (D54), gestion complète échecs paiement échéances (D59), drag-drop reschedule admin (D60), suspension projet `paused` (D61), versioning contrat (D62), migration data V0→V1 (D63).

**Décisions clés V1 intégrées (depuis D44)** :

- Validation calendrier en 2 clics distincts D49.
- Paiement = critère bloquant unique D50.
- Délais expiration configurables admin D52.
- Clause contractuelle résolution J+10 D53.
- Saisie admin avant envoi contrat parcours A D55.
- **Échec paiement échéances 2/3 traité D59** (cron escalade + 2 états + 3 templates).
- **Drag-drop reschedule admin D60** (Server Action + email + invariants statut).
- **Suspension booking `paused` D61** (statut + actions pause/resume + cron + 2 templates).
- **Versioning contrat post-envoi D62** (annulation/réémission avant signature OU avenant après).
- **Migration data V0 → V1 D63** (script obligatoire Sprint X.4 + Payment/Invoice rétroactifs + audit log + backup pré-run).

**Pré-requis Will (Sprint X.0, ~0,5j non-dev)** :

1. Trancher 10 questions restantes Q1-Q10 (cf. `STOP-AND-ASK.md` § 2) — 30-45 min review dédiée.
2. Signer DPA Stripe en ligne (~30 min).
3. Activer compte Stripe live + KYB validé (~quelques jours selon dossier).
4. Trancher structure juridique FR vs EE (peut attendre fin Sprint X.17 ; n'attend pas pour démarrer code).

### Voie B — Rétablir cohérence copy V0 (palliatif court terme)

**Effort** : ~1-2 j.
**Délivrable** : retrait des promesses non tenues. Plateforme reste à son niveau V2.1 actuel.

**Permet de** : retirer le risque légal immédiat, garder le système actuel (`postOption48hAction` + Telegram + email Will + relance manuelle Will).

**Ne débloque PAS** : deposit-validation-gated (toujours pas de paiement intégré), Customer Portal, factures PDF, cadrage automatique, contrats DocuSeal, devis, frais accessoires, échéanciers, suivi paiements pro.

---

## Décisions Will immédiates (≤ 24h)

1. **Voie A vs Voie B** : tu choisis ?
2. Si Voie A : démarrer review Q1-Q10 (Sprint X.0, ~45 min) puis Sprint X.0 dev (1j).

---

## Pour rappel — Audit clos, mode AUDIT-ONLY 100 % respecté

- 0 ligne de code applicatif modifiée ou ajoutée.
- 0 fichier `.ts/.tsx/.js/.sql/.yaml/.json/.env/.prisma` créé.
- 0 `git commit/push/tag/stash`.
- 0 `pnpm add/install/remove`, `prisma migrate`.
- 0 POST à Stripe, DocuSeal, Coolify, Cloudflare, Hetzner, Sentry, Telegram, Resend.
- 0 POST aux Server Actions du projet, 0 login en prod.
- 20 fichiers `.md` produits dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/` (+ `PROD-READINESS-FINAL.md` itération ultime D59-D63).

---

## Suite

- `SYNTHESE-FINALE.md` — vue d'ensemble (score, Top 10 P0, quick wins, vision V1 finale).
- `STOP-AND-ASK.md` — 31 décisions tranchées (D33-D63 incluant D44-D48 parcours B + D49-D58 itération finale + **D59-D63 itération ULTIME**) + 10 questions restantes (Q1-Q10) + bloquants externes + V1.5 prévu (versioning CGV par booking).
- `03-ARCHITECTURE-CIBLE.md` — 16 tables (15 migrées V1 + 1 hook V1.5+ OnboardingDoc) + extensions D44/D61/D62/D63 + 2 clés `SiteSetting` D52 + colonne `ContractTemplate.defaultLegalClauses` D53 + ~25 valeurs state effectives incl. `awaiting_admin_validation` D51 + `installment_overdue`/`disputed` D59 + `paused` D61 + **~32 Server Actions** (incl. A18-A22 D60-D62) + **~24 jobs cron V1** + **~36 templates V1** (+ ~14 existants V0 = ~50 total) + **16 sections admin** + drawer parcours B §5.11.3 + factures email PJ uniquement D56 + script migration §5.18 D63 + force majeure étendue §5.8.1 + hooks V2+.
- `04-PLAN-EXECUTION.md` — **20 sprints chiffrés (dont X.5bis parcours B)** + DAG dépendances + Top 10 P0 + 6 sprints V2+ principaux + 7 extensions optionnelles (incl. V2.RB Recurring Bookings packs annuels).
- `ULTIMATE-AUDIT.md` — audit à froid post-V2.2 (5 P0 résiduels résolus en V2.3 + 14 P1 + 12 P2 traités).
- `UX-E2E-VERIFICATION.md` — vérification post-audit 2026-05-12 : 9 P0 + 7 P1 + 3 P2 identifiés, dont les 5 P0 + 4 P1 appliqués dans cette V2.1 (parcours B intégré).
- `agent-NN-*.md` — détail par périmètre (11 fichiers, snapshot audit V0).
- `00-REALITY-CHECK.md` + `01-INVENTAIRE-E2E.md` + `02-BENCHMARKS-2026.md` — fondations.

**STOP unique — attends décision Will sur Voie A vs Voie B avant tout déclenchement de Sprint X.0.**
