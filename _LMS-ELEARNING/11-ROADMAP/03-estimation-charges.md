# Estimation des charges — Plateforme LMS e-learning Axion-IA

> Estimation par lot/epic, en **jours-homme (j/h)** d'un développeur senior fullstack TypeScript déjà familier de la stack (Next.js 16.2 App Router, Prisma 5.22, Postgres, BullMQ, @react-pdf/renderer, Nodemailer, next-intl, Tailwind v4) et du codebase Axion-IA.
>
> Dernière mise à jour : 2026-06-27. À lire **après** `01-phasage-mvp-v1-v2.md` et `02-backlog-epics-stories.md`.

---

## 0. Méthode, base de chiffrage et conventions

### 0.1 Unité et profil

- **1 j/h = 1 jour effectif** d'un dev senior productif (≈ 6 h de code net, le reste = revue, CI, coordination).
- Profil supposé : **senior fullstack** maîtrisant la stack ET le repo (cloisonnement `src/server/elearning/**`, RBAC `requireAdmin*`, contrat `stub.invalid`, budgets Web Vitals). Un dev non familier du repo = **+30 à +40 %** (ramp-up sur les conventions maison : `AdminPageShell`, Server Actions, migrations additives, pipeline GH Actions).
- Les fourchettes encadrent l'incertitude : **basse** = tout se passe bien et la réutilisation joue à plein ; **haute** = frictions (transcodage vidéo, accessibilité WCAG, conformité FOAD, INP du player).

### 0.2 Ce qui est inclus dans chaque chiffrage d'epic

Sauf mention contraire, chaque estimation d'epic **inclut** :

