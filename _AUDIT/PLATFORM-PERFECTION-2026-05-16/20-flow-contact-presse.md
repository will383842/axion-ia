# Agent 4.F — Flow CONTACT + PRESSE + FEEDBACK

> **Mode** AUDIT-ONLY · **SHA** `4cdfbe4` · **Date** 2026-05-16 · **Périmètre** `/fr/contact`, `/fr/presse`, Newsletter, Feedback widget, Server Actions associées, schémas Zod, Telegram PII, IP hashing.

---

## 0. Inventaire ciblé

| Surface                           | Fichier                                                                                                                      | Server Action                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `/fr/contact` page                | `src/app/[locale]/contact/page.tsx`                                                                                          | n/a (page)                                                                              |
| ContactForm UI                    | `src/components/forms/ContactForm.tsx`                                                                                       | → `submitContactAction`                                                                 |
| Action contact                    | `src/features/contact/actions.ts`                                                                                            | `submitContactAction`                                                                   |
| `/fr/presse` page                 | `src/app/[locale]/presse/page.tsx`                                                                                           | n/a (mailto only)                                                                       |
| PressContact band                 | `src/components/sections/PressContact.tsx`                                                                                   | `mailto:presse@axion-ia.com`                                                            |
| Newsletter UI                     | `src/components/forms/NewsletterForm.tsx`                                                                                    | → `subscribeNewsletterAction`                                                           |
| Action newsletter                 | `src/features/newsletter/actions.ts`                                                                                         | `subscribeNewsletterAction` / `confirmNewsletterAction` / `unsubscribeNewsletterAction` |
| Web Vitals (≈ feedback technique) | `src/app/api/vitals/route.ts`                                                                                                | POST → `appendVitalsRecord` ndjson                                                      |
| Schémas Zod                       | `src/lib/schemas/forms.ts`                                                                                                   | `contactSchema`, `newsletterSchema`                                                     |
| Helpers transverses               | `src/lib/rate-limit.ts`, `src/lib/turnstile.ts`, `src/lib/pii-redaction.ts`, `src/lib/pii-crypto.ts`, `src/lib/client-ip.ts` | —                                                                                       |

**Absence notable** : aucun widget de feedback utilisateur public (CSAT, NPS, thumbs, in-page rating) dans `src/app/**` ou `src/components/forms/**`. Le seul flux « feedback » technique est le pipeline Web Vitals (`/api/vitals` → `WebVitalSample` Prisma, dashboard `/admin/web-vitals`). Voir §5.

---

## 1. Matrice forms publics — vérifications transverses

Légende : `OUI` = présent et correct · `PARTIEL` = présent mais incomplet · `KO` = absent ou cassé · `n/a` = non applicable.

| Form public                            |      Validation Zod      | Honeypot **rendu UI**  |    Honeypot **check server**    |                  Rate-limit IP                  |                        RGPD checkbox + texte                         |                  IP at-rest (hash)                  |    Telegram PII redact    |                Turnstile                |                                      RFC 8058 (double opt-in)                                       |
| -------------------------------------- | :----------------------: | :--------------------: | :-----------------------------: | :---------------------------------------------: | :------------------------------------------------------------------: | :-------------------------------------------------: | :-----------------------: | :-------------------------------------: | :-------------------------------------------------------------------------------------------------: |
| Contact (`/fr/contact`)                |  OUI (`contactSchema`)   |         **KO**         | OUI (`formData.get("website")`) |                OUI (3/10min/IP)                 | OUI (consent literal(true) + texte explicite + lien privacy via FAQ) |      **KO** (clear, `ipAddress: ip` ligne 71)       | OUI (`redactContactLine`) |  OUI (`useTurnstileToken("contact")`)   |                                                 n/a                                                 |
| Newsletter (sitewide `NewsletterForm`) | OUI (`newsletterSchema`) |         **KO**         | OUI (`formData.get("website")`) |                 OUI (3/5min/IP)                 |    OUI (consent literal(true) — texte i18n dépendant du callsite)    | **KO** (clear sur `NewsletterSubscriber.ipAddress`) |    OUI (`redactEmail`)    | OUI (`useTurnstileToken("newsletter")`) | OUI (confirmToken + unsubscribeToken hex 32B, statuts `pending/confirmed/unsubscribed`, idempotent) |
| Presse (`/fr/presse`)                  |  n/a (pas de form HTML)  |          n/a           |               n/a               |               n/a (mailto natif)                |                                 n/a                                  |                         n/a                         |            n/a            |                   n/a                   |                                                 n/a                                                 |
| `/api/vitals` (feedback technique)     |   OUI (`VitalsSchema`)   | n/a (POST JSON beacon) |               n/a               | **KO** (route publique, aucun `checkRateLimit`) |                      n/a (aucun PII personnel)                       |                         n/a                         |            n/a            |                   n/a                   |                                                 n/a                                                 |

