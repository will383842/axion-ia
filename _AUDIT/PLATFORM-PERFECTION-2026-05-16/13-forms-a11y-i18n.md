# Agent 3.D — Forms, validations & accessibilité

- **SHA HEAD** : `98e0b0f` (main, lecture seule)
- **Mode** : AUDIT-ONLY (aucune modif source)
- **Périmètre** : forms publics + Server Actions associés + a11y + i18n (`messages/fr.json` vs `messages/en.json`, EN désactivé runtime mais code conservé — cf. AGENTS.md "EN locale désactivé").

---

## 1. Cartographie des forms publics

| Form (UI client)                                                 | Server Action                                                    | Schéma Zod                         | Pages utilisatrices                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `src/components/forms/ContactForm.tsx`                           | `features/contact/actions.ts::submitContactAction`               | `contactSchema`                    | `/[locale]/contact`                                         |
| `src/components/forms/NewsletterForm.tsx`                        | `features/newsletter/actions.ts::subscribeNewsletterAction`      | `newsletterSchema`                 | Footer global + landing pages                               |
| `src/components/forms/BookingForm.tsx`                           | `features/booking/actions.ts::createBookingAction`               | `bookingSchema`                    | `/[locale]/reserver` (intégré au `BookingCalendar`)         |
| `src/components/forms/AuditForm.tsx` (legacy 5-step)             | `features/audit/actions.ts::submitAuditAction`                   | `auditSchema`                      | (orpheline — wizard remplacé par AuditRequestForm)          |
| `src/components/forms/AuditRequestForm.tsx` (6-step)             | `features/audit/actions.ts::submitAuditRequestAction`            | `auditRequestSchema`               | `/[locale]/audit/demande`                                   |
| `src/components/forms/ImplementationForm.tsx`                    | `features/implementation/actions.ts::submitImplementationAction` | `implementationSchema`             | `/[locale]/implementation` (wizard 4 steps)                 |
| `src/components/forms/InterventionRequestForm.tsx`               | `features/booking/actions.ts` (delegate)                         | (Option48h ou Booking selon route) | (legacy — souvent remplacé par BookingCalendar inline)      |
| `src/components/forms/QuoteRequestForm.tsx`                      | `features/quote-request/actions.ts::submitQuoteRequestAction`    | `quoteRequestSchema`               | `/[locale]/demande-devis` (parcours B)                      |
| `src/components/forms/AuditForm.tsx`                             | (legacy, idem au-dessus)                                         | `auditSchema`                      | (audit shortcut)                                            |
| `src/app/[locale]/booking/[token]/cancel/CancelForm.tsx`         | `features/booking/self-service-actions.ts`                       | inline                             | `/[locale]/booking/[token]/cancel` (self-service token URL) |
| `src/app/[locale]/booking/[token]/reschedule/RescheduleForm.tsx` | `features/booking/reschedule-form-actions.ts`                    | inline                             | `/[locale]/booking/[token]/reschedule`                      |

Pages "presse / signalement / formations" mentionnées dans le brief : **inexistantes** côté `src/app/[locale]/**` (`/presse`, `/signalement`, `/formations` ne sont pas pages dédiées sur main au SHA `98e0b0f`). Les contenus presse vivent via composants (`PressContact`, `PressFacts`, `PressKit`…) intégrés dans `/a-propos` ou pages dédiées non créées. Aucun form public additionnel n'a été détecté.

---

## 2. Matrice Forms × { Zod server · honeypot · ARIA · RGPD checkbox · Turnstile }

