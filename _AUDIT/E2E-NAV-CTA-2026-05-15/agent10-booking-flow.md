# Agent 10.4 — Booking V1 `/reserver` navigation/CTA

## Status de livraison

- **Branche `feature/booking-v1`** = HEAD `3d839d0` (« migration v1 — 15 tables booking + 18 enums »). NON MERGÉE sur main.
- `git log main..feature/booking-v1` = aucune commit visible côté main → branche divergée mais pas intégrée.
- **Main** = `/fr/reserver` contient BookingCalendar V0 (`BookingCalendarLazy` + bookings fetched depuis Prisma `Booking` + fixtures social proof).

## Code main `/fr/reserver/page.tsx` audit

**Sections présentes** (server component, 488 lignes) :

1. ✅ **Hero** : eyebrow "Calendrier" + h1 « Réserver une intervention ou un audit IA »
2. ✅ **Breadcrumbs** : `Accueil › Réserver`
3. ✅ **BookingCalendarLazy** (lazy import client component) avec `initialBookedSlots` mixé DB + fixtures (~30 fixtures 2026-05-07)
4. ✅ **`loadDbBookedSlots()`** fetch les bookings réels (90 jours horizon, anonymisés ville+secteur+taille)
5. ✅ **VISIBLE set** : essentielle / approfondie / conference / dirigeants + audit-flash-onsite + gagner-du-temps + demarrage-ia-express + atelier-ia-cible + intervention-claude → **9 formats supportés**
6. ✅ **CtaBlock** final → `<Cta href="/conditions-generales">Voir les CGV</Cta>`
7. ❌ **PAS de CTAs Stripe directs** ni Server Action `createBookingAction` (V1 only)
8. ❌ **PAS de lien retour `/interventions`** explicite (mais Breadcrumbs Accueil disponible)
9. ❌ **PAS de FAQ booking** sur la page `/reserver`

## Calendrier 14 formats — partiel

Selon `axionia_interventions_taxonomy_refonte_2026-05-11.md`, la taxonomie est 4 familles × 14 formats. La page main expose **9 formats** dans le calendrier — le reste (claude-dirigeant, conference-keynote, conference-pleniere, dirigeant-productivite, dirigeant-vision-strategique) n'a pas de slot calendrier dédié (les pages produits redirigent vers le calendrier global mais les fixtures sont restreintes).

## Booking [token] self-service magic-link

- `src/app/[locale]/booking/[token]/cancel/page.tsx` ✅ existe, `verifyMagicToken({ scope: "cancel" })` validé SSR
- `src/app/[locale]/booking/[token]/reschedule/page.tsx` ✅ existe, RescheduleForm.tsx présent
- **Test token invalide** (`test-token-mock`) : code attend `v.ok = false` → render `<Alert variant="danger">Lien invalide ou expiré (<reason>)</Alert>` (PAS un 404 — UX choisie pour ne pas fingerprinter le système token)
- ✅ Robots `noindex,nofollow` métadata
- ⚠️ Prod live test `/fr/booking/test-token-mock/cancel` = HTTP 503 actuellement (origin throttled — pas un bug logique). Tester quand origin redevient stable.

## Capacités V1 attendues vs présentes sur main

| Capacité V1 (mémoire `axionia_booking_v1_session_2026-05-13`) | Sur main ?                | Sur feature/booking-v1 ?          |
| ------------------------------------------------------------- | ------------------------- | --------------------------------- |
| X.2 Stripe checkout integration                               | ❌                        | ✅                                |
| X.3 DocuSeal                                                  | ❌                        | ❌ (manquant même feature branch) |
| X.4 state-machine option_pending                              | ❌                        | ✅                                |
| X.5/X.5bis multi-options + parcours B                         | ❌                        | ✅                                |
| X.6 cadrage                                                   | ❌                        | ✅                                |
| X.7 devis                                                     | ❌                        | ✅                                |
| X.12 BullMQ workers                                           | ❌                        | ❌                                |
| X.13 emails transactionnels                                   | ✅ partiel                | ✅                                |
| X.15 self-service magic-link cancel/reschedule                | ✅                        | ✅                                |
| X.16 géo OSM autocomplete                                     | ❌                        | ✅                                |
| X.17 legal RGPD Privacy                                       | ✅ (legal pages globales) | ✅                                |
| X.18 funnel UTM tracking                                      | ❌                        | ✅                                |
| Admin UI X.8-X.11/X.14                                        | ❌                        | ❌                                |

## Verdict

**Booking sur main = V0 + magic-link self-service uniquement**. Les visiteurs peuvent voir le calendrier social proof mais **AUCUN PARCOURS Stripe/paiement opérationnel** côté front public : le visiteur clique sur un créneau du calendrier → action visible reste « call de cadrage + acompte 50 % » mais ni l'acompte Stripe ni le cadrage form ne sont sur main.

🚨 **CTAs cassés `/reserver` = ROUGE par défaut** (puisque feature branche non mergée + DocuSeal X.3 + BullMQ X.12 toujours manquants). Le revenu N'est PAS perdu pour autant car le calendrier social proof tourne, mais le **funnel conversion direct n'existe pas** — Will doit converger soit en mergant `feature/booking-v1` (manquant X.3+X.12+admin) soit en marquant V1 comme "encore à finir".

## Test prod live

- `https://axion-ia.com/fr/reserver` → HTTP 503 actuellement (origin throttled, pas un défaut logique du code). À reconfirmer en fenêtre stable.

## P0 / P1

- **P0** : décision Will sur status `feature/booking-v1` :
  - **Option A** — Merger après finition X.3 DocuSeal + X.12 BullMQ + admin X.8-X.11/X.14 (sprint dédié 17-25j).
  - **Option B** — Cherry-pick uniquement Stripe + state-machine + cadrage minimal vers main pour débloquer revenue (~5j) et reporter le reste V2.
- **P0** : valider que `/fr/reserver` reprend HTTP 200 sur prod (l'origin était 503 au moment de l'audit — symptôme Coolify, pas code).
- **P1** : ajouter FAQ booking sur `/reserver` (conditions, acompte, annulation, reschedule) — Speakable JSON-LD.
- **P1** : ajouter lien retour `/interventions` visible dans le hero (pas seulement breadcrumb).