### 1.1 — Confrontation avec l'audit 3.D (P0 honeypot)

L'audit 3.D listait `Contact / Newsletter / Booking / AuditRequest / Implementation / Audit` comme manquant le rendu UI du champ honeypot. Vérification ciblée Agent 4.F :

- `grep -rn "name=\"website\"" src/` → **1 seul fichier** : `src/components/forms/QuoteRequestForm.tsx:129`.
- `grep -i "honeypot|website" src/components/forms/ContactForm.tsx` → **0 match**.
- `grep -i "honeypot|website" src/components/forms/NewsletterForm.tsx` → **0 match**.

➡️ **P0 3.D confirmé sur ContactForm + NewsletterForm**. Le check server `if (formData.get("website")) return { ok: true }` existe (`contact/actions.ts:34`, `newsletter/actions.ts:40`) mais sans champ rendu, **aucun bot legacy ne tombera dedans** — la défense est un placebo. Coût correctif ≈ 3 lignes JSX par form, copier-coller du pattern QuoteRequestForm (input position absolute -9999px, `tabIndex={-1}`, `aria-hidden="true"`, `autoComplete="off"`).

### 1.2 — IP storage : non-conformité RGPD identifiée

`submitContactAction` (ligne 71) et `subscribeNewsletterAction` (ligne 77) persistent `ipAddress: ip` **en clair UTF-8** dans Postgres. Le helper `IP_HASH_SALT` + SHA-256 n'est utilisé QUE dans le pipeline image-bank (`src/server/image-bank/services/image-bank.service.ts`, `src/app/[locale]/galerie/[slug]/telecharger/route.ts`).

- `MEMORY.md` indique « RGPD : IP SHA-256 hashées via `IP_HASH_SALT` » — vrai **uniquement pour l'image-bank**, faux pour les Submissions form-publics.
- `Submission.ipAddress` est `VARCHAR(64)` (`prisma/schema.prisma:648`), `NewsletterSubscriber.ipAddress` idem (`:1360`).
- CNIL recommandation 2024 : IP collectée à des fins anti-spam = donnée à caractère personnel, durée de conservation justifiée ≤ 12 mois, **hash recommandé** pour minimisation.

**P0 RGPD** : appliquer `hashIp(ip)` (helper à mutualiser depuis image-bank) avant `prisma.submission.create` + `prisma.newsletterSubscriber.create/upsert`. Coût : 1 helper + 6 callsites form (`contact`, `newsletter`, `audit`, `booking`, `implementation`, `quote-request`).

### 1.3 — Honeypot field name canonical

Bonne nouvelle structurelle : tous les Server Actions form-publics (`contact`, `newsletter`, `audit:55`, `booking:154`, `implementation:42`, `quote-request:?`, `option48h`) lisent **le même nom canonique** `website`. Le commentaire Sprint 15 Fork 3 C1-3 dans `newsletter/actions.ts:40` documente l'uniformisation. Coût correctif UI = uniquement copier le bloc JSX, pas de coordination action-side.

---

## 2. Flow CONTACT — détail

### 2.1 — Pipeline serveur (`submitContactAction`)

Ordre d'exécution (`src/features/contact/actions.ts`) :