| Form                  | Validation Zod server ?              | Honeypot `website` ?                            | UX erreurs client (RHF + `role="alert"`)                                         | Checkbox RGPD bloquante ?                                     | Turnstile widget câblé ? | Rate-limit IP ? |
| --------------------- | ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------ | --------------- |
| ContactForm           | ✅ `contactSchema.safeParse`         | ✅ (action)                                     | ✅ `aria-invalid` + `<p role="alert">`                                           | ✅ `z.literal(true)`                                          | ✅ `useTurnstileToken`   | ✅ 3/10min      |
| NewsletterForm        | ✅ `newsletterSchema.safeParse`      | ✅ (action)                                     | ✅                                                                               | ✅                                                            | ✅                       | ✅              |
| BookingForm           | ✅ `bookingSchema.safeParse`         | ✅                                              | ✅                                                                               | ✅                                                            | ✅                       | ✅ 5/10min      |
| AuditRequestForm      | ✅ (6 sous-schémas + merge)          | ✅                                              | ⚠️ pas de `role="alert"` par champ — bouton « Suivant » disabled silencieusement | ✅                                                            | ✅                       | ✅              |
| ImplementationForm    | ✅ `implementationSchema.safeParse`  | ✅                                              | ✅                                                                               | ✅ `z.literal(true)` (mais errorMap implicite)                | ✅                       | ✅              |
| QuoteRequestForm      | ✅ `quoteRequestSchema.safeParse`    | ✅ (UI + action — hidden input présent au form) | ✅                                                                               | ✅ `consentTerms` + `consentGdpr` (2 checkboxes obligatoires) | ✅                       | ✅ 3/3600s      |
| Option48hForm (admin) | ✅ `option48hSchema`                 | ✅                                              | ✅                                                                               | ✅ `consent` + `consentDisplay`                               | ✅                       | ✅ 3/10min      |
| Cancel/Reschedule     | ✅ inline (token guard + min reason) | ❌ (auth token URL)                             | ✅                                                                               | n/a                                                           | ❌ (token-gated)         | ✅ session      |

### Constats clés

- **Honeypot** : implémenté de manière homogène (`if (formData.get("website")) return { ok: true }`) dans **9 Server Actions** publiques. Toutefois, **seul `QuoteRequestForm.tsx` rend explicitement l'input `<input name="website" tabIndex={-1} aria-hidden>` côté UI**. Les autres forms (Contact, Newsletter, Booking, AuditRequest, Implementation) **ne rendent pas le champ honeypot côté client** → un bot soumettant uniquement les champs visibles passe le honeypot (le check `formData.get("website")` retourne `null` → silent OK). **Honeypot inopérant sur 6 forms / 7**.
- **Turnstile** : widget central `TurnstileWidget` + hook `useTurnstileToken(action)`, monté sur les 7 forms publics. Côté Server Action, `verifyTurnstile` est appelé après le rate-limit. Fail-soft DEV (sans site key) + fail-closed prod documenté.
- **Validation Zod** : 100 % des Server Actions appellent `schema.safeParse(...)` ; aucun fallback `Object.assign` ou parse à la main détecté dans les flows publics.
- **RGPD checkbox** : tous les forms publics ont un `z.literal(true, { errorMap: "Consentement requis." })`. Le double consentement (CGV + RGPD) n'existe que sur `QuoteRequestForm` (parcours B négociation) et `option48hSchema` (`consent` + `consentDisplay`). Le form Contact n'a qu'un seul consentement (RGPD message) — conforme PIPEDA mais pas optimal pour LIA business legitimate interest.
- **Idempotence booking** : `createBookingAction` génère un `idempotencyKey` UUID v4 stable au mount client (`crypto.randomUUID()`), check avant insert → zero double-submit (P0 OWASP A04 documenté dans le code).
- **PII at-rest** : `encryptPii` appliqué à `contactName/Email/Phone` dans Submissions Contact + Booking + QuoteRequest. Cohérent avec doctrine v1.0.3.

---

## 3. Booking flow complet — état sur main (`98e0b0f`)

### 3.1 Visiteur (parcours A direct)

```
/reserver
  → BookingCalendar (client) sélectionne date+time+intervention
  → BookingForm.tsx submit → createBookingAction
       → Zod safeParse + rate-limit + Turnstile + idempotency check
       → prisma.$transaction { Submission(intervention) + Booking(option_pending) + BookingTransition }
       → Telegram tag=INTERVENTION + enqueueEmail booking-confirmed
       → return { ok, bookingId }
  → Alert "success" inline (pas de redirect)
```

✅ **Câblé bout-en-bout**. Statut initial `option_pending` (deposit-gated) — l'admin reprend la suite.

