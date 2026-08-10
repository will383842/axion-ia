# Frontend apprenant — Espace apprenant & dashboard

> Spécification **implémentable** de l'espace apprenant e-learning, construit comme une **extension de l'espace stagiaire existant** (`/[locale]/portail/mon-espace`).
>
> Objectif : un apprenant connecté (cookie `portail_session`) arrive sur un **tableau de bord** qui lui montre **où reprendre en 1 clic**, ses **cours en cours / terminés / recommandés**, sa **progression globale**, ses **certificats**, et son **profil / consentements** — le tout **FR**, **sobre** (charte publique, PAS de tokens admin), **force-dynamic**, **noindex**, et **dans les budgets Web Vitals**.
>
> Références ADR : **ADR-LMS-0001** (auth apprenant hybride = cookie `portail_session` + `Trainee`), **ADR-LMS-0005** (vidéo Cloudflare Stream), **ADR-LMS-0007** (cloisonnement `src/server/elearning/**`), **ADR-LMS-0008** (migrations additives). Données : doc `03-DATA-MODEL/02` (progression) + `03-DATA-MODEL/04` (comptes/accès).

---

## 0. TL;DR pour un dev senior

- **On NE crée PAS un nouveau portail.** On **étend** la page serveur existante `src/app/[locale]/portail/mon-espace/page.tsx` (Server Component, `force-dynamic`, `robots noindex`) en y ajoutant un **bloc e-learning** au-dessus des blocs Qualiopi actuels (formations présentiel/live, documents, questionnaires, handicap, RGPD).
- **On NE modifie PAS `getEspaceStagiaire`** (`src/server/qualiopi/portail/portail-service.ts`) — il reste la SSOT Qualiopi. On **réutilise** son résultat et on **compose** un nouvel agrégateur cloisonné `getDashboardApprenant()` sous `src/server/elearning/portail/dashboard-service.ts` (ADR-0007).
- **L'authentification est déjà faite** : `getPortailToken()` → `verifierToken()` (timing-safe, stub-aware) → `traineeId`. Le futur `getLearnerSession()` (doc 04) en sera un simple wrapper ; en attendant on réutilise les helpers `portail-service.ts` + `cookie.ts` **tels quels**.
- **Le dashboard est 100 % Server Components** (lecture des agrégats `CourseProgress`/`ModuleProgress` matérialisés). Le seul JS client = micro-interactions (déconnexion, formulaire préférences, formulaire handicap) déjà sur le pattern `useTransition` existant (`QuitterPortailButton.tsx`). **Budget : First Load JS ≤ 75 KB gz** (page derrière auth, pas une des 15 pages stratégiques mais on garde la même discipline).
- **« Reprendre où j'en étais »** = lecture de `LessonProgress.dernierePositionSec` + `ElearningEnrollment.dernierAccesAt` → deep-link vers le player (doc 02) avec `?t=<sec>`. **Zéro recalcul** au rendu : les agrégats sont déjà matérialisés (doc 02 §8).
- **Certificats** = `ElearningEnrollment.certificatDocumentId` → `DocumentGenere` → **même pattern d'URL signée fraîche R2** que les attestations Qualiopi (déjà dans `getEspaceStagiaire`, lignes 266-290).
- **Migration** : ce doc n'ajoute **aucune** table. Il consomme `Trainee.preferencesJson` (ajouté en additif par le doc 04) via **une** server action neuve `updatePreferencesApprenantAction`.

---

## 1. Carte EXISTANT (réutilisé) vs NEUF (à construire)

### 1.1 Réutilisé tel quel (vérifié dans le code réel)

| Brique                                                                                                                      | Emplacement                                          | Rôle dans le dashboard                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Page espace stagiaire                                                                                                       | `src/app/[locale]/portail/mon-espace/page.tsx`       | **Page cible étendue** (on insère le bloc e-learning, on garde les blocs Qualiopi).                           |
| `getEspaceStagiaire()`                                                                                                      | `src/server/qualiopi/portail/portail-service.ts:205` | Données Qualiopi (formations présentiel, attestations, questionnaires, handicap). **Réutilisé, non modifié.** |
| `verifierToken()` / `getPortailToken()`                                                                                     | `portail-service.ts:142` / `cookie.ts`               | Auth apprenant (cookie `portail_session`, timing-safe, stub-aware).                                           |
| `getSignedUrlR2()` / `isR2Configured()`                                                                                     | `src/lib/r2-storage.ts:133` / `:34`                  | URL signée fraîche (24 h) pour les PDF certificats — **même pattern** que les attestations.                   |
| `quitterPortailAction`                                                                                                      | `src/server/actions/qualiopi/portail.ts:117`         | Bouton « Se déconnecter » (déjà câblé dans `QuitterPortailButton`).                                           |
| `declarerHandicapAction`, `soumettreSatisfactionPortailAction`, `demanderExportRgpdAction`, `demanderSuppressionRgpdAction` | `src/server/actions/qualiopi/portail.ts`             | Blocs handicap / questionnaires / RGPD **conservés** dans l'onglet Profil.                                    |
| `QuitterPortailButton`, `HandicapDeclarationForm`, `RgpdActions`, `SatisfactionPortailForm`                                 | `src/components/portail/*`                           | Composants client réutilisés (pattern `useTransition`).                                                       |
| `Section` (sous-composant local)                                                                                            | `mon-espace/page.tsx:222`                            | Pattern de section sobre réutilisé pour les nouveaux blocs.                                                   |

