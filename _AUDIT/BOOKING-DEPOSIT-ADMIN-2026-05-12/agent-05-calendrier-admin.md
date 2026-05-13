# Agent 5 — Calendrier admin (arbitrage + UX power-user + géo + capacité)

> Audit AUDIT-ONLY · Booking Deposit + Admin 2026 · Axion-IA · HEAD `ff3ccbc`
> Auditeur : Claude Opus 4.7 (1M context) — 2026-05-12
> Source brief : `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` §3 — Agent 5 (défauts D23, D24, D25, D26)
> Pré-requis lus : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` + `02-BENCHMARKS-2026.md`

---

## 1. Périmètre audité

| Fichier                                                                                           | LoC observées | Rôle                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `src/app/[locale]/(admin)/[adminPrefix]/calendrier/page.tsx`                                      | 165           | Page mois RSC `force-dynamic`, grid 7×6, no client JS                                                  |
| `src/app/[locale]/(admin)/[adminPrefix]/calendrier/CalendarBlockPanel.tsx`                        | 201           | Panel `"use client"` à 3 onglets (block/unblock/cancel)                                                |
| `src/features/admin-calendar/actions.ts`                                                          | 385           | 4 actions : `getCalendarMonthAction` / `blockDateAction` / `cancelBookingAction` / `unblockDateAction` |
| `prisma/schema.prisma` modèles `CalendarSlot:234-252`, `Booking:201-228`, `BookingOption:258-286` | 88            | Modèle 1-slot-par-jour (unique sur `slotDate`)                                                         |
| `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md`                                     | 463           | Inventaire admin Phase 0                                                                               |

Bookmarks lus pour cohérence : `02-BENCHMARKS-2026.md` (Cal.com / Calendly / Doctolib / Acuity / Linear / Vercel / Stripe / Notion / GitHub / Doctolib pro / Whereby / Jitsi / Meet).

Pas d'audit du layout admin (`(admin)/layout.tsx`) — `[INCONNU — non lu]`. Pas d'audit d'une éventuelle feuille `admin-*.css` — `[INCONNU — non listée Phase 0]`.

---

## 2. Constats positifs (≥ 3)

1. ✅ **Modèle de slot strict (1 par jour) cohérent avec la doctrine** : `CalendarSlot.slotDate @unique` (`prisma/schema.prisma:234-252`) verrouille naturellement la cardinalité D23 « 1 intervention / jour ». Aucune ambiguïté `start/end DateTime` qui ouvrirait la porte à 2 slots par jour. Le calcul des conflits passe à `O(1)` (pas de range query). C'est rare et précieux.
2. ✅ **Transaction + `SELECT … FOR UPDATE` sur block + cancel** (`src/features/admin-calendar/actions.ts:125-129` + `:223-238`). L'admin et le visiteur public ne peuvent pas race-condition le statut du slot. Audit OWASP Sprint 15 W4-2 + audit 2026-05-10 confirmés en code, pas en doc seule.
3. ✅ **Audit trail systématique** : `tx.activityLog.create` accompagne `block` (`:168-176`), `unblock` (`:368-377`), `cancel` (`:297-306`). Champ `changes Json` capture `{date, reason}`. Conforme GitHub-org-pattern (`02-BENCHMARKS-2026.md` §4 GitHub).
4. ✅ **Revalidation publique chirurgicale** : `revalidatePath("/fr/reserver")` + `/en/book` après chaque mutation (`:181-182`, `:325-328`, `:382-383`). Évite stale cache visiteur. Pattern reproductible pour V2.
5. ✅ **Email de cancellation enqueue idempotent** : `enqueueEmail("booking-cancelled", …)` après commit DB (`:317-322`), avec lookup contact via `Submission` OU fallback `BookingOption converted` (`:282-295`). Pas de perte de contact même quand le `Submission` est null.
6. ✅ **Confirmation à double saisie** sur `cancel` : input texte "annuler" exigé en + du formulaire (`CalendarBlockPanel.tsx:88-100`, bouton désactivé `:117`). Pattern Stripe Dashboard sur les actions destructives. Bien.
7. ✅ **`force-dynamic` explicite** (`page.tsx:12`) — empêche le RSC d'être prerendered au build avec un état figé. Pour un calendrier admin, c'est le bon choix (vs `revalidate` qui aurait été un piège).

---

## 3. Constats négatifs P0 / P1 / P2 / P3

### 🚨 P0 — Bloquants UX power-user / opérationnel

| #    | Constat                                                                                                                                                                                                                                                            | Source                                                              | Impact                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | **Aucune vue Jour ni Semaine** — la page ne propose que la vue Mois (`page.tsx:107-149`). Will gère des audits flash + cadrages + interventions de durées variables : impossible de zoomer sur « cette semaine ».                                                  | `page.tsx:107`                                                      | Will doit re-scroller 7 fois un mois pour voir une semaine. Doctolib pro et Linear ont 4 vues V1.                                                         |
| P0-2 | **Pas de drawer dossier client** — cliquer sur une cell n'ouvre rien. Le client / option / booking / réservation n'apparaît jamais sur la page calendrier. Aucun lien vers `/options/[id]` ni `/submissions/[id]` depuis une cell.                                 | `page.tsx:124-145`                                                  | Will doit naviguer 3 fois (calendrier → options → détail) pour qualifier une option pending. Anti-pattern Vercel/Stripe (cf. `02-BENCHMARKS-2026.md` §4). |
| P0-3 | **Annulation par UUID copié-collé** — l'admin doit saisir un UUID 36 chars dans une input texte (`CalendarBlockPanel.tsx:64-70`). Aucun picker, aucune autocomplete. Inutilisable sur mobile, friction massive sur desktop.                                        | `CalendarBlockPanel.tsx:60-70`                                      | Source d'erreur (typo UUID) + perte de temps. Aucun cabinet pro ne tolère ça en 2026.                                                                     |
| P0-4 | **Capacité Will absente** — D23 décrète 1 intervention/jour, 3/semaine, 8/mois. Aucun badge ni heatmap. Will ne sait pas, en regardant le calendrier, s'il est saturé sur la semaine 23 ou s'il a encore de la marge.                                              | `page.tsx:107-149` (aucun calcul `groupBy week/month`)              | Risque de sur-booking silencieux. Cabinet IA premium = vente d'attention rare → la capacité doit être visible.                                            |
| P0-5 | **Géo-awareness inexistante** — D24 distingue Paris/IDF (buffer 0h), France métro (0,5j), DOM-TOM/EU (1j). Aucun affichage de ville cible / buffer trajet. `Booking.interventionType` = `audit_flash_onsite` mais on ne voit ni ville ni délai trajet sur la cell. | `prisma/schema.prisma:201-228` (pas de `targetCity`/`travelBuffer`) | Will peut bloquer Jeudi un audit Marseille sans réaliser que J-1 et J+1 doivent être bloqués pour le trajet.                                              |
| P0-6 | **Aucune quick action sur slot** — confirmer / refuser / bloquer / voir client / annuler ne sont pas accessibles depuis la cell. Tout passe par le panel inférieur en saisie manuelle (date + raison + UUID). Anti-Linear par excellence.                          | `page.tsx:124-145` + `CalendarBlockPanel.tsx:51-198`                | Friction critique. Bench Linear/Doctolib pro = 1 clic depuis l'agenda.                                                                                    |
| P0-7 | **Pas de filtres** — aucun filtre par intervention, statut booking, ville pSEO, période, options pending uniquement. La vue mois est non-discriminante.                                                                                                            | `page.tsx:74-104` (header sans `<select>`)                          | Sur un mois chargé (4-8 bookings + 2-3 options pending), impossible de discriminer.                                                                       |

### ⚠️ P1 — Significatifs

| #    | Constat                                                                                                                                                                                                                                                                              | Source                                                                             | Impact                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1-1 | **Mobile responsive non vérifié** — `admin-calendar-grid` est un `grid-template-columns: repeat(7, …)` (par convention). Sur 360px, 7 colonnes deviennent ~50px = illisibles. Pas de breakpoint `md:` visible dans le markup, doctrine `[INCONNU — admin-*.css non audité Phase 0]`. | `page.tsx:115-149` (classes Tailwind absentes au sens utilitaires v4)              | Will gère en déplacement (mémoire `axionia_session_2026-05-08_first_deploy`). Mobile = critique.    |
| P1-2 | **Aucun raccourci clavier** — pas de `J/K` navigation, pas de `B=bloquer`, pas de `?=help`. Bench Linear/Stripe = standard 2026.                                                                                                                                                     | `page.tsx` + `CalendarBlockPanel.tsx` (zéro `keydown` listener)                    | UX power-user impossible. Will = mono-admin → c'est lui qui paie le manque.                         |
| P1-3 | **Pas de jours fériés FR** — un slot Lundi 14 juillet 2026 (férié) est affiché `Disponible`. Aucune lib `date-holidays` ni call à `etalab.gouv.fr/jours-feries`. D25 demande l'import auto.                                                                                          | `page.tsx:40-51` (pas de hook holiday)                                             | Will pourrait accepter une option un jour férié, ou afficher un Lundi 1er mai disponible au public. |
| P1-4 | **Pas d'export iCal signé** — D24/cible V1 demande export lecture-seule `/api/admin/calendar/ical/:token` pour synchro Google Calendar perso. Absent du repo. Grep `ical                                                                                                             | ics`dans`src/app/api/`→`[INCONNU — à grep]` mais aucun fichier listé Phase 0 §2.2. | Phase 0 §2.2 (aucune action `ical*`)                                                                | Will doit consulter 2 calendriers en parallèle. Premier outil que tout praticien réclame. |
| P1-5 | **Pas de bulk operations** — bloquer 5 jours d'affilée (vacances) = 5 soumissions de form. Pas de range-picker ni de série récurrente. Doctolib pro = standard.                                                                                                                      | `CalendarBlockPanel.tsx:122-167`                                                   | 5× temps pour Will. Coût marginal mais fréquence haute (vacances scolaires).                        |
| P1-6 | **Pas de drag & drop reschedule** — décaler un booking d'un jour = annuler + créer (perte du `Booking.id` + email cancellation envoyé au client par erreur). Bench Cal.com/Doctolib pro standard.                                                                                    | `actions.ts` (pas de `rescheduleBookingAction`)                                    | Anti-doctrine `interventions.ts:236` (« créneau reportable une fois sans frais »).                  |
| P1-7 | **Aucun affichage de conflit visuel** — comme le modèle est 1-slot-par-jour, le conflit DB est impossible. Mais le **conflit logique** (option pending + booking confirmed sur le même slot) est silencieusement bloqué par `blockDateAction:140-145` sans visualisation.            | `page.tsx:124-145`                                                                 | Will ne voit pas pourquoi telle cell refuse un block, doit deviner via le panel inférieur.          |
| P1-8 | **Substitution participant** (D26 : autorisée J-1 sans coût) — aucun champ ni action `changeParticipantAction`. Le `Booking.participantsCount` est en lecture seule depuis l'admin.                                                                                                  | `actions.ts` (4 actions, aucune `participant*`)                                    | Will doit éditer manuellement la DB ou rebooker. Hors-doctrine.                                     |

### 🟡 P2 — Améliorations

| #    | Constat                                                                                                                                                                                                                                            | Source                            | Impact                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| P2-1 | **Pas de mini-calendar de navigation** — pour aller à mai 2027, Will clique `→` 12 fois. Pas de date-picker pour saut direct.                                                                                                                      | `page.tsx:85-104`                 | Friction moyenne.                                                      |
| P2-2 | **Labels FR hardcodés** — `MONTH_LABELS` français en dur (`page.tsx:19-32`). Pas d'i18n via next-intl. Will travaille FR uniquement V1, OK, mais incohérent doctrine i18n.                                                                         | `page.tsx:19-32`                  | Cohérence.                                                             |
| P2-3 | **Pas d'icon par statut** — texte « Disponible / Réservé / Bloqué » sans pictogramme. Scan visuel plus lent.                                                                                                                                       | `page.tsx:34-38`                  | Scan calendrier sur 30 jours = optimisable.                            |
| P2-4 | **Aucune timeline d'événements par booking** — `02-BENCHMARKS-2026.md` Vercel : timeline live `booking.created → option.posted → email.sent → confirmed`. Absent.                                                                                  | `actions.ts` (pas de SSE/polling) | Confiance debug minimale.                                              |
| P2-5 | **Tab "Annuler" mal placé** — l'annulation d'une réservation devrait être contextuelle au booking, pas une 3e onglet du panel Bloquer/Débloquer. Erreur d'IA admin.                                                                                | `CalendarBlockPanel.tsx:42-49`    | UX cognitive.                                                          |
| P2-6 | **`page.tsx:122` : `status = slot?.status ?? "available"`** considère qu'un jour sans slot = disponible. C'est vrai DB-side, mais le visiteur pourrait poser une option ce même jour entre la lecture admin et le re-render. Pas de ré-fetch live. | `page.tsx:120-122`                | Affichage léger stale. Force-dynamic limite l'impact, mais pas de SSE. |

### 🔵 P3 — Cosmétique

| #    | Constat                                                                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P3-1 | `slot.pendingOptionsCount > 1 ? "s" : ""` (`page.tsx:137`) — pluralisation correcte mais "pend." abréviation cryptique. Préférer `option(s) en attente`. |
| P3-2 | Bouton "Aujourd'hui" est noté `⌂` (caractère maison) au lieu du standard "Aujourd'hui" textuel. Cryptic (`page.tsx:96`).                                 |
| P3-3 | `MONTH_LABELS` aurait pu être dérivé de `Intl.DateTimeFormat("fr-FR", { month: "long" })` (boilerplate-zero).                                            |

---

## 4. Recommandations classées impact × effort inverse (Top 12)

> Notation : `IMPACT (1-5) / EFFORT (1-5)` — plus haut = meilleur ratio. V1 = à faire dans le sprint admin V1. V2+ = après sign-off.

| Rang | Reco                                                                                                                                                                                                                                                             | Impact / Effort | V1/V2+ | Lien défaut/bench                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ----- | --- | --------------------------------------------- |
| R1   | **Cliquer une cell ouvre un drawer latéral dossier client** (Radix `Sheet`) avec : booking + submission + options pending + timeline + 4 quick actions (Voir / Confirmer option / Refuser / Annuler booking). Remplace 80 % de `CalendarBlockPanel`.             | 5 / 2           | V1     | P0-2, P0-6, Vercel `02-BENCHMARKS-2026.md` §4                                                                      |
| R2   | **Vue Semaine + Vue Jour** (tabs simples `[Mois                                                                                                                                                                                                                  | Semaine         | Jour   | Agenda]`). Réutilise `getCalendarMonthAction` avec range étendu. Agenda = liste plat triée des 90 prochains jours. | 5 / 2 | V1  | P0-1, Doctolib pro `02-BENCHMARKS-2026.md` §4 |
| R3   | **Capacité Will heatmap** : badge en haut de chaque semaine (`2/3 sem`) + couleur cell (vert ≤ saturation, jaune = saturé, rouge > saturation). Calculé client-side depuis le tableau slots déjà chargé. D23.                                                    | 5 / 2           | V1     | P0-4, D23                                                                                                          |
| R4   | **Filtres barre** : `<select>` intervention (enum 7 valeurs) + statut booking + ville (text) + checkbox « options pending only » + range dates. Pousse les valeurs en `searchParams`, RSC re-render automatique.                                                 | 4 / 2           | V1     | P0-7, Stripe `02-BENCHMARKS-2026.md` §4                                                                            |
| R5   | **Jours fériés FR via `date-holidays` lib** (zéro dépendance externe runtime, JSON statique). Cell `férié` affichée avec petite étiquette « 14 juil. — Fête nat. » + bordure striée. Bloque l'option visiteur automatiquement.                                   | 4 / 2           | V1     | P1-3, D25                                                                                                          |
| R6   | **Géo-awareness audit_flash_onsite** : sur la cell d'un booking `audit_flash_onsite`, afficher `📍 Lyon — buffer 0,5j`. Calculé depuis `Submission.details.city` + table de buffer par zone (Paris/IDF=0, métro=0,5j, DOM-TOM=1j). Auto-bloque J-1/J+1 si métro. | 5 / 3           | V1     | P0-5, D24                                                                                                          |
| R7   | **Quick action menu contextuel** sur cell : right-click ou kebab `…` → Voir / Bloquer / Annuler / Reporter. Évite le panel inférieur en saisie.                                                                                                                  | 4 / 2           | V1     | P0-6                                                                                                               |
| R8   | **Mobile-first refonte** : breakpoint `< md` bascule sur vue Agenda (liste verticale, pas grid 7×6). Card par jour, swipe gauche pour ouvrir drawer. Use `@container` queries Tailwind v4.                                                                       | 5 / 3           | V1     | P1-1                                                                                                               |
| R9   | **iCal export endpoint `/api/admin/calendar/ical/:token`** (token signé HMAC, durée 90j). Will copie l'URL dans Google Calendar « subscribe ». Lecture seule, refresh CG-side ~24h.                                                                              | 4 / 2           | V1     | P1-4, D24                                                                                                          |
| R10  | **Raccourcis clavier minimaux** : `←/→` mois, `T` aujourd'hui, `B` ouvre block dialog, `?` overlay help. Implémentation `useEffect` global. Bench Linear.                                                                                                        | 3 / 1           | V1     | P1-2, Linear `02-BENCHMARKS-2026.md` §4                                                                            |
| R11  | **Bulk block range** : input `from / to` + raison commune. 1 transaction, 1 ActivityLog batché. Sert vacances scolaires.                                                                                                                                         | 3 / 2           | V1     | P1-5                                                                                                               |
| R12  | **Substitution participant J-1** (D26) : nouvelle action `changeBookingParticipantsAction` (super_admin/admin) sans coût si `bookingDate - now > 24h`. Email transactionnel `participants-changed` aux 2 contacts (ancien si distinct, nouveau).                 | 3 / 3           | V1     | P1-8, D26                                                                                                          |

**Reportées V2+** : drag & drop reschedule (P1-6, coût UX d&d + invalidation cache + race anti-pattern, prefer reschedule via drawer R1) · timeline SSE live (P2-4) · mini-calendar de navigation (P2-1) · i18n EN admin (P2-2) · session replay PostHog (`02-BENCHMARKS-2026.md` §4).

---

## 5. Sources citées

- `src/app/[locale]/(admin)/[adminPrefix]/calendrier/page.tsx:1-165` — vue mois RSC.
- `src/app/[locale]/(admin)/[adminPrefix]/calendrier/CalendarBlockPanel.tsx:1-201` — panel 3 onglets.
- `src/features/admin-calendar/actions.ts:56-385` — 4 actions admin.
- `prisma/schema.prisma:234-252` — `CalendarSlot` 1-slot-par-jour `slotDate @unique`.
- `prisma/schema.prisma:201-228` — `Booking` avec FK `slotId? @unique`.
- `prisma/schema.prisma:258-286` — `BookingOption` (FK `slotId` Cascade, status enum).
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md:160-217` (inventaire actions admin) + §1.2 modèles.
- `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/02-BENCHMARKS-2026.md` §4 Linear/Vercel/Stripe/Notion/Doctolib pro/GitHub.
- Décisions Will : D23 (capacité 1/3/8), D24 (géo buffer), D25 (jours fériés), D26 (substitution J-1).

