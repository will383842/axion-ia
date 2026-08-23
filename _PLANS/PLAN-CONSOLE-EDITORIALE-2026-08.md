# PLAN — CONSOLE ÉDITORIALE ET DE PILOTAGE MULTI-CANAL

_Cahier des charges. Écrit le 20 août 2026. **Ce document remplace le prompt de lancement dès sa validation.** C'est lui que l'on relit au début de chaque session._

---

# 0. LA CONFUSION À NE JAMAIS FAIRE

> **Les 61 publications LinkedIn sont de la DONNÉE. Elles ne sont pas la spécification.**

Elles vont changer — c'est certain, et c'est sain. L'outil ne doit dépendre ni de leur nombre, ni de leur contenu, ni de leur format. Il doit les **accueillir** et leur survivre.

### La bascule de source de vérité

| Avant l'import                             | Après l'import                                |
| ------------------------------------------ | --------------------------------------------- |
| Le dossier `Linkedin complet` fait foi     | **La base de données fait foi**               |
| Les fichiers `.md` sont modifiés à la main | Les fichiers deviennent une **archive gelée** |

⚠️ **Ce dossier a déjà vécu le problème des sources multiples** : quatre fichiers de textes coexistaient avec une règle de priorité à retenir, et le risque réel de publier une version périmée. Il a été fusionné en un seul le 20/08. **L'outil ne doit pas recréer ce problème.** Après l'import, on ne modifie plus les `.md` — on modifie la base.

L'import est donc **idempotent et non répétable** : rejouable techniquement sans créer de doublons, mais marqué comme fait, avec un avertissement explicite si on le relance.

---

# 1. OBJECTIF ET NON-OBJECTIFS

**Objectif** — qu'une personne sache, en un écran : ce qu'elle doit produire cette semaine, ce qu'elle doit programmer, ce qui est en retard, et lequel de ses formats a rapporté des rendez-vous.

**Contexte de croissance** : la communication représentera la moitié du chiffre d'affaires. L'outil doit tenir une équipe, plusieurs marques et de l'achat média — **sans être complexe le premier jour**, où l'usage est artisanal.

### Non-objectifs — définitifs

| Ce que l'outil ne fera jamais             | Pourquoi                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Répondre automatiquement aux commentaires | Six publications promettent une réponse personnelle. Les commentaires produisent les rendez-vous, pas les publications |
| Remplacer un outil de gestion de projet   | Assignation et revue, rien de plus. Ni messagerie, ni fil de discussion, ni feuilles de temps                          |
| Héberger les rushes vidéo                 | ~90 Go par épisode. Voir §5                                                                                            |
| Estimer une métrique absente              | « Non disponible » plutôt qu'un zéro qui ment                                                                          |
| Publier automatiquement, en lot 1         | Les portes externes sont lentes. Voir §10                                                                              |

---

# 1 bis. LES ONZE COMPTES À PILOTER

| #   | Plateforme | Compte                                                                                  | Identité   | Marque       | État                                                |
| --- | ---------- | --------------------------------------------------------------------------------------- | ---------- | ------------ | --------------------------------------------------- |
| 1   | LinkedIn   | **Profil personnel Williams Jullin**                                                    | perso      | —            | actif — 61 publications planifiées                  |
| 2   | LinkedIn   | **Page Axion-IA**                                                                       | pro        | Axion-IA     | actif — 13 échos planifiés                          |
| 3   | YouTube    | **Axion-IA — Williams Jullin**                                                          | pro        | Axion-IA     | à ouvrir                                            |
| 4   | YouTube    | **L'Étoffe** — podcasts tournés chez des dirigeants                                     | pro        | **L'Étoffe** | à ouvrir                                            |
| 5   | Facebook   | **Page professionnelle Williams Jullin**                                                | perso      | —            | à ouvrir                                            |
| 6   | Facebook   | **Page Axion-IA**                                                                       | pro        | Axion-IA     | à ouvrir                                            |
| 7   | Instagram  | Compte personnel                                                                        | perso      | —            | à ouvrir                                            |
| 8   | TikTok     | Compte                                                                                  | à trancher | —            | **reporté** — emplacement gardé, aucune intégration |
| 9   | Newsletter | **Williams Jullin** — e-mailing, **relayée sur LinkedIn**                               | perso      | —            | à créer, jalon du 11 octobre                        |
| 10  | Newsletter | **Axion-IA** — e-mailing _(Mailwizz auto-hébergé)_                                      | pro        | Axion-IA     | à créer                                             |
| 11  | Site       | **axion-ia.com** — blog, actualités, **podcast**, guides, livres, base de connaissances | pro        | Axion-IA     | **actif**                                           |

**Un compte s'ajoute depuis la console, sans développement.**

### Trois particularités à modéliser correctement

**La newsletter a deux vies.** Une édition est écrite une fois, puis **envoyée par e-mail** _et_ **relayée sur LinkedIn**. Ce n'est ni une copie ni deux contenus : c'est **une source avec deux diffusions**, chacune avec ses propres métriques — taux d'ouverture d'un côté, impressions de l'autre. Porté par `EdPublication.sourceId`, pas par une duplication.

**L'Étoffe appartient à Axion-IA.** C'est _L'Étoffe d'Axion-IA_ : une **marque fille**, pas une identité séparée — d'où `EdMarque`. Ses shorts alimentent donc légitimement les comptes de la marque mère, et le modèle le permet.

> ⚠️ **La nuance qui protège la valeur** : ce qui ouvre la porte d'un dirigeant, c'est que l'entretien **ne vend rien**. La marque peut être affichée, la promesse éditoriale doit rester l'invité. L'outil ne fait pas respecter cela — mais il ne doit pas encourager l'inverse en traitant les épisodes comme des contenus commerciaux parmi d'autres.

**Le site est un canal, pas un décor.** Il publie déjà, avec sa propre chaîne de génération de contenu. Un pilotage qui l'ignore pilote la moitié du problème.

---

# 1 ter. 🔴 LA TENSION CENTRALE — professionnel ET simple

C'est l'exigence la plus difficile de ce cahier, et celle sur laquelle ce genre d'outil échoue le plus souvent.

**Les deux besoins sont réels et paraissent contradictoires** : la communication représentera la moitié du chiffre d'affaires — l'outil doit tenir une équipe, plusieurs marques, de l'achat média. Mais **au début c'est artisanal**, une personne et quelques publications par semaine. Un outil qui demande douze champs pour noter une idée ne sera pas ouvert deux fois.

### La résolution

> **Le modèle de données porte tout dès le lot 0. L'interface n'en montre qu'une fraction, et s'ouvre à mesure que le besoin arrive.**

Rétro-ajouter un arbre de dérivation ou une notion de rôle dans un modèle qui ne les prévoyait pas coûte une réécriture. **Afficher un écran de plus quand l'équipe arrive ne coûte rien.**

