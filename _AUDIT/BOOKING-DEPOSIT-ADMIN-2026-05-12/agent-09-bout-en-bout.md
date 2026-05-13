# Agent 9 — Bout-en-bout (interventions ↔ audits ↔ implementation ↔ booking ↔ pSEO villes)

**Repo** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`
**HEAD** : `ff3ccbc`
**Date** : 2026-05-12
**Mode** : 🚫 AUDIT-ONLY (lecture seule, aucune écriture code).
**Brief source** : `_AUDIT/BOOKING-DEPOSIT-ADMIN-2026-05-12/00-REALITY-CHECK.md`.

---

## 1. Périmètre audité

| Entrée                                     | Page Server                                                                                                                                                    | Action / suite                                                                                                                            | Suit ?                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `/audit`                                   | `src/app/[locale]/audit/page.tsx:79`                                                                                                                           | CTA → `/reserver?intervention=audit-flash-onsite` + `/audit/demande` (form `submitAuditRequestAction` `src/features/audit/actions.ts:87`) | calendrier + form      |
| `/audit/demande`                           | (sous-page) → `submitAuditAction` `src/features/audit/actions.ts:22`                                                                                           | submission DB `type=audit` + email `audit-confirmed`                                                                                      | form                   |
| `/interventions`                           | `src/app/[locale]/interventions/page.tsx:321`                                                                                                                  | CTA → `/reserver` (sans param) + cards famille → `/interventions/<family>`                                                                | calendrier             |
| `/interventions/<format>` (14 formats)     | `src/app/[locale]/interventions/{essentielle,approfondie,gagner-du-temps,...}/page.tsx`                                                                        | CTA `/reserver?intervention=<slug>` (cf. `essentielle/page.tsx:78`, `approfondie/page.tsx:106`, `gagner-du-temps/page.tsx:106`)           | calendrier             |
| `/implementation`                          | `src/app/[locale]/implementation/page.tsx:64`                                                                                                                  | CTA → `/contact` (`Cta href="/contact"` `:718, :1271`) + `/audit` upsell                                                                  | form contact           |
| `/contact`                                 | `src/app/[locale]/contact/page.tsx` → `submitContactAction` `src/features/contact/actions.ts:21`                                                               | submission DB `type=contact` + email `contact-confirmed`                                                                                  | form                   |
| `/reserver`                                | `src/app/[locale]/reserver/page.tsx:397` + `BookingCalendar.tsx`                                                                                               | `createBookingAction` `src/features/booking/actions.ts:41` + `postOption48hAction` `:150`                                                 | tunnel modal 4 steps   |
| pSEO villes (3 modules × 2 157 villes)     | `audit/par-ville/[ville]/page.tsx:21`, `interventions/par-ville/[ville]`, `implementation/par-ville/[ville]` (tous délèguent à `VilleServicePageTemplate.tsx`) | CTA `/reserver?ville=<slug>&service=<service>` (`VilleServicePageTemplate.tsx:355,529` + `VilleServiceDetailSection.tsx:300`)             | calendrier (mal câblé) |
| `/implantations/<region>/<ville>` (~2 157) | `src/app/[locale]/implantations/[region]/[ville]/page.tsx:264,811,882`                                                                                         | CTA `/reserver?ville=<slug>` (sans `service=`)                                                                                            | calendrier (mal câblé) |
| `/implantations/<region>`                  | `src/app/[locale]/implantations/[region]/page.tsx:154,431`                                                                                                     | CTA `/reserver?ville=<préfecture>`                                                                                                        | calendrier (mal câblé) |

Tracking stack : **Plausible self-hosted** uniquement (`src/components/analytics/Plausible.tsx` + `src/app/[locale]/layout.tsx:175`). RUM Web Vitals via `/api/vitals` (`src/components/analytics/WebVitals.tsx`). Pas de PostHog, pas de GA, pas de GTM (vérifié `Grep posthog|gtag|gtm` → 0 hit code source).

---

## 2. Constats positifs (≥ 3)

✅ **P+1 — Tunnel pSEO ville → réservation** : tous les templates pSEO (3 services + hub ville) émettent des CTAs `/reserver?...` (12 occurrences confirmées dans 6 fichiers via Grep `href=.*\?ville=|\?intervention=`). L'intention de préfill est universelle, même si le câblage est cassé (cf. P0-1).

✅ **P+2 — Source de vérité unique pour interventions** : `src/content/interventions-taxonomy.ts:263-617` définit 14 formats (6 collectives + 3 dirigeants + 2 conférence + 3 individuel) avec `slug` aligné sur le calendrier. Le hub `/interventions/page.tsx:382` consomme directement `buildFamilyCards()` → toute nouvelle formation est rendue sans patch UI. Refonte taxonomique 4 familles (2026-05-11) effectivement diffusée.

✅ **P+3 — Annoncement « créneau réservé après acompte » présent côté visiteur** : `src/app/[locale]/reserver/page.tsx:447-448` (hero) + `:471-472` (CtaBlock) annoncent explicitement « Réservation finalisée après call de cadrage + acompte 50 % » avant l'ouverture du modal. Cohérent avec la copy interventions (`src/content/interventions.ts:236`). Pas de promesse de booking « one-click instantané ».

✅ **P+4 — Cross-modules symétriques** : `/audit/page.tsx:399-449` (interventions + implementation), `/interventions/page.tsx:856-903` (audit + implementation), `/implementation/page.tsx:719-723` (audit) — la triangulation audit ↔ interventions ↔ implementation est cohérente. Sprint 14.10.8 (`AGENTS.md` + `axionia_session_2026-05-12_interventions_hubs.md`) bien matérialisé.

✅ **P+5 — Taxonomie audit alignée enum DB** : `prisma/schema.prisma:57-67` contient `audit_flash_onsite` (migration `20260512100000_audit_flash_onsite_enum`), et `BookingCalendar.tsx:69,114-120` expose ce slug en option calendrier. Cohérence DB↔UI confirmée Sprint 14.10.8.

✅ **P+6 — Terminologie « cabinet IA » respectée** : Grep `\bagence\b|\bstudio\b` → 4 occurrences uniquement dans `/implementation/page.tsx` (lignes ~241,283,312 — usage contrasté « Agence classique » dans le tableau comparatif, autorisé par doctrine mémoire `axionia_naming_cabinet.md`). Aucune dérive ailleurs.

---

## 3. Constats négatifs P0/P1/P2/P3

### 🚨 P0-1 — Rupture totale du préfill ville sur tunnel calendrier (~6 500 routes pSEO impactées)

**Source** : `VilleServicePageTemplate.tsx:355,529`, `VilleServiceDetailSection.tsx:300`, `implantations/[region]/[ville]/page.tsx:264,811,882`, `implantations/[region]/page.tsx:154,431`.

**Constat** : les ~6 500 routes pSEO `/audit/par-ville/<v>`, `/interventions/par-ville/<v>`, `/implementation/par-ville/<v>` (Sprint 14.9/14.10) + ~2 157 pages `/implantations/<r>/<v>` génèrent des CTAs vers `/reserver?ville=<slug>&service=<svc>` ou `/reserver?ville=<slug>`. **Le `BookingCalendar.tsx:309,324` ne lit que `?intervention=` et `?tier=`** :

```
const interventionFromUrl = searchParams.get("intervention") as InterventionSlug | null;
const tierFromUrl = searchParams.get("tier") as EssentielleTier | null;
```

→ aucun handler pour `?ville=`, `?service=`, `?city=`, `?from=`. Le champ `companyCity` (`BookingCalendar.tsx:412`) démarre vide `useState("")` pour 100 % des visiteurs venus de pSEO. Le visiteur ressaisit sa ville (déjà connue côté URL) au step 1. L'intention de l'URL `?service=audit` n'est pas mappée vers `intervention=audit-flash-onsite` non plus.

**Impact** : (i) friction step 1 sur 100 % des visiteurs pSEO villes ; (ii) plan d'industrialisation 2 150 villes (mémoire `axionia_pseo_industrialisation_decision.md`) opère à vide côté conversion ; (iii) tracking attribution `referrerCity` impossible (cf. P0-2).

### 🚨 P0-2 — UTM tracking + cookies `referrerCity/Phase/Region` absents (zéro instrumentation conversion)

**Source** : Grep `utm_source|utm_medium|utm_campaign|referrerCity|referrerPhase|referrerRegion` sur tout `src/` → **0 résultat**.

**Constat** : aucune action server (`booking/actions.ts`, `audit/actions.ts`, `implementation/actions.ts`, `contact/actions.ts`) ne lit ni ne persiste de paramètres UTM ou de cookies d'attribution. La mémoire `axionia_pseo_monitoring_tracking.md` documente une stack 4 outils (Search Console + Plausible + Clarity + dashboard `/admin/pseo-stats`) — **rien n'est branché côté code**. `Submission.details` (`prisma/schema.prisma:170`) reçoit un payload typé mais aucun champ `referrer*` n'y est sérialisé. `Submission.referer` (`schema.prisma:188`) existe pour l'HTTP `Referer` mais n'est jamais setté (Grep `referer:` dans actions → 0). Plausible (`components/analytics/Plausible.tsx`) tracke pageviews mais aucun `trackEvent("Booking Submitted", { props: { intervention, fromVille } })` n'est appelé aux submissions.

**Impact** : impossible d'attribuer un Booking/Submission à sa ville/région source. Le workflow « hebdo/mensuel/trimestriel data-driven » de la mémoire est non opérable. Le dashboard `/admin/pseo-stats` (Sprint 20) ne dispose d'aucune donnée d'entrée.

### 🚨 P0-3 — Cohérence URL pSEO vs ce que comprend le calendrier : `service` ≠ `intervention`

**Source** : `VilleServicePageTemplate.tsx:355` (`?ville=<v>&service=<service>` où `service ∈ {audit, interventions, implementation}`) vs `BookingCalendar.tsx:309` (`intervention ∈ {essentielle, approfondie, conference, dirigeants, audit-flash-onsite}`).

**Constat** : le namespace `service=audit` n'est pas dans le mapping `INTERVENTION_OPTIONS` (`BookingCalendar.tsx:77-121`) → le calendrier reste sur le defaultOpt `essentielle`. Pire, `/implementation/par-ville/<v>` génère `/reserver?ville=<v>&service=implementation` alors que **implementation n'est pas une intervention bookable directement** (le module pousse vers `/contact`, cf. `implementation/page.tsx:718`). L'URL ment au visiteur.

**Impact** : (i) visiteur venu de `/implementation/par-ville/lyon` atterrit sur le calendrier `essentielle` par défaut — fausse promesse ; (ii) la prescription URL cible du prompt § 3 (`/reserver?type=audit_flash_onsite&from=audit&city=paris&utm_source=…`) n'est tenue sur aucune entrée.

### 🚨 P0-4 — `/interventions` hub-level CTA `/reserver` sans préfill intervention (perte 100 % du choix utilisateur)

**Source** : `src/app/[locale]/interventions/page.tsx:504,739,919`.

**Constat** : 3 CTAs hub interventions pointent vers `/reserver` (nu) sans `?intervention=…`. Le visiteur qui a vu 4 cards famille puis clique « Pré-réservez sur le calendrier » repart de zéro côté calendrier (defaultOpt = essentielle). Or les cards famille (Dirigeants, Conférence) renvoient vers leurs propres pages famille — pas vers le calendrier — donc le CTA hub `/reserver` est le seul accès direct au calendrier depuis ce niveau et perd toute l'intention.

**Impact** : effort UX du hub (4 familles × visuels × prix) annulé au passage au calendrier. Le visiteur Dirigeants reverra Essentielle par défaut.

### ⚠️ P1-5 — `/implementation` n'a pas d'équivalent calendrier-réservable mais le pSEO `/implementation/par-ville` génère un CTA `/reserver?...&service=implementation`

**Source** : `VilleServicePageTemplate.tsx:355` (template unifié) + absence de slug `implementation` dans `BookingCalendar` `INTERVENTION_OPTIONS`.

**Constat** : doctrine `implementation` = `submitImplementationAction` (form, pas calendrier). Or le template ville unique colle un CTA `/reserver?ville=<v>&service=implementation` qui : (i) ne mappe à aucune intervention bookable, (ii) contredit la copy `/implementation/page.tsx:718` (« Décrire mon besoin · réponse 48 h »).

**Impact** : double parcours contradictoire (form + calendrier non câblé). Confusion visiteur sur ce module.

### ⚠️ P1-6 — `Submission.referer` jamais persisté (audit trail RGPD/marketing dégradé)

**Source** : `prisma/schema.prisma:188` (colonne présente) vs Grep `referer:` dans `src/features/**/actions.ts` → 0.

**Constat** : la colonne existe mais aucune action ne fait `referer: (await headers()).get("referer") ?? null`. Les 4 actions (audit, audit-request, implementation, contact, booking) ne capturent que `ipAddress` + `userAgent`. Le booking action `createBookingAction` n'a même pas le champ dans son `create()` data.

**Impact** : impossible reconstituer en admin la chaîne d'arrivée d'un lead, même rétrospectivement.

### ⚠️ P1-7 — `BookingCalendar` ne propage pas `companyCity` initial depuis l'URL `?ville=`

**Source** : `BookingCalendar.tsx:412` (`useState("")`).

**Constat** : même si on corrigeait P0-1, le composant ne possède pas l'API pour ingérer `?ville=` → `companyCity`. La logique de mapping slug→nom de ville (« lyon » → « Lyon ») requiert un côté serveur (Server Component parent qui résout via INSEE) ou un lookup client.

**Impact** : dépendance P0-1 — la correction n'est pas seulement « lire searchParams.get('ville') ».

### ⚠️ P1-8 — Pas de `confirmation` page qui boucle UTM/source côté Plausible

**Source** : `src/app/[locale]/confirmation/page.tsx:43-52`.

**Constat** : la page confirmation lit `?type=` pour personnaliser le label, mais n'appelle pas `trackEvent("Conversion", { props: { type, source } })`. Plausible voit la pageview `/confirmation?type=audit` mais l'attribution s'arrête au pixel pageview, pas un événement « goal achieved ».

**Impact** : conversion funnel Plausible non instrumentée à l'étape la plus haute valeur.

### 🟡 P2-9 — `/audit/par-ville/[ville]` mute le service du visiteur sans cohérence sémantique

**Source** : `VilleServicePageTemplate.tsx:355` génère `?ville=X&service=audit` mais le `audit-flash-onsite` est la seule intervention auditable bookable directement, et elle n'est pas explicitement liée au paramètre `service`.

**Constat** : il n'existe pas dans `BookingCalendar.tsx` de table de correspondance `service → intervention`. La règle métier « `service=audit` → `intervention=audit-flash-onsite` » est non documentée.

**Impact** : ambiguïté maintenabilité. Si Will ajoute demain `audit-flash-distance` ou `audit-cible-onsite`, comment le pSEO ville décidera ?

### 🟡 P2-10 — `/contact` mute `companyName = contact` faute de champ société

**Source** : `src/features/contact/actions.ts:50-54`.

**Constat** : `companyName: parsed.data.company ?? "—"`. Si l'utilisateur ne remplit pas `company`, on stocke `"—"`. Cohérent avec le schéma (`Submission.companyName String`) mais fausse les rapports `groupBy(companyName)` admin.

**Impact** : faible — admin filtre/CSV pollués.

### 🟡 P3-11 — `INTERVENTION_OPTIONS` hardcodé dans `BookingCalendar` au lieu de dériver d'`interventions-taxonomy.ts`

**Source** : `BookingCalendar.tsx:77-121` (5 entries hardcoded) vs `INTERVENTION_FORMATS` (14 entries dans `interventions-taxonomy.ts:263-617`).

**Constat** : le calendrier ne propose que 5 slugs (`essentielle`, `approfondie`, `conference`, `dirigeants`, `audit-flash-onsite`) — 9 formats sur 14 ne sont pas bookables directement. Cohérent fonctionnellement (les 9 autres sont sur devis / coaching individuel) mais le hardcode duplique la SSOT.

**Impact** : faible — risque de dérive si Will ajoute un format collectif sans toucher le calendrier.

---

## 4. Recommandations Top 10 (impact × effort inverse)

| #   | Reco                                                                                                                                                                                                                                                                            | Impact | Effort      | Quand    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | -------- |
| R1  | **Étendre `BookingCalendar` searchParams handlers** : lire `?ville` `?city` `?service` `?from` `?utm_*`. Mapper `service → intervention` via table dédiée (`service=audit → intervention=audit-flash-onsite`).                                                                  | 🔥🔥🔥 | M (4-6 h)   | **V1**   |
| R2  | **Pré-fill `companyCity`** depuis `?ville=<slug>` via lookup INSEE côté Server Component parent `/reserver/page.tsx` (déjà accès à `villes-by-slug.ts`). Passer `initialCompanyCity` en prop à `BookingCalendarLazy`.                                                           | 🔥🔥🔥 | M (3-4 h)   | **V1**   |
| R3  | **Persister `referer` + UTM dans `Submission.details`** : ajouter `referer = headers.get("referer")` + parser `searchParams` UTM dans les 5 actions visiteur (`booking`, `audit`, `audit-request`, `implementation`, `contact`).                                                | 🔥🔥🔥 | M (2-3 h)   | **V1**   |
| R4  | **Harmoniser CTAs pSEO ville → URL canonique** : `/reserver?intervention=audit-flash-onsite&from=audit&city=<slug>` (au lieu de `?ville=&service=`). Patch unique dans `VilleServicePageTemplate.tsx:355,529` + `VilleServiceDetailSection.tsx:300`.                            | 🔥🔥🔥 | S (1-2 h)   | **V1**   |
| R5  | **Ajouter `trackEvent` Plausible aux 5 actions submissions** : `trackEvent("Booking Submitted", { props: { intervention, source, city } })`. Côté serveur impossible → expose via Server Action return + client-side hook sur formulaire success.                               | 🔥🔥   | M (3 h)     | **V1**   |
| R6  | **Patch `/interventions` hub CTAs** (`page.tsx:504,739,919`) : envoyer vers `/reserver` avec `?from=interventions` pour permettre R3 attribution. Pas de présupposition d'intervention.                                                                                         | 🔥🔥   | XS (15 min) | **V1**   |
| R7  | **Retirer ou raccrocher `/implementation/par-ville` CTA `/reserver?service=implementation`** : remplacer par `/contact?from=implementation&city=<slug>` puisque doctrine impl = form humain.                                                                                    | 🔥🔥   | S (30 min)  | **V1**   |
| R8  | **Cookies `referrerCity/Phase/Region` côté `proxy.ts` ou middleware Server Component** : intercepter `/audit/par-ville/<v>` → set HttpOnly cookie `axionia.ref.city=<v>` 30j. Lire dans Server Actions au submit. Implémente la doctrine `axionia_pseo_monitoring_tracking.md`. | 🔥🔥   | M (4 h)     | **V1.5** |
| R9  | **Dériver `INTERVENTION_OPTIONS` de `INTERVENTION_FORMATS`** + flag `bookableDirect: boolean` dans la taxonomie. Le calendrier ne montre que les `bookableDirect === true`.                                                                                                     | 🔥     | M (2 h)     | **V2+**  |
| R10 | **Page `/confirmation` : appeler `trackEvent("Conversion", {type, source})` au mount** + JSON-LD `Event` pour AEO.                                                                                                                                                              | 🔥     | XS (30 min) | **V1**   |

---

## 5. Sources citées (`file:LINE`)

- `src/app/[locale]/reserver/page.tsx:27,397,418,447,471` — page calendrier server, hero "acompte 50 %", CtaBlock.
- `src/app/[locale]/audit/page.tsx:79,185,475,488` — hub audit + 3 CTAs `?intervention=audit-flash-onsite`.
- `src/features/audit/actions.ts:22,87` — `submitAuditAction` + `submitAuditRequestAction`.
- `src/app/[locale]/interventions/page.tsx:321,382,504,739,919` — hub 4 familles, CTAs hub `/reserver` nu.
- `src/content/interventions-taxonomy.ts:263-617` — 14 formats SSOT.
- `src/app/[locale]/implementation/page.tsx:64,718,1271` — hub impl + CTAs `/contact`.
- `src/features/implementation/actions.ts:21` — submission impl.
- `src/features/contact/actions.ts:21,50` — submission contact.
- `src/features/booking/actions.ts:41,150` — `createBookingAction` + `postOption48hAction`.
- `src/components/calendar/BookingCalendar.tsx:69,77-121,309,324,412` — `INTERVENTION_OPTIONS` hardcodé, searchParams handlers limités, `companyCity` useState vide.
- `src/components/sections/VilleServicePageTemplate.tsx:355,529` — CTAs `/reserver?ville=&service=` cassés.
- `src/components/sections/VilleServiceDetailSection.tsx:300` — idem.
- `src/app/[locale]/implantations/[region]/[ville]/page.tsx:264,811,882` — 3 CTAs `/reserver?ville=` cassés.
- `src/app/[locale]/implantations/[region]/page.tsx:154,431` — 2 CTAs idem.
- `src/app/[locale]/audit/par-ville/[ville]/page.tsx:21` — délègue `VilleServicePageTemplate`.
- `src/components/analytics/Plausible.tsx:12,35` — stack tracking + `trackEvent` exporté mais jamais utilisé.
- `src/components/analytics/WebVitals.tsx:43` — RUM `/api/vitals` actif.
- `src/app/[locale]/layout.tsx:171,175` — `<WebVitals />` + `<Plausible />` montés.
- `src/components/marketing/Cta.tsx:22` — `data-cta` exposé, jamais consommé par tracker.
- `src/components/marketing/StickyMobileCta.tsx:75` — idem `data-cta` exposé.
- `src/app/[locale]/confirmation/page.tsx:43-52` — lit `?type=`, n'émet pas d'événement.
- `prisma/schema.prisma:157,170,188` — `Submission.details Json`, `referer? VarChar`.
- `prisma/schema.prisma:57-67` — enum `InterventionType` (7 valeurs).

---

## 6. Score /100

| Critère                                                            | Poids | Note  | Score      |
| ------------------------------------------------------------------ | ----- | ----- | ---------- |
| Cohérence narrative (les 4 entrées racontent la même histoire ?)   | 20    | 14/20 | 14         |
| Cohérence taxonomique (refonte 4 familles bien diffusée ?)         | 15    | 12/15 | 12         |
| Cohérence terminologique (« cabinet IA » / « Axion-IA » respectés) | 10    | 9/10  | 9          |
| Préfill query params bout-en-bout                                  | 20    | 4/20  | 4          |
| Tracking conversion / UTM / referrerCity                           | 20    | 2/20  | 2          |
| Doctrine code = SSOT (taxonomie/pricing dérivés, pas hardcodés)    | 15    | 9/15  | 9          |
| **Total**                                                          | 100   |       | **50/100** |

> **Verdict** : narrative et taxo correctes (refonte 4 familles propre, mentions « acompte 50 % » uniformes), mais le tunnel data est **fracturé** : la moitié des URLs CTA produites par 2 150 pages pSEO + 6 500 routes service-ville ne sont pas lues par le calendrier, et aucune attribution (UTM, cookie référent, événement Plausible) n'existe.

---

## 7. Marquage V1 vs V2+

**V1 (avant cutover prod publique élargie)** : R1, R2, R3, R4, R5, R6, R7, R10. Effort cumulé ≈ 16-18 h. Sans ces 8 reco, le pSEO 2 150 villes reste un funnel data-aveugle.

**V1.5 (1-2 semaines après cutover)** : R8 (cookies attribution propres, suit la doctrine `axionia_pseo_monitoring_tracking.md`).

**V2+ (selon roadmap booking deposit M8+)** : R9 (refacto SSOT calendrier).

---

## 8. Parcours idéal en 8-10 étapes par entrée

### 8.1 Entrée `/audit` (visiteur cherche un audit IA)

1. Visiteur Google arrive sur `/audit` ou `/audit/par-ville/<v>` (SERP keyword « audit IA Lyon »).
2. Hero `H1` + 4 trust pills + 2 CTAs visibles fold (`/reserver?intervention=audit-flash-onsite` ou `/audit/demande`).
3. Switch « Par taille » / « Par situation » (`AuditHubToggle`) → choisit le tier qui correspond.
4. (Variante A — Flash terrain 890 €) Clic CTA → `/reserver?intervention=audit-flash-onsite&from=audit&city=<v>` → calendrier ouvre directement sur option Flash + ville pré-remplie.
5. (Variante B — Autres tiers Cible/Strat) Clic CTA → `/audit/demande` form 6 steps → submit `submitAuditRequestAction` → submission DB + email confirm + Telegram `AUDIT`.
6. Email confirmation reçu < 60 s. Lien tracking session vers `/confirmation?type=audit&id=…&source=audit-flash-onsite`.
7. Page confirmation : remerciement + délai SLA 48 h + lien upsell `/interventions` ou `/implementation`.
8. Admin reçoit Telegram `AUDIT` tag → traite via `/[adminPrefix]/submissions` → assigne + status `in_progress`.
9. Suivi-up Will (humain) : appel cadrage ou réponse devis < 48 h ouvrées.

**🚨 Cassures bout-en-bout actuelles** : étape 4 step 1 — `?intervention=audit-flash-onsite` lu ✅ mais `?from=audit&city=<v>` pas lu (P0-1, P0-2). Étape 7 — page confirmation passive, pas d'événement Plausible (P1-8).

### 8.2 Entrée `/interventions` (visiteur cherche formation IA équipe)

1. Visiteur arrive sur `/interventions` ou `/interventions/par-ville/<v>` ou `/interventions/<famille>` (SERP « formation IA entreprise »).
2. Hero `H1` + audience strip (TPE / PME / ETI) + CTA hub `/reserver` ou ancrage `#familles`.
3. 4 cards famille (Collectives / Individuel / Dirigeants / Conférence) avec compteur formats + prix entry.
4. Clic carte → `/interventions/<famille>` (sous-page famille) → liste paliers durée + 14 formats avec leur slug calendrier.
5. Clic format → `/interventions/<format>` (page produit avec preview hover + JSON-LD).
6. CTA principal page format → `/reserver?intervention=<slug>[&tier=<t>]` → calendrier pré-rempli sur l'intervention + tier.
7. Visiteur clique une date dispo → modal 4 steps (Entreprise/Vous/Contexte IA/Récap). Step 1 demande companyCity (toujours vide aujourd'hui).
8. Submit → `createBookingAction` → Booking DB `pending` + slot status `reserved` + email + Telegram `INTERVENTION`.
9. Email J+1 ouvré : appel cadrage Axion-IA + devis acompte 50 %.
10. Acompte payé → admin `confirme` (manuel UI) → email confirmé client.

**🚨 Cassures bout-en-bout actuelles** : étape 2 CTA `/reserver` hub nu (P0-4). Étape 7 companyCity vide pour 100 % des visiteurs pSEO (P0-1). Étape 8 referer/UTM perdus (P1-6, P0-2). Étape 9-10 = procédure manuelle hors code (P0 #1 reality-check).

### 8.3 Entrée `/implementation` (visiteur cherche mise en production IA)

1. Visiteur arrive sur `/implementation` ou `/implementation/par-ville/<v>` ou `/implementation/par-fonction/<f>` ou `/implementation/par-techno/<t>`.
2. Hero `H1` + 4 trust items + 2 CTAs : `/contact` (primary) ou `/audit` (outline upsell).
3. Section pillars : Audit d'abord / Implémentation directe / Sans abonnement.
4. Catalogue 8 fonctions × ~50 automatisations (`AUTOMATISATIONS`).
5. Comparatif Make/Agence classique/Axion-IA (`comparison`).
6. Process 5 étapes (ProcessSteps).
7. FAQ 9 questions (FaqAccordion) → JSON-LD FAQPage auto.
8. Closing CTA → `/contact` form 4 steps (type / budget / description / contact + consent).
9. Submit → `submitImplementationAction` → submission DB + Telegram `AUTO` + email `implementation-confirmed`.
10. Will rappelle sous 48 h ouvrées avec devis ferme.

**🚨 Cassures bout-en-bout actuelles** : étape 1 (variante pSEO `/implementation/par-ville/<v>`) → CTA `/reserver?ville=&service=implementation` parfaitement absurde (P0-3, P1-5) puisque le module **pousse vers `/contact`**. Le pSEO trahit la doctrine du module.

### 8.4 Entrée `/contact` (visiteur question générique)

1. Visiteur arrive sur `/contact` (SERP « contact Axion-IA » ou clic Footer/Header).
2. Hero court + form unique 5 champs (nom / email / société? / message / consent).
3. Turnstile bouclier silencieux.
4. Submit → `submitContactAction` → submission DB `type=contact` + Telegram `CONTACT` + email `contact-confirmed`.
5. Page de remerciement (`/confirmation?type=contact`) ou inline success.
6. Will lit Telegram CONTACT → répond manuellement.

**🚨 Cassures bout-en-bout actuelles** : étape 4 `companyName = company ?? "—"` (P2-10). Pas de routage analytics étape 5 (P1-8). Step 4 ne capture pas `referer` (P1-6) → impossible de savoir si le visiteur vient de `/implementation` ou d'un blog post.

---

## Synthèse — Top 3 cassures bout-en-bout

1. **🚨 P0-1 + P0-3** — Le calendrier `BookingCalendar` ne lit pas `?ville=` ni `?service=` → toutes les CTAs pSEO villes/régions arrivent sur le calendrier sans préfill et sans bonne intervention pré-sélectionnée. Volume impacté : ~8 500 routes.
2. **🚨 P0-2** — Aucune capture UTM, aucun `referer`, aucun cookie `referrerCity` côté code. Le plan industrialisation pSEO (mémoire) opère à l'aveugle.
3. **🚨 P0-4** — Hub `/interventions` envoie 3 CTAs vers `/reserver` nu (sans `?intervention=`) — toute l'intention UX du hub 4 familles est perdue au franchissement du calendrier.