---

## 6. Score /100

| Catégorie                        | Poids | Score brut | Pondéré  | Commentaire                                                                  |
| -------------------------------- | ----- | ---------- | -------- | ---------------------------------------------------------------------------- |
| Complétude V1 vs cible           | 20    | 35 /100    | 7,0      | Vue mois only. Pas de Sem/Jour/Agenda. Pas de filtres. Pas de quick actions. |
| UX power-user (kbd, palette)     | 15    | 10 /100    | 1,5      | Zero raccourci. Zéro Cmd+K. Zéro autocomplete.                               |
| Mobile-first responsive          | 15    | 25 /100    | 3,8      | Grid 7×6 non testé sur 360px. Pas de fallback agenda mobile.                 |
| Géo-awareness (D24)              | 10    | 0 /100     | 0,0      | Aucun affichage ville / buffer trajet.                                       |
| Capacité Will visible (D23)      | 10    | 0 /100     | 0,0      | Aucun badge saturation. Risque sur-booking silencieux.                       |
| Drawer dossier client + timeline | 10    | 10 /100    | 1,0      | Aucun drawer. Tout passe par UUID saisi manuellement.                        |
| Bulk + récurrent + reschedule    | 5     | 0 /100     | 0,0      | Aucun mécanisme.                                                             |
| Jours fériés FR (D25)            | 5     | 0 /100     | 0,0      | Absent.                                                                      |
| iCal export (D24/V1)             | 5     | 0 /100     | 0,0      | Endpoint inexistant.                                                         |
| Doctrine état & verrous OK       | 5     | 90 /100    | 4,5      | `FOR UPDATE` + activityLog + revalidatePath chirurgical = excellent.         |
| **Total**                        | 100   |            | **17,8** |                                                                              |

