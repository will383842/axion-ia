# Vision & objectifs — Plateforme LMS e-learning Axion-IA

> Document de cadrage produit. Il fixe **pourquoi** on construit cette plateforme, **pour qui**, **quelle valeur** elle crée, **comment** on se différencie, et **à quoi** on mesure le succès. Il est la boussole de tous les documents de détail (data model, backend, frontend, conformité, roadmap).
>
> Dernière mise à jour : 2026-06-27.
> Statut : socle posé (s'aligne sur les ADR `00-INDEX/DECISIONS-ARBITRAGES.md` et le data model `03-DATA-MODEL/01-schema-cours-modules-lecons.md`).

---

## 0. Résumé en une page

Axion-IA est un **organisme de formation IA** (SAS française, NDA DREETS AURA, certifié Qualiopi). Aujourd'hui, son code gère parfaitement les formations **présentiel** et **live (distanciel synchrone)** : sessions, stagiaires (`Trainee`), inscriptions (`Enrollment`), émargement, relevés de connexion, documents légaux (convention, attestation, certificat de réalisation, facture exonérée de TVA), financements OPCO/France Travail, BPF, 22 indicateurs Qualiopi.

Ce qui **manque** : un vrai **e-learning asynchrone (FOAD)** — un parcours en ligne qu'un apprenant suit à son rythme, avec des **modules qui se déverrouillent**, des **quiz bloquants** pour valider le module suivant, un **suivi de progression** complet et un **certificat** à la clé. C'est exactement ce que la concurrence (Moodle, Teachable, 360Learning, LearnWorlds) propose, mais nous voulons une brique **propriétaire**, **intégrée** à l'écosystème Axion-IA, **conforme FOAD/Qualiopi/OPCO** dès le premier jour, et **certification-ready** pour le CPF le jour où la certification RNCP/RS sera obtenue.

Cette plateforme transforme Axion-IA d'un OF « à la séance » en un éditeur de **produits de formation scalables** : on crée un cours une fois, on le vend / l'offre à un nombre illimité d'apprenants (particuliers, salariés d'entreprises, participants de nos sessions présentielles), sans coût marginal d'animation, tout en produisant automatiquement les preuves légales de réalisation.

---

## 1. Le problème résolu

### 1.1 Côté Axion-IA (l'organisme)

**Problème central : le chiffre d'affaires est plafonné par le temps formateur.** Chaque euro facturé exige une heure d'animation présentielle ou live. Pas d'animation = pas de revenu. C'est un modèle de service pur, non scalable.

Sous-problèmes concrets, vérifiés dans le code existant :

1. **Aucun support de cours asynchrone.** Le code modélise des `EvaluationAcquis` (~`schema.prisma` 5653) et des `Questionnaire` (~5704) qui **stockent des résultats**, mais il n'existe **aucun moteur de quiz interactif**, aucun lecteur de cours, aucune notion de `Course`/`Module`/`Lesson`. On ne peut pas mettre un parcours en ligne.
2. **Le portail apprenant est en lecture seule.** `PortailAcces` (~6236) ouvre `/portail/mon-espace` (token 64 hex, cookie HttpOnly 90 j, `portail-service.ts` → `getEspaceStagiaire`) pour **consulter** documents et infos de session. Il ne permet **pas d'apprendre** : pas de leçon, pas de progression, pas de reprise.
3. **Pas de modèle de revenu produit.** L'infra Stripe existe (`Invoice`/`Payment`/`Refund`, flag `STRIPE_ENABLED` dans `src/env.ts` ~103-115) mais reste éteinte ; surtout, il n'y a **rien à vendre en self-service** — pas de catalogue de cours, pas d'octroi d'accès, pas de commande e-learning.
4. **Création de contenu lourde.** Le Formation Engine IA (`qualiopi-formation-engine-worker.ts`) génère d'excellents **supports pédagogiques** (Backward Design, critique adversariale, grille qualité), mais le résultat n'est **pas jouable** en ligne : il produit des documents, pas un parcours interactif déverrouillable.

