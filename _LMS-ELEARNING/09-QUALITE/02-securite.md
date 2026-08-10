# Qualité — Sécurité de la plateforme e-learning (LMS)

> Spécification de sécurité **complète et implémentable** pour le LMS Axion-IA : authentification apprenant, autorisation & isolation, protection des contenus (vidéo/PDF), anti-triche quiz serveur, conformité OWASP, gestion des secrets, journalisation des événements sensibles.
>
> **Doctrine fondatrice : réutiliser les primitives de sécurité déjà durcies du repo, ne jamais les redéclarer.** Tout le code de sécurité du LMS appelle des helpers existants (`src/lib/auth-password.ts`, `src/lib/rate-limit.ts`, `src/lib/pii-crypto.ts`, `src/lib/security/ip-hash.ts`, `src/lib/r2-storage.ts`, `src/server/qualiopi/portail/*`). On **n'invente pas** de nouvelle crypto.
>
> Références ADR : **ADR-LMS-0001** (auth hybride, monde séparé de NextAuth), **ADR-LMS-0002** (multi-tenant conçu maintenant / livré V2), **ADR-LMS-0005** (vidéo Cloudflare Stream, URLs signées + watermark), **ADR-LMS-0007** (cloisonnement code `src/server/elearning/**`), **ADR-LMS-0008** (migrations additives).
>
> Contraintes plateforme respectées : build externalisé GH Actions + magic string `stub.invalid`, FR-only, budgets Web Vitals, secrets Coolify, Nodemailer maison (pas de service emailing tiers).

---

## 0. TL;DR pour un dev senior

