# Personas & rôles — Plateforme LMS e-learning

> Référentiel des **acteurs** du LMS : qui ils sont, ce dont ils ont besoin, leurs parcours, et surtout **leurs droits exacts** mappés sur le RBAC réel du repo + les nouveaux rôles apprenant/client_admin.
>
> Document ancré sur le code réel (`schema.prisma`, `src/server/qualiopi/portail/*`, `src/server/actions/knowledge/_guards.ts`, `src/lib/admin-nav.ts`) et sur les ADR du dossier (`00-INDEX/DECISIONS-ARBITRAGES.md`). Respecte les noms de modèles/enums du data model (`03-DATA-MODEL/01-schema-cours-modules-lecons.md`).
>
> Convention : **[EXISTANT]** = brique déjà en prod réutilisée telle quelle ou étendue · **[NEUF]** = à construire · **[V2]** = livré en V2 (ADR-0002).
> Dernière mise à jour : 2026-06-27.

---

## 0. Carte des acteurs (vue d'ensemble)

```
                         ┌────────────────────────────────────────────┐
                         │              MONDE ADMIN (NextAuth)          │
                         │      AdminUser + AdminRole + 2FA TOTP        │
                         │  super_admin · admin · editor · reader       │
                         ├──────────────┬───────────────┬──────────────┤
            P2 Admin     │  P3 Auteur/  │  P-handicap   │  P-auditeur  │
            Axion-IA     │  Formateur   │  (référent)   │  (lecture)   │
                         └──────────────┴───────────────┴──────────────┘
                                          ▲
                                          │ octroi d'accès, authoring, suivi
                                          ▼
                         ┌────────────────────────────────────────────┐
                         │        MONDE APPRENANT (auth séparée)        │
                         │   Trainee (+ passwordHash optionnel) +       │
                         │   ElearningEnrollment + cookie portail dédié │
                         ├──────────────┬───────────────┬──────────────┤
        P1a Individuel   │ P1b Salarié  │ P4 Admin       │ P5 Manager  │
        (particulier)    │ participant  │ entreprise[V2] │  [V2]       │
        + P1c salarié    │ session      │ client_admin   │ client_mgr  │
        entreprise       │              │                │             │
        └────────────────┴──────────────┴───────────────┴─────────────┘
```

**Deux mondes d'authentification strictement séparés (ADR-0001)** :

- **Monde admin** = `AdminUser` + NextAuth v5 + 2FA TOTP. Rôles via enum `AdminRole` (`schema.prisma:276`). Guards `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`). **On NE touche PAS à NextAuth.**
- **Monde apprenant** = `Trainee` + système d'auth **dédié** (cookie portail HttpOnly, jamais NextAuth). MVP : magic-link via `PortailAcces` **[EXISTANT]** ; option mot de passe via `Trainee.passwordHash` **[NEUF, nullable]** pour les comptes entreprise.

