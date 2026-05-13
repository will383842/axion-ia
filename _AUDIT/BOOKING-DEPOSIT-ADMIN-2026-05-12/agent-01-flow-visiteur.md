# Agent 01 — Flow visiteur `/reserver` (UX premium)

> Audit AUDIT-ONLY · HEAD `ff3ccbc` · 2026-05-12 · Claude Opus 4.7 (1M context)
> Périmètre : flow de réservation visiteur (page `/reserver` + composants `src/components/calendar/**` + CTAs cross-pages + Server Actions exposées).
> Cible : « UX visiteur parfaite : zéro friction inutile, état de la réservation toujours clair, lien magique self-service, Customer Portal Stripe » (prompt source §0.0 critère 7).

---

## 1. Périmètre audité

J'ai audité le flow visiteur de bout en bout : (a) la page Server Component `src/app/[locale]/reserver/page.tsx` (482 lignes) avec son `loading.tsx` et son chargement DB anonymisé, (b) le wrapper lazy `BookingCalendarLazy.tsx`, (c) le composant client `BookingCalendar.tsx` (2 153 lignes : sidebar intervention, calendrier mensuel, modal 4 étapes, autosave localStorage, témoignages rotatifs), (d) les composants secondaires `HouseCalendar.tsx`/`BookingFlow.tsx` (non utilisés sur `/reserver` aujourd'hui — résiduels), (e) les 12 fichiers émettant `href="/reserver"` ou `/reserver?…`, (f) les Server Actions `createBookingAction` et `postOption48hAction` (`src/features/booking/actions.ts`), (g) la primitive `Dialog` (`src/components/ui/dialog.tsx`) et le helper `verifyTurnstile` (`src/lib/turnstile.ts`). J'évalue l'écart vs cible « zéro friction + état clair + lien magique + Customer Portal ».

---

## 2. Constats positifs

1. ✅ **Multi-step modal avec autosave localStorage debounced 400 ms + détection de brouillon** — `src/components/calendar/BookingCalendar.tsx:405-560`. Aucune perte de données si fermeture accidentelle ; flush coalesce qui protège l'INP. Best practice 2026, supérieur à Calendly « hosted » (qui n'autosauve pas).
2. ✅ **Verrou pessimiste Postgres `SELECT … FOR UPDATE`** dans `postOption48hAction` (`src/features/booking/actions.ts:194-235`) — anti race-condition sur la pose d'option 48h, doctrine doc 09b respectée à la lettre.
3. ✅ **Loading skeleton dimensionné à la hauteur réelle (`min-h-[800px]`)** sur `src/app/[locale]/reserver/loading.tsx:33-41` + skeleton interne `BookingCalendarLazy.tsx:31-37` — CLS cible 0 documenté (commentaire ligne 4 : « CLS 0,552 avant fix »).
4. ✅ **Anonymisation rigoureuse des bookings réels** côté Server Component (`reserver/page.tsx:42-88`) : jamais de `companyName`, seulement city/sector/companySize + bracketing fallback `bracketParticipants()`. RGPD social-proof safe.
5. ✅ **`aria-label` riche sur chaque cellule date** (`BookingCalendar.tsx:1028-1044`) avec état « réservé / passé / disponible / non disponible (chevauchement) » + `title` détaillé pour les cellules booked.
6. ✅ **Pré-fill `?intervention=slug` + `?tier=` fonctionnel** (`BookingCalendar.tsx:309-327`) + synchronisation URL ↔ state via `router.replace` `{ scroll: false }` (`:345`) — état partageable, navigation back-safe.
7. ✅ **Taille touch ≥ 44 px** : flèches nav `h-11 w-11` (`BookingCalendar.tsx:979` + `:987`), bouton fermeture Radix `h-11 w-11` (`dialog.tsx:48`), pastilles step `h-14 w-14` mobile (`:1539`). WCAG 2.5.5 AA respecté.
8. ✅ **Recap step 4 avec trust badge final** (Hetzner Frankfurt + RGPD + Cabinet européen, `BookingCalendar.tsx:1949-1963`) juste avant le CTA Confirmer — pattern Stripe Checkout : maximum de rassurance au moment du commit.