### 1.2 Données lues (modèles doc 02 / doc 04 — déjà spécifiés, pas redéfinis ici)

| Modèle / champ                                                                                                                                                 | Doc source           | Usage dashboard                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `ElearningEnrollment` (`statut`, `accordeAt`, `premiereConnexionAt`, `dernierAccesAt`, `expiresAt`, `certificatDocumentId`, `certificatEmisAt`)                | doc 02 §3            | Lister les accès, distinguer en cours / terminé, certificat émis.    |
| `CourseProgress` (`statut`, `percentComplet`, `modulesTermines/Total`, `lecconsTerminees/Total`, `tempsTotalSec`, `scoreGlobalPct`, `reussite`, `completedAt`) | doc 02 §6            | **Progression par cours** + **barre globale** + badge réussite.      |
| `ModuleProgress` (`estDeverrouille`, `verrouRaison`, `percentComplet`)                                                                                         | doc 02 §5            | (Aperçu) prochain module verrouillé + sa raison.                     |
| `LessonProgress` (`dernierePositionSec`, `statut`, `updatedAt`, `lessonId`, `moduleId`)                                                                        | doc 02 §4            | **Reprise rapide** : leçon en cours + position.                      |
| `ElearningCourse` (`slug`, `titre`, `sousTitre`, `imageCouvertureKey`, `dureeEstimeeMinutes`, `statut`, `vendableSeul`, `seuilReussitePct`)                    | doc 01               | Carte cours (titre, visuel, durée), recommandations.                 |
| `Trainee.preferencesJson`                                                                                                                                      | doc 04 §3            | Préférences apprenant (vitesse lecture, sous-titres, reduce-motion). |
| `DocumentGenere` (`type`, `numero`, `pdfUrl`, `qrToken`, `createdAt`)                                                                                          | `schema.prisma:5507` | PDF certificat + lien de vérification QR.                            |

### 1.3 NEUF à construire (cloisonné ADR-0007)

| Élément                                      | Type                                   | Emplacement cible                                                |
| -------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| `getDashboardApprenant(traineeId)`           | service agrégateur                     | `src/server/elearning/portail/dashboard-service.ts`              |
| `getCoursRecommandes(traineeId)`             | service (heuristique MVP)              | `src/server/elearning/portail/recommandation-service.ts`         |
| `updatePreferencesApprenantAction`           | server action                          | `src/server/elearning/portail/preferences.actions.ts`            |
| `DashboardApprenant` (orchestrateur serveur) | composant serveur                      | `src/components/elearning/portail/DashboardApprenant.tsx`        |
| `ReprendreCard`                              | composant serveur                      | `src/components/elearning/portail/ReprendreCard.tsx`             |
| `BarreProgressionGlobale`                    | composant serveur                      | `src/components/elearning/portail/BarreProgressionGlobale.tsx`   |
| `CarteCours`                                 | composant serveur                      | `src/components/elearning/portail/CarteCours.tsx`                |
| `ListeCertificatsElearning`                  | composant serveur                      | `src/components/elearning/portail/ListeCertificatsElearning.tsx` |
| `OngletsEspace` (navigation locale)          | composant serveur                      | `src/components/elearning/portail/OngletsEspace.tsx`             |
| `PreferencesApprenantForm`                   | composant **client** (`useTransition`) | `src/components/elearning/portail/PreferencesApprenantForm.tsx`  |
| Pages onglets (cours / certificats / profil) | Server Components                      | `src/app/[locale]/portail/mon-espace/**` (cf. §3)                |

> Tous les composants serveur n'ajoutent **aucun** JS au bundle client. Seul `PreferencesApprenantForm` est `"use client"` (≈ même poids que `QuitterPortailButton`).

---

## 2. Modèle de données de la vue (ce que l'agrégateur retourne)

`src/server/elearning/portail/dashboard-service.ts` — type retourné par `getDashboardApprenant()`. **Stub-aware obligatoire** (réplique du garde `if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return EMPTY;` comme `portail-service.ts`).

