# 27 — API DESIGN + FORMS + STATES 2026

> Audit conception API (Server Actions + REST), patterns formulaires Zod symétrique, couverture loading/empty/error states par route.
> Comble le gap « professionnel SaaS premium » identifié par audit indépendant 2026-05-08.
> Lancer fenêtre fraîche.

## 0. Contexte

Pour atteindre niveau Linear/Stripe/Vercel, il faut :

- API design cohérent (Server Actions Next 16 + API routes si besoin)
- Forms 100 % Zod symétrique (client + serveur)
- Couverture systématique loading / empty / error states

Trois angles non traités par les autres prompts. Référence thresholds : `README.md` § Thresholds canoniques.

## 1. Audit en 7 chapitres × 10 critères = 70 points

### Chapitre 1 — Server Actions design

1.1 Toutes Server Actions retournent shape uniforme `{ ok: true, data } | { ok: false, error: string, fieldErrors?: Record<string, string[]> }`
1.2 ESLint rule custom OU TypeScript type alias `ActionResult<T>` enforced
1.3 Aucune Server Action ne `throw` (toujours retourner `{ ok: false }`)
1.4 Server Action nommée verbe + objet (`createBooking`, `updateAuditStatus`, `deleteCity`)
1.5 Inputs validés Zod **côté serveur** systématiquement (jamais de trust client)
1.6 `revalidatePath` / `revalidateTag` appelé après mutation atomic
1.7 Authentification check en première ligne (Sprint 16)
1.8 Authorization check (RBAC ou simple) (Sprint 16)
1.9 Rate limiting (Caddy ou middleware) sur Server Actions sensibles
1.10 Audit log (Sprint 16) sur Server Actions critiques

### Chapitre 2 — REST API routes (`app/api/*`)

2.1 Routes API uniquement pour endpoints publics ou third-party webhooks
2.2 Server Actions privilégiées pour interactions internes (pas API route)
2.3 Status codes HTTP corrects (200 / 201 / 400 / 401 / 403 / 404 / 409 / 422 / 500)
2.4 Error envelope `{ error: string, code: string, details?: object }` cohérent
2.5 Versioning (`/api/v1/*`) si endpoint exposé externe
2.6 Idempotence garantie (header `Idempotency-Key` sur POST critiques)
2.7 OpenAPI schema généré (optionnel mais pro)
2.8 CORS strict (whitelist origines)
2.9 Validation Zod inputs + Zod sortie (assertions runtime)
2.10 Logs request/response sans PII

### Chapitre 3 — Forms (Zod symétrique client + serveur)

3.1 1 seul schema Zod par form, partagé client (validation UI) + serveur (Server Action)
3.2 `react-hook-form` + `@hookform/resolvers/zod` ou `useFormState`/`useActionState` Next 16
3.3 Inline validation real-time (debounce 200-300 ms)
3.4 Erreurs reliées au champ (`aria-describedby` + `role="alert"`)
3.5 Erreurs serveur affichées au champ correct (mapping `fieldErrors`)
3.6 Optimistic UI sur actions non-critiques (avec revert si fail)
3.7 Form persisté LocalStorage si > 6 fields (recovery sur reload)
3.8 Submit button disabled pendant pending (`aria-busy`)
3.9 Confirmation immediate post-submit (visual + screen reader announce)
3.10 Tests vitest schema + Playwright e2e form happy + error path

### Chapitre 4 — Loading states coverage