- Schéma Prisma + migration additive (ADR-LMS-0008) + `prisma generate`.
- Services domaine sous `src/server/elearning/**` + Server Actions (pas de REST par défaut).
- UI (composants `src/components/elearning/**` ou `src/components/admin/elearning/**`).
- Tests Vitest unitaires + tests d'intégration sur le chemin critique.
- Câblage RBAC (`requireAdminRead/Write/Publish/Delete` côté admin ; garde apprenant côté portail).
- Respect du contrat de build (`force-dynamic` + auth → pas d'impact `stub.invalid` ; sinon early-exit explicite).

Ce qui est **exclu** des chiffrages dev (à prévoir à part) :

- Production de contenu pédagogique réel (rédaction des cours, tournage vidéo) → métier, pas dev.
- Rédaction des CGV/mentions FOAD, dépôt RNCP/RS, démarches France Compétences/EDOF → juridique/Will.
- Achat & paramétrage compte Cloudflare Stream / Stripe / France Travail → ops/Will.
- Création de contenu de test E2E volumineux (jeux de données apprenants).

### 0.3 Coefficients transversaux (déjà répartis dans les epics, listés pour transparence)

| Poste transversal                                       | Charge implicite                      | Où                                           |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| Accessibilité WCAG 2.2 AA (EAA 28/06/2025)              | ~15 % du frontend apprenant           | dilué dans player/quiz/dashboard/certificats |
| Web Vitals (INP player, CLS, First Load JS ≤ 75 KB)     | ~10 % du frontend                     | dilué + 1 lot dédié perf                     |
| Tests (unit + intégration + E2E ciblés)                 | ~25 % de chaque epic                  | inclus                                       |
| Revue de code adversariale + corrections (pattern repo) | ~10 %                                 | inclus                                       |
| Conformité FOAD transversale                            | epic dédié (E10) + traçabilité diluée | E10                                          |

---

## 1. Synthèse — totaux par phase

| Phase                       | Périmètre                                                                                                                                 | Fourchette (j/h) | Médiane retenue |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| **MVP**                     | 1 cours finançable OPCO/entreprise/vente directe, accès ouvrable, modules déverrouillables, quiz bloquants, progression, certificat, FOAD | **52 – 74**      | **62**          |
| **V1**                      | Industrialisation : multi-cours, outil auteur abouti, banque de questions, dashboard/reporting, relances auto, tuteur RAG, CB Stripe      | **41 – 60**      | **50**          |
| **V2**                      | Échelle : multi-tenant complet, CPF/EDOF activé, IA pédagogique avancée, standards SCORM/xAPI                                             | **34 – 52**      | **42**          |
| **TOTAL périmètre complet** | MVP + V1 + V2                                                                                                                             | **127 – 186**    | **~154**        |

> **Lecture pour Will.** Le **MVP réaliste = ~62 j/h** (≈ 12-13 semaines d'un dev senior solo, ou ~7-8 semaines à deux). Le **périmètre complet** (tout, y compris multi-tenant et CPF) est dans la fourchette **~130-185 j/h** annoncée par l'audit (80-120j ne couvrait que MVP+V1 « heureux » ; le multi-tenant V2 + l'accessibilité stricte + la conformité FOAD poussent vers le haut). La réutilisation de l'existant retire **~35-45 j/h** par rapport à un LMS from scratch (voir §6).

---

## 2. Phase MVP — détail par lot

> Séquence imposée par `01-phasage-mvp-v1-v2.md` (chaque lot dépend du précédent). Le data model est le chemin critique : tout en dépend.

### MVP-E1 — Data model + migrations (cœur LMS, progression, quiz, accès)

**Fourchette : 5 – 7 j/h.**

**Neuf à construire :**

- Tables cœur déjà spécifiées (`03-DATA-MODEL/01`) : `ElearningCourse`, `ElearningModule`, `ElearningLesson`, `ElearningResource` + enums `ElearningCourseStatut`, `ElearningLessonType`, `ElearningUnlockType`.
- Progression (`02-schema-progression-tracking.md`) : `ElearningEnrollment`, `LessonProgress`, table d'événements façon xAPI (verbe/objet, ADR-0006).
- Quiz (`03-schema-quiz-evaluations.md`) : `Quiz`, `Question`, `QuestionOption`, `QuizAttempt`, `QuizAnswer`, banque.
- Accès/auth (`04-schema-comptes-acces-auth.md`) : `Trainee.passwordHash` nullable (ADR-0001), table d'accès e-learning, `Order` minimal (ADR-0004).
- Champs inverses additifs sur `Formation` et `Client`.

**Réutilisé :** conventions repo (UUID `@db.Uuid`, `@map` snake_case, `citext`, index FK), `Trainee`/`Enrollment`/`Client`/`Formation` existants comme points d'ancrage (FK), pattern migration additive déjà rôdé.

**Hypothèses :** schéma déjà rédigé à 70 % dans les docs socle ; pas de DROP ; tout nullable côté tables existantes. `migrate diff` propre (pas de drift type content-engine-v2, cf. mémoire).

**Risques d'estimation :** modélisation quiz multi-types (12 types) plus subtile qu'attendu (scoring polymorphe → JSON normalisé) → +1-2 j. Index/perf sur `LessonProgress` (table à fort volume) à penser tôt.

---

### MVP-E2 — Auth apprenant (magic-link étendu + mot de passe optionnel)

**Fourchette : 6 – 9 j/h.**

**Neuf à construire :**

- Système d'auth apprenant **séparé de NextAuth** (ADR-0001) : cookie HttpOnly dédié, middleware/garde `src/server/elearning/auth/**`, sessions apprenant.
- `passwordHash` argon2id **optionnel** (set/reset/login email+mdp pour comptes entreprise).
- Routes : `/portail` (extension) ou `/[locale]/apprendre/**` login + magic-link + reset mdp.
- Accessibilité auth (WCAG 3.3.8 : pas de test cognitif, alternative au CAPTCHA).

**Réutilisé (réduction majeure) :** `PortailAcces` (token 64 hex, cookie HttpOnly 90j) + `portail-service.ts` (`creerAcces`/`verifierToken` timing-safe via `timingSafeEqual`) + `FormateurMagicLink` comme modèle de second magic-link. Primitives `randomBytes(32)`/`timingSafeEqual` déjà en place. Emails magic-link via Nodemailer + `email-worker` existant.

**Hypothèses :** on **n'étend pas** NextAuth (zéro risque admin). Argon2 ajouté en dépendance (déjà présent ? sinon +0,5 j). Le magic-link reste le chemin par défaut.

**Risques :** cohabitation des deux mondes (admin NextAuth vs apprenant) — bien isoler les middlewares pour éviter une régression auth admin (test E2E obligatoire). Rate-limiting login mdp (anti-bruteforce) à câbler (Redis).

---

### MVP-E3 — Octroi d'accès (auto session + manuel admin + import CSV masse)

**Fourchette : 5 – 7 j/h.**

**Neuf à construire :**

- Service d'octroi `src/server/elearning/access/grant-service.ts` : crée `ElearningEnrollment` + accès + email d'invitation.
- **Auto** : hook « session réalisée → octroi e-learning » (lien `Formation.elearningCourses`).
- **Manuel** : Server Action admin (1 clic sur un `Trainee`/email).
- **Import CSV masse** : upload CSV entreprise → parse → création `Trainee` (dédup email `citext`) + octroi en masse + rapport d'erreurs. Worker `elearning-import-worker.ts` pour les gros lots.

**Réutilisé :** `Trainee`/`Enrollment` existants, dédup email `citext`, pattern d'upload (R2 `getSignedUploadUrlR2`), BullMQ + `queues.ts` pour le worker d'import, `email-worker` pour les invitations en masse. Pattern `ReleveConnexionImport` (import Zoom/Teams) comme référence d'import idempotent.

**Hypothèses :** MVP = octroi côté admin Axion-IA (pas d'admin entreprise déléguée — c'est V2). CSV à colonnes fixes documentées.

**Risques :** idempotence (réimport sans doublon) + gestion PII/consentements à l'import (champ chiffré handicap, consentements) → +1 j si on veut le faire proprement RGPD dès le MVP.

---

### MVP-E4 — Pipeline vidéo (Cloudflare Stream) + upload média R2

**Fourchette : 6 – 9 j/h.**

**Neuf à construire :**

- Intégration **Cloudflare Stream** (ADR-0005) : création d'asset (upload direct ou tus), récupération `videoAssetId`, statut de transcodage, **URLs HLS signées** + **watermark dynamique** par utilisateur.
- Worker `elearning-video-worker.ts` : poll/Webhook statut transcodage → maj `ElearningLesson.videoAssetId`/`videoDureeSec`.
- Upload média non-vidéo (PDF, sous-titres `.vtt`, images) via R2.
- Génération de jeton de lecture signé côté Server Action (durée courte).

**Réutilisé :** `src/lib/r2-storage.ts` tel quel pour PDF/sous-titres/images (`uploadToR2`, `getSignedUploadUrlR2`, `getSignedUrlR2`). BullMQ pour le worker. **R2 ne streame pas** → la vidéo passe par Stream (nouveau client à écrire, ~1 fichier `src/lib/cloudflare-stream.ts`).

**Hypothèses :** compte Cloudflare Stream provisionné par Will (clés API). HLS + sous-titres natifs Stream. Pas de DRM lourd (URLs signées + watermark suffisent au MVP, ADR-0005).

**Risques :** webhooks Stream + états de transcodage asynchrones (retry, échec) ; CORS upload direct ; watermark dynamique (overlay serveur vs player) = poste sensible → +1-2 j. Coût/latence de signature à chaque lecture.

---

### MVP-E5 — Lecteur de cours (player, reprise auto, progression, heartbeat) + déverrouillage

**Fourchette : 9 – 13 j/h.** _(le plus gros lot frontend du MVP)_

**Neuf à construire :**

- **Player vidéo HLS** standard : vitesse de lecture, sous-titres WCAG AA, clavier/focus, mobile-first. (hls.js ou player léger ; budget INP/First Load surveillé).
- **Reprise auto persistée serveur** : heartbeat (Server Action throttlée ou route `force-dynamic`) → `LessonProgress.watchedSeconds`/`position`, reprise au timecode.
- **Barre de progression** module + cours, état de complétion.
- **Moteur de déverrouillage** (`ElearningUnlockType`) : `immediat`/`apres_precedent`/`date_fixe`/`offset_inscription`/`score_quiz`. Verrou **affiché avec sa raison** + override admin.
- Layout apprenant (dashboard cours, sommaire, navigation leçon→leçon).

**Réutilisé :** auth apprenant (E2), data model progression (E1), tokens de lecture signés (E4), design tokens/charte Editorial Premium Light, composants UI de base.

**Hypothèses :** microlearning (leçons 2-10 min) → heartbeat raisonnable. Reprise = dernier timecode + dernière leçon vue.

**Risques d'estimation (élevés) :**

- **INP du player** vs budget interne (≤ 100 ms) → hls.js peut peser sur First Load JS (≤ 75 KB gz/route). Lazy-load + code-split obligatoires → +1-2 j de tuning. _Possible besoin d'exception budget documentée par ADR (comme `/appel`)._
- Logique de déverrouillage (5 types combinables niveau module ET leçon) = nid à bugs → tests exhaustifs.
- Throttle heartbeat (ne pas marteler la DB) + cohérence offline/reconnexion.

---

### MVP-E6 — Moteur de quiz (types essentiels, correction auto, seuil, gating)

**Fourchette : 8 – 11 j/h.**

**Neuf à construire (MVP = sous-ensemble des ~12 types) :**

- Types MVP : **QCM mono**, **QCM multi**, **vrai/faux**, **texte à trous**, **réponse courte** (correction auto exacte/normalisée) + **essai** (correction manuelle admin, file d'attente).
- **Correction auto serveur** (temps serveur = anti-triche léger) + **scoring pondéré** + **seuil de réussite** + **tentatives**.
- **Gating par vraie note** (`unlock_score_pct`, pas attempt-only) → débloque module suivant.
- **Feedback configurable** + rationale par question. Shuffle questions ET réponses.
- UI quiz apprenant accessible (WCAG : pas de drag obligatoire au MVP, alternative clavier).

**Réutilisé :** `EvaluationAcquis`/`Questionnaire` existants **stockent** des résultats mais n'ont **aucun moteur interactif** → on s'en inspire pour le mapping conformité (preuve d'évaluation FOAD Ind.11), mais le moteur est neuf. `QuizAttempt` (E1).

**Hypothèses :** appariement/ordonnancement/upload/tirage aléatoire N parmi M = **reportés en V1** (banque de questions). MVP couvre les types nécessaires au gating bloquant.

**Risques :** scoring polymorphe (chaque type a sa logique) ; correction « réponse courte » (normalisation accents/casse/synonymes) sous-estimée → +1 j. Anti double-soumission (idempotence tentative).

---

### MVP-E7 — Certificat de réalisation (modèle officiel, heures, QR)

**Fourchette : 3 – 5 j/h.**

**Neuf à construire :**

- Génération du **certificat de réalisation FOAD** (modèle officiel obligatoire depuis 01/06/2020) : **heures réalisées** (en centièmes), période, intitulé, mention FOAD.
- Calcul des heures réalisées depuis `LessonProgress` + temps quiz (faisceau de preuves R.6313-3).
- Déclenchement à l'atteinte du `seuilReussitePct` du cours.

**Réutilisé (réduction forte) :** `DocumentGenere` + `qrToken` (QR de vérification) existants, `@react-pdf/renderer`, templates PDF Qualiopi existants (`qualiopi-*`), pattern de numérotation/archivage R2 (`invoicePdfKey`-like), worker de génération doc existant. Le moteur PDF + QR est **déjà là** → on ajoute un template + le calcul d'heures.

**Hypothèses :** modèle de certificat aligné sur les templates Qualiopi existants (cohérence). Archivage R2 10 ans (déjà en place pour factures).

**Risques :** calcul d'heures « réalisées » défendable en contrôle (logs LMS ≠ temps de présence) → cadrage conformité avec E10. Faible risque technique.

---

### MVP-E8 — Outil auteur minimal (créer cours/modules/leçons, upload, quiz, publier)

**Fourchette : 7 – 10 j/h.**

**Neuf à construire :**

- CRUD `ElearningCourse`/`Module`/`Lesson` dans la console admin (`src/app/[locale]/(admin)/[adminPrefix]/elearning/**`).
- **Réordonnancement** modules/leçons (drag léger ou flèches au MVP — drag&drop complet = V1) écrivant `ordre` en transaction.
- Édition contenu par type (texte riche `contenuJson`, upload vidéo→Stream, PDF→R2, rattacher un quiz).
- Workflow **brouillon → publication** (`statut` + `version` + `publishedAt`).
- Aperçu basique.

**Réutilisé (réduction forte) :** `AdminPageShell`/`AdminHeader`/`StatCard`/`AdminTable`/`AdminBadge`, RBAC `requireAdminWrite/Publish`, Server Actions, upload R2/Stream (E4), `admin-nav.ts` (ajout d'une section e-learning — **monter via `AdminSidebarNav.tsx`**, pas `AdminSidebar.tsx`, cf. mémoire). Éditeur riche : réutiliser l'éditeur Tiptap/blocs s'il existe déjà côté content-gen, sinon intégrer.

**Hypothèses :** MVP = saisie fonctionnelle (pas le drag&drop drag-perfect de V1). Un seul auteur à la fois (pas de co-édition).

**Risques :** éditeur de contenu riche (blocs mixtes dans une leçon) plus long si aucun éditeur réutilisable → +2-3 j. Aperçu « as-student » fidèle = V1.

---

### MVP-E9 — Section admin e-learning (nav, liste apprenants, octroi, suivi basique)

**Fourchette : 3 – 5 j/h.**

**Neuf à construire :**

- Entrée(s) `admin-nav.ts` + pôle e-learning.
- Listes : cours, apprenants (avec progression %), accès octroyés, tentatives quiz à corriger.
- Vue détail apprenant (progression, scores, certificat) + **override de déverrouillage**.

**Réutilisé (réduction forte) :** toute la couche admin UI (`AdminPageShell`, `AdminTable`, `AdminBadge`, filtres), RBAC, pattern des ~24 sections Qualiopi existantes.

**Hypothèses :** suivi « basique » au MVP (le dashboard analytics riche = V1).

**Risques :** faible. Surtout du câblage.

---

### MVP-E10 — Conformité FOAD transversale (preuves, assistance/tuteur basique, traçabilité)

**Fourchette : 5 – 7 j/h.**

**Neuf à construire :**

- **Faisceau de preuves** (R.6313-3, preuve libre) : agrégation logs LMS + évaluations + travaux rendus + traces d'accompagnement, **exportable** (PDF/CSV) pour OPCO/contrôle.
- **Assistance technique ET pédagogique** (D.6313-3-1 §1 = Qualiopi Ind.19) : canal de contact + **délais de réponse formalisés** + traçage des sollicitations (table de messages basique au MVP ; tuteur RAG = V1).
- **Information durée moyenne + activités** (D.6313-3-1 §2) affichée à l'apprenant (réutilise `dureeEstimeeMinutes`).
- **Évaluations jalonnantes/concluantes** (Ind.11 — non-conformité majeure si absente) : garantir qu'un parcours FOAD a au moins une éval (garde applicative).
- Conservation/rétention paramétrée (10 ans comptable, 6 ans fiscal/OPCO, 3-5 ans preuves, logs techniques 6 mois-1 an).

**Réutilisé :** `retention-purge-worker.ts` existant (étendre les politiques), modèle Qualiopi existant (`conformite.ts` garde-fous), `DocumentGenere`, emails Nodemailer pour les délais d'assistance.

**Hypothèses :** MVP = assistance via messagerie simple + emails (pas le tuteur IA). Politiques de rétention paramétrables.

**Risques :** zone à **haute exigence réglementaire** — le cadrage juridique (avec Will) peut allonger les allers-retours ; la garde « Ind.11 » et le calcul d'heures défendable sont critiques. Sous-estimer ici = non-conformité majeure → fourchette haute prudente.

---

### Récapitulatif MVP

| Lot                                                      | Fourchette (j/h)             |
| -------------------------------------------------------- | ---------------------------- |
| E1 Data model + migrations                               | 5 – 7                        |
| E2 Auth apprenant                                        | 6 – 9                        |
| E3 Octroi + import CSV                                   | 5 – 7                        |
| E4 Pipeline vidéo Stream + R2                            | 6 – 9                        |
| E5 Player + progression + déverrouillage                 | 9 – 13                       |
| E6 Moteur quiz + gating                                  | 8 – 11                       |
| E7 Certificat réalisation                                | 3 – 5                        |
| E8 Outil auteur minimal                                  | 7 – 10                       |
| E9 Section admin e-learning                              | 3 – 5                        |
| E10 Conformité FOAD transversale                         | 5 – 7                        |
| **Sous-total brut**                                      | **57 – 83**                  |
| **Réduction réutilisation (chevauchement déjà intégré)** | **−5 à −9**                  |
| **TOTAL MVP**                                            | **52 – 74** (médiane **62**) |

> - prévoir une **réserve de stabilisation/QA finale MVP** (E2E parcours complet, accessibilité, Web Vitals, recette conformité) : **+5 à +8 j/h** souvent comptés à part. Si inclus, MVP « prêt prod » = **~60-82 j/h**.

---

## 3. Phase V1 — détail par epic

### V1-E11 — Catalogue multi-cours + vitrine publique SEO (JSON-LD Course)

**Fourchette : 5 – 8 j/h.**

**Neuf :** catalogue public `/[locale]/formations-en-ligne/**` (ou intégré au catalogue existant), pages cours SEO, JSON-LD `Course`/`LearningResource`, filtres.

**Réutilisé (forte réduction) :** patterns SEO/JSON-LD existants (`lib/seo.ts`), ISR, charte, `pricing.ts` (SSOT prix). **Web Vitals stricts** sur pages publiques → vigilance budgets.

**Risques :** budgets Web Vitals sur pages publiques (LCP/CLS/First Load) — discipline imagerie + JS. FR-only (EN désactivé) → pas de surcoût i18n.

---

### V1-E12 — Outil auteur abouti (drag&drop complet, blocs riches, templates, clonage, aperçu as-student)

**Fourchette : 9 – 13 j/h.**

**Neuf :** drag&drop complet (réordonnancement intuitif, **alternative clavier WCAG 2.5.7**, cibles ≥ 24px WCAG 2.5.8), blocs riches mixés dans une leçon, templates de cours, clonage, **aperçu as-student fidèle**, transcodage média auto branché à l'upload.

**Réutilisé :** outil auteur minimal MVP (E8) comme socle, éditeur de blocs, upload Stream/R2.

**Risques (élevés) :** drag&drop **accessible** (EAA) = poste piégeux ; aperçu as-student fidèle (rendu identique apprenant) = duplication de rendu à éviter (factoriser avec le player). +2-3 j si l'éditeur de blocs doit être bâti.

---

### V1-E13 — Banque de questions + tirage aléatoire + tous types de questions

**Fourchette : 6 – 9 j/h.**

**Neuf :** banque de questions réutilisables, **tirage aléatoire N parmi M**, types restants (appariement, ordonnancement, upload, essai+correction manuelle riche), pondération avancée, feedback par tentative.

**Réutilisé :** moteur quiz MVP (E6), scoring serveur.

**Risques :** appariement/ordonnancement = UI + scoring + accessibilité (alternative au drag) → poste à risque. Tirage aléatoire + équité statistique.

---

### V1-E14 — Dashboard de pilotage + reporting/analytics (completion, temps, scores, exports conformité)

**Fourchette : 6 – 9 j/h.**

**Neuf :** dashboards (completion, temps passé, scores, cohortes), exports conformité (CSV/PDF), agrégations performantes.

**Réutilisé (forte réduction) :** `AdminPageShell`, `StatCard`, patterns dashboard existants (Observatoire IA, content-gen weekly-report), worker de reporting (`content-weekly-report-worker` comme modèle → `elearning-report-worker.ts`).

**Risques :** perf des agrégations sur `LessonProgress`/`QuizAttempt` (volumineux) → vues matérialisées/index. +1-2 j.

---

### V1-E15 — Relances automatiques anti-décrochage (Qualiopi Ind.12) + emails complets

**Fourchette : 4 – 6 j/h.**

**Neuf :** détection d'inactivité/décrochage, séquences de relance, emails dédiés.

**Réutilisé (forte réduction) :** BullMQ + crons (pattern `qualiopi-formation-crons-worker`, `booking-crons-worker`), `email-worker` + React Email templates, Nodemailer. → worker `elearning-relance-worker.ts`.

**Risques :** faible. Tuning des seuils de relance (éviter le spam) = métier.

---

### V1-E16 — Tuteur RAG (assistance pédagogique ancrée, Ind.19)

**Fourchette : 7 – 11 j/h.**

**Neuf :** tuteur conversationnel **ancré (RAG) avec citations**, scoping au contenu du cours, garde-fous anti-hallucination, traçage des échanges (preuve d'assistance Ind.19).

**Réutilisé (réduction majeure) :** infra **knowledge/RAG existante** (embeddings, retrieval, `@anthropic-ai/sdk`), patterns content-gen (grounding, citations, anti-hallucination), workers IA existants. → `elearning-tuteur-worker.ts` + service de retrieval scoped cours.

**Risques :** qualité du grounding scoped (éviter réponses hors cours), coût tokens (cost-cap déjà existant), latence. RAG dégradé sans Voyage (cf. mémoire). Conformité : c'est une **preuve d'assistance** → traçage obligatoire.

---

### V1-E17 — Paiement CB : activation Stripe + tunnel d'achat + commandes

**Fourchette : 5 – 8 j/h.**

**Neuf :** tunnel d'achat e-learning, modèle `Order` complet (octroi auto après paiement), pages panier/checkout.

**Réutilisé (réduction majeure) :** **infra Stripe complète existante** (`src/lib/stripe.ts`, webhook, `Invoice`/`Payment`/`Refund`/`StripeWebhookEvent`, flag `STRIPE_ENABLED` env.ts ~103-115). MVP a déjà posé `Order` minimal + octroi manuel (E3) → ici on branche le paiement. `pricing.ts` SSOT.

**Hypothèses :** Will fournit un compte Stripe + clés. Bascule `STRIPE_ENABLED=true`. TVA/facturation déjà gérées (Qualiopi).

**Risques :** réconciliation webhook → octroi (idempotence), TVA e-learning (régime), remboursements. Modéré grâce à l'infra existante.

---

### V1-E18 — Accès « pack entreprise » (N sièges, suivi par entreprise côté admin Axion-IA)

**Fourchette : 3 – 5 j/h.**

**Neuf :** notion de « pack N sièges » rattaché à un `Client`, consommation des sièges, vue admin par entreprise.

**Réutilisé :** `Client` (CRM), import CSV (E3), `ElearningCourse.ownerClientId` (déjà au data model).

**Hypothèses :** suivi **côté admin Axion-IA** (pas d'espace entreprise autonome — c'est V2). C'est le pont vers le multi-tenant.

**Risques :** faible. Ne pas anticiper le multi-tenant ici (rester sur octroi groupé).

---

### Récapitulatif V1

| Epic                                | Fourchette (j/h)             |
| ----------------------------------- | ---------------------------- |
| E11 Catalogue + vitrine SEO         | 5 – 8                        |
| E12 Outil auteur abouti (drag&drop) | 9 – 13                       |
| E13 Banque questions + tous types   | 6 – 9                        |
| E14 Dashboard + reporting           | 6 – 9                        |
| E15 Relances auto (Ind.12)          | 4 – 6                        |
| E16 Tuteur RAG (Ind.19)             | 7 – 11                       |
| E17 Paiement CB Stripe              | 5 – 8                        |
| E18 Pack entreprise                 | 3 – 5                        |
| **Sous-total brut**                 | **45 – 69**                  |
| **Réduction réutilisation**         | **−4 à −9**                  |
| **TOTAL V1**                        | **41 – 60** (médiane **50**) |

---

## 4. Phase V2 — détail par epic

### V2-E19 — Multi-tenant entreprise complet (espaces cloisonnés, admin délégué, branding, reporting org, SSO/SCIM)

**Fourchette : 14 – 22 j/h.** _(le plus lourd de tout le projet)_

**Neuf :** cloisonnement strict **par `tenant_id` sur TOUTES les requêtes** (le data model l'a prévu, ADR-0002, mais l'enforcement est massif), admin entreprise délégué (rôles entreprise), branding par client, reporting par organisation, **SSO (SAML/OIDC) + SCIM** (provisioning).

**Réutilisé :** `Client` (ancrage entreprise), `ownerClientId` déjà au schéma, RBAC existant (à étendre au monde entreprise).

**Risques (très élevés) :** la **fuite cross-tenant** est le risque de sécurité n°1 → audit systématique de chaque requête + tests adversariaux. SSO/SCIM = intégrations externes longues. C'est pourquoi cette feature est en V2 (ADR-0002). Fourchette large assumée.

---

### V2-E20 — CPF/EDOF activé (entrée effective, service fait, FranceConnect+)

**Fourchette : 8 – 13 j/h.**

**Neuf :** intégration EDOF derrière `EDOF_ENABLED` : entrée effective (1re connexion substantielle), suivi assiduité, service fait (~J+3 → paiement CDC), **FranceConnect+** obligatoire, conformité loi anti-fraude 2022-1587.

**Réutilisé :** preuves FOAD déjà produites au MVP (E10), faisceau de preuves, certificat.

**Hypothèses bloquantes :** **CPF impossible sans certification RNCP/RS** (dossier France Compétences, hors code, ADR-0003). Le code est « ready » ; l'activation dépend d'une autorisation. Spec EDOF/API CDC à obtenir.

**Risques (élevés) :** FranceConnect+ (homologation, sécurité), API EDOF mouvante, exigences anti-fraude (identité, anti-assistance lors des évals RNCP). Dépendances externes fortes → fourchette prudente.

---

### V2-E21 — IA pédagogique avancée (parcours adaptatifs, détection d'abandon, recommandations, quiz-gen)

**Fourchette : 7 – 11 j/h.**

**Neuf :** parcours adaptatifs, détection d'abandon prédictive, recommandations, **génération de quiz depuis le contenu** (document-grounded).

**Réutilisé (réduction majeure) :** Formation Engine IA existant (`qualiopi-formation-engine-worker.ts` : intention→structure→`evaluateQuality`→refine→content→`runAdversarialCritique`), `GrilleQualiteConfig`, `CacheIa`, infra RAG, `@anthropic-ai/sdk`, cost-cap. Le quiz-gen réutilise quasi tout le pipeline existant.

**Risques :** qualité pédagogique des quiz générés (validation humaine), coût tokens. Modéré grâce au moteur existant.

---

### V2-E22 — Standards (import SCORM/cmi5, émetteur xAPI/LRS) — si besoin commercial

**Fourchette : 5 – 8 j/h** _(conditionnel — ne faire que si appel d'offres l'exige)._

**Neuf :** import SCORM/cmi5, émetteur xAPI vers un LRS.

**Réutilisé (réduction forte) :** tracking interne **déjà modélisé sur la grammaire xAPI** (ADR-0006) → l'émetteur xAPI est surtout un mapping. Import SCORM = parsing + sandbox de lecture.

**Risques :** SCORM = format historique pénible (variantes 1.2/2004), sandbox iframe sécurisée. À ne déclencher que sur besoin réel.

---

### Récapitulatif V2

| Epic                                    | Fourchette (j/h)                                 |
| --------------------------------------- | ------------------------------------------------ |
| E19 Multi-tenant complet                | 14 – 22                                          |
| E20 CPF/EDOF activé                     | 8 – 13                                           |
| E21 IA pédagogique avancée              | 7 – 11                                           |
| E22 Standards SCORM/xAPI (conditionnel) | 5 – 8                                            |
| **Sous-total brut**                     | **34 – 54**                                      |
| **Réduction réutilisation**             | **0 à −2** _(V2 = surtout du neuf/intégrations)_ |
| **TOTAL V2**                            | **34 – 52** (médiane **42**)                     |

---

## 5. Hypothèses globales (conditions de validité du chiffrage)

1. **Dev senior familier du repo** (sinon +30-40 %, voir §0.1).
2. **Comptes externes fournis à temps** par Will : Cloudflare Stream (E4), Stripe (E17), EDOF/FranceConnect+/CDC (E20), certification RNCP/RS obtenue (préalable CPF). Tout retard = blocage, pas du dev.
3. **Migrations strictement additives** (ADR-0008) — aucune fenêtre de DROP, pas de drift schéma↔prod (leçon content-engine-v2).
4. **Contrat de build `stub.invalid` respecté** : pages e-learning derrière auth + `force-dynamic` → pas d'appel DB au SSG. Sinon early-exit explicite (coût marginal déjà compté).
5. **FR-only** (EN désactivé) → zéro surcoût i18n e-learning.
6. **`pricing.ts` SSOT** pour tout prix ; **Nodemailer maison** (pas de service emailing tiers).
7. **Contenu pédagogique et démarches juridiques hors charge dev** (§0.2).
8. **Pas de SCORM/xAPI au lancement** (ADR-0006) — E22 conditionnel.
9. **Cloisonnement code** sous `src/server/elearning/**`, `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, `src/components/(admin/)elearning/**`, workers `elearning-*-worker.ts` (ADR-0007).

---

## 6. Réduction par réutilisation — chiffrage de l'économie

La réutilisation de l'existant retire **~35-45 j/h** vs un LMS from scratch :

| Brique réutilisée                                                                              | Epics bénéficiaires | Économie estimée (j/h) |
| ---------------------------------------------------------------------------------------------- | ------------------- | ---------------------- |
| `PortailAcces` + `portail-service.ts` + `FormateurMagicLink` (magic-link, timing-safe, cookie) | E2                  | 4 – 6                  |
| `DocumentGenere` + QR + `@react-pdf/renderer` + templates Qualiopi                             | E7                  | 3 – 5                  |
| Console admin (`AdminPageShell`, `AdminTable`, RBAC `requireAdmin*`, `admin-nav.ts`)           | E8, E9, E14, E18    | 6 – 9                  |
| `src/lib/r2-storage.ts` (upload/signature)                                                     | E3, E4, E7          | 2 – 3                  |
| Infra Stripe complète (`stripe.ts`, webhook, `Invoice`/`Payment`/`Refund`, flag)               | E17                 | 4 – 6                  |
| BullMQ + `queues.ts` + `email-worker` + crons + React Email                                    | E3, E10, E15, E16   | 4 – 6                  |
| Infra knowledge/RAG + `@anthropic-ai/sdk` + cost-cap                                           | E16, E21            | 5 – 8                  |
| Formation Engine IA (`qualiopi-formation-engine-worker`, `GrilleQualiteConfig`, `CacheIa`)     | E21                 | 3 – 5                  |
| Modèles Qualiopi (conformité, rétention `retention-purge-worker`, `EvaluationAcquis` mapping)  | E10, E20            | 2 – 4                  |
| `Trainee`/`Enrollment`/`Client`/`Formation` (ancrage data model, dédup `citext`)               | E1, E3              | 2 – 3                  |
| **TOTAL économie**                                                                             |                     | **~35 – 55**           |

> Sans cette réutilisation, le périmètre complet serait dans la zone **~165-240 j/h**. C'est l'intégration au socle existant qui ramène à **~127-186 j/h**.

---

## 7. Risques d'estimation (synthèse — détail dans `04-risques-mitigations.md`)

| Risque                                                                               | Epics            | Impact (j/h) | Probabilité | Mitigation                                                          |
| ------------------------------------------------------------------------------------ | ---------------- | ------------ | ----------- | ------------------------------------------------------------------- |
| **INP/First Load du player vidéo** dépasse budget interne                            | E5               | +1 à +3      | Élevée      | Lazy-load hls.js, code-split, ADR d'exception budget (cf. `/appel`) |
| **Accessibilité WCAG 2.2 AA** (drag&drop, quiz, auth) sous-estimée (EAA obligatoire) | E5, E6, E12, E13 | +2 à +5      | Élevée      | Alternatives clavier dès le design, audit a11y dédié                |
| **Conformité FOAD** (Ind.11 majeur, heures défendables, faisceau preuves)            | E7, E10          | +2 à +4      | Moyenne     | Cadrage juridique tôt avec Will, garde applicative Ind.11           |
| **Transcodage/webhooks vidéo** (états async, watermark)                              | E4               | +1 à +3      | Moyenne     | POC Stream isolé en amont                                           |
| **Fuite cross-tenant** (multi-tenant)                                                | E19              | +3 à +6      | Élevée      | Scoping `tenant_id` systématique + tests adversariaux               |
| **Dépendances externes** (Stripe, EDOF, FranceConnect+, RNCP) en retard              | E17, E20         | bloquant     | Élevée      | Hors charge dev ; planifier les comptes en amont                    |
| **Scoring quiz polymorphe** (12 types, normalisation réponses courtes)               | E6, E13          | +1 à +3      | Moyenne     | Abstraction scoring par type, tests par type                        |
| **Drift schéma↔prod** (migrations)                                                   | E1               | +1 à +2      | Faible      | `migrate diff` discipliné, additif strict                           |
| **Ramp-up dev non familier du repo**                                                 | tous             | +30-40 %     | Variable    | Affecter un dev connaissant Axion-IA                                |

---

## 8. Scénarios de livraison (pour décider)

| Scénario         | Périmètre                                      | Charge (médiane)     | Délai indicatif (1 dev senior) |
| ---------------- | ---------------------------------------------- | -------------------- | ------------------------------ |
| **A — MVP seul** | Cours finançable OPCO/entreprise/vente directe | **62 j/h** (+5-8 QA) | ~13-15 semaines                |
| **B — MVP + V1** | + industrialisation, CB, tuteur RAG            | **112 j/h**          | ~24-26 semaines                |
| **C — Complet**  | + multi-tenant, CPF/EDOF, IA avancée           | **~154 j/h**         | ~33-36 semaines                |

> À **2 devs seniors** en parallèle (data model partagé d'abord, puis split backend/frontend), compter ~55-65 % du délai calendaire après le lot E1 (chemin critique). Le multi-tenant (E19) et l'EDOF (E20) restent peu parallélisables.

---

## Liens

- `01-phasage-mvp-v1-v2.md` — phasage MVP/V1/V2 (source de la séquence)
- `02-backlog-epics-stories.md` — backlog détaillé des epics/stories chiffrés ici
- `04-risques-mitigations.md` — registre des risques (détail du §7)
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR (auth, multi-tenant, CPF, Stripe, vidéo, standards, cloisonnement, migrations)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — schéma cœur (base de E1)
- `02-ARCHITECTURE/reutilisation-existant.md` — carte de réutilisation (base du §6)
- `08-CONFORMITE/01-foad-d6313-3-1.md`, `02-qualiopi-indicateurs-foad.md`, `03-cpf-edof-readiness.md` — base des charges E10/E20