| Concept                           | Dans le modèle, lot 0 | Visible à l'écran, lot 0-1                     |
| --------------------------------- | --------------------- | ---------------------------------------------- |
| Publications, statuts, calendrier | ✅                    | ✅                                             |
| Arbre de dérivation               | ✅                    | 🚫 _(un champ « vient de » suffit)_            |
| Recettes de recyclage             | ✅                    | 🚫 _(activées au démarrage du podcast)_        |
| Rôles et assignation              | ✅                    | 🚫 _(un seul utilisateur au départ)_           |
| Revue en deux temps               | ✅                    | 🚫                                             |
| Crochets d'achat média            | ✅                    | 🚫                                             |
| Spécifications de plateforme      | ✅                    | 🚫 _(utilisées en vérification, pas montrées)_ |
| Invités et droit à l'image        | ✅                    | ✅ _(dès le premier tournage)_                 |

### Le test de simplicité — non négociable

> **Ajouter une publication : moins de 30 secondes, 5 champs.** Le compte, la date, le format, un titre, le texte. Tout le reste est facultatif.
> **Noter une idée : 10 secondes, 1 champ.**
> **Récupérer un post pour le publier : 2 clics.**

Si l'un de ces trois gestes s'alourdit, **le lot est refusé** — quelles que soient ses fonctionnalités par ailleurs.

---

# 2. SCHÉMA PRISMA

Préfixe `Ed` — le schéma existant fait ~9 000 lignes, la collision de noms est un risque réel.