### 1.2 Côté apprenant (particulier ou salarié)

- **Rigidité.** Pour se former, il faut bloquer une journée présentiel ou une visio synchrone. Beaucoup de cibles (salariés débordés, indépendants) veulent apprendre **par micro-sessions, quand ils peuvent**.
- **Pas de preuve d'acquisition graduée.** Sans quiz bloquant ni gating par score, rien ne garantit (ni ne prouve) qu'un module a été **compris** avant de passer au suivant.
- **Pas de reprise.** Un apprenant interrompu ne peut pas reprendre exactement où il s'est arrêté.

### 1.3 Côté entreprise (le futur gros marché)

- **Impossible d'équiper une équipe.** Le modèle `Client` (~4890) est un **CRM** (SIRET, OPCO, devis) — **pas un multi-tenant** : aucune donnée cloisonnée par entreprise, pas d'admin entreprise, pas de reporting d'équipe. Une entreprise qui veut former 40 salariés en autonomie n'a aujourd'hui aucune surface pour le faire.
- **Pas d'octroi en masse.** Ouvrir 40 accès = 40 actions manuelles. Aucun import CSV, aucun « pack de sièges ».

### 1.4 Côté conformité (le risque qui bloque la vente finançable)

La FOAD est finançable **seulement** si elle respecte l'art. **D.6313-3-1** (3 conditions cumulatives : assistance technique ET pédagogique ; information sur les activités et la durée ; **évaluations qui jalonnent/concluent**). Une plateforme « contenu seul » sans évaluation jalonnante = **non-conformité majeure** Qualiopi (Ind.11) → financement OPCO refusé. Aucun outil du marché ne nous garantit ces preuves **dans notre format Qualiopi** sans configuration lourde. Le résoudre nous-mêmes, nativement, est un avantage décisif.

**En une phrase :** on résout l'incapacité d'Axion-IA à vendre de la formation **scalable, à distance, à son rythme, finançable et prouvée**, à des particuliers comme à des équipes d'entreprises.

---

## 2. La valeur business

Quatre leviers de valeur, par ordre d'impact, chacun rattaché à une réalité du code.

### 2.1 Levier 1 — Vente directe (B2C / indépendants)

- **Quoi :** un catalogue de cours e-learning achetables/octroyables à l'unité. MVP = paiement par **virement + octroi manuel** (1 clic admin) ; V1 = **CB en ligne** via activation `STRIPE_ENABLED=true` (l'infra `Invoice`/`Payment`/webhook est déjà là, ADR-LMS-0004).
- **Valeur :** revenu **découplé du temps formateur**. Marge quasi 100 % après production du cours. Catalogue SEO public (JSON-LD `Course`) qui capte de la demande organique 24/7.
- **Réutilisation :** `pricing.ts` (SSOT prix), infra Stripe gated, génération de facture exonérée de TVA existante.

### 2.2 Levier 2 — Financement OPCO (B2B finançable, dès le MVP)