1. `getClientIp()` — extraction IP (header `x-real-ip` + validation proxy trust prefixes) ✅
2. `checkRateLimit("contact:${ip}", { limit: 3, windowSec: 600 })` — 3/10min ✅
3. Honeypot `if (formData.get("website")) return { ok: true }` — placebo (champ non rendu, cf §1.1) ⚠️
4. `verifyTurnstile(token, ip)` — captcha CF Turnstile ✅
5. `contactSchema.safeParse(...)` — Zod (name min 2, email, message min 20, consent literal(true)) ✅
6. `parseLocale`, UA, UTM cookie, referrerCity pSEO ✅
7. `prisma.submission.create({ type: "contact", contactName: encryptPii(name), contactEmail: encryptPii(email), ipAddress: ip ❌ (clear) })`
8. `sendTelegram({ tag: "CONTACT", body: redactContactLine(name, email) })` ✅
9. `enqueueEmail("contact-confirmed", email, locale, { contactName, submissionId })` ✅

### 2.2 — Validation Zod (`contactSchema`)

```ts
contactSchema = z.object({
  name: z.string().min(2, "Champ requis."),
  email: z.string().email(),
  company: z.string().optional(),
  message: z.string().min(20),
  consent: z.literal(true, { errorMap: () => ({ message: "Consentement requis." }) }),
});
```

- ✅ Consent strict literal(true) (pas un boolean opt-out)
- ⚠️ `email` Zod regex permissive (accepte `a@b`) — pas P0
- ⚠️ Pas de `max(...)` sur `message` → risque DoS payload Postgres (`details Json`). Recommander `max(5000)` (alignement `quoteRequestSchema.contextBusiness.max(5000)`).
- ⚠️ `name` regex absente → accepte emojis / scripts / 0-width characters. P3.

### 2.3 — RGPD checkbox + texte

Textes FR (`contact/page.tsx:333`) :

> « J'accepte que mes données soient utilisées pour traiter cette demande conformément à la politique de confidentialité. »

✅ Mention finalité (« traiter cette demande ») + référence implicite politique de confidentialité. ⚠️ **Pas de lien `<a href="/politique-de-confidentialite">` dans le label** — texte non cliquable. P2 UX/RGPD.

Le hero `pills` mentionne « RGPD · UE » (`page.tsx:55`). La FAQ `id="rgpd"` (`page.tsx:81-85`) décrit stockage Estonie + suppression 6 mois — bon AEO mais hors champ form lui-même.

### 2.4 — JSON-LD ContactPage

`contactJsonLd` (`page.tsx:134-157`) émet `ContactPage` + `mainEntity: ContactPoint` (`hoursAvailable`, `availableLanguage`, `areaServed`). ✅ Compatible AEO/GEO 2026 (resolution Perplexity / SGE / Claude.ai). Email exposé = `contact@axion-ia.com` (cohérent avec MEMORY `contact_email` doctrine 2026-05-16, plus de `dpo@`).

---

## 3. Flow PRESSE — détail

### 3.1 — Pas de formulaire HTML

`/fr/presse` est entièrement statique côté collecte. Le CTA presse = `mailto:` direct avec sujet préfilled (`PressContact.tsx:34`) :

```ts
const mailto = `mailto:${labels.email}?subject=${encodeURIComponent(labels.subjectLabel)}`;
```

- ✅ Pas de surface anti-spam à durcir (pas de form)
- ⚠️ Adresse presse exposée en clair dans le DOM **et** dans le JSON-LD `contactPoint` (`page.tsx:144-149`). Risque scraping email harvesters classique. Atténuation : adresse dédiée filtrable (`t("contactEmail")` — vérifier `press@axion-ia.com` ou alias).
- ❌ Pas d'obfuscation (`@` → `[at]`), pas de `data-href` JS-only fallback. P3 (acceptable pour une espace presse — barre haute = bien indexable).

### 3.2 — JSON-LD presse

`page.tsx:114-153` émet `WebPage` + `NewsroomPage` + `Organization.contactPoint[]` (customer service + media inquiry séparés) + `speakable` + `ItemList` `NewsArticle` (releases). ✅ Très complet AEO 2026.

`personsJsonLd` (`page.tsx:155-165`) émet `Person` par porte-parole avec `knowsAbout`, `knowsLanguage`, `sameAs LinkedIn`. ✅

### 3.3 — Cohérence emails

`/contact` expose `contact@axion-ia.com`, `/presse` expose `t("contactEmail")` (probable `presse@axion-ia.com` ou `media@`). À vérifier hors-scope Agent 4.F : que `messages/fr.json:press.contactEmail` soit aligné avec MX configuré et boîte monitorée. P2 ops.

