# A15 Phase 15 — RealTestimonials marker + filter

## Statut : ⚠️ STUB-OK

Implémentation complète et propre côté server action (marker + filter + Zod + Sentry + stub-aware + rate-limit + revalidate). Tests verts isolés. Aucune consommation UI/JSON-LD pour l'instant — le filter est exporté mais zéro callsite hors test. Conforme à la note du commit qui annonce l'admin UI post-deploy.

## Files claimed vs found

Commit `456f7da8` annonce 2 fichiers (275 lignes insertions). Verdict : exact.

| Claimed                                                              | Found                                                                        | Lignes |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| `src/server/actions/content-gen/real-testimonials.ts`                | `axionia/src/server/actions/content-gen/real-testimonials.ts`                | 137    |
| `src/server/actions/content-gen/__tests__/real-testimonials.spec.ts` | `axionia/src/server/actions/content-gen/__tests__/real-testimonials.spec.ts` | 138    |

Pas de migration Prisma — storage via JSON `displayPages.realMeta` sur model `Testimonial` existant. Cohérent avec le commit ("Pas de migration Prisma").

## Tests count : claimed 5 / found 5

RT1 → `markAsRealTestimonial` throw `testimonial_not_found` si id inconnu.
RT2 → injection `realMeta` dans `displayPages` JSON + préservation autres clés + revalidate `/fr/presse`.
RT3 → Zod URL invalide rejette.
RT4 → `getRealTestimonialsOnly` early-exit `[]` en mode `stub.invalid` (pas d'appel `findMany`).
RT5 → filtre ne retient que les rows avec `realMeta.isReal === true` (3 fixtures → 1 retenu).

Tous les tests ont des assertions effectives (pas de no-op). Mocks Prisma + next/cache + `_auth` + Sentry corrects.

## Cross-checks

- **Marker logic (real vs synthetic) : oui**
  - `RealTestimonialMetadataSchema` strict (Zod `.strict()`) — exige `isReal: literal(true)`, `source: url().max(500)`, `consentDate: datetime()`, `verifiedBy?` et `notes?` optionnels.
  - `markAsRealTestimonial` force `isReal: true` côté serveur (`{ ...meta, isReal: true }`) — impossible de marquer un faux comme réel par data.
  - `getRealTestimonialsOnly` filtre `where: { status: "published" }` puis applique `realMeta?.isReal` check côté JS (TypeScript narrowing strict).
  - Le RGPD est tracé via `consentDate` ISO datetime obligatoire + `source` URL vérifiable obligatoire — bonne hygiène conformité.

- **Consumers UI/JSON-LD : ZÉRO**
  - Grep `getRealTestimonialsOnly|markAsRealTestimonial` dans `axionia/src/**` → uniquement 2 fichiers (le module + son test).
  - `axionia/src/app/[locale]/presse/page.tsx` ne contient AUCUNE mention `testimonial|Testimonial`.
  - Aucune route admin `/content-gen/testimonials` (ni `new`) trouvée hors mention dans le commentaire de fichier et le commit message.
  - Le `revalidatePath("/fr/presse")` dans `markAsRealTestimonial` est donc préventif/futur — la page Press hub n'utilise pas encore le filter.

- **Stub-aware : oui** — `getRealTestimonialsOnly` short-circuit explicite `stub.invalid` (test RT4 le couvre). `markAsRealTestimonial` n'a pas d'early-exit similaire (au build, mutation impossible de toute façon — `prisma.ts` Proxy throw sur update). Cohérent avec contrat AGENTS.md.

- **Sécurité : oui** — `requireAdminWriteRateLimited` (limit 30/min), Sentry capture avec `adminUserId` + `testimonialId`, Zod strict + `.url()` + `.datetime()`.

- **Préservation `displayPages` : oui** — guard `typeof === "object" && !== null` puis spread `...prevDisplay, realMeta: parsed`. Test RT2 vérifie `otherKey: "preserved"`.

## Verdict / écarts trouvés

✅ Le code livre exactement ce que le commit annonce — marker + filter + Zod + 5 tests + stub-aware.
⚠️ Le filter n'est pas encore consommé (0 callsite hors test). C'est explicitement assumé par le commit ("Action Will : admin UI ... permet ajout post-deploy") mais cela signifie que la "perfection 2026" testimonials Press hub n'est pas effective tant que :

1. Une page admin permet d'invoquer `markAsRealTestimonial` (form + bouton).
2. La page `/fr/presse` (ou autre Press hub) appelle `getRealTestimonialsOnly` pour rendu + JSON-LD `Review`/`testimonial` filtré.

Aucun écart par rapport au scope claim. STUB-OK : la primitive est correcte, prête à être branchée Phase 16+. Pas de bug, pas de mock prod, pas d'invention.

Reco : tracer en TODO Sprint Session 11+ le wiring `/fr/presse` + admin form, sinon le marker reste latent en DB sans effet visible.