- **Quoi :** la FOAD asynchrone est **finançable à 100 % par les OPCO** si les 3 conditions D.6313-3-1 sont réunies. La plateforme produit **nativement** le faisceau de preuves exigé (R.6313-3 : preuve libre = évaluations + travaux rendus + **logs LMS** + traces d'accompagnement ; le relevé de connexion seul est insuffisant) et le **certificat de réalisation au modèle officiel** (heures réalisées, obligatoire depuis le 01/06/2020).
- **Valeur :** on vend **finançable immédiatement** (sans attendre le CPF). Les OPCO ne réclament au paiement que **facture + relevé de dépenses + certificat de réalisation** ; en contrôle, ils peuvent demander les pièces FOAD — que nous conservons (10 ans comptable, 6 ans fiscal/OPCO, 3-5 ans preuves de réalisation).
- **Réutilisation :** `DocumentGenere` + `qrToken` (certificats/QR), skill `axionia-qualiopi`, moteur de documents légaux, conservation R2.

### 2.3 Levier 3 — Entreprises / équipes (le marché de volume)

- **Quoi :** une entreprise commande N accès pour ses salariés. **MVP :** Axion-IA ouvre les accès en **masse via import CSV** + octroi manuel (ADR-LMS-0002). **V2 :** **multi-tenant** complet — espace entreprise cloisonné, admin délégué, reporting d'équipe, branding.
- **Valeur :** **tickets moyens élevés** (packs de sièges), **récurrence** (renouvellement annuel), **effet réseau** (un référent RH satisfait rachète et recommande). C'est le levier de croissance le plus fort à terme.
- **Réutilisation :** `Client` (CRM existant) comme ancrage entreprise ; champ `ElearningCourse.ownerClientId` déjà prévu (relation `ClientCoursesProprietaires`) pour réserver un cours à un client.

### 2.4 Levier 4 — Bonus participants (rétention & qualité de nos formations existantes)

- **Quoi :** chaque participant à une formation présentiel/live reçoit **automatiquement** un accès e-learning complémentaire (révisions, approfondissements, quiz d'ancrage). Octroi déclenché par la **réalisation de la session** (transition d'état existante).
- **Valeur :** **différenciation immédiate** de nos formations vs concurrents (« vous repartez avec un espace en ligne »), **meilleure satisfaction** (Qualiopi Ind.30/appréciations), **preuves d'acquis renforcées**, et **upsell naturel** vers d'autres cours du catalogue. Coût marginal nul.
- **Réutilisation :** `Enrollment` (participant ↔ session), `FormationTransition` (event sourcing des états de session) comme déclencheur d'octroi.

> **Synthèse valeur :** la même brique technique sert quatre marchés (B2C, OPCO, entreprises, participants existants) **sans surcoût marginal**. C'est un multiplicateur de la valeur déjà créée par l'écosystème Qualiopi existant, pas un produit isolé.

---

## 3. Positionnement vs concurrents

### 3.1 Pourquoi propriétaire et pas Moodle / Teachable / 360Learning / LearnWorlds

| Critère                        | LMS du marché                                           | Notre LMS propriétaire                                                                                                    |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Intégration Qualiopi/OF**    | Générique, à adapter ; preuves FOAD au format non-Axion | **Natif** : réutilise `DocumentGenere`, certificat de réalisation officiel, conservation légale, skill `axionia-qualiopi` |
| **Données apprenants**         | Souvent hébergées hors UE, second silo PII              | **Un seul `Trainee`** (PII chiffrée AES-256-GCM, consentements, handicap), pas de double saisie ni de fuite RGPD          |
| **Coût**                       | Abonnement par siège/mois, croît avec le volume         | **Coût fixe d'infra** (déjà chez Cloudflare R2 + Stream), marge croît avec le volume                                      |
| **IA pédagogique**             | Add-on générique ou absent                              | **Formation Engine + RAG existants** : quiz-gen document-grounded, tuteur RAG ancré avec citations                        |
| **UX / cohérence de marque**   | Thème bridé                                             | Charte Editorial Premium Light, même design system que la console et le site                                              |
| **Souveraineté & évolutivité** | Roadmap subie                                           | On contrôle 100 % du code, cloisonné sous `src/server/elearning/**`                                                       |
| **Web Vitals / SEO**           | Lourds, peu optimisés                                   | Budgets stricts internes (LCP ≤ 1800, INP ≤ 100, CLS = 0), catalogue SEO JSON-LD `Course`                                 |

### 3.2 Ce qu'on prend des meilleurs (barre MUST-HAVE 2026)

On vise le **niveau pro juin 2026**, pas un MVP au rabais. Standards non négociables, alignés sur les meilleures pratiques :

- **Reprise auto persistée serveur** (`LessonProgress`, watch position), barre de progression, player vidéo standard (vitesse, sous-titres WCAG AA), **mobile-first**, leçons courtes **2-10 min** (microlearning).
- **Drip à 3 déclencheurs** (date fixe / offset J+N / complétion) **+ gating par score réel** (pas attempt-only) — modélisé par l'enum `ElearningUnlockType {immediat, apres_precedent, date_fixe, offset_inscription, score_quiz}`. **Verrou affiché AVEC sa raison** + override admin.
- **Quiz ~12 types** (QCM mono/multi, vrai-faux, appariement, texte à trous, ordonnancement, réponse courte, essai + correction manuelle, upload) + banque + tirage **N parmi M** + shuffle questions ET réponses + tentatives/seuil/pondération + feedback configurable + rationale.
- **Anti-triche léger** = randomisation + temps serveur (proctoring réservé au high-stakes, CNIL proportionné/optionnel/avec alternative).
- **Outil auteur drag&drop** : sections → leçons, blocs mixtes dans une leçon, upload média transcodé auto, aperçu as-student, brouillon → publication.
- **Vidéo HLS adaptatif** + URLs signées + sous-titres via **Cloudflare Stream** (ADR-LMS-0005), pas d'auto-hébergement.
- **IA** : quiz-gen depuis le contenu, **tuteur RAG ancré avec citations** (réutilise le RAG existant), authoring document-grounded.
- **Accessibilité WCAG 2.2 AA** (obligation légale UE EAA depuis le 28/06/2025) : critères 2.4.11 (focus visible), 2.5.7 (alternative au drag), 2.5.8 (cible ≥ 24 px), 3.3.8 (auth accessible), sous-titres, clavier, focus, contraste.

### 3.3 Ce qu'on refuse explicitement (anti-patterns)

Autoplay imposé, classements/leaderboards imposés, pacing rigide self-paced, **gating attempt-only** (on exige une vraie note), un-type-de-bloc-par-leçon, auto-hébergement vidéo, sur-DRM, avatars IA maison, wrapper ChatGPT nu. Pas de SCORM/xAPI/LTI au lancement (contenu natif ; tracking modélisé sur la grammaire xAPI verbe/objet pour rester future-proof — ADR-LMS-0006).

---

## 4. Périmètre — existant réutilisé vs neuf à construire

> Détail complet dans `02-ARCHITECTURE/reutilisation-existant.md`. Le principe directeur (cf. §6) : **réutiliser avant de construire**, jamais de duplication.

### 4.1 EXISTANT réutilisé / étendu (additif)

| Brique existante                     | Emplacement                                                                                                                                                    | Rôle dans le LMS                                                                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Trainee`                            | `schema.prisma` ~5274                                                                                                                                          | **Identité apprenant unique**. On ajoute `passwordHash` **nullable** (argon2id) pour l'auth hybride (ADR-LMS-0001). PII/handicap chiffrés, consentements réutilisés.          |
| `Enrollment`                         | ~5310                                                                                                                                                          | Lien participant ↔ session présentiel/live ; **déclencheur** d'octroi e-learning bonus (levier 4).                                                                            |
| `Client`                             | ~4890                                                                                                                                                          | Ancrage **entreprise** (CRM). FK `ElearningCourse.ownerClientId` → cours réservé ; base du multi-tenant V2.                                                                   |
| `PortailAcces`                       | ~6236                                                                                                                                                          | **Auth apprenant par défaut** (magic-link, cookie HttpOnly 90 j). Étendu, pas remplacé.                                                                                       |
| Portail `/portail/mon-espace`        | `src/app/[locale]/portail/{acces,mon-espace,acces-invalide}` + `src/server/qualiopi/portail/portail-service.ts`                                                | Surface apprenant existante à **étendre** vers l'espace d'apprentissage.                                                                                                      |
| Cloudflare R2                        | `src/lib/r2-storage.ts` (`uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `getObjectBufferR2`)                                                          | Stockage médias/PDF/sous-titres + **upload direct navigateur** (gros fichiers). NB : ne **streame pas** → vidéo via Stream.                                                   |
| Infra Stripe                         | `src/lib/stripe.ts`, `Invoice`/`Payment`/`Refund`/`StripeWebhookEvent`, flag `src/env.ts` ~103-115                                                             | Paiement CB **éteint** au MVP (`STRIPE_ENABLED=false`), réactivable sans refonte (ADR-LMS-0004).                                                                              |
| `pricing.ts`                         | SSOT prix                                                                                                                                                      | Tarification des cours/packs.                                                                                                                                                 |
| Formation Engine IA                  | `qualiopi-formation-engine-worker.ts` (statutGeneration, GrilleQualiteConfig, `runAdversarialCritique`, `CacheIa`, `FormationGenerationJob`)                   | Base de l'**IA quiz-gen** et de l'authoring document-grounded.                                                                                                                |
| RAG / knowledge                      | base RAG existante                                                                                                                                             | **Tuteur RAG ancré** avec citations (Ind.19 assistance pédagogique).                                                                                                          |
| `DocumentGenere` + `qrToken`         | ~5507                                                                                                                                                          | **Certificats de réalisation** e-learning + QR de vérification.                                                                                                               |
| Emails                               | Nodemailer + React Email (`qualiopi-*.tsx`) + `email-worker` + crons                                                                                           | Magic-links, octroi, relances anti-décrochage (Ind.12), certificat. **Pas de service tiers.**                                                                                 |
| Console admin                        | `AdminPageShell`/`Header`/`StatCard`/`Table`/`Badge`, `admin-nav.ts`, RBAC `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`) | Section e-learning admin. ⚠️ Le composant sidebar monté est **`AdminSidebarNav.tsx`**.                                                                                        |
| `EvaluationAcquis` / `Questionnaire` | ~5653 / ~5704                                                                                                                                                  | **Stockent des résultats** mais sans moteur interactif → on construit le moteur de quiz à côté, en les réutilisant comme cibles de persistance des résultats quand pertinent. |

