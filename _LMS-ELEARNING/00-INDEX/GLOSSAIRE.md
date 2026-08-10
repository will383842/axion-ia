# Glossaire — Plateforme LMS e-learning Axion-IA

> Référentiel unique des termes métier, techniques, pédagogiques et réglementaires du projet LMS.
> Chaque entrée donne : **définition courte** + **mapping** (modèle Prisma / fichier / route / réglementation) + statut **EXISTANT** (réutilisé tel quel ou étendu) ou **NEUF** (à construire).
>
> Conventions de lecture :
>
> - 🟢 **EXISTANT** = déjà dans le code (`schema.prisma`, `src/...`), réutilisé ou étendu (migration additive).
> - 🔵 **NEUF** = à construire sous `src/server/elearning/**` (ADR-LMS-0007).
> - Les noms de modèles/enums respectent `03-DATA-MODEL/01-schema-cours-modules-lecons.md`.
>
> Dernière mise à jour : 2026-06-27.

---

## Sommaire

1. [Cœur LMS (contenu)](#1-cœur-lms-contenu)
2. [Progression & tracking](#2-progression--tracking)
3. [Déverrouillage : drip & gating](#3-déverrouillage--drip--gating)
4. [Quiz & évaluation](#4-quiz--évaluation)
5. [Accès, comptes & authentification](#5-accès-comptes--authentification)
6. [Multi-tenant & entreprises](#6-multi-tenant--entreprises)
7. [Vidéo & médias](#7-vidéo--médias)
8. [E-commerce & financement](#8-e-commerce--financement)
9. [Certificats & attestations](#9-certificats--attestations)
10. [Réglementation FOAD / Qualiopi](#10-réglementation-foad--qualiopi)
11. [Certification, CPF, RNCP/RS, EDOF](#11-certification-cpf-rncprs-edof)
12. [Standards techniques (xAPI, SCORM, HLS…)](#12-standards-techniques)
13. [IA pédagogique](#13-ia-pédagogique)
14. [Plateforme & infra (rappel)](#14-plateforme--infra-rappel)
15. [Abréviations](#15-abréviations)
16. [Liens](#16-liens)

---

## 1. Cœur LMS (contenu)

### LMS (Learning Management System)

Système de gestion de l'apprentissage : plateforme qui héberge les cours, gère les apprenants, suit la progression et délivre les certificats. Ici **propriétaire** (pas Moodle/Teachable/360Learning). 🔵 NEUF.
→ Code sous `src/server/elearning/**`, admin sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`.

### FOAD (Formation Ouverte et À Distance)

Modalité de formation **asynchrone** à distance (auto-formation encadrée), par opposition au présentiel et au distanciel synchrone (live). C'est le cœur du LMS Axion-IA. Encadrée par l'art. **D.6313-3-1** du Code du travail (cf. §10). 🔵 NEUF (la modalité présentiel/distanciel synchrone existe déjà via `ModaliteFormation`).
→ `ElearningCourse.estFoad` (default `true`).

### Cours (Course)

Unité pédagogique vendable/octroyable (ex. « Maîtriser l'IA au quotidien »). Contient des modules. 🔵 NEUF.
→ `model ElearningCourse` (table `elearning_courses`) : `slug`, `titre`, `objectifs` (Json string[]), `prerequis`, `dureeEstimeeMinutes`, `statut` (`ElearningCourseStatut`), `version`, `seuilReussitePct` (default 70), `formationId?` (lien optionnel vers `Formation` existante), `ownerClientId?` (multi-tenant).

### Module (chapitre)

Regroupement ordonné de leçons dans un cours, **déverrouillable** indépendamment. 🔵 NEUF.
→ `model ElearningModule` (table `elearning_modules`) : `courseId`, `ordre` (unique par cours), `unlockType`, `unlockDate`, `unlockOffsetJours`, `unlockQuizId`, `unlockScorePct`.

### Leçon (Lesson)

Plus petite unité de contenu consommable. **Microlearning** : viser 2-10 min. Plusieurs types via `ElearningLessonType`. 🔵 NEUF.
→ `model ElearningLesson` (table `elearning_lessons`) : `moduleId`, `type`, `ordre`, `contenuJson` (blocs riches), `videoAssetId`, `pdfKey`, `quizId?`, `dureeEstimeeMinutes`, `obligatoire`, champs `unlock*` (granularité leçon).

### Type de leçon (`ElearningLessonType`)

Enum : `video` (Cloudflare Stream/Bunny), `texte` (blocs Tiptap/JSON), `pdf` (R2), `quiz` (pointe vers un `Quiz`), `embed` (intégration externe, ex. replay classe virtuelle), `devoir` (travail à rendre = upload apprenant, **preuve FOAD**). 🔵 NEUF.

### Ressource (Resource)

Média rattaché à une leçon (pdf, image, audio, fichier, sous-titres). Stockée sur R2. 🔵 NEUF.
→ `model ElearningResource` (table `elearning_resources`) : `lessonId`, `type`, `r2Key`, `mimeType`, `telechargeable`, `ordre`. Upload via `src/lib/r2-storage.ts`.

### Parcours (Learning path)

Suite ordonnée et déverrouillable de modules/leçons formant un itinéraire pédagogique cohérent. Au MVP = un cours ; le concept de « parcours multi-cours » est V1+. Synonyme courant de « cours » côté apprenant.

### Microlearning

Bonne pratique 2026 : leçons courtes (2-10 min) pour soutenir l'attention et la complétion. 🔵 NEUF (cible portée par `ElearningLesson.dureeEstimeeMinutes`).

### Brouillon / Publication / Archive (`ElearningCourseStatut`)

Cycle de vie d'un cours : `brouillon` (invisible apprenants, en édition), `publie` (visible/accessible), `archive` (retiré mais conservé pour preuves). La publication incrémente `ElearningCourse.version` et fixe `publishedAt`. 🔵 NEUF.

### Outil auteur (Course builder / authoring)

Interface admin drag&drop pour créer cours → modules → leçons, mixer des blocs, uploader des médias (transcodage auto), prévisualiser « as-student », passer brouillon→publié. 🔵 NEUF.
→ `src/app/[locale]/(admin)/[adminPrefix]/elearning/cours/...`, composants `src/components/admin/elearning/**`. Le drag&drop réécrit les `ordre` en transaction.

### Aperçu apprenant (preview as-student)

Mode de l'outil auteur permettant à l'auteur de voir le cours comme un apprenant (sans s'inscrire ni polluer les stats). 🔵 NEUF.

---

## 2. Progression & tracking

### Inscription e-learning (`ElearningEnrollment`)

Lien apprenant ↔ cours e-learning (octroi d'accès). À ne pas confondre avec `Enrollment` (stagiaire ↔ session présentielle/live, EXISTANT). 🔵 NEUF.
→ Détaillé dans `03-DATA-MODEL/02-schema-progression-tracking.md`. Porte la date d'octroi (base de calcul des `offset_inscription`), l'état d'avancement global et le score final.

### `Enrollment` (existant, présentiel/live)

🟢 EXISTANT. `model Enrollment` (table `enrollments`) : `sessionId` ↔ `traineeId`, `statut` (`EnrollmentStatut`), `tauxPresencePct`, `emargementSigneAt`. Sert le présentiel/distanciel synchrone. **Réutilisé comme déclencheur** d'octroi e-learning (session réalisée → accès FOAD), pas remplacé.

### Progression de leçon (`LessonProgress`)

État d'avancement d'un apprenant sur une leçon : démarrée / en cours / complétée, position de reprise vidéo (watch position), horodatages. 🔵 NEUF.
→ `model LessonProgress` (cf. doc 02) : `lessonId`, `enrollmentId`, `statut`, `watchPositionSec`, `completedAt`. Relation inverse `ElearningLesson.progress`.

### Complétion (Completion)

Fait qu'une leçon/module/cours soit considéré « terminé » selon des règles (vidéo vue ≥ seuil, quiz réussi, devoir rendu). Les leçons `obligatoire=true` comptent dans le calcul. Distincte de la simple « ouverture ». 🔵 NEUF.

### Reprise auto (Resume)

Best practice MUST-HAVE 2026 : l'apprenant reprend exactement où il s'était arrêté, **persisté côté serveur** (pas seulement localStorage). 🔵 NEUF.
→ `LessonProgress.watchPositionSec` + heartbeat (cf. ci-dessous).

### Heartbeat (battement)

Ping périodique du player vers le serveur (toutes les ~10-30 s) qui persiste la position de lecture et le temps réellement passé. Sert la reprise auto ET les **preuves d'assiduité FOAD**. ⚠️ Vigilance INP/Web Vitals (budget interne). 🔵 NEUF.
→ Server Action ou route handler dédié `src/app/[locale]/api/elearning/progress/...` (force-dynamic, derrière auth apprenant).

### Barre de progression (Progress bar)

Indicateur visuel du % d'avancement (cours/module). Best practice MUST-HAVE. 🔵 NEUF.

### Assiduité / temps de connexion

Mesure du temps réellement passé et de la régularité de connexion de l'apprenant. **Preuve FOAD** (faisceau de preuves R.6313-3) et, le jour venu, condition EDOF (suivi d'assiduité). 🔵 NEUF (modélisée via heartbeat + logs LMS).
→ Distincte du **relevé de connexion** synchrone existant (`ReleveConnexionImport` → `PresenceCreneau`, import Zoom/Teams/Meet) qui sert le distanciel **synchrone**.

### Faisceau de preuves (preuve libre)

Ensemble de traces démontrant la réalisation FOAD (évaluations + travaux rendus + logs LMS + traces d'accompagnement). Régi par **R.6313-3** : preuve libre, le relevé de connexion **seul est insuffisant**. 🔵 NEUF.
→ Exportable depuis l'admin e-learning ; conservation cf. §10.

### Drip (diffusion échelonnée)

Libération progressive du contenu dans le temps (pas tout d'un coup). 3 déclencheurs : **date fixe**, **offset J+N** après octroi, **complétion** de l'élément précédent. Distinct du gating par score. 🔵 NEUF.
→ `ElearningUnlockType` : `date_fixe`, `offset_inscription`, `apres_precedent`. Voir §3.

---

## 3. Déverrouillage : drip & gating

### `ElearningUnlockType` (enum)

Règle de déverrouillage d'un module ou d'une leçon. 🔵 NEUF.

- `immediat` : ouvert dès l'accès.
- `apres_precedent` : après complétion de l'élément précédent.
- `date_fixe` : à une date calendaire (`unlockDate`).
- `offset_inscription` : J+N après l'octroi d'accès (`unlockOffsetJours`).
- `score_quiz` : après réussite d'un quiz au seuil exigé (`unlockQuizId` + `unlockScorePct`) = **gating de compétence**.

### Gating (verrouillage conditionnel)

Bloquer l'accès à la suite tant qu'une condition n'est pas remplie. Le projet impose le **gating par score** (vraie note ≥ seuil), **pas** le gating « attempt-only » (avoir simplement tenté). 🔵 NEUF.
→ `unlockType = score_quiz` + `unlockScorePct`.

### Gating par score vs attempt-only

**Par score** : il faut une note ≥ seuil pour débloquer (exigé). **Attempt-only** : il suffit d'avoir tenté le quiz (à **éviter**, anti-pattern). 🔵 NEUF.

### Verrou affiché avec sa raison

UX obligatoire : un élément verrouillé doit montrer **pourquoi** (« disponible le 12/07 », « réussir le quiz du module 2 », « J+7 après votre inscription »). 🔵 NEUF.

### Override admin (déverrouillage manuel)

L'admin peut forcer le déverrouillage d'un module/leçon pour un apprenant donné (cas particulier, accessibilité, support). 🔵 NEUF.
→ Server Action admin + trace d'audit.

### Seuil de réussite (`seuilReussitePct`)

Score minimal pour valider. Niveau cours (certificat) = `ElearningCourse.seuilReussitePct` (default 70). Niveau gating module/leçon = `unlockScorePct`. 🔵 NEUF.
→ Cohérent avec l'existant `EvaluationAcquis.reussite` (« scorePct ≥ seuil_reussite_pct de la formation »).

---

## 4. Quiz & évaluation

### Quiz (moteur interactif)

Évaluation interactive avec correction, seuil, tentatives, feedback. **AUCUN moteur n'existe** aujourd'hui : `EvaluationAcquis` et `Questionnaire` ne font que **stocker des résultats**. 🔵 NEUF.
→ `model Quiz` (cf. `03-DATA-MODEL/03-schema-quiz-evaluations.md`). Une `ElearningLesson type=quiz` pointe via `quizId`.

### Question / Banque de questions

`model Question` rattachée à un quiz et/ou à une banque réutilisable. La **banque** permet le **tirage aléatoire N parmi M**. ~12 types visés : QCM mono, QCM multi, vrai/faux, appariement (matching), texte à trous (cloze), ordonnancement, réponse courte, essai (correction manuelle), upload… 🔵 NEUF.
→ `model Question`, `model QuestionBank` (cf. doc 03).

### Tentative (`QuizAttempt`)

Enregistrement d'un passage de quiz : réponses, score, date, durée (temps **serveur**), réussite. Plusieurs tentatives possibles selon config. 🔵 NEUF.
→ `model QuizAttempt` (cf. doc 03). C'est la **preuve d'évaluation FOAD** (Ind.11).

### Shuffle (randomisation)

Mélange de l'ordre des questions ET des réponses à chaque tentative. Mesure **anti-triche légère** (avec le temps serveur). 🔵 NEUF.

### Tirage aléatoire N parmi M

Sélectionner aléatoirement N questions dans une banque de M, par tentative. 🔵 NEUF.

### Feedback / Rationale

Feedback = retour configurable après réponse/quiz (immédiat, à la fin, jamais). Rationale = explication de la bonne réponse (pédagogie). 🔵 NEUF.

### Pondération (weighting)

Poids différencié des questions dans le score total. 🔵 NEUF.

### Anti-triche léger / Proctoring

**Léger** (retenu) = randomisation + temps serveur. **Proctoring** (surveillance à distance) réservé au **high-stakes** uniquement ; CNIL : proportionné, **optionnel**, avec alternative. Pas au MVP. 🔵 NEUF.

### `EvaluationAcquis` (existant)

🟢 EXISTANT. `model EvaluationAcquis` (table `evaluations_acquis`) : `scoreObtenu/scoreMax/scorePct`, `niveauGlobal`, `reussite`, `competences` (Json), rattaché à `enrollmentId` OU `coachingSessionId`. **Réutilisable** comme cible de persistance des résultats de quiz e-learning (lien objectif↔éval), à articuler avec `QuizAttempt`.

### `Questionnaire` (existant)

🟢 EXISTANT. `model Questionnaire` (table `questionnaires`) : `positionnement` / `satisfaction_chaud` / `satisfaction_froid`, `token` portail, `noteGlobale` /5. Sert la **satisfaction** Qualiopi (Ind.31⭐), **pas** l'évaluation des acquis. Réutilisé tel quel pour le positionnement d'entrée FOAD.

---

## 5. Accès, comptes & authentification

### Apprenant (Learner)

Personne qui suit un cours e-learning. Au MVP, modélisé sur le `Trainee` existant (étendu), pas un nouveau modèle « User ». 🟢/🔵.
→ `model Trainee` (table `trainees`) : PII, `situationHandicap`, `handicapDetailsChiffre` (AES-256-GCM via pii-crypto), consentements. **Pas de `passwordHash`** aujourd'hui → ajout nullable prévu (ADR-0001).

### Auth apprenant hybride (ADR-LMS-0001)

Système d'authentification **séparé de NextAuth** : magic-link par défaut + email/mot de passe **optionnel** (comptes entreprise). Cookie/middleware dédiés pour éviter toute régression admin. 🔵 NEUF.
→ `src/server/elearning/auth/**`. NextAuth reste réservé aux `AdminUser`.

### Magic-link (lien magique)

Authentification sans mot de passe : un lien à usage unique/temporaire envoyé par email ouvre une session. 🟢 EXISTANT (à étendre).
→ Pattern existant `PortailAcces` (token 64 hex, cookie HttpOnly 90 j) ; route `src/app/[locale]/portail/acces/[token]/route.ts`. Autre pattern existant : `FormateurMagicLink` (`src/server/formateur/magic-link.ts`, `createFormateurMagicLink`/`consumeFormateurMagicLink`).

### `PortailAcces` (existant)

🟢 EXISTANT. `model PortailAcces` (table `portail_acces`) : `traineeId`, `token` (VarChar(64) unique), `expiresAt`, `revoked`, `lastUsedAt`. Portail `/portail/mon-espace`, service `getEspaceStagiaire` (`src/server/qualiopi/portail/portail-service.ts`). **Socle réutilisé** de l'auth apprenant ; le LMS l'étend (mot de passe optionnel).

### `passwordHash` (optionnel, argon2id)

Champ **nullable** à ajouter sur l'apprenant pour les comptes entreprise voulant un login email/mot de passe. Hash **argon2id**. Migration additive (ADR-0008). 🔵 NEUF.

### Octroi d'accès (provisioning)

Action d'ouvrir l'accès d'un apprenant à un cours. 3 voies au MVP : **automatique** (session réalisée → e-learning), **manuel** (admin, 1 clic), **import CSV** (liste entreprise). 🔵 NEUF.
→ Server Actions `src/server/elearning/access/**`, admin `.../elearning/acces/...`.

### Import en masse (bulk / CSV)

Création/octroi d'accès pour une liste d'apprenants (typiquement une équipe entreprise) via fichier CSV. Remplace le multi-tenant au MVP (ADR-0002). 🔵 NEUF.
→ Worker possible `elearning-import-worker.ts` ; upload via `getSignedUploadUrlR2`.

### RBAC (Role-Based Access Control)

Contrôle d'accès admin par rôle. 🟢 EXISTANT, réutilisé pour la console e-learning.
→ `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`), rôles `super_admin` / `admin` / `editor` / `reader`.

### `AdminUser` vs apprenant

`AdminUser` = équipe Axion-IA, géré par **NextAuth v5 + 2FA**. Apprenant = `Trainee` étendu, géré par l'**auth apprenant séparée**. Deux mondes étanches (ADR-0001). 🟢 + 🔵.

---

## 6. Multi-tenant & entreprises

### Multi-tenant

Architecture où plusieurs organisations (« tenants ») ont des espaces **cloisonnés** : chaque requête est filtrée par `tenant_id`, admin entreprise délégué, branding par client. **Conçu maintenant, livré en V2** (ADR-0002). 🔵 NEUF (V2).
→ Amorce data model : `ElearningCourse.ownerClientId` (null = catalogue global, sinon réservé à un `Client`).

### `Client` (CRM, existant) ≠ tenant

🟢 EXISTANT. `model Client` = CRM entreprise (SIRET, OPCO, prospect, devis). **N'est PAS** un multi-tenant : aucune donnée n'est cloisonnée par entreprise aujourd'hui (ADR-0002). Sert de **clé d'appartenance entreprise** en attendant le vrai cloisonnement V2.

### Pack entreprise (sièges / seats)

Lot de N accès vendu à une entreprise. Au MVP : Axion-IA ouvre les accès en masse (CSV) et suit côté admin ; en V2 l'entreprise gère ses équipes elle-même. 🔵 NEUF (V1 partiel / V2).

### Admin entreprise délégué

Utilisateur côté client autorisé à gérer les apprenants de **son** organisation. V2 uniquement. 🔵 NEUF (V2).

### SSO / SCIM

SSO = authentification unique entreprise (ex. SAML/OIDC). SCIM = provisioning/déprovisioning automatique des comptes. V2 (multi-tenant). 🔵 NEUF (V2).

---

## 7. Vidéo & médias

### Cloudflare Stream

Service de **streaming vidéo** retenu par défaut (déjà chez Cloudflare) : encodage + HLS adaptatif + bande passante inclus, ~6× moins cher que Mux (ADR-0005). La vidéo **ne passe pas** par R2. 🔵 NEUF.
→ `ElearningLesson.videoAssetId` (id de l'asset Stream), pipeline `04-BACKEND/07-pipeline-video-streaming.md`.

### Bunny Stream

Alternative UE à Cloudflare Stream si la **résidence des données en UE** (RGPD) devient prioritaire (ADR-0005). 🔵 NEUF (option).

### HLS (HTTP Live Streaming)

Protocole de streaming **adaptatif** : la vidéo est découpée en segments et la qualité s'ajuste au débit/écran (essentiel mobile). 🔵 NEUF (fourni par Stream/Bunny).

### URL signée (signed URL)

Lien temporaire et restreint pour accéder à un média sans l'exposer publiquement. 🟢 EXISTANT (pour R2) / 🔵 NEUF (pour la vidéo Stream).
→ R2 : `getSignedUrlR2` / `getSignedUploadUrlR2` (`src/lib/r2-storage.ts`). Vidéo : URL/token signés Cloudflare Stream.

### Watermark dynamique

Filigrane par utilisateur incrusté sur la vidéo (dissuasion de partage), plus léger que le DRM. Réservé au contenu à valeur. ⚠️ ne pas confondre avec le filigrane « COPIE » des PDF (`DocumentGenere.estCopie`). 🔵 NEUF.

### DRM (Digital Rights Management)

Protection forte du contenu. **Sur-DRM = anti-pattern** : justifié seulement pour du premium à forte valeur (ADR-0005). MVP = URLs signées + watermark.

### Sous-titres (captions / WCAG)

Sous-titres synchronisés (.vtt) obligatoires pour l'accessibilité (WCAG 2.2 AA). 🔵 NEUF.
→ `ElearningResource.type = "sous_titres"` (R2).

### R2 (Cloudflare R2)

Stockage objet S3-compatible. **Stocke** (PDF, images, fichiers, sous-titres) mais **ne streame pas**. 🟢 EXISTANT.
→ `src/lib/r2-storage.ts` : `uploadToR2`, `getSignedUrlR2`, `getSignedUploadUrlR2`, `existsInR2`, `deleteFromR2`, `getObjectBufferR2`, `isR2Configured`. Pas d'API de streaming → la vidéo va sur Stream/Bunny.

### Transcodage auto

Conversion automatique d'un média uploadé en formats/qualités diffusables (HLS). Géré par Cloudflare Stream après upload. 🔵 NEUF.

---

## 8. E-commerce & financement

### Stripe (gardé éteint)

Infra de paiement CB **complète mais neutralisée** (`STRIPE_ENABLED=false`). MVP = **virement + octroi manuel** ; activation V1 sans refonte (ADR-0004). 🟢 EXISTANT (éteint).
→ `src/lib/stripe.ts`, flag `src/env.ts` (~103-115), modèles `Invoice` / `Payment` / `Refund` / `StripeWebhookEvent`.

### Commande e-learning (`Order`)

Modèle de commande qui **sait octroyer l'accès** à un cours, indépendamment du paiement CB (éteint au MVP). 🔵 NEUF.
→ `03-DATA-MODEL/05-schema-ecommerce-commandes.md`.

### `pricing.ts` (SSOT)

Source unique de vérité des prix. À réutiliser pour tout tarif e-learning (pas de prix codés en dur ailleurs). 🟢 EXISTANT.

### OPCO (Opérateur de Compétences)

Organisme qui finance la formation des entreprises. Finance **100 %** de l'asynchrone si les 3 conditions FOAD sont remplies ; pour payer il exige facture + relevé de dépenses + **certificat de réalisation** ; en contrôle peut réclamer les pièces FOAD. 🟢 EXISTANT (gestion financement Qualiopi).
→ `model Client` (OPCO), `FactureFormation` (subrogation), `FactureFormationDestinataire.opco`.

### Subrogation

Mécanisme où l'OPCO paie **directement** l'organisme (au lieu de rembourser l'entreprise), via convention tripartite. 🟢 EXISTANT.
→ Géré dans le bloc financement Qualiopi (`FactureFormation`).

### Facture de formation (`FactureFormation`)

🟢 EXISTANT. Facture OF distincte de `Invoice` (booking générique). **TVA exonérée** (261-4-4° CGI). `FactureFormationDestinataire` { entreprise, opco, stagiaire, france_travail }, `FactureFormationStatut` { brouillon, emise, payee, annulee }. Réutilisée pour facturer un cours e-learning (vente directe / OPCO).

### France Travail (AIF / POEI / CSP)

Dispositifs de financement public (ex-Pôle emploi). 🟢 EXISTANT.
→ `enum FranceTravailDispositif { aif, poei, csp }`, `FactureFormationDestinataire.france_travail`.

### Reste à charge

Part non financée, à la charge de l'apprenant/entreprise (fréquent en CPF). 🟢 EXISTANT (mentionné T11 financements).

---

## 9. Certificats & attestations

### Certificat de réalisation

**Document officiel obligatoire** (modèle réglementaire depuis le 01/06/2020) attestant des **heures réalisées**. Exigé par l'OPCO pour payer. ≠ certification (cf. §11). 🔵 NEUF (e-learning) en réutilisant l'infra documentaire existante.
→ `DocumentGenere` (type dédié) + `@react-pdf/renderer` + QR. Heures en centièmes (cohérent R.6313-3).

### Attestation de fin de formation (D.6353-1)

Atteste la réalisation et, le cas échéant, les acquis. 🟢 EXISTANT (Qualiopi).
→ `DocumentGenere`.

### Certificat ≠ Certification (point clef)

**Certificat de réalisation** = preuve administrative d'heures suivies (toujours produit). **Certification** = titre/diplôme reconnu (RNCP/RS) délivré après évaluation certifiante — **condition du CPF** (cf. §11). Un e-learning peut produire un certificat de réalisation **sans** être certifiant. 🔵/🟢.

### `DocumentGenere` (existant)

🟢 EXISTANT. `model DocumentGenere` (table `documents_generes`) : `type` (`DocumentType`), `numero` unique, `pdfUrl` (R2 signé), `hashSha256`, `estCopie` (filigrane COPIE), `qrToken` (vérif publique `timingSafeEqual`), `suppressionPrevueAt` (rétention), `fichierOriginalPath` (archive de l'original). **Réutilisé** pour les certificats e-learning (pas de nouveau système PDF).

### QR / qrToken (vérification publique)

Token de vérification d'authenticité d'un document (scan QR → page publique). 🟢 EXISTANT.
→ `DocumentGenere.qrToken` (+ `qrTokenCreatedAt`), comparaison `timingSafeEqual`.

### Badge

Reconnaissance visuelle (gamification opt-in). **V2**, à concevoir avec soin (éviter classements imposés). 🔵 NEUF (V2).

---

## 10. Réglementation FOAD / Qualiopi

### D.6313-3-1 (3 conditions cumulatives FOAD)

Article du Code du travail définissant la FOAD finançable. **3 conditions** :

1. **Assistance technique ET pédagogique** accessible (tutorat, délais formalisés) → Qualiopi **Ind.19** (seule obligation FOAD nommée).
2. **Information** sur les activités + **durée moyenne**.
3. **Évaluations** qui jalonnent/concluent → Qualiopi **Ind.11** (absence = **non-conformité MAJEURE**).
   → Mapping : (1) tuteur/assistance + délais ; (2) `ElearningCourse.dureeEstimeeMinutes` + descriptions ; (3) moteur quiz/`QuizAttempt`/`devoir`.

### R.6313-3 (preuve libre)

La réalisation FOAD se prouve par tout moyen (**faisceau de preuves**) ; **pas d'émargement obligatoire** mais le relevé de connexion **seul est insuffisant**. → évaluations + travaux + logs LMS + traces d'accompagnement. 🔵 NEUF (traçabilité).

### Qualiopi

Certification qualité obligatoire des organismes de formation (Axion-IA est certifié). Référentiel National Qualité (RNQ). 🟢 EXISTANT.

### Indicateurs FOAD (Qualiopi V8, 23/11/2023)

Indicateurs concernés par la FOAD : **1, 6, 9, 10, 11 (majeur), 12, 17, 19**. Clés pour le LMS : **Ind.11** (évaluations jalonnantes), **Ind.19** (assistance technique+pédagogique), **Ind.12** (anti-décrochage / relances). 🟢 EXISTANT (suivi indicateurs) + 🔵 (preuves produites par le LMS).

### Ind.11 (évaluations)

Évaluations qui jalonnent et concluent la formation. **Non-conformité MAJEURE** si absente en FOAD. 🔵 NEUF (moteur quiz + devoirs).

### Ind.19 (assistance FOAD)

Modalités d'assistance technique ET pédagogique des apprenants à distance (tutorat, délais de réponse formalisés). Seule obligation explicitement « FOAD » du référentiel. 🔵 NEUF (tuteur + délais + traces).

### Ind.12 (anti-décrochage)

Mesures pour prévenir les abandons (relances, accompagnement). 🔵 NEUF (relances auto V1).
→ Worker possible `elearning-relance-worker.ts` + emails Nodemailer.

### Conservation des preuves (rétentions)

- **Comptable** : 10 ans (L.123-22 C. com.).
- **Fiscal / OPCO** : 6 ans (L.102B LPF).
- **Preuves de réalisation** : 3-5 ans (L.6362-6).
- **Logs techniques** : 6 mois-1 an (CNIL délib. 2021-122).
  → Réutilise `DocumentGenere.suppressionPrevueAt` ; politique de purge par worker/cron. 🟢 + 🔵.

### Émargement (pourquoi pas en FOAD)

Feuille de présence signée du présentiel/synchrone. **Pas obligatoire en FOAD** (R.6313-3) → remplacé par le faisceau de preuves. 🟢 EXISTANT (présentiel : `Enrollment.emargementSigneAt`).

### Relevé de connexion (synchrone) ≠ logs LMS

🟢 EXISTANT. `ReleveConnexionImport` → `PresenceCreneau` (import Zoom/Teams/Meet) prouve la présence en **distanciel synchrone**. Les **logs LMS** (heartbeat, complétions) prouvent l'**asynchrone**. Ne pas confondre.

---

## 11. Certification, CPF, RNCP/RS, EDOF

### CPF (Compte Personnel de Formation)

Droits formation mobilisables par l'actif. **Éligibilité CPF = formation certifiante uniquement** (RNCP ou RS). Un e-learning non certifiant **n'est PAS éligible CPF** — ce n'est pas la modalité qui bloque, c'est l'absence de certification (ADR-0003). 🔵 NEUF (gated, V2).

### RNCP (Répertoire National des Certifications Professionnelles)

Répertoire des certifications à visée **métier/qualification** (France Compétences). 🔵 (dossier hors code).

### RS (Répertoire Spécifique)

Répertoire des certifications/habilitations **complémentaires** (compétences ciblées). 🔵 (dossier hors code).

### France Compétences

Autorité nationale qui régule la certification professionnelle et enregistre RNCP/RS. L'obtention d'une certification est un **dossier long, indépendant du code** (ADR-0003). 🔵.
→ Documenté dans `08-CONFORMITE/04-dossier-certification-rncp-rs.md`.

### Certification-ready

Le LMS produit **dès le MVP** toutes les preuves exigées (assiduité, progression, évaluations, certificat de réalisation, traces d'assistance) → finançable OPCO/entreprise/vente directe immédiatement ; le CPF/EDOF s'active ensuite par flag (ADR-0003). 🔵 NEUF.

### EDOF (Espace Des Organismes de Formation)

Plateforme de la Caisse des Dépôts pour gérer les formations CPF. Intégration **derrière flag** `EDOF_ENABLED` (default false) — activable après certification RNCP/RS. 🔵 NEUF (V2).
→ `08-CONFORMITE/03-cpf-edof-readiness.md`.

### Entrée effective (EDOF)

1re connexion **réelle et substantielle** de l'apprenant = point de départ du suivi (≠ simple octroi). Condition EDOF. 🔵 NEUF (V2).

### Service fait (EDOF)

Déclaration que la prestation a été réalisée → déclenche le paiement de la Caisse des Dépôts (~3 j déclaration, 30 j paiement). 🔵 NEUF (V2).

### FranceConnect+

Authentification renforcée obligatoire pour les actions CPF côté apprenant (loi anti-fraude **2022-1587**). 🔵 NEUF (V2).

### Évaluation certifiante à distance

Pour RNCP/RS : évaluation à distance **autorisée** si garantie d'identité + anti-fraude + absence d'assistance. Proctoring **non obligatoire** (CNIL : proportionné, optionnel, alternative requise). 🔵 NEUF (V2).

---

## 12. Standards techniques

> ADR-LMS-0006 : **pas de SCORM/xAPI/LTI au lancement** (contenu 100 % natif), mais tracking modélisé sur la grammaire xAPI pour rester future-proof.

### xAPI (Experience API / Tin Can)

Standard de tracking d'apprentissage sous forme de phrases **acteur-verbe-objet** (« learner — completed — lesson »). On **n'émet pas** de xAPI au lancement, mais on **modélise le tracking interne** sur cette grammaire (verbe/objet) pour pouvoir exporter plus tard. 🔵 NEUF (modélisation interne seulement).

### LRS (Learning Record Store)

Base de données qui reçoit/stocke les énoncés xAPI. Pas au lancement (V2+ si besoin). 🔵.

### SCORM / cmi5

Standards d'empaquetage et d'échange de contenu entre LMS. **Pas nécessaires** pour lancer (contenu natif) ; import SCORM/cmi5 seulement si besoin commercial concret (V2+). 🔵.

### LTI (Learning Tools Interoperability)

Standard d'intégration d'outils tiers dans un LMS. Hors périmètre lancement. 🔵.

### Tiptap

Éditeur de contenu riche (blocs JSON) envisagé pour les leçons `texte`. 🔵 NEUF.
→ `ElearningLesson.contenuJson`.

### Force-dynamic

Directive Next.js désactivant le rendu statique d'une page (rendu à chaque requête). Les pages e-learning sont **derrière auth + force-dynamic** → non concernées par le contrat de build `stub.invalid`. 🔵 NEUF.

### Web Vitals (LCP / INP / CLS)

Budgets perf internes stricts (LCP ≤ 1800 ms, INP ≤ 100 ms, CLS = 0). **Risque INP** sur le player vidéo et le calendrier. 🟢 EXISTANT (gate `pnpm lhci`) → à respecter côté apprenant.

### WCAG 2.2 AA / EAA

Accessibilité **obligation légale UE** (European Accessibility Act, depuis 28/06/2025). Critères clefs LMS : 2.4.11 (focus non masqué), 2.5.7 (alternative au drag), 2.5.8 (cible ≥ 24px), 3.3.8 (authentification accessible) + sous-titres, clavier, focus, contraste. 🔵 NEUF (exigence transversale).

---

## 13. IA pédagogique

### Quiz-gen (génération de quiz par IA)

Génération de questions à partir du contenu d'une leçon/cours (document-grounded). 🔵 NEUF.
→ Réutilise `@anthropic-ai/sdk` ; worker `elearning-quiz-gen-worker.ts` possible.

### Tuteur RAG (assistant pédagogique)

Assistant conversationnel **ancré** (Retrieval-Augmented Generation) qui répond avec **citations** depuis le contenu du cours / la knowledge base — pas un wrapper ChatGPT nu. Sert l'assistance pédagogique **Ind.19**. 🔵 NEUF.
→ Réutilise l'infra **knowledge/RAG existante** (embeddings, `chatbot-ingest-worker.ts`, `embeddings-backfill-worker.ts`).

### RAG (Retrieval-Augmented Generation)

Technique : récupérer des passages pertinents puis générer une réponse ancrée sur ces sources (réduit l'hallucination). 🟢 EXISTANT (infra knowledge) → réutilisée.

### Document-grounded authoring

Aide à la rédaction de contenu de cours ancrée sur des documents source fournis (anti-hallucination). 🔵 NEUF (V1+).

### Formation Engine (existant)

🟢 EXISTANT. Pipeline IA de génération pédagogique Qualiopi : `statutGeneration` → intention → structure → `evaluateQuality` → refine → content → `FileValidation` → assemble, avec `GrilleQualiteConfig`, `CacheIa`, `runAdversarialCritique`.
→ `qualiopi-formation-engine-worker.ts`, modèles `FormationGenerationJob`, `GrilleQualiteConfig`, `CacheIa`. **Modèle à réutiliser/adapter** pour le quiz-gen et l'authoring assisté (mêmes patterns critique adversariale + grille qualité).

### Anti-patterns IA (à éviter)

Avatars IA maison, wrapper ChatGPT nu (sans ancrage/citations), génération non vérifiée. 🔵.

---

## 14. Plateforme & infra (rappel)

### `stub.invalid` (contrat de build)

Magic string injectée au build GH Actions : `prisma.ts`/`redis.ts` court-circuitent toutes les requêtes (build sans DB/Redis). Les pages e-learning étant **derrière auth + force-dynamic**, elles ne sont pas pré-rendues au build → **OK** (ADR plateforme 0026). 🟢 EXISTANT (à respecter).

### BullMQ

File de jobs Redis. Les traitements lourds e-learning (import CSV, transcodage callback, quiz-gen, relances) passent par des **workers** `elearning-*-worker.ts`. 🟢 EXISTANT (infra) / 🔵 (workers e-learning).
→ Pattern de nommage existant : `src/server/queue/workers/<domaine>-*-worker.ts` (ex. `image-bank-import-worker.ts`, `email-worker.ts`).

### Nodemailer + React Email

Envoi d'emails maison (pas de service tiers) + templates React. Réutilisés pour les emails e-learning (octroi d'accès, magic-link, relances, certificat). 🟢 EXISTANT.
→ `email-worker.ts`, templates `qualiopi-*.tsx` (modèle).

### Server Action

Mode d'appel serveur par défaut du repo (pas de REST par défaut). Les mutations e-learning sont des Server Actions sous `src/server/actions/elearning/**`. 🟢 EXISTANT (convention).

### `AdminPageShell` / `admin-nav.ts`

Briques UI admin + navigation (RBAC). La section e-learning s'ajoute ici. ⚠️ Le composant sidebar réellement monté est **`AdminSidebarNav.tsx`** (pas `AdminSidebar.tsx`). 🟢 EXISTANT.
→ `src/lib/admin-nav.ts`, composants `src/components/admin/ui/*`.

### Migration additive (ADR-LMS-0008)

Toute migration LMS = CREATE TABLE / ADD COLUMN **nullable**, jamais de DROP (prod live + build stub). 🟢 EXISTANT (contrat) → impératif.

### `ModaliteFormation` (existant)

🟢 EXISTANT. `enum { presentiel, distanciel, hybride }` sur `Formation` + `TrainingSession`. Décrit le synchrone. La FOAD asynchrone est portée par le LMS (`ElearningCourse.estFoad`), pas par cet enum.

---

## 15. Abréviations

| Sigle                | Signification                                                                  |
| -------------------- | ------------------------------------------------------------------------------ |
| **LMS**              | Learning Management System                                                     |
| **FOAD**             | Formation Ouverte et À Distance (asynchrone)                                   |
| **OF**               | Organisme de Formation                                                         |
| **NDA**              | Numéro de Déclaration d'Activité (DREETS)                                      |
| **CPF**              | Compte Personnel de Formation                                                  |
| **RNCP**             | Répertoire National des Certifications Professionnelles                        |
| **RS**               | Répertoire Spécifique                                                          |
| **EDOF**             | Espace Des Organismes de Formation (Caisse des Dépôts)                         |
| **OPCO**             | Opérateur de Compétences                                                       |
| **RAG**              | Retrieval-Augmented Generation                                                 |
| **HLS**              | HTTP Live Streaming                                                            |
| **DRM**              | Digital Rights Management                                                      |
| **xAPI**             | Experience API (Tin Can)                                                       |
| **LRS**              | Learning Record Store                                                          |
| **SCORM**            | Sharable Content Object Reference Model                                        |
| **LTI**              | Learning Tools Interoperability                                                |
| **RBAC**             | Role-Based Access Control                                                      |
| **SSO**              | Single Sign-On                                                                 |
| **SCIM**             | System for Cross-domain Identity Management                                    |
| **WCAG**             | Web Content Accessibility Guidelines                                           |
| **EAA**              | European Accessibility Act                                                     |
| **LCP / INP / CLS**  | Largest Contentful Paint / Interaction to Next Paint / Cumulative Layout Shift |
| **R2**               | Cloudflare R2 (stockage objet S3-compatible)                                   |
| **PII**              | Personally Identifiable Information                                            |
| **SSOT**             | Single Source Of Truth                                                         |
| **ADR**              | Architecture Decision Record                                                   |
| **AIF / POEI / CSP** | Dispositifs de financement France Travail                                      |

---

## 16. Liens

- `00-INDEX/README.md` — index maître du dossier.
- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-LMS-0001 à 0008 (décisions figées).
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse` / `Module` / `Lesson` / `Resource`, enums.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, heartbeat (à rédiger).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`, `Question`, `QuizAttempt`, banque (à rédiger).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — auth apprenant, `passwordHash` (à rédiger).
- `02-ARCHITECTURE/reutilisation-existant.md` — carte EXISTANT vs NEUF (à rédiger).
- `08-CONFORMITE/01-foad-d6313-3-1.md` & `02-qualiopi-indicateurs-foad.md` — conformité FOAD (à rédiger).
- `08-CONFORMITE/03-cpf-edof-readiness.md` & `04-dossier-certification-rncp-rs.md` — CPF/RNCP/EDOF (à rédiger).
- `11-ROADMAP/01-phasage-mvp-v1-v2.md` — phasage MVP/V1/V2.

> Toute nouvelle notion introduite dans un doc de détail doit être ajoutée ici (le glossaire est la SSOT terminologique du projet).
