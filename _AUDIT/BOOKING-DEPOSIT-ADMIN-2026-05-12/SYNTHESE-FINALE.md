# SYNTHÈSE FINALE — Audit Booking Deposit-Validation-Gated + Admin Console 2026

> Audit AUDIT-ONLY (zéro code touché) sur Axion-IA — cabinet IA opérationnel B2B premium — V2.1 LIVE Hetzner CPX32 + Cloudflare Free + Coolify.
>
> **HEAD audité** : `ff3ccbc9edaf2bf96cc33d289b2709d10f39d742` (branche `main`)
> **Date** : 2026-05-12
> **Mode** : AUTO-PILOT 1-GATE — verdict en fin de doc.
>
> **Note** : ce livrable a été **réécrit en V2** suite à la review interactive Will 2026-05-12 qui a redéfini la cible V1 (DocuSeal au lieu de Yousign, validation manuelle Will au lieu de course à la signature, pricing DB-managé, multi-options simultanées, frais accessoires 3 modes, échéanciers configurables, géo-awareness, suivi paiements pro). La version initiale est conservée pour traçabilité dans les agents Phase 2 (qui auditaient le V0 existant).

---

## 1. Score consolidé (§ 7.1 prompt source — V0 audit)

| Agent                  | Périmètre                                                                       | Score /100 |     Poids | Score pondéré |
| ---------------------- | ------------------------------------------------------------------------------- | ---------: | --------: | ------------: |
| 1 — Flow visiteur      | `/reserver` + CTAs + UX premium                                                 |         51 |      12 % |          6.12 |
| 2 — Admin organisation | Sidebar / nav / dashboard / mobile / Cmd+K                                      |         39 |      10 % |          3.90 |
| 3 — State machine      | `BookingStatus` enum + transitions + invariants                                 |         49 |      13 % |          6.37 |
| 4 — Paiement Stripe    | Checkout + webhook + Invoice/Refund/Customer Portal                             |          7 |      13 % |          0.91 |
| 5 — Calendrier admin   | Vues + drawer + heatmap capacité + géo                                          |         18 |       9 % |          1.62 |
| 6 — Automatisations    | Queue + 22 jobs cron au total V1 (20 nouveaux + 2 étendus) + DLQ + Sentry crons |         29 |       9 % |          2.61 |
| 7 — Notifications      | ~30 templates V1 (+ ~14 existants V0 = ~44 total) + Telegram admin + RGPD       |         74 |       7 % |          5.18 |
| 8 — RGPD / OWASP       | Sous-processeurs + webhook signatures + IDOR + PCI                              |         63 |       9 % |          5.67 |
| 9 — Bout-en-bout       | Préfill `?ville=&service=` + tracking UTM + cohérence taxo                      |         50 |       5 % |          2.50 |
| 10 — Pre-booking       | CadrageMeeting + DocuSeal Quote/Contract + onboarding docs                      |          2 |       8 % |          0.16 |
| 11 — Conformité légale | CGV + mentions + sous-processeurs + TVA agnostique + archivage                  |         50 |       5 % |          2.50 |
| **Total**              |                                                                                 |            | **100 %** |     **37.54** |

**Lecture** : score **37.5/100** sur le V0 existant. L'écart V0→V1 est attendu et large : V0 est greenfield pour Stripe + DocuSeal + cadrage + factures + suivi paiements + pricing DB. L'écart n'est pas un signal d'urgence-incident, c'est un **scope de build V1** à réaliser en 20 sprints (cf. `04-PLAN-EXECUTION.md`).

---

## 2. Verdict

### 🔴 NO-GO — Lancement deposit-validation-gated impossible en l'état

**Justification** :

- Score pondéré **37.5/100** << seuil 🟡 (70 %).
- **≥ 36 P0** identifiés transversalement (cf. Top 10 ci-dessous + détails agents).
- Promesses copy publiques (CGV / `interventions.ts` / `audit.tsx`) sur **acompte 50 %**, **facture immédiate**, **call de cadrage**, **créneau verrouillé après acompte** sont **toutes mensongères en code** (Phase 0 §1.9).

### Lecture honnête

Le verdict 🔴 **n'invalide pas la plateforme V2.1** actuelle (live, stable, monitoring OK, Sprint 24 + 24.1 ont durci RGPD + sécurité). Il invalide uniquement **la promesse deposit-gated affichée**. Deux options :