### 4.2 NEUF à construire

- **Cœur LMS** : `ElearningCourse` / `ElearningModule` / `ElearningLesson` / `ElearningResource` + enums `ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType` (data model figé dans `03-DATA-MODEL/01-schema-cours-modules-lecons.md`).
- **Progression** : `ElearningEnrollment`, `LessonProgress` (watch, reprise auto, complétion) — `03-DATA-MODEL/02-*`.
- **Moteur de quiz interactif** : `Quiz` / `Question` / `QuizAttempt`, correction auto, seuil, **gating par score** — `03-DATA-MODEL/03-*`.
- **Auth apprenant** : système **séparé de NextAuth** (cookie/middleware dédiés), magic-link + mot de passe optionnel — `04-BACKEND/05-*`.
- **Import en masse / provisioning** : CSV entreprise, octroi auto/manuel — `04-BACKEND/06-*`.
- **Multi-tenant** (conçu maintenant, **livré V2**) — `02-ARCHITECTURE/multi-tenant-strategie.md`.
- **Streaming vidéo HLS** : intégration Cloudflare Stream, URLs signées, watermark, sous-titres — `04-BACKEND/07-*`.
- **Outil auteur drag&drop** : course builder, aperçu as-student — `06-CONSOLE-ADMIN/03-*`.
- **IA pédagogique** : quiz-gen + tuteur RAG — `04-BACKEND/08-*`, `09-*`.
- **Certificats e-learning** + catalogue public SEO.