```prisma
// ─────────────────────────────────────────────────────────────
// CONSOLE ÉDITORIALE — énumérations
// ─────────────────────────────────────────────────────────────

enum EdPlateforme {
  linkedin
  youtube
  facebook
  instagram
  tiktok
  email
  site
}

/// Un compte sert à publier, ou à acheter de la publicité. Ce n'est pas
/// la même chose : un compte Meta Ads n'est pas une page Facebook.
enum EdCompteType {
  publication
  publicitaire
}

enum EdIdentite {
  perso
  pro
}

enum EdStatutRedaction {
  idee
  redige
  valide
}

/// `a_valider` n'existe que si une équipe existe. Sans elle, on passe
/// directement de `en_cours` à `pret`.
enum EdStatutAsset {
  non_requis
  a_produire
  en_cours
  a_valider
  pret
}

enum EdStatutDiffusion {
  non_programme
  programme
  publie
  annule
}

enum EdAssetType {
  video
  carrousel
  image
  photo
  audio
  document
}

/// La typologie vidéo. Extensible depuis la console : la valeur est une
/// clé vers EdFamille, pas une énumération figée. Cette énumération ne
/// sert qu'aux familles structurelles non-vidéo.
enum EdAssetNature {
  source
  derive
  variante_plateforme
  autonome
}

enum EdAssetUsage {
  organique
  payant
  mixte
}

enum EdRole {
  admin
  stratege
  production
  montage
  lecture
}

enum EdAutorisationStatut {
  non_demandee
  envoyee
  signee
  refusee
}

enum EdGravite {
  info
  avertissement
  bloquant
}

enum EdIdeeStatut {
  capturee
  qualifiee
  promue
  archivee
}

// ─────────────────────────────────────────────────────────────
// Référentiels — tous modifiables depuis la console
// ─────────────────────────────────────────────────────────────

/// Une marque éditoriale. « L'Étoffe » appartient à Axion-IA mais porte
/// sa propre promesse : un entretien qui ne vend rien. La marque n'est
/// PAS l'identité perso/pro — un compte L'Étoffe est `pro`.
model EdMarque {
  id          String      @id @default(uuid()) @db.Uuid
  nom         String      @db.VarChar(120)
  slug        String      @unique @db.VarChar(120)
  description String?     @db.Text
  actif       Boolean     @default(true)
  comptes     EdCompte[]
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  @@map("ed_marques")
}

model EdCompte {
  id                String            @id @default(uuid()) @db.Uuid
  plateforme        EdPlateforme
  type              EdCompteType      @default(publication)
  libelle           String            @db.VarChar(160)
  identite          EdIdentite
  marqueId          String?           @map("marque_id") @db.Uuid
  marque            EdMarque?         @relation(fields: [marqueId], references: [id], onDelete: SetNull)
  urlPublique       String?           @map("url_publique") @db.VarChar(512)
  /// Nombre de publications visé sur 30 jours. Arme l'alerte « canal muet ».
  cadenceCible      Int?              @map("cadence_cible")
  /// Recalculé à chaque publication. Évite un agrégat coûteux au rendu.
  derniereParutionA DateTime?         @map("derniere_parution_a")
  actif             Boolean           @default(true)
  publications      EdPublication[]
  objectifs         EdObjectif[]
  createdAt         DateTime          @default(now()) @map("created_at")
  updatedAt         DateTime          @updatedAt @map("updated_at")

  @@index([plateforme, actif])
  @@index([identite])
  @@map("ed_comptes")
}

/// Veine éditoriale : vision, preuve, recrutement, décryptage…
model EdPilier {
  id           String          @id @default(uuid()) @db.Uuid
  nom          String          @db.VarChar(120)
  slug         String          @unique @db.VarChar(120)
  /// Part visée dans le mix, en pourcentage. Arme l'alerte de dérive.
  partCible    Int?            @map("part_cible")
  couleur      String?         @db.VarChar(9)
  actif        Boolean         @default(true)
  publications EdPublication[]

  @@map("ed_piliers")
}

/// Famille d'asset — surtout la typologie vidéo. En base, pas en dur :
/// elle changera plus vite que le code.
model EdFamille {
  id           String            @id @default(uuid()) @db.Uuid
  nom          String            @db.VarChar(120)
  slug         String            @unique @db.VarChar(120)
  type         EdAssetType
  dureeMinSec  Int?              @map("duree_min_sec")
  dureeMaxSec  Int?              @map("duree_max_sec")
  description  String?           @db.Text
  actif        Boolean           @default(true)
  assets       EdAsset[]
  specs        EdSpecPlateforme[]
  recetteLignes EdRecetteLigne[]

  @@map("ed_familles")
}

/// Contraintes d'export par plateforme et par famille. Ces limites
/// changent souvent : jamais en dur.
model EdSpecPlateforme {
  id                String       @id @default(uuid()) @db.Uuid
  plateforme        EdPlateforme
  familleId         String       @map("famille_id") @db.Uuid
  famille           EdFamille    @relation(fields: [familleId], references: [id], onDelete: Cascade)
  ratio             String       @db.VarChar(12)
  dureeMinSec       Int?         @map("duree_min_sec")
  dureeMaxSec       Int?         @map("duree_max_sec")
  poidsMaxMo        Int?         @map("poids_max_mo")
  sousTitresIncrust Boolean      @default(false) @map("sous_titres_incrustes")
  zoneSecuriteHaut  Int?         @map("zone_securite_haut_px")
  zoneSecuriteBas   Int?         @map("zone_securite_bas_px")
  note              String?      @db.Text

  @@unique([plateforme, familleId])
  @@map("ed_specs_plateforme")
}

/// Rendez-vous récurrent : « Sous le capot » le dimanche à 18 h 30.
model EdSerie {
  id           String          @id @default(uuid()) @db.Uuid
  nom          String          @db.VarChar(160)
  slug         String          @unique @db.VarChar(160)
  compteId     String?         @map("compte_id") @db.Uuid
  /// 0 = lundi. Null si la série n'a pas de jour fixe.
  jourSemaine  Int?            @map("jour_semaine")
  heure        String?         @db.VarChar(5)
  /// En jours. 14 pour « un dimanche sur deux ».
  periodeJours Int?            @map("periode_jours")
  actif        Boolean         @default(true)
  publications EdPublication[]

  @@map("ed_series")
}

// ─────────────────────────────────────────────────────────────
// Le cœur — publications et assets
// ─────────────────────────────────────────────────────────────

model EdPublication {
  id                 String             @id @default(uuid()) @db.Uuid
  compteId           String             @map("compte_id") @db.Uuid
  compte             EdCompte           @relation(fields: [compteId], references: [id], onDelete: Restrict)
  pilierId           String?            @map("pilier_id") @db.Uuid
  pilier             EdPilier?          @relation(fields: [pilierId], references: [id], onDelete: SetNull)
  serieId            String?            @map("serie_id") @db.Uuid
  serie              EdSerie?           @relation(fields: [serieId], references: [id], onDelete: SetNull)

  /// Numéro d'origine dans le dossier importé. Sert UNIQUEMENT à la
  /// traçabilité de l'amorçage — jamais comme identifiant métier.
  refImport          String?            @unique @map("ref_import") @db.VarChar(40)

  datePrevue         DateTime           @map("date_prevue") @db.Date
  heurePrevue        String             @map("heure_prevue") @db.VarChar(5)
  titreInterne       String             @map("titre_interne") @db.VarChar(200)
  accroche           String?            @db.Text
  corps              String?            @db.Text
  premierCommentaire String?            @map("premier_commentaire") @db.Text
  /// Tableau de tags SANS le croisillon ni accent.
  tags               String[]
  lienUrl            String?            @map("lien_url") @db.VarChar(1024)

  statutRedaction    EdStatutRedaction  @default(idee) @map("statut_redaction")
  statutAsset        EdStatutAsset      @default(non_requis) @map("statut_asset")
  statutDiffusion    EdStatutDiffusion  @default(non_programme) @map("statut_diffusion")

  /// Outil externe de programmation et son identifiant, quand programmé.
  outilProgrammation String?            @map("outil_programmation") @db.VarChar(60)
  refExterne         String?            @map("ref_externe") @db.VarChar(160)
  urlPubliee         String?            @map("url_publiee") @db.VarChar(1024)
  publieeA           DateTime?          @map("publiee_a")

  /// Coût en centimes. 0 en organique. Rend comparable un post gratuit
  /// et une campagne payante.
  coutCentimes       Int                @default(0) @map("cout_centimes")

  /// Publication source en cas de reprise (écho page, relais LinkedIn
  /// d'une édition e-mail). Ce n'est PAS une copie : deux diffusions.
  sourceId           String?            @map("source_id") @db.Uuid
  source             EdPublication?     @relation("Reprise", fields: [sourceId], references: [id], onDelete: SetNull)
  reprises           EdPublication[]    @relation("Reprise")

  responsableId      String?            @map("responsable_id") @db.Uuid
  responsable        EdMembre?          @relation(fields: [responsableId], references: [id], onDelete: SetNull)

  assets             EdAssetPublication[]
  metriques          EdMetrique[]
  alertes            EdAlerteDeclenchee[]

  createdAt          DateTime           @default(now()) @map("created_at")
  updatedAt          DateTime           @updatedAt @map("updated_at")

  @@index([datePrevue, compteId])
  @@index([statutDiffusion, datePrevue])
  @@index([statutAsset])
  @@map("ed_publications")
}

/// 🔴 L'ARBRE DE DÉRIVATION. Un podcast porte ses extraits, qui portent
/// leurs shorts, qui portent leurs variantes par plateforme. Sans cet
/// arbre, impossible de savoir ce qu'un tournage a produit.
model EdAsset {
  id              String               @id @default(uuid()) @db.Uuid
  type            EdAssetType
  familleId       String?              @map("famille_id") @db.Uuid
  famille         EdFamille?           @relation(fields: [familleId], references: [id], onDelete: SetNull)
  nature          EdAssetNature        @default(autonome)
  usage           EdAssetUsage         @default(organique)
  libelle         String               @db.VarChar(200)

  parentId        String?              @map("parent_id") @db.Uuid
  parent          EdAsset?             @relation("Derivation", fields: [parentId], references: [id], onDelete: SetNull)
  enfants         EdAsset[]            @relation("Derivation")

  /// Position dans la source, en secondes. Répond à « ce short vient de
  /// quelle minute de l'épisode ».
  offsetSourceSec Int?                 @map("offset_source_sec")

  /// 🔴 Les rushes NE SONT PAS stockés ici. `emplacementExterne` désigne
  /// le volume de montage ; `cheminObjet` ne porte que le livré, le
  /// proxy, la vignette. Voir §5.
  emplacementExterne String?           @map("emplacement_externe") @db.VarChar(512)
  cheminObjet        String?           @map("chemin_objet") @db.VarChar(512)
  cheminProxy        String?           @map("chemin_proxy") @db.VarChar(512)
  cheminVignette     String?           @map("chemin_vignette") @db.VarChar(512)

  dureeSec        Int?                 @map("duree_sec")
  largeurPx       Int?                 @map("largeur_px")
  hauteurPx       Int?                 @map("hauteur_px")
  poidsOctets     BigInt?              @map("poids_octets")
  empreinte       String?              @db.VarChar(64)
  version         Int                  @default(1)

  transcription   String?              @db.Text
  chapitres       Json?

  statut          EdStatutAsset        @default(a_produire)
  responsableId   String?              @map("responsable_id") @db.Uuid
  responsable     EdMembre?            @relation(fields: [responsableId], references: [id], onDelete: SetNull)
  revueCommentaire String?             @map("revue_commentaire") @db.Text

  invitesLies     EdEpisodeInvite[]
  publications    EdAssetPublication[]

  createdAt       DateTime             @default(now()) @map("created_at")
  updatedAt       DateTime             @updatedAt @map("updated_at")

  @@index([parentId])
  @@index([statut])
  @@index([type, familleId])
  @@map("ed_assets")
}

/// Un même short part sur quatre comptes. Table de liaison explicite
/// pour porter l'ordre d'affichage dans un carrousel multi-images.
model EdAssetPublication {
  assetId       String        @map("asset_id") @db.Uuid
  asset         EdAsset       @relation(fields: [assetId], references: [id], onDelete: Cascade)
  publicationId String        @map("publication_id") @db.Uuid
  publication   EdPublication @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  ordre         Int           @default(0)

  @@id([assetId, publicationId])
  @@map("ed_assets_publications")
}

// ─────────────────────────────────────────────────────────────
// Podcast — invités et droit à l'image
// ─────────────────────────────────────────────────────────────

model EdInvite {
  id            String            @id @default(uuid()) @db.Uuid
  nom           String            @db.VarChar(160)
  entreprise    String?           @db.VarChar(200)
  email         String?           @db.VarChar(255)
  telephone     String?           @db.VarChar(40)
  note          String?           @db.Text
  episodes      EdEpisodeInvite[]
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  @@map("ed_invites")
}

/// 🔴 BLOQUANT. Aucun épisode ni dérivé ne se publie si l'autorisation
/// n'est pas `signee`. Signature via DocuSeal, déjà en place.
model EdEpisodeInvite {
  id                 String               @id @default(uuid()) @db.Uuid
  assetId            String               @map("asset_id") @db.Uuid
  asset              EdAsset              @relation(fields: [assetId], references: [id], onDelete: Cascade)
  inviteId           String               @map("invite_id") @db.Uuid
  invite             EdInvite             @relation(fields: [inviteId], references: [id], onDelete: Restrict)

  autorisationStatut EdAutorisationStatut @default(non_demandee) @map("autorisation_statut")
  docusealSubmissionId String?            @map("docuseal_submission_id") @db.VarChar(120)
  documentChemin     String?              @map("document_chemin") @db.VarChar(512)
  signeeA            DateTime?            @map("signee_a")
  /// Fin de la cession de droits. Null = sans limite de durée.
  valableJusquA      DateTime?            @map("valable_jusqu_a") @db.Date

  createdAt          DateTime             @default(now()) @map("created_at")
  updatedAt          DateTime             @updatedAt @map("updated_at")

  @@unique([assetId, inviteId])
  @@index([autorisationStatut])
  @@map("ed_episodes_invites")
}

// ─────────────────────────────────────────────────────────────
// Recyclage
// ─────────────────────────────────────────────────────────────

/// « Un podcast produit 1 épisode, 2 extraits, 8 shorts, 1 carrousel,
/// 1 article, 1 newsletter. » Appliquée à l'enregistrement d'une source,
/// elle crée les dérivés attendus au statut `a_produire`.
model EdRecette {
  id             String           @id @default(uuid()) @db.Uuid
  nom            String           @db.VarChar(160)
  familleSourceId String          @map("famille_source_id") @db.Uuid
  actif          Boolean          @default(true)
  lignes         EdRecetteLigne[]

  @@map("ed_recettes")
}

model EdRecetteLigne {
  id         String    @id @default(uuid()) @db.Uuid
  recetteId  String    @map("recette_id") @db.Uuid
  recette    EdRecette @relation(fields: [recetteId], references: [id], onDelete: Cascade)
  familleId  String    @map("famille_id") @db.Uuid
  famille    EdFamille @relation(fields: [familleId], references: [id], onDelete: Restrict)
  quantite   Int       @default(1)
  compteId   String?   @map("compte_id") @db.Uuid
  note       String?   @db.Text

  @@map("ed_recettes_lignes")
}

// ─────────────────────────────────────────────────────────────
// Idées
// ─────────────────────────────────────────────────────────────

/// Un champ obligatoire, un seul : le titre. Une idée qui demande un
/// formulaire n'est jamais saisie.
model EdIdee {
  id          String       @id @default(uuid()) @db.Uuid
  titre       String       @db.VarChar(240)
  detail      String?      @db.Text
  lien        String?      @db.VarChar(1024)
  familleId   String?      @map("famille_id") @db.Uuid
  compteId    String?      @map("compte_id") @db.Uuid
  pilierId    String?      @map("pilier_id") @db.Uuid
  /// 1 à 5. Sert au tri, pas à un calcul.
  interet     Int?
  origine     String?      @db.VarChar(120)
  statut      EdIdeeStatut @default(capturee)
  /// Publication créée par promotion. Trace le lien.
  promueVersId String?     @map("promue_vers_id") @db.Uuid
  /// Motif d'archivage. Une idée écartée n'est jamais supprimée.
  motifArchivage String?   @map("motif_archivage") @db.Text
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  @@index([statut, interet])
  @@map("ed_idees")
}

// ─────────────────────────────────────────────────────────────
// Mesure
// ─────────────────────────────────────────────────────────────

/// Historisé, jamais écrasé : une publication a plusieurs relevés dans
/// le temps. Un écrasement rendrait toute courbe impossible.
model EdMetrique {
  id             String        @id @default(uuid()) @db.Uuid
  publicationId  String        @map("publication_id") @db.Uuid
  publication    EdPublication @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  releveA        DateTime      @map("releve_a")
  impressions    Int?
  reactions      Int?
  commentaires   Int?
  partages       Int?
  clics          Int?
  abonnesGagnes  Int?          @map("abonnes_gagnes")
  vuesCompletes  Int?          @map("vues_completes")
  dureeMoyenneSec Int?         @map("duree_moyenne_sec")
  /// Ouvertures et clics d'une édition e-mail.
  ouvertures     Int?
  /// Rendez-vous attribués via utm_content. C'est LA métrique qui compte.
  rdvAttribues   Int?          @map("rdv_attribues")
  devisAttribues Int?          @map("devis_attribues")
  source         String        @default("manuel") @db.VarChar(40)

  @@unique([publicationId, releveA])
  @@index([releveA])
  @@map("ed_metriques")
}

model EdObjectif {
  id         String       @id @default(uuid()) @db.Uuid
  /// Premier jour du mois visé.
  mois       DateTime     @db.Date
  compteId   String?      @map("compte_id") @db.Uuid
  compte     EdCompte?    @relation(fields: [compteId], references: [id], onDelete: Cascade)
  familleId  String?      @map("famille_id") @db.Uuid
  cible      Int
  note       String?      @db.Text

  @@unique([mois, compteId, familleId])
  @@map("ed_objectifs")
}

// ─────────────────────────────────────────────────────────────
// Règles, alertes, équipe, journal
// ─────────────────────────────────────────────────────────────

/// 🔑 Les règles vivent en base, jamais en dur. Sinon un responsable de
/// production ne peut pas ajuster sans ouvrir une pull request.
model EdRegleConformite {
  id          String    @id @default(uuid()) @db.Uuid
  code        String    @unique @db.VarChar(60)
  libelle     String    @db.VarChar(200)
  motif       String    @db.Text
  /// Expression régulière testée sur corps + premier commentaire + tags.
  motif_regex String    @db.Text
  /// true = déclenche si TROUVÉ ; false = déclenche si ABSENT.
  interdit    Boolean   @default(true)
  gravite     EdGravite @default(bloquant)
  message     String    @db.Text
  actif       Boolean   @default(true)

  @@map("ed_regles_conformite")
}

model EdRegleAlerte {
  id            String               @id @default(uuid()) @db.Uuid
  code          String               @unique @db.VarChar(60)
  libelle       String               @db.VarChar(200)
  description   String               @db.Text
  /// Paramètres du seuil : {"jours": 3}, {"minParMois": 4}…
  parametres    Json
  gravite       EdGravite            @default(avertissement)
  actif         Boolean              @default(true)
  declenchees   EdAlerteDeclenchee[]

  @@map("ed_regles_alerte")
}

model EdAlerteDeclenchee {
  id            String         @id @default(uuid()) @db.Uuid
  regleId       String         @map("regle_id") @db.Uuid
  regle         EdRegleAlerte  @relation(fields: [regleId], references: [id], onDelete: Cascade)
  publicationId String?        @map("publication_id") @db.Uuid
  publication   EdPublication? @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  assetId       String?        @map("asset_id") @db.Uuid
  compteId      String?        @map("compte_id") @db.Uuid
  detail        String?        @db.Text
  declencheeA   DateTime       @default(now()) @map("declenchee_a")
  resolueA      DateTime?      @map("resolue_a")

  @@index([resolueA, declencheeA])
  @@map("ed_alertes_declenchees")
}

model EdMembre {
  id           String          @id @default(uuid()) @db.Uuid
  /// Rattachement au compte d'authentification existant.
  userId       String?         @unique @map("user_id") @db.Uuid
  nom          String          @db.VarChar(160)
  email        String          @unique @db.VarChar(255)
  role         EdRole          @default(lecture)
  actif        Boolean         @default(true)
  publications EdPublication[]
  assets       EdAsset[]

  @@map("ed_membres")
}

/// Qui a changé quoi, quand. Une console d'équipe sans journal devient
/// ingouvernable dès la deuxième personne.
model EdJournal {
  id         String   @id @default(uuid()) @db.Uuid
  membreId   String?  @map("membre_id") @db.Uuid
  entite     String   @db.VarChar(60)
  entiteId   String   @map("entite_id") @db.Uuid
  action     String   @db.VarChar(40)
  avant      Json?
  apres      Json?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([entite, entiteId])
  @@index([createdAt])
  @@map("ed_journal")
}
```