1. **Build V1 complet** (recommandé) — **20 sprints (dont X.5bis parcours B), ~52-58 j ingé + 0,5j Will, 10-12 semaines** avec 1 dev plein temps. Livrable deposit-validation-gated propre couvrant les 2 parcours visiteur A (calendrier) + B (devis qualifié) avec validation calendrier en 2 clics D49 + état `awaiting_admin_validation` D51 + factures email PJ D56. Plan détaillé dans `04-PLAN-EXECUTION.md`.
2. **Rétablir la cohérence copy V0** (palliatif court terme) — modifier `interventions.ts:220-236` et CGV pour aligner le discours sur la réalité actuelle (« option 48h, contact humain sous 24h, paiement après prestation » en attendant V1). **~1-2 j**. Permet de retirer le risque légal immédiat **sans** débloquer le deposit-gated.

Cf. `🚨-NO-GO-ALERT.md` pour le détail de l'alerte et les bloquants Will.

---

## 3. Vision V1 finale (review Will 2026-05-12)

Le workflow V1 final tranché avec Will couvre **2 parcours visiteur distincts** (D44) :

### Parcours A — Format SANS devis (calendrier direct)

Formats à tarif fixe (`audit_flash_onsite`, conférences, catalogue ≤ 5 000 € HT) :

```
Visiteur ───▶ /reserver (calendrier 5 statuts : 🟢🟠🟡🔴 visiteur + ⚫ admin invisible visiteur)
            │
            ▼ formulaire + accepte CGV
        BookingOption créée (option en attente validation Will, multi-options cap=3)
            │ Telegram + console admin Will (D54 — pas d'email Will)
            │ Email visiteur "demande reçue"
            ▼
Will ───────▶ /admin/demandes ───▶ clic 1 "Envoi contrat + demande acompte" (D49)
                                    ▼ Écran saisie admin D55 :
                                      • Frais accessoires modifiables (4 lignes)
                                      • Édition contrat Tiptap libre (template + clause D53)
                                      • PAS de seuil 1 500 € HT — toujours éditable
                                    ▼ Clic "Envoyer" — AUTO trigger :
                                    • Slot reste 🟠 (status `contract_payment_sent`)
                                    • Autres options du slot → "lost_other_won" + email dates alternatives
                                    • Contrat PDF généré (template ContractTemplate DB + clause D53)
                                    • Facture acompte PDF générée
                                    • Stripe Checkout Session créée
                                    • Email client : contrat (DocuSeal) + lien paiement
            │
            ▼ Client signe contrat DocuSeal (webhook) — PAS bloquant D50
            ▼ Client paie acompte (Stripe webhook OU virement manuel saisi par Will)
            ▼ AUTO transition : `contract_payment_sent → awaiting_admin_validation` (D51)
            ▼ Slot reste 🟠 + Will reçoit Telegram + badge console "Prêt à valider" (D54)
            │
Will ───────▶ Dashboard section "Prêts à valider" ───▶ clic 2 "Valider sur le calendrier" (D49)
                                    ▼ AUTO transition : `awaiting_admin_validation → confirmed`
                                    • SLOT PASSE 🔴 (verrouillé)
                                    • Email final client `booking-validated-on-calendar` (D49)
            │
            ▼ Booking confirmé (originPath='direct')
            ▼ Crons : J-7 facture solde, J-1 reminder (pas de NPS J+1 D57 retiré V1)
            ▼ Prestation (signature physique contrat le jour J si non signé via DocuSeal D50)
            ▼ Facture solde envoyée par email PJ uniquement (D56), paiement reçu, archivé
```

### Parcours B — Format AVEC devis (formulaire qualifié + négociation hors-app)

Formats > 5 000 € HT, IA Custom (8-50 k€), packs annuels, transformation collective sur-mesure :

```
Visiteur ───▶ /demande-devis?intervention=<slug> (FR) / /request-quote (EN)
            │
            ▼ formulaire qualifié (10-12 champs : contexte, budget, timing, lieu)
        Submission(type='quote_request', status='new')
            │ Telegram Will + email visiteur "quote-request-received" sous 24-48h
            │ AUCUN slot calendrier réservé (D45)
            ▼
Will ───────▶ NÉGOCIATION HORS-APP (téléphone, email, 2-4 sem.)
            │ updateSubmissionDraftAction (A17) : Submission.status new → qualifying → negotiating
            ▼
Will ───────▶ admin/demandes-devis ───▶ Drawer parcours B (D47)
                                          • Slot picker multi-slots (1..N)
                                          • Montant HT + 4 frais accessoires
                                          • Échéancier (profil ou custom)
                                          • TVA (FR/EE)
                                          • Tiptap contrat préremplé
                                          • Tiptap devis préremplé
                                          ▼ clic "Envoyer devis + contrat + lien paiement"
                                          ▼ createBookingFromSubmissionAction (A16)
                                          • Booking créé (originPath='quote_negotiation', fromSubmissionId)
                                          • Slots[] → 🔴
                                          • Quote (DocuSeal) + ContractDocument (DocuSeal) + Invoice deposit + Stripe Checkout
                                          • Email UNIFIÉ "contract-sent-with-deposit-link"
                                          • Submission.status='converted'
            │
            ▼ Client signe devis + contrat DocuSeal
            ▼ Client paie acompte Stripe
            ▼ Booking confirmé → email "booking-confirmed-after-negotiation"
            ▼ Crons standards J-7/J-1/J+1
```