### Score final : **18 / 100** — état actuel = squelette fonctionnel V1 minimal (block/unblock/cancel) sans la couche UX power-user et sans aucun des défauts D23-D26.

> Comparé au baseline « cabinet pro 2026 » (Doctolib pro, Linear, Stripe Dashboard, Vercel), il manque 82 points. Le code en place est **solide sur les fondations DB + transactions + audit log** (5 constats positifs majeurs), mais la **couche UX et la couche doctrine D23-D26 sont à zéro**.

---

## 7. Marquage V1 vs V2+

### V1 (doit shipper avec le sprint admin V1)

- R1 Drawer dossier client (P0-2 + P0-6).
- R2 Vue Semaine + Vue Jour + Agenda (P0-1).
- R3 Heatmap capacité Will D23 (P0-4).
- R4 Filtres barre searchParams (P0-7).
- R5 Jours fériés FR `date-holidays` (P1-3 / D25).
- R6 Géo-awareness `audit_flash_onsite` D24 (P0-5).
- R7 Quick action menu contextuel (P0-6).
- R8 Mobile-first agenda fallback (P1-1).
- R9 iCal export signed token (P1-4 / D24).
- R10 Raccourcis clavier minimaux (P1-2).
- R11 Bulk block range (P1-5).
- R12 Substitution participant J-1 D26 (P1-8).