---

## 3. Constats négatifs (par sévérité)

### 🚨 P0 — Bloquants conversion / fonctionnels

**P0-1. Aucun widget Turnstile injecté dans le DOM du booking → 100 % des soumissions seront rejetées en prod**
Le Server Action `createBookingAction` exige le token captcha (`booking/actions.ts:51-54` : `if (!(await verifyTurnstile(token, ip))) return { ok: false, error: "Captcha échoué." }`). Or `BookingCalendar.tsx` (2 153 lignes) **n'inclut aucun composant `<Turnstile>` ni `<script>` Turnstile** : `grep -i turnstile|cf-turnstile-response` → 0 hit dans le fichier. La page envoie `formData` (`:732-747`) sans jamais positionner `cf-turnstile-response`. En dev local (`NEXT_PUBLIC_APP_ENV=development`), `verifyTurnstile` retourne `true` même sans token (`turnstile.ts:27-31`) → bug invisible localement. **En prod (V2.1 LIVE), tout submit échoue silencieusement** affichant juste « Captcha échoué » dans `submitError` (`BookingCalendar.tsx:1498-1502`).

**P0-2. Mensonge UX critique : « réservation finalisée après call de cadrage + acompte 50 % » mais aucun call ni paiement n'existe en code**
La page hero affiche `reserver/page.tsx:447-448` : « Réservation finalisée après call de cadrage + acompte 50 % » et le CtaBlock final `:471-472` : « Le créneau est verrouillé après le versement de l'acompte 50 % ». L'écran succès liste 3 étapes incluant « Versement du premier acompte (50 %). Virement bancaire ou carte. Facture immédiate » (`BookingCalendar.tsx:1262-1268`). **Réalité** : (a) `package.json` ne contient aucun SDK Stripe (cf. Reality Check §7.1), (b) aucun template email `payment-link.tsx` ni `quote-sent.tsx`, (c) `Booking.pricePaidCents` n'est qu'un montant indicatif sans statut de règlement (Reality Check §1.1, GAP #1, #3, #4). Le visiteur croit s'engager dans un parcours payant qui n'existe pas. Risque conformité contractuelle + perte de confiance dès la 1re interaction commerciale.

**P0-3. Le mot « Réservation » et le bouton « Confirmer la réservation » sont trompeurs**
Le bouton final `BookingCalendar.tsx:1493` est `« Confirmer la réservation »` / `« Confirm booking »` alors que ce qui est créé est une `Submission` + `Booking.status=pending` sans verrouillage de slot (`booking/actions.ts:89-127`). Le visiteur attend une confirmation ferme (modèle mental Doctolib/Cal.com). Le bandeau succès `BookingCalendar.tsx:1238-1240` rattrape (« Votre réservation n'est pas encore confirmée ») mais après le clic — c'est trop tard, le commitment cognitif est posé. Calendly et Stripe Checkout sont explicites en amont : « Request a slot » / « Hold this slot ». Ici on dit « Confirmer » → puis « pas confirmée ».

**P0-4. La Server Action `postOption48hAction` (option 48h) n'est jamais appelée depuis l'UI**
`grep postOption48hAction src/` → 1 seul hit, l'export lui-même. `BookingCalendar.tsx:750` n'appelle que `createBookingAction`. Conséquence : le verrou pessimiste anti-race-condition (doctrine doc 09b) est mort en pratique. Deux visiteurs peuvent envoyer `createBookingAction` simultanément sur la même date → deux `Booking.status=pending` se créent, aucun verrou sur `calendar_slot`. La fixture `bookedByDate` (`:380-393`) bloque l'UI **client-side seulement** ; bypass trivial (curl direct).

**P0-5. Les query params `?ville=` `?service=` `?from=` produits par les pages amont ne sont jamais lus**
`grep searchParams.get("ville"|"service"|"from") src/` → 0 hit dans BookingCalendar. Or `audit/page.tsx:185`, `interventions/essentielle/page.tsx:133`, `implantations/[region]/[ville]/page.tsx:264,811,882`, `VilleServicePageTemplate.tsx:355,529`, `VilleServiceDetailSection.tsx:300` **construisent** ces query params (`/reserver?ville=paris&service=audit`). Le visiteur arrive avec une intention encodée dans l'URL qui est ignorée → il doit re-saisir sa ville en step 1 (`BookingCalendar.tsx:1695-1701`). Friction directe vs benchmark Doctolib (« pré-remplissage exhaustif ») et Acuity (« intake forms liés au type »).

**P0-6. Aucun honeypot `website` dans le formulaire**
Le Server Action lit `formData.get("website")` (`booking/actions.ts:49`) comme honeypot anti-bot, mais `BookingCalendar.tsx` n'a aucun champ `<input name="website">` (visible ou hidden hors écran). Doctrine `_AUDIT/` Sprint 15 Fork 3 C1-3 dit « Honeypot champ `website` uniforme sur tous les forms » — ici la couverture est **0** pour `/reserver`. Les 5 autres forms (audit/contact/etc.) sont conformes ; `/reserver` est l'exception. Bots passent sans friction.

### ⚠️ P1 — Friction conversion / a11y dégradée

**P1-1. Pas de gestion d'erreur granulaire `slot_taken` côté UI**
`createBookingAction` retourne un message générique « Champs invalides. » / « Captcha échoué. » / « Trop de tentatives. ». Aucun cas `slot_taken` n'est géré (cohérent : la fonction ne le retourne pas — voir P0-4). `BookingCalendar.tsx:766-773` affiche le `submitError` brut. Manque le pattern Stripe Checkout : afficher un état spécifique « Ce créneau vient d'être pris à l'instant — proposez-en un autre » avec re-render des slots, sinon le visiteur ne sait pas s'il doit retenter ou changer de date.

**P1-2. Step 3 (Contexte IA) entièrement optionnel sauf signal flou**
`canStep3 = true` (`BookingCalendar.tsx:783`). Le step ajoute 3 questions (`aiUsage`/`hasAutomations`/`auditInterest`) + champ libre + commentaires. Aucune n'est requise, aucune n'a d'utilité immédiate côté visiteur. C'est un step ajouté pour le besoin admin (qualification lead) sans contrepartie UX visiteur. Best practice Calendly : intake forms **après** booking, pas dedans, pour ne pas alourdir le funnel.

**P1-3. `BookingCalendar` est ssr:false (`BookingCalendarLazy.tsx:27`) → le calendrier n'est jamais SSR**
Bénéfice perf clair (−50 KB gz, commentaire ligne 6). **Coût** : 800 ms de skeleton sur 4G médiocre, et zéro HTML crawlable du calendrier pour Bing/IndexNow. Cible interne `/reserver` INP ≤ 150 ms (`AGENTS.md`) → ssr:false pénalise LCP mobile bas de gamme. Audit Web Vitals 2026-05-08 a déjà observé `/reserver` Perf 66 / CLS 0.552 (fix du skeleton depuis, mais LCP non rejoué). Pas un P0 puisque la page reste indexable (hero + breadcrumbs + CtaBlock SSR) mais visible.

**P1-4. Le label `aria-pressed` est utilisé sur les boutons de sélection au lieu de `role="radio"` + `aria-checked`**
`BookingCalendar.tsx:818` (intervention cards), `:1663-1677` (size options), `:1797-1812` (aiUsage). `aria-pressed` est correct pour un toggle binaire mais ces composants forment un choix exclusif radio → WCAG 4.1.2 préfère `role="radiogroup"` + `role="radio"` + `aria-checked` (pattern WAI-ARIA Authoring Practices 1.3). Tester avec NVDA/JAWS : annoncé « toggle button pressed » au lieu de « radio button checked ».

**P1-5. Pas de live region pour les changements d'étape**
Le `<ProgressBar>` (`BookingCalendar.tsx:1515-1574`) affiche visuellement le step actif. Mais le passage step 1 → 2 ne déclenche **aucune `aria-live="polite"` annonce** (« Étape 2 sur 4 : Vous »). Le screen reader user perd le contexte de progression. Cf. `HouseCalendar.tsx:197-201` qui démontre déjà le pattern correct (live region pour le nombre de slots).

**P1-6. `<Dialog>` Radix sans `aria-describedby` explicite quand `DialogDescription` est conditionnellement omis**
`BookingCalendar.tsx:1212-1218` n'affiche `DialogDescription` que si `openSlot && submittingState !== "success"`. En état success, Radix peut produire un warning DOM `Missing 'Description' or 'aria-describedby={undefined}'`. Mineur mais lint accessibility moderne (Radix 1.0+) le signale.

**P1-7. Le bouton fermeture du Dialog cohabite mal avec le bandeau `bg-halo-warm`**
`dialog.tsx:46-51` positionne `<DialogClose>` à `right-3 top-3` absolu, alors que BookingCalendar dessine un bandeau header `bg-halo-warm` plein `px-6 py-5` (`:1168`). Sur mobile, le `X` chevauche le rond décoratif `bg-terracotta/15` (`:1172`) → contraste insuffisant. WCAG 1.4.11 non-text contrast 3:1 potentiellement raté.

**P1-8. Validation d'email front trop laxiste**
`canStep2` test `/^\S+@\S+\.\S+$/` (`BookingCalendar.tsx:781`). Accepte `a@b.c`. Idem téléphone `length > 5` : `+1234` passe. Best practice 2026 : valider format E.164 sur le tel (regex `^\+?[1-9]\d{6,14}$`) et un email plus strict (HTML5 `type="email"` est déjà là mais pas exploité côté validate). Sur un cabinet B2B premium, un email mal formé = lead perdu.

**P1-9. Skeleton du calendrier non-responsive**
`BookingCalendarLazy.tsx:33` `min-h-[800px]` fixe → sur mobile portrait 360 px, le vrai calendrier fait ~620 px (cellules plus petites). Le skeleton sur-réserve 180 px → CLS « négatif » (le contenu remonte au swap), pas catastrophique mais visible.

### 🟡 P2 — Polish & doctrine

**P2-1. Pas de dark mode**
`grep "dark:|prefers-color-scheme" BookingCalendar.tsx` → 0. Toute la page est `bg-paper`/`bg-bg`/`text-fg` qui sont des tokens semantic mais sans variant `dark:`. Si le site supporte le dark globalement (vérifier ailleurs), `/reserver` casse l'expérience. Si le site est volontairement light-only (doctrine cabinet premium), à documenter ADR.

**P2-2. CTAs cross-page incohérents — 12 fichiers, 4 patterns d'URL différents**
`Header.tsx:108` → `/reserver` nu · `audit/page.tsx:185` → `/reserver?intervention=audit-flash-onsite` · `implantations/[region]/[ville]/page.tsx:264` → `/reserver?ville=${slug}` · `VilleServicePageTemplate.tsx:355` → `/reserver?ville=${slug}&service=${service}` · `interventions/essentielle/page.tsx:133` → `/reserver?intervention=essentielle&tier=${id}`. Seul le pattern `?intervention=` est lu (cf. P0-5). Pas de tracking `track="hub_cta_book"` (présent uniquement sur `implantations/page.tsx:275`). Inégalité d'instrumentation.

**P2-3. Témoignages floating en français hardcodés dans les rôles EN**
`BookingCalendar.tsx:1976-1977` `roleFr: "DRH · ETI industrielle · Lyon, 250 personnes"`, `roleEn: "HR Director · mid-size industrial · Lyon, 250 people"` — OK. Mais `daysAgoFr: "il y a 12 jours"` (`:1982`) — semaine fixe, pas calculé dynamiquement. Le visiteur revient 6 mois plus tard, c'est toujours « il y a 12 jours » → faux signal social proof.

**P2-4. Composants morts dans `src/components/calendar/`**
`HouseCalendar.tsx` + `BookingFlow.tsx` ne sont importés nulle part dans `/reserver`. `grep "HouseCalendar\\|BookingFlow" src/` → 0 ailleurs (à confirmer Phase 0 plus large). Dette technique cosmétique. Reality Check §3.2 les liste comme « Calendrier maison » mais c'est `BookingCalendar.tsx` qui sert.

**P2-5. `useSearchParams()` sans Suspense boundary**
`BookingCalendar.tsx:306`. En Next 15+ stricte, `useSearchParams()` doit être wrappé dans `<Suspense>` pour static rendering. Ici ça passe parce que `BookingCalendarLazy.tsx:27` impose `ssr: false`, donc le composant n'est jamais rendu côté serveur. Mais c'est de la « chance » architecturale, pas un design intentionnel.

### 🟢 P3 — Optimisations marginales

**P3-1.** Le carousel testimonials (`FloatingTestimonial`) rote toutes les 7s sans `prefers-reduced-motion`. WCAG 2.3.3.
**P3-2.** Le composant `<Cta>` final (`reserver/page.tsx:475-477`) contient `→` brut en char 0x86 (encoding mojibake visible ligne 477 : `â†'`). Souci d'encodage UTF-8 du fichier.
**P3-3.** Pas de `prefetch` sur les liens internes (`/conditions-generales`) — Next 16 le fait par défaut sur `<Link>`, OK si `Cta` wrap `<Link>` (à vérifier).
**P3-4.** `aria-live="polite"` manquant sur le badge « X réservations cette semaine » (`BookingCalendar.tsx:909`) qui se met à jour optimiste après submit.

---

## 4. Recommandations (impact ÷ effort)

| #   | Reco                                                                                                                                                                                                                                                                                                                   | Impact | Effort | Priorité | V1/V2+  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | -------- | ------- |
| 1   | **Injecter `<Turnstile>` invisible côté `BookingCalendar`** avec écoute du token + push dans `formData.set("cf-turnstile-response", token)` avant submit. Sinon retirer `verifyTurnstile` du booking.                                                                                                                  | 🔴🔴🔴 | S      | P0       | **V1**  |
| 2   | **Renommer le funnel « Demander un créneau » / « Hold this slot »** sur le hero, le bouton final (`BookingCalendar.tsx:1493`) et l'écran succès. Aligner avec le wording deposit-gated cible.                                                                                                                          | 🔴🔴🔴 | S      | P0       | **V1**  |
| 3   | **Câbler `postOption48hAction` à la place de `createBookingAction`** + créer un slot `calendar_slot` au moment du clic date (verrou Postgres FOR UPDATE).                                                                                                                                                              | 🔴🔴🔴 | M      | P0       | **V1**  |
| 4   | **Pré-fill `?ville=` / `?service=` / `?from=`** dans `BookingCalendar` (mêmes 3 lignes que l'`interventionFromUrl`, ligne 309) + persister `companyCity` step 1.                                                                                                                                                       | 🔴🔴   | XS     | P0       | **V1**  |
| 5   | **Ajouter `<input type="text" name="website" autoComplete="off" tabIndex={-1} className="sr-only" />`** dans le form (honeypot uniforme).                                                                                                                                                                              | 🔴     | XS     | P0       | **V1**  |
| 6   | **Retirer le wording « acompte 50 % » + « facture immédiate »** tant que Stripe n'est pas branché, OU décaler ces messages dans l'email post-cadrage. Doctrine code = SSOT.                                                                                                                                            | 🔴🔴🔴 | XS     | P0       | **V1**  |
| 7   | **Gérer `slot_taken` / `rate_limit` / `captcha` côté UI** avec messages spécifiques + bouton « Choisir un autre créneau » qui rouvre le calendrier.                                                                                                                                                                    | 🔴🔴   | S      | P1       | **V1**  |
| 8   | **Convertir les choix exclusifs en `role="radiogroup"`** (intervention cards, size, aiUsage, hasAutomations, auditInterest).                                                                                                                                                                                           | 🔴     | S      | P1       | **V1**  |
| 9   | **`aria-live="polite"` sur step transitions** + sur le badge « Prochain dispo » qui change.                                                                                                                                                                                                                            | 🟠     | XS     | P1       | **V1**  |
| 10  | **Customer Portal self-service** post-confirmation : page `/reserver/confirmation/[token]` qui montre l'état (`pending` → `paid_deposit` → `confirmed` → `signed`) + lien de paiement Stripe Customer Portal pour modifier carte / télécharger facture / annuler avec recompute du remboursement (CGV `legal.ts:134`). | 🔴🔴🔴 | XL     | P0 cible | **V2+** |

---

## 5. Sources citées

- `axionia/_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md` §1.1 (absence Payment/Invoice), §1.3 (Booking model), §3.1 (page /reserver), §3.2 (composants calendar), §3.3 (CTAs 12 fichiers), §7.1 (Stripe absent), §9 GAPs #1 #3 #4.
- `axionia/_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/02-BENCHMARKS-2026.md` Catégorie 1 (Calendly, Cal.com, Doctolib, Acuity), Catégorie 2 (Stripe Checkout hosted SAQ-A).
- `axionia/src/app/[locale]/reserver/page.tsx` lignes 27-95 (loadDbBookedSlots anonymisé), 108-377 (fixtures), 447-448 (hero deposit), 471-472 (CtaBlock).
- `axionia/src/app/[locale]/reserver/loading.tsx` lignes 33-41 (skeleton sized).
- `axionia/src/components/calendar/BookingCalendar.tsx` lignes 77-186 (INTERVENTION_OPTIONS hardcodé), 306-327 (searchParams), 405-560 (autosave/draft), 698-774 (handleSubmit), 1090-1109 (booked cells), 1212-1218 (DialogDescription cond), 1238-1296 (success state 3 steps), 1493 (« Confirmer la réservation »), 1515-1574 (ProgressBar), 1976-2011 (testimonials hardcodés).
- `axionia/src/components/calendar/BookingCalendarLazy.tsx` lignes 21-39 (ssr:false + skeleton).
- `axionia/src/features/booking/actions.ts` lignes 41-144 (createBookingAction), 49 (honeypot website), 51-54 (Turnstile required), 150-264 (postOption48hAction non utilisée).
- `axionia/src/lib/turnstile.ts` lignes 19-61 (verify + dev bypass).
- `axionia/src/components/ui/dialog.tsx` lignes 30-55 (DialogContent + DialogClose).
- `axionia/AGENTS.md` budget perf `/reserver` (INP ≤ 150 ms, First Load ≤ 110 KB gz).

---

## 6. Score /100

| Dimension                          | Poids | Note  | Sous-total |
| ---------------------------------- | ----- | ----- | ---------- |
| UX visuelle (densité, hiérarchie)  | 15    | 13/15 | 13         |
| Mobile fluidity                    | 15    | 11/15 | 11         |
| Accessibilité WCAG 2.2 AA          | 15    | 9/15  | 9          |
| Error / loading states             | 15    | 6/15  | 6          |
| Conversion (clarté promesse, état) | 25    | 8/25  | 8          |
| Alignement doctrine (acompte/CGV)  | 15    | 4/15  | 4          |
| **Total**                          | 100   |       | **51/100** |

**Verdict** : l'UI est soignée (premium, autosave, social-proof, micro-copy), mais le **flow business est mensonger** (acompte 50 % + facture promises sans implémentation), **fragile en prod** (Turnstile non câblé = 100 % rejets), et **n'utilise pas les briques sécurité existantes** (postOption48hAction inutilisée, honeypot absent, query params ignorés). Le score visuel masque un trou structurel.

---

## 7. Marquage V1 vs V2+

- **V1 obligatoire** : Recos #1, #2, #3, #4, #5, #6, #7, #8, #9 (cf. tableau §4). Coût total estimé : 2 à 3 sprints UX-fix sans toucher au modèle data.
- **V2+ cible perfection extrême** : Reco #10 (Customer Portal self-service Stripe + état de réservation live) — nécessite tables `Payment`/`Invoice`/`Refund` + webhooks `checkout.session.completed` / `charge.refunded`. Conditionne aussi le « lien magique self-service » du critère 7 §0.0 du prompt source.

---

## 🚨 Top 10 frictions visiteur (ordonné par impact business)

1. **Turnstile non injecté** → 100 % des submits prod renvoient « Captcha échoué ». Conversion = 0 dès demain si on déploie V2.1 telle quelle avec `NEXT_PUBLIC_APP_ENV=production`. (P0-1)
2. **Promesse mensongère « acompte 50 % + facture immédiate »** sans Stripe ni Invoice modèle → effet falaise de confiance dès le 1er email post-booking qui n'apporte ni facture ni lien de paiement. (P0-2)
3. **Bouton « Confirmer la réservation » alors qu'il s'agit d'une simple demande pending** → dissonance cognitive immédiate. Calendly/Doctolib disent « Demander » ou « Réserver sous réserve ». (P0-3)
4. **Query params `?ville=` / `?service=` / `?from=` ignorés** → un visiteur arrivant d'une page ville pSEO (12 942 routes !) doit re-saisir sa ville en step 1. Friction directe sur le trafic SEO pSEO. (P0-5)
5. **`postOption48hAction` inutilisée** → race-condition possible entre deux visiteurs : doctrine doc 09b violée en pratique. Risque double-booking + Telegram tag `OPTION` jamais émis. (P0-4)
6. **Pas de gestion d'erreur `slot_taken`** → le visiteur ne sait pas s'il doit retenter ou changer de date, et le slot disparaît silencieusement. (P1-1)
7. **Step 3 (Contexte IA) entièrement optionnel** → coût UX visiteur (3 questions + 2 champs libres) pour bénéfice nul perçu. À déplacer post-booking. (P1-2)
8. **Honeypot `website` absent** → bots passent la modale sans friction. Risque pollution data + faux positifs côté admin. (P0-6)
9. **`aria-pressed` au lieu de `role="radio"`** sur les sélecteurs exclusifs → screen reader users perdent la sémantique « 1 sur N ». (P1-4)
10. **Pas de dark mode + skeleton sur-dimensionné** → polish général qui dégrade la perception premium et déclenche un CLS « négatif » à l'hydrate. (P2-1, P1-9)

---

## Notes méthodologiques

- Aucun code modifié, aucun `git`, `pnpm`, ni écriture hors ce fichier `.md`. ✅ Conforme AUDIT-ONLY.
- Toutes les citations renvoient à des chemins `axionia/`-rooted sur HEAD `ff3ccbc`. Lignes vérifiées via `Read`.
- `[INCONNU — non audité]` posé sur : (a) Phase 2 du master prompt (raccordement cross-Sprint), (b) le rendu réel du DialogClose vs bandeau halo-warm sur device physique (estimation visuelle code-only), (c) la mesure live Lighthouse `/reserver` post-fix CLS (skeleton).
- Périmètre `BookingFlow.tsx` / `HouseCalendar.tsx` audité mais non utilisé sur `/reserver` (dette technique cosmétique P2-4).
