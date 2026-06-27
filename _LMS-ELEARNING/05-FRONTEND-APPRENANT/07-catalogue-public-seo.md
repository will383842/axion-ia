# Catalogue public e-learning — fiche cours, SEO/AEO, tunnel d'inscription

> Spécification du **catalogue public** des cours e-learning (FOAD asynchrone) : pages vitrine indexables, fiche cours détaillée, structured data (`Course`/`CourseInstance`), budgets Web Vitals stricts, et **tunnel d'inscription/achat MVP (virement + octroi manuel)**.
>
> Phase produit : **V1** (le MVP livre un seul cours, accès ouvert manuellement ; la vitrine multi-cours indexable est V1 — cf. `11-ROADMAP/01-phasage-mvp-v1-v2.md`). Ce document décrit la cible V1 et explique comment articuler le catalogue e-learning **neuf** avec le catalogue formations **existant** (`catalog-v2.ts`).
>
> Statut : rédigé. Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR pour l'implémenteur

- Le catalogue e-learning est un **nouveau cluster d'URL** sous `src/app/[locale]/elearning/**` (FR canonique, EN désactivé), **distinct** du cluster formations Qualiopi `src/app/[locale]/formations/**` qui reste la SSOT des **17 formations intra-entreprise** (`catalog-v2.ts`).
- La **source de vérité** du catalogue e-learning est la **DB** (`ElearningCourse`, doc `03-DATA-MODEL/01`), **pas** un fichier TS statique. Différence assumée avec `catalog-v2.ts` (catalogue marketing statique) : un cours e-learning est créé/édité dans l'outil auteur admin, publié, puis indexé. La page est en **ISR `revalidate=3600`** + early-exit `stub.invalid` (contrat build ADR 0026).
- La structured data réutilise **`buildCourseJsonLd()` (déjà dans `src/lib/seo.ts`, l.1620)** — à **étendre** (mode `Online`, `Offer` virement, `coursePrerequisites`, `timeRequired`), jamais à dupliquer.
- Le tunnel MVP = **demande d'inscription → lead admin → octroi d'accès manuel** (réutilise le pattern lead `/contact` + `/appel`). **CB éteinte** (`STRIPE_ENABLED=false`, ADR-0004). La fiche affiche « Financement OPCO / entreprise / paiement par virement », jamais un bouton « Payer ».
- Budgets Web Vitals **stricts pages publiques** : LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0, First Load JS ≤ 75 KB gz/route. Le catalogue est **100 % serveur** (RSC) — aucun player vidéo, aucun JS lourd sur les pages publiques (le player est derrière l'auth apprenant, doc `02-lecteur-cours-player.md`).

---

## 1. Périmètre & frontière avec l'existant

### 1.1 Deux catalogues, deux intentions (ne pas confondre)

|             | **Formations Qualiopi** (existant)                               | **E-learning / FOAD** (neuf)                        |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| SSOT        | `src/content/formations/catalog-v2.ts` (statique, 17 formations) | DB : `ElearningCourse` (doc `03-DATA-MODEL/01`)     |
| Modalité    | présentiel / live (distanciel synchrone) — **intra-entreprise**  | **asynchrone (FOAD)**, accès individuel ou équipe   |
| Achat       | devis / lead `/appel` (prix dérivé de `FORMATION_PRICE_MATRIX`)  | demande d'inscription → octroi (MVP) ; CB plus tard |
| Cluster URL | `/formations/**`                                                 | `/elearning/**` (neuf)                              |
| JSON-LD     | `Course` `courseMode: Onsite`                                    | `Course` `courseMode: Online`                       |
| Pré-render  | `generateStaticParams` sur les 17 slugs FR                       | params DB + `dynamicParams=true`                    |

> **Décision (figée ici) :** on ne fusionne PAS les deux catalogues. Un cours e-learning peut **pointer** vers une `Formation` (`ElearningCourse.formationId`, optionnel) quand c'est le pendant asynchrone d'une formation présentielle, mais il garde sa **propre fiche** `/elearning/{slug}`. Cela évite de polluer le SSOT marketing `catalog-v2.ts` (qui dérive ses prix de la matrice, sans DB) avec une logique DB e-learning.

### 1.2 Articulation concrète avec `catalog-v2.ts`

- **Cross-linking SEO bidirectionnel.** Quand `ElearningCourse.formationId` est renseigné et que la `Formation` correspond à une entrée `catalog-v2.ts` (lookup par `Formation` → slug catalogue), la fiche e-learning affiche un encart « Version présentiel/intra disponible → `/formations/{slugFr}` » et réciproquement la fiche formation affiche « Disponible aussi en e-learning → `/elearning/{slug}` ». Ce maillage interne renforce la pertinence thématique (AEO) sans dupliquer le contenu.
- **Réutilisation des helpers prix.** Si un cours e-learning est adossé à une gamme/durée catalogue, on **réutilise** `getFormationEntryPrice()` / `formatFormationPrice()` (`src/content/pricing.ts`) pour afficher une fourchette cohérente. Sinon, le prix e-learning vient de `ElearningCourse` / `ElearningProduct` (doc `03-DATA-MODEL/05`, e-commerce). **Jamais de prix en dur dans la page** (règle SSOT `pricing.ts`).
- **Réutilisation des durées ISO.** `FORMATION_DUREE_ISO` (`catalog-v2-meta.ts`) sert pour les formations ; pour l'e-learning la durée est **calculée** (`ElearningCourse.dureeEstimeeMinutes`, somme des leçons) et convertie en ISO 8601 par un helper neuf `minutesToIso8601()` (cf. §4.3).

---

## 2. Arborescence des URL (cluster `/elearning`)

FR canonique uniquement (EN 301→FR via `src/proxy.ts` — ne rien ajouter côté EN).

| Route (fichier)                                                   | URL                                          | Rôle                                                                        | Rendu                      |
| ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- | -------------------------- |
| `app/[locale]/elearning/page.tsx`                                 | `/elearning`                                 | **Hub catalogue** : liste des cours publiés, filtres (thème, durée, niveau) | RSC, ISR 3600              |
| `app/[locale]/elearning/[slug]/page.tsx`                          | `/elearning/{slug}`                          | **Fiche cours** (cœur de ce doc)                                            | RSC, ISR 3600              |
| `app/[locale]/elearning/[slug]/inscription/page.tsx`              | `/elearning/{slug}/inscription`              | **Tunnel d'inscription** (demande / récap commande)                         | RSC + form (server action) |
| `app/[locale]/elearning/[slug]/inscription/confirmation/page.tsx` | `/elearning/{slug}/inscription/confirmation` | Accusé de réception (post-soumission)                                       | RSC, `noindex`             |
| `app/[locale]/elearning/theme/[theme]/page.tsx`                   | `/elearning/theme/{theme}`                   | Listing par thème (SEO longue traîne)                                       | RSC, ISR 3600              |

> **Cloisonnement (ADR-0007) :** tout sous `src/app/[locale]/elearning/**` (public) ; composants sous `src/components/elearning/**` ; data access sous `src/server/elearning/**`. **Aucune** route publique e-learning sous `(admin)`.

> Le **portail apprenant** (espace authentifié, player, progression) vit ailleurs : `src/app/[locale]/portail/**` (extension de l'existant `PortailAcces`) — cf. `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md`. Le catalogue public est **non authentifié** ; le bouton « Accéder » d'un apprenant déjà inscrit le renvoie vers `/portail/mon-espace`.

---

## 3. Fiche cours `/elearning/{slug}` — contenu & structure

### 3.1 Données affichées (mapping `ElearningCourse`)

Tout vient du modèle `ElearningCourse` (doc `03-DATA-MODEL/01`), enrichi par les agrégats modules/leçons :

| Bloc fiche                  | Champ(s) source                                               | Notes                                                                          |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Titre H1                    | `titre`                                                       | un seul `<h1>` par page                                                        |
| Sous-titre / accroche       | `sousTitre`                                                   | bénéfice apprenant                                                             |
| Image de couverture (LCP)   | `imageCouvertureKey` (R2)                                     | `next/image`, `priority`, dimensions fixes (CLS=0)                             |
| Objectifs pédagogiques      | `objectifs` (Json `string[]`)                                 | liste à puces ; **obligatoire** (FOAD §2 information activités)                |
| Programme / sommaire        | `modules[]` → `lessons[]` (titres + `dureeEstimeeMinutes`)    | accordéon **sans JS** (`<details>`/`<summary>`) pour rester budget JS          |
| Durée totale                | `dureeEstimeeMinutes`                                         | **information de durée moyenne** exigée par D.6313-3-1 §2                      |
| Prérequis                   | `prerequis` (Json `string[]`)                                 | « Aucun prérequis » si vide                                                    |
| Public visé                 | `publicVise`                                                  |                                                                                |
| Modalité                    | constante UI « 100 % à distance (FOAD), en autonomie »        | dérivé `estFoad`                                                               |
| Modalités d'évaluation      | depuis les leçons `type=quiz` + `seuilReussitePct`            | « Quiz de validation, seuil {seuilReussitePct} % » (FOAD §3 / Qualiopi Ind.11) |
| Accompagnement / assistance | bloc statique + délais formalisés                             | **Qualiopi Ind.19** (assistance technique ET pédagogique) — obligatoire FOAD   |
| Sanction / certificat       | « Certificat de réalisation (heures réalisées) »              | réutilise `DocumentGenere` (doc `06-certificats-badges.md`)                    |
| Accessibilité               | référent handicap + mention WCAG 2.2 AA                       | réutilise le bloc handicap Qualiopi existant                                   |
| Financement                 | bloc « OPCO / entreprise / virement »                         | **pas** « CPF » tant que pas de RNCP/RS (ADR-0003)                             |
| Tarif                       | `ElearningProduct.prixHt` ou fourchette catalogue             | format via `pricing.ts` ; HT (régime FR)                                       |
| FAQ                         | `ElearningCourse` (champ FAQ Json à prévoir) ou bloc statique | alimente `FAQPage` JSON-LD                                                     |
| CTA inscription             | → `/elearning/{slug}/inscription`                             | cf. §5                                                                         |

> **Champ FAQ.** Si non présent sur `ElearningCourse`, ajouter `faqJson Json? @map("faq_json")` (additif, nullable, ADR-0008) ou réutiliser un bloc FAQ générique. La FAQ alimente le `FAQPage` JSON-LD (AEO).

### 3.2 Composant page (neuf)

```
src/app/[locale]/elearning/[slug]/page.tsx        # RSC : params, metadata, JSON-LD, garde stub.invalid
src/components/elearning/CourseDetailPage.tsx     # composition visuelle (calquée sur FormationDetailPage.tsx)
src/components/elearning/CourseProgrammeAccordion.tsx  # <details>/<summary>, 0 JS
src/components/elearning/CourseFinancementBlock.tsx
src/components/elearning/CourseEnrollCta.tsx
```

> **Réutilisation visuelle :** calquer la composition sur `src/components/formations/FormationDetailPage.tsx` (hero → objectifs → programme → ContactBand → FAQ → CtaBlock) et les primitives `Container`, `Cta`, `Section`, `ContactBand`, `CtaBlock`, `JsonLd`. Charte Editorial Premium Light inchangée.

### 3.3 Accès données (server, neuf)

```ts
// src/server/elearning/catalog/public-catalog.ts
export async function getPublishedCourses(filters?: CourseFilters): Promise<CourseCardDTO[]>;
export async function getPublicCourseBySlug(slug: string): Promise<CourseDetailDTO | null>;
export async function getPublishedCourseSlugs(): Promise<string[]>; // pour generateStaticParams
```

Règles :

- Filtrer **`statut: publie`** uniquement (jamais `brouillon`/`archive` côté public).
- En **MVP multi-tenant** (ADR-0002), n'exposer publiquement que les cours **catalogue global** : `ownerClientId IS NULL`. Les cours réservés à un `Client` (`ownerClientId != null`) ne sont **jamais** listés ni indexés (ils s'affichent uniquement dans l'espace apprenant après octroi).
- **Contrat build stub.invalid :** au build GH Actions, ces fonctions retournent `[]`/`null` (Proxy Prisma). La page **doit** gérer ce cas (early-exit) — cf. §6.

---

## 4. SEO / AEO — structured data & metadata

### 4.1 Metadata (`generateMetadata`)

Réutiliser **`buildProductMetadata()`** (`src/lib/seo.ts`) comme la fiche formation existante :

```ts
return buildProductMetadata({
  locale,
  path: `/elearning/${course.slug}`,
  title: course.metaTitle ?? `${course.titre} — Formation en ligne (FOAD) | Axion-IA`,
  description: truncateMetaDescription(course.metaDescription ?? course.sousTitre ?? ""),
});
```

- Canonical = **toujours** `/elearning/{slug}` (FR). Pas d'`alternates` EN (EN désactivé).
- Pas de suffixe « finançable CPF » tant que pas de certification (gardé derrière `OF_PUBLIC_DISCLOSURE_ENABLED` pour la mention Qualiopi, comme la fiche formation l.68).

### 4.2 JSON-LD émis sur la fiche

Émettre un **`@graph`** (via `<JsonLdGraph>` ou plusieurs `<JsonLd>`), composé de :

1. **`Course` + `CourseInstance`** — via `buildCourseJsonLd()` **étendu** (cf. §4.3).
2. **`BreadcrumbList`** — `buildBreadcrumbJsonLd({ locale, items: [Accueil, E-learning, {titre}] })`.
3. **`FAQPage`** — `buildFaqJsonLd({ items })` si FAQ présente (AEO : citation directe par AI Overviews/Perplexity).
4. **`WebPage`** — `buildWebPageJsonLd()` (cohérence avec le reste du site).

Sur le **hub** `/elearning` : `buildCollectionPageJsonLd()` + `buildItemListJsonLd()` listant les cours (déjà disponibles dans `seo.ts`).

### 4.3 Extension de `buildCourseJsonLd()` (existant → à étendre)

`buildCourseJsonLd()` existe (`src/lib/seo.ts` l.1620) et émet déjà `Course` + `hasCourseInstance` (modes `Onsite|Hybrid|Online`) + `provider` (#organization) + `offers`. Pour l'e-learning FOAD, **ajouter (additif, non destructif)** au type `CourseJsonLdInput` et au builder :

- `courseMode: ["Online"]` (déjà supporté).
- `CourseInstance.courseMode = "Online"` → ajouter `courseWorkload` (durée ISO) **et** ne PAS émettre de `location` `Place` (asynchrone, pas de lieu). Le builder gère déjà `mode === "Onsite"` pour le `Place` ; le branche `Online` doit ajouter `courseInstance.courseMode: "online"` sans lieu — **déjà conforme** (le `location` n'est ajouté que pour `Onsite`).
- **Nouveaux champs à ajouter** :
  - `timeRequired?: string` (ISO 8601, ex. `PT6H`) → `Course.timeRequired` (durée totale d'apprentissage, distinct du `courseWorkload`).
  - `coursePrerequisites?: string[]` → `Course.coursePrerequisites`.
  - `teaches?: string[]` (objectifs) → `Course.teaches`.
  - `offers` : déjà présent ; pour le MVP virement, garder `Offer.price`/`priceCurrency: "EUR"`/`availability: InStock` et **ajouter** `Offer.category: "FOAD"`. Ne **jamais** émettre `Offer` avec un prix CPF.
  - `image?: string` (URL absolue couverture R2 signée publique, cf. note image §7).
  - `inLanguage` : déjà `fr-FR`.

Helper de conversion durée (neuf, à placer dans `src/server/elearning/catalog/` ou `src/lib/`) :

```ts
// minutes → ISO 8601 ("PT6H30M"). dureeEstimeeMinutes (ElearningCourse).
export function minutesToIso8601(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}` || "PT0M";
}
```

Exemple d'appel sur la fiche :

```ts
const courseJsonLd = buildCourseJsonLd({
  locale,
  path: `/elearning/${course.slug}`,
  name: course.titre,
  description: course.sousTitre ?? course.descriptionPlain, // ≥ 50 car. (rich results)
  courseMode: ["Online"],
  duration: minutesToIso8601(course.dureeEstimeeMinutes ?? 0), // courseWorkload (CourseInstance)
  timeRequired: minutesToIso8601(course.dureeEstimeeMinutes ?? 0),
  educationalLevel: "Professional",
  audienceType: course.publicVise ?? "Professionnels, salariés, indépendants",
  teaches: course.objectifs, // string[]
  coursePrerequisites: course.prerequis, // string[]
  priceEurHt: course.prixHt, // depuis ElearningProduct / pricing.ts
  about: "Formation IA en ligne (FOAD) — Axion-IA",
  image: course.imageCouvertureUrl, // URL absolue
});
```

> ⚠️ **Régression à éviter :** `buildCourseJsonLd` est **partagé** avec les fiches formation `/formations/**`. Toute extension doit être **purement additive** (champs optionnels) ; relancer `catalog-v2-seo.test.ts` et ajouter un test `elearning-course-jsonld.test.ts` dans `src/server/elearning/`.

### 4.4 AEO (Answer Engine Optimization)

- **FAQ** structurée + `FAQPage` JSON-LD = réponses directes citables.
- **Réponse par H2** : chaque section programme commence par une phrase-réponse autonome (pattern blog refonte 2026-06-22).
- **`Speakable`** : réutiliser `buildFaqSpeakableJsonLd()` sur la FAQ si pertinent.
- **Maillage interne** vers `/formations/{slug}` (cross-link §1.2) et les ressources/articles liés (`knowledge`/blog) pour la pertinence thématique.
- **`ai.txt` / robots** : autoriser l'indexation des pages catalogue (publiques) ; bloquer l'entraînement comme ailleurs (politique site existante). Les pages portail/player restent `noindex` (auth).

---

## 5. Tunnel d'inscription / achat (MVP virement)

### 5.1 Principe (ADR-0004 : CB éteinte)

Le MVP **ne facture pas en ligne**. Le tunnel produit un **lead/commande** que l'admin Axion-IA traite (encaissement virement / financement OPCO) puis **octroie l'accès en 1 clic** (doc `04-BACKEND/06-import-masse-provisioning.md` + `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md`). C'est le même esprit que `/appel` (lead manuel) déjà en place.

### 5.2 Parcours public (3 écrans)

```
/elearning/{slug}            (fiche)  ──CTA "S'inscrire / Demander un accès"──►
/elearning/{slug}/inscription         (formulaire : identité + contexte financement)
/elearning/{slug}/inscription/confirmation   (accusé, noindex)
```

**Écran `/inscription`** — formulaire (RSC + **server action**, pas de REST) :

- Champs : prénom, nom, email (`citext`), téléphone, **type d'inscrit** (`particulier` | `salarié` | `entreprise`), entreprise/SIRET (optionnel), **mode de financement souhaité** (`virement` | `OPCO` | `prise en charge employeur`), message.
- **Consentement RGPD** explicite (réutiliser le pattern consentements `Trainee`).
- **Anti-spam** : honeypot + rate-limit (réutiliser le middleware/limiteur existant des formulaires `/contact`).
- **Accessibilité WCAG 2.2 AA** (EAA depuis 28/06/2025) : labels explicites, focus visible, cible ≥ 24px (2.5.8), pas de drag obligatoire, messages d'erreur liés (`aria-describedby`).

### 5.3 Server action & modèle commande (neuf)

```ts
// src/server/elearning/orders/actions.ts
"use server";
export async function submitCourseEnrollmentRequest(
  input: EnrollmentRequestInput,
): Promise<ActionResult>;
```

Comportement MVP :

1. Validation Zod de l'input.
2. Création d'une commande **en attente** : `ElearningOrder` (doc `03-DATA-MODEL/05-schema-ecommerce-commandes.md`) avec `statut = "en_attente"`, `paymentMethod = "virement"`, `courseId`, snapshot prix (HT), coordonnées prospect.
3. **Lien CRM** : si entreprise/SIRET, rapprochement / création `Client` (réutilise le CRM existant) ; sinon création/MAJ d'un `Trainee` prospect (sans accès).
4. **Notification** : enqueue un email **Nodemailer** (BullMQ) à l'admin (« nouvelle demande d'inscription e-learning ») **et** un accusé au prospect (template React Email neuf `elearning-enrollment-request.tsx`). Worker : réutilise `email-worker` existant ; pas de nouveau worker requis pour le MVP.
5. Redirige vers `/inscription/confirmation`.

> **Octroi d'accès = côté admin, pas dans le tunnel.** Le tunnel ne crée **jamais** d'`ElearningEnrollment` actif. L'octroi (création `ElearningEnrollment` + envoi magic-link / création compte) est une action admin explicite après encaissement (doc `06-CONSOLE-ADMIN/05`). Cela respecte le MVP « virement + octroi manuel ».

### 5.4 Bascule CB (V1, sans refonte)

Quand `STRIPE_ENABLED=true` (ADR-0004) :

- L'écran `/inscription` propose un choix « Payer par carte » (Stripe Checkout) **OU** « Demander une prise en charge (virement/OPCO) ».
- Le paiement CB réussi déclenche l'**octroi automatique** (webhook Stripe existant → handler neuf `elearning` qui crée `ElearningEnrollment` + envoie l'accès).
- **Aucune** logique de page à réécrire : seul le composant CTA/checkout bascule sur le flag. Le bloc « Tarif » lit toujours `pricing.ts`.

> CPF/EDOF (`EDOF_ENABLED`) reste **hors tunnel** tant que pas de certification RNCP/RS (ADR-0003). Le jour venu : un 3ᵉ mode de financement « CPF » s'ajoute, gated par le flag.

### 5.5 Composants tunnel (neufs)

```
src/components/elearning/EnrollmentForm.tsx          # "use client" minimal (form), import dynamique
src/components/elearning/EnrollmentFinancementChoice.tsx
src/app/[locale]/elearning/[slug]/inscription/page.tsx
src/app/[locale]/elearning/[slug]/inscription/confirmation/page.tsx
```

> **Budget JS :** le formulaire est le **seul** îlot client du cluster catalogue. Le garder minimal (validation native + server action ; pas de lib de formulaire lourde). La page `/inscription` a un budget plus tolérant que les pages vitrine mais doit rester ≤ 110 KB gz (aligné sur l'exception `/appel`).

---

## 6. Contrat build `stub.invalid` & ISR (obligatoire)

Toutes les pages du cluster lisent la DB → appliquer le **contrat ADR 0026** comme la fiche formation existante :

```ts
export const revalidate = 3600; // ISR : 1 appel DB / heure max (budget LCP)
export const dynamicParams = true; // slugs non pré-rendus servis à la demande

export async function generateStaticParams() {
  // Au build GH Actions (stub.invalid) → getPublishedCourseSlugs() renvoie [] (Proxy Prisma).
  // En prod runtime → vrais slugs. dynamicParams=true couvre les ajouts post-build.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return [];
  return (await getPublishedCourseSlugs()).map((slug) => ({ slug }));
}

export default async function CoursePage({ params }) {
  const { locale, slug } = await params;
  // ... locale guard ...
  if (process.env.DATABASE_URL?.includes("stub.invalid")) notFound(); // build : pas de DB
  const course = await getPublicCourseBySlug(slug);
  if (!course) notFound();
  // ... rendu ...
}
```

- Conséquence : au build, les pages e-learning sont **vides/absentes** ; l'**ISR `revalidate=3600`** les peuple sous 1 h en prod (DATABASE_URL réel injecté par Coolify). Identique au comportement `knowledge-*` / `/ressources` documenté dans AGENTS.md.
- **Sitemap :** ajouter un sub-sitemap `elearning` en **Route Handler `force-dynamic`** (pattern `sitemap-knowledge.xml` documenté en mémoire) listant les cours `publie` & `ownerClientId IS NULL`, et l'ajouter à l'index **conditionnellement** (uniquement si `count > 0`) pour éviter un sitemap vide en GSC.

---

## 7. Budgets Web Vitals (pages publiques — stricts)

Cible (AGENTS.md, pages stratégiques) :

| Métrique      | Budget           | Comment on tient                                                                                                                                 |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| LCP           | ≤ 1 800 ms p75   | image couverture `next/image` `priority` + dimensions fixes ; fiche 100 % RSC, 0 fetch bloquant côté client                                      |
| INP           | ≤ 100 ms p75     | aucun JS sur hub/fiche (accordéon = `<details>`) ; seul `/inscription` a un form léger                                                           |
| CLS           | = 0              | dimensions explicites sur image + médias ; pas d'injection tardive ; polices déjà gérées (Fraunces swap maîtrisé)                                |
| TBT           | ≤ 150 ms         | pas de lib client sur le catalogue                                                                                                               |
| First Load JS | ≤ 75 KB gz/route | **interdit** d'importer le player vidéo, Tiptap, ou toute lib LMS sur les pages publiques ; `/inscription` ≤ 110 KB gz (exception type `/appel`) |

Garde-fous :

- **Le player vidéo, l'éditeur, le moteur de quiz ne sont JAMAIS importés** dans le bundle public catalogue (ils vivent derrière l'auth, `/portail/**`). Vérifier via `size-limit` (gate PR > +5 KB gz).
- Accordéon programme = **HTML natif** (`<details>`/`<summary>`), zéro JS — accessible clavier par défaut.
- Lighthouse CI (`pnpm lhci`) doit inclure `/elearning` et une fiche `/elearning/{slug}` représentative dans les URL gates.
- **Image couverture :** servir une variante optimisée (WebP/AVIF). Soit via le pipeline `next/image` sur une URL R2 publique (clé `imageCouvertureKey`), soit via la banque d'images existante. Pour le JSON-LD `image`, fournir une URL absolue stable (publique). Éviter une URL signée à courte TTL dans le JSON-LD (préférer une variante publique/CDN).

---

## 8. Conformité affichée sur la fiche (FOAD — non négociable)

La fiche **doit** rendre visibles (sinon non-conformité Qualiopi / FOAD — cf. `08-CONFORMITE/01-foad-d6313-3-1.md`) :

1. **Activités + durée moyenne** (D.6313-3-1 §2) → bloc programme + durée totale.
2. **Modalités d'évaluation** qui jalonnent/concluent (D.6313-3-1 §3 / Qualiopi **Ind.11 — majeur**) → bloc « Évaluation : quiz de validation, seuil X % », « Certificat de réalisation ».
3. **Assistance technique ET pédagogique** + délais formalisés (Qualiopi **Ind.19**) → bloc « Accompagnement » (tuteur, canal, délai de réponse).
4. **Accessibilité handicap** (référent + adaptations) → réutilise le bloc existant.
5. **Sanction de la formation** → certificat de réalisation (heures réalisées, modèle officiel depuis 01/06/2020).
6. **Financement** : OPCO / employeur / virement. **Pas** de mention « CPF / éligible CPF » tant que pas de certification RNCP/RS (claim illégal sinon — ADR-0003). La mention « Qualiopi / finançable » reste **gated** par `OF_PUBLIC_DISCLOSURE_ENABLED` (cohérent avec la fiche formation l.66-77).

---

## 9. Inventaire EXISTANT réutilisé vs NEUF

**Réutilisé :**

- `src/lib/seo.ts` : `buildCourseJsonLd` (à étendre), `buildProductMetadata`, `buildBreadcrumbJsonLd`, `buildFaqJsonLd`, `buildWebPageJsonLd`, `buildCollectionPageJsonLd`, `buildItemListJsonLd`, `truncateMetaDescription`, `SITE_URL`.
- `src/components/marketing/JsonLd.tsx` / `JsonLdGraph.tsx`.
- `src/components/formations/FormationDetailPage.tsx` (modèle de composition), `Container`, `Cta`, `Section`, `ContactBand`, `CtaBlock`.
- `src/content/pricing.ts` (`getFormationEntryPrice`, `formatFormationPrice`, `formatAmount`) — SSOT prix.
- `src/content/formations/catalog-v2-meta.ts` (`FORMATION_DUREE_ISO`) pour cross-link formations.
- `src/lib/r2-storage.ts` (`getSignedUrlR2`) pour la couverture si stockée sur R2.
- Lead/email : pattern `/contact` + `/appel`, `email-worker` (BullMQ) + React Email.
- CRM `Client`, `Trainee`, consentements RGPD.
- Flags `STRIPE_ENABLED`, `OF_PUBLIC_DISCLOSURE_ENABLED` (`src/env.ts`).
- Contrat build `stub.invalid` + ISR (pattern fiche formation `/formations/[slug]/page.tsx`).

**Neuf à construire :**

- Routes `src/app/[locale]/elearning/**` (hub, fiche, inscription, confirmation, theme).
- `src/server/elearning/catalog/public-catalog.ts` (`getPublishedCourses`, `getPublicCourseBySlug`, `getPublishedCourseSlugs`).
- `src/server/elearning/orders/actions.ts` (`submitCourseEnrollmentRequest`) + modèle `ElearningOrder` (doc 05).
- Composants `src/components/elearning/*` (CourseDetailPage, ProgrammeAccordion, FinancementBlock, EnrollCta, EnrollmentForm).
- Helper `minutesToIso8601()` + extension additive de `CourseJsonLdInput`/`buildCourseJsonLd`.
- Template email `elearning-enrollment-request.tsx`.
- Sub-sitemap `elearning` (Route Handler `force-dynamic`) + entrée index conditionnelle.
- Tests : `elearning-course-jsonld.test.ts`, `public-catalog.test.ts`, conformité fiche (présence blocs FOAD).

---

## 10. Checklist d'implémentation (ordre)

1. Modèle `ElearningOrder` (doc 05) + migration additive.
2. `public-catalog.ts` + tests (filtre `publie` + `ownerClientId IS NULL`).
3. Extension `buildCourseJsonLd` (additif) + `minutesToIso8601` + test régression formations.
4. `CourseDetailPage` + fiche `/elearning/[slug]` (ISR, stub guard, JSON-LD graph, blocs FOAD).
5. Hub `/elearning` (CollectionPage + ItemList) + listing thème.
6. Tunnel `/inscription` (server action + `ElearningOrder` + emails) + confirmation `noindex`.
7. Sub-sitemap `elearning` + cross-link bidirectionnel avec `catalog-v2.ts`.
8. `pnpm lhci` (ajouter URLs) + `size-limit` (vérifier 0 JS LMS dans le bundle public).

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` (champs affichés sur la fiche).
- `03-DATA-MODEL/05-schema-ecommerce-commandes.md` — `ElearningOrder`, octroi, bascule Stripe.
- `04-BACKEND/06-import-masse-provisioning.md` — octroi d'accès post-commande.
- `05-FRONTEND-APPRENANT/01-espace-apprenant-dashboard.md` — destination « Accéder » (portail authentifié).
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — player (hors bundle public).
- `05-FRONTEND-APPRENANT/05-mobile-accessibilite-wcag.md` — WCAG 2.2 AA du tunnel.
- `06-CONSOLE-ADMIN/05-gestion-acces-entreprises.md` — traitement admin de la commande.
- `08-CONFORMITE/01-foad-d6313-3-1.md` & `02-qualiopi-indicateurs-foad.md` — blocs obligatoires de la fiche.
- `09-QUALITE/03-web-vitals-performance.md` — budgets & gates.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0003 (CPF), ADR-0004 (Stripe), ADR-0007 (cloisonnement), ADR-0008 (migrations).