---

# 2 bis. LA BOUCLE QUOTIDIENNE — déposer, retrouver, récupérer

**C'est l'usage réel de l'outil, et c'est ce qui décide s'il est ouvert ou abandonné.** Tout le reste est de la structure ; ceci est le geste.

## A. Déposer — l'ingestion

Un contenu entre dans l'outil de quatre façons, toutes obligatoires :

| Voie                      | Ce qu'on dépose                                            | Où                                                                 |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| **Rédaction directe**     | Un texte de publication, son premier commentaire, ses tags | Écran publication                                                  |
| **Téléversement**         | Une image, un carrousel, une vidéo courte, un document     | Glisser-déposer sur l'écran publication **ou** dans la médiathèque |
| **Téléversement par lot** | Vingt visuels d'un coup, rattachés ensuite                 | Médiathèque                                                        |
| **Référence externe**     | Une vidéo longue qui reste sur le volume de montage        | Champ `emplacementExterne`                                         |

**Le glisser-déposer est le geste par défaut.** Déposer un fichier sur une publication crée l'asset, le lie, calcule ses dimensions et sa durée, génère la vignette, et vérifie la spec de la plateforme — **en une action**.

⚠️ **Contrôles au dépôt** : type accepté, poids maximal, empreinte pour détecter un doublon _(le même visuel déposé deux fois est signalé, pas dupliqué)_, et vérification contre `EdSpecPlateforme` avec un avertissement clair si l'export ne conviendra pas.