```ts
export interface CarteCoursVue {
  enrollmentId: string;
  courseId: string;
  slug: string; // ElearningCourse.slug → URL player
  titre: string;
  sousTitre: string | null;
  imageCouvertureUrl: string | null; // URL signée R2 (ou null si pas de visuel)
  dureeEstimeeMinutes: number | null;
  // Progression (CourseProgress matérialisé — aucun recalcul)
  percentComplet: number; // 0–100
  statutProgression: "non_commence" | "en_cours" | "termine" | "echoue";
  statutAcces: "actif" | "suspendu" | "expire" | "revoque" | "termine";
  // Reprise (null si jamais commencé)
  reprise: {
    moduleId: string;
    lessonId: string;
    lessonTitre: string;
    positionSec: number; // LessonProgress.dernierePositionSec
    href: string; // deep-link player + ?t=positionSec
  } | null;
  // Conformité / certificat
  reussite: boolean;
  certificatPret: boolean; // certificatDocumentId != null
  expireLe: Date | null; // ElearningEnrollment.expiresAt
  dernierAccesAt: Date | null;
}

export interface CertificatElearningVue {
  enrollmentId: string;
  courseTitre: string;
  type: string; // DocumentType (certificat_realisation, attestation…)
  numero: string;
  emisAt: Date | null;
  pdfUrl: string | null; // URL signée fraîche 24 h (pattern attestation)
  qrToken: string | null; // → /verifier-attestation/[qrToken]
}

export interface PreferencesApprenantVue {
  vitesseLecture: number; // 1 | 1.25 | 1.5 | 1.75 | 2 (défaut 1)
  sousTitresActifs: boolean; // défaut true (WCAG)
  reduceMotion: boolean; // respecte prefers-reduced-motion par défaut
  langueSousTitres: string; // "fr"
}

export interface DashboardApprenantVue {
  prenom: string;
  // Buckets prêts à afficher (tri appliqué côté service)
  coursEnCours: CarteCoursVue[]; // statutProgression en_cours, tri dernierAccesAt desc
  coursTermines: CarteCoursVue[]; // statutProgression termine, tri completedAt desc
  coursNonCommences: CarteCoursVue[]; // accès actif jamais ouvert (mis en avant "Commencer")
  coursRecommandes: CarteCoursVue[]; // catalogue publie non encore octroyé (heuristique MVP)
  // Reprise rapide globale = la carte la plus récemment consultée avec reprise != null
  repriseRapide: CarteCoursVue | null;
  // Agrégat global tous cours (pour la grande barre de progression du header)
  global: {
    nbCours: number;
    nbTermines: number;
    percentGlobal: number; // moyenne pondérée par nb leçons (cf. §4.2)
    tempsTotalSec: number; // Σ CourseProgress.tempsTotalSec
    nbCertificats: number;
  };
  certificats: CertificatElearningVue[];
  preferences: PreferencesApprenantVue;
}
```

### 2.1 Requêtes Prisma (chemin chaud — budget INP)

Une seule passe Prisma, agrégats **déjà matérialisés** (doc 02 § 11) — pas de fan-out sur `LessonProgress` au rendu :

```ts
// 1) Tous les accès e-learning de l'apprenant + agrégats + cours
const enrollments = await prisma.elearningEnrollment.findMany({
  where: { traineeId, statut: { in: ["actif", "termine", "suspendu", "expire"] } },
  select: {
    id: true,
    courseId: true,
    statut: true,
    accordeAt: true,
    dernierAccesAt: true,
    expiresAt: true,
    certificatDocumentId: true,
    certificatEmisAt: true,
    course: {
      select: {
        slug: true,
        titre: true,
        sousTitre: true,
        statut: true,
        imageCouvertureKey: true,
        dureeEstimeeMinutes: true,
        seuilReussitePct: true,
      },
    },
    courseProgress: {
      select: {
        statut: true,
        percentComplet: true,
        lecconsTerminees: true,
        lecconsTotal: true,
        tempsTotalSec: true,
        scoreGlobalPct: true,
        reussite: true,
        completedAt: true,
      },
    },
    certificatDocument: {
      select: { type: true, numero: true, qrToken: true, pdfUrl: true, createdAt: true },
    },
  },
  orderBy: { dernierAccesAt: "desc" },
});

// 2) Reprise rapide : 1 seul LessonProgress (le plus récent "en_cours") par enrollment "en cours"
//    Lu via @@index([enrollmentId, statut]) (doc 02 §11) — point reads, pas d'agrégat.
const reprises = await prisma.lessonProgress.findMany({
  where: { enrollmentId: { in: enCoursIds }, statut: "en_cours" },
  orderBy: { updatedAt: "desc" },
  distinct: ["enrollmentId"],
  select: {
    enrollmentId: true,
    lessonId: true,
    moduleId: true,
    dernierePositionSec: true,
    lesson: { select: { titre: true, module: { select: { course: { select: { slug: true } } } } } },
  },
});
```