4.1 `loading.tsx` granulaire par route segment lourd (pas un seul global)
4.2 Skeleton dimensionné aux dimensions réelles du contenu (CLS = 0)
4.3 Spinner/loader réservé aux actions ponctuelles (jamais full page)
4.4 Progress bar pour multi-step forms (visible pourcentage ou step count)
4.5 Pending state Server Action via `useFormStatus()` hook
4.6 Skeleton respecte `prefers-reduced-motion` (pas d'animation pulse)
4.7 Loading messages internationalisés (i18n)
4.8 Aucun loader > 3 sec sans message ou action utilisateur
4.9 Couverture mesurée : table « route × loading state présent oui/non »
4.10 Cible : 100 % routes lourdes ont loading.tsx custom

### Chapitre 5 — Empty states design

5.1 Empty state pour chaque liste/grille filtrable (search 0 results, filter 0 results)
5.2 Empty state explique pourquoi vide + action suggérée
5.3 Illustration ou icône (pas juste texte)
5.4 CTA pour sortir du vide (« Réinitialiser filtres », « Créer le premier X »)
5.5 i18n complet
5.6 Accessible (annoncé screen reader)
5.7 Tests Playwright : visiter route avec data vide → empty state visible
5.8 Empty state ≠ erreur (signal positif, pas négatif)
5.9 Couverture mesurée : table « route × empty state oui/non »
5.10 Cible : 100 % listes filtrables ont empty state

### Chapitre 6 — Error states design

6.1 `error.tsx` granulaire par route segment (pas un seul global)
6.2 `not-found.tsx` granulaire si pertinent
6.3 Erreur user-friendly (jamais stack trace en prod)
6.4 Bouton « Réessayer » (`reset()` Next 16)
6.5 Lien retour home/safe page
6.6 Suggestions liens utiles (cf. doctrine error page existante)
6.7 Error digest affiché pour support (`error.digest`)
6.8 Logged côté serveur (Sentry free ou logs Coolify)
6.9 i18n complet
6.10 Couverture mesurée : table « route × error.tsx oui/non »

### Chapitre 7 — Form validation patterns avancés

7.1 Async validation (ex. email unique) via Server Action côté field
7.2 Cross-field validation (password = confirmPassword) via Zod `.refine()`
7.3 Conditional fields (champ X visible si Y = valeur) géré clean
7.4 File upload : taille, type, sanitize, preview
7.5 Phone number validation + format (libphonenumber-js si international)
7.6 Email validation deep (DNS check côté serveur si critique)
7.7 SIRET/SIREN validation (déjà ✅ check existant)
7.8 Captcha sur forms publics anti-spam (Cloudflare Turnstile gratuit)
7.9 Honeypot anti-bot
7.10 Tests cas limites (chars spéciaux, unicode, max length)

## 2. Méthode

### Phase A — Inventaire

1. Lister toutes Server Actions (`grep -r "use server"`)
2. Lister toutes routes API (`find src/app/api`)
3. Lister tous forms (composants + Server Actions associées)
4. Lister `loading.tsx`, `error.tsx`, `not-found.tsx` par segment
5. Lister listes/grilles filtrables (besoin empty state)

### Phase B — Diagnostic /70

Évaluer chaque critère 0/0,5/1.

### Phase C — Plan

- Tables de couverture (route × état)
- Patches manquants (loading/empty/error à créer)
- Refactor Server Actions vers shape uniforme
- Schema Zod factorisés client+serveur

### Phase D — STOP & ASK

Livre :

- `audit-27-api-forms-states-SYNTHESE.md`
- `audit-27-api-forms-states-DIAGNOSTIC.md`
- `audit-27-api-forms-states-COVERAGE-TABLE.md` (route × state)
- `audit-27-api-forms-states-PLAN.md`

### Phase E — Application après GO

## 3. STOP & ASK

1. Avant refactor Server Actions massif (impact compat)
2. Avant changement API contract public (versioning)
3. Avant ajout Captcha (UX impact)
4. Avant ajout dépendance forms
5. Avant tout commit
6. Si > 30 % routes manquent loading/empty/error states (signal majeur)

## 4. Anti-patterns à éviter (Pitfalls)

- ❌ Server Action qui `throw` (use `{ ok: false }` shape)
- ❌ Validation Zod uniquement client (toujours serveur)
- ❌ Spinner full-page bloquant (use streaming + skeleton)
- ❌ Empty state qui ressemble à erreur (couleur, icône)
- ❌ Error message avec stack trace en prod
- ❌ Form submit sans pending state (double submit garanti)
- ❌ `loading.tsx` global qui s'affiche partout (granularité par segment)

## 5. Cible

> Tous Server Actions retournent shape uniforme. 100 % forms Zod symétrique. 100 % routes lourdes ont loading.tsx custom. 100 % listes filtrables ont empty state. 100 % segments lourds ont error.tsx. Aucun stack trace prod. Aucun double submit possible.

## 6. Livrables

```
audit-27-api-forms-states-SYNTHESE.md
audit-27-api-forms-states-DIAGNOSTIC.md
audit-27-api-forms-states-COVERAGE-TABLE.md
audit-27-api-forms-states-PLAN.md
```

---

**FIN DU PROMPT 27.**