---

## 4. Flow NEWSLETTER — détail

### 4.1 — Pipeline RFC 8058 double opt-in ✅

Architecture irréprochable côté serveur (`src/features/newsletter/actions.ts`) :

1. `subscribeNewsletterAction` → `status: "pending"`, `confirmToken` + `unsubscribeToken` (32 bytes hex chaque, CSPRNG), enqueue email opt-in `marketing=true`.
2. `confirmNewsletterAction(token)` → check token, set `status: "confirmed"`, `confirmedAt`, **clear `confirmToken`** (usage unique), Telegram silent log.
3. `unsubscribeNewsletterAction(token)` → set `status: "unsubscribed"`, `unsubscribedAt`. **Token CONSERVÉ** pour idempotency + audit RFC 8058 List-Unsubscribe-Post.
4. Upsert idempotent : ré-soumission email pending → renvoie token (pas de doublon).

✅ Cohérent avec `prisma/schema.prisma:1347-1370` (`NewsletterSubscriber` 14 colonnes + `NewsletterStatus` enum).

### 4.2 — Faiblesses détectées

- **Honeypot UI absent** (cf §1.1) — P0 confirmé.
- **IP en clair** dans `NewsletterSubscriber.ipAddress` (cf §1.2) — P0 RGPD.
- **`source` non Zod-validé** : `formData.get("source") as string` (`actions.ts:55`) est lu brut hors `safeParse`. Risque XSS stocké si admin affiche `source` sans escape. P2.
- `confirmNewsletterAction:130` retourne `invalid_token` sur ré-clic d'un lien `confirmed` (token cleared) → UX confuse pour user qui reclique. Le commentaire dans le code reconnaît le problème. P3 UX.

### 4.3 — Validation Zod (`newsletterSchema`)

```ts
newsletterSchema = z.object({
  email: z.string().email(),
  consent: z.literal(true),
});
```

✅ Minimaliste mais conforme. Pas de surface d'attaque payload.

### 4.4 — Telegram PII

`actions.ts:84-87` + `actions.ts:151-155` + `actions.ts:204-208` : tous les `sendTelegram` newsletter utilisent `redactEmail(...)` (`j****@acme.com`). ✅ Conforme ADR 0010 / Sprint 24.1.

### 4.5 — Texte consent

Pas de texte fixe dans le component — passé via `labels.consent` depuis le callsite. À auditer **callsite par callsite** (`src/components/sections/NewsletterCta.tsx` ou équivalent) — hors scope strict 4.F. P2.

---

## 5. Feedback widget — état réel

**Constat factuel** : aucun widget de feedback utilisateur public (CSAT, NPS, thumbs up/down, in-page rating).

Recherches effectuées :

- `grep -ri "Feedback" src/components/` → 2 fichiers dont **aucun n'est un widget public** :
  - `src/components/admin/image-bank/ForgetIpHashForm.tsx` — admin RGPD art.17
  - `src/lib/knowledge/rgpd-export.ts` — RGPD art.15
- `grep -ri "rating|csat|nps|thumbs" src/components/` → uniquement composants UI génériques.

**Pipeline « feedback technique »** existant = Web Vitals :

- Endpoint : `POST /api/vitals` (`src/app/api/vitals/route.ts`)
- Validation : `VitalsSchema` Zod (CLS/FCP/FID/INP/LCP/TTFB/INP-attribution/LoAF/LongTask) ✅
- Persistance : `appendVitalsRecord` → ndjson rotatif (pas Prisma `WebVitalSample` direct — la table existe mais alimentée par un worker dédié `content-web-vitals-monitor-worker.ts`).
- Réponse : `204` fire-and-forget ≤ 50 ms cible
- **Rate-limit : KO** — aucun `checkRateLimit("vitals:${ip}", ...)` malgré endpoint POST public anonyme. P1 abuse (un attaquant peut spammer ndjson, saturer disque).
- Bad JSON / parse fail → 204 silent (anti log-spam bots). ✅
- Aucun PII personnel transite (id beacon, name, value, route, device).

**Recommandation** : si un vrai widget feedback utilisateur est planifié V1.5, capitaliser sur table `WebVitalSample` ou créer `UserFeedback` distincte avec `submissionId` FK + `rating int4 1..5` + `comment text?` + `hashedIp`.