> **Note typage FK** (doc 02 §0) : `traineeId` est `@db.Uuid`. Les PK LMS (`enrollmentId`, `courseId`, `lessonId`, `moduleId`) sont `text`.

### 2.2 URL signées des médias (réutilisation R2)

- **Visuel de couverture** (`imageCouvertureKey`) : `getSignedUrlR2(key, 86400)` si `isR2Configured()`, sinon `null` (la carte affiche un dégradé de repli). Ces URLs sont régénérées au rendu (page `force-dynamic`) → jamais d'URL expirée.
- **PDF certificat** : **copie exacte** du pattern `getEspaceStagiaire` (`portail-service.ts:266-290`) — reconstruire la clé `documents/${year}/${type}/${numero}.pdf`, `getSignedUrlR2(key, 86400)`, fail-soft vers `pdfUrl` DB en cas d'erreur.
- **Vidéo** : **jamais** d'URL ici. Le player (doc 02) signe la lecture HLS Cloudflare Stream à la demande (ADR-0005). Le dashboard ne fait que **deep-linker** vers le player.

---

## 3. Routes & structure de pages

Le dashboard reste sous le namespace **`portail`** existant (cohabitation avec l'espace stagiaire Qualiopi). On garde **une seule porte d'entrée** `mon-espace` et on découpe en **onglets = sous-routes** (Server Components, `force-dynamic`, `noindex`). Cela maintient un First Load JS minimal par onglet (pas de gros client router).

| Route                                             | Type           | Contenu                                                                                                                                                                                               | État         |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `/[locale]/portail/mon-espace`                    | page (étendue) | **Accueil dashboard** : header + barre globale + carte « Reprendre » + cours en cours/à commencer/recommandés + rappel certificats + blocs Qualiopi (formations présentiel, questionnaires à remplir) | MVP          |
| `/[locale]/portail/mon-espace/cours`              | page           | Liste complète des cours e-learning (en cours / terminés / à commencer), filtrable                                                                                                                    | MVP          |
| `/[locale]/portail/mon-espace/certificats`        | page           | Tous les certificats/attestations (e-learning **+** Qualiopi présentiel fusionnés)                                                                                                                    | MVP          |
| `/[locale]/portail/mon-espace/profil`             | page           | Identité (lecture), **préférences apprenant** (form), déclaration handicap, **consentements**, droits RGPD                                                                                            | MVP          |
| `/[locale]/portail/cours/[slug]`                  | page           | Détail cours = sommaire modules/leçons + verrous (doc 02 — _lecteur_)                                                                                                                                 | MVP (doc 02) |
| `/[locale]/portail/cours/[slug]/lecon/[lessonId]` | page           | **Player** (vidéo/texte/quiz/devoir) (doc 02)                                                                                                                                                         | MVP (doc 02) |
| `/[locale]/portail/connexion`                     | page           | Login (magic-link / mot de passe) (doc 04)                                                                                                                                                            | MVP (doc 04) |

**Contrat de toutes ces pages** (repris de la page existante) :

```ts
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mon espace", robots: { index: false, follow: false } };
```

- **`force-dynamic` + auth** ⇒ aucun rendu DB au SSG ⇒ **compatible build `stub.invalid`** (services stub-aware retournent vide).
- **`noindex`** sur tout l'espace privé (déjà le cas).
- **FR uniquement**, apostrophes JSX échappées (`&apos;` / `&rsquo;`), **aucune mention** Qualiopi/CPF/financement côté apprenant (règle existante de la page).
- **Sobre** : Tailwind public standard, **PAS** de tokens admin `var(--color-admin-*)` (règle existante).

### 3.1 Squelette de la page d'accueil (extension de `mon-espace/page.tsx`)

```tsx
export default async function PortailMonEspacePage({ params }: PageProps) {
  const { locale } = await params;

  const cookieToken = await getPortailToken();
  if (!cookieToken) return <AccesRefuse locale={locale} raison="absente" />;
  const tokenResult = await verifierToken(cookieToken);
  if (!tokenResult) return <AccesRefuse locale={locale} raison="expiree" />;

  // Compose les deux mondes en parallèle (Qualiopi existant + e-learning neuf)
  let espace, dashboard;
  try {
    [espace, dashboard] = await Promise.all([
      getEspaceStagiaire(tokenResult.traineeId), // EXISTANT (non modifié)
      getDashboardApprenant(tokenResult.traineeId), // NEUF (cloisonné)
    ]);
  } catch {
    return <AccesRefuse locale={locale} raison="introuvable" />;
  }

  const aDuElearning = dashboard.global.nbCours > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EnTete prenom={dashboard.prenom} locale={locale} />
        <OngletsEspace actif="accueil" locale={locale} />

        {/* ── Bloc e-learning NEUF (au-dessus du Qualiopi) ── */}
        {aDuElearning && <DashboardApprenant data={dashboard} locale={locale} />}

        {/* ── Blocs Qualiopi EXISTANTS conservés ── */}
        <Section titre="Mes formations en présentiel / à distance">…</Section>
        {questionnairesNonRepondus.length > 0 && <Section titre="Évaluations à remplir">…</Section>}
        {/* Documents/handicap/RGPD déplacés vers l'onglet Profil (cf. §3) */}
      </div>
    </div>
  );
}
```

> **Rétro-compatibilité** : si `aDuElearning === false`, la page rend **exactement** l'espace stagiaire actuel (zéro régression pour les stagiaires présentiel sans e-learning).

---

## 4. Sections du dashboard (spec UI détaillée)

### 4.1 En-tête + déconnexion (EXISTANT, conservé)

- `Bonjour, {prenom}` + sous-titre « Votre espace personnel ».
- `QuitterPortailButton` (client, `useTransition`) — **inchangé**.
- Cible tactile bouton ≥ **24×24 px** (WCAG 2.2 — 2.5.8) : `px-3 py-1.5` actuel conforme.

### 4.2 Barre de progression globale (`BarreProgressionGlobale` — NEUF, serveur)

- Affichée seulement si `global.nbCours > 0`.
- **Calcul (côté service, pas au rendu)** : `percentGlobal = round( Σ(CourseProgress.lecconsTerminees) / Σ(CourseProgress.lecconsTotal) × 100 )` — pondération par nombre de leçons (un cours de 40 leçons pèse plus qu'un de 4). Repli `0` si dénominateur nul.
- Affiche aussi : `nbTermines / nbCours` cours terminés, `nbCertificats` certificats, temps total formaté (`Σ tempsTotalSec` → « 3 h 20 »).
- **Rendu = CSS pur** (div largeur `style={{ width: pct + "%" }}`), **aucune lib**, **aucune animation JS** (anti-CLS : hauteur fixe réservée).
- **A11y (WCAG 1.1.1 / 4.1.2)** :

```tsx
<div
  role="progressbar"
  aria-valuenow={pct}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Progression globale : ${pct}%`}
  className="h-2 w-full rounded-full bg-gray-200"
>
  <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
</div>
```

### 4.3 Carte « Reprendre où j'en étais » (`ReprendreCard` — NEUF, serveur)

- Source : `dashboard.repriseRapide` (le cours le plus récemment consulté avec `reprise != null`).
- Affiche : visuel cours, titre cours, **titre de la leçon en cours**, mini-barre de progression du cours, CTA primaire **« Reprendre »**.
- CTA = lien serveur (`<a>`) vers `reprise.href` = `/{locale}/portail/cours/{slug}/lecon/{lessonId}?t={positionSec}` → le player (doc 02) lit `t` et seek à `dernierePositionSec`.
- **Pas de JS** : c'est un lien. Reprise instantanée, mesurable (statement `resumed`, doc 02 §2) côté player.
- Si `repriseRapide === null` mais qu'il existe des cours non commencés → afficher à la place une carte **« Commencer votre formation »** pointant vers le 1er `coursNonCommences`.
- État vide global (aucun cours) : la carte n'est pas rendue (cf. §6).

### 4.4 Listes de cours (`CarteCours` — NEUF, serveur)

Trois groupes sur l'accueil (chacun masqué si vide), liste complète sur `/cours` :

1. **En cours** (`coursEnCours`, tri `dernierAccesAt` desc) — carte avec barre + CTA « Continuer ».
2. **À commencer** (`coursNonCommences`) — CTA « Commencer ».
3. **Recommandés** (`coursRecommandes`) — CTA « Découvrir » (vers `/portail/cours/[slug]` ou page catalogue publique selon `vendableSeul`).
4. **Terminés** (`coursTermines`) — badge « Terminé » + lien certificat si `certificatPret`.

**Anatomie `CarteCours`** :

```tsx
<a
  href={hrefCours}
  className="group flex gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
>
  <CouvertureCours url={imageCouvertureUrl} titre={titre} />{" "}
  {/* next/image OU dégradé repli, dims fixes anti-CLS */}
  <div className="min-w-0 flex-1">
    <h3 className="truncate font-medium text-gray-900">{titre}</h3>
    {sousTitre && <p className="truncate text-sm text-gray-500">{sousTitre}</p>}
    <BarreProgressionCours pct={percentComplet} /> {/* role=progressbar */}
    <p className="mt-1 text-xs text-gray-500">
      {libelleCTA} · {dureeLisible}
    </p>
    {certificatPret && <BadgeCertificat />}
    {statutAcces === "expire" && <span className="text-xs text-amber-700">Accès expiré</span>}
  </div>
</a>
```

- **Image** : `next/image` avec `width`/`height` explicites + `sizes` (anti-CLS, LCP maîtrisé) ; `imageCouvertureUrl` (R2 signée) ou dégradé CSS de repli. **Pas d'autoplay**, pas de carrousel (anti-pattern listé).
- **Cible** : toute la carte est cliquable (≥ 24 px garanti) ; le CTA texte est dans le lien.

### 4.5 Certificats (`ListeCertificatsElearning` — NEUF, serveur)

- Sur l'accueil : rappel compact (« Vous avez N certificats » → lien onglet).
- Onglet `/certificats` : **fusionne** les certificats e-learning (`dashboard.certificats`) **et** les attestations Qualiopi présentiel (`espace.attestations` de `getEspaceStagiaire`) dans une seule liste, triée par date desc.
- Par item : libellé type (`DOC_TYPE_LABELS` existant), `N° numero`, **« Télécharger »** (`pdfUrl` signée), **« Vérifier »** (`/{locale}/verifier-attestation/{qrToken}`) — **exactement** le rendu du bloc « Mes documents » existant (`mon-espace/page.tsx:138-177`), réutilisé.
- Si aucun certificat : message d'encouragement (« Terminez un cours pour obtenir votre certificat de réalisation »).

### 4.6 Profil & consentements (onglet `/profil` — NEUF + EXISTANT recyclé)

| Bloc                               | Source                                              | Composant                                 |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| Identité (lecture seule)           | `getEspaceStagiaire().trainee` (prénom/nom)         | rendu serveur                             |
| **Préférences apprenant**          | `dashboard.preferences` (`Trainee.preferencesJson`) | `PreferencesApprenantForm` (NEUF, client) |
| Déclaration handicap               | EXISTANT                                            | `HandicapDeclarationForm` (réutilisé)     |
| **Consentements**                  | `Trainee.consentement*` (existants)                 | rendu serveur + (V1) toggle révocation    |
| Droits RGPD (export / suppression) | EXISTANT                                            | `RgpdActions` (réutilisé)                 |

**`PreferencesApprenantForm`** (client, pattern `QuitterPortailButton`) : vitesse de lecture par défaut (1 / 1.25 / 1.5 / 1.75 / 2), sous-titres ON/OFF (défaut ON — WCAG), reduce-motion (défaut = `prefers-reduced-motion`). Appelle `updatePreferencesApprenantAction(prefs)`. Ces préférences sont **lues par le player** (doc 02) pour pré-régler vitesse/sous-titres.

**Consentements** : affichage des consentements collectés à l'inscription (`Trainee.consentement*` existants — CGU, données pédagogiques). Révocation = (V1) action dédiée ; MVP = affichage + renvoi vers `RgpdActions` pour l'effacement.

### 4.7 Navigation locale (`OngletsEspace` — NEUF, serveur)

- 4 onglets : **Accueil · Mes cours · Certificats · Profil**.
- Liens `<a>` (pas de client router) → chaque onglet est un Server Component dédié (§3). Onglet actif via prop `actif`.
- A11y : `<nav aria-label="Espace apprenant">`, `aria-current="page"` sur l'onglet actif, focus visible.
- Affiché seulement si `nbCours > 0` **ou** s'il y a des formations Qualiopi (sinon page mono-bloc comme aujourd'hui).

---

## 5. Server actions & services (signatures)

### 5.1 `src/server/elearning/portail/dashboard-service.ts` (NEUF)

```ts
export async function getDashboardApprenant(traineeId: string): Promise<DashboardApprenantVue>;
// - garde stub.invalid → retourne un DashboardApprenantVue vide (nbCours:0, listes:[], preferences défaut)
// - 1 findMany enrollments + 1 findMany reprises (distinct) + recommandations (service dédié)
// - signe les URLs R2 (couverture + certificats) en parallèle (Promise.all), fail-soft
// - NE throw PAS si une URL échoue ; throw seulement si traineeId introuvable côté reprise critique
```

### 5.2 `src/server/elearning/portail/recommandation-service.ts` (NEUF)

```ts
export async function getCoursRecommandes(
  traineeId: string,
  dejaOctroyes: string[],
): Promise<CarteCoursVue[]>;
// MVP heuristique simple (PAS d'IA) :
//   ElearningCourse where statut=publie AND vendableSeul=true AND id NOT IN dejaOctroyes
//   tri publishedAt desc, limit 4. (V2 : reco IA / parcours adaptatif.)
```

### 5.3 `src/server/elearning/portail/preferences.actions.ts` (NEUF)

```ts
"use server";
export async function updatePreferencesApprenantAction(input: {
  vitesseLecture?: number;
  sousTitresActifs?: boolean;
  reduceMotion?: boolean;
}): Promise<{ data: { ok: true } } | { error: string }>;
// 1. auth = resolveTraineeIdFromCookie (réutilise le helper de qualiopi/portail.ts ou getLearnerSession doc 04)
// 2. Zod : vitesse ∈ {1,1.25,1.5,1.75,2}, booléens
// 3. merge dans Trainee.preferencesJson (jamais d'écrasement des autres clés)
// 4. revalidatePath(`/[locale]/portail/mon-espace/profil`)
```

> **Réutilisation auth** : le helper `resolveTraineeIdFromCookie()` existe déjà dans `src/server/actions/qualiopi/portail.ts:79`. On l'extrait (ou on appelle `getLearnerSession()` du doc 04 quand il existe) — **pas de nouvelle logique de session**.

### 5.4 Pas de nouveau worker pour le dashboard

Le dashboard **lit** des agrégats produits par les workers déjà définis au doc 02 §9 (`elearning-progress-rollup-worker`, `elearning-access-lifecycle-worker`, `elearning-certificat-worker`). **Aucun worker neuf** ici. Les valeurs affichées (progression, certificat prêt, accès expiré) sont des **conséquences** de ces workers + des recalculs transactionnels `progress-service.ts`.

---

## 6. États (loading / vide / verrouillé / erreur)

| État                                   | Déclencheur                                        | Rendu                                                                                                                               |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Non authentifié**                    | cookie absent                                      | `<AccesRefuse raison="absente">` (EXISTANT)                                                                                         |
| **Session expirée/révoquée**           | `verifierToken` → null                             | `<AccesRefuse raison="expiree">` (EXISTANT)                                                                                         |
| **Profil introuvable**                 | `getEspaceStagiaire`/`getDashboardApprenant` throw | `<AccesRefuse raison="introuvable">` (EXISTANT)                                                                                     |
| **Chargement**                         | rendu serveur                                      | `loading.tsx` par route avec **skeletons** (dimensions fixes = anti-CLS) sous `src/app/[locale]/portail/mon-espace/loading.tsx`     |
| **Aucun e-learning**                   | `nbCours === 0`                                    | Bloc e-learning masqué → page = espace stagiaire actuel (zéro régression)                                                           |
| **Aucun cours mais accès B2C attendu** | accès `actif` jamais ouvert                        | Carte « Commencer votre formation » (§4.3)                                                                                          |
| **Cours suspendu / expiré**            | `statutAcces ∈ {suspendu, expire}`                 | Carte grisée + libellé raison (ex. « Accès expiré le 12/07/2026 »), CTA désactivé, **PAS** de deep-link player                      |
| **Module verrouillé (aperçu)**         | `ModuleProgress.estDeverrouille=false`             | Sur la carte : « Prochain module : {verrouRaison} » (verrou **avec sa raison** — best practice) ; détail dans le player (doc 02/04) |
| **Erreur média (URL R2)**              | `getSignedUrlR2` throw                             | fail-soft : visuel = dégradé de repli ; certificat = `pdfUrl` DB ou bouton désactivé « PDF indisponible »                           |

- **`error.tsx`** par segment (`src/app/[locale]/portail/mon-espace/error.tsx`) pour capter une exception inattendue sans casser tout le portail (message sobre + lien retour accueil).
- **Streaming** : envelopper le bloc e-learning lourd dans `<Suspense fallback={<DashboardSkeleton/>}>` pour ne pas bloquer le header/Qualiopi (TTFB stable, LCP du header rapide).

---

## 7. Performance (Web Vitals) & accessibilité (WCAG 2.2 AA)

### 7.1 Web Vitals (budgets internes : LCP ≤ 1800, INP ≤ 100, CLS = 0)

- **Server Components partout** sauf 3 micro-formulaires client (déconnexion, préférences, handicap) → **First Load JS ≤ 75 KB gz**.
- **CLS = 0** : toutes les images (`next/image` `width`/`height`), barres de progression et skeletons ont des **dimensions réservées**. Aucune injection tardive.
- **LCP** : le LCP probable est le visuel de la carte « Reprendre » ou le titre du header → `next/image` `priority` sur la **seule** image above-the-fold (couverture reprise), `loading="lazy"` sur les autres cartes.
- **INP** : pas de gros handler ; navigation par `<a>` (pas de client router) ; le seul travail JS = `useTransition` des formulaires (négligeable).
- **`force-dynamic`** : pas de SSG → pas concerné par le build `stub.invalid` (services stub-aware renvoient vide si jamais appelés au build).
- **Pas de polling** dashboard ; la fraîcheur vient du re-render `force-dynamic` à chaque visite (les agrégats sont déjà à jour côté DB).

### 7.2 WCAG 2.2 AA (obligation EAA depuis 28/06/2025)

| Critère                               | Application dashboard                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **1.1.1** texte alternatif            | `alt` = titre du cours sur chaque couverture ; barres `aria-label`.                                          |
| **1.4.3** contraste                   | Palette sobre gris/emerald conforme ≥ 4.5:1 (texte) — vérifier `bg-emerald-600` sur blanc pour le texte CTA. |
| **2.4.7** focus visible               | `focus-visible:outline-2` sur cartes/liens/onglets.                                                          |
| **2.4.11** focus non masqué           | Pas de barre sticky qui recouvre le focus (header non sticky sur mobile).                                    |
| **2.5.8** taille de cible ≥ 24 px     | Boutons/onglets `min-h`/`py` suffisants ; carte entière cliquable.                                           |
| **3.3.8** authentification accessible | Auth = magic-link (pas de captcha cognitif) ; mot de passe optionnel (doc 04) autorise le collage.           |
| **4.1.2** name/role/value             | `role="progressbar"`, `aria-current`, `<nav aria-label>`.                                                    |
| **Reduce motion**                     | Aucune animation par défaut ; préférence `reduceMotion` respectée par le player (doc 02).                    |

---

## 8. Conformité (ce que le dashboard expose côté apprenant)

> Le dashboard est une **vue de consultation** : il **n'écrit pas** de preuve (sauf préférences). Mais il **donne accès** aux livrables de conformité côté apprenant :

- **Certificat de réalisation** (modèle officiel, heures réalisées) téléchargeable dès `certificatPret` — produit par `elearning-certificat-worker` (doc 02 §9), même pipeline `DocumentGenere` + QR que les attestations Qualiopi.
- **Information de durée** (D.6313-3-1 §2) : `dureeEstimeeMinutes` affichée par cours + `tempsTotalSec` réel dans la barre globale.
- **Aucune** mention Qualiopi/CPF/financement côté apprenant (règle de la page existante) — la conformité est **prouvée côté admin**, pas affichée à l'apprenant.
- **RGPD** : droits export/suppression accessibles depuis l'onglet Profil (actions existantes) ; préférences = donnée minimisée (pas de PII nouvelle).

---

## 9. Checklist d'implémentation (MVP)

- [ ] `getDashboardApprenant()` + `getCoursRecommandes()` (stub-aware, URLs R2 fail-soft).
- [ ] `updatePreferencesApprenantAction` + Zod + `revalidatePath` (consomme `Trainee.preferencesJson` du doc 04).
- [ ] Composants serveur : `DashboardApprenant`, `ReprendreCard`, `BarreProgressionGlobale`, `CarteCours`, `ListeCertificatsElearning`, `OngletsEspace`.
- [ ] Composant client : `PreferencesApprenantForm` (pattern `useTransition`).
- [ ] Étendre `mon-espace/page.tsx` (composition `Promise.all` + bloc conditionnel `aDuElearning`).
- [ ] Sous-routes `mon-espace/cours`, `mon-espace/certificats`, `mon-espace/profil` (Server Components, `force-dynamic`, `noindex`).
- [ ] `loading.tsx` (skeletons) + `error.tsx` par segment.
- [ ] Déplacer les blocs Qualiopi documents/handicap/RGPD vers l'onglet Profil **sans casser** le cas « stagiaire présentiel sans e-learning » (page mono-bloc préservée).
- [ ] Tests Vitest : agrégation buckets (en cours/terminés/non commencés), pondération `percentGlobal`, deep-link reprise (`?t=`), fusion certificats e-learning + Qualiopi, garde stub.invalid, fail-soft R2.
- [ ] Audit a11y (axe) + Lighthouse local (LCP/CLS/INP) sur `/portail/mon-espace` avec données seed.

---

## Liens

- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` / `Module` / `Lesson` (`slug`, `titre`, `imageCouvertureKey`, `dureeEstimeeMinutes`, `seuilReussitePct`).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` / `CourseProgress` / `ModuleProgress` / `LessonProgress` (sources du dashboard, agrégats matérialisés).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant, `Trainee.preferencesJson`, `getLearnerSession()`.
- `04-BACKEND/05-authentification-apprenant.md` — `requireLearner` / `getLearnerSession` (remplacent à terme `getPortailToken`+`verifierToken` ici).
- `05-FRONTEND-APPRENANT/02-lecteur-cours-player.md` — cible du deep-link « Reprendre » (`?t=`), lecture des préférences, heartbeat.
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique des verrous et `verrouRaison` affichés en aperçu sur les cartes.
- `05-FRONTEND-APPRENANT/06-certificats-badges.md` — détail du rendu certificat (réutilisé dans l'onglet Certificats).
- `06-CONSOLE-ADMIN/02-pilotage-dashboard.md` — pendant admin (le pilotage côté Axion-IA, à ne pas confondre avec ce dashboard apprenant).
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), ADR-0005 (vidéo), ADR-0007 (cloisonnement), ADR-0008 (migrations additives).