## B. Retrouver — la recherche

Un seul champ, qui traverse tout : publications _(titre, accroche, corps, premier commentaire)_, idées, assets _(libellé, transcription)_, invités.

**Index Postgres `tsvector` en français**, ajouté par migration SQL brute — c'est déjà la convention du dépôt pour les articles.

## C. 🔴 RÉCUPÉRER — le kit de publication

**C'est la fonction la plus utilisée de l'outil, et elle doit être irréprochable.**

Le matin, on ouvre une publication et on veut **tout, en un geste**. Chaque écran de publication porte donc un bloc **« Publier »** :

| Élément                       | Action                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Le **corps** du post          | Bouton _copier_ — texte brut, hashtags inclus, prêt à coller                                                                      |
| Le **premier commentaire**    | Bouton _copier_ séparé — c'est un second geste dans LinkedIn                                                                      |
| Le **lien avec ses UTM**      | Bouton _copier_. ⚠️ **Jamais retapé à la main**                                                                                   |
| Les **médias**                | Bouton _télécharger_ — un fichier, ou une archive `.zip` nommée `pub-04-devis.zip` si plusieurs                                   |
| La **variante de plateforme** | Si l'asset a des variantes, on télécharge **celle du compte visé**, pas la source                                                 |
| Le **récapitulatif**          | Compte, date, heure, format — pour la programmation dans l'outil externe                                                          |
| **Tout à la fois**            | Un bouton _tout copier_ qui met le corps, une ligne vide, puis le premier commentaire — et déclenche le téléchargement des médias |

Puis un bouton **« marquer comme programmé »** qui demande l'outil utilisé et son identifiant, et un **« marquer comme publié »** qui demande l'URL réelle.

> 🔑 **Le test de cette fonction** : entre l'ouverture de la publication et le collage dans LinkedIn, **deux clics maximum**. Si c'en est trois, le kit est mal fait.

## C bis. Agir sur plusieurs à la fois

Un dispositif de 61 publications se pilote par lots, pas une par une. **Sélection multiple à la case à cocher**, avec quatre actions groupées :

| Action groupée              | Usage réel                                                                        |
| --------------------------- | --------------------------------------------------------------------------------- |
| **Replanifier de N jours**  | Un tournage glisse d'une semaine, quinze publications suivent                     |
| **Changer un statut**       | Marquer douze publications comme programmées après un import dans l'outil externe |
| **Assigner un responsable** | Confier tous les montages de novembre à une personne                              |
| **Exporter la sélection**   | Sortir un mois précis vers l'outil de programmation                               |

⚠️ **Toute action groupée est annulable pendant dix secondes**, et journalisée comme une seule entrée dans `EdJournal` — pas quinze. Un journal noyé n'est plus un journal.

## D. Exporter — vers un outil externe et vers soi

| Export                       | Contenu                                                                                                                  | Usage                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| **CSV de programmation**     | Une ligne par publication, sur une période choisie : date, heure, compte, corps, premier commentaire, chemins des médias | Import dans Buffer ou équivalent, après remappage des colonnes  |
| **Archive d'une période**    | Un `.zip` : le CSV **et** tous les médias, rangés par publication                                                        | Confier un mois à quelqu'un, ou travailler hors ligne           |
| **Sauvegarde complète JSON** | Toutes les tables, sans les fichiers                                                                                     | Réversibilité. Un outil dont on ne peut pas sortir est un piège |

⚠️ **La sauvegarde complète est une exigence, pas un confort.** Elle doit exister dès le lot 1.

---

# 2 ter. COMPLÉMENTS AU SCHÉMA

```prisma
/// 🔴 L'historique des textes. Le dossier importé contenait 16 posts
/// réécrits : une publication VIT, elle est retravaillée. Sans versions,
/// on perd la trace de ce qui a été changé et pourquoi — et on ne peut
/// pas revenir en arrière après une mauvaise réécriture.
model EdPublicationVersion {
  id                 String        @id @default(uuid()) @db.Uuid
  publicationId      String        @map("publication_id") @db.Uuid
  publication        EdPublication @relation(fields: [publicationId], references: [id], onDelete: Cascade)
  version            Int
  accroche           String?       @db.Text
  corps              String?       @db.Text
  premierCommentaire String?       @map("premier_commentaire") @db.Text
  tags               String[]
  /// Pourquoi cette version. Facultatif mais fortement encouragé.
  motif              String?       @db.Text
  auteurId           String?       @map("auteur_id") @db.Uuid
  createdAt          DateTime      @default(now()) @map("created_at")

  @@unique([publicationId, version])
  @@map("ed_publications_versions")
}

/// Gabarit — une série récurrente ne se ressaisit pas. « Sous le capot »
/// a sa structure, ses tags, son compte, son heure.
model EdGabarit {
  id                 String       @id @default(uuid()) @db.Uuid
  nom                String       @db.VarChar(160)
  compteId           String?      @map("compte_id") @db.Uuid
  serieId            String?      @map("serie_id") @db.Uuid
  pilierId           String?      @map("pilier_id") @db.Uuid
  familleId          String?      @map("famille_id") @db.Uuid
  heurePrevue        String?      @map("heure_prevue") @db.VarChar(5)
  corpsSquelette     String?      @map("corps_squelette") @db.Text
  premierCommentaire String?      @map("premier_commentaire") @db.Text
  tags               String[]
  actif              Boolean      @default(true)

  @@map("ed_gabarits")
}

/// Où partent les alertes. Telegram est déjà branché dans le dépôt.
model EdCanalNotification {
  id          String    @id @default(uuid()) @db.Uuid
  type        String    @db.VarChar(30)   // telegram | email
  destination String    @db.VarChar(255)
  /// Gravité minimale relayée : info | avertissement | bloquant
  graviteMin  EdGravite @default(avertissement) @map("gravite_min")
  actif       Boolean   @default(true)

  @@map("ed_canaux_notification")
}
```