Crons spécifiques B (D48) : `negotiation-stalled-reminder` (Telegram Will J+7/J+14/J+30 si Submission inactive) + `contract-signed-without-deposit-reminder` (relance J+3/J+7/J+14 si contrat signé mais acompte non payé).

**Décisions clés V1** :

- ✅ **2 parcours visiteur distincts A (calendrier direct) / B (devis qualifié + négo hors-app)** — D44 + D45 + D46 + D47 + D48.
- ✅ **Validation calendrier en 2 clics distincts** (D49) : clic 1 "Envoi contrat + demande acompte" → clic 2 "Valider sur le calendrier" (slot passe 🔴).
- ✅ **Critère bloquant unique = paiement acompte reçu** (D50). Contrat non bloquant — signature physique le jour J si pas signée via DocuSeal.
- ✅ **État intermédiaire `awaiting_admin_validation`** (D51) entre `contract_payment_sent` et `confirmed`.
- ✅ **Délais d'expiration configurables admin** (D52) : 5j si rien reçu / 10j si contrat signé sans acompte.
- ✅ **Clause contrat par défaut** D53 dans `ContractTemplate.defaultLegalClauses` (résolution de plein droit J+10).
- ✅ **Notifications Will = Telegram + console UNIQUEMENT** (D54) — pas d'email Will.
- ✅ **Saisie admin obligatoire avant envoi contrat parcours A** (D55) — frais + Tiptap contrat, pas de seuil €.
- ✅ **DocuSeal self-hosted** (gratuit, eIDAS-SES) au lieu de Yousign payant.
- ✅ **Stripe Checkout** + mode hybride manuel (virement/chèque saisi par Will). **Factures envoyées par email PJ uniquement (D56)** — Customer Portal Stripe retiré V1.
- ✅ **Pricing dynamique DB** (`PricingConfig`) modifiable admin → revalidation auto pages publiques.
- ✅ **Frais accessoires 3 modes** : `real_costs` / `flat_rate_by_zone` / `included`.
- ✅ **Échéanciers 4 profils par défaut** + override par booking.
- ✅ **TVA agnostique FR vs EE** (`vatRate` + `vatReverseCharge` + `vatMention` paramétrables, default EE).
- ✅ **Multi-options simultanées** (cap configurable, défaut 3) — c'est Will qui valide.
- ✅ **Géo-awareness intelligent** : OSM Nominatim + Haversine + heatmap admin + alertes Telegram conflits > 600 km.
- ✅ **Suivi paiements pro** : tableau global + fiche client + relances + audit log + export CSV. NPS J+1 retiré V1 (D57).
- ✅ **Pas Qualiopi / pas OPCO V1** — hooks DB nullable préservés. Onboarding docs retirés V1 (D58 — V1.5+ formulaire structuré).
- ✅ **Système email maison existant** (Nodemailer + PowerMTA + Mailwizz Phase 0) — ~36 templates V1 à créer (dont 5 spécifiques parcours B + 7 itération ultime D59-D62).
- ✅ **Échec paiement échéances 2/3** (D59) : états `installment_overdue` + `disputed` + cron escalade J+3/J+15/J+30/J+45 + 3 templates.
- ✅ **Drag-drop reschedule admin** (D60) : Server Action `rescheduleBookingByAdminAction` + invariants statut + email auto.
- ✅ **Suspension booking `paused`** (D61) : statut + actions pause/resume + cron rappel reprise + 2 templates.
- ✅ **Versioning contrat** (D62) : `cancelAndReissueContractAction` (avant signature) + `createContractAddendumAction` (avenant post-signature, contrat principal immuable).
- ✅ **Migration data V0 → V1** (D63) : script obligatoire Sprint X.4 + Payment/Invoice rétroactifs `isHistorical=true` + audit log + backup pré-run.

31 décisions Will tranchées 2026-05-12 (D33→D63 incl. itération ultime D59-D63, cf. `STOP-AND-ASK.md` + `UX-E2E-VERIFICATION.md` + `ULTIMATE-AUDIT.md`).
10 décisions restantes (Q1-Q10) à trancher au Sprint X.0 (30-45 min review dédiée).

---

## 4. Top 10 P0 — must-fix avant lancement deposit-validation-gated V1

Synthèse transverse (les 36+ P0 par agent sont consultables dans `agent-NN-*.md`). Ordonnés par **impact × effort inverse**.