### V2+ (après sign-off)

- Drag & drop reschedule (P1-6) → préfère reschedule via drawer en V1.
- Timeline SSE live booking (P2-4).
- Mini-calendar date-picker (P2-1).
- i18n EN admin (P2-2).
- Cmd+K palette admin globale (cohérent `_AUDIT/Header Nav 2026`).
- Comptes-rendus auto cadrage (Whereby AI transcription, voir `02-BENCHMARKS-2026.md` §5).
- Multi-admin real-time sync (Linear-style WebSocket).

---

## 8. Mockup ASCII

### 8.1 Vue Mois cible (post R1+R3+R4+R5+R6+R7+R10)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Calendrier · Mai 2026                                              [ ?  raccourcis ] │
│  31 créneaux actifs · cap. semaine en cours : 1/3 ▓░░ · mois : 4/8 ▓▓░░               │
│                                                                                       │
│  [ Mois ] [ Semaine ] [ Jour ] [ Agenda ]   ⌂ Aujourd'hui   ← Avr · Juin →           │
│                                                                                       │
│  Filtres : [Intervention ▼] [Statut ▼] [Ville  ] [ ] options pending  [Réinit.]     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Lun        Mar         Mer         Jeu         Ven         Sam         Dim          │
│  ─────────  ─────────   ─────────   ─────────   ─────────   ─────────   ─────────    │
│  · 27       28          29          30 [TODAY] · 1 FÉRIÉ  · 2          · 3           │
│  réservé    bloqué      dispo       dispo       Fête trav  dispo       dispo         │
│  📍 Lyon    🏖 congés   ▒ cap.OK   1 opt pend. (auto-blq)  cap.OK     cap.OK         │
│  flash      14→18 mai   audit      audit                                              │
│  -0,5j      ─────────                                                                  │
│  ─────────                                                                            │
│  · 4        · 5         · 6         · 7         · 8 FÉRIÉ  · 9        · 10           │
│  dispo      réservé     dispo       réservé     V-J 1945   dispo      dispo          │
│  cap.OK     📍 Paris    cap.OK     📍 Marseille (auto-blq) cap.SAT    cap.SAT       │
│             essentielle              audit fl.  ▓▓░         3/3 sem.   3/3 sem.       │
│             ─0h─                     -0,5j J-1+1                                      │
│  ─────────                                                                            │
│  · 11       · 12        · 13 [HOV] · 14         · 15        · 16       · 17          │
│  bloqué     dispo       dispo      réservé      dispo       dispo      dispo         │
│  vacances   2 opt pend.  cap.OK    📍 Lille     cap.OK      cap.OK     cap.OK        │
│             ▒▒          ↘ option   approfondie                                        │
│                         click → drawer                                                │
│  ─────────                                                                            │
│  …                                                                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  Légende : ▓ saturation (cap.OK / SAT / FULL)   📍 ville (audit flash)  ─Xj buffer  │
│  Touches : ← → mois  T aujourd'hui  B bloquer  / chercher  ? aide                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Notes sur le mockup :