Les rôles apprenant/entreprise **ne sont PAS** des `AdminRole`. Ils vivent dans le monde apprenant (champ de rôle sur le compte apprenant / l'appartenance entreprise — cf. §8). C'est une décision de sécurité : un compromis d'un compte apprenant ne doit jamais pouvoir escalader vers la console admin.

---

## 1. P1 — Apprenant (le persona central)

L'apprenant a **trois sous-variantes** qui partagent le même socle technique (`Trainee` + `ElearningEnrollment` + portail), mais diffèrent par l'**origine de l'accès** et le **financement**.

### 1.a — Particulier / vente directe (B2C)

**Qui.** Une personne qui paie (ou se voit offrir) un cours e-learning autonome (`ElearningCourse.vendableSeul = true`), sans lien avec une session présentielle ni une entreprise.

**Données.** `Trainee` **[EXISTANT, étendu]** (PII chiffrée, consentements). `Client` de `type = particulier` possible côté facturation **[EXISTANT]** mais pas obligatoire au MVP. Pas d'appartenance entreprise (`ElearningCompanyMembership = null`).

**Besoins.**

- Recevoir un accès en 1 clic après paiement (virement → octroi manuel admin, ADR-0004) ou après octroi gratuit.
- UX apprenant parfaite : reprise auto, progression visible, mobile-first, certificat à la fin.
- Récupérer son **certificat de réalisation** (modèle officiel, heures réalisées) et le vérifier par QR.
- Exercer ses droits RGPD (export / suppression) — **[EXISTANT]** `RgpdDemande` + `Trainee.deletedAt`.

**Auth.** Magic-link par défaut (zéro friction). Mot de passe **non** proposé par défaut (réservé entreprises) mais activable.

### 1.b — Participant d'une session (présentiel / live → e-learning adossé)

**Qui.** Un stagiaire déjà inscrit à une `TrainingSession` via `Enrollment` **[EXISTANT]**, à qui on ouvre en plus le volet e-learning (cours `ElearningCourse.formationId` rattaché à la `Formation` de sa session — relation décrite au data model §3).

**Données.** `Trainee` + `Enrollment` (présentiel) + `ElearningEnrollment` **[NEUF]** (e-learning). L'octroi e-learning peut être **automatique** : « session réalisée → ouverture du cours e-learning » (worker, cf. §1 parcours + `04-BACKEND/06`).

**Besoins.** Tout 1.a + continuité avec son parcours présentiel (même identité, même portail `/portail/mon-espace`). C'est le **chemin FOAD hybride** (`ModaliteFormation.hybride` **[EXISTANT]**) : preuves présentiel (émargement) + preuves e-learning (logs, évaluations) consolidées pour Qualiopi.

### 1.c — Salarié d'une entreprise (B2B, financé OPCO/entreprise)

**Qui.** Un collaborateur dont l'employeur (`Client` B2B, SIRET/OPCO **[EXISTANT]**) a commandé N accès. MVP : Axion-IA ouvre les accès en masse (import CSV). V2 : l'admin entreprise (P4) gère lui-même.

**Données.** `Trainee` + `ElearningEnrollment` + **`ElearningCompanyMembership`** **[NEUF, V2-ready]** = lien apprenant ↔ `Client` employeur (clé d'appartenance posée dès le MVP pour ne pas créer de dette, ADR-0002 ; le **cloisonnement strict** n'est appliqué qu'en V2).

**Besoins.** Tout 1.a/1.b + savoir que son employeur peut suivre sa progression (transparence RGPD : information préalable). Auth : **mot de passe activable** (`Trainee.passwordHash`) car les entreprises l'attendent (ADR-0001).

### Parcours apprenant (commun aux 3 variantes)

```
1. Réception accès
   └─ email "Votre accès au cours" (Nodemailer + React Email [NEUF template elearning-acces.tsx])
      → magic-link (PortailAcces) OU "définir mot de passe" (entreprise)
2. Connexion → /portail/mon-espace [EXISTANT] enrichi d'une section "Mes cours en ligne" [NEUF]
3. Entrée dans le cours → /portail/cours/[courseSlug] [NEUF]
   ├─ voit modules/leçons, certains VERROUILLÉS avec la RAISON affichée (ElearningUnlockType)
   └─ reprend automatiquement là où il s'est arrêté (LessonProgress.lastPositionSec)
4. Lecture leçon (vidéo HLS / texte / pdf / devoir) → player [NEUF]
   ├─ heartbeat progression persistée serveur (watch %, position)
   └─ marquage complétion (auto vidéo ≥ seuil, manuel texte/pdf)
5. Quiz bloquant → moteur quiz [NEUF]
   ├─ tentative, score serveur, feedback configurable
   └─ si score ≥ seuil → module suivant déverrouillé ; sinon retente (selon tentatives)
6. Fin de cours (toutes leçons obligatoires + quiz finaux ≥ seuilReussitePct)
   └─ génération CERTIFICAT DE RÉALISATION (DocumentGenere + qrToken [EXISTANT])
7. Téléchargement certificat + vérification QR + droits RGPD [EXISTANT]
```

### Droits de l'apprenant (rôle `learner`)

| Action                               | Droit        | Périmètre                                           |
| ------------------------------------ | ------------ | --------------------------------------------------- |
| Voir SES cours octroyés              | ✅           | scope = ses `ElearningEnrollment` uniquement        |
| Lire une leçon déverrouillée         | ✅           | bloqué si `unlock*` non satisfait (raison affichée) |
| Soumettre une tentative de quiz      | ✅           | rate-limité, temps serveur                          |
| Voir SA progression                  | ✅           | jamais celle d'un autre apprenant                   |
| Télécharger SON certificat           | ✅           | une fois `seuilReussitePct` atteint                 |
| Télécharger une ressource            | conditionnel | `ElearningResource.telechargeable = true`           |
| Demander export/suppression RGPD     | ✅           | **[EXISTANT]** `RgpdDemande`                        |
| Voir les cours d'un autre apprenant  | ❌           | isolation stricte                                   |
| Voir le back-office / authoring      | ❌           | mondes séparés                                      |
| Voir la progression de ses collègues | ❌           | (réservé manager P5, V2)                            |

**Garde technique.** Toute server action apprenante passe par **`requireLearner()`** **[NEUF]** (`src/server/elearning/auth/guards.ts`) + un **scope check** systématique : `assertEnrollmentOwnership(learnerId, courseId)` qui vérifie l'existence d'un `ElearningEnrollment` actif. Aucune requête apprenante ne lit sans filtrer par `learnerId`. (Miroir de la rigueur `getEspaceStagiaire` qui ne lit jamais sans `traineeId`.)

---

## 2. P2 — Admin Axion-IA (back-office)

**Qui.** L'équipe Axion-IA (Will + collaborateurs) qui pilote le LMS depuis la console : crée les cours, ouvre les accès, suit la progression, produit les preuves de conformité.

**Données / auth.** `AdminUser` **[EXISTANT]** + NextAuth + 2FA. Aucune nouveauté d'auth : on **réutilise** l'enum `AdminRole` et les guards existants.

**Besoins.**

- Ouvrir un accès e-learning en 1 clic (manuel) ou par **import CSV** d'une liste entreprise (MVP, ADR-0002).
- Suivre la progression / completion / scores de tous les apprenants (dashboard).
- Générer/réémettre les certificats de réalisation.
- **Exporter le faisceau de preuves FOAD** (logs LMS, évaluations, traces d'assistance) exigé par R.6313-3 / Qualiopi Ind.11 — cf. `08-CONFORMITE`.
- Gérer la banque de quiz, publier/dépublier des cours, archiver.

**Parcours admin (octroi en masse, MVP).**

```
Console → e-learning → Accès → "Importer une liste" [NEUF]
 1. upload CSV (email, prénom, nom, entreprise?, cours)
 2. mapping + validation (doublons sur Trainee.email citext, consentements)
 3. dry-run (aperçu : X créés, Y existants, Z erreurs)
 4. confirmation → worker elearning-provisioning-worker.ts [NEUF]
    ├─ upsert Trainee (réutilise modèle existant)
    ├─ create ElearningEnrollment
    ├─ create PortailAcces (magic-link) OU invite "set password"
    └─ enqueue email d'accès (email-worker existant)
 5. journal d'octroi (ActivityLog [EXISTANT])
```

### Mapping des droits admin sur les `AdminRole` existants

On **réutilise les 4 rôles existants** (`super_admin`, `admin`, `editor`, `reader`) et les 4 guards (`requireAdminRead/Write/Publish/Delete`). On crée des **wrappers e-learning** qui délèguent à ces guards (pas de nouveau système) :

| Capacité e-learning                                    | Guard réutilisé       | super_admin | admin | editor | reader |
| ------------------------------------------------------ | --------------------- | :---------: | :---: | :----: | :----: |
| Voir cours/apprenants/stats                            | `requireAdminRead`    |     ✅      |  ✅   |   ✅   |   ✅   |
| Créer/éditer cours, modules, leçons, quiz (authoring)  | `requireAdminWrite`   |     ✅      |  ✅   |   ✅   |   ❌   |
| Octroyer/révoquer un accès ; import CSV                | `requireAdminWrite`   |     ✅      |  ✅   |   ✅   |   ❌   |
| **Publier** un cours (brouillon → publié, `version++`) | `requireAdminPublish` |     ✅      |  ✅   |   ❌   |   ❌   |
| Émettre/réémettre un certificat                        | `requireAdminPublish` |     ✅      |  ✅   |   ❌   |   ❌   |
| Override de déverrouillage (forcer un module)          | `requireAdminPublish` |     ✅      |  ✅   |   ❌   |   ❌   |
| **Supprimer/archiver** un cours, purger un apprenant   | `requireAdminDelete`  |     ✅      |  ❌   |   ❌   |   ❌   |
| Configurer flags (`EDOF_ENABLED`, `STRIPE_ENABLED`)    | `requireAdminDelete`  |     ✅      |  ❌   |   ❌   |   ❌   |

> **Décision de design.** Pas de nouveau rôle admin pour le LMS. Le quadruplet existant couvre tous les besoins. On ajoute seulement une **fine couche sémantique** `src/server/elearning/auth/admin-guards.ts` **[NEUF]** :
>
> ```ts
> export const requireElearningRead = requireAdminRead; // lecture catalogue/suivi
> export const requireElearningAuthor = requireAdminWrite; // authoring + octroi
> export const requireElearningPublish = requireAdminPublish; // publication + certif + override
> export const requireElearningAdmin = requireAdminDelete; // archivage + flags + purge
> ```
>
> Avantage : zéro risque de régression RBAC, audit trivial, cohérent avec `_guards.ts` et le pattern `admin-blog/actions.ts`.

**Navigation admin.** Nouveau groupe `"elearning"` ajouté à `AdminNavGroup` (`src/lib/admin-nav.ts` **[EXISTANT, étendu]**), monté par `AdminSidebarNav.tsx` (le composant réellement rendu, cf. MEMORY admin-nav). Pôles suggérés : Cours (authoring) · Apprenants & accès · Suivi & preuves · Quiz · Réglages. Détail dans `06-CONSOLE-ADMIN/01-navigation-structure.md`.

---

## 3. P3 — Formateur / Auteur de contenu

**Qui.** Deux casquettes souvent portées par la même personne :

- **Auteur** : conçoit et remplit les cours (outil auteur drag&drop facile à remplir — exigence forte de Will).
- **Formateur / tuteur** : assure l'**assistance pédagogique** FOAD (Qualiopi Ind.19), répond aux apprenants, corrige les devoirs (`ElearningLessonType.devoir`) et les questions à correction manuelle.

**Données / auth.** Selon le profil :

- **Auteur interne Axion-IA** → c'est un `AdminUser` de rôle `editor` (authoring) ou `admin` (publication). **[EXISTANT]** Réutilise la console + guards. **C'est le chemin MVP.**
- **Formateur externe** → modèle `Trainer` **[EXISTANT]** + accès via `FormateurMagicLink` **[EXISTANT]** (espace-formateur). Pour le LMS, son accès au **tutorat/correction** se fait via une extension de l'espace formateur **[NEUF, V1]**, PAS via la console admin (pas de compte `AdminUser` pour un externe).

**Besoins (auteur).**

- Outil auteur facile : créer cours → modules → leçons en drag&drop, mixer des blocs dans une leçon, uploader média (transcodage vidéo auto Cloudflare Stream, ADR-0005), aperçu « as-student », brouillon → publication.
- IA d'aide à l'authoring : quiz-gen depuis le contenu, génération document-grounded (réutilise le **Formation Engine** `qualiopi-formation-engine-worker.ts` **[EXISTANT]** + RAG knowledge existant) — V1, cf. `04-BACKEND/08`.

**Besoins (formateur/tuteur).**

- Voir les apprenants qui lui sont rattachés, leurs questions, les devoirs à corriger.
- Délais d'assistance **formalisés** (Ind.19) → SLA tracé (preuve FOAD).
- Noter manuellement les questions de type `essai`/`reponse_courte` et les `devoir`.

**Parcours auteur (création d'un cours, MVP).**

```
Console → e-learning → Cours → "Nouveau cours" [NEUF, requireElearningAuthor]
 1. métadonnées (titre, objectifs[], prérequis[], publicVise, estFoad, seuilReussitePct)
    └─ lien optionnel vers Formation existante (formationId) — data model §3
 2. structure : drag&drop modules/leçons (réécriture transactionnelle des `ordre`)
 3. contenu par leçon : vidéo (upload → Stream) | texte (blocs JSON) | pdf (R2) | quiz | devoir
 4. règles de déverrouillage (ElearningUnlockType) par module/leçon
 5. aperçu as-student
 6. PUBLIER → requireElearningPublish (brouillon → publié, version++, publishedAt)
```

### Droits du formateur/auteur

| Action                                 |     Auteur interne (`editor`/`admin`)     | Formateur externe (espace-formateur) |
| -------------------------------------- | :---------------------------------------: | :----------------------------------: |
| Créer/éditer cours, modules, leçons    |       ✅ (`requireElearningAuthor`)       |                  ❌                  |
| Uploader média (Stream/R2)             |                    ✅                     |                  ❌                  |
| Générer quiz par IA                    |                  ✅ (V1)                  |                  ❌                  |
| Publier un cours                       | ✅ si `admin` (`requireElearningPublish`) |                  ❌                  |
| Voir SES apprenants tutorés            |                    ✅                     |       ✅ (scope rattachement)        |
| Répondre aux questions (tutorat)       |                    ✅                     |                  ✅                  |
| Corriger devoirs / questions manuelles |                    ✅                     |                  ✅                  |
| Octroyer des accès                     |       ✅ (`requireElearningAuthor`)       |                  ❌                  |
| Voir les coûts / réglages plateforme   |             selon `AdminRole`             |                  ❌                  |

> **Garde technique (formateur externe).** Réutilise `FormateurMagicLink` **[EXISTANT]** + un guard **`requireFormateurElearning()`** **[NEUF]** qui résout le `Trainer` depuis le token et **scope** les apprenants à ceux qui lui sont assignés (table de rattachement tuteur↔enrollment **[NEUF, V1]**). Jamais d'accès console admin.

---

## 4. P4 — Admin entreprise (`client_admin`) — **[V2]**

**Qui.** Le RH / responsable formation d'un `Client` B2B qui veut gérer **lui-même** les accès de ses équipes, sans passer par Axion-IA. **Livré en V2** (ADR-0002) ; la clé d'appartenance (`ElearningCompanyMembership`) et le rôle sont **conçus dès le MVP** pour éviter une refonte.

**Données / auth.** Compte du monde **apprenant** (PAS `AdminUser`) avec :

- `Trainee.passwordHash` **[NEUF]** (mot de passe attendu en B2B, ADR-0001),
- une appartenance `ElearningCompanyMembership { traineeId, clientId, role: client_admin }` **[NEUF]**.

Le rôle `client_admin` est **scopé à son `clientId`** : il ne voit jamais une autre entreprise. C'est la base du **multi-tenant** (filtrer toutes les requêtes par `clientId` — `02-ARCHITECTURE/multi-tenant-strategie.md`).

**Besoins (V2).**

- Inviter / désactiver des collaborateurs (dans la limite des sièges achetés — `Order`/pack entreprise).
- Affecter des cours à des collaborateurs ou des groupes.
- Suivre la progression agrégée de SON organisation (jamais les autres).
- Exporter les preuves de réalisation pour SON OPCO (le faisceau FOAD scopé entreprise).
- Branding léger par client (V2).

### Droits `client_admin` (V2, scope = son `clientId`)

| Action                                    | Droit | Scope                            |
| ----------------------------------------- | :---: | -------------------------------- |
| Inviter / révoquer un apprenant           |  ✅   | dans son `clientId`, ≤ sièges    |
| Affecter un cours à un salarié            |  ✅   | cours autorisés à son `clientId` |
| Voir progression/scores de ses salariés   |  ✅   | `WHERE clientId = self`          |
| Exporter preuves FOAD de son organisation |  ✅   | scope entreprise                 |
| Voir une autre entreprise                 |  ❌   | isolation tenant absolue         |
| Créer/éditer le contenu d'un cours        |  ❌   | authoring réservé Axion-IA       |
| Publier un cours global                   |  ❌   | —                                |
| Accéder à la console admin Axion-IA       |  ❌   | mondes séparés                   |

> **Garde technique (V2).** **`requireClientAdmin()`** **[NEUF]** résout le `ElearningCompanyMembership` et **injecte le `clientId`** dans un contexte de requête ; toutes les queries entreprise passent par un helper `scopedToClient(clientId)` (Prisma extension/where forcé). Le cloisonnement est la pièce la plus lourde → V2 dédiée.

---

## 5. P5 — Manager d'équipe (`client_manager`) — **[V2]**

**Qui.** Un chef d'équipe au sein d'un `Client`, à qui le `client_admin` délègue le **suivi** d'un sous-ensemble de collaborateurs, **sans** droit d'administration (pas d'invitation, pas d'achat de sièges).

**Données / auth.** Même socle que P4 (`ElearningCompanyMembership { role: client_manager }`), scopé à son `clientId` ET à un **groupe/équipe** (table `ElearningTeam` **[NEUF, V2]**).

**Besoins (V2).** Voir la progression de son équipe, relancer un apprenant en retard, exporter un rapport d'équipe. Lecture + relance, jamais d'écriture structurelle.

### Droits `client_manager` (V2, scope = son équipe dans son `clientId`)

| Action                                |               Droit                |
| ------------------------------------- | :--------------------------------: |
| Voir progression/scores de SON équipe |            ✅ (lecture)            |
| Relancer un apprenant en retard       | ✅ (déclenche email, pas d'octroi) |
| Exporter un rapport d'équipe          |                 ✅                 |
| Inviter / révoquer un apprenant       |    ❌ (réservé `client_admin`)     |
| Acheter des sièges                    |                 ❌                 |
| Voir une autre équipe / entreprise    |                 ❌                 |
| Authoring / publication               |                 ❌                 |

---

## 6. Personas transverses réutilisés (rappel, **[EXISTANT]**)

Ces personas existent déjà côté Qualiopi et **interagissent** avec le LMS sans être de nouveaux rôles à créer :

- **Référent handicap** — `AdminUser` (lecture des champs `Trainee.handicapDetailsChiffre` déchiffrés serveur). Pour le LMS : doit pouvoir vérifier l'**accessibilité WCAG 2.2 AA** des cours (sous-titres, alternative au drag, cibles ≥ 24px — obligation EAA). Pas de droit nouveau ; consomme le suivi e-learning en lecture.
- **Auditeur Qualiopi / OPCO** — accès en **lecture seule** (mode auditeur existant) pour consulter le **faisceau de preuves FOAD** (Ind.11, Ind.19, R.6313-3). Mappé sur `reader` ou un accès auditeur dédié existant. Le LMS doit **exposer** ces preuves, pas créer un rôle.
- **Système / workers** — acteurs non humains : `elearning-provisioning-worker`, `elearning-progress-worker`, `elearning-certificat-worker`, `elearning-video-worker`, `elearning-relance-worker` **[NEUF]** + réutilisation `email-worker` **[EXISTANT]**. Ils agissent avec des privilèges service (hors RBAC humain) et écrivent dans `ActivityLog`.

---

## 7. Synthèse — matrice rôles × capacités

Légende : ✅ autorisé · 🔒 scopé (soi / son entreprise / son équipe) · ❌ interdit · ⏳ V2.

| Capacité                             | learner | author (editor) |     admin Axion     | super_admin | formateur ext. | client_admin | client_manager |
| ------------------------------------ | :-----: | :-------------: | :-----------------: | :---------: | :------------: | :----------: | :------------: |
| Suivre un cours octroyé              |   🔒    |       🔒        |         🔒          |     🔒      |       ❌       |      🔒      |       🔒       |
| Voir sa propre progression           |   🔒    |       🔒        |         🔒          |     🔒      |       ❌       |      🔒      |       🔒       |
| Créer/éditer du contenu              |   ❌    |       ✅        |         ✅          |     ✅      |       ❌       |      ❌      |       ❌       |
| Publier un cours                     |   ❌    |       ❌        |         ✅          |     ✅      |       ❌       |      ❌      |       ❌       |
| Octroyer un accès / import CSV       |   ❌    |       ✅        |         ✅          |     ✅      |       ❌       |     ⏳🔒     |       ❌       |
| Tutorat / correction devoirs         |   ❌    |       ✅        |         ✅          |     ✅      |       🔒       |      ❌      |       ❌       |
| Émettre certificat / override unlock |   ❌    |       ❌        |         ✅          |     ✅      |       ❌       |      ❌      |       ❌       |
| Voir progression d'autrui            |   ❌    |   ✅(tutorés)   |         ✅          |     ✅      |       🔒       |     ⏳🔒     |      ⏳🔒      |
| Exporter preuves FOAD                |   ❌    |       ❌        |         ✅          |     ✅      |       ❌       |     ⏳🔒     |      ⏳🔒      |
| Archiver cours / purge / flags       |   ❌    |       ❌        | ❌(admin) ✅(super) |     ✅      |       ❌       |      ❌      |       ❌       |
| Accès console admin Axion-IA         |   ❌    |       ✅        |         ✅          |     ✅      |       ❌       |      ❌      |       ❌       |

---

## 8. Mapping technique des rôles (récapitulatif d'implémentation)

### 8.1 Monde admin (réutilisation totale, zéro nouveau rôle)

- Enum **`AdminRole`** `schema.prisma:276` **[EXISTANT]** — inchangé.
- Guards **`src/server/actions/knowledge/_guards.ts`** **[EXISTANT]** — réutilisés.
- Wrappers sémantiques **`src/server/elearning/auth/admin-guards.ts`** **[NEUF]** (alias, cf. §2).

### 8.2 Monde apprenant (nouveaux rôles, auth séparée — ADR-0001)

Champs/modèles **[NEUF, additifs, ADR-0008]** :

```prisma
// Ajout sur le modèle Trainee existant (schema.prisma:5274) — nullable, additif
model Trainee {
  // ...champs existants...
  passwordHash   String?   @map("password_hash") @db.VarChar(255)   // argon2id, optionnel (ADR-0001)
  elearningRole  ElearningLearnerRole @default(learner) @map("elearning_role")
  // relations inverses additives
  elearningEnrollments ElearningEnrollment[]
  companyMemberships   ElearningCompanyMembership[]
}

enum ElearningLearnerRole {
  learner          // apprenant standard (P1)
}

// Appartenance entreprise (V2-ready, posée au MVP) — multi-tenant (ADR-0002)
model ElearningCompanyMembership {
  id        String                @id @default(uuid()) @db.Uuid
  traineeId String                @map("trainee_id") @db.Uuid
  trainee   Trainee               @relation(fields: [traineeId], references: [id], onDelete: Cascade)
  clientId  String                @map("client_id") @db.Uuid     // → Client existant (B2B)
  client    Client                @relation(fields: [clientId], references: [id], onDelete: Cascade)
  role      ElearningCompanyRole  @default(member)
  teamId    String?               @map("team_id") @db.Uuid       // ElearningTeam (V2)
  createdAt DateTime              @default(now()) @map("created_at")

  @@unique([traineeId, clientId])
  @@index([clientId])
  @@map("elearning_company_memberships")
}

enum ElearningCompanyRole {
  member          // salarié simple (P1c)
  client_manager  // manager d'équipe (P5) — V2
  client_admin    // admin entreprise (P4) — V2
}
```

> **Pourquoi un rôle d'entreprise distinct du rôle apprenant** : un apprenant est `learner` partout ; sa **fonction entreprise** (`member`/`client_manager`/`client_admin`) dépend du `Client` → elle vit sur l'**appartenance** (`ElearningCompanyMembership`), pas sur le `Trainee`. Un même `Trainee` pourrait théoriquement appartenir à deux entreprises (cas rare consultant) → le rôle est par appartenance.

### 8.3 Guards apprenant/entreprise **[NEUF]** — `src/server/elearning/auth/guards.ts`

| Guard                                            | Résout                                             | Vérifie                                          | Utilisé par              |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| `requireLearner()`                               | cookie portail dédié → `traineeId`                 | token valide (réutilise `verifierToken` pattern) | toutes actions apprenant |
| `assertEnrollmentOwnership(learnerId, courseId)` | —                                                  | `ElearningEnrollment` actif                      | lecture cours/leçon/quiz |
| `requireFormateurElearning()`                    | `FormateurMagicLink` → `Trainer`                   | rattachement tuteur                              | tutorat/correction       |
| `requireClientAdmin()` **[V2]**                  | `ElearningCompanyMembership(role=client_admin)`    | scope `clientId`                                 | back-office entreprise   |
| `requireClientManager()` **[V2]**                | `ElearningCompanyMembership(role∈{manager,admin})` | scope `clientId`+`teamId`                        | suivi équipe             |

> **Règle d'or sécurité.** Aucune action apprenant ne lit/écrit sans `learnerId` issu du guard (jamais d'id passé par le client comme source de vérité). Aucune action entreprise (V2) ne lit sans `clientId` issu de `requireClientAdmin/Manager`. Mirroir exact de la rigueur de `getEspaceStagiaire` (`portail-service.ts`) qui filtre toujours par `traineeId`.

### 8.4 Frontière des deux mondes (rappel non négociable)

- Cookie portail apprenant **≠** session NextAuth admin (deux cookies, deux middlewares).
- Un compte apprenant **ne peut jamais** obtenir un `AdminRole`.
- L'auth apprenant est dans `src/server/elearning/auth/**` **[NEUF]** ; NextAuth (`src/auth.ts`) **[EXISTANT]** n'est **pas** modifié.

---

## 9. Décisions ouvertes / à arbitrer

1. **Cookie portail unique vs distinct e-learning.** Réutiliser le cookie `PortailAcces` existant (un seul espace `/portail`) **vs** un cookie e-learning dédié. Reco : **réutiliser** le portail existant (`/portail/mon-espace` enrichi d'une section « Mes cours ») pour une expérience unifiée présentiel↔e-learning. À confirmer dans `04-BACKEND/05-authentification-apprenant.md`.
2. **`elearningRole` sur Trainee** : aujourd'hui mono-valeur (`learner`). Si un futur besoin « apprenant qui devient mentor » apparaît, basculer vers une table de rôles. Volontairement minimal au MVP.
3. **Transparence RGPD employeur↔salarié** (P1c/P4) : information préalable obligatoire que l'employeur suit la progression → à cadrer dans `08-CONFORMITE/05-rgpd-conservation-preuves.md`.
4. **Tuteur externe correction** : table de rattachement tuteur↔enrollment (V1) — modéliser dans `03-DATA-MODEL/02-schema-progression-tracking.md`.

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth hybride), ADR-0002 (multi-tenant V2), ADR-0007 (cloisonnement code), ADR-0008 (migrations additives)
- `01-VISION-PERIMETRE/perimetre-mvp-v1-v2.md` — ce qui est MVP vs V2 par persona
- `02-ARCHITECTURE/multi-tenant-strategie.md` — cloisonnement `clientId`, P4/P5
- `02-ARCHITECTURE/reutilisation-existant.md` — réutilisation `Trainee`/`Client`/`PortailAcces`/RBAC
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — `ElearningCourse/Module/Lesson`, enums unlock
- `03-DATA-MODEL/02-schema-progression-tracking.md` — `ElearningEnrollment`, `LessonProgress`, rattachement tuteur
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee.passwordHash`, `ElearningCompanyMembership`, rôles
- `04-BACKEND/05-authentification-apprenant.md` — guards `requireLearner`/`requireClientAdmin`, cookie portail
- `04-BACKEND/06-import-masse-provisioning.md` — import CSV, `elearning-provisioning-worker`
- `06-CONSOLE-ADMIN/01-navigation-structure.md` — groupe `elearning` dans `admin-nav.ts`
- `06-CONSOLE-ADMIN/04-gestion-apprenants.md` / `05-gestion-acces-entreprises.md` — écrans P2/P4
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind.11 (évaluations), Ind.19 (assistance/tuteur P3)
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — transparence employeur, conservation