| #   | Titre                                                                                                                                                                                                                 | Source (agent + file:LINE)                                                                        | Impact                                                                                       | Effort                                                            | Sprint cible        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| 1   | **Promesse acompte 50 % / facture immédiate / cadrage / créneau verrouillé** affichée sans aucune implémentation code                                                                                                 | Phase 0 §1.9 + Agent 1 §P0 + `interventions.ts:220-236`, `audit/page.tsx`, CGV `legal.ts:104-188` | Revenu + risque légal (publicité trompeuse art. L121-2 Code consommation FR / équivalent EE) | Plan complet 20 sprints (~52-58 j incl. parcours B D44 + D49-D58) | X.1 → X.20 + X.5bis |
| 2   | **Aucune intégration Stripe** : `package.json` sans `stripe`, ni table `Payment`/`Invoice`/`Refund`/`StripeWebhookEvent`                                                                                              | Agent 4 §1, Phase 0 §7.1                                                                          | Revenu absolu (zéro paiement en ligne possible)                                              | 5-6j fondation + 3j checkout + 4j factures                        | X.1, X.2, X.10      |
| 3   | **Aucun provider de signature électronique** (V0 sans Yousign ni DocuSeal) → Devis + contrats + NDA impossibles                                                                                                       | Agent 10 §2-3, Phase 0 §7.1                                                                       | Revenu (devis bloque gros tickets > 5 k€) + conformité (NDA secteurs sensibles)              | 3-4j DocuSeal self-hosted                                         | X.3                 |
| 4   | **State machine `BookingStatus` n'a que 4 valeurs** (`pending/confirmed/cancelled/postponed`) vs ~28 valeurs effectives cibles V1 (~22 statuts business + 6 branches dérivées) ; `confirmed` posé avant tout paiement | Agent 3 §1 + `prisma/schema.prisma:BookingStatus` + `admin-options/actions.ts:184`                | Invariants violés, refund CGV non automatisable, audit-log absent                            | 4j (Sprint X.4)                                                   | X.4                 |
| 5   | **Aucune table `CadrageMeeting`** alors que `interventions.ts:220` promet l'étape sur 29 fichiers + 0 intégration visio                                                                                               | Agent 10 §1 + `interventions.ts:220`                                                              | UX (cadrage = clé de qualification) + cohérence narrative                                    | 3j (Sprint X.6)                                                   | X.6                 |
| 6   | **Numérotation factures absente** + pas de lock advisory Postgres → trous de séquence inacceptables (CGI 242 nonies A FR / Raamatupidamise seadus EE)                                                                 | Agent 4 §3.5 + Agent 11 §5                                                                        | Risque audit fiscal FR ou EE                                                                 | 1j incluse Sprint X.10                                            | X.10                |
| 7   | **Webhook Stripe sans signature ni table outbox** `StripeWebhookEvent` (table inexistante car Stripe inexistant) → replay/spoofing                                                                                    | Agent 8 §1 + Agent 4 §3.5                                                                         | Sécurité critique (double-confirmation, double-facture, refund spoofé)                       | 3j (Sprint X.2)                                                   | X.2                 |
| 8   | **Sous-processeurs Stripe + DocuSeal + Hetzner Storage Box non déclarés** dans `legal.ts:230` (Hetzner/CF/Telegram seuls) → non-conformité art. 13.1.e + 28 RGPD dès la 1ʳᵉ transaction                               | Agent 8 §1, Agent 11 §3                                                                           | RGPD (sanctions CNIL jusqu'à 4 % CA) + DPA Will à signer                                     | 1j code + action humaine Will                                     | X.17                |
| 9   | **Aucun tracking visiteur** UTM/referrer/`referrerCity` (`Submission.referer` jamais persistée, Plausible exporté mais jamais appelé) → industrialisation pSEO 2 150 villes opère à l'aveugle                         | Agent 9 §P0-2 + `BookingCalendar.tsx:309,324`                                                     | Revenu (impossible d'optimiser le funnel + ROI pSEO inconnu)                                 | 1-2j (Sprint X.18)                                                | X.18                |
| 10  | **CGV ne formalisent ni acompte non-remboursable, ni politique d'annulation J-15, ni force majeure Will, ni cession de droits**                                                                                       | Agent 11 §1 + `legal.ts:104-188`                                                                  | Litige B2B (5-20 k€), refund total exigible par client                                       | 3-4j (Sprint X.17)                                                | X.17                |

### P0 résiduels ULTIME résolus (cf. `ULTIMATE-AUDIT.md` — itération 2026-05-12 nuit)

5 P0 résiduels identifiés par `ULTIMATE-AUDIT.md` à froid post-V2.2, **désormais tous résolus** dans cette V2.3 :