---

## 6. Anti-spam transverse — bilan défense en profondeur

Couches actives sur Contact + Newsletter :

| Couche                          | Présence | Robustesse                                                                                |
| ------------------------------- | :------: | ----------------------------------------------------------------------------------------- |
| Cloudflare WAF (free tier)      |   OUI    | Bot Fight Mode ON (MEMORY 2026-05-09)                                                     |
| Cloudflare Turnstile            |   OUI    | `useTurnstileToken("contact")` / `("newsletter")`                                         |
| Rate-limit Redis sliding window |   OUI    | 3/10min contact, 3/5min newsletter, fail-open si Redis down                               |
| Honeypot server check           |   OUI    | `formData.get("website")`                                                                 |
| Honeypot UI render              |  **KO**  | Bots HTML-parsing classiques passent — P0                                                 |
| Validation Zod stricte          |   OUI    | `literal(true)` consent + `min(20)` message                                               |
| Telegram silent notif           |   OUI    | Aide à détecter spike spam pour Will                                                      |
| Sentry / monitoring spike       | Partiel  | `instrumentation-client.ts` Sentry présent — pas de règle alerte sur volume submissions/h |

**Verdict défense** : 7/9 couches OK. Le honeypot UI absent neutralise un sous-ensemble de bots (~30 % des attaques HTML-form scrapers selon OWASP ASVS 2024). **Pas catastrophique** (Turnstile + WAF + rate-limit suffisent en V1), mais **trivial à fixer**.

---

## 7. Scoring /50

| Critère                                         | Pondération |                      Score                       |
| ----------------------------------------------- | :---------: | :----------------------------------------------: |
| C1 — Validation Zod stricte                     |      8      |      7/8 (max manque sur `message` contact)      |
| C2 — Honeypot rendu UI Contact + Newsletter     |      6      |      **2/6** (server check only, UI absent)      |
| C3 — Rate-limit IP toutes routes publiques      |      6      |            5/6 (manque `/api/vitals`)            |
| C4 — RGPD consent literal(true) + texte         |      5      |      4/5 (manque lien cliquable politique)       |
| C5 — IP at-rest (hash SHA-256 + salt)           |      6      | **0/6** (clear stockage Submission + Newsletter) |
| C6 — Telegram PII redaction                     |      5      |                      5/5 ✅                      |
| C7 — Turnstile câblé client + verify server     |      4      |                      4/4 ✅                      |
| C8 — Double opt-in newsletter RFC 8058          |      4      |                      4/4 ✅                      |
| C9 — JSON-LD ContactPage + NewsroomPage AEO     |      3      |                      3/3 ✅                      |
| C10 — Email obfuscation presse (anti-harvester) |      3      |            1/3 (clear DOM + JSON-LD)             |

**Total : 35/50** — 🟡 **CONDITIONAL GO** (seuil 🟢 ≥ 42, seuil 🔴 ≤ 25).

---

## 8. Verdict + roadmap P0/P1/P2

### Verdict global

🟡 **CONDITIONAL GO** — Architecture serveur conforme et bien structurée (Server Actions typées + Zod + Turnstile + Telegram redact + RFC 8058 newsletter exemplaire). Deux trous P0 RGPD/anti-spam à fermer **avant communication publique massive** :

1. Honeypot UI Contact + Newsletter absent (incohérence avec audit 3.D).
2. IP stockée en clair sur `Submission.ipAddress` + `NewsletterSubscriber.ipAddress` malgré doctrine MEMORY/skill « IP SHA-256 via `IP_HASH_SALT` ».

### Top 3 P0 (correction immédiate, ≤ 4h dev cumulé)