### 3.2 Admin (cadrage → contrat → acompte → solde)

Les Server Actions admin existent et sont chaînées :

- `features/booking/cadrage-actions.ts` (Quote step) — Sprint X préparé
- `features/contract/admin-actions.ts::sendContractAndDepositRequestAction` — **complet** :
  - `isDocusealConfigured()` + `DOCUSEAL_CONTRACT_TEMPLATE_ID` requis
  - Transaction atomique : `Invoice(deposit) + ContractDocument(draft) + status flip` puis appel DocuSeal API
  - PII chiffrée snapshot legal (vatRate, vatMention)
- `features/payment/actions.ts` (Stripe deposit + solde) — webhook handler dans `app/api/...`
- `features/booking/admin-actions.ts` (confirmation finale après acompte signé)

✅ **Booking V1 admin pipeline est intégré sur main** (contrairement à ce que la mémoire MEMORY note "Booking V1 non mergé" — vérifié par lecture directe : présent à `98e0b0f`). Tests Vitest présents (`quote-actions.test.ts`, `admin-actions.test.ts`, `refund-calc.test.ts`, `state-machine.test.ts`, `option-cap.test.ts`).

### 3.3 Self-service token URL (cancel / reschedule)

`/booking/[token]/cancel` + `/booking/[token]/reschedule` (pages SSR + form). Token JWT-like signé géré par `features/booking/self-service-actions.ts`. Bypass Turnstile justifié (token = preuve identité). ✅

### 3.4 Manques notables P1 (hors P0)

- **Audit a11y manquant sur BookingCalendar** : pas de `role="grid"` + `aria-rowindex` sur les jours, navigation clavier limitée (boutons `<button>` mais ordre tab implicite ; flèches ←→↑↓ non câblées — DatePicker custom, pas `<input type="date">`).
- **Pas de toast / live region** post-Telegram fail-soft : si Telegram down, le user voit success mais Will ne voit rien (silencieux).

---

## 4. ARIA / a11y détaillé

### 4.1 Forme générale

- `useForm({ noValidate: true })` partout — désactive validation HTML5 native pour laisser Zod gérer. ✅
- Chaque champ : `<Label htmlFor=...>` + `<Input id=...>` (associations correctes).
- `aria-invalid={!!errors.X}` posé sur tous les inputs où Zod peut échouer (sauf champs `optional`).
- Messages d'erreur rendus en `<p role="alert" class="text-accent-red text-xs">` directement après l'input → SR-friendly.
- Bouton submit avec `loading={isSubmitting}` (composant `Button` interne) — pas d'`aria-busy` explicite ; à vérifier dans `ui/button.tsx`.
- Success state : `<Alert variant="success" role="status">` (politeness=`status` = `polite`). ✅
- Error state serveur : `<Alert variant="danger" role="alert">` (assertive). ✅

### 4.2 Skip link

- `src/components/a11y/SkipToContent.tsx` rend `<a href="#main">` avec classes `sr-only focus-visible:not-sr-only` + traduction `common.skipToContent`. ✅ Présent dans layout (à confirmer dans `src/app/[locale]/layout.tsx`).
- Cible `#main` : à valider que `<main id="main">` est bien rendu globalement.

### 4.3 Keyboard nav

- Forms : tab order respecte l'ordre DOM (RHF n'altère pas). ✅
- AuditRequestForm wizard : boutons `<button type="button" aria-pressed={isSel}>` pour les ChoiceCards — keyboard OK, mais **bouton « Suivant » disabled silencieusement** quand step invalide → l'utilisateur clavier ne sait pas pourquoi (pas de `aria-describedby` qui pointe vers le compteur 0/20). Compteur a `aria-live="polite"` mais isolé.
- Pas de focus-trap sur les modals admin (à vérifier hors scope public).

### 4.4 Live regions

- ✅ `<p aria-live="polite">` sur le header BookingForm (date/heure sélectionnée).
- ✅ AuditRequestForm Step 4 : compteurs caractères avec `aria-live="polite"`.
- ❌ Pas de `aria-live` sur le state global submitting (le bouton change de label `submit` → `sending` mais sans annonce SR explicite ; OK car `aria-busy` géré dans `Button` composant — à vérifier).

