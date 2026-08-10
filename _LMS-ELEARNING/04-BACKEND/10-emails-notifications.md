# Backend — Emails & notifications e-learning

> Spécification **complète et implémentable** des emails transactionnels et notifications du LMS : invitation/accès, bienvenue, rappel d'inactivité, module débloqué, quiz à repasser, certificat disponible, fin d'accès — plus les emails d'authentification apprenant (magic-login, reset/définition mot de passe).
>
> **Principe directeur** : on **réutilise intégralement l'infra email existante** (Nodemailer maison + React Email + BullMQ + RFC 8058) — **zéro nouvelle dépendance d'envoi** (pas de Resend/SendGrid/Brevo, interdits par doctrine, cf. `src/lib/email/client.ts:7`). On **ajoute** des templates React Email cloisonnés, un service de déclenchement dédié, des crons, et un **journal de notifications** qui sert de **preuve d'accompagnement FOAD** (Qualiopi **Ind.19**, R.6313-3 faisceau de preuves).
>
> Conventions respectées : ADR-LMS-0007 (cloisonnement `src/server/elearning/**`), ADR-LMS-0008 (migrations additives), build `stub.invalid` (services stub-aware + `force-dynamic`), FR canonique (EN désactivé mais payloads bilingues conservés par cohérence avec l'existant).

---

## 0. TL;DR pour un dev senior

- **Infra réutilisée telle quelle** : `sendEmail` (`src/lib/email/client.ts`), `EmailLayout` (`src/lib/email/templates/_layout.tsx`), le **router de templates** (`src/lib/email/templates/index.tsx`), la **queue `emails`** + `enqueueEmail()` (`src/server/queue/queues.ts:605`), le **worker** (`src/server/queue/workers/email-worker.ts`), les **headers RFC 8058** (`List-Unsubscribe`).
- **Neuf** : 10 templates React Email sous `src/lib/email/templates/elearning-*.tsx`, 10 entrées dans `EmailJobName` (`src/server/queue/types.ts`) + le router, **un service de notifications** `src/server/elearning/notifications/elearning-notifications-service.ts` (calqué sur `src/server/qualiopi/notifications/notifications-service.ts`), **un cron** `elearning-relance-worker.ts` (anti-décrochage Ind.12), des **déclencheurs event-driven** depuis les services de progression/octroi, et **un modèle additif `ElearningNotificationLog`** (preuve d'accompagnement durable).
- **Déclenchement** : `enqueueEmail(template, to, "fr", payload, { jobId })` — **jamais** d'appel `sendEmail` synchrone depuis un Server Action (timeout requête, cf. `client.ts:17-19`). Le `jobId` fixe garantit l'**idempotence** (un seul mail par évènement, même si le cron re-scanne).
- **Consentement** : ne **jamais** envoyer un email de relance marketing/engagement sans vérifier `Trainee.consentementEmail` (`schema.prisma:5274`). Les emails **transactionnels** (invitation, reset, certificat, fin d'accès) sont **exemptés** (légitimes, liés à l'exécution du service) ; les **relances d'inactivité** sont à la frontière → on respecte `consentementEmail` + lien de désabonnement.
- **Preuve FOAD** : chaque notification envoyée est **persistée** dans `ElearningNotificationLog` (durable en Postgres, contrairement aux jobs BullMQ purgés au bout de 1000/5000, cf. `email-worker.ts:58-59`). Ce journal alimente les **exports de conformité** (assistance/accompagnement, Ind.19).

---

## 1. EXISTANT réutilisé (vérifié dans le code)

| Brique                                                                                                    | Emplacement                                                              | Rôle ici                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sendEmail({to, subject, html, text, marketing?, unsubscribeToken?})`                                     | `src/lib/email/client.ts:72`                                             | Envoi SMTP localhost:2525 (Mailhog dev / PowerMTA prod). Sanitize `From`, ajoute `List-Unsubscribe` si `unsubscribeToken`. **Ne pas modifier.**                    |
| `EmailLayout` + `emailStyles`                                                                             | `src/lib/email/templates/_layout.tsx:152`                                | Wrapper bulletproof Outlook + dark-mode-safe + footer légal SAS (env `COMPANY_*`). **Tous** les templates e-learning l'utilisent (cohérence visuelle).             |
| `renderEmailTemplate(name, locale, payload)` + `TEMPLATES` map                                            | `src/lib/email/templates/index.tsx:124,327`                              | Router subject + composant → `{subject, html, text}`. On **ajoute** nos 10 entrées.                                                                                |
| `EmailJobName` / `EmailJobData`                                                                           | `src/server/queue/types.ts:12,90`                                        | Union des noms de templates. On **étend** l'union.                                                                                                                 |
| `enqueueEmail(template, to, locale, payload, options)`                                                    | `src/server/queue/queues.ts:605`                                         | Producteur typé, no-op si `BULLMQ_DISABLED`/stub. `options.delayMs` / `options.jobId` / `options.marketing`. **Réutilisé tel quel.**                               |
| `emailsQueue` + worker                                                                                    | `src/server/queue/queues.ts:48`, `workers/email-worker.ts`               | Queue `emails`, concurrency 8, retry exponentiel ×5, Sentry capture, RFC 8058 auto. **Réutilisé tel quel.**                                                        |
| `bootRepeatableJobs()`                                                                                    | `src/server/queue/queues.ts:639`                                         | Boot des crons BullMQ repeatable (idempotent via `removeRepeatable`). On **y ajoute** le cron e-learning.                                                          |
| Pattern service de notif Qualiopi                                                                         | `src/server/qualiopi/notifications/notifications-service.ts`             | **Modèle de référence** à copier : `isStub()`, `fmtDate()`, `dateKey()`, `getOrCreatePortailLien()`, jobId idempotent par entité, fail-soft par destinataire.      |
| `getOrCreatePortailLien(traineeId, baseUrl)`                                                              | `notifications-service.ts:58`                                            | Réutilise un `PortailAcces` valide ou `creerAcces()` → `${baseUrl}/fr/portail/acces/${token}`. **À factoriser/réutiliser** pour les liens « accéder à mon cours ». |
| `creerAcces` / `verifierToken`                                                                            | `src/server/qualiopi/portail/portail-service.ts:110,142`                 | Tokens portail 90 j, stub-aware. Source des liens magiques d'accès.                                                                                                |
| RFC 8058 `/api/unsubscribe` + `unsubscribeNewsletterAction`                                               | `src/app/api/unsubscribe/route.ts`, `src/features/newsletter/actions.ts` | One-click désabonnement Gmail/Yahoo/Apple. **Réutilisé** pour les relances d'engagement (lien `unsubscribeHref` du footer).                                        |
| `Trainee.consentementEmail` / `consentementVersion`                                                       | `prisma/schema.prisma:5274`                                              | Gate des emails non strictement transactionnels.                                                                                                                   |
| `ElearningEnrollment` / `CourseProgress` / `ModuleProgress` / `LessonProgress` / `ElearningXapiStatement` | doc `03-DATA-MODEL/02`                                                   | Source des données de payload + des déclencheurs (`dernierAccesAt`, `premiereConnexionAt`, `expiresAt`, `estDeverrouille`, `meilleurScorePct`).                    |
| `ElearningInvitation` / `ElearningAuthToken`                                                              | doc `03-DATA-MODEL/04`                                                   | Source des tokens d'invitation et magic-login/reset (envoyés par mail, hachés en base).                                                                            |
| `DocumentGenere` + `qrToken`                                                                              | `schema.prisma:5507`                                                     | Certificat de réalisation → lien de téléchargement portail.                                                                                                        |

> **Règle d'or anti-duplication** : on ne crée **ni** un nouveau transport, **ni** un nouveau layout, **ni** une nouvelle queue d'envoi. Tout passe par `enqueueEmail` → `emails` → `email-worker` → `sendEmail`.

---

## 2. NEUF à construire (cloisonné ADR-0007)

| Élément                                                   | Type                                      | Emplacement cible                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10 templates React Email                                  | `.tsx`                                    | `src/lib/email/templates/elearning-*.tsx`                                                                                                                                                          |
| 10 entrées `EmailJobName` + 10 entrées router `TEMPLATES` | édition                                   | `src/server/queue/types.ts`, `src/lib/email/templates/index.tsx`                                                                                                                                   |
| Service de déclenchement                                  | `.ts`                                     | `src/server/elearning/notifications/elearning-notifications-service.ts`                                                                                                                            |
| Catalogue payloads + Zod                                  | `.ts`                                     | `src/server/elearning/notifications/notification-payloads.ts`                                                                                                                                      |
| Modèle `ElearningNotificationLog` + enums                 | Prisma (additif)                          | `prisma/schema.prisma`                                                                                                                                                                             |
| Cron relance anti-décrochage                              | worker BullMQ                             | `src/server/queue/workers/elearning-relance-worker.ts`                                                                                                                                             |
| Hooks event-driven                                        | édition des services existants e-learning | `progress-service.ts`, `completion-service.ts`, `unlock-service.ts`, `access/*.actions.ts`, `elearning-import-worker.ts`, `elearning-certificat-worker.ts`, `elearning-access-lifecycle-worker.ts` |
| Tests                                                     | Vitest                                    | `src/lib/email/templates/__tests__/elearning-templates.spec.tsx`, `src/server/elearning/notifications/__tests__/*`                                                                                 |

---

## 3. Catalogue des templates (10)

### 3.1 Cœur lifecycle apprenant (les 7 de la mission)

| #   | `EmailJobName` (neuf)             | Fichier                               | Déclencheur                                                            | Transactionnel ?                   | `marketing` |
| --- | --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- | ----------- |
| 1   | `elearning-invitation`            | `elearning-invitation.tsx`            | Octroi d'accès / acceptation invitation / ligne import CSV traitée     | Oui (exécution service)            | non         |
| 2   | `elearning-bienvenue`             | `elearning-bienvenue.tsx`             | 1re connexion réelle (`premiereConnexionAt` posé)                      | Oui                                | non         |
| 3   | `elearning-rappel-inactivite`     | `elearning-rappel-inactivite.tsx`     | Cron : `dernierAccesAt` > N jours, cours non terminé                   | **Engagement** (gate consentement) | non\*       |
| 4   | `elearning-module-debloque`       | `elearning-module-debloque.tsx`       | `unlock-service` : un module passe `estDeverrouille=true`              | Oui (progression)                  | non         |
| 5   | `elearning-quiz-a-repasser`       | `elearning-quiz-a-repasser.tsx`       | `QuizAttempt` échoué sous le seuil (doc 03), tentatives restantes      | Oui                                | non         |
| 6   | `elearning-certificat-disponible` | `elearning-certificat-disponible.tsx` | `completion-service` : cours réussi → certificat `DocumentGenere` émis | Oui                                | non         |
| 7   | `elearning-fin-acces`             | `elearning-fin-acces.tsx`             | Cron : `expiresAt` à J-7 (préavis) **et** au passage `statut→expire`   | Oui                                | non         |

\* `elearning-rappel-inactivite` : pas `marketing:true` (reste `noreply@`, c'est une notification de service, pas une campagne `news@`), **mais** soumis à `consentementEmail` + lien de désabonnement dans le footer (`unsubscribeHref`).

### 3.2 Authentification apprenant (emails, gérés ici — flux détaillés doc `04-BACKEND/05`)

| #   | `EmailJobName` (neuf)          | Fichier                            | Déclencheur                                             | Source token                                                         |
| --- | ------------------------------ | ---------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 8   | `elearning-magic-login`        | `elearning-magic-login.tsx`        | `demanderMagicLinkAction` (connexion sans mot de passe) | `ElearningAuthToken` purpose `magic_login`, TTL 15-30 min, **haché** |
| 9   | `elearning-mot-de-passe-reset` | `elearning-mot-de-passe-reset.tsx` | `demanderResetAction`                                   | `ElearningAuthToken` purpose `password_reset`, TTL 30 min            |
| 10  | `elearning-mot-de-passe-setup` | `elearning-mot-de-passe-setup.tsx` | Invitation entreprise `requireMotDePasse=true`          | `ElearningAuthToken` purpose `password_setup`, TTL 24 h              |

> Les templates 8-10 sont calqués sur l'existant `ressources-magic-link.tsx` / `formateur-magic-link.tsx` (lien + « valable N min » + « usage unique » + « ignorez si pas à l'origine »). Anti-énumération côté action (cf. doc 04 §8.4) : on enqueue **toujours** une réponse constante, le mail n'est envoyé que si le compte existe.

---

## 4. Payloads, subjects & contenu des templates

### 4.1 Contrat de template (identique à l'existant)

Chaque fichier `elearning-*.tsx` exporte :

```tsx
// 1. la fonction subject (locale-aware)
export const <name>Subject = (locale: Locale, payload: Record<string, unknown>): string => { ... }
// 2. le composant qui rend via EmailLayout
export function <Name>Email({ locale, payload }: { locale: Locale; payload: Record<string, unknown> }) { ... }
```

et est enregistré dans `src/lib/email/templates/index.tsx` :

```tsx
"elearning-bienvenue": { subject: elearningBienvenueSubject, component: ElearningBienvenueEmail },
```

Le payload est `Record<string, unknown>` au transport (BullMQ JSON), **parsé avec Zod** au rendu — on centralise les schémas dans `notification-payloads.ts` et on appelle le parse en tête de chaque `subject`/composant (pattern déjà toléré : les templates existants font un cast `as unknown as Payload`, on **durcit** avec Zod).

### 4.2 Détail par template

Tous les liens CTA pointent vers un **lien portail tokenisé** (`getOrCreatePortailLien`) → l'apprenant arrive authentifié sans mot de passe. Base URL : `process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com"`.

#### 1. `elearning-invitation`

- **Subject FR** : `Votre accès à la formation « {titreCours} » — Axion-IA`
- **Payload** : `{ apprenantPrenomNom, titreCours, dureeEstimeeHeures, lienAcces, entrepriseNom?, requireMotDePasse, expiresLe? }`
- **CTA** : « Accéder à ma formation » → `lienAcces` (magic-link d'accès, ou `lien de définition mot de passe` si `requireMotDePasse`).
- **Corps** : présentation du cours, durée moyenne (D.6313-3-1 §2 : information durée), modalité 100 % en ligne (FOAD), mention assistance (« une question ? répondez à cet email / contactez votre tuteur » → Ind.19), validité de l'accès.

#### 2. `elearning-bienvenue`

- **Subject FR** : `Bienvenue dans « {titreCours] » — vous êtes prêt à démarrer`
- **Payload** : `{ apprenantPrenomNom, titreCours, nbModules, dureeEstimeeHeures, lienAcces, premierModuleTitre }`
- **CTA** : « Commencer le premier module » → `lienAcces`.
- **Corps** : comment ça marche (modules qui se débloquent, quiz pour valider, reprise auto), où trouver l'aide (assistance technique + pédagogique = Ind.19), engagement attendu (microlearning 2-10 min/leçon).

#### 3. `elearning-rappel-inactivite` (anti-décrochage — Qualiopi **Ind.12**)

- **Subject FR** : `On continue ? Votre formation « {titreCours} » vous attend`
- **Payload** : `{ apprenantPrenomNom, titreCours, percentComplet, joursInactivite, prochaineEtapeTitre, lienAcces, unsubscribeToken }`
- **CTA** : « Reprendre où je m'étais arrêté » → `lienAcces` (reprise auto persistée serveur, `LessonProgress.dernierePositionSec`).
- **Corps** : rappel bienveillant (pas culpabilisant), progression actuelle (« vous avez déjà fait {percentComplet} % »), prochaine étape, **proposition d'aide** (tuteur, Ind.19), **lien de désabonnement** (footer `unsubscribeHref` via `unsubscribeToken`). **Gate** : `consentementEmail=true`.

#### 4. `elearning-module-debloque`

- **Subject FR** : `Nouveau module débloqué : « {titreModule} »`
- **Payload** : `{ apprenantPrenomNom, titreCours, titreModule, raisonDeblocage, lienModule }`
- **CTA** : « Découvrir le module » → `lienModule`.
- **Corps** : félicitation pour l'étape franchie, ce que débloque la suite. `raisonDeblocage` reflète l'`unlockType` (ex. « parce que vous avez réussi le quiz précédent » / « disponible depuis aujourd'hui »).

#### 5. `elearning-quiz-a-repasser`

- **Subject FR** : `Quiz « {titreQuiz} » : encore un essai pour valider`
- **Payload** : `{ apprenantPrenomNom, titreCours, titreQuiz, scoreObtenuPct, seuilRequisPct, tentativesRestantes, lienQuiz }`
- **CTA** : « Repasser le quiz » → `lienQuiz`.
- **Corps** : score obtenu vs seuil requis, tentatives restantes, encouragement + lien vers les leçons à revoir, rappel que le module suivant est gaté par ce quiz (gating par **score réel**, pas attempt-only).

#### 6. `elearning-certificat-disponible`

- **Subject FR** : `Votre certificat de réalisation est disponible — Axion-IA`
- **Payload** : `{ apprenantPrenomNom, titreCours, heuresRealisees, dateRealisation, scoreGlobalPct, lienCertificat }`
- **CTA** : « Télécharger mon certificat » → `lienCertificat` (portail, document `DocumentGenere` + QR).
- **Corps** : félicitations, **certificat de réalisation** (modèle officiel, heures réalisées — obligatoire depuis 01/06/2020), score global, conservation. ⚠️ **Aucune mention de financement public** ni de promesse de certification RNCP/CPF (règle alignée sur `qualiopi-attestation-disponible.tsx:3`).

#### 7. `elearning-fin-acces`

- **Subject FR (préavis J-7)** : `Votre accès à « {titreCours} » se termine le {dateFin}`
- **Subject FR (échu)** : `Votre accès à « {titreCours} » a pris fin`
- **Payload** : `{ apprenantPrenomNom, titreCours, dateFin, percentComplet, certificatDisponible, phase: "preavis" | "echu", lienAcces? }`
- **CTA (préavis)** : « Terminer ma formation » → `lienAcces`. **CTA (échu)** : « Télécharger mon certificat » si `certificatDisponible`, sinon « Contacter Axion-IA ».
- **Corps** : date de fin, progression restante, conservation des preuves de réalisation côté Axion-IA (3-5 ans), possibilité de prolongation (contact). Le même template gère les 2 phases via `phase`.

#### 8-10. Auth (magic-login / reset / setup)

- Subjects : `Votre lien de connexion — Espace formation Axion-IA` / `Réinitialisation de votre mot de passe — Axion-IA` / `Définissez votre mot de passe — Espace formation Axion-IA`.
- Payload commun : `{ destinataireNom?, lien, expiresInMin }`.
- Corps : bouton + « valable N min » + « usage unique » + « si vous n'êtes pas à l'origine, ignorez » (calque `ressources-magic-link.tsx`).

---

## 5. Déclencheurs (triggers)

Deux familles : **event-driven** (appel direct depuis un service/worker au moment de l'évènement) et **cron** (scan périodique). Tous passent par le **service de notifications** (jamais `enqueueEmail` éparpillé dans le code métier).

### 5.1 Service de déclenchement — `elearning-notifications-service.ts`

Fichier : `src/server/elearning/notifications/elearning-notifications-service.ts` — **calqué sur** `src/server/qualiopi/notifications/notifications-service.ts` (mêmes helpers `isStub()`, `fmtDate()`, `dateKey()`, `getOrCreatePortailLien()`, fail-soft, jobId idempotent).

Fonctions exportées (chacune : lit l'`ElearningEnrollment` + agrégats, construit le payload, **journalise** dans `ElearningNotificationLog`, puis `enqueueEmail` avec `jobId` idempotent) :

```text
notifierInvitation(enrollmentId | invitationId)        → elearning-invitation
notifierBienvenue(enrollmentId)                        → elearning-bienvenue
notifierModuleDebloque(enrollmentId, moduleId)         → elearning-module-debloque
notifierQuizARepasser(enrollmentId, quizId, attemptId) → elearning-quiz-a-repasser
notifierCertificatDisponible(enrollmentId)             → elearning-certificat-disponible
notifierFinAcces(enrollmentId, phase)                  → elearning-fin-acces
notifierRappelInactivite(enrollmentId)                 → elearning-rappel-inactivite (gate consentement)
```

Garde-fous communs à chaque fonction :

1. `if (isStub()) return;` (build `stub.invalid`).
2. Charger l'`ElearningEnrollment` (+ `trainee {id,email,nom,prenom,consentementEmail}`, `course {titre,...}`, agrégats utiles). `return` si absent ou `trainee.deletedAt` (RGPD).
3. **Gate consentement** uniquement pour `notifierRappelInactivite` : `if (!trainee.consentementEmail) return;`.
4. Construire le `lienAcces` via `getOrCreatePortailLien(trainee.id, baseUrl)`.
5. `await journaliserNotification({...})` (cf. §7) — **avant** l'enqueue, statut `queued`.
6. `await enqueueEmail(template, trainee.email, "fr", payload, { jobId })`.
7. Tout dans un `try/catch` fail-soft (une erreur n'empêche pas les autres destinataires en mode batch).

### 5.2 Déclencheurs event-driven (qui appelle quoi)

| Évènement métier                                  | Lieu d'appel (NEUF/édition)                                                                    | Fonction notif                                           | `jobId` idempotent                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Accès octroyé (manuel/achat)                      | `src/server/elearning/access/grant.actions.ts` (octroi)                                        | `notifierInvitation(enrollmentId)`                       | `el-invitation-{enrollmentId}`                 |
| Invitation acceptée → Trainee créé/lié            | `src/app/[locale]/portail/invitation/[token]` action (doc 04 §8.3)                             | `notifierBienvenue` (à la 1re session)                   | `el-bienvenue-{enrollmentId}`                  |
| Ligne CSV traitée                                 | `src/server/queue/workers/elearning-import-worker.ts`                                          | `notifierInvitation(invitationId)`                       | `el-invitation-{invitationId}`                 |
| 1re connexion réelle (`premiereConnexionAt` posé) | `src/server/elearning/progress/progress-service.ts` (1er statement `launched`)                 | `notifierBienvenue(enrollmentId)`                        | `el-bienvenue-{enrollmentId}`                  |
| Module déverrouillé                               | `src/server/elearning/progress/unlock-service.ts` (transition `estDeverrouille false→true`)    | `notifierModuleDebloque(enrollmentId, moduleId)`         | `el-module-debloque-{enrollmentId}-{moduleId}` |
| Quiz échoué sous seuil, tentatives restantes      | `src/server/elearning/quiz/quiz-service.ts` (doc 03, à la clôture d'un `QuizAttempt` `failed`) | `notifierQuizARepasser(enrollmentId, quizId, attemptId)` | `el-quiz-repasser-{attemptId}`                 |
| Cours réussi → certificat émis                    | `src/server/queue/workers/elearning-certificat-worker.ts` (après `DocumentGenere`)             | `notifierCertificatDisponible(enrollmentId)`             | `el-certificat-{enrollmentId}`                 |
| Accès expiré (`statut→expire`)                    | `src/server/queue/workers/elearning-access-lifecycle-worker.ts`                                | `notifierFinAcces(enrollmentId, "echu")`                 | `el-fin-acces-echu-{enrollmentId}`             |

> **Important — déverrouillage** : `notifierModuleDebloque` n'est appelé **que** sur une vraie transition (le `unlock-service` connaît l'état précédent via `ModuleProgress.estDeverrouille`). On n'envoie **pas** un mail pour les modules `immediat` ouverts dès l'octroi (sinon spam au démarrage) — filtre : `unlockType != immediat` **et** `module.ordre > 0`.

### 5.3 Déclencheurs cron — `elearning-relance-worker.ts` (NEUF) + `elearning-access-lifecycle-worker.ts`

Nouveau worker BullMQ `src/server/queue/workers/elearning-relance-worker.ts`, queue `elearning-relance`, **1 cron quotidien 08:30 UTC** (décalé des crons booking/formation à 08:00 pour lisser la charge). Type de job dispatché (calque `BookingCronJobType`) :

```ts
export type ElearningCronJobType =
  | "relance-inactivite" // dernierAccesAt > seuil, cours non terminé, consentement OK
  | "fin-acces-preavis" // expiresAt dans [now+7j-fenêtre, now+7j] → notifierFinAcces(..,"preavis")
  | "fin-acces-echu"; // expiresAt < now & statut=actif → statut→expire + notifierFinAcces(..,"echu")
```

- `relance-inactivite` : `prisma.elearningEnrollment.findMany({ where: { statut: "actif", dernierAccesAt: { lt: <now - RELANCE_INACTIVITE_JOURS j> }, courseProgress: { statut: { not: "termine" } }, trainee: { consentementEmail: true, deletedAt: null } } })` → pour chaque, `notifierRappelInactivite(enrollmentId)`. **Anti-harcèlement** : ne pas relancer plus de **1 fois par fenêtre** (jobId `el-relance-{enrollmentId}-{dateKey}`) ni plus de **N relances totales** (compté via `ElearningNotificationLog`, ex. max 3, puis on s'arrête).
- `fin-acces-preavis` : J-7 avant `expiresAt` → `notifierFinAcces(enrollmentId, "preavis")` (jobId `el-fin-acces-preavis-{enrollmentId}-{dateKey(expiresAt)}`).
- `fin-acces-echu` : peut être porté soit ici, soit par `elearning-access-lifecycle-worker.ts` (doc 02 §9) qui fait déjà `statut→expire`. **Décision** : le passage de statut reste dans `access-lifecycle-worker`, qui **appelle** `notifierFinAcces(enrollmentId, "echu")` juste après la transition (cohérence : la notif suit le changement d'état réel).

Seuils configurables via env (défauts) :

- `ELEARNING_RELANCE_INACTIVITE_JOURS=10`
- `ELEARNING_RELANCE_MAX=3`
- `ELEARNING_FIN_ACCES_PREAVIS_JOURS=7`

### 5.4 Enregistrement du cron dans `bootRepeatableJobs()`

Ajouter dans `src/server/queue/queues.ts` (sur le modèle `formationCronsQueue`/`bookingCronsQueue`) :

```ts
export const elearningRelanceQueue: Queue<ElearningCronJobData, void, ElearningCronJobType> | null =
  connection
    ? new Queue<ElearningCronJobData, void, ElearningCronJobType>("elearning-relance", {
        connection,
        defaultJobOptions: { ...defaultJobOptions, attempts: 3 },
      })
    : null;
```

et dans `bootRepeatableJobs()` :

```ts
if (elearningRelanceQueue) {
  const schedule: Array<{ type: ElearningCronJobType; pattern: string; jobId: string }> = [
    {
      type: "relance-inactivite",
      pattern: "30 8 * * *",
      jobId: "elearning-relance-inactivite-cron",
    },
    { type: "fin-acces-preavis", pattern: "30 8 * * *", jobId: "elearning-fin-acces-preavis-cron" },
    { type: "fin-acces-echu", pattern: "30 8 * * *", jobId: "elearning-fin-acces-echu-cron" },
  ];
  for (const { type, pattern, jobId } of schedule) {
    await elearningRelanceQueue.removeRepeatable(type, { pattern }, jobId);
    await elearningRelanceQueue.add(
      type,
      { type, tick: new Date().toISOString() },
      { repeat: { pattern }, jobId },
    );
  }
}
```

Le `startElearningRelanceWorker()` est appelé depuis `src/server/queue/worker.ts` au démarrage du process worker (comme les autres `startXxxWorker()`).

---

## 6. Branchement dans l'infra email (édition chirurgicale)

1. **`src/server/queue/types.ts`** — étendre l'union `EmailJobName` :

   ```ts
   // E-learning LMS — lifecycle apprenant + auth
   | "elearning-invitation"
   | "elearning-bienvenue"
   | "elearning-rappel-inactivite"
   | "elearning-module-debloque"
   | "elearning-quiz-a-repasser"
   | "elearning-certificat-disponible"
   | "elearning-fin-acces"
   | "elearning-magic-login"
   | "elearning-mot-de-passe-reset"
   | "elearning-mot-de-passe-setup";
   ```

   Ajouter aussi `ElearningCronJobData` / `ElearningCronJobType` (cf. §5.3).

2. **`src/lib/email/templates/index.tsx`** — importer les 10 composants + subjects et ajouter 10 entrées dans `TEMPLATES`. (Le test `templates-coverage.test.ts` vérifie que **chaque** `EmailJobName` a une entrée → il faut les 10, sinon CI rouge.)

3. **`src/lib/email/templates/elearning-*.tsx`** — créer les 10 fichiers (cf. §4).

4. **`src/server/queue/queues.ts`** — `elearningRelanceQueue` + branchement `bootRepeatableJobs` (§5.4).

5. **`src/server/queue/workers/elearning-relance-worker.ts`** — nouveau worker (§5.3) + `startElearningRelanceWorker()` câblé dans `worker.ts`.

6. **Hooks event-driven** — éditer les services/workers e-learning listés au §5.2 pour appeler le service de notifications.

Aucune de ces modifs ne touche `client.ts` ni `email-worker.ts` (sauf si l'on veut, en option, faire mettre à jour `ElearningNotificationLog.statut → sent/failed` par le worker — voir §7.3).

---

## 7. Journal de notifications — preuve d'accompagnement FOAD (NEUF)

> **Pourquoi** : « Les traces servent de preuve d'accompagnement » (mission). Les jobs BullMQ sont **purgés** (1000 completed / 5000 failed, `email-worker.ts:58-59`) → **insuffisant** comme preuve durable. Qualiopi **Ind.19** (assistance technique ET pédagogique) + R.6313-3 (faisceau de preuves) exigent une trace **conservée 3-6 ans**. On persiste donc chaque notification dans Postgres.

### 7.1 Modèle Prisma (additif — ADR-0008)

À ajouter à `prisma/schema.prisma` (et à refléter dans `03-DATA-MODEL/02` lors de la ratification). FK vers `ElearningEnrollment` (PK text) et `Trainee` (`@db.Uuid`).

```prisma
/// Type de notification e-learning émise (preuve d'accompagnement FOAD, Ind.19).
enum ElearningNotificationType {
  invitation
  bienvenue
  rappel_inactivite
  module_debloque
  quiz_a_repasser
  certificat_disponible
  fin_acces_preavis
  fin_acces_echu
  magic_login
  mot_de_passe_reset
  mot_de_passe_setup
}

/// État d'acheminement de la notification (synchro best-effort avec le worker).
enum ElearningNotificationStatut {
  queued       // enqueue effectué
  sent         // SMTP accepté (optionnel : remonté par email-worker)
  failed       // échec définitif après retries
  skipped      // non envoyé (consentement off, doublon, stub)
}

/// Journal append-only des notifications e-learning — PREUVE d'accompagnement.
model ElearningNotificationLog {
  id           String                      @id @default(uuid())

  enrollmentId String?                     @map("enrollment_id")
  enrollment   ElearningEnrollment?        @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  /// Destinataire dénormalisé (peut survivre à un soft-delete enrollment pour la preuve).
  traineeId    String?                     @map("trainee_id") @db.Uuid
  emailTo      String                      @map("email_to") @db.Citext

  type         ElearningNotificationType
  statut       ElearningNotificationStatut @default(queued)
  /// Nom du template (= EmailJobName) effectivement enqueue.
  template     String                      @db.VarChar(60)
  /// jobId BullMQ idempotent (corrèle avec la queue).
  jobId        String?                     @map("job_id") @db.VarChar(120)
  /// Raison du skip (ex. "consentement_off", "max_relances_atteint", "doublon").
  skipRaison   String?                     @map("skip_raison") @db.VarChar(120)
  /// Snapshot minimal du payload (sans PII sensible) pour audit.
  payloadJson  Json?                       @map("payload_json")
  errorMsg     String?                     @map("error_msg") @db.Text

  createdAt    DateTime                    @default(now()) @map("created_at")
  sentAt       DateTime?                   @map("sent_at")

  @@index([enrollmentId])
  @@index([traineeId])
  @@index([type])
  @@index([createdAt])
  @@map("elearning_notification_logs")
}
```

Champ inverse additif sur `ElearningEnrollment` :

```prisma
// model ElearningEnrollment { ... }
  notifications ElearningNotificationLog[]
```

### 7.2 Helper de journalisation

`src/server/elearning/notifications/notification-log.ts` :

```text
journaliserNotification({ enrollmentId, traineeId, emailTo, type, template, jobId, payloadSnapshot })
  → prisma.elearningNotificationLog.create({ statut: "queued", ... })
marquerSkip({ ...meta, skipRaison })  → create({ statut: "skipped", skipRaison })
```

Stub-aware : `if (isStub()) return null;`. **Anti-doublon** : avant d'enqueue, possibilité de vérifier qu'il n'existe pas déjà un log `sent`/`queued` avec le même `jobId` (défense en profondeur en plus du jobId BullMQ).

### 7.3 Synchro statut (option recommandée V1)

`email-worker.ts` peut, **uniquement pour les templates `elearning-*`**, mettre à jour `ElearningNotificationLog.statut → sent` (+ `sentAt`) sur succès / `failed` sur échec définitif — sur le **même pattern** que le branchement `submission-reply` (`email-worker.ts:26-29,84-135`) qui synchronise déjà un statut de delivery en base. Corrélation par `jobId`. **MVP** : on peut se contenter de `queued` (preuve d'envoi tenté = suffisant pour Ind.19) ; la synchro `sent/failed` est un raffinement.

### 7.4 Exploitation conformité

- Export admin (doc `06-CONSOLE-ADMIN/08-reporting-analytics.md`) : timeline des accompagnements par apprenant/cours.
- Alimente le **faisceau de preuves R.6313-3** aux côtés de `ElearningXapiStatement` (activité), `LessonProgress.tempsPasseSec` (assiduité), `QuizAttempt` (évaluations Ind.11) et `DocumentGenere` (certificat).
- Mapping conformité dans `08-CONFORMITE/06-tracabilite-preuves-realisation.md`.

---

## 8. RGPD, consentement & RFC 8058

- **Transactionnel vs engagement** : invitation, bienvenue, module débloqué, quiz à repasser, certificat, fin d'accès, et les 3 emails auth = **transactionnels** (exécution du service souscrit, base légale = exécution du contrat) → **pas** de gate `consentementEmail`, **pas** `marketing:true` (restent `noreply@`). La **relance d'inactivité** est la seule à frontière marketing → **gate `consentementEmail`** + `unsubscribeHref` (footer) + cap `ELEARNING_RELANCE_MAX`.
- **RFC 8058** : pour la relance d'inactivité, passer `unsubscribeToken` dans le payload → `email-worker.ts:36-41` le détecte et `client.ts:78-83` ajoute `List-Unsubscribe` + `List-Unsubscribe-Post`. Le token est celui du système newsletter existant (`/api/unsubscribe`). Si l'apprenant n'a pas de token newsletter, en générer un dédié « engagement e-learning » réutilisant la même action de désinscription, OU pointer vers une page de préférences `/portail/preferences` (V1).
- **Footer légal** : `EmailLayout` injecte déjà raison sociale SAS + adresse + SIRET/TVA depuis `COMPANY_*`. Rien à faire.
- **Anti-énumération (auth)** : les actions `demanderMagicLinkAction`/`demanderResetAction` répondent toujours « si un compte existe, un email a été envoyé » ; l'email n'est enqueue que si `Trainee` existe (doc 04 §8.4).
- **Soft-delete** : ne **jamais** notifier un `Trainee` avec `deletedAt != null` (gate dans chaque fonction du service).
- **Conservation** : `ElearningNotificationLog` conservé **3-5 ans** (preuve de réalisation/accompagnement, L.6362-6), aligné sur `DocumentGenere.suppressionPrevueAt`. Purge par `retention-purge-worker` (existant) étendu, ou cron e-learning dédié. Les **secrets** (tokens) ne sont jamais journalisés (on logue le `type`/`template`/`jobId`, pas le lien magique en clair).

---

## 9. Build `stub.invalid` & robustesse

- Chaque fonction du service commence par `if (isStub()) return;` (calque `notifications-service.ts:30-32`). Au build GH Actions (DB `stub.invalid`), **aucune** notification n'est émise et aucun `ElearningNotificationLog` n'est créé.
- `enqueueEmail` est déjà no-op si `BULLMQ_DISABLED`/pas de connexion Redis (`queues.ts:612-617`) → aucun crash au build.
- Les workers e-learning (`elearning-relance-worker`, etc.) ne tournent **que** dans le process worker (jamais au SSG) ; `BULLMQ_DISABLED=true` au build les empêche de s'initialiser.
- **Fail-soft** : en mode batch (cron, import CSV), une erreur sur un destinataire est `catch`ée et loggée sans bloquer les autres (calque `notifications-service.ts:185-191`).
- **Idempotence** : `jobId` fixe par évènement (BullMQ ignore un 2e add tant que le 1er est pending/active) + `dateKey` pour les évènements récurrents (relance par fenêtre) + anti-doublon `ElearningNotificationLog`.

---

## 10. Tests (Vitest)

- `src/lib/email/templates/__tests__/elearning-templates.spec.tsx` : rendu des 10 templates en FR (et EN par cohérence) sans throw, présence du CTA, du footer légal, des champs payload clés ; subjects non vides. (Calque `qualiopi-templates.spec.tsx` + `templates-render.test.ts`.)
- `templates-coverage.test.ts` (existant) : vérifie que chaque `EmailJobName` a une entrée `TEMPLATES` → garantit le branchement des 10.
- `src/server/elearning/notifications/__tests__/elearning-notifications-service.spec.ts` : gate consentement (relance), gate `deletedAt`, gate `isStub`, idempotence jobId, filtre module `immediat`/`ordre 0`, cap `ELEARNING_RELANCE_MAX`, journalisation `ElearningNotificationLog`.
- Test cron : `relance-inactivite` ne sélectionne que `statut=actif` + `dernierAccesAt` ancien + `consentementEmail=true` + cours non terminé.
- Mock Prisma distinct (non affecté par le stub Proxy build-time, cf. AGENTS.md).

---

## 11. Checklist d'implémentation (MVP → V1)

**MVP** (transactionnel, le strict nécessaire conforme) :

- [ ] Templates 1, 2, 4, 5, 6, 7 + auth 8/9/10 (`elearning-*.tsx`).
- [ ] Étendre `EmailJobName` + router `TEMPLATES`.
- [ ] `elearning-notifications-service.ts` + `notification-payloads.ts` (Zod).
- [ ] Modèle `ElearningNotificationLog` + enums (migration additive) + `journaliserNotification`.
- [ ] Hooks event-driven (octroi, 1re connexion, déverrouillage, quiz échoué, certificat, expiration).
- [ ] `fin-acces-echu` branché dans `elearning-access-lifecycle-worker`.
- [ ] Tests templates + coverage + service.

**V1** (engagement + finitions) :

- [ ] Template 3 `elearning-rappel-inactivite` + `elearning-relance-worker.ts` (cron) + `bootRepeatableJobs`.
- [ ] Gate consentement + RFC 8058 + cap relances + page `/portail/preferences`.
- [ ] Synchro statut `sent/failed` dans `email-worker` (pattern `submission-reply`).
- [ ] Export conformité timeline accompagnement (reporting admin).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride : magic-login/reset), ADR-0007 (cloisonnement `src/server/elearning/**`), ADR-0008 (migrations additives).
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`/`CourseProgress`/`ModuleProgress`/`LessonProgress`/`ElearningXapiStatement` (sources de déclenchement et de payload) + workers `elearning-relance-worker`/`elearning-access-lifecycle-worker`/`elearning-certificat-worker` (§9).
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`QuizAttempt` (déclencheur `elearning-quiz-a-repasser`, Ind.11).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `ElearningInvitation`/`ElearningAuthToken` (déclencheurs invitation + auth) ; templates `elearning-invitation`/`magic-login`/`reset`/`setup` y sont référencés (§7 checklist).
- `04-BACKEND/03-workers-bullmq-crons.md` — déclaration des queues/crons (où s'insère `elearning-relance`).
- `04-BACKEND/05-authentification-apprenant.md` — flux auth + anti-énumération (consommateurs des emails 8-10).
- `04-BACKEND/06-import-masse-provisioning.md` — `elearning-import-worker` (déclencheur `elearning-invitation` en masse).
- `05-FRONTEND-APPRENANT/04-progression-deverrouillage.md` — sémantique des verrous (raison affichée reprise dans `elearning-module-debloque`).
- `06-CONSOLE-ADMIN/08-reporting-analytics.md` — exploitation de `ElearningNotificationLog` (timeline accompagnement).
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` (Ind.12 relance, Ind.19 assistance), `06-tracabilite-preuves-realisation.md` (faisceau de preuves), `05-rgpd-conservation-preuves.md` (consentement, RFC 8058, conservation).
  </content>
  </invoke>