| #   | Titre                                                                                                        | Statut V2.3                                                                                                                                                  | Sprint cible      |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| U1  | **Échec paiement échéances 2/3 (A6/A7)** : pas d'état `installment_overdue`/`disputed`, pas de cron escalade | ✅ Résolu D59 (états ajoutés + cron #24 + 3 templates)                                                                                                       | X.4 + X.12 + X.13 |
| U2  | **Drag-drop reschedule admin (B15)** : annoncé X.9 mais Server Action absente, pas d'audit log               | ✅ Résolu D60 (Server Action A18 + invariants statut + template #52 + email auto client)                                                                     | X.9               |
| U3  | **Suspension `paused` (B11)** : non modélisé, cas réel client demandant report 3 mois sans annuler           | ✅ Résolu D61 (statut + 2 Server Actions + cron #25 + 2 templates)                                                                                           | X.4 + X.12 + X.13 |
| U4  | **Modification contrat post-envoi (A16)** : `editContractDraftAction` ne couvre que pré-envoi                | ✅ Résolu D62 (`cancelAndReissueContractAction` A21 avant signature + `createContractAddendumAction` A22 avenant post-signature, contrat principal immuable) | X.3 + X.13        |
| U5  | **Migration data V0 → V1 (D7)** : pas de plan pour Bookings V0 sans Payment/Invoice associés                 | ✅ Résolu D63 (script `migrate-bookings-v0-to-v1.ts` idempotent + Payment/Invoice rétroactifs `isHistorical=true` + audit log + backup pré-run)              | X.4               |

### P0 supplémentaires UX E2E (cf. `UX-E2E-VERIFICATION.md` — 9 P0 parcours B)

- **B-P0-1** Route publique `/demande-devis` (FR) + `/request-quote` (EN) absente → tous formats > 5 000 € HT tombent sur `/contact` ou `/reserver` non adaptés. Sprint X.5bis.
- **B-P0-2** Server Action `submitQuoteRequestAction` (V4) absente → pas de capture qualifiée. Sprint X.5bis.
- **B-P0-3** `SubmissionType` enum manque `quote_request` → pas de filtrage admin. Sprint X.5bis (extension enum).
- **B-P0-4** `SubmissionStatus` inexistant (`new/qualifying/negotiating/converted/lost/archived`) → Will perd la trace des leads en négo. Sprint X.5bis.
- **B-P0-5** Server Action admin `createBookingFromSubmissionAction` (A16) absente → sortie de négociation hors-app non matérialisable. Sprint X.8 (extension drawer riche parcours B).
- **B-P0-6** ~5 templates emails parcours B absents : `quote-request-received`, `quote-sent-from-negotiation`, `contract-sent-with-deposit-link`, `booking-confirmed-after-negotiation`, `negotiation-stalled-reminder`. Sprint X.13 ext.
- **B-P0-7** Drawer admin unifié parcours B (D47) inexistant → Will doit naviguer entre 5 écrans pour matérialiser un Booking depuis Submission. Sprint X.8 ext.
- **B-P0-8** Cron `negotiation-stalled-reminder` (D48 job #21) absent → Will oublie de relancer les leads B inactifs. Sprint X.12 ext.
- **B-P0-9** Cron `contract-signed-without-deposit-reminder` (D48 job #22) absent → état coincé `contract_signed && deposit_pending` sans relance. Sprint X.12 ext.

### P0 supplémentaires (cf. agents 1-11)

- Agent 1 — Turnstile non injecté dans `BookingCalendar` → 100 % des submits prod renvoient « Captcha échoué ».
- Agent 1 — Honeypot `website` absent.
- Agent 1 — CTAs `?ville/service/from` ignorés (12 fichiers émettent, 0 lecture).
- Agent 1 — `postOption48hAction` jamais appelée (verrou pessimiste anti-race mort en pratique).
- Agent 2 — Aucun mobile responsive admin (sidebar 240 px fixe).
- Agent 2 — Pas de Cmd+K palette, pas de raccourcis clavier admin.
- Agent 5 — Aucun drawer dossier client (UUID copié-collé seul moyen actuel).
- Agent 5 — Pas de heatmap capacité hebdo/mensuelle (D23 non implémenté).
- Agent 5 — Pas de géo-awareness `audit_flash_onsite` (D24 non implémenté).
- Agent 5 — Vue Mois unique, pas de Semaine/Jour/Agenda, pas de filtres.
- Agent 6 — ~15 jobs sur 18 manquants V1 (deposit-reminder, cadrage-reminder, j7-invoice, j1-reminder, refund-trigger, capacity-recompute, etc.).
- Agent 6 — DLQ dédié absent, Sentry Crons monitoring nul.
- Agent 7 — Suite Stripe/DocuSeal/cadrage absente (~14 templates manquants).
- Agent 7 — 12/12 templates ont preheader dupliqué du subject.
- Agent 8 — `serverActions.allowedOrigins` absent de `next.config.ts` → CSRF + open redirect.
- Agent 9 — Hub `/interventions` produit 3 CTAs `/reserver` nus.
- Agent 11 — Incohérence acompte 30 % (D1) vs 50 % (`interventions.ts:236+262`).
- Agent 11 — Cession de droits livrables non encadrée.
- Phase 1 — Sujet email contradictoire « est réservée » vs « pas encore confirmée ».
- Phase 1 — Reschedule impossible (enum `postponed` orphelin).
- Phase 1 — CGV non acceptées au booking (pas de case à cocher).

---

## 5. Top 10 quick wins (impact > 5/10, effort < 0,5 j)

À considérer EN ATTENDANT le build V1 complet (peuvent être traités hors plan deposit-gated) :

1. **Honeypot `website` dans `BookingCalendar`** (1 input hidden) — Agent 1.
2. **Turnstile widget injecté** dans formulaire réservation — Agent 1.
3. **Preheaders distincts des subjects** dans 12 templates (refactor `COPY`) — Agent 7 P0-9.
4. **`serverActions.allowedOrigins`** ajouté à `next.config.ts` — Agent 8.
5. **Validation `success_url`/`cancel_url`** côté serveur (anti open redirect, pré-Stripe) — Agent 8.
6. **Lecture `?ville/?service/?from`** dans `BookingCalendar` (mappings simples) — Agent 1+9.
7. **CTAs hub `/interventions:504,739,919`** : ajouter `?intervention=...` — Agent 9.
8. **Sujet email réservation V0** : aligner avec « pré-réservation à confirmer » — Phase 1.
9. **Stripe + DocuSeal + Hetzner Storage Box listés** dans `legal.ts:230` (textes placeholders, code à venir) — Agent 8/11.
10. **Incohérence 30 % vs 50 %** dans `interventions.ts:236+262` : trancher copy (cf. Q10 STOP-AND-ASK).

---

## 6. Architecture cible V1 — résumé

Détail complet dans `03-ARCHITECTURE-CIBLE.md`. Synthèse :

- **DB** : **16 tables nouvelles** (15 migrées V1 + 1 hook V1.5+ documenté `OnboardingDoc` HORS V1 D58) — Payment, Invoice, Refund, StripeWebhookEvent, DocusealWebhookEvent, ContractDocument, ContractTemplate, Quote, CadrageMeeting, CapacityWindow, PricingConfig, PaymentScheduleProfile, BookingPaymentSchedule, SiteSetting, BookingTransition + extensions `Booking` (~25 colonnes — ajouts D44 : `originPath`, `fromSubmissionId` + D61 : `pausedAt`, `pausedUntil`, `pauseReason`) + extension `Payment.isHistorical` (D63) + extension `ContractDocument` (`version`, `previousVersionId`, `isAddendum` D62) + extensions `Submission` (D44) + extension `BookingOption.status` enum + enum `BookingOriginPath` (D44) + extension `ContractStatus.cancelled_admin` (D62) + 2 clés `SiteSetting` D52 + colonne `ContractTemplate.defaultLegalClauses JSONB` D53.
- **State machine** : `BookingStatus` étendu à **~25 valeurs effectives V1** — ajouts `awaiting_admin_validation` (D51) + **`installment_overdue` (D59)** + **`disputed` (D59)** + **`paused` (D61)**. Transition `contract_payment_sent → awaiting_admin_validation` automatique webhook Stripe ; transition `awaiting_admin_validation → confirmed` manuelle clic Will "Valider sur le calendrier" (D49). Transitions D59 : J+30 → `installment_overdue` ; J+45 → `disputed`. Transitions D61 bidirectionnelles `confirmed ↔ paused`.
- **Server Actions** : **~32 actions ciblées** — D44/D49 (renommage A1 + A1bis + V4 + A16 + A17) + **D60 A18 `rescheduleBookingByAdminAction`** + **D61 A19 `pauseBookingAction` + A20 `resumeBookingAction`** + **D62 A21 `cancelAndReissueContractAction` + A22 `createContractAddendumAction`** ; existantes : `refuseBookingOptionAction`, `editContractDraftAction`, `sendContractForSignatureAction`, `recordPaymentAction`, `createStripeCheckoutSessionAction`, `updatePricingConfigAction`, `overridePaymentScheduleAction`, etc.
- **Route handlers** : `/api/stripe/webhook`, `/api/docuseal/webhook`, `/api/admin/calendar/ical/:token`, `/api/admin/bookings/:id/refund`, `/api/booking/self-service/:token` + pages publiques `/fr/demande-devis` + `/en/request-quote` + confirmations (D44 parcours B). Endpoint `/api/stripe/customer-portal/:bookingId` **HORS V1** (D56). Endpoint onboarding upload `/api/onboarding/upload/:token` **HORS V1** (D58).
- **Admin nav** : refonte sidebar par fréquence + Dashboard + Cmd+K + mobile + **16 sections** (hausse vs 15 : ajout « Demandes devis » parcours B distinct de « Demandes » parcours A). Liste : Dashboard (incl. section "Prêts à valider" D49), Calendrier (+ drag-drop reschedule D60), Demandes (A), Demandes devis (B), Réservations (+ actions pause/resume D61 + reissue contrat D62), Clients, Paiements (+ écrans installments overdue D59), Factures & devis, Contrats DocuSeal (+ versioning D62), Frais accessoires, Tarifs & TVA, Échéanciers, Templates, Contenu, Marketing, Système (incl. `/admin/parametres-delais` D52).
- **Crons & workers** : **~24 jobs au total V1** — retrait `booking-j1-debrief` (D57) ; ajouts D48 (#21, #22) + D52 (#23 + #23bis) + **D59 #24 `installment-overdue-escalation`** + **D61 #25 `paused-resume-reminder`**. DLQ + Sentry Crons monitoring sur les 24.
- **Emails** : **~36 templates V1 FR+EN** (net +6 vs V2.2 : ajouts itération ultime #52-58 D59-D62). + ~14 existants V0 = **~50 au total** — Nodemailer + PowerMTA + Mailwizz existants Phase 0.
- **Conformité légale V1** : architecture **TVA-agnostique** (`vatRate` + `vatReverseCharge` + `vatMention` paramétrables, default scénario EE), CGV agnostique FR/EE, **clause force majeure étendue** (art. 1218 Code civil FR + Võlaõigusseadus §103 EE) + listes inclusive/exclusive, numérotation `AXION-2026-NNNN` séquentielle immuable, archivage 10 ans par défaut, clause résolution D53.
- **Migration data V0 → V1** (D63) : script obligatoire Sprint X.4 `scripts/migrate-bookings-v0-to-v1.ts` idempotent + test snapshot dev avant prod + audit log + backup pré-run + rollback plan.
- **Hooks V2+** : Qualiopi/OPCO/e-invoicing PDP/VIES API/multi-currency/Customer Portal Stripe (D56)/NPS J+1 (D57)/Onboarding docs structurés (D58)/**Recurring Bookings packs annuels (V2.RB)** non implémentés mais slots libres.

---

## 7. Plan d'exécution V1 — résumé

Détail complet dans `04-PLAN-EXECUTION.md`. Synthèse :

- **20 sprints V1** (X.0 → X.20 + X.5bis parcours B qualification — Sprint onboarding-docs retiré D58, Customer Portal retiré D56, NPS retiré D57 ; D59-D63 absorbés dans X.3 + X.4 + X.9 + X.12 + X.13).
- **Total V1** : **~54-60 j ingé + 0,5j Will** (Sprint X.0 décisions). Bilan vs ~52-58j post-D49-D58 : ajouts itération ultime D59 + D60 + D61 + D62 + D63 = +2-3j absorbés dans sprints existants.
- **Délai prévisionnel** : **10-12 semaines** avec 1 dev plein temps (inchangé, parallélisations absorbent +2-3j).
- **Chemin critique** : X.0 → X.1 → X.2/X.3 (//) → X.4 (incl. D59+D61+D63) → X.5 → **X.5bis** → X.6 → X.7 → X.8 → X.9/X.10 (// incl. D60) → X.11 → X.12 (incl. D59+D61) → X.13 (incl. D59+D60+D61+D62) → X.14 → X.15/X.16 → X.17 → X.18 → X.19 → X.20.
- **Sprints V2+ reportés** (6 principaux 17-25 j ingé + 7 extensions optionnelles incl. **V2.RB Recurring Bookings packs annuels**) : Qualiopi, OPCO, e-invoicing FR PPF/PDP, VIES API, multi-currency, réconciliation comptable. + 3 sprints reportés V1.5+ post-itération : Customer Portal Stripe (D56), NPS J+1 (D57), Onboarding docs structurés (D58).

---

## 8. Décisions Will pendantes (cf. `STOP-AND-ASK.md`)

31 décisions tranchées 2026-05-12 (D33-D43 + D44-D48 issues de `UX-E2E-VERIFICATION.md` + D49-D58 itération finale Will + **D59-D63 itération ULTIME post-`ULTIMATE-AUDIT.md`**) + 10 questions restantes (Q1-Q10) :

1. **Q1** — Provider visio cadrage V1 (reco : `manual_external` V1, Whereby V1.5).
2. **Q2** — Structure juridique FR vs EE (peut être décidée plus tard, n'attend pas pour code).
3. **Q3** — PDF moteur (reco : react-pdf).
4. **Q4** — Storage PDF (factures + contrats + devis uniquement, pas onboarding docs D58) (reco : Hetzner Storage Box).
5. **Q5** — Drag & drop calendrier admin (reco : V1 minimal).
6. **Q6** — Refunds auto vs manuel (reco : manuel V1).
7. **Q7** — J+1 debrief NPS — **RETIRÉ V1 (D57)** ; question close.
8. **Q8** — Admin EN bilingue (reco : FR only V1).
9. **Q9** — Liste fermée secteurs sensibles NDA auto.
10. **Q10** — % d'acompte par défaut par format (reco : appliquer D40).

---

## 9. Risques bloquants

1. **DPA Stripe non signé** → impossible de mettre en prod (action humaine Will, ~30 min en ligne).
2. **DocuSeal self-hosted** : pas de DPA tiers (auto-hébergé) — gain procédural.
3. **Structure juridique FR vs EE non tranchée** → bloque `legal.ts` final (mentions légales, juridiction CGV, régime TVA mentions facture). Ne bloque PAS le démarrage du code (architecture agnostique).
4. **DMARC/DKIM/SPF prod** : statut `[À VÉRIFIER]` cf. Agent 7. Peut bloquer la deliverability des emails transactionnels Stripe + DocuSeal.

---

## 10. Sources principales

- `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` (prompt source V3).
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md`.
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/01-INVENTAIRE-E2E.md`.
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/02-BENCHMARKS-2026.md`.
- 11 fichiers `agent-01-*.md` à `agent-11-*.md`.
- `03-ARCHITECTURE-CIBLE.md` (V2 — vision Will 2026-05-12).
- `04-PLAN-EXECUTION.md` (V2 — vision Will 2026-05-12).
- `STOP-AND-ASK.md` (V2 — vision Will 2026-05-12).
- Mémoire Will : `axionia_session_2026-05-11_e2e_audit_p0_sprint.md`, `axionia_interventions_taxonomy_refonte_2026-05-11.md`, `axionia_session_2026-05-12_interventions_hubs.md`, `axionia_pricing_zero_hardcode_2026-05-08.md`, `axionia_session_2026-05-09_sprint_24.md`, `axionia_session_2026-05-09_sprint_24_1.md`.
- Sources légales : legifrance.gouv.fr, impots.gouv.fr, eur-lex.europa.eu, service-public.fr, cnil.fr, riigiteataja.ee (cf. Agent 11).
- Doc officielle : stripe.com/docs, docuseal.co/docs, developers.cloudflare.com.

---

## 11. Pour rappel — Mode AUDIT-ONLY respecté

- 0 ligne de code applicatif modifiée ou ajoutée.
- 0 fichier `.ts/.tsx/.js/.sql/.yaml/.json/.env/.prisma` créé.
- 0 `git commit`, `git push`, `git tag`, `git stash`.
- 0 `pnpm add/install/remove`, `prisma migrate`.
- 0 POST à Stripe, DocuSeal, Coolify, Cloudflare, Hetzner, Sentry, Telegram, Resend.
- 0 POST aux Server Actions du projet, 0 login en prod.
- Seuls outputs : 19 fichiers `.md` dans `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/`.

---

## 12. Suite immédiate

→ `🚨-NO-GO-ALERT.md` pour l'alerte verdict + Will-actions immédiates.
→ `STOP-AND-ASK.md` pour les 10 décisions Will pendantes (Q1-Q10) + 26 tranchées 2026-05-12 (D33-D58 incluant D44-D48 parcours B + D49-D58 itération finale Will).
→ `03-ARCHITECTURE-CIBLE.md` pour le détail de la cible V1 (16 tables + extensions D44 + 2 SiteSetting D52 + colonne D53, ~27 Server Actions dont renommage D49 + `validateBookingOnCalendarAction` D49, ~23 valeurs state effectives V1 incl. `awaiting_admin_validation` D51, ~30 templates V1 (+ ~14 existants V0 = ~44 total), ~21 jobs cron V1, 16 sections admin incl. "Prêts à valider" D49 + `/admin/parametres-delais` D52, drawer parcours B §5.11.3, factures email PJ uniquement D56).
→ `04-PLAN-EXECUTION.md` pour les 20 sprints chiffrés (dont X.5bis parcours B) + DAG dépendances.

**STOP unique respecté** — pas de Sprint X.0 déclenché tant que Will n'a pas validé la voie A (build) vs voie B (palliatif).
