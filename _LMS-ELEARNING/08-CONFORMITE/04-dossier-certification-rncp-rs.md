# Dossier de certification RNCP / RS à déposer à France Compétences

> **Statut** : document de cadrage conformité (hors code). Source de vérité pour la préparation du dossier d'enregistrement d'une certification au **RNCP** (Répertoire National des Certifications Professionnelles) ou au **RS** (Répertoire Spécifique) auprès de **France Compétences**.
>
> **À qui s'adresse ce document** : Will (dépôt du dossier) + l'équipe de dev senior (ce que la plateforme LMS doit produire comme **preuve technique** à l'appui du dossier et de la mise en œuvre).
>
> **Périmètre** : ce document ne « code » rien. Il **mappe** chaque exigence France Compétences à (a) ce que **Will** doit fournir hors plateforme et (b) ce que la **plateforme** fournit comme preuve/fonction. On distingue partout **EXISTANT** (déjà dans le code, à réutiliser) de **NEUF** (à construire, cf. data model et backend).
>
> Dernière mise à jour : 2026-06-27.

---

## 0. TL;DR (pour Will, en une page)

1. **Le CPF est verrouillé tant qu'il n'y a pas de certification RNCP ou RS** (ADR-LMS-0003). Ce n'est **pas** la modalité e-learning qui bloque (la FOAD est éligible CPF), c'est l'**absence de certification enregistrée**. Donc : pas de certif → pas de CPF/EDOF, point.
2. **Deux répertoires, deux logiques** :
   - **RNCP** = certification de **métier** (« qualification professionnelle » entière, niveau 3 à 8). Dossier lourd, exige des **preuves d'insertion/emploi** sur plusieurs promotions. Long (souvent 12-24 mois).
   - **RS** = certification de **compétence(s) ou bloc(s)** complémentaires (ex. « Déployer des cas d'usage d'IA générative en conformité RGPD »). Plus accessible pour un OF IA, mieux aligné avec un catalogue e-learning. **C'est très probablement la bonne cible MVP.**
3. **Ce qui dépend de Will (hors code)** : référentiels (activités/compétences/évaluation), preuves de besoin marché, jury indépendant, partenaires, suivi cohortes/insertion, charte d'examen, modalités d'évaluation à distance fiables.
4. **Ce que la plateforme fournit (code)** : la **chaîne de preuve numérique** — identité de l'apprenant, traces d'évaluation horodatées et signées, anti-fraude technique (randomisation, temps serveur, journalisation), absence d'assistance pendant l'examen, certificat de réalisation, archivage légal. Tout est **certification-ready dès le MVP**, **EDOF gated par flag** (`EDOF_ENABLED=false`).
5. **Ordre conseillé** : viser une **certification RS** sur un bloc IA, construire les preuves d'évaluation via le **moteur de quiz/évaluation NEUF** + le **Formation Engine EXISTANT**, déposer le dossier, puis activer `EDOF_ENABLED` une fois l'enregistrement obtenu.

---

## 1. Cadre réglementaire de l'enregistrement

### 1.1 Textes de référence

| Texte                                                                                                                          | Objet                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Code du travail, art. L.6113-1 à L.6113-9**                                                                                  | Création de France Compétences, RNCP/RS, définition de la certification professionnelle, blocs de compétences                             |
| **Art. R.6113-9 à R.6113-16**                                                                                                  | Procédure d'enregistrement, critères d'examen des demandes                                                                                |
| **Décision et notes de doctrine France Compétences** (grilles d'instruction RNCP / RS)                                         | Critères opposables d'instruction (référentiels, jury, insertion, qualité de l'évaluation)                                                |
| **Art. D.6313-3-1 (FOAD)**                                                                                                     | 3 conditions cumulatives de la formation à distance (assistance, information durée, évaluations jalonnantes) — cf. `01-foad-d6313-3-1.md` |
| **Art. R.6313-3**                                                                                                              | Preuve libre de la réalisation (pas d'émargement obligatoire ; faisceau d'indices) — cf. `06-tracabilite-preuves-realisation.md`          |
| **RGPD + délibérations CNIL** (proctoring/examens en ligne, notamment recommandations 2021-2022 sur la surveillance d'examens) | Proportionnalité de tout dispositif de surveillance à distance                                                                            |
| **Loi n° 2022-1587 (anti-fraude CPF)** + cadre EDOF                                                                            | Entrée effective, service fait, FranceConnect+ — cf. `03-cpf-edof-readiness.md`                                                           |

> ⚠️ Les **grilles d'instruction** de France Compétences sont la vraie « checklist » opposable. Ce document s'y aligne mais **Will doit télécharger la version en vigueur** au moment du dépôt (elles évoluent). Les rubriques ci-dessous reprennent la structure stable des critères.

### 1.2 RNCP vs RS — choix de la cible

| Critère                             | **RNCP**                                             | **RS**                                                                                  |
| ----------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Objet                               | Métier / qualification complète                      | Compétence(s) transversale(s) ou complémentaire(s), habilitation                        |
| Niveau                              | Niveau de qualification 3→8                          | Pas de niveau (compétence)                                                              |
| Blocs de compétences                | **Obligatoires** (découpage en blocs capitalisables) | Non (objet = compétence ciblée)                                                         |
| Preuve d'insertion                  | **Exigée** (devenir des certifiés, emploi)           | Allégée (valeur d'usage sur le marché)                                                  |
| Délai/effort                        | Lourd, plusieurs promotions                          | Plus rapide                                                                             |
| Adapté à un catalogue e-learning IA | Moyen (sauf parcours métier abouti)                  | **Fort** (ex. « Sécuriser et industrialiser des usages d'IA générative en entreprise ») |
| **Recommandation Axion-IA**         | V2+ si parcours métier mûr                           | **MVP / V1 : viser le RS**                                                              |

**Décision de cadrage** : le LMS est conçu pour servir **les deux**, mais la première cible recommandée est une **certification RS** sur un ou deux blocs IA. Le data model (blocs/compétences) est posé pour ne **pas** bloquer un passage RNCP ultérieur (cf. §4).

---

## 2. Les exigences d'enregistrement, traduites en obligations plateforme

France Compétences instruit sur **5 grands axes**. Pour chacun : ce qui relève de **Will** (dossier papier/process) vs de la **plateforme** (preuve technique). Légende : **[WILL]** = hors code · **[EXISTANT]** = code déjà présent · **[NEUF]** = à construire.

### 2.1 Axe A — Référentiels (activités / compétences / évaluation)

L'enregistrement exige **trois référentiels articulés** :

1. **Référentiel d'activités** : ce que la personne certifiée sait _faire_ (situations professionnelles).
2. **Référentiel de compétences** : les compétences décomposées, regroupées en **blocs** (RNCP) ou en compétence(s) ciblée(s) (RS).
3. **Référentiel d'évaluation** : pour **chaque** compétence, les **modalités**, **critères** et **indicateurs** d'évaluation + les **conditions** (durée, contexte, ressources autorisées).

| Élément                                                                   | Responsable                                | Apport plateforme                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rédaction des 3 référentiels                                              | **[WILL]** + ingénierie pédagogique        | —                                                                                                                                                                                                                                                      |
| Découpage en blocs / compétences                                          | **[WILL]**                                 | Modélisé : `ElearningCompetence` + `ElearningBlocCompetences` **[NEUF]** (cf. §4), reliés aux `ElearningCourse`/`ElearningModule` **[EXISTANT data model 01]**                                                                                         |
| Génération du référentiel d'évaluation (objectifs → critères → questions) | **[WILL]** valide ; **[EXISTANT]** assiste | **Formation Engine** (`qualiopi-formation-engine-worker.ts`) : `intention → structure → evaluateQuality → refine`, `GrilleQualiteConfig`, `runAdversarialCritique`. Réutilisé pour proposer un brouillon de référentiel d'évaluation (Backward Design) |
| Alignement objectif ↔ évaluation (traçabilité)                            | **[NEUF]**                                 | Champ `objectifRef` déjà présent dans `EvaluationAcquis.competences` JSON **[EXISTANT]** ; à généraliser : chaque `Question` du quiz **[NEUF]** porte un `competenceId` (cf. §4) → matrice de couverture compétence × évaluation exportable            |

**Preuve produite par la plateforme** : un **export « matrice de couverture »** (compétence → leçons qui l'enseignent → questions/épreuves qui l'évaluent → critères/seuils). Cet export est l'élément qui démontre à l'instructeur que **chaque compétence du référentiel est réellement évaluée**. Voir §6 (export conformité).

### 2.2 Axe B — Qualité et fiabilité de l'évaluation (le cœur du dossier pour un LMS)

C'est l'axe où la **plateforme pèse le plus**. France Compétences (et a fortiori l'évaluation **à distance**) exige de garantir :

1. **L'identité** du candidat évalué.
2. **L'absence de fraude** (pas de triche, pas de sous-traitance de l'épreuve).
3. **L'absence d'assistance** pendant l'épreuve certifiante (le tutorat FOAD ≠ aide pendant l'examen).
4. La **traçabilité** complète et **inaltérable** des résultats.
5. Des **modalités d'évaluation explicites** (durée, conditions, critères, jury).

> ⚖️ **Point CNIL central** : l'évaluation à distance est **autorisée** ; le **proctoring (télésurveillance)** n'est **pas obligatoire**. La CNIL impose la **proportionnalité** : on ne déploie de la surveillance que si l'enjeu (high-stakes) le justifie, on privilégie les **alternatives moins intrusives**, et on offre une **option** (ex. passage en centre / visio jury). Le LMS doit donc proposer **plusieurs niveaux** d'assurance, pas un proctoring imposé. Détail §3.

#### Tableau de garanties (Axe B)

| Garantie exigée                                              | Responsable                             | Apport plateforme — **EXISTANT / NEUF**                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identité** au login                                        | Mixte                                   | **[EXISTANT]** auth apprenant magic-link (`PortailAcces`, token 64 hex, cookie HttpOnly 90j) + **[NEUF]** `passwordHash` argon2id optionnel (ADR-0001). Pour examen certifiant : **step-up** (re-auth + déclaration sur l'honneur horodatée). FranceConnect+ via EDOF **[NEUF, gated `EDOF_ENABLED`]** quand CPF activé |
| **Identité** pendant l'épreuve (high-stakes)                 | Mixte                                   | **[NEUF]** options graduées : (1) attestation sur l'honneur + journal d'événements ; (2) vérification pièce d'identité par un humain en visio jury ; (3) proctoring tiers (intégration optionnelle, derrière flag) — cf. §3                                                                                             |
| **Anti-fraude** technique                                    | **[NEUF]**                              | Moteur de quiz : `shuffle` questions ET réponses, **tirage aléatoire N parmi M** depuis banque, **temps serveur** (pas client), seuil/tentatives/pondération, **rationale** masqué avant soumission. Modèles `Quiz`/`Question`/`QuizAttempt` **[NEUF, data model 03]**                                                  |
| **Absence d'assistance** pendant l'épreuve                   | **[NEUF]**                              | Le **tuteur RAG** (`elearning-tuteur-worker` **[NEUF]**) est **désactivé/verrouillé** sur les leçons/quiz marqués `epreuveCertifiante=true` ; journalisé. Distinction nette : assistance **pédagogique** FOAD (Ind.19, autorisée) vs assistance **pendant l'examen** (interdite, bloquée + tracée)                      |
| **Traçabilité inaltérable** des résultats                    | Mixte                                   | **[EXISTANT]** `DocumentGenere.hashSha256` + `qrToken` (vérif publique `timingSafeEqual`) ; **[NEUF]** `QuizAttempt` immuable (append-only, pas d'`updatedAt` métier sur les réponses validées) + `ElearningTraceEvent` (grammaire xAPI verbe/objet, ADR-0006) horodaté serveur                                         |
| **Modalités explicites** (durée, conditions, critères, jury) | **[WILL]** rédige ; **[NEUF]** applique | Champs `dureeLimiteSec`, `tentativesMax`, `seuilReussitePct` (déjà `ElearningCourse.seuilReussitePct` **[EXISTANT data model 01]**), `conditionsPassation` sur le `Quiz` **[NEUF]** ; **jury** modélisé `ElearningJury` / `ElearningDeliberation` **[NEUF]** (§4)                                                       |
| **Décision de certification = jury, pas la machine**         | **[WILL]** + **[NEUF]**                 | Le LMS **calcule** un score et **propose** un résultat, mais la **délivrance** est validée par un **jury** (rôle admin dédié) → `ElearningCertificationDecision` **[NEUF]**. Jamais d'auto-délivrance d'un titre certifiant (≠ certificat de _réalisation_ qui, lui, est automatisable)                                 |

#### Distinction capitale à matérialiser dans le code

| Document                                                          | Nature                                                         | Délivrance                                         | Modèle                                                                                                                                |
| ----------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Certificat de réalisation** (modèle officiel, heures réalisées) | Preuve de **réalisation** FOAD (obligatoire depuis 01/06/2020) | **Automatisable** dès complétion + assiduité       | **[EXISTANT]** `DocumentGenere` (type à ajouter) + QR ; généré par `elearning-certificat-worker` **[NEUF]**                           |
| **Parchemin / certificat de certification RNCP-RS**               | Preuve de **certification** (titre enregistré)                 | **Jamais auto** : décision de **jury** obligatoire | **[NEUF]** `ElearningCertificationDecision` → `DocumentGenere` (type `certification_rncp` / `certification_rs`) après validation jury |

### 2.3 Axe C — Contrôle de la mise en œuvre (le certificateur surveille ses sessions)

France Compétences exige que le **certificateur** (= Axion-IA, ou un partenaire habilité) **contrôle** la façon dont la certification est mise en œuvre, y compris par d'éventuels **partenaires/habilités**. Il faut **piloter, tracer, auditer**.

| Exigence                                                         | Apport plateforme                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journal exhaustif des sessions d'examen                          | **[NEUF]** `ElearningExamSession` (qui, quoi, quand, où, conditions, IP hashée, durée serveur) + `ElearningTraceEvent`                                                                                                          |
| Habilitation et contrôle des évaluateurs/partenaires             | **[NEUF]** rôle RBAC `examinateur` / `jury` ; en attendant, réutilise le RBAC **[EXISTANT]** `requireAdminRead/Write/Publish/Delete` (`src/server/actions/knowledge/_guards.ts`, rôles `super_admin`/`admin`/`editor`/`reader`) |
| Statistiques de réussite / d'équité (par épreuve, item-analysis) | **[NEUF]** `elearning-analytics` (reporting) : taux de réussite par question, par bloc, alerte items biaisés                                                                                                                    |
| Conservation des copies et délibérations                         | **[EXISTANT]** R2 (`uploadToR2`) + `DocumentGenere` ; **[NEUF]** `QuizAttempt` archivé                                                                                                                                          |
| Audit a posteriori (rejouer une session)                         | **[NEUF]** reconstruction depuis `ElearningTraceEvent` (event sourcing, miroir du pattern `FormationTransition` **[EXISTANT]**)                                                                                                 |

### 2.4 Axe D — Évaluation à distance fiable (synthèse opposable)

Récapitulatif des **3 garanties dures** pour l'évaluation à distance, telles qu'attendues par les instructeurs RNCP/RS, et leur réalisation technique :

1. **Garantir l'identité** → step-up auth + déclaration horodatée + (option) vérif humaine/visio + (option, flag) proctoring tiers + (CPF) FranceConnect+.
2. **Garantir l'anti-fraude** → randomisation (questions+réponses), banque + tirage N/M, temps serveur, verrouillage navigation hors-épreuve journalisé, copies immuables hashées.
3. **Garantir l'absence d'assistance** → tuteur RAG **coupé** pendant l'épreuve, désactivation des aides/indices, journalisation des tentatives de sortie/retour, et **jury** décisionnaire.

> **Proctoring : non obligatoire.** On l'implémente en **option activable** (flag `PROCTORING_ENABLED=false` par défaut) et toujours assortie d'une **alternative non intrusive** (passage en centre, jury en visio synchrone). Voir §3 et §5 (CNIL).

### 2.5 Axe E — Procédure, partenaires, suivi & révision

| Exigence France Compétences                        | Responsable                             | Apport plateforme                                                                                                                |
| -------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Demande en ligne (espace certificateur FC)         | **[WILL]**                              | — (hors plateforme)                                                                                                              |
| Preuve du besoin marché / opportunité              | **[WILL]** (études, lettres employeurs) | Le LMS fournit des **statistiques d'usage/demande** (inscriptions, complétion) en appui                                          |
| Convention de partenariat (si co-certif/habilités) | **[WILL]**                              | Modèle de suivi des habilités **[NEUF]** (§2.3)                                                                                  |
| **Suivi des cohortes & insertion** (RNCP surtout)  | **[WILL]** + **[NEUF]**                 | `ElearningCohorte` + enquêtes à 6/12 mois via questionnaires (réutilise le pattern **[EXISTANT]** `Questionnaire` token portail) |
| Révision périodique / renouvellement               | **[WILL]**                              | Historique de versions `ElearningCourse.version` **[EXISTANT]** + archivage des référentiels                                     |

---

## 3. Évaluation à distance : architecture des garanties (spec technique)

Niveaux d'assurance, du moins au plus intrusif. **Le niveau est un attribut de l'épreuve, pas une politique globale** — on choisit le minimum proportionné (CNIL §5).

| Niveau | Nom                                       | Mécanismes                                                                                                       | Quand l'utiliser                        | Statut                                                                          |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| **N0** | Auto-évaluation formative                 | Quiz sans enjeu, feedback immédiat, rationale visible                                                            | Pédagogie, pas de certif                | **[NEUF]** moteur quiz de base                                                  |
| **N1** | Évaluation tracée                         | Temps serveur, randomisation, banque N/M, copie immuable hashée, journal d'événements, déclaration sur l'honneur | **Défaut RS** pour la plupart des blocs | **[NEUF]**                                                                      |
| **N2** | Évaluation supervisée à distance (humain) | N1 + **visio jury synchrone** (vérif pièce d'identité, surveillance par un examinateur)                          | Blocs à enjeu / RNCP                    | **[NEUF]** planif + lien visio (réutilise modalité `distanciel` **[EXISTANT]**) |
| **N3** | Proctoring tiers (option)                 | N1 + service de télésurveillance externe (flag `PROCTORING_ENABLED`) **+ alternative N2 obligatoire**            | High-stakes uniquement, si exigé        | **[NEUF, gated]**                                                               |
| **N4** | Passage en centre / présentiel            | Épreuve sur site, identité physique                                                                              | Maximum d'assurance                     | **[EXISTANT]** logique session présentielle                                     |

**Mapping data model** : chaque `Quiz` certifiant porte `niveauAssurance` (enum `N0..N4`), `epreuveCertifiante: Boolean`, `dureeLimiteSec`, `conditionsPassation`. La sélection du niveau est **justifiée** (champ `justificationProportionnalite` — trace CNIL, cf. §5).

**Absence d'assistance (N1+)** — règles dures à coder :

- `epreuveCertifiante=true` ⇒ le worker tuteur RAG **refuse** de répondre (réponse standard « assistance indisponible pendant une épreuve certifiante ») et **journalise** la tentative.
- Les indices, rationale, et « voir la correction » sont **masqués** jusqu'à clôture serveur de la tentative.
- Tout `blur`/changement d'onglet/perte de focus est **journalisé** (`ElearningTraceEvent`, verbe `suspended`/`resumed`) — **sans** capture invasive (proportionnalité).

---

## 4. Data model NEUF pour la certification (additif, ADR-0008)

> Tout est **additif** (CREATE TABLE / colonnes nullable). Cohérent avec le cœur LMS (`03-DATA-MODEL/01`) et le moteur de quiz (`03-DATA-MODEL/03`, à rédiger). Conventions repo : `id` UUID `@db.Uuid`, `@map` snake_case, enums Prisma, index sur FK, timestamps. Code sous `src/server/elearning/**` (ADR-0007).

### 4.1 Référentiels (blocs / compétences)

```prisma
enum ElearningCertificationType {
  rncp   // titre / qualification (blocs obligatoires)
  rs     // compétence(s) ciblée(s)
}

enum ElearningCertificationStatut {
  projet        // en construction, pas déposé
  depose        // dossier déposé à France Compétences
  enregistre    // enregistré (numéro RNCP/RS actif)
  suspendu
  expire
}

/// Une certification enregistrable (ou en projet). 1 par titre/compétence visée.
model ElearningCertification {
  id              String                       @id @default(uuid()) @db.Uuid
  type            ElearningCertificationType
  statut          ElearningCertificationStatut @default(projet)
  intitule        String                       @db.VarChar(300)
  /// Numéro officiel (RNCP12345 / RS6789) une fois enregistré. Null tant que projet/déposé.
  numeroFc        String?                      @unique @map("numero_fc") @db.VarChar(30)
  niveauQualif    Int?                         @map("niveau_qualif")    // 3..8, RNCP only
  dateEnregistrement DateTime?                 @map("date_enregistrement")
  dateEcheance    DateTime?                    @map("date_echeance")    // fin de validité de l'enregistrement
  referentielActivitesJson   Json @default("[]") @map("referentiel_activites_json")
  referentielEvaluationJson  Json @default("[]") @map("referentiel_evaluation_json")
  blocs           ElearningBlocCompetences[]
  decisions       ElearningCertificationDecision[]
  createdAt       DateTime                     @default(now()) @map("created_at")
  updatedAt       DateTime                     @updatedAt @map("updated_at")

  @@index([statut])
  @@map("elearning_certifications")
}

/// Bloc de compétences (RNCP) ou regroupement (RS). Capitalisable.
model ElearningBlocCompetences {
  id              String                  @id @default(uuid()) @db.Uuid
  certificationId String                  @map("certification_id") @db.Uuid
  certification   ElearningCertification  @relation(fields: [certificationId], references: [id], onDelete: Cascade)
  code            String                  @db.VarChar(30)   // ex. "BC01"
  intitule        String                  @db.VarChar(300)
  ordre           Int
  competences     ElearningCompetence[]
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  @@unique([certificationId, code])
  @@index([certificationId])
  @@map("elearning_blocs_competences")
}

/// Compétence atomique évaluable. Reliée au contenu (cours/leçons) et aux items.
model ElearningCompetence {
  id              String                  @id @default(uuid()) @db.Uuid
  blocId          String                  @map("bloc_id") @db.Uuid
  bloc            ElearningBlocCompetences @relation(fields: [blocId], references: [id], onDelete: Cascade)
  code            String                  @db.VarChar(30)
  libelle         String                  @db.VarChar(400)
  criteresJson    Json                    @default("[]") @map("criteres_json")    // critères + indicateurs d'évaluation
  /// Cours/leçons qui ENSEIGNENT cette compétence (couverture pédagogique).
  courseId        String?                 @map("course_id") @db.Uuid              // ElearningCourse (data model 01)
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  @@unique([blocId, code])
  @@index([blocId])
  @@index([courseId])
  @@map("elearning_competences")
}
```

> **Lien avec le moteur de quiz (data model 03, NEUF)** : `Question.competenceId` (nullable) pointe vers `ElearningCompetence.id`. C'est ce lien qui produit la **matrice de couverture** (compétence ENSEIGNÉE par X leçons, ÉVALUÉE par Y questions/épreuves). Côté `EvaluationAcquis` **[EXISTANT]**, le JSON `competences` porte déjà `objectifRef` — on harmonise sur `competenceId`.

### 4.2 Sessions d'examen, jury, décision

```prisma
enum ElearningNiveauAssurance { n0 n1 n2 n3 n4 }   // cf. §3

enum ElearningExamSessionStatut {
  planifiee
  en_cours
  cloturee        // candidat a terminé, en attente jury
  invalidee       // incident (fraude présumée, technique)
}

/// Une passation d'épreuve certifiante par un apprenant. Append-only une fois cloturee.
model ElearningExamSession {
  id              String                     @id @default(uuid()) @db.Uuid
  /// Apprenant : réutilise Trainee (PII existante) — pas de duplication.
  traineeId       String                     @map("trainee_id") @db.Uuid
  trainee         Trainee                    @relation(fields: [traineeId], references: [id], onDelete: Restrict)
  certificationId String                     @map("certification_id") @db.Uuid
  blocId          String?                    @map("bloc_id") @db.Uuid          // épreuve d'un bloc précis
  quizId          String                     @map("quiz_id") @db.Uuid          // Quiz (data model 03)
  niveauAssurance ElearningNiveauAssurance   @map("niveau_assurance")
  statut          ElearningExamSessionStatut @default(planifiee)
  /// Horodatages SERVEUR (jamais client) — preuve de durée/déroulé.
  startedAt       DateTime?                  @map("started_at")
  submittedAt     DateTime?                  @map("submitted_at")
  dureeServeurSec Int?                       @map("duree_serveur_sec")
  /// IP hashée (RGPD : SHA-256 + sel IP_HASH_SALT, jamais en clair). Cf. §5.
  ipHash          String?                    @map("ip_hash") @db.VarChar(64)
  userAgent       String?                    @map("user_agent") @db.Text
  /// Score calculé par la machine (proposition, PAS décision).
  scoreProposePct Int?                       @map("score_propose_pct")
  /// Lien vers la tentative immuable (data model 03).
  quizAttemptId   String?                    @map("quiz_attempt_id") @db.Uuid
  justificationProportionnalite String?      @map("justification_proportionnalite") @db.Text  // trace CNIL
  createdAt       DateTime                   @default(now()) @map("created_at")
  updatedAt       DateTime                   @updatedAt @map("updated_at")

  decision        ElearningCertificationDecision?
  evenements      ElearningTraceEvent[]

  @@index([traineeId])
  @@index([certificationId])
  @@index([statut])
  @@map("elearning_exam_sessions")
}

enum ElearningDecisionResultat { admis ajourne absent fraude }

/// Décision de JURY (humaine). Seule source de délivrance d'un titre certifiant.
model ElearningCertificationDecision {
  id              String                  @id @default(uuid()) @db.Uuid
  certificationId String                  @map("certification_id") @db.Uuid
  certification   ElearningCertification  @relation(fields: [certificationId], references: [id], onDelete: Restrict)
  examSessionId   String                  @unique @map("exam_session_id") @db.Uuid
  examSession     ElearningExamSession    @relation(fields: [examSessionId], references: [id], onDelete: Restrict)
  resultat        ElearningDecisionResultat
  /// Membres du jury (AdminUser ids) + horodatage de délibération.
  juryJson        Json                    @default("[]") @map("jury_json")
  deliberationAt  DateTime                @map("deliberation_at")
  motivation      String?                 @db.Text
  /// Parchemin émis (DocumentGenere type certification_*). Null si ajourné.
  documentId      String?                 @map("document_id") @db.Uuid
  document        DocumentGenere?         @relation(fields: [documentId], references: [id], onDelete: SetNull)
  createdAt       DateTime                @default(now()) @map("created_at")

  @@index([certificationId])
  @@map("elearning_certification_decisions")
}
```

### 4.3 Traçabilité (event sourcing, grammaire xAPI — ADR-0006)

```prisma
/// Trace inaltérable d'événements (verbe/objet xAPI-like). Append-only.
/// Sert l'audit a posteriori (Axe C) et le faisceau de preuves FOAD (R.6313-3).
model ElearningTraceEvent {
  id            String   @id @default(uuid()) @db.Uuid
  examSessionId String?  @map("exam_session_id") @db.Uuid
  examSession   ElearningExamSession? @relation(fields: [examSessionId], references: [id], onDelete: Cascade)
  traineeId     String   @map("trainee_id") @db.Uuid
  verbe         String   @db.VarChar(40)   // started, answered, suspended, resumed, submitted, assisted_blocked...
  objetType     String   @map("objet_type") @db.VarChar(40)  // exam | question | lesson | tutor
  objetId       String   @map("objet_id") @db.Uuid
  donneesJson   Json     @default("{}") @map("donnees_json")
  /// Horodatage SERVEUR.
  occurredAt    DateTime @default(now()) @map("occurred_at")

  @@index([examSessionId, occurredAt])
  @@index([traineeId])
  @@index([verbe])
  @@map("elearning_trace_events")
}
```

### 4.4 Champs/relations inverses additifs (modèles existants)

```prisma
// model Trainee { ... }            // [EXISTANT] — relations inverses, sans colonne
  examSessions ElearningExamSession[]
  traceEvents  ElearningTraceEvent[]
  // passwordHash String? (ADR-0001, déjà prévu en 04-schema-comptes-acces-auth.md)

// model DocumentGenere { ... }     // [EXISTANT]
  certificationDecisions ElearningCertificationDecision[]
// + ajouter au enum DocumentType : certificat_realisation_elearning, certification_rncp, certification_rs
```

> Ces ajouts sont des **relations inverses sans colonne** côté `Trainee`/`DocumentGenere` (la FK est portée par les nouvelles tables) → migration purement additive, zéro risque (cf. ADR-0008 et `03-DATA-MODEL/06-strategie-migrations.md`).

---

## 5. RGPD & proportionnalité (CNIL) — ce qui est opposable

L'évaluation à distance touche à des données potentiellement sensibles (surveillance). Règles **non négociables** :

| Principe CNIL                  | Application Axion-IA                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proportionnalité**           | Niveau d'assurance minimal suffisant (N1 par défaut). Proctoring (N3) **jamais imposé**, toujours assorti d'une **alternative** (N2 visio jury / N4 centre). Champ `justificationProportionnalite` obligatoire si N≥2                     |
| **Minimisation**               | Pas de captation biométrique/vidéo en N1. IP **hashée** (SHA-256 + sel `IP_HASH_SALT`, pattern **[EXISTANT]** image-bank), jamais stockée en clair. User-agent conservé court                                                             |
| **Information & consentement** | Avant toute épreuve surveillée : écran d'info (finalité, durée de conservation, base légale, droits, alternative). Réutilise le pattern de consentement **[EXISTANT]** `Trainee.consentementVersion/At`                                   |
| **Base légale**                | Exécution du contrat de formation + obligation légale (certification). Pas de consentement « creux » pour le proctoring : l'alternative non surveillée doit rester réellement praticable                                                  |
| **Durée de conservation**      | Logs techniques 6 mois–1 an (CNIL 2021-122) ; preuves de réalisation 3-5 ans (L.6362-6) ; comptable 10 ans (L.123-22) ; fiscal/OPCO 6 ans (L.102B LPF). Purge différenciée par type (cf. `05-rgpd-conservation-preuves.md`)               |
| **Droits**                     | Accès/effacement via le mécanisme **[EXISTANT]** `RgpdDemande` + `Trainee.deletedAt` (soft-delete). Les preuves légales sous obligation de conservation sont **exclues** de l'effacement immédiat (conflit géré : anonymisation différée) |
| **Sous-traitance proctoring**  | Si N3 activé : DPA avec le prestataire, hébergement UE privilégié, registre des traitements mis à jour (**[WILL]**)                                                                                                                       |

> ⚠️ Le proctoring sans alternative crédible est régulièrement **sanctionné** comme disproportionné. La conception « N3 optionnel + alternative obligatoire » est ce qui rend le dispositif défendable.

---

## 6. Ce que la plateforme produit comme PREUVE (exports pour le dossier et le contrôle)

Fonctions d'export **[NEUF]** (server actions sous `src/server/elearning/exports/**`, déclenchées depuis la console admin) :

| Export                                                  | Contenu                                                                                                                                        | Sert quel axe                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Matrice de couverture**                               | compétence → leçons (enseignement) → questions/épreuves (évaluation) → critères/seuils. CSV + PDF                                              | Axe A (référentiels) + Axe B (chaque compétence est évaluée) |
| **Dossier de session d'examen**                         | par `ElearningExamSession` : identité, horodatages serveur, conditions, copie immuable, événements, décision jury, score. PDF horodaté + hashé | Axe B + Axe C (audit)                                        |
| **Statistiques d'évaluation (item-analysis)**           | taux de réussite par question/bloc, items anormaux, équité                                                                                     | Axe C (contrôle de la mise en œuvre)                         |
| **Registre des décisions de jury**                      | toutes les `ElearningCertificationDecision` (admis/ajourné/absent/fraude) + délibérations                                                      | Axe B + Axe E                                                |
| **Suivi de cohorte / insertion**                        | cohortes, enquêtes 6/12 mois (questionnaires)                                                                                                  | Axe E (RNCP : devenir des certifiés)                         |
| **Faisceau de preuves FOAD**                            | assiduité (logs), évaluations jalonnantes, traces d'assistance — cf. `06-tracabilite-preuves-realisation.md`                                   | Conformité FOAD (D.6313-3-1, R.6313-3) — finance OPCO/CPF    |
| **Certificat de réalisation** (modèle officiel, heures) | par apprenant, QR vérifiable                                                                                                                   | Obligation 01/06/2020 + service fait EDOF                    |

**Réutilisation** : génération PDF via `@react-pdf/renderer` **[EXISTANT]** (templates `qualiopi-*.tsx` à dupliquer en `elearning-*.tsx`) ; hash + QR via `DocumentGenere.hashSha256`/`qrToken` **[EXISTANT]** ; vérification publique via la route **[EXISTANT]** `src/app/[locale]/verifier-attestation/[token]/page.tsx` (à étendre pour les types certification) ; stockage R2 via `src/lib/r2-storage.ts` **[EXISTANT]**.

---

## 7. Workers & jobs (BullMQ) — NEUF

Cloisonnés sous `src/server/queue/workers/elearning-*-worker.ts` (ADR-0007), désactivés au build (`BULLMQ_DISABLED=true`, stub.invalid) :

| Worker                               | Rôle                                                                                                                             | Réutilise                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `elearning-certificat-worker.ts`     | Génère le **certificat de réalisation** (auto, à complétion + assiduité)                                                         | `DocumentGenere`, `@react-pdf/renderer`, R2, QR **[EXISTANT]** |
| `elearning-parchemin-worker.ts`      | Émet le **parchemin certifiant** **après** décision jury (`ElearningCertificationDecision.resultat = admis`)                     | idem                                                           |
| `elearning-exam-finalize-worker.ts`  | Clôture serveur d'une `ElearningExamSession`, fige la copie immuable, calcule `scoreProposePct`, écrit les `ElearningTraceEvent` | moteur quiz **[NEUF]**                                         |
| `elearning-cohorte-survey-worker.ts` | Envoie les enquêtes insertion 6/12 mois                                                                                          | pattern `Questionnaire` + email Nodemailer **[EXISTANT]**      |
| `elearning-tuteur-worker.ts`         | Tuteur RAG (assistance **pédagogique** FOAD, Ind.19) — **coupé** si `epreuveCertifiante`                                         | RAG/knowledge **[EXISTANT]**, `@anthropic-ai/sdk`              |

---

## 8. Console admin — NEUF (où Will pilote la certification)

Sous `src/app/[locale]/(admin)/[adminPrefix]/elearning/certification/**`, monté dans la sidebar **[EXISTANT]** via `AdminSidebarNav.tsx` (⚠️ pas `AdminSidebar.tsx`) + entrées dans `src/lib/admin/admin-nav.ts` :

- **Référentiels** : éditer `ElearningCertification` / blocs / compétences, importer un référentiel, voir la matrice de couverture.
- **Banque d'items & épreuves** : marquer `epreuveCertifiante`, fixer `niveauAssurance`, durée, seuil, tentatives.
- **Sessions d'examen** : suivi `ElearningExamSession`, incidents, journal d'événements.
- **Jury & délibérations** : saisir `ElearningCertificationDecision`, motiver, émettre le parchemin.
- **Cohortes & insertion** : suivi, enquêtes.
- **Exports conformité** : tous les exports du §6.

UI via `AdminPageShell`/`Header`/`StatCard`/`Table`/`Badge` **[EXISTANT]**. RBAC : `requireAdminWrite`/`requireAdminPublish` **[EXISTANT]** ; ajouter rôles `examinateur`/`jury` (sinon mapping sur `admin`/`super_admin`).

---

## 9. Checklist de constitution du dossier France Compétences

> Cochez avant dépôt. **[WILL]** = action hors code · **[PF]** = la plateforme le fournit.

### 9.1 Décision & cadrage

- [ ] **[WILL]** Choix RNCP **ou** RS (cible MVP recommandée : **RS** sur 1-2 blocs IA).
- [ ] **[WILL]** Télécharger la **grille d'instruction en vigueur** (FC) et la confronter à ce document.
- [ ] **[WILL]** Vérifier l'**éligibilité du déposant** (statut certificateur, expérience, capacité).

### 9.2 Référentiels

- [ ] **[WILL]** Référentiel d'**activités** rédigé (situations professionnelles réelles).
- [ ] **[WILL]** Référentiel de **compétences** (blocs RNCP / compétence(s) RS) — saisi dans `ElearningBlocCompetences`/`ElearningCompetence` **[PF]**.
- [ ] **[WILL]** Référentiel d'**évaluation** (modalités, critères, indicateurs, conditions, durée) par compétence.
- [ ] **[PF]** **Matrice de couverture** générée et complète (0 compétence non évaluée).

### 9.3 Qualité de l'évaluation

- [ ] **[WILL]** **Charte d'examen** / règlement (conditions, fraude, réclamations, jury).
- [ ] **[WILL]** Composition et **indépendance du jury** documentées.
- [ ] **[PF]** Garanties **identité** (step-up auth, déclaration horodatée, options N2/N3/N4).
- [ ] **[PF]** Garanties **anti-fraude** (randomisation, banque N/M, temps serveur, copies immuables hashées).
- [ ] **[PF]** Garantie **absence d'assistance** (tuteur coupé en épreuve, journalisé).
- [ ] **[PF]** **Traçabilité** (event sourcing, hash SHA-256, QR vérifiable).
- [ ] **[WILL]** **Proportionnalité CNIL** documentée si N≥2 (justification, alternative, DPA proctoring).

### 9.4 Mise en œuvre & contrôle

- [ ] **[WILL]** Process de **contrôle des partenaires/habilités** (si co-certif).
- [ ] **[PF]** **Statistiques** de réussite / item-analysis disponibles.
- [ ] **[PF]** Capacité d'**audit a posteriori** d'une session (rejeu via traces).

### 9.5 Suivi & marché

- [ ] **[WILL]** Preuves de **besoin/opportunité marché** (employeurs, branches).
- [ ] **[WILL]** Dispositif de **suivi des cohortes / insertion** (RNCP) — outillé par `ElearningCohorte` **[PF]**.
- [ ] **[WILL]** Modalités de **révision/renouvellement**.

### 9.6 FOAD & financement (pré-requis pour vendre, indépendant de l'enregistrement)

- [ ] **[PF]** 3 conditions D.6313-3-1 couvertes (assistance Ind.19, info durée, évaluations jalonnantes Ind.11). Cf. `01-foad-d6313-3-1.md`.
- [ ] **[PF]** **Certificat de réalisation** (modèle officiel, heures) auto-généré.
- [ ] **[PF]** **Faisceau de preuves** R.6313-3 exportable.
- [ ] **[WILL]** Conservation : 10 ans comptable / 6 ans fiscal-OPCO / 3-5 ans preuves / 6 mois-1 an logs.

### 9.7 CPF/EDOF (UNIQUEMENT après enregistrement RNCP/RS)

- [ ] **[WILL]** Numéro RNCP/RS **obtenu** (`ElearningCertification.numeroFc` renseigné, statut `enregistre`).
- [ ] **[WILL]** Habilitation EDOF / déclaration sur l'espace certificateur.
- [ ] **[PF]** Activer `EDOF_ENABLED=true` (Coolify, scope RUN) → entrée effective, service fait, FranceConnect+. Cf. `03-cpf-edof-readiness.md`.

---

## 10. Récapitulatif EXISTANT vs NEUF (anti-duplication)

**Réutilisé tel quel / étendu** : `Trainee` (apprenant, PII, consentements), `PortailAcces` (auth magic-link), `DocumentGenere` (+ `hashSha256`/`qrToken`/`suppressionPrevueAt`), route publique `verifier-attestation/[token]`, `EvaluationAcquis`/`Questionnaire` (résultats/enquêtes), `Formation Engine` (`qualiopi-formation-engine-worker.ts`, `GrilleQualiteConfig`, `runAdversarialCritique`), R2 (`src/lib/r2-storage.ts`), `@react-pdf/renderer` (templates `qualiopi-*.tsx`), emails Nodemailer + BullMQ, RBAC `requireAdmin*` (`src/server/actions/knowledge/_guards.ts`), `AdminPageShell`/`admin-nav.ts` (sidebar `AdminSidebarNav.tsx`), pattern IP-hash (image-bank), modalité `distanciel` (`ModaliteFormation`).

**Neuf à construire** : `ElearningCertification`/`ElearningBlocCompetences`/`ElearningCompetence`, `ElearningExamSession`, `ElearningCertificationDecision`, `ElearningTraceEvent`, le moteur de quiz certifiant (`Quiz`/`Question`/`QuizAttempt` — data model 03), niveaux d'assurance N0-N4, tuteur coupé en épreuve, workers `elearning-certificat/parchemin/exam-finalize/cohorte-survey/tuteur`, console `elearning/certification/**`, exports conformité, intégration proctoring (gated `PROCTORING_ENABLED`), EDOF (gated `EDOF_ENABLED`).

---

## Liens

- `00-INDEX/DECISIONS-ARBITRAGES.md` — ADR-0001 (auth), 0003 (CPF/RNCP ready), 0006 (xAPI), 0007 (cloisonnement), 0008 (migrations additives)
- `03-DATA-MODEL/01-schema-cours-modules-lecons.md` — cœur LMS (`ElearningCourse.seuilReussitePct`, `formationId`)
- `03-DATA-MODEL/03-schema-quiz-evaluations.md` — `Quiz`/`Question`/`QuizAttempt` (référencés ici par `quizId`/`competenceId`)
- `03-DATA-MODEL/04-schema-comptes-acces-auth.md` — `Trainee.passwordHash`, step-up auth
- `03-DATA-MODEL/06-strategie-migrations.md` — additivité
- `08-CONFORMITE/01-foad-d6313-3-1.md` — 3 conditions FOAD
- `08-CONFORMITE/02-qualiopi-indicateurs-foad.md` — Ind. 11 (évaluations), 19 (assistance)
- `08-CONFORMITE/03-cpf-edof-readiness.md` — pourquoi le CPF dépend de CE dossier ; flag EDOF
- `08-CONFORMITE/05-rgpd-conservation-preuves.md` — durées, IP-hash, droits
- `08-CONFORMITE/06-tracabilite-preuves-realisation.md` — faisceau de preuves R.6313-3
- `04-BACKEND/09-tuteur-rag-assistant.md` — tuteur (coupé en épreuve)
- `06-CONSOLE-ADMIN/07-gestion-certificats.md` — UI certificats/parchemins