- Cell `30 [TODAY]` reprend `admin-calendar-cell-today` actuel (`page.tsx:127`).
- `cap.OK / SAT / FULL` = badges D23, rendu côté serveur via `groupBy week`.
- `📍 Lyon` + `-0,5j` = D24 géo-awareness (R6).
- `1 FÉRIÉ Fête trav` = R5 `date-holidays`. `(auto-blq)` = visuel public non-bookable.
- `J-1+1` sur 14 mai = R6 auto-buffer audit flash Marseille (métro 0,5j).
- `HOV` = curseur sur la cell → halo (R7 quick actions kebab apparait).

### 8.2 Drawer dossier client (R1, ouvert depuis cell `13 mai · 2 opt pend.`)

```
┌──────────────────────────────────┬────────────────────────────────────────────────────┐
│  Calendrier · Mai 2026 (…)       │  Drawer · 13 mai 2026                       ✕ ESC  │
│                                  │                                                    │
│  …grid en arrière-plan dimm…     │  ┌─ Slot 13/05 ────────────────────────────────┐  │
│                                  │  │  Status : disponible (2 options pending)    │  │
│  · 13                            │  │  Cap. : OK (semaine 2/3)                    │  │
│  HOV ← cell active               │  └─────────────────────────────────────────────┘  │
│  2 opt pend.                     │                                                    │
│                                  │  ─── Option 1 · pending · expire dans 36h ───     │
│                                  │  Solar Industries SARL · Lyon (69) · 12 pax       │
│                                  │  Intervention : essentielle_demi_journee          │
│                                  │  Contact : alice.dupont@solar.fr · 06 12 34 …    │
│                                  │  Soumis : 11/05 14:23 (IP 90.10.x.x)              │
│                                  │  Notes : « Préparons salon mid-juin »             │
│                                  │  [ ✓ Confirmer ] [ ✗ Refuser ] [ Voir détail → ]  │
│                                  │                                                    │
│                                  │  ─── Option 2 · pending · expire dans 12h ───     │
│                                  │  Bleuet SAS · Paris (75) · 8 pax                  │
│                                  │  Intervention : audit_flash_onsite                │
│                                  │  📍 Paris — buffer 0h (IDF, OK même jour)        │
│                                  │  [ ✓ Confirmer ] [ ✗ Refuser ] [ Voir détail → ]  │
│                                  │                                                    │
│                                  │  ─── Timeline ──────────────────────────────      │
│                                  │  · 11/05 14:23  option.posted (Solar)             │
│                                  │  · 11/05 14:23  email-worker  option-posted FR    │
│                                  │  · 11/05 14:23  telegram      OPTION              │
│                                  │  · 12/05 10:00  option-reminder (Solar)  ⏰       │
│                                  │  · 12/05 17:42  option.posted (Bleuet)            │
│                                  │  · 12/05 17:42  email-worker  option-posted FR    │
│                                  │  · 12/05 17:42  telegram      OPTION              │
│                                  │                                                    │
│                                  │  ─── Actions slot ──────────────────────────      │
│                                  │  [ Bloquer la date ]  [ Refuser les 2 options ]   │
│                                  │  [ Exporter iCal (ce slot) ]                      │
│                                  │                                                    │
│                                  │  Raccourcis : C confirmer · R refuser · B bloquer │
└──────────────────────────────────┴────────────────────────────────────────────────────┘
```

Notes :

- Drawer = `Sheet` Radix, animation `slide-from-right`, focus trap, ESC ferme.
- Réutilise `validateOptionAction` / `refuseOptionAction` (Phase 0 §2.2) sans nouvelle action backend.
- `📍 Paris — buffer 0h` reprend R6.
- Timeline = SSR depuis `ActivityLog` + workers + telegram (déjà tous loggés, juste à `prisma.findMany(orderBy:createdAt)`).
- 2 raccourcis clavier C/R/B contextuels à la modale ouverte.

---

**Fin Agent 5** — `agent-05-calendrier-admin.md` — Score 18 / 100 — Auditeur : Claude Opus 4.7 (1M context) — 2026-05-12.