**Ajouts sur `EdPublication`** :

```prisma
  /// Version courante. Incrémentée à chaque modification du corps,
  /// de l'accroche, du premier commentaire ou des tags.
  versionCourante Int      @default(1) @map("version_courante")
  versions        EdPublicationVersion[]

  /// Sort du calendrier actif sans disparaître. Une publication passée
  /// reste consultable et mesurable, mais n'encombre plus les vues.
  archiveeA       DateTime? @map("archivee_a")

  /// Campagne, pour le marquage UTM et le regroupement pluriannuel.
  /// « q4-2026 » aujourd'hui, « q1-2027 » en janvier. Sans ce champ,
  /// les trimestres se mélangent et l'historique devient illisible.
  campagne        String?   @default("q4-2026") @db.VarChar(60)
```

⚠️ **Une version est créée à chaque modification de contenu, jamais à chaque changement de statut.** Sinon le journal se remplit de bruit.

---

# 3. CARTE DES ROUTES

Console dédiée, sous le préfixe d'administration existant.

| Route                                            | Écran                                                           | Rôle minimal |
| ------------------------------------------------ | --------------------------------------------------------------- | ------------ |
| `/[adminPrefix]/editorial`                       | Tableau de bord « ce qui presse »                               | lecture      |
| `/[adminPrefix]/editorial/calendrier`            | Calendrier mois / semaine                                       | lecture      |
| `/[adminPrefix]/editorial/publications`          | Liste, filtres, vues enregistrées                               | lecture      |
| `/[adminPrefix]/editorial/publications/[id]`     | Édition d'une publication                                       | production   |
| `/[adminPrefix]/editorial/idees`                 | Banque d'idées                                                  | production   |
| `/[adminPrefix]/editorial/mediatheque`           | Assets, arbre de dérivation                                     | montage      |
| `/[adminPrefix]/editorial/mediatheque/[id]`      | Un asset, ses dérivés, sa revue                                 | montage      |
| `/[adminPrefix]/editorial/analyse`               | Performance, comparaison perso/pro                              | lecture      |
| `/[adminPrefix]/editorial/invites`               | Invités et autorisations                                        | production   |
| `/[adminPrefix]/editorial/publications/[id]/kit` | **Le kit de publication** — copier, télécharger, marquer        | production   |
| `/[adminPrefix]/editorial/recherche`             | Recherche plein texte, tous objets confondus                    | lecture      |
| `/[adminPrefix]/editorial/export`                | CSV de programmation, archive de période, sauvegarde JSON       | production   |
| `/[adminPrefix]/editorial/capture`               | **Écran mobile minimal** : noter une idée, marquer « publié »   | lecture      |
| `/[adminPrefix]/editorial/reglages/*`            | Console d'administration, 12 rubriques + canaux de notification | admin        |

### Le premier lancement

À l'ouverture d'une base vierge, la console propose **un parcours en trois étapes**, pas un écran vide :

1. **Importer le dossier existant** _(les 61 publications)_ — ou passer
2. **Créer un premier compte** — plateforme, identité, cadence visée
3. **Créer une première publication** — ou noter une première idée

Chaque étape est sautable, et le parcours réapparaît tant qu'aucun compte n'existe.

### L'écran mobile

**Deux gestes seulement**, parce que ce sont les deux qui se font debout :

- **Noter une idée** — un champ, un bouton
- **Marquer une publication comme publiée** et coller son URL

Le reste — rédaction, médiathèque, réglages — reste au bureau. **Un formulaire complet sur téléphone n'est jamais rempli.**

**Server Actions, pas d'API REST** — convention du dépôt. Une action par mutation, validée par Zod, journalisée dans `EdJournal`.

---

# 4. MATRICE RÔLES → PERMISSIONS

| Action                                         | admin | stratège | production | montage | lecture |
| ---------------------------------------------- | :---: | :------: | :--------: | :-----: | :-----: |
| Voir calendrier, publications, analyse         |  ✅   |    ✅    |     ✅     |   ✅    |   ✅    |
| Créer / modifier une publication               |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Valider une publication _(passage à `valide`)_ |  ✅   |    ✅    |     —      |    —    |    —    |
| Marquer « publié », saisir l'URL               |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Créer / modifier un asset                      |  ✅   |    ✅    |     ✅     |   ✅    |    —    |
| Valider un asset _(passage à `pret`)_          |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Capturer une idée                              |  ✅   |    ✅    |     ✅     |   ✅    |   ✅    |
| Promouvoir une idée                            |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Gérer invités et autorisations                 |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Saisir des métriques                           |  ✅   |    ✅    |     ✅     |    —    |    —    |
| Réglages, règles, seuils, objectifs            |  ✅   |    —     |     —      |    —    |    —    |
| Gérer l'équipe                                 |  ✅   |    —     |     —      |    —    |    —    |
| Supprimer quoi que ce soit                     |  ✅   |    —     |     —      |    —    |    —    |

> Un monteur voit **sa file d'assets**, pas l'ensemble du dossier. Le filtre par défaut de son écran est `responsable = moi`.

---

# 5. STOCKAGE — LA RÈGLE QUI ÉVITE LE MUR

Mesuré pour un épisode de podcast de 58 minutes, deux caméras :

|                                                                 | Par épisode | Sur un an, 2 épisodes/mois |
| --------------------------------------------------------------- | ----------- | -------------------------- |
| **Rushes** 4K + audio multipiste                                | **~90 Go**  | **2,2 To**                 |
| **Livré** master, extraits, 32 shorts, vignettes, transcription | **~12 Go**  | **~290 Go**                |

**Les rushes ne passent jamais par l'outil.** `EdAsset.emplacementExterne` porte une référence au volume de montage ; `cheminObjet`, `cheminProxy` et `cheminVignette` ne portent que le livré.

Un outil qui hébergerait les rushes deviendrait ingérable au sixième épisode.

---

# 6. MIGRATION ET AMORÇAGE

### Source

`Linkedin complet.zip` → `02-calendrier-publication.csv` _(61 lignes, séparateur `;`, UTF-8 BOM)_ et `10-LES-61-POSTS.md` _(un post = une section `## #N`)_.

### Correspondance des colonnes