1. **L'auth apprenant est un monde étanche de NextAuth.** Deux tables, deux cookies, deux guards, jamais de cross-read. NextAuth (`src/auth.ts`) ne lit/écrit QUE `AdminUser` ; l'apprenant vit sur `Trainee` + `PortailAcces` + cookie `portail_session`.
2. **Mots de passe : argon2id via `src/lib/auth-password.ts` UNIQUEMENT** (`hashPassword` / `verifyPasswordSafe`). Ne jamais importer `argon2` ailleurs. `passwordHash` est nullable (magic-link reste le défaut) et **jamais** sérialisé vers le client.
3. **Tokens email = hachés en base, one-shot, TTL court** (`ElearningAuthToken.tokenHash` / `ElearningInvitation.tokenHash` = SHA-256). Le secret n'existe qu'en transit (mail). La **session** reste un token opaque 64 hex (`PortailAcces.token`) comparé `timingSafeEqual`.
4. **Autorisation = scoping systématique par `traineeId`.** Tout accès à une ressource e-learning passe par un helper central (`assertLearnerCanAccessCourse`, `assertLearnerOwnsAttempt`, …) qui vérifie l'octroi (`ElearningEnrollment`). Jamais de requête « par id » sans clause `WHERE traineeId = session.traineeId`. C'est la défense IDOR n°1.
5. **Contenus protégés = URLs signées à durée courte, générées serveur, jamais devinables.** Vidéo = tokens signés Cloudflare Stream (TTL ~2-4 h) + watermark dynamique par apprenant. PDF/ressources = `getSignedUrlR2` (TTL court) derrière un route handler authentifié — **jamais** d'URL R2 publique, jamais de clé R2 exposée au client.
6. **Quiz : la correction et le timing vivent côté serveur.** Le client ne reçoit **jamais** la bonne réponse avant soumission. Notation, seuil, gating, chronomètre = serveur. Anti-triche léger = randomisation (questions + réponses) + temps serveur + tirage N parmi M (pas de proctoring au MVP — CNIL : proportionné/optionnel).
7. **Journalisation des événements sensibles** dans une table dédiée `ElearningSecurityEvent` (login, échec, lockout, octroi/révocation d'accès, soumission quiz, émission certificat) avec **IP hachée** (`hashIp`, SHA-256 + `IP_HASH_SALT`), conservation différenciée (logs techniques 6-12 mois CNIL, preuves OPCO 3-6 ans).
8. **Tout service e-learning est stub-aware** (`if (process.env["DATABASE_URL"]?.includes("stub.invalid"))`) comme `portail-service.ts` → lecture `null`/`[]`, mutation `throw`. Les routes apprenant sont `force-dynamic` + derrière auth → zéro fuite au SSG.

---

## 1. Modèle de menaces (threat model)

### 1.1 Actifs à protéger

| Actif                                                                       | Sensibilité                                                     | Menace principale                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| **PII apprenant** (`Trainee` : nom, email, téléphone, **handicap chiffré**) | Élevée (RGPD, données handicap = catégorie particulière art. 9) | Exfiltration DB, IDOR, log en clair                         |
| **Mots de passe apprenant** (`Trainee.passwordHash`)                        | Critique                                                        | Vol de hash, brute-force, oracle d'énumération              |
| **Sessions** (`PortailAcces.token`)                                         | Critique                                                        | Vol de cookie (XSS), fixation, timing attack, replay        |
| **Contenu pédagogique vidéo** (Cloudflare Stream)                           | Moyenne-élevée (valeur commerciale)                             | Hotlinking, partage d'URL, scraping de masse                |
| **Documents** (PDF/ressources R2)                                           | Moyenne                                                         | URL devinable, accès sans octroi                            |
| **Réponses de quiz & barème** (`Question.correctAnswer`)                    | Élevée (intégrité de l'évaluation = conformité FOAD Ind.11)     | Triche (réponses côté client), rejeu, manipulation de score |
| **Certificats** (`DocumentGenere` + QR)                                     | Élevée (preuve légale)                                          | Falsification, génération non méritée                       |
| **Preuves FOAD** (logs LMS, assiduité, traces)                              | Élevée (contrôle OPCO/DREETS)                                   | Altération, perte, non-traçabilité                          |
| **Secrets** (`AUTH_SECRET`, clés Stream, R2, `PII_ENCRYPTION_KEY`)          | Critique                                                        | Fuite via bundle client, logs, repo                         |

### 1.2 Acteurs / surfaces

- **Apprenant légitime** authentifié (token magic-link ou mot de passe).
- **Apprenant malveillant** authentifié tentant d'accéder aux ressources d'un autre (IDOR), de tricher au quiz, de télécharger/partager du contenu.
- **Anonyme** tentant brute-force login, énumération de comptes, accès direct à des URLs de contenu.
- **Entreprise** (V2 multi-tenant) : un membre ne doit jamais voir les données d'une autre organisation.
- **Admin Axion-IA** (RBAC NextAuth existant) : surface authoring/octroi, à protéger via `requireAdmin*`.

### 1.3 Frontières de confiance

```
[Navigateur apprenant]  ──HTTPS/CF──>  [Next.js app (RSC + Server Actions + Route Handlers)]
        │ cookie portail_session (opaque)          │
        │ JAMAIS de bonne réponse quiz             ├──> Postgres (Prisma, PII chiffrée at-rest)
        │ JAMAIS de clé R2/Stream                  ├──> Redis (rate-limit, BullMQ)
        │ URLs signées TTL court uniquement        ├──> Cloudflare Stream (tokens signés)
                                                    └──> R2 (URLs signées, jamais public)
[Worker BullMQ elearning-*]  ──>  Postgres / R2 / Nodemailer
```

**Règle d'or :** le navigateur est hostile. Toute décision d'autorisation, de notation, de gating et de signature d'URL est prise **serveur**. Le client n'affiche que ce que le serveur lui a déjà autorisé.

---

## 2. EXISTANT (réutilisé) vs NEUF (à construire)

### 2.1 Primitives de sécurité réutilisées telles quelles

| Primitive                                                                                                        | Fichier                                                                       | Usage LMS                                                                             |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **argon2id SSOT** (`hashPassword`, `verifyPasswordSafe`, dummy-hash anti-oracle)                                 | `src/lib/auth-password.ts`                                                    | Mot de passe apprenant optionnel (ADR-0001). **Ne pas redéclarer argon2.**            |
| **Rate-limit sliding-window Redis** (`checkRateLimit`, fail-open)                                                | `src/lib/rate-limit.ts`                                                       | Login, reset, magic-link, soumission quiz, signature d'URL.                           |
| **Session portail opaque** (`creerAcces`, `verifierToken` timing-safe, `revoquerAcces`)                          | `src/server/qualiopi/portail/portail-service.ts`                              | Session apprenant unifiée (magic ET password aboutissent à une ligne `PortailAcces`). |
| **Cookie session** (`setPortailCookie`/`getPortailToken`/`clearPortailCookie`, HttpOnly+Secure+SameSite=Lax+90j) | `src/server/qualiopi/portail/cookie.ts`                                       | Cookie `portail_session` réutilisé tel quel.                                          |
| **Magic-token HMAC** (`signMagicToken`/`verifyMagicToken`, scopé+TTL, Edge-safe)                                 | `src/lib/magic-token.ts`                                                      | Liens non-sensibles ; flux sensibles → `ElearningAuthToken` haché (cf. §3.4).         |
| **Chiffrement PII at-rest AES-256-GCM** (`encryptPii`/`decryptPii`)                                              | `src/lib/pii-crypto.ts`                                                       | Champs PII apprenant sensibles (handicap déjà chiffré sur `Trainee`).                 |
| **IP hashing RGPD** (`hashIp`, SHA-256 + `IP_HASH_SALT`)                                                         | `src/lib/security/ip-hash.ts`                                                 | Journalisation événements sensibles (jamais d'IP en clair durable).                   |
| **URLs signées R2** (`getSignedUrlR2`, `getSignedUploadUrlR2`, `isR2Configured`)                                 | `src/lib/r2-storage.ts`                                                       | Téléchargements protégés PDF/ressources + upload média auteur.                        |
| **RBAC admin** (`requireAdminRead/Write/Publish/Delete`)                                                         | `src/server/actions/knowledge/_guards.ts`                                     | Surface admin e-learning (authoring, octroi, banque quiz).                            |
| **Journal admin** (`ActivityLog`, `prisma/schema.prisma:1565`)                                                   | —                                                                             | Actions admin sur le LMS (octroi, publication cours…).                                |
| **Purge de rétention**                                                                                           | `src/server/queue/workers/retention-purge-worker.ts`, `src/lib/rgpd-erase.ts` | Étendre pour purger sessions/tokens/logs e-learning.                                  |
| **NextAuth admin** (cookie `authjs.session-token`, Credentials+TOTP, JWT pur)                                    | `src/auth.ts`, `src/auth.config.ts`                                           | **Inchangé** ; cohabitation étanche (§9).                                             |

### 2.2 Neuf à construire (cloisonné ADR-0007)

| Élément                                                   | Type          | Emplacement cible                                                                   |
| --------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| Service auth apprenant (login/reset/magic/verify/session) | code          | `src/server/elearning/auth/learner-auth-service.ts`                                 |
| Guard apprenant (`getLearnerSession`/`requireLearner`)    | code          | `src/server/elearning/auth/learner-guard.ts`                                        |
| Helpers d'autorisation (scoping IDOR)                     | code          | `src/server/elearning/auth/learner-access-control.ts`                               |
| Signature d'URL vidéo Cloudflare Stream + watermark       | code          | `src/server/elearning/media/stream-signing.ts`                                      |
| Route handler lecture média protégée                      | route         | `src/app/[locale]/portail/cours/[courseSlug]/media/[lessonId]/route.ts`             |
| Moteur de notation quiz serveur                           | code          | `src/server/elearning/quiz/quiz-grading-service.ts`                                 |
| Anti-triche (randomisation, timing serveur)               | code          | `src/server/elearning/quiz/quiz-attempt-service.ts`                                 |
| Journalisation sécurité                                   | modèle + code | `ElearningSecurityEvent` (Prisma) + `src/server/elearning/security/security-log.ts` |
| Crons purge/cleanup                                       | workers       | `src/server/queue/workers/elearning-cleanup-worker.ts`                              |

---

## 3. Authentification apprenant

> Référence data model : `03-DATA-MODEL/04-schema-comptes-acces-auth.md` (extensions `Trainee`/`PortailAcces`, `ElearningAuthToken`, enums). Détail implémentation : `04-BACKEND/05-authentification-apprenant.md`.

### 3.1 Stockage des mots de passe (NEUF — réutilise SSOT)

- **argon2id** via `hashPassword(plain)` / `verifyPasswordSafe(hash, plain)` (`src/lib/auth-password.ts`). Params OWASP 2024 : memoryCost 19456 (19 MiB), timeCost 2, parallelism 1.
- `Trainee.passwordHash` est **nullable** : un apprenant peut vivre 100 % en magic-link. Le mot de passe est un opt-in (chemin entreprise).
- **Politique de mot de passe** (validation Zod côté server action) : minimum 12 caractères (la fonction `hashPassword` impose déjà ≥ 8 comme garde-fou ; le schéma Zod LMS exige 12), rejet des mots de passe trop communs via une liste embarquée (top 10k) + check « ne contient pas l'email ». Pas de complexité arbitraire imposée (recommandation ANSSI/NIST : longueur > complexité).
- **`passwordHash` n'est JAMAIS sélectionné vers le client.** Toujours `select` explicite des champs ; interdiction du `select: *` / objet `Trainee` brut renvoyé par une Server Action. Lint/review : aucun retour de Server Action ne contient `passwordHash`.

### 3.2 Anti-énumération de comptes (NEUF)

- `verifyPasswordSafe` vérifie contre un **dummy-hash** constant si l'utilisateur n'existe pas → timing égalisé (déjà implémenté dans `auth-password.ts`).
- Toutes les réponses login/reset/magic sont **constantes et non-énumérantes** : « Si un compte existe pour cette adresse, un email vient d'être envoyé. » Jamais « email inconnu » vs « mot de passe incorrect ».
- Le flux reset/magic crée toujours l'illusion d'un envoi (même si l'email n'existe pas) — pas de différence observable.

### 3.3 Rate-limit + verrouillage de compte (double couche, NEUF utilisant l'existant)

Deux couches complémentaires (volatile IP + persistant compte) :

| Couche                  | Mécanisme                                          | Clé / champ                        | Seuil proposé                                                   |
| ----------------------- | -------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| **IP (volatile)**       | `checkRateLimit` (Redis)                           | `learner:login:${ip}`              | 5 / 900 s                                                       |
|                         |                                                    | `learner:reset:${ip}`              | 3 / 3600 s                                                      |
|                         |                                                    | `learner:magic:${ip}`              | 5 / 3600 s                                                      |
|                         |                                                    | `learner:magic:email:${emailHash}` | 3 / 3600 s (anti-spam d'une boîte)                              |
| **Compte (persistant)** | `Trainee.failedLoginCount` + `Trainee.lockedUntil` | par `Trainee`                      | verrou temporaire après 10 échecs (15 min, backoff exponentiel) |

- **Fail-open du rate-limit** (`src/lib/rate-limit.ts`) : si Redis est indisponible le login passe quand même — c'est un choix UX assumé, **mais** la couche `lockedUntil` (DB, persistante) reste active et constitue le filet de sécurité réel anti-brute-force. Alerter Sentry si fail-open prolongé.
- Sur succès : reset `failedLoginCount`, set `lastLoginAt`/`lastLoginIp` (haché)/`lastLoginMethod`.
- Extraction IP : réutiliser le pattern `clientIp(req)` du route handler portail existant (`cf-connecting-ip` → `x-forwarded-for` → `x-real-ip`).

### 3.4 Tokens à usage unique (NEUF — table `ElearningAuthToken`)

Pour les flux sensibles email (reset, vérification, 1re définition de mot de passe, magic-login one-shot) :

- Token aléatoire (`randomBytes(32).toString("hex")`) envoyé **uniquement** par mail.
- En base : **SHA-256 du token** (`ElearningAuthToken.tokenHash`, `@unique`). Le clair n'est jamais stocké (même doctrine que `FormateurMagicLink.tokenHash`).
- **One-shot** : `usedAt` posé à la consommation, rejet si déjà utilisé. **TTL court** : magic-login 15-30 min ; reset/setup 30 min - 24 h.
- Consommation : on hache le token reçu et on `findUnique({ where: { tokenHash } })` (pas d'oracle de timing significatif côté index B-tree ; comparaison du hash en plus si besoin).
- Pourquoi pas le HMAC stateless `signMagicToken` pour ces flux ? Parce qu'il est **rejouable jusqu'à expiration** (cf. commentaire « Replay attack » de `magic-token.ts`). Les flux sensibles exigent une consommation traçable → table hachée. Le HMAC reste pour les liens non-sensibles.

### 3.5 Sessions (réutilise `PortailAcces`)

- **Magic-link** : flux inchangé (`creerAcces` → cookie). On enrichit `PortailAcces.authMethod="magic"`, `createdIp` (haché), `userAgent`.
- **Mot de passe** : après `verifyPasswordSafe` OK, on crée une ligne `PortailAcces` (token opaque 64 hex) via une variante `creerSession({ traineeId, authMethod:"password", ip, userAgent })` puis `setPortailCookie`. **Pas de seconde table de session.**
- **Token opaque, comparaison `timingSafeEqual`** (déjà dans `verifierToken`). Le token de session est **stocké en clair** en base (statu quo `PortailAcces`) — acceptable car (a) c'est un secret aléatoire 256 bits sans valeur dérivée, (b) révocable, (c) la DB est la frontière de confiance et la PII y est chiffrée. _Durcissement optionnel V1.5 :_ hacher aussi `PortailAcces.token` (SHA-256) pour réduire l'impact d'un dump DB — additif, non bloquant.
- **Cookie** : HttpOnly + Secure + SameSite=Lax + Path=/ + 90 j (`cookie.ts`). HttpOnly = défense XSS (le JS ne lit pas le cookie). SameSite=Lax = défense CSRF de base sur navigation cross-site.
- **Révocation** : `revoquerAcces(id)` (existant) + nouveau `revoquerToutesSessions(traineeId)` (après reset mot de passe, suspension de compte, demande RGPD). Le reset de mot de passe **invalide toutes les sessions actives**.
- **Rotation** : à chaque définition/reset de mot de passe → `revoquerToutesSessions` + nouvelle session. Au login réussi → nouvelle ligne `PortailAcces` (pas de réutilisation du token précédent).
- **Pas de token de session dans l'URL** : le route handler `acces/[token]` pose le cookie puis **redirige 302 vers `mon-espace` sans le token** (déjà le cas). À répliquer pour tous les flux LMS.

### 3.6 Protection CSRF

- **Server Actions Next.js** : protection CSRF native (vérification Origin + action chiffrée). C'est le mécanisme par défaut pour toutes les mutations apprenant (login password, définir/reset mot de passe, soumission quiz, marquer leçon complétée).
- **Route Handlers** mutatifs (rare côté apprenant) : vérifier `Origin`/`Referer` + SameSite=Lax du cookie. Les route handlers de **lecture** (médias) sont en GET idempotent, pas de CSRF applicable.
- Les magic-link sont en GET mais **one-shot + non devinables** ; le risque de CSRF login (forced login) est mitigé par le fait que poser une session sur le navigateur d'un tiers n'a pas d'intérêt offensif ici (pas de paiement enchaîné).

---

## 4. Autorisation & isolation (le cœur anti-IDOR)

> **La menace n°1 d'un LMS est l'IDOR** : un apprenant authentifié change un `id` dans l'URL/le payload et accède au cours, au quiz, au certificat ou à la progression d'un autre. La défense est un **scoping systématique par `traineeId` de session**, jamais une vérification ad hoc.

### 4.1 Guard de base (NEUF)

`src/server/elearning/auth/learner-guard.ts` :

```text
getLearnerSession(): Promise<{ traineeId, sessionId } | null>
   // getPortailToken() → verifierToken() (réutilise portail-service.ts)
requireLearner(): Promise<{ traineeId, sessionId }>
   // throw "unauthorized" si null → la page mappe en redirect /portail/connexion
```

**Toute** Server Action / Route Handler / RSC e-learning apprenant commence par `requireLearner()`. Aucune exception.

### 4.2 Helpers d'autorisation centralisés (NEUF — anti-IDOR)

`src/server/elearning/auth/learner-access-control.ts` — un point de passage unique par ressource :

```text
assertLearnerCanAccessCourse(traineeId, courseId): Promise<ElearningEnrollment>
   // vérifie l'octroi : prisma.elearningEnrollment.findFirst({
   //   where: { traineeId, courseId, statut: { in: ["actif","termine"] } } })
   // → throw "forbidden" si absent. Retourne l'enrollment (source de l'octroi).

assertLearnerCanAccessLesson(traineeId, lessonId): Promise<...>
   // remonte lesson → module → course, applique assertLearnerCanAccessCourse,
   // PUIS applique la logique de déverrouillage (drip/gating) côté serveur
   // (cf. 05-FRONTEND-APPRENANT/04). Une leçon verrouillée = 403, même si octroi OK.

assertLearnerOwnsAttempt(traineeId, attemptId): Promise<QuizAttempt>
   // findFirst({ where: { id: attemptId, traineeId } }) → throw si null.

assertLearnerOwnsEnrollment(traineeId, enrollmentId): ...
assertLearnerCanDownloadResource(traineeId, resourceId): ...
   // resource → lesson → course → octroi + Resource.telechargeable === true
```

**Règles de codage non négociables :**

- **Jamais** `findUnique({ where: { id } })` seul sur une ressource apprenant. Toujours une clause d'appartenance (`traineeId` ou jointure prouvant l'octroi).
- Les Server Actions reçoivent des `id` du client = **données hostiles** : valider (Zod : UUID) **puis** scoper.
- L'UI n'est jamais la source d'autorité : masquer un bouton ne protège rien, le serveur revérifie.

### 4.3 Isolation multi-tenant (conçue MVP, durcie V2 — ADR-0002)

- **MVP** : le scoping par `traineeId` suffit (un apprenant ne voit que ses octrois). L'appartenance entreprise est portée par `Trainee.primaryOrganisationClientId` + `ElearningOrgMembership` mais l'UI entreprise déléguée n'existe pas encore.
- **Cours réservés à un client** : `ElearningCourse.ownerClientId` non-null = catalogue privé. `assertLearnerCanAccessCourse` doit, en plus de l'octroi, vérifier que si `course.ownerClientId != null`, l'apprenant a une `ElearningOrgMembership` active sur ce client. Un cours « owner_client » ne doit jamais fuiter au catalogue public ni à un apprenant hors organisation.
- **V2 (manager/org_admin)** : tout accès « équipe » (voir la progression de ses N apprenants) passera par un helper `assertManagerCanViewMember(managerTraineeId, targetTraineeId)` validant une `ElearningOrgMembership` commune avec rôle `manager`/`org_admin` et statut `active`. **Toute requête de reporting entreprise sera filtrée par `clientId` du manager** — règle posée dès maintenant pour que la V2 n'ait aucune requête à réécrire. Tests d'isolation cross-tenant obligatoires en V2.
- **Catalogue public** : seules les pages publiques d'un `ElearningCourse` en `statut=publie` ET `ownerClientId=null` ET `vendableSeul=true` sont rendues hors auth. Les cours `brouillon`/`archive`/owner-client ne sont jamais exposés (filtre serveur, pas seulement UI).

### 4.4 Surface admin

L'authoring, l'octroi d'accès, l'import CSV, la banque de quiz, l'émission de certificats passent par les Server Actions admin sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/**`, **toujours** gardées par `requireAdminWrite()` / `requireAdminPublish()` / `requireAdminDelete()` (`_guards.ts`). Un apprenant n'a **aucun** chemin vers ces actions (monde NextAuth séparé). Toute action admin écrit un `ActivityLog`.

---

## 5. Protection des contenus

### 5.1 Vidéo — Cloudflare Stream, URLs signées + watermark (NEUF — ADR-0005)

**Principe : le client ne reçoit jamais une URL de stream durable ni un identifiant exploitable hors contexte.**

- `ElearningLesson.videoAssetId` = id de l'asset Cloudflare Stream (stocké serveur, jamais une URL publique).
- L'asset est marqué **`requireSignedURLs = true`** côté Stream → impossible de lire le HLS sans token signé. C'est le verrou central (sans lui, l'URL serait publique malgré la signature).
- À la demande de lecture, un **route handler authentifié** :
  1. `requireLearner()` ;
  2. `assertLearnerCanAccessLesson(traineeId, lessonId)` (octroi + déverrouillage) ;
  3. `rate-limit` `learner:media:${traineeId}` (anti-scraping de masse) ;
  4. génère un **token de lecture signé Stream** à **TTL court (≈ 2-4 h)**, restreint à cet asset, via `src/server/elearning/media/stream-signing.ts` (signé avec la clé Stream serveur, JWT `exp` + `sub`=assetId) ;
  5. retourne le manifeste/URL signé(e) ; journalise `video_play_token_issued`.
- **Watermark dynamique par apprenant** : surimpression du nom/email tronqué + `traineeId` court côté player (overlay) et/ou via la fonctionnalité de watermark Stream → décourage la rediffusion (un screen-record est traçable). Le watermark est un **dissuasif**, pas un DRM ; ADR-0005 réserve le DRM lourd au premium.
- **Anti-hotlinking** : `requireSignedURLs` + TTL court + (optionnel) restriction `allowedOrigins` Stream sur le domaine. Une URL volée expire en quelques heures et porte la signature de l'apprenant (watermark).
- **Sous-titres WCAG (`ElearningResource type=sous_titres`)** : servis via le même mécanisme signé (ou inline dans le manifeste signé).

### 5.2 PDF / ressources téléchargeables (NEUF — réutilise R2)

- **Jamais** d'URL R2 publique, **jamais** de bucket public, **jamais** la clé R2 (`r2Key`/`pdfKey`) renvoyée au client.
- Téléchargement via route handler authentifié `…/cours/[courseSlug]/ressource/[resourceId]/route.ts` :
  1. `requireLearner()` + `assertLearnerCanDownloadResource(traineeId, resourceId)` (octroi + `Resource.telechargeable === true`) ;
  2. `getSignedUrlR2(key, ttl)` avec **TTL court** (≈ 300-900 s ; pas le défaut 90 j de `getSignedUrlR2` réservé aux factures) → redirect 302 vers l'URL signée, OU streaming via `getObjectBufferR2` si on veut watermarker le PDF ;
  3. journalise `resource_downloaded` (IP hachée).
- Pattern déjà éprouvé dans le repo : `getEspaceStagiaire` régénère une URL signée **fraîche** (24 h) à chaque lecture des attestations plutôt que de stocker une URL durable. **Répliquer cette doctrine** (régénération à la lecture, jamais d'URL persistée côté client).
- **Upload média auteur** : `getSignedUploadUrlR2(key, contentType, 15 min)` (TTL court par défaut) — l'admin authentifié (`requireAdminWrite`) obtient une URL PUT signée ; le fichier ne transite pas par le serveur Next. Valider `contentType` et préfixe de clé (`elearning/...`) côté serveur avant signature pour empêcher l'écriture hors namespace.

### 5.3 Contenu texte / embed

- Le HTML riche des leçons (`ElearningLesson.contenuJson`, blocs Tiptap) est **assaini** (sanitization) au rendu : autoriser une allowlist de balises/attributs, neutraliser `<script>`, `on*=`, `javascript:`. La source étant l'auteur admin (de confiance) le risque est faible, mais un auteur compromis ne doit pas pouvoir injecter du JS chez les apprenants (stored XSS) → sanitization obligatoire au rendu serveur.
- Les `embed` externes (replay classe virtuelle) passent par un `<iframe sandbox>` avec `allow` minimal et une allowlist de domaines (pas d'embed arbitraire saisi par l'auteur sans validation de domaine).

---

## 6. Anti-triche quiz (serveur)

> **Intégrité de l'évaluation = exigence de conformité FOAD (Qualiopi Ind.11, évaluations qui jalonnent).** Un quiz triché invalide la preuve. Référence data model : `03-DATA-MODEL/03-schema-quiz-evaluations.md` (`Quiz`, `Question`, `QuizAttempt`).

### 6.1 La règle fondamentale : la correction vit côté serveur

- **Le client ne reçoit JAMAIS la bonne réponse avant soumission.** Le payload envoyé au navigateur pour une question contient uniquement l'énoncé et les options (sans le flag `isCorrect`). La colonne `Question.correctAnswer` / `Question.solution` n'est **jamais** sélectionnée dans une requête servant le rendu apprenant.
- La **notation** (`quiz-grading-service.ts`), le **seuil de réussite**, le **gating** (déverrouillage du module suivant via `ElearningUnlockType.score_quiz`) et la **pondération** sont calculés serveur à la soumission. Le client n'envoie que les réponses choisies ; il **ne calcule jamais** son score.
- Le **gating est par score réel** (la vraie note ≥ seuil), pas « attempt-only » (cf. best practices : gating attempt-only = à éviter). `unlockScorePct` est comparé à la note serveur.

### 6.2 Randomisation (anti-partage de réponses)

- **Shuffle des questions** ET **shuffle des réponses** à chaque tentative, ordre persisté sur le `QuizAttempt` (pour réafficher le feedback cohérent) — un apprenant ne peut pas dicter « la réponse est B » à un autre.
- **Tirage N parmi M** depuis la banque de questions (`Quiz` tire N questions d'un pool) → deux apprenants n'ont pas le même quiz.
- Les `correct flags` ne sont pas inférables depuis l'ordre (l'ordre est aléatoire et indépendant de la correction).

### 6.3 Timing & tentatives côté serveur

- **Chronomètre serveur** : `QuizAttempt.startedAt` posé serveur à l'ouverture ; à la soumission, le serveur vérifie `now - startedAt <= dureeMaxSec` (+ tolérance réseau). Le compteur affiché côté client est purement cosmétique ; **l'autorité est `startedAt` serveur**. Une soumission hors délai est rejetée ou notée selon la politique du quiz.
- **Limite de tentatives** : `Quiz.maxTentatives` vérifiée serveur (`count` des `QuizAttempt` de ce trainee sur ce quiz). Pas de contournement client.
- **One-attempt-in-flight** : une seule tentative ouverte (`statut=en_cours`) par (trainee, quiz) ; réutiliser celle existante au reload (reprise), refuser une seconde ouverture parallèle (anti multi-onglets pour multiplier les essais).
- **Idempotence de soumission** : une tentative déjà `soumise`/`notee` ne peut être re-soumise (rejet) → pas de rejeu pour améliorer le score après coup.

### 6.4 Correction manuelle (essai/upload)

- Les types `essai` et `upload` (devoir) sont **notés à la main** par un correcteur admin (`requireAdminWrite`). Le fichier uploadé suit la doctrine R2 §5.2 (signature, scan de type MIME, taille max). La note manuelle alimente le score global serveur.

### 6.5 Anti-triche léger, proportionné (pas de proctoring au MVP)

- **Pas de proctoring** (caméra/surveillance) au lancement : CNIL impose proportionnalité + alternative + optionnel ; réservé au high-stakes (certification RNCP, V2). Le MVP s'appuie sur randomisation + timing serveur + traçabilité (logs) — suffisant pour OPCO/Qualiopi.
- **Anti-automatisation** : rate-limit `learner:quiz:submit:${traineeId}` ; détection d'anomalies (soumission en < X s pour N questions → flag `suspect` journalisé, pas de blocage automatique au MVP).
- **Traçabilité** : chaque tentative journalise `quiz_attempt_started` / `quiz_attempt_submitted` (score, durée, IP hachée) → faisceau de preuves FOAD + détection a posteriori.

---

## 7. OWASP Top 10 (2021/2026) — couverture

| Risque OWASP                           | Couverture LMS                                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01 Broken Access Control**          | Guard `requireLearner` systématique + helpers `assertLearner*` (scoping `traineeId`), anti-IDOR §4. Admin via `requireAdmin*`. Mondes auth séparés (§9).                                                   |
| **A02 Cryptographic Failures**         | argon2id (mdp), AES-256-GCM PII at-rest (`pii-crypto.ts`), tokens email hachés SHA-256, IP hachée, URLs signées TTL court, cookie Secure+HttpOnly. Secrets hors bundle (§8).                               |
| **A03 Injection**                      | Prisma (requêtes paramétrées, pas de SQL brut), validation Zod de tous les inputs, sanitization HTML des leçons (§5.3), pas d'`eval`.                                                                      |
| **A04 Insecure Design**                | Threat model §1, principe « navigateur hostile », gating par score serveur, multi-tenant scoping conçu dès le MVP.                                                                                         |
| **A05 Security Misconfiguration**      | `env.ts` (t3-env) fail-fast au boot sur secrets manquants en prod, bucket R2 non-public, Stream `requireSignedURLs`, headers sécurité (CSP/HSTS via middleware existant), `force-dynamic` sur routes auth. |
| **A06 Vulnerable Components**          | Dependabot actif (cf. mémoire projet), pnpm lockfile, pas de lib crypto maison.                                                                                                                            |
| **A07 Identification & Auth Failures** | Anti-énumération (dummy-hash), rate-limit double couche, lockout compte, tokens one-shot TTL court, sessions révocables, magic-link sans token en URL.                                                     |
| **A08 Software & Data Integrity**      | Tokens HMAC signés (`AUTH_SECRET`), certificats avec QR vérifiable (`DocumentGenere.qrToken`), hash SHA-256 d'intégrité sur fichiers R2 (pattern existant), one-shot quiz (anti-rejeu).                    |
| **A09 Logging & Monitoring**           | `ElearningSecurityEvent` (§10) + `ActivityLog` admin, Sentry (existant), IP hachée, rétention CNIL.                                                                                                        |
| **A10 SSRF**                           | Pas de fetch d'URL fournie par l'apprenant côté serveur ; embeds en allowlist de domaines + `<iframe sandbox>` ; uploads via URL signée (pas de fetch serveur d'URL arbitraire).                           |

---

## 8. Gestion des secrets

- **Tous les secrets vivent dans les env vars Coolify** (scope RUN), validés par `src/env.ts` (t3-env, fail-fast en prod) — jamais commités.
- Secrets LMS impliqués :
  - `AUTH_SECRET` (existant) — signature HMAC magic-token (`magic-token.ts`).
  - `PII_ENCRYPTION_KEY` (existant, 64 hex) — chiffrement PII at-rest.
  - `IP_HASH_SALT` (existant, ≥ 32 chars) — hachage IP des logs.
  - `R2_*` (existant) — credentials R2 (signature URLs).
  - **NEUF** : `CLOUDFLARE_STREAM_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_SIGNING_KEY` (clé de signature des tokens de lecture) — à ajouter au schéma `env.ts` (validés requis en prod, optionnels si feature flag vidéo off).
- **Jamais de secret côté client** : aucune clé Stream/R2/`AUTH_SECRET` dans un composant client, un `NEXT_PUBLIC_*`, ou le bundle. La signature d'URL et la génération de token se font **exclusivement** dans `src/server/elearning/**` (Server Action / Route Handler / worker). Revue : `grep` des `process.env` dans les fichiers `"use client"` interdit pour ces clés.
- **Feature flags** (env, comme `STRIPE_ENABLED`/`EN_LOCALE_ENABLED`) : `EDOF_ENABLED=false` (CPF gated, ADR-0003), `ELEARNING_VIDEO_ENABLED`, `STRIPE_ENABLED=false` (paiement CB éteint). Un flag off doit **désactiver le code serveur**, pas seulement masquer l'UI.
- **Build `stub.invalid`** : les secrets prod sont absents en GH Actions → `SKIP_ENV_VALIDATION=true` au build. Les nouveaux secrets Stream doivent être tolérés absents au build (validation conditionnelle), comme les autres.
- **Rotation** : `AUTH_SECRET` et clés Stream rotables via Coolify + redeploy. Documenter la procédure (la rotation `AUTH_SECRET` invalide les magic-token HMAC en vol — acceptable, TTL court).

---

## 9. Cohabitation NextAuth — invariants de sécurité (ADR-0001)

| Dimension | Admin (NextAuth, existant)                  | Apprenant (LMS, neuf)                      |
| --------- | ------------------------------------------- | ------------------------------------------ |
| Identité  | `AdminUser`                                 | `Trainee`                                  |
| Cookie    | `authjs.session-token`                      | `portail_session`                          |
| Lib auth  | `src/auth.ts` (Credentials + TOTP, JWT pur) | `learner-auth-service.ts` + `PortailAcces` |
| Guard     | `auth()` + `requireAdmin*`                  | `requireLearner()`                         |
| Hash mdp  | `auth-password.ts` (partagé)                | `auth-password.ts` (partagé)               |

**Invariants non négociables (testés) :**

- NextAuth ne lit/écrit **jamais** `Trainee`/`PortailAcces` ; le service apprenant ne lit/écrit **jamais** `AdminUser`.
- Une Server Action e-learning apprenant **n'appelle jamais** `auth()` pour authentifier (toujours `requireLearner()`), et inversement l'admin e-learning **n'appelle jamais** `requireLearner()` (toujours `requireAdmin*`). Confondre les deux = faille d'élévation de privilège.
- `declare module "next-auth"` (`src/auth.ts`) reste strictement admin (`Session.user.role: AdminRole`). L'apprenant n'apparaît jamais dans `session.user`.
- Cookies à noms disjoints → aucune collision/confusion de session possible.
- Test de non-régression : un cookie `portail_session` valide ne donne **aucun** accès aux routes/actions admin ; un cookie `authjs.session-token` ne donne **pas** d'accès apprenant implicite (un admin qui veut tester le portail doit s'authentifier comme apprenant).

---

## 10. Journalisation des événements sensibles

### 10.1 Modèle `ElearningSecurityEvent` (NEUF, additif)

`ActivityLog` (`schema.prisma:1565`) est lié à `AdminUser` → réservé aux actions admin. Pour les événements **apprenant**, on ajoute une table dédiée (RGPD : IP hachée, rétention courte) :

```prisma
enum ElearningSecurityEventType {
  login_success
  login_failure
  account_locked
  magic_link_requested
  magic_link_consumed
  password_reset_requested
  password_set
  session_revoked
  access_granted          // octroi de cours
  access_revoked
  video_play_token_issued
  resource_downloaded
  quiz_attempt_started
  quiz_attempt_submitted
  quiz_attempt_suspect    // anomalie anti-triche
  certificate_issued
  forbidden_access_attempt // IDOR tenté / 403
}

model ElearningSecurityEvent {
  id          String                     @id @default(uuid()) @db.Uuid
  type        ElearningSecurityEventType
  /// Apprenant concerné (SetNull si Trainee supprimé RGPD — la preuve d'événement reste).
  traineeId   String?                    @map("trainee_id") @db.Uuid
  trainee     Trainee?                   @relation(fields: [traineeId], references: [id], onDelete: SetNull)
  /// IP HACHÉE (SHA-256 + IP_HASH_SALT) — jamais en clair durable (CNIL).
  ipHash      String?                    @map("ip_hash") @db.VarChar(64)
  userAgent   String?                    @map("user_agent") @db.Text
  /// Contexte structuré (courseId, quizId, score, reason…). PAS de PII en clair.
  metadata    Json?
  createdAt   DateTime                   @default(now()) @map("created_at")

  @@index([traineeId, type])
  @@index([type, createdAt])
  @@index([createdAt])
  @@map("elearning_security_events")
}
```

Helper d'écriture : `src/server/elearning/security/security-log.ts` → `logSecurityEvent({ type, traineeId?, ip?, userAgent?, metadata? })` qui **hache l'IP** via `hashIp` (`src/lib/security/ip-hash.ts`) avant insert, fire-and-forget (ne bloque pas la réponse), stub-aware.

### 10.2 Quoi journaliser

- **Auth** : succès/échec login, lockout, demande/consommation magic-link, reset, définition mdp, révocation session.
- **Accès** : octroi/révocation de cours (aussi en `ActivityLog` si déclenché par admin), émission de token vidéo, téléchargement de ressource.
- **Quiz** : début/soumission (score, durée), tentative suspecte.
- **Certificat** : émission (lien `DocumentGenere`).
- **Sécurité** : tentative d'accès interdit (403/IDOR) → signal d'attaque.
- **Admin** : toute action authoring/octroi/import écrit un `ActivityLog` (existant).

### 10.3 Ce qu'on ne journalise JAMAIS

- Mots de passe (clairs ou hachés), tokens en clair, contenu PII sensible (handicap) dans `metadata`, IP en clair durable. Pas de log verbeux d'objets `Trainee` complets.

### 10.4 Rétention (conformité)

| Donnée                                                                      | Durée                         | Base                  |
| --------------------------------------------------------------------------- | ----------------------------- | --------------------- |
| Logs techniques (`ElearningSecurityEvent` auth/accès/IP hachée)             | **6-12 mois**                 | CNIL 2021-122         |
| Sessions expirées (`PortailAcces`), tokens consommés (`ElearningAuthToken`) | purge après expiration (cron) | hygiène               |
| Preuves de réalisation FOAD (scores quiz, complétion, certificat, octroi)   | **3-5 ans**                   | L.6362-6              |
| Pièces OPCO / comptables                                                    | **6-10 ans**                  | L.102B LPF / L.123-22 |

- **Cron de purge** : `src/server/queue/workers/elearning-cleanup-worker.ts` (réutiliser le pattern `retention-purge-worker.ts`) → supprime sessions expirées, tokens consommés/expirés, événements techniques > 12 mois. **Ne purge pas** les preuves de réalisation (durée longue).
- **Droit à l'effacement RGPD** : réutiliser `Trainee.deletedAt` + `RgpdDemande` + `rgpd-erase.ts`. La suppression cascade `ElearningOrgMembership`/`ElearningAuthToken` ; `ElearningSecurityEvent` et invitations passent `SetNull` (preuve d'événement anonymisée conservée). La PII des preuves de réalisation est pseudonymisée, pas détruite avant l'échéance légale (obligation de conservation > droit à l'effacement sur ces pièces).

---

## 11. Checklist d'implémentation sécurité (MVP)

- [ ] `learner-guard.ts` (`requireLearner`/`getLearnerSession`) — appelé par **toute** surface apprenant.
- [ ] `learner-access-control.ts` (helpers `assertLearner*`) — scoping `traineeId` systématique, anti-IDOR.
- [ ] `learner-auth-service.ts` réutilise `auth-password.ts` + `rate-limit.ts` + `portail-service.ts` (aucune crypto redéclarée).
- [ ] Politique mdp Zod (≥ 12 chars, anti-commun, anti-email), `passwordHash` jamais sérialisé.
- [ ] Anti-énumération (réponses constantes) sur login/reset/magic.
- [ ] Rate-limit double couche + `lockedUntil` + reset compteur au succès.
- [ ] `ElearningAuthToken` haché SHA-256 + one-shot (`usedAt`) + TTL court.
- [ ] `revoquerToutesSessions` au reset mdp / suspension.
- [ ] Cloudflare Stream `requireSignedURLs=true` + token TTL court + watermark par apprenant.
- [ ] Route handler média authentifié + `assertLearnerCanAccessLesson` + rate-limit scraping.
- [ ] Téléchargements R2 via signature TTL court derrière auth (jamais d'URL/clé publique).
- [ ] Sanitization HTML des leçons + `<iframe sandbox>` allowlist pour embeds.
- [ ] Quiz : `correctAnswer` jamais envoyé au client ; notation/seuil/gating/timing serveur ; shuffle Q+R ; tirage N parmi M ; one-attempt-in-flight ; idempotence soumission.
- [ ] Secrets Stream ajoutés à `env.ts` (validation conditionnelle, tolérés au build stub).
- [ ] Aucun secret dans un fichier `"use client"` / `NEXT_PUBLIC_*`.
- [ ] `ElearningSecurityEvent` + `security-log.ts` (IP hachée, stub-aware).
- [ ] Cron `elearning-cleanup-worker.ts` (purge sessions/tokens/logs techniques).
- [ ] Tous les services e-learning **stub-aware** (`stub.invalid`).
- [ ] Routes apprenant `force-dynamic` + derrière auth (zéro fuite SSG).
- [ ] Tests Vitest sécurité : timing-safe, anti-énumération, one-shot, lockout, **IDOR cross-trainee**, **isolation cross-tenant**, quiz no-answer-leak, no-replay, cohabitation NextAuth (aucun cross-read).

---

## 12. Tests de sécurité (résumé — détail dans `01-plan-tests.md` et `99-VERIFICATION/04-audit-securite-rgpd.md`)

- **IDOR** : apprenant A tente d'accéder au cours/quiz/attempt/certificat/ressource de B (par id) → 403 systématique sur chaque helper `assertLearner*`.
- **Multi-tenant** : apprenant de l'org X tente d'accéder à un cours `ownerClientId=Y` → 403.
- **Énumération** : login/reset sur email inexistant → réponse et timing identiques à email existant.
- **Brute-force** : 11 échecs → `lockedUntil` posé ; rate-limit IP déclenché.
- **Tokens** : reset/magic-link rejoués après `usedAt` → refus ; après expiration → refus.
- **Quiz** : le payload de question ne contient jamais `isCorrect`/`correctAnswer` ; re-soumission d'une tentative notée → refus ; soumission hors délai serveur → refus ; double ouverture parallèle → refus.
- **Contenu** : accès direct à une URL Stream/R2 sans token → refus ; token expiré → refus ; ressource `telechargeable=false` → 403.
- **Cohabitation** : cookie `portail_session` valide sur route admin → refus ; cookie admin sur action apprenant → pas d'accès implicite.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride), 0002 (multi-tenant V2), 0005 (vidéo signée), 0007 (cloisonnement), 0008 (migrations additives).
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee` étendu, `PortailAcces`, `ElearningAuthToken`, enums auth.
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment` (source de l'octroi vérifié par `assertLearnerCanAccessCourse`), `LessonProgress`.
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` (correction serveur, `correctAnswer` non exposé).
- `04-BACKEND/05-authentification-apprenant.md` — implémentation service auth, guards, cohabitation NextAuth.
- `04-BACKEND/07-pipeline-video-streaming.md` — pipeline Cloudflare Stream, signature, watermark.
- `05-FRONTEND-APPRENANT/03-moteur-quiz-ui.md` / `04-progression-deverrouillage.md` — UI quiz (no answer leak), gating par score.
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` / `06-tracabilite-preuves-realisation.md` — rétention, preuves FOAD.
- `09-QUALITE/04-accessibilite-wcag22.md` — auth accessible (WCAG 3.3.8), alternative au drag (2.5.7).
- `99-VERIFICATION/04-audit-securite-rgpd.md` — audit adversarial de cette spec.