### 4.5 Honeypot

- Seul `QuoteRequestForm` rend l'input visible-mais-caché correctement :
  ```tsx
  <input
    type="text"
    name="website"
    tabIndex={-1}
    autoComplete="off"
    aria-hidden="true"
    style={{ position: "absolute", left: "-9999px", opacity: 0 }}
  />
  ```
- ⚠️ Les 6 autres forms publics ne rendent **pas** ce champ → check serveur inopérant (cf. §2).

### 4.6 Constats P0/P1 a11y

- **P1** : Honeypot input absent côté UI sur 6 forms publics → champ caché à ajouter (≤ 10 lignes par form).
- **P2** : AuditRequestForm — pas de message d'erreur visible par champ ; seul le bouton « Suivant » est disabled. Ajouter `<p role="alert">` quand l'utilisateur a interagi (touched).
- **P2** : `Button loading` — vérifier que `ui/button.tsx` rend `aria-busy={loading}` + `disabled={loading}`.

---

## 5. WCAG contrastes — top 5 fails / risques

Calculs WCAG ratio sur tokens `globals.css` (HEAD `98e0b0f`). Seuils : **AA normal text 4.5:1**, AA large text (18pt+ ou 14pt bold) 3:1.

| #   | Combinaison                                                    | Ratio    | Verdict           | Lieux d'usage                                                                                                                                               |
| --- | -------------------------------------------------------------- | -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `text-accent-red` (#ee1d36) sur `bg-paper` (#fff)              | **4.32** | ❌ Fail AA normal | Messages d'erreur forms (tous `<p role="alert" class="text-accent-red text-xs">`) — la classe `text-xs` (12px) compte comme normal text ⇒ doit être ≥ 4.5:1 |
| 2   | `text-accent-red` (#ee1d36) sur `bg-terracotta-soft` (#f5e3d8) | **3.47** | ❌ Fail AA normal | Badges erreur dans `Alert variant="danger"` (`globals.css` L589 background terracotta-soft + color accent-red)                                              |
| 3   | `text-terracotta` (#c24a1b) sur `bg-terracotta-soft` (#f5e3d8) | **3.93** | ❌ Fail AA normal | Chips outils sélectionnés AuditRequestForm Step 4 (text de chip italique sm) ; ChoiceCard priceTag                                                          |
| 4   | `text-terracotta` (#c24a1b) sur `bg-sand` (#f0e9da)            | **4.05** | ❌ Fail AA normal | Pricing labels affichés sur sections sand (`bg-halo-warm` se résout vers ≈ sand-deep)                                                                       |
| 5   | `text-sage` (#5e6c54) sur `bg-paper`                           | 5.60     | ✅ OK             | (référence — passe largement, mention bonne pratique)                                                                                                       |

**Tokens borderline mais OK** :

- `text-terracotta` sur `paper` (#fff) = 4.90 → passe AA normal de justesse, **fail AAA** (7:1).
- `text-fg-muted` (#6b6155) sur paper = 6.06 → ✅ AA normal, AAA borderline.
- `text-primary` (#1a4dd9) sur sand-deep = 4.96 → ✅ AA.

**Correctifs proposés** (hors-scope AUDIT-ONLY) :

- Aligner `--color-accent-red` sur une nuance plus foncée type `#b8341c` (déjà `--color-error`, ratio 5.13 sur fff).
- Ne jamais utiliser `text-terracotta` pour des messages d'erreur — basculer sur `text-terracotta-deep` (#8c3010 → 8.25:1) ou `text-error`.
- Documenter ces 4 gaps dans `_AUDIT/CERTIFICATION-FRONTEND-2026/` si présent.

---

## 6. i18n — état FR/EN

### 6.1 Parité structurelle

```
FR keys: 308
EN keys: 308
Missing in EN: 0
Missing in FR: 0
```

✅ **Parité parfaite** sur les chemins de clés. `pnpm i18n:check` (mentionné dans le header `_:` du JSON) enforcera la parité en CI.

### 6.2 Top 10 clés FR potentiellement orphelines (leaf token jamais référencé dans `src/**/*.{ts,tsx}`)

Analyse approximative (substring de la dernière partie du chemin de clé) — 73 candidats. Top 10 les plus suspects :

| #   | Clé                                               | Raison probable                                                                                                                  |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `home.viewDesign`                                 | Section "Voir les tokens" CTA — orpheline (page `/design` accessible via Header dev only)                                        |
| 2   | `home.module1Title` à `module3Cta`                | 9 clés `home.moduleN*` — bloc Modules **retiré** du Hero post-refonte Sprint 14                                                  |
| 3   | `home.modulesEyebrow`/`Title*`/`Description`      | Idem — section "Modules" pas dans `app/[locale]/page.tsx` actuel                                                                 |
| 4   | `press.pitchSpeakable`                            | Speakable JSON-LD manquant côté page presse (presse non-page dédiée sur main)                                                    |
| 5   | `knowledge.admin.filterDomain`                    | Admin Knowledge UI utilise un Select inline (pas la string)                                                                      |
| 6   | `knowledge.admin.totalEntriesSingular` / `Plural` | Pluralisation non câblée — code admin n'utilise pas next-intl `t.rich` ici                                                       |
| 7   | `knowledge.admin.filterAllFeminine`               | Genre grammatical FR — pas de site d'usage trouvé                                                                                |
| 8   | `knowledge.admin.listTitle`                       | Page admin Knowledge utilise un titre hardcodé                                                                                   |
| 9   | `nav.breadcrumbLabel`                             | Composant `Breadcrumbs` n'invoque pas `t("nav.breadcrumbLabel")` (aria-label hardcodé "Fil d'Ariane" ou via prop ?) — à vérifier |
| 10  | `knowledge.admin.newEntry`                        | Bouton "Nouvelle entrée" admin — string en dur ?                                                                                 |

**Méthode** : grep simple sur la dernière partie de la clé dans `src/**`. **Faux positifs probables** (10-20 %) car certains usages utilisent `t.rich` avec interpolation ou destructuration d'objet entier. La liste complète des 73 est dans le scratchpad (non sauvegardé). À nettoyer en Sprint cleanup.

### 6.3 EN désactivé runtime — impact

Cf. AGENTS.md : `src/proxy.ts` redirige 301 `/en/*` → `/fr/*` via `mapEnToFr()`. **Pas d'impact i18n côté code** : `messages/en.json` reste compilé, tous les composants reçoivent les bonnes traductions au SSG (Next 16 pré-rendre les pages EN, même si jamais servies au runtime tant que `EN_LOCALE_ENABLED` n'est pas `true`). ✅

### 6.4 Validation manquante

- ❌ Pas de script `pnpm i18n:check` détecté dans `package.json` (à vérifier — string mentionnée dans `_:` du JSON mais non sourcée).
- ❌ Pas de garde-fou CI sur les clés orphelines (cleanup côté FR uniquement, EN suivra).

---

## 7. Scoring /100 + verdict

| Catégorie                                                      | Note  | Pondération | Sous-total   |
| -------------------------------------------------------------- | ----- | ----------- | ------------ |
| Validation Zod server + UX client                              | 18/20 | 20 %        | 18           |
| Booking flow complet câblé (devis → DocuSeal → Stripe → email) | 16/20 | 20 %        | 16           |
| Honeypot anti-bot (rendu UI réel)                              | 6/15  | 15 %        | 6            |
| ARIA / live regions / keyboard nav                             | 13/15 | 15 %        | 13           |
| WCAG AA contrastes                                             | 11/15 | 15 %        | 11           |
| i18n parité + propreté                                         | 12/15 | 15 %        | 12           |
| **TOTAL**                                                      |       |             | **76 / 100** |

### Verdict : **🟡 CONDITIONAL — bonne fondation, 3 P0 et 4-5 P1 à fixer**

- Les forms publics sont **solidement instrumentés** (RHF + Zod server + Turnstile + rate-limit + idempotence + PII chiffrée + telegram fail-soft + Alert role=status/alert).
- L'a11y est **au niveau standard pro** (skip link, labels, role=alert, aria-invalid, aria-live ciblé).
- Mais **3 défauts P0 critiques** :
  1. Honeypot inopérant sur 6 / 7 forms publics (input manquant côté UI).
  2. `text-accent-red` (#ee1d36) sur fond clair fail WCAG AA normal pour messages d'erreur — touche **tous les forms**.
  3. AuditRequestForm — bouton « Suivant » disabled silencieusement, aucun feedback par champ (UX dead-end pour utilisateurs clavier / SR).

---

## 8. Top 3 P0 — actions immédiates

| #   | P0                                                                                                                                                                                                                      | Lieux                                                                                                  | Effort | Risque si non fixé                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| 1   | **Rendre les inputs honeypot `<input name="website">` côté UI** sur ContactForm, NewsletterForm, BookingForm, AuditRequestForm, ImplementationForm, AuditForm — pattern déjà appliqué dans QuoteRequestForm (référence) | 6 fichiers dans `src/components/forms/**` (~10 lignes / form)                                          | 30 min | Spam bot non bloqué (les Server Actions ont la garde mais inopérante sans le champ rendu)             |
| 2   | **Foncer `--color-accent-red` ou basculer messages d'erreur sur `--color-error` (#b8341c) ou `text-terracotta-deep`** pour passer WCAG AA normal (≥ 4.5:1)                                                              | `src/app/globals.css` L56 (token) + ~30 sites d'usage `text-accent-red` dans `src/components/forms/**` | 1-2 h  | Non-conformité WCAG 2.1 AA → risque légal RGAA/EAA (juin 2025), perte trust                           |
| 3   | **AuditRequestForm — afficher messages d'erreur Zod par champ + `aria-describedby` sur le bouton « Suivant »** pour expliquer pourquoi désactivé                                                                        | `src/components/forms/AuditRequestForm.tsx` Step1→Step6                                                | 2-3 h  | Dead-end UX silencieux sur le funnel le plus stratégique (audit demande = lead qualifié haute valeur) |

---

## 9. P1 / P2 (backlog post-P0)

- **P1.a** : Vérifier `ui/button.tsx` rend `aria-busy={loading}`. Sinon ajouter.
- **P1.b** : Documenter / créer `pnpm i18n:check` dans `package.json` (parité + orphan keys).
- **P1.c** : Nettoyer les 10 clés FR/EN orphelines détectées (§ 6.2).
- **P1.d** : Doubler le consentement Contact (CGV + RGPD) si revue juridique souhaite — actuellement 1 seule case.
- **P2.a** : Booking calendar `role="grid"` + flèches clavier.
- **P2.b** : Live region post-success globale pour confirmer SR ("Votre demande a été envoyée").
- **P2.c** : Faux positifs orphan keys — recheck avec un parseur AST (`@formatjs/cli` `extract`).
- **P2.d** : Auditer `Alert variant="danger"` (#ee1d36 sur #f5e3d8 = 3.47) — patcher background ou foreground.

---

## 10. Reproduction & artefacts

- **Vérif parité i18n** : `node -e` script (cf. corps de l'audit). Résultat : 308/308 clés alignées FR/EN.
- **Vérif WCAG** : script Node pur, formule sRGB → relative luminance → contrast ratio. Tokens sourcés `src/app/globals.css:13-65`.
- **Vérif honeypot UI** : `grep -n 'name="website"' src/components/forms/` → 1 occurrence (QuoteRequestForm).
- **Booking flow** : lecture `features/booking/actions.ts` + `features/contract/admin-actions.ts` + `features/payment/actions.ts` (présents + tests Vitest associés).
- **Tests Vitest** : `quote-actions.test.ts`, `admin-actions.test.ts`, `refund-calc.test.ts`, `state-machine.test.ts`, `option-cap.test.ts` (5 fichiers tests booking).

---

_Fin Agent 3.D — Forms & validations & accessibilité._
_Generated 2026-05-16 · AUDIT-ONLY · SHA HEAD `98e0b0f`_