| Colonne CSV  | Champ         | Transformation                                                          |
| ------------ | ------------- | ----------------------------------------------------------------------- |
| `numero`     | `refImport`   | Préfixé : `linkedin-2026-q4-04`                                         |
| `date`       | `datePrevue`  | `JJ/MM/AAAA` → `Date`                                                   |
| `heure`      | `heurePrevue` | `7h45` → `07:45`                                                        |
| `format`     | —             | Sert à déduire `EdFamille` et `statutAsset`                             |
| `accroche`   | `accroche`    | tel quel                                                                |
| `production` | —             | Crée un `EdAsset` au statut `a_produire`                                |
| `photo_will` | —             | Crée un `EdAsset` de type `photo`                                       |
| `lien`       | —             | `reservation`/`candidature`/`newsletter` → sert au contrôle UTM         |
| `echo_page`  | `sourceId`    | Crée une **seconde** publication sur le compte page, liée à la première |
| `tags`       | `tags`        | Split, croisillon retiré                                                |
| `note`       | —             | Ignoré. La note est un jugement daté, pas une donnée d'outil            |

Le **corps** et le **premier commentaire** viennent de `10-LES-61-POSTS.md`, appariés par le numéro.

### Règles

- **Idempotent** par `refImport` : un rejeu ne crée aucun doublon
- **Non répétable** : marqué comme fait ; un second lancement avertit et demande confirmation
- **Transactionnel** : tout ou rien
- **Rapport** : nombre créé, ignoré, en erreur — avec le détail

⚠️ **Après l'import, la base fait foi. Les `.md` deviennent une archive gelée.** Voir §0.

---

# 7. CRITÈRES D'ACCEPTATION, LOT PAR LOT

En gestes observables. Pas « ça marche ».

### Lot 0 — voir les quatre mois

- [ ] `pnpm prisma migrate dev` passe sur une base vierge
- [ ] La commande d'import crée **61 publications + 13 reprises** et affiche son rapport
- [ ] Un second import affiche « déjà effectué » et ne crée **rien**
- [ ] `/editorial/calendrier` affiche septembre avec 15 publications aux bonnes dates
- [ ] Le filtre « identité = pro » n'affiche que les publications de la page
- [ ] Le poids de la route est **mesuré et consigné**

### Lot 1 — remplacer le tableur

- [ ] **Le kit de publication** : depuis l'ouverture d'une publication, coller le corps dans LinkedIn prend **deux clics**
- [ ] Le bouton « copier le premier commentaire » est **distinct** de celui du corps
- [ ] Une publication portant trois images télécharge **une archive `.zip` nommée lisiblement**
- [ ] Déposer un fichier par glisser-déposer crée l'asset, le lie, calcule durée et dimensions, génère la vignette — **en une action**
- [ ] Déposer deux fois le même fichier **signale un doublon** au lieu de le dupliquer
- [ ] La recherche trouve une publication par un mot de son corps, et un asset par un mot de sa transcription
- [ ] Modifier le corps d'une publication crée une **version**, et l'ancienne reste consultable
- [ ] Changer un statut **ne crée pas** de version
- [ ] L'export CSV d'un mois produit un fichier ouvrable, avec corps et premier commentaire
- [ ] La sauvegarde JSON complète se télécharge et se relit
- [ ] Sur une base vierge, le **parcours de premier lancement** apparaît
- [ ] Créer une publication avec **5 champs** et l'enregistrer prend moins de 30 secondes
- [ ] Déplacer une publication du 12 au 14 par glisser-déposer : elle est **toujours au 14 après rechargement**
- [ ] Passer une publication à `valide` alors que son corps contient « Grenoble » est **refusé**, avec le motif et l'extrait fautif
- [ ] Une URL sans `utm_content` **bloque** la validation
- [ ] Capturer une idée demande **un seul champ**
- [ ] Promouvoir une idée crée une publication et lie les deux
- [ ] Le tableau de bord liste les publications à J-3 sans asset prêt

### Lot 2 — la médiathèque

- [ ] Un asset enregistré avec une recette crée automatiquement ses dérivés en `a_produire`
- [ ] L'arbre d'un épisode affiche extraits, shorts et variantes sur trois niveaux
- [ ] Depuis un short, on remonte à l'épisode **et à la seconde** d'origine
- [ ] Un épisode dont l'autorisation n'est pas `signee` **ne peut pas** passer une publication à `programme`
- [ ] Un asset dont la durée dépasse la spec de sa plateforme ne passe pas à `pret`

### Lot 3 — la mesure

- [ ] Saisir un relevé crée une ligne **sans écraser** la précédente
- [ ] L'analyse par format classe les familles par rendez-vous attribués
- [ ] La comparaison perso/pro affiche les deux séries sur la même échelle
- [ ] Une métrique absente affiche **« non disponible »**, jamais `0`

### Lot 4 — l'équipe

- [ ] Un `montage` ne voit que ses assets et ne peut pas valider une publication
- [ ] Un asset refusé en revue revient en `en_cours` **avec le commentaire**
- [ ] Toute mutation apparaît dans le journal avec son auteur

### Lot 5 et 6 — publication et achat média

Critères à écrire au moment du lot : ils dépendent des portes ouvertes à cette date.

---

# 8. RÈGLES DE CONFORMITÉ — jeu initial

Toutes en base, gravité `bloquant` sauf mention.

| Code              | Libellé                             | Vérification                                                          |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `geo`             | Aucune mention géographique         | Liste de villes, départements, régions                                |
| `financier`       | Formulations financières interdites | « jusqu'à 100 % », « financé par Qualiopi », « sans avance de frais » |
| `ai-act`          | Pas d'affirmation de sanction       | « expose à une sanction » et variantes                                |
| `sujets`          | Sujets interdits                    | volume de base, chatbot, paiement en ligne, version anglaise          |
| `tags-nombre`     | 3 à 4 tags                          | compte du tableau `tags`                                              |
| `tags-liste`      | Tags hors liste fermée              | 17 valeurs autorisées                                                 |
| `tags-accent`     | Aucun accent dans un tag            | `[À-ÿ]`                                                               |
| `lien-corps`      | Aucun lien dans le corps            | `https?://` dans `corps`                                              |
| `utm`             | Tout lien porte ses 4 UTM           | `lienUrl`                                                             |
| `mentions`        | 2 mentions au maximum               | `@`                                                                   |
| `droit-image`     | Autorisation signée                 | via `EdEpisodeInvite`                                                 |
| `spec-plateforme` | Durée et ratio dans les limites     | via `EdSpecPlateforme`                                                |

**Les 17 tags** : `IAPourPME` `DirigeantPME` `AutomatisationPME` `ProcessusMetier` `ProductivitePME` `GainDeTemps` `ServiceClient` `FormationIA` `AIAct` `ConformiteIA` `RGPD` `SousLeCapot` `MaisonTemoin` `Recrutement` `CommercialIndependant` `Entrepreneuriat` `TransformationNumerique`

---

# 9. RÈGLES D'ALERTE — jeu initial