### 4.3 Cloisonnement du code (ADR-LMS-0007)

Tout le neuf vit sous des chemins dédiés, sans toucher le cœur existant :

- `src/server/elearning/**` (services domaine, auth apprenant, IA, vidéo)
- `src/app/[locale]/(admin)/[adminPrefix]/elearning/**` (console admin)
- `src/app/[locale]/portail/**` (extension de l'espace apprenant existant)
- `src/components/elearning/**` et `src/components/admin/elearning/**`
- Workers : `src/server/queue/workers/elearning-*-worker.ts` (ex. `elearning-video-worker`, `elearning-quizgen-worker`, `elearning-relance-worker`)

---

## 5. Critères de succès mesurables

Objectifs SMART, par horizon. Les seuils sont des **cibles internes** à raffiner avec les premières données réelles ; ils servent de définition de « réussi » par phase.

### 5.1 Produit / technique (gates de qualité)

| KPI                                                               | Cible                                                                                                | Mesure                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Web Vitals** pages apprenant (player exclu de la page publique) | LCP ≤ 1800 ms p75 · INP ≤ 100 ms p75 · CLS = 0                                                       | Lighthouse CI (`pnpm lhci`) — risque INP sur player ⇒ budget dédié, JS lazy |
| **First Load JS** / route apprenant                               | ≤ 75 KB gz (cible V6 ; player peut négocier un budget dédié comme `/appel`)                          | `size-limit` gate                                                           |
| **Accessibilité**                                                 | 0 violation WCAG 2.2 AA bloquante sur parcours apprenant                                             | axe-core CI + audit manuel clavier/lecteur d'écran                          |
| **Reprise auto**                                                  | 100 % des leçons reprennent à la position serveur ≤ 5 s d'écart                                      | tests E2E `LessonProgress`                                                  |
| **Fiabilité octroi**                                              | 100 % des accès octroyés (auto/manuel/CSV) aboutissent ou échouent explicitement (jamais silencieux) | logs worker + tests                                                         |
| **Migrations**                                                    | 0 DROP, 0 colonne non-nullable ajoutée à une table existante                                         | revue PR + `prisma migrate diff`                                            |

### 5.2 Conformité (non négociable — gate de mise en vente finançable)

| KPI                                                           | Cible                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Faisceau de preuves FOAD** (R.6313-3) complet et exportable | 100 % des apprenants finançables : évaluations + travaux + logs LMS + traces d'assistance |
| **Évaluations jalonnantes** (D.6313-3-1 §3 / Qualiopi Ind.11) | 100 % des cours FOAD ont ≥ 1 évaluation qui jalonne ET 1 qui conclut                      |
| **Information durée/activités** (D.6313-3-1 §2)               | 100 % des cours affichent durée moyenne + liste des activités                             |
| **Assistance technique ET pédagogique** (Ind.19)              | délais formalisés affichés ; canal de tutorat actif ; traces conservées                   |
| **Certificat de réalisation** (modèle officiel, heures)       | généré pour 100 % des parcours terminés, archivé R2, vérifiable par QR                    |
| **Conservation**                                              | 10 ans comptable · 6 ans fiscal/OPCO · 3-5 ans preuves · 6 mois-1 an logs techniques      |

### 5.3 Business (par horizon)

| Horizon | Critère de succès                                                                                                                                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP** | 1 cours en ligne, suivi de bout en bout par un apprenant réel (octroi → leçons → quiz bloquant réussi → certificat) ; au moins 1 dossier OPCO accepté avec preuves issues de la plateforme ; octroi en masse CSV opérationnel |
| **V1**  | Catalogue multi-cours + vitrine SEO ; création d'un cours **sans dev** par l'équipe via l'outil auteur ; ≥ 1 vente CB en ligne ; relances auto anti-décrochage actives ; tuteur RAG en ligne                                  |
| **V2**  | ≥ 1 entreprise gère ses équipes en autonomie (multi-tenant) ; CPF activé **si** certification RNCP/RS obtenue (`EDOF_ENABLED=true`)                                                                                           |

### 5.4 Engagement apprenant (à instrumenter dès le MVP, cibler en V1)

- **Taux de complétion** des cours (cible interne V1 : > 60 % sur les accès octroyés actifs — bien au-dessus de la moyenne MOOC ~10 %, grâce au gating + relances + microlearning).
- **Taux de réussite aux quiz bloquants** au 1er passage (mesure de la qualité pédagogique, pas seulement de l'engagement).
- **Délai de reprise** après interruption (signal de friction UX).
- **NPS / appréciation** post-cours (réutilise `Appreciation`, Qualiopi Ind.30).

---

## 6. Principes directeurs

Règles de conception qui priment sur toute décision locale. En cas de conflit, on remonte (STOP & ASK).

1. **Réutiliser avant de construire.** Un `Trainee`, un `Client`, un R2, une infra Stripe, un moteur de documents, un RAG — on étend, on ne duplique pas. Toute duplication doit être justifiée par écrit.
2. **Conformité by design, pas en bout de chaîne.** Les preuves FOAD (évaluations jalonnantes, logs, traces d'assistance, durée) sont câblées **dès le data model**, pas ajoutées après. Un cours qui ne peut pas prouver sa réalisation n'est pas « FOAD ».
3. **Cloisonnement strict.** Le LMS vit sous `**/elearning/**` (ADR-LMS-0007). Zéro risque de régression sur l'admin Qualiopi, le site public ou NextAuth.
4. **Deux mondes d'auth séparés.** Apprenants (magic-link + mot de passe optionnel, système dédié) ≠ admins (NextAuth + 2FA). Aucune passerelle, aucune confusion de session (ADR-LMS-0001).
5. **Migrations strictement additives.** CREATE TABLE / ADD COLUMN nullable uniquement. Jamais de DROP. Compatible avec le build externalisé `stub.invalid` et la prod live (ADR-LMS-0008).
6. **Build-safe.** Les pages e-learning sont derrière auth + `force-dynamic` → naturellement compatibles avec le stub `stub.invalid` (aucun appel DB au SSG). Tout nouveau code respecte ce contrat.
7. **Activable par flag, jamais par refonte.** CB (`STRIPE_ENABLED`), CPF/EDOF (`EDOF_ENABLED`), multi-tenant, standards SCORM/xAPI : tout est « ready » et s'allume par configuration le moment venu.
8. **UX apprenant parfaite, outil auteur facile.** Mobile-first, microlearning, reprise auto, verrou expliqué, WCAG 2.2 AA côté apprenant ; drag&drop, aperçu as-student, transcodage auto côté auteur. La friction est l'ennemie de la complétion.
9. **Performance budgétée.** Web Vitals stricts ; le player (risque INP) et le calendrier négocient un budget dédié documenté, pas une exemption silencieuse.
10. **Souveraineté des données & RGPD.** Une seule source PII (`Trainee`, chiffrée), résidence UE privilégiée (Bunny en alternative à Stream si la résidence devient prioritaire), proportionnalité CNIL (proctoring optionnel/justifié), conservation cadrée par la loi.
11. **IA ancrée, jamais hallucinée.** Quiz-gen et tuteur sont **document-grounded** (RAG + citations), réutilisant la critique adversariale et la grille qualité du Formation Engine. Pas de wrapper LLM nu.
12. **FR canonique.** EN désactivé (cf. plateforme) ; `langue` prévu sur `ElearningCourse` pour une i18n future sans surcoût immédiat.

---

## Liens

- `00-INDEX/README.md` — index maître du dossier
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 à 0008 (décisions figées référencées ici)
- `01-VISION-PERIMETRE/perimetre-mvp-v1-v2.md` — découpage détaillé du périmètre
- `01-VISION-PERIMETRE/personas-roles.md` — apprenant, auteur, admin, référent entreprise
- `01-VISION-PERIMETRE/modele-economique-tarification.md` — détail des 4 leviers de revenu
- `02-ARCHITECTURE/reutilisation-existant.md` — carte de réutilisation (anti-duplication)
- `02-ARCHITECTURE/multi-tenant-strategie.md` — entreprise V2
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — colonne vertébrale (modèles/enums figés)
- `08-CONFORMITE/01-foad-d6313-3-1.md` & `02-qualiopi-indicateurs-foad.md` — base des critères §5.2
- `08-CONFORMITE/03-cpf-edof-readiness.md` — pourquoi le CPF est en V2
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — ordre de construction et critères de sortie