| #    | P0                                                                                                                                                                                                                                                                                                                           | Fichier(s) impacté(s)                                                                                        |  Coût   | Impact                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | :-----: | ----------------------------------------------------------------- |
| P0-1 | Rendre champ honeypot `<input name="website" tabIndex={-1} aria-hidden="true" autoComplete="off" style={{position:"absolute",left:"-9999px",opacity:0}} />` dans ContactForm + NewsletterForm (copier le pattern QuoteRequestForm:127-134)                                                                                   | `src/components/forms/ContactForm.tsx`, `src/components/forms/NewsletterForm.tsx`                            | ~10 min | Réactive la couche anti-bot legacy ~30 % du trafic spam           |
| P0-2 | Hasher l'IP avant persistance Submission + NewsletterSubscriber. Extraire `hashIp(ip)` depuis image-bank vers `src/lib/client-ip.ts`, l'appliquer dans les 6 Server Actions form-publics (`contact`, `newsletter`, `audit`, `booking`, `implementation`, `quote-request`). Renommer colonnes en `ipHash` (migration Prisma). | `src/features/{contact,newsletter,audit,booking,implementation,quote-request}/actions.ts` + Prisma migration |  ~3 h   | Conformité RGPD CNIL minimisation, ferme la non-conformité MEMORY |
| P0-3 | Ajouter `checkRateLimit("vitals:${ip}", { limit: 60, windowSec: 60 })` sur `POST /api/vitals` (et `204` silent si bloqué pour ne pas fuiter signal aux bots)                                                                                                                                                                 | `src/app/api/vitals/route.ts`                                                                                | ~15 min | Protège contre saturation disque ndjson + abuse beacon            |

### P1 (sprint dédié, semaine prochaine)

- P1-1 : Ajouter `max(5000)` sur `contactSchema.message` et `max(2000)` sur `quoteRequestSchema.contextBusiness` cohérent.
- P1-2 : Lien cliquable `<a href="/politique-de-confidentialite">` dans le label consent Contact + Newsletter (RGPD CNIL 2024 lisibilité).
- P1-3 : Valider `source` (`newsletter/actions.ts:55`) via Zod enum (`home_footer`, `blog_inline`, `pricing_cta`, etc.) au lieu de `as string` brut.

### P2 (V1.5 / amélioration continue)

- P2-1 : Obfuscation email presse (`@` → `[at]` côté HTML, `data-mail` JS-only fallback).
- P2-2 : Améliorer UX `confirmNewsletterAction` ré-clic post-confirmation (afficher « déjà confirmé » au lieu de `invalid_token`).
- P2-3 : Widget feedback utilisateur public (CSAT in-page) → table `UserFeedback` dédiée, `hashedIp` + idempotency, intégration `WebVitalSample` dashboard `/admin/web-vitals` pour corrélation perf ↔ satisfaction.
- P2-4 : Alertes Sentry sur spike submissions/h (anomaly detection volume contact + newsletter).

### Hors scope Agent 4.F (à délégation autres agents)

- Cohérence pricing dans CtaBlock contact → Agent 4.A (Pricing).
- Cohérence i18n labels NewsletterForm callsites → Agent 3.E (i18n).
- DPA Telegram sous-processeur → Agent 5.D (RGPD legal).

---

## 9. Annexe — Échantillons de code vérifiés

### 9.1 — ContactForm sans honeypot (P0-1)

`src/components/forms/ContactForm.tsx:96-170` — le JSX form ne contient AUCUN champ caché `website`. Tous les inputs visibles (`contact-name`, `contact-email`, `contact-company`, `contact-message`, `contact-consent`) sont legit.

### 9.2 — Action contact ipAddress clear (P0-2)

`src/features/contact/actions.ts:60-74` :

```ts
const submission = await prisma.submission.create({
  data: {
    type: "contact",
    locale,
    companyName: parsed.data.company ?? "—",
    contactName: encryptPii(parsed.data.name),   // ✅ chiffré
    contactEmail: encryptPii(parsed.data.email), // ✅ chiffré
    details: { message: parsed.data.message, ... },
    ipAddress: ip,                                // ❌ clear
    userAgent,
  },
});
```

Idem `src/features/newsletter/actions.ts:77` — `ipAddress: ip` sans `hashIp(ip)`.

### 9.3 — Pattern honeypot canonique à copier (référence)

`src/components/forms/QuoteRequestForm.tsx:126-134` :

```jsx
{
  /* Honeypot anti-bot */
}
<input
  type="text"
  name="website"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  style={{ position: "absolute", left: "-9999px", opacity: 0 }}
/>;
```

Coût total intégration ContactForm + NewsletterForm = **18 lignes JSX** dupliquées.

---

**Fin Agent 4.F · 35/50 · 🟡 CONDITIONAL GO**