| Code                     | Déclencheur                               | Seuil par défaut | Gravité       |
| ------------------------ | ----------------------------------------- | ---------------- | ------------- |
| `sous-production`        | Trop peu d'un format sur le mois          | par objectif     | avertissement |
| `asset-retard`           | Publication à J-3, asset non prêt         | 3 jours          | avertissement |
| `non-programme`          | Publication à J-1, non programmée         | 1 jour           | bloquant      |
| `canal-muet`             | Aucune publication depuis N jours         | 21 jours         | avertissement |
| `derive-identite`        | Ratio perso/pro hors cible sur 30 j       | ±10 pts          | info          |
| `lien-sans-utm`          | Lien sans marquage                        | —                | bloquant      |
| `serie-interrompue`      | Rendez-vous récurrent sauté               | —                | avertissement |
| `metriques-absentes`     | Publication > 7 j sans relevé             | 7 jours          | info          |
| `tournage-dormant`       | Source sans dérivés produits              | 14 jours         | avertissement |
| `autorisation-manquante` | Épisode à J-7 sans signature              | 7 jours          | bloquant      |
| `variante-absente`       | Short publié sur une plateforme seulement | —                | info          |

**Où partent les alertes** : `EdCanalNotification` — **Telegram** _(déjà branché dans le dépôt)_ ou courriel, avec une gravité minimale par canal. Une alerte `bloquant` part immédiatement ; les autres sont regroupées en **un envoi quotidien**. Une alerte qui déclenche une notification à chaque fois finit en règle de filtrage dans la boîte de réception — et ne sert plus.

---

# 9 bis. LE TEMPS QUI PASSE

| Sujet                        | Règle                                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Campagnes pluriannuelles** | `EdPublication.campagne` — `q4-2026` aujourd'hui, `q1-2027` en janvier. **À incrémenter au changement de trimestre**, sinon les périodes se mélangent dans l'analyse UTM et l'historique devient illisible |
| **Archivage**                | `archiveeA` sort une publication des vues actives sans la supprimer. Automatique **90 jours après publication**, réversible d'un clic. Elle reste consultable, mesurable et exportable                     |
| **Rétention des métriques**  | 36 mois glissants, agrégés. Voir §11                                                                                                                                                                       |
| **Rien ne se supprime seul** | L'archivage est automatique, **la suppression jamais**. C'est un acte humain, journalisé                                                                                                                   |

---

# 10. CONTRATS DES ADAPTATEURS DE PUBLICATION

Une seule implémentation en lot 1 : `Manuel`.

```ts
export interface AdaptateurPublication {
  readonly code: string;
  readonly plateforme: EdPlateforme;
  /** Peut-on publier aujourd'hui ? Porte notamment l'audit TikTok. */
  estDisponible(compte: EdCompte): Promise<{ ok: boolean; raison?: string }>;
  /** Contrôles propres à la plateforme avant envoi. */
  valider(pub: EdPublication, assets: EdAsset[]): Promise<ResultatValidation>;
  /** Idempotent : rejouer ne publie jamais deux fois. */
  publier(pub: EdPublication, assets: EdAsset[]): Promise<{ refExterne: string; url: string }>;
  /** Le premier commentaire, quand la plateforme le permet. */
  commenter?(refExterne: string, texte: string): Promise<void>;
  releverMetriques?(refExterne: string): Promise<Partial<EdMetrique>>;
}
```

| Plateforme                   | Porte                                                 | Lot |
| ---------------------------- | ----------------------------------------------------- | --- |
| LinkedIn profil              | `w_member_social`, self-serve                         | 5a  |
| Meta _(Facebook, Instagram)_ | Aucune revue sur ses propres comptes                  | 5b  |
| YouTube                      | 10 000 unités/jour ≈ 100 uploads                      | 5c  |
| LinkedIn page                | Revue partenaire                                      | 5d  |
| **TikTok**                   | 🔴 **Audit — publications forcées en privé sans lui** | 5e  |

---

# 11. CONSERVATION ET RGPD

| Donnée                            | Base légale                                 | Conservation                                              |
| --------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| Publications, assets, idées       | Intérêt légitime — activité de l'entreprise | Sans limite. Suppression manuelle uniquement              |
| Métriques agrégées                | Intérêt légitime                            | 36 mois glissants                                         |
| Invité — nom, entreprise, contact | Exécution du consentement                   | Durée de la cession de droits + 5 ans                     |
| Autorisation signée               | Obligation probatoire                       | Durée de diffusion + 5 ans                                |
| Journal d'audit                   | Intérêt légitime — sécurité                 | 13 mois                                                   |
| Jetons OAuth                      | Exécution                                   | Jusqu'à révocation. Chiffrés au repos, jamais journalisés |

**Aucune donnée nominative d'audience.** Les métriques sont agrégées à la publication, jamais à la personne.

---

# 12. BUDGET DE PERFORMANCE

- La console est en zone admin, **hors du chemin critique public**
- Objectif : **≤ 120 Ko gz** par route de console _(le seuil public de 75 Ko ne s'y applique pas, mais l'écart doit être justifié)_
- **Mesure obligatoire avant/après** chaque lot : `pnpm build` puis relevé du First Load par route, consigné dans la PR
- ⚠️ **Les gates de budget sont en `continue-on-error`** : elles ne bloquent pas. La mesure manuelle est la seule garde réelle
- **Aucune bibliothèque de composants lourde.** Tailwind et les patrons de la console existante

---

# 13. RISQUES ET PARADES

| Risque                                                      | Probabilité              | Parade                                                                  |
| ----------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| **L'outil n'est pas ouvert** — trop lourd à alimenter       | 🔴 élevée                | Le test des 30 secondes / 5 champs. Si un lot le dégrade, il est refusé |
| **Deux sources de vérité** — les `.md` et la base divergent | 🔴 élevée                | Bascule explicite au §0, archive gelée après import                     |
| **Le modèle ne tient pas la vidéo**                         | 🟠 moyenne               | Arbre de dérivation dès le lot 0, même invisible à l'écran              |
| **Les rushes saturent le stockage**                         | 🟠 moyenne               | Règle du §5, jamais contournée                                          |
| **L'audit TikTok bloque tout**                              | 🟠 moyenne               | Publication hors lot 1. Adaptateur `estDisponible`                      |
| **Les règles se figent dans le code**                       | 🟠 moyenne               | Tout en base. Un test refuse une règle codée en dur                     |
| **La console alourdit le site public**                      | 🟡 faible                | Zone admin, mesure à chaque lot                                         |
| **Le droit à l'image oublié**                               | 🔴 élevée si non outillé | Règle bloquante + alerte à J-7                                          |

---

# 14. CE QUI RESTE À TRANCHER

| #   | Question                                                                 | Échéance            |
| --- | ------------------------------------------------------------------------ | ------------------- |
| 1   | Le compte TikTok est-il perso ou pro ?                                   | avant le lot 5e     |
| 2   | Le site entre-t-il au calendrier dès le lot 0 ?                          | avant le lot 0      |
| 3   | Le segment exact de la route de console                                  | avant le lot 0      |
| 4   | Les piliers éditoriaux — liste définitive                                | lot 1               |
| 5   | Newsletter Williams : e-mailing + relais LinkedIn — quel outil d'envoi ? | avant le 11 octobre |
| 6   | Les deux chaînes YouTube : L'Étoffe est-elle une `EdMarque` distincte ?  | lot 0               |
