# Réseau d'apporteurs : plan de correction des sept points bloquants (risque de salariat)

**Date : 25 novembre 2026. Base : `origin/main` au commit `ef5cc10d`.**
**Source : l'audit `docs/audits/apporteurs-risque-requalification-2026-11-25.md` (branche
`docs/apporteurs-audit-requalification`, PR #2260), lu comme une donnée.**

Ce document est un plan. Il ne contient aucun code et n'en modifie aucun. Chaque constat de l'audit a
été revérifié dans `origin/main` avant d'être repris ; les numéros de ligne ci-dessous sont ceux de
`ef5cc10d`, pas ceux de l'audit (fait sur `3151c61a1`).

⛔ **Hors périmètre de tous les lots** : le texte du contrat (`src/features/apporteurs-reseau/contrat-v2.ts`),
`CONTRAT_VERSION` et `src/content/legal.ts`. Tout ce qui demande d'y toucher est rangé à la fin, dans
« Pour l'avocat et le nouveau contrat ».

## Sommaire

1. Règles du dirigeant appliquées à ce plan
2. Vérification des sept constats dans `origin/main`
3. Vue d'ensemble des lots
4. Les lots, un par un
5. Dépendances et ordre de fusion
6. Décisions attendues du dirigeant
7. Pour l'avocat et le nouveau contrat
8. Ce que ce plan ne couvre pas

---

## 1. Règles du dirigeant appliquées à ce plan

Chaque lot les respecte, et chaque développeur doit les relire avant de commencer :

1. **Aucun plafond, compteur, seuil, classement ni objectif sur l'activité des apporteurs.** Les seules
   échéances posées par ce plan portent sur ce que **fait Axion** (préavis, réalisation de la prestation,
   réponse à une contestation), jamais sur ce que fait l'apporteur.
2. **Aucune relance.** Aucun lot n'ajoute d'e-mail qui pousse l'apporteur à agir. Les seuls e-mails
   nouveaux sont des **notifications d'une décision d'Axion** (résiliation, prise d'effet), que le
   contrat exige par écrit.
3. **Résiliation avec préavis de 30 jours et e-mail.** C'est le lot L1.
4. **Challenges facultatifs.** Aucun lot n'en crée ; aucun lot ne lie une conséquence à la participation.
5. **Commission due quand le client a payé à 100 %.** Le code le fait déjà pour la naissance de la
   commission ; la condition supplémentaire « prestation réalisée » vient du contrat 2.6 (article 4.2) et
   relève de l'avocat (section 7). Le lot L3 en réduit le risque sans changer le contrat.

---

## 2. Vérification des sept constats dans `origin/main`

| Constat                                                                   | Verdict                                                                     | Preuve dans `origin/main` (`ef5cc10d`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** Résiliation sans préavis, sans écrit, sans trace                   | **Confirmé**                                                                | `src/features/apporteurs-reseau/resiliation.ts:74-77` écrit `statut: "resilie", resilieAt: maintenant` à l'instant du clic ; `:83-89` termine toutes les attributions à cette date ; aucune écriture `activityLog` dans `resilierApporteur` (`:59-99`) ; la fonction ne reçoit pas l'identité de l'administrateur (`actions-commissions.ts:113` : `resilierApporteur(apporteurId)`) ; aucun gabarit de résiliation dans `envois.ts:28-47`. Écran : `src/components/admin/apporteurs/fiche/FinDeVieEtVigilance.tsx:143-165`, une case « Je confirme la résiliation de ce contrat. » (`:158`). Le contrat dit l'inverse : `contrat-v2.ts:796-797` (préavis de 30 jours, par écrit) et `:802-803` (pendant le préavis l'apporteur peut déclarer).                                                                                                                                                                                                                              |
| **B1 bis** (ajout, non relevé par l'audit)                                | **Constat nouveau**                                                         | Après résiliation, `versionLien` est incrémenté (`resiliation.ts:76`) et `envois.ts:149` retire le lien de tout e-mail d'un dossier `resilie`. Contrairement au retrait (`donnees.ts:300-304`, mode restreint si `argentEnJeu`), **rien ne rouvre l'espace d'un apporteur résilié qui doit encore déposer une attestation de vigilance** pour toucher une commission acquise : commission confisquée de fait. Traité dans L1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **B2** « Retirer du réseau » écarte un apporteur sous contrat             | **Confirmé**                                                                | `retrait.ts:64-96` : aucun contrôle du statut (un dossier `signe` est retiré), aucun motif (`prisma/schema.prisma:16506-16513`, modèle `ApporteurReseauRetrait` sans colonne de motif), aucun e-mail ; le lien est coupé (`retrait.ts:74-78`) ; tous les e-mails hors argent sont bloqués (`envois.ts:158-163`) ; l'apporteur lit seulement `src/app/apporteur/dossier/[id]/[jeton]/textes.ts:123`. Le message à l'administrateur (`retrait.ts:91-93`) rappelle bien le préavis, mais n'empêche rien.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **B3** Commission suspendue à « prestation marquée réalisée », sans délai | **Confirmé**                                                                | `realisation.ts:3-6` et `facturation.ts:227-229, 751, 806, 841-852` : rien n'est facturé ni versé sans `prestationRealiseeAt`. Hors formation (`realisation.ts:178` et suivantes), le marquage est un bouton. `annulerRealisation` (`realisation.ts:104-139`) ne demande aucun motif, et sa trace est « jamais bloquante » (`tracer`, `:47-66`, `catch {}` muet). Aucune alerte « payée à 100 %, non marquée réalisée ».                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **B4** Règle « validée au premier rendez-vous tenu, constaté par Axion »  | **Confirmé, sur les branches** (rien sur `main`)                            | Les branches `feat/apporteurs-rdv-lot1-donnees`, `-lot2-regles`, `-lot3-inscription`, `-lot5-rapprochement`, `-lot7a-gabarits` existent sur `origin` (trois de plus qu'au moment de l'audit). Lot 1 : `PropositionRendezVousPresentation` porte `ecarteeAt`, `ecarteeParId`, **aucun motif d'écartement ni date de notification** ; `PresentationReservation.validationSource` admet `saisie` **sans motif**. Lot 2 : `regle-attribution.ts` ne valide que sur un rendez-vous **tenu** (`rendezVousRecevable`, motif `pas_encore_tenu`), **aucune validation réputée** en cas d'inaction d'Axion. Lot 7a : « sans aucun reproche » et « validée sur votre compte » (`apporteur-presentation-recue-rendez-vous.tsx:66, 71, 74`). ✅ Point favorable déjà en place : `regleDe` (lot 2) n'applique la règle qu'aux signatures de contrat ≥ 2.8, et l'interrupteur `APPORTEURS_VALIDATION_RDV` est éteint par défaut : les contrats 2.6 gardent la confirmation par le silence. |
| **B5** Formulaire d'entrée = formulaire d'embauche                        | **Confirmé**                                                                | `src/components/forms/commercial-application/steps.tsx` : `:213` « étude de ma candidature », `:233` « Ce poste demande… indispensable », `:300-301` « Le profil recherché… », `:139` date de naissance, `:183` nationalité, `:687` zone de travail, `:771` déplacements, `:878` disponibilité. `CommercialApplicationWizard.tsx:404` et `:462` (« TOUTES vos expériences professionnelles des 10 dernières années »), `:304` « Candidature envoyée », `:514` « J'envoie ma candidature ». Côté serveur, `src/lib/commercial-application/model.ts:397` (`experiences` min 1), `:411-413` + `:454-457` (zone obligatoire), `:424` (`deplacement` **obligatoire, décision de Will du 2026-08-18**), `:427` (`disponibilite` obligatoire).                                                                                                                                                                                                                                     |
| **B6** Offre « carrières » décrivant un commercial terrain                | **Confirmé** (publication en production **non vérifiable** depuis le dépôt) | `careers-gen/business-developer-ia.json`, `titleFr` = « Commercial·e terrain B2B — solutions & interventions IA ». `scripts/seed-careers-offers.ts:53-57` (décision de Will du 2026-10-11 : « est un apporteur d'affaires, pas un CDI »). L'offre vit en base (`JobOffer`, statut `published`/`archived`) ; elle est écrite par le workflow `.github/workflows/careers-offres-seed.yml`. Mécanisme d'archivage déjà existant : `SLUGS_OFFRES_ARCHIVEES` (`src/server/content-gen/retrait-financement/plan.ts:46-50`), lu par le seed (`scripts/seed-careers-offers.ts:128`).                                                                                                                                                                                                                                                                                                                                                                                                |
| **B7** Trame d'échange : non-concurrence de fait                          | **Confirmé**                                                                | `docs/imprimes/trame-echange-apporteur.html:244` (« Seule limite de bon sens : ne pas recommander en même temps un concurrent direct »), `:272` (critère éliminatoire), `:358` (case « Apporte pour un concurrent direct »). Contraire à `contrat-v2.ts:98-101` (article 2.4 : libre « y compris auprès d'entreprises concurrentes »). Le document est servi dans la console (`src/content/imprimes.ts`, route `src/app/api/admin/imprimes/[id]/[fichier]/route.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

## 3. Vue d'ensemble des lots

| Lot     | Constat    | Objet                                                                                                                                    | Lançable sans décision du dirigeant ?                                                                |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **L0**  | tous       | Relevé en production, lecture seule : qui a déjà été résilié, retiré, marqué                                                             | ✅ Oui (accès SSH requis)                                                                            |
| **L1a** | B1         | Gabarit d'e-mail « résiliation notifiée » et « résiliation effective », non émis                                                         | ✅ Oui                                                                                               |
| **L1b** | B1, B1 bis | Résiliation en deux temps : notification, préavis de 30 jours, prise d'effet, journal, e-mail ; mode restreint après la fin              | ✅ Oui (règle déjà posée par le dirigeant)                                                           |
| **L2**  | B2         | Retrait refusé sous contrat ; « Classer le dossier (non signé) » avec motif                                                              | ✅ Oui pour le code. ⏸ Le sort des apporteurs **déjà** retirés sous contrat attend une décision (D2) |
| **L3a** | B3         | Motif obligatoire pour annuler une réalisation, trace transactionnelle, alerte interne « payée, non réalisée »                           | ✅ Oui                                                                                               |
| **L3b** | B3         | Prestation réputée réalisée d'office N jours après l'encaissement intégral                                                               | ⏸ Décision D3                                                                                        |
| **L4a** | B4         | Chantier rendez-vous : motif d'écartement, motif de validation manuelle, notification, textes du lot 7a                                  | ✅ Oui                                                                                               |
| **L4b** | B4         | Chantier rendez-vous : validation réputée si Axion ne fait rien, rendez-vous annulé par Axion                                            | ⏸ Décision D4, puis texte du contrat 2.8 (avocat)                                                    |
| **L5a** | B5         | Formulaire d'entrée : vocabulaire (« demande », pas « poste » ni « candidature ») et suppression du prérequis                            | ✅ Oui                                                                                               |
| **L5b** | B5         | Formulaire d'entrée : retrait des questions d'embauche (naissance, nationalité, zone, déplacements, disponibilité, parcours sur dix ans) | ⏸ Décision D5                                                                                        |
| **L5c** | B5         | Nouvelle adresse `/apporteur-affaires/dossier` avec redirection permanente                                                               | ⏸ Décision D6                                                                                        |
| **L6**  | B6         | Retrait de l'offre « Commercial·e terrain B2B » et redirection                                                                           | ⏸ Décision D7                                                                                        |
| **L7a** | B7         | Trame d'échange : ligne 244 alignée sur l'article 2.4                                                                                    | ✅ Oui                                                                                               |
| **L7b** | B7         | Trame d'échange : suppression du critère éliminatoire « concurrent direct » (lignes 272, 358)                                            | ⏸ Décision D8                                                                                        |

**Lançables tout de suite : L0, L1a, L1b, L2 (code), L3a, L4a, L5a, L7a.**

---

## 4. Les lots, un par un

Conventions communes à tous les lots :

- **Rouge d'abord** : chaque test listé est écrit et lancé **avant** le changement, et doit échouer pour
  la bonne raison. Le commit du test rouge peut être séparé du commit du correctif.
- **PR en brouillon** pendant le travail (AGENTS.md, « CI : brouillon = pas de CI lourde »), passée en
  « prête » une seule fois à la fin.
- **Fenêtre app ↔ worker** (AGENTS.md, D8b) : toute nouvelle colonne est nullable ou porte un défaut ;
  tout nouveau nom de gabarit porte `gabaritRepli` ou est livré dans une PR antérieure à son premier
  émetteur ; toute lecture d'une table neuve par le worker tolère son absence (code Prisma `P2021`,
  modèle : `retrait.ts:33-35`).
- **Build externalisé** (ADR 0026) : aucune page nouvelle ne fait d'appel base au rendu statique sans
  garde `stub.invalid`.
- **Journal** : toute décision défavorable à l'apporteur écrit son `activityLog` **dans la même
  transaction** que le geste. Le motif `catch {}` muet de `realisation.ts:63-65` n'est plus admis pour
  ces gestes.

### L0 — Relevé en production (lecture seule)

**Pourquoi.** L'audit ne sait pas si une résiliation, un retrait sous contrat ou une annulation de
réalisation a déjà été appliqué. Les lots L1 et L2 changent l'avenir ; ce relevé dit s'il faut réparer
le passé (décisions D1 et D2).

**Quoi.** Une personne qui a l'accès SSH au VPS exécute, dans le conteneur applicatif, des requêtes
**en lecture seule** et range le résultat (sans nom ni e-mail en clair : identifiants seulement) dans
`docs/audits/apporteurs-releve-prod-2026-11.md` :

1. apporteurs au statut `resilie` : `id`, `resilie_at`, `signe_par_societe_at` ;
2. lignes de `apporteur_reseau_retrait` dont l'apporteur est au statut `signe` ou `a_verifier` :
   `apporteur_id`, `retire_at`, `retire_par` ;
3. lignes de `activity_log` d'action `commission_apporteur.realisation_annulee` ;
4. commissions au statut `a_qualifier`, `due` ou `en_attente_vigilance` avec
   `prestation_realisee_at IS NULL`, et la date d'encaissement intégral de leur facture ;
5. pour chaque apporteur `resilie` : commissions encore `en_attente_vigilance` (constat B1 bis).

**Fichiers.** Aucun fichier de code. Un seul document ajouté.

**Tests.** Aucun (pas de code).

**Risques.** Écrire en base par erreur : n'utiliser que des `SELECT`, sous une session dont la
transaction est `READ ONLY`. Ne jamais copier de donnée personnelle dans le dépôt.

**Dépendances.** Aucune. Peut tourner en parallèle de tout.

**Lançable sans décision du dirigeant : oui.**

---

### L1a — Gabarits d'e-mail de la résiliation (livrés sans émetteur)

**Pourquoi.** Le dirigeant exige un e-mail. Un nouveau nom de gabarit émis par l'app avant que le
worker le connaisse est reporté puis replié (AGENTS.md, `gabaritRepli`) ; aucun gabarit existant n'a
une charge compatible avec une notification de résiliation. Le plus sûr est donc de livrer les
gabarits **dans une PR qui ne les émet pas**, puis de les émettre dans L1b.

**Changements.**

1. Deux gabarits neufs dans `src/lib/email/templates/` :
   - `apporteur-resiliation-notifiee.tsx` : notification écrite. Charge : `prenom`, `fondement`
     (`"11.1-societe" | "11.2" | "12.5" | "11.1-apporteur"`), `notifieeLe`, `effetLe`, `motif?`
     (11.2 seulement). Pour le fondement 11.1 à l'initiative de la Société, le texte est celui proposé
     par l'audit (B1, « Correctif »), **sans y ajouter de motif** (l'article 11.1 dispense de motiver).
     Pour 11.2 : la décision motivée (le motif saisi) et la date de la mise en demeure. Pour
     11.1 à l'initiative de l'apporteur : un accusé de réception de sa résiliation et la date d'effet.
   - `apporteur-resiliation-effective.tsx` : le jour de la prise d'effet. Rappelle que les commandes
     signées avant cette date restent commissionnées et que les commissions acquises sont versées ;
     si de l'argent est en jeu, porte le lien du mode restreint (cf. L1b, point 6).
   - Aucun des deux textes ne contient d'invitation à agir, de chiffre d'activité ni le mot
     « reproche ».
2. Enregistrement du nom dans : `src/server/queue/types.ts:186` (union des noms, à côté de
   `apporteur-manquement`), `src/lib/email/templates/index.tsx:643` (registre), `src/server/email/outbox-policy.ts:223`
   (libellé), `src/server/email/apercu/catalogue.ts:553` (aperçu + charge d'exemple),
   `src/features/apporteurs-reseau/envois.ts:28-47` et `:49-70` (`GabaritApporteur`, `GABARITS_APPORTEUR`).
3. **Les deux noms entrent dans `GABARITS_ARGENT`** (`retrait.ts:302-317`) : un apporteur résilié
   **et** retiré doit quand même recevoir la notification de sa propre résiliation.

**Tests (rouges d'abord).**

- `src/lib/email/templates/__tests__/apporteur-resiliation-notifiee.spec.tsx` : pour chaque fondement,
  le rendu contient la date d'effet ; pour `11.1-societe`, contient « continuer à nous présenter » et
  ne contient aucun motif ; pour `11.2`, contient le motif ; aucun rendu ne contient « reproche »,
  « objectif », « relance », « n'oubliez pas ».
- même chose pour `apporteur-resiliation-effective`.
- l'aperçu (`payloads-exemple.spec.ts`) connaît les deux noms.
- `envois`/`retrait` : les deux noms sont dans `GABARITS_APPORTEUR` et `GABARITS_ARGENT`.
- **garde de non-émission** : aucun fichier hors `templates/`, `catalogue.ts`, `types.ts`,
  `outbox-policy.ts`, `envois.ts`, `retrait.ts` ne contient la chaîne `apporteur-resiliation-` (test
  retiré par L1b).

**Risques.** Faible. La charte e-mail et la relecture au départ (`src/server/email/relecture-au-depart.ts`)
s'appliquent : faire passer les deux gabarits par l'aperçu de la console avant fusion.

**Dépendances.** Aucune. **Doit être fusionné et en ligne (worker compris) avant L1b.**

**Lançable sans décision du dirigeant : oui.**

---

### L1b — Résiliation en deux temps : notification, préavis, prise d'effet

**Pourquoi.** B1 et B1 bis. Règle du dirigeant : préavis de 30 jours et e-mail.

**Modèle de données (migration additive).** Une table neuve, séparée comme
`apporteur_reseau_retrait`, pour ne rien changer au modèle `ApporteurReseau` pendant la fenêtre
app ↔ worker :

```
ApporteurResiliation  (apporteur_resiliation)
  apporteurId     uuid, clé primaire (une résiliation en cours au plus par apporteur)
  initiative      varchar(12)  "societe" | "apporteur"
  fondement       varchar(8)   "11.1" | "11.2" | "12.5"
  notifieeLe      timestamptz  date de la notification écrite (jamais future)
  effetLe         timestamptz  date de prise d'effet
  miseEnDemeureLe timestamptz? 11.2 seulement, obligatoire dans ce cas
  motif           text?        11.2 et 12.5 : obligatoire ; 11.1 : interdit
  parId           varchar(64)  administrateur qui enregistre
  creeAt          timestamptz  défaut now()
  executeeAt      timestamptz? posé par la prise d'effet
  emailNotifEnvoyeAt  timestamptz?
  emailEffetEnvoyeAt  timestamptz?
```

Fichiers : `prisma/schema.prisma` (à côté de `ApporteurReseauRetrait`, ~l. 16506), une migration
`prisma/migrations/<horodatage>_apporteur_resiliation/migration.sql` + `rollback.sql`, et une
annotation `/// rgpd: technique` comme les modèles voisins.

**Changements.**

1. `src/features/apporteurs-reseau/resiliation.ts` :
   - nouvelle fonction **pure** `planNotificationResiliation({ initiative, fondement, notifieeLe,
miseEnDemeureLe?, motif?, maintenant })` qui rend la date d'effet ou un refus :
     - 11.1 (Société ou apporteur) : `effetLe = notifieeLe + 30 jours` (jours de Paris, borne
       incluse) ; **aucune saisie de date d'effet plus proche n'est acceptée** ; une date plus
       lointaine est acceptée si l'apporteur l'a demandée (initiative apporteur seulement) ;
     - 11.2 : refus sans `miseEnDemeureLe` antérieure à `notifieeLe`, refus sans motif ; effet
       immédiat (l'article 11.2 l'autorise) ;
     - 12.5 : refus sans motif (« radiation constatée le… », « décès ») ; effet immédiat ;
     - `notifieeLe` future : refus ;
   - nouvelle fonction `notifierResiliation(e, adminId)` : vérifie `statut === "signe"`, crée la ligne
     `ApporteurResiliation`, écrit `activityLog` `apporteur.resiliation_notifiee` (initiative,
     fondement, dates, motif) **dans la même transaction**, puis enfile l'e-mail
     `apporteur-resiliation-notifiee` (jobId déterministe `resiliation-notif-<apporteurId>`), et pose
     `emailNotifEnvoyeAt` à l'enfilage. **Le statut reste `signe`.** Si l'effet est immédiat (11.2,
     12.5), elle appelle directement la prise d'effet (point 2).
   - `resilierApporteur` (`:59-99`) devient `executerResiliation(apporteurId, effetLe)` : appelée
     seulement par la prise d'effet ; `resilieAt = effetLe` (et non `maintenant`) ;
     `planResiliation(presentations, effetLe)` ; pose `executeeAt` ; écrit `activityLog`
     `apporteur.resiliation_effective` dans la transaction ; enfile `apporteur-resiliation-effective`.
     Garde l'écriture conditionnelle actuelle (`:74-78`, deux passages ne résilient pas deux fois).
2. `src/features/apporteurs-reseau/passage-quotidien.ts` : nouvelle étape `"resiliations-echues"`
   dans la liste `etapes` (~l. 295-316) : lit les `ApporteurResiliation` dont `effetLe <= maintenant`
   et `executeeAt IS NULL`, appelle `executerResiliation`. Table absente (`P2021`) : l'étape ne fait
   rien (le worker peut tourner avant la migration).
3. `src/features/apporteurs-reseau/actions-commissions.ts:104-122` : `resilierApporteurAction` lit
   `initiative`, `fondement`, `notifieeLe`, `miseEnDemeureLe`, `motif`, passe l'identité de
   l'administrateur (`session.user.id`) et appelle `notifierResiliation`. Garde la case de
   confirmation.
4. `src/components/admin/apporteurs/fiche/FinDeVieEtVigilance.tsx:143-165` : le formulaire demande
   l'initiative (« Axion » / « L'apporteur, par écrit »), le fondement (11.1, 11.2, 12.5, avec une
   phrase d'explication chacun), la date de la notification écrite, la date de mise en demeure et le
   motif (affichés selon le fondement, sans JavaScript client : champs toujours présents, contrôlés
   côté serveur). La date d'effet est **calculée et affichée**, pas saisie. Quand une résiliation est
   en cours, le bloc affiche « Résiliation notifiée le …, effet le … » à la place du formulaire. Le
   paragraphe `:146-149` est réécrit : il décrit le préavis.
5. Espace de l'apporteur pendant le préavis : rien ne change (statut `signe`) ; ajouter une ligne
   d'information dans `src/app/apporteur/dossier/[id]/[jeton]/textes.ts` (« Votre contrat prend fin le
   {date}. Jusqu'à cette date, vous pouvez continuer à nous présenter des entreprises. ») et la lire
   dans la page signée.
6. **B1 bis — mode restreint après la fin** : dans `src/features/apporteurs-reseau/donnees.ts:283-306`
   (`lireDossierParLien`), un dossier `resilie` dont `argentEnJeu` est vrai s'ouvre en mode restreint,
   comme un dossier retiré. Pour que le lien existe : `executerResiliation` **n'incrémente plus
   `versionLien`** si de l'argent est en jeu, et `envois.ts:149` (`avecLienEspace`) recalcule le lien
   d'un dossier `resilie` pour les seuls `GABARITS_ARGENT`. Sans argent en jeu, comportement actuel
   (lien coupé).

**Tests (rouges d'abord).**

- `src/features/apporteurs-reseau/__tests__/resiliation.spec.ts` (existant, à étendre) et un fichier
  neuf `resiliation-preavis.spec.ts` :
  - 11.1 notifiée le 1er décembre : `effetLe` = 31 décembre ; une date d'effet antérieure est refusée ;
  - après notification, le statut est toujours `signe`, les présentations `reservee`/`confirmee`
    sont intactes, une déclaration nouvelle est acceptée ;
  - le passage quotidien du 30 décembre ne résilie pas ; celui du 31 résilie, avec
    `resilieAt` = date d'effet et `protegeeJusquAt` ramené à la date d'effet (pas au jour du passage) ;
  - deux passages le même jour ne résilient qu'une fois ;
  - 11.2 sans date de mise en demeure : refus ; avec : effet immédiat, motif journalisé ;
  - 12.5 sans motif : refus ;
  - chaque notification et chaque prise d'effet écrit un `activityLog` avec l'auteur, **dans la même
    transaction** (une erreur d'écriture du journal annule le geste) ;
  - un e-mail `apporteur-resiliation-notifiee` est enfilé une fois, puis `apporteur-resiliation-effective`
    une fois ;
  - table `apporteur_resiliation` absente (`P2021`) : le passage ne lève pas ;
  - **B1 bis** : un apporteur résilié avec une commission `en_attente_vigilance` ouvre son espace en
    mode restreint ; sans argent en jeu, le lien rend la page neutre.
- `src/features/apporteurs-reseau/__tests__/la-resiliation-n-est-jamais-immediate-en-11-1.spec.ts`
  (verrou de source) : aucun appel à `executerResiliation` hors de `passage-quotidien.ts` et de la
  branche « effet immédiat » de `notifierResiliation` ; `actions-commissions.ts` n'appelle plus
  `resilierApporteur` ni `executerResiliation`.
- Retirer la garde de non-émission posée par L1a.

**Risques.**

- **Résiliations déjà exécutées** en production sans préavis : ce lot ne les répare pas (D1).
- **Contrat app ↔ worker** : la prise d'effet tourne dans le worker. Table neuve, lecture tolérante :
  conforme à la règle symétrique d'AGENTS.md.
- **Nom de fonction** : `resilierApporteur` est importé par des tests ; le renommer casse ces tests
  volontairement (ils décrivent l'ancien comportement) : les réécrire, pas les contourner.
- **Fuseau** : compter les 30 jours en jours de Paris (`jourParis`, `autofacture-donnees.ts`), comme le
  reste du module.

**Dépendances.** Après L1a (fusionné **et** en ligne). Touche `actions-commissions.ts` comme L3a :
fonctions différentes, conflit de fusion trivial ; fusionner L1b et L3a l'un après l'autre et rebaser.
Touche `prisma/schema.prisma` comme L2 : modèles différents ; horodatages de migration distincts.

**Lançable sans décision du dirigeant : oui** (la règle « préavis de 30 jours et e-mail » est déjà
posée par lui). Seul le sort des résiliations passées attend D1.

---

### L2 — « Retirer du réseau » interdit sous contrat ; « Classer le dossier (non signé) »

**Pourquoi.** B2.

**Changements.**

1. `src/features/apporteurs-reseau/retrait.ts:64-96` (`retirerDuReseau`) :
   - refus si `a.statut` est `signe` ou `a_verifier`, avec le message de l'audit : « Contrat en cours :
     le retrait n'est pas possible. Pour mettre fin au contrat, utilisez « Résilier le contrat »
     (article 11). » (pour `a_verifier` : « Contrat signé par l'apporteur, en attente de votre
     contresignature : refusez le dossier ou contresignez-le. ») ;
   - nouvelle entrée `motif` (texte, 3 à 500 caractères, obligatoire) écrite dans la ligne de retrait
     et dans `activityLog.changes` ;
   - un dossier `resilie` reste classable (son contrat est fini ; le geste ne fait que ranger la fiche).
2. `prisma/schema.prisma:16506-16513` : ajouter `motif String? @db.Text` à `ApporteurReseauRetrait`
   (nullable : les lignes anciennes n'en ont pas). Migration additive + rollback.
3. `src/features/apporteurs-reseau/actions-retrait.ts:58-60` et la version formulaire (à partir de
   `:78`) : lire et transmettre `motif`.
4. `src/components/admin/apporteurs/fiche/RetraitDuReseau.tsx:72-100` : pour un dossier `signe` ou
   `a_verifier`, le bloc n'est **pas affiché** (il renvoie par une phrase à « Résilier le contrat ») ;
   sinon, le résumé devient « Classer le dossier (non signé) » et le formulaire demande le motif.
   Garder « Remettre dans le réseau » tel quel.
5. `retrait.ts:143-155` (`refusSuppression`) : remplacer « Utilisez « Retirer du réseau » » par la
   bonne voie selon le cas (« Résilier le contrat » pour un dossier signé, « Classer le dossier » sinon).
6. Conserver `argentEnJeu` et le mode restreint (`retrait.ts:288-317`, `donnees.ts:300-304`) : ils
   servent aux dossiers déjà retirés.

**Tests (rouges d'abord).**

- `src/features/apporteurs-reseau/__tests__/retrait-refuse-sous-contrat.spec.ts` (neuf) : retirer un
  dossier `signe` → refus, aucune ligne créée, `versionLien` inchangé ; idem `a_verifier` ; un dossier
  `dossier_en_cours` sans motif → refus ; avec motif → ligne créée, motif dans la ligne et dans le
  journal ; un dossier `resilie` → accepté.
- `les-actions-de-retrait-sont-reservees-aux-admins.spec.ts` (existant) : reste vert.
- Verrou de source : `RetraitDuReseau.tsx` ne contient plus le libellé « Retirer du réseau ».

**Risques.**

- **Apporteurs déjà retirés sous contrat** : ils le restent. Le lot ne les remet pas d'office dans le
  réseau, parce que cela leur enverrait de nouveau des e-mails et changerait leur lien : D2.
- Le parcours « refuser un dossier `a_verifier` » existe-t-il dans la console ? `verification.ts`
  porte le statut `refuse` ; le développeur vérifie que le message renvoie à un geste réel, sinon il
  écrit « contresignez-le ou écrivez-nous ».

**Dépendances.** Aucune avec les autres lots, hors conflit de fichier `schema.prisma` avec L1b.

**Lançable sans décision du dirigeant : oui pour le code ; le traitement des retraits passés attend D2.**

---

### L3a — Réalisation : motif obligatoire, trace sûre, alerte interne

**Pourquoi.** B3, pour la part qui ne demande pas de changer le contrat.

**Changements.**

1. `src/features/apporteurs-reseau/realisation.ts:104-139` (`annulerRealisation`) : nouvelle entrée
   `motif` obligatoire (3 à 500 caractères), refus sans motif ; l'`updateMany` et l'`activityLog`
   passent dans **une même transaction** (la trace n'est plus « jamais bloquante » pour ce geste).
   Même traitement pour `marquerPrestationRealisee` (`:75-101`), sans motif obligatoire.
2. Appelants : `actions-commissions.ts:242-249` (`annulerRealisationAction`),
   `actions-prestation-fiche.ts:71-78` (`annulerRealisationFicheAction`), et les deux formulaires :
   `src/app/[locale]/(admin)/[adminPrefix]/apporteurs/commissions/page.tsx:357` et
   `src/components/admin/apporteurs/entreprises/PrestationFiche.tsx:56` (champ « Motif » requis).
3. **Alerte interne** (pas d'e-mail à l'apporteur) : nouvelle étape `"realisations-en-attente"` dans
   `passage-quotidien.ts` (~l. 295-316, sur le modèle de `alerterHorsGrille` et
   `alerterDeclarationsSansReponse`) : signale à Williams, une fois par commission, celles dont la
   facture est payée à 100 % depuis plus de `ALERTE_REALISATION_JOURS` (constante interne, **non
   contractuelle**, valeur proposée 60 jours) et dont la prestation n'est pas marquée réalisée. Ce
   délai porte sur la diligence d'Axion, pas sur l'activité de l'apporteur : il ne contrevient pas à la
   règle « aucun seuil ».
4. Constante documentée dans `regles.ts` à côté de `RAPPEL_SANS_REPONSE_JOURS` (`:46-51`), avec la
   même mention « Ce n'est PAS un délai du contrat ».

**Tests (rouges d'abord).**

- `src/features/apporteurs-reseau/__tests__/annuler-realisation-exige-un-motif.spec.ts` : sans motif →
  refus et rien ne change ; avec motif → `activityLog` porte le motif ; journal en échec → geste annulé.
- `contrat-2-3-commission-realisee.spec.ts` et `prestation-realisee-depuis-la-fiche.spec.ts`
  (existants) : adaptés à la nouvelle signature.
- `realisations-en-attente.spec.ts` : payée depuis 59 jours → rien ; 60 jours → une alerte ; deuxième
  passage → pas de seconde alerte ; aucune alerte n'est adressée à l'apporteur (aucun gabarit
  `apporteur-*` enfilé).

**Risques.** Faible. L'alerte doit dédoublonner (jobId déterministe par commission), sinon elle
devient un bruit quotidien.

**Dépendances.** Conflit trivial avec L1b dans `actions-commissions.ts` et `passage-quotidien.ts`
(entrées voisines de la liste `etapes`).

**Lançable sans décision du dirigeant : oui.**

---

### L3b — Prestation réputée réalisée d'office

**Pourquoi.** B3 : le seul correctif qui retire à Axion le pouvoir de bloquer indéfiniment une
commission dont le client a tout payé.

**Changements (si D3 = oui).**

1. `realisation.ts` : nouvelle fonction `marquerRealiseesDOffice(maintenant)` : pour chaque
   commission `MARQUABLES` sans `prestationRealiseeAt`, dont l'encaissement intégral date de plus de
   `REALISATION_REPUTEE_JOURS` (valeur décidée en D3), pose `prestationRealiseeAt = encaissement +
délai`, `prestationRealiseePar = "office"`, journal dans la transaction.
2. Une **opposition** possible avant l'échéance : bouton « S'opposer au marquage d'office » avec motif
   obligatoire, journalisé (colonne neuve nullable `realisationOppositionMotif` ou ligne de journal
   seule — au choix du développeur, à justifier). Une réalisation annulée à la main
   (`ANNULEE_A_LA_MAIN`, `realisation.ts:69`) n'est pas reprise d'office **si un motif a été saisi**
   (L3a).
3. Étape `"realisation-d-office"` dans `passage-quotidien.ts`, avant `commissions`/`autofacturation`.

**Tests (rouges d'abord).** Payée depuis délai − 1 jour → non marquée ; délai → marquée avec la bonne
date ; opposition motivée → non marquée ; idempotent.

**Risques.** Payer une commission sur une prestation réellement non faite : c'est le cœur de la
décision D3, et la reprise (article 4.5) reste le filet.

**Dépendances.** Après L3a (motif d'annulation).

**Lançable sans décision du dirigeant : non. Attend D3 : « Acceptez-vous qu'une prestation soit
considérée comme réalisée d'office N jours après que le client a tout payé, sauf opposition motivée ? »**

---

### L4a — Chantier « rendez-vous » : motifs, notification, textes

**Pourquoi.** B4, pour ce qui ne dépend pas du texte du contrat 2.8.

**Où.** Sur les branches du chantier, **avant leur fusion** : coordonner avec la session qui les porte
(ne pas pousser sur une branche ouverte par une autre session sans son accord ; à défaut, ouvrir une
branche `fix/apporteurs-rdv-motifs` à partir de `origin/feat/apporteurs-rdv-lot1-donnees`).

**Changements.**

1. Lot 1, `prisma/schema.prisma` (modèle `PropositionRendezVousPresentation`) : ajouter
   `ecarteeMotif String? @db.Text` et `ecarteeNotifieeAt DateTime?`. Modèle
   `PresentationReservation` : ajouter `validationMotif String? @db.Text`. Migration additive du lot 1
   (pas encore jouée en production : on peut l'amender tant qu'elle n'est pas fusionnée ; sinon,
   migration neuve).
2. Lot 5 (`rapprochement-rendez-vous.ts`) et tout geste « écarter » : refus sans motif ; journal dans
   la transaction ; le motif est **communiqué à l'apporteur** (gabarit neuf, livré selon la même
   méthode que L1a : gabarit d'abord, émetteur ensuite).
3. Toute validation `validationSource = "saisie"` : refus sans `validationMotif`.
4. Lot 7a, `src/lib/email/templates/apporteur-presentation-recue-rendez-vous.tsx` :
   - `:74` « Sans rendez-vous pris d'ici là, la réservation s'arrête, sans aucun reproche : … » →
     « Sans rendez-vous pris d'ici là, la réservation prend fin automatiquement ; vous pourrez nous
     présenter de nouveau cette entreprise après un nouveau contact avec elle. »
   - `:66` et `:71` « sur votre compte » → « à votre nom ».
   - commentaire `:15` aligné.
5. Lot 7a, `entreprise-information-coordonnees.tsx` : reprendre la base légale, la durée de
   conservation et le droit de réclamation du gabarit d'information en service (constat de l'audit,
   section 4.3, dernier alinéa).
6. **Verrou** : un test interdit tout gabarit vers l'apporteur, dans ce chantier, qui l'invite à
   relancer l'entreprise ou à obtenir un rendez-vous (pression indirecte, audit 4.2 point 5) : liste
   fermée des gabarits du chantier, et pour chacun absence des tournures « relancez », « pensez à »,
   « obtenir un rendez-vous », « n'oubliez pas ».

**Tests (rouges d'abord).** Écarter sans motif → refus ; écarter avec motif → journal + e-mail enfilé ;
validation manuelle sans motif → refus ; rendu du gabarit lot 7a sans « reproche » ni « sur votre
compte » ; verrou anti-relance ci-dessus ; `regleDe` (lot 2) rend `null` pour toute signature tant que
`CONTRAT_VERSION` est inférieur à `VERSION_REGLE_RENDEZ_VOUS` (verrou : la règle ne peut pas
s'appliquer à un contrat qui ne la contient pas).

**Risques.** Conflit avec la session du chantier. Ne **jamais** allumer
`APPORTEURS_VALIDATION_RDV` dans ce lot.

**Dépendances.** Les branches du chantier rendez-vous. Indépendant des autres lots de ce plan.

**Lançable sans décision du dirigeant : oui.**

---

### L4b — Chantier « rendez-vous » : Axion ne peut pas bloquer la validation par son inaction

**Pourquoi.** B4, cœur du risque : aujourd'hui le silence d'Axion valide la déclaration ; demain il
l'invaliderait.

**Changements (si D4 = oui, et une fois le texte 2.8 relu par l'avocat).**

1. `regle-attribution.ts` (lot 2) : fonction pure `validationReputee({ recueAt, premiereDemarcheSocieteAt,
maintenant })` : sans aucune démarche de la Société dans les 30 jours de la saisie, la présentation
   est validée d'office (`validationSource = "reputee"`), et la protection de six mois part de ce jour.
2. Rendez-vous annulé ou reporté **par Axion** : la réservation est prolongée d'autant
   (`reserveeJusquAt` recalculé, journalisé). Rendez-vous où Axion ne se présente pas : validation.
3. « Démarche de la Société » = un horodatage existant (e-mail envoyé, rendez-vous proposé dans
   Calendly, devis) : le développeur liste les sources et les teste une par une.
4. Le passage quotidien applique la validation réputée (étape neuve, tolérante à l'absence des tables).

**Tests (rouges d'abord).** Saisie le J, aucune démarche → J+29 non validée, J+30 validée ; une
démarche à J+10 → pas de validation réputée ; rendez-vous annulé par Axion à J+50 → réservation
prolongée ; interrupteur éteint → aucun effet.

**Risques.** Écrire en code une règle que le contrat 2.8 ne contiendrait pas : ne fusionner qu'avec le
texte 2.8 définitif.

**Dépendances.** Après L4a ; après D4 ; après le texte du contrat 2.8 (section 7).

**Lançable sans décision du dirigeant : non. Attend D4 : « Acceptez-vous qu'une entreprise présentée
soit validée d'office si Axion ne l'a pas contactée dans les 30 jours ? »**

---

### L5a — Formulaire d'entrée : vocabulaire de l'apport d'affaires

**Pourquoi.** B5, pour ce qui ne retire aucune question.

**Changements (`src/components/forms/commercial-application/`).**

| Fichier:ligne                         | Aujourd'hui                                                                                                    | Demain                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `steps.tsx:213`                       | « … pour l'étude de ma candidature. »                                                                          | « … pour l'étude de ma demande d'apport d'affaires. »                                            |
| `steps.tsx:233`                       | « Ce poste demande une vraie expérience de la vente B2B. C'est le seul prérequis, mais il est indispensable. » | « Aucune expérience n'est exigée. Ces réponses nous aident seulement à préparer notre échange. » |
| `steps.tsx:298-302`                   | « Le profil recherché est vraiment orienté vente B2B… »                                                        | paragraphe supprimé                                                                              |
| `CommercialApplicationWizard.tsx:304` | « Candidature envoyée »                                                                                        | « Dossier envoyé »                                                                               |
| `CommercialApplicationWizard.tsx:514` | « J'envoie ma candidature »                                                                                    | « J'envoie mon dossier »                                                                         |
| `CommercialApplicationWizard.tsx:537` | « … l'étude de votre candidature … »                                                                           | « … l'étude de votre demande … »                                                                 |
| `CommercialApplicationWizard.tsx:462` | « Êtes-vous sûr d'avoir indiqué TOUTES vos expériences professionnelles des 10 dernières années ? »            | supprimé (la question de confirmation disparaît ; l'écran du parcours reste jusqu'à D5)          |
| `CommercialApplicationWizard.tsx:404` | « Vente B2B, postes des 10 dernières années. »                                                                 | « Votre parcours, en quelques lignes. »                                                          |

- **Ne pas renommer** les événements Plausible « Candidature Step / Started / Completed »
  (`CommercialApplicationWizard.tsx:144, 202, 218`) : ce sont des noms techniques de mesure, invisibles
  pour la personne, et les renommer casse les séries.
- Commentaires de code (`steps.tsx:1, 269, 767`) : vocabulaire aligné, sans changement de logique.
- Vérifier si le texte de consentement (`:213`) est conservé comme preuve
  (`__tests__/le-consentement-precede-l-ecriture.spec.ts`, `src/features/commercial-application/actions.ts`) :
  si une version de texte est stockée, l'incrémenter.

**Tests (rouges d'abord).** Verrou de source `src/components/forms/commercial-application/__tests__/vocabulaire-apport-d-affaires.spec.ts` :
les deux fichiers ne contiennent, dans leur texte rendu (hors commentaires et hors noms d'événements),
ni « poste » (hors champ du parcours tant que D5 n'est pas tranchée), ni « candidature », ni
« prérequis », ni « profil recherché », ni « indispensable ».

**Risques.** Tests existants qui figent ces chaînes : les mettre à jour, pas les supprimer. La page
publique `/devenir-commercial-ia` (`src/app/[locale]/devenir-commercial-ia/page.tsx`) emploie peut-être
le même vocabulaire : relevé à faire, mais elle relève des constats « importants » de l'audit (I-série),
hors de ce plan.

**Dépendances.** Aucune. À fusionner avant L5b (L5b part de ce texte).

**Lançable sans décision du dirigeant : oui.**

---

### L5b — Formulaire d'entrée : retrait des questions d'embauche

**Pourquoi.** B5 : date de naissance, nationalité, zone de travail, déplacements, disponibilité,
parcours obligatoire sur dix ans.

**Changements (si D5 = oui).**

1. `steps.tsx` : supprimer les écrans ou champs `:139` (naissance), `:183` (nationalité), `:687` (zone ;
   à défaut, question facultative « Où se trouvent les dirigeants que vous connaissez ? »), `:771`
   (déplacements), `:878` (disponibilité), et l'écran du parcours (`:319-460` environ), remplacé par un
   champ libre facultatif « Quelques mots sur vous ».
2. `src/lib/commercial-application/model.ts` : rendre **facultatifs**, sans les retirer du schéma
   (un onglet ouvert avant le déploiement les envoie encore ; même raisonnement que
   `consentVivier`, `:440-452`) : `experiences` (`:397`), `zoneMobile`/`zones` (`:411-413`) et le
   `refine` de zone (`:454-457`), `deplacement` (`:424`), `disponibilite` (`:427`). Ne plus les
   enregistrer s'ils sont absents.
3. `src/lib/commercial-application/scoring.ts:101` (`scoreCandidature`) : retirer les points tirés de
   ces champs. **Le principe même d'une note** relève de la question 14 de l'audit (avocat) : ce lot ne
   la supprime pas, il cesse seulement de la nourrir avec des critères d'embauche.
4. `src/features/commercial-application/actions.ts:136-160` (`periodeOf`, `buildRecapRows`) et
   `src/components/forms/commercial-application/wizard-state.ts:271` : tolérer l'absence.
5. Console : la fiche « Contacts › Commercial » et la route CV
   (`src/app/[locale]/(admin)/[adminPrefix]/contacts/commercial/[id]/cv/route.ts`) affichent « — »
   pour un champ absent ; les dossiers déjà reçus gardent leurs réponses (rien n'est effacé).

**Tests (rouges d'abord).** Schéma : une demande sans `experiences`, `zones`, `deplacement`,
`disponibilite` est acceptée ; une demande « ancien onglet » qui les porte est toujours acceptée ;
score : ne lit plus ces champs ; verrou de source : `steps.tsx` ne contient plus « Date de naissance »,
« Nationalité », « déplacer », « disponible », « zone souhaitez-vous travailler ».

**Risques.** Perte de signaux de tri à l'entrée (c'est l'objet de la décision). Formulaires
d'invitation voisins (`src/components/recrutement/*`) qui réutiliseraient le même schéma : le
développeur les liste avant de commencer.

**Dépendances.** Après L5a.

**Lançable sans décision du dirigeant : non. Attend D5 : « Acceptez-vous de ne plus demander, à
l'entrée, la date de naissance, la nationalité, la zone, les déplacements, la disponibilité et le
parcours sur dix ans ? »** (deux de ces questions ont été rendues obligatoires par vous le 2026-08-18.)

---

### L5c — Adresse du formulaire

**Changements (si D6 = oui).** Déplacer `src/app/[locale]/devenir-commercial-ia/candidature/page.tsx`
vers `src/app/[locale]/apporteur-affaires/dossier/page.tsx` (le dossier `apporteur-affaires` existe
déjà) ; redirection **permanente** de l'ancienne adresse dans `next.config.*` (`redirects()`, ~l. 278),
avec un test dans `tests/unit/redirects/` sur le modèle des existants ; mise à jour des liens internes
(`grep -rn "devenir-commercial-ia/candidature" src`) et du sitemap.

**Tests.** La redirection rend 308/301 vers la nouvelle adresse ; aucun lien interne ne pointe encore
vers l'ancienne.

**Risques.** Campagnes publicitaires et e-mails déjà envoyés qui portent l'ancienne adresse : la
redirection les couvre, mais les statistiques Plausible changent de page. Budget Web Vitals : page
déplacée, pas alourdie ; vérifier que `pnpm bundle:check` reste vert (partition des `page-*.js`).

**Dépendances.** Après L5a.

**Lançable sans décision du dirigeant : non. Attend D6 : « Acceptez-vous de changer l'adresse du
formulaire (l'ancienne redirige) ? »**

---

### L6 — Retrait de l'offre « Commercial·e terrain B2B »

**Changements (si D7 = oui).**

1. `src/server/content-gen/retrait-financement/plan.ts:46-50` : **ne pas** réutiliser
   `SLUGS_OFFRES_ARCHIVEES` (elle porte le motif « retrait du financement » et ses sauvegardes) ;
   créer à côté, dans `src/lib/careers/`, une liste `SLUGS_OFFRES_RETIREES_APPORTEURS =
["business-developer-ia"]`, lue par `scripts/seed-careers-offers.ts:128` pour ne plus
   (re)publier l'offre.
2. Passage de l'offre en `archived` en production : par la console des offres (geste humain) ou par
   le workflow `careers-offres-seed.yml` si un mode « archiver » existe ; sinon, geste humain consigné.
3. Redirection permanente de `/fr/carrieres/business-developer-ia` vers la page des apporteurs
   (`src/app/[locale]/apporteur-affaires/`) dans `next.config.*`.
4. `careers-gen/business-developer-ia.json` : conservé (historique), avec un champ ou un fichier
   voisin `README` qui dit « retirée le …, ne pas republier ». `src/content/careers/careers-images.ts:78`
   : conservé.
5. `src/lib/careers/__tests__/candidate-family.spec.ts:52` et
   `src/lib/careers/__tests__/careers-seed-coherence.spec.ts` : adaptés.

**Tests (rouges d'abord).** Le seed refuse d'écrire `business-developer-ia` ; la redirection répond ;
`listIndexableJobOfferSlugs` (page `carrieres/[slug]/page.tsx:97`) ne rend pas ce slug quand l'offre est
archivée (test sur données simulées).

**Risques.** Annonces déjà diffusées ailleurs (sites d'emploi, réseaux) : hors du dépôt, à retirer à
la main (D7). Candidatures reçues par cette offre : elles restent en base.

**Dépendances.** Aucune.

**Lançable sans décision du dirigeant : non. Attend D7 : « Acceptez-vous de retirer l'offre
« Commercial·e terrain B2B » des carrières et des sites d'emploi ? »**

---

### L7a — Trame d'échange, ligne 244

**Changement.** `docs/imprimes/trame-echange-apporteur.html:244` : la réponse devient « Oui, aucune
exclusivité, y compris pour des prestations comparables. » C'est le texte de l'article 2.4 du contrat
en service (`contrat-v2.ts:98-101`) : on aligne un document interne sur le contrat, on ne change pas
le contrat.

**Tests (rouges d'abord).** `src/content/__tests__/imprimes-internes.spec.ts` (existant) : ajouter que
la trame ne contient pas « Seule limite de bon sens ».

**Risques.** Aucun technique. Le document est servi dans la console ; le PDF éventuel déjà imprimé
n'est pas rappelé.

**Dépendances.** Aucune.

**Lançable sans décision du dirigeant : oui.**

### L7b — Trame d'échange, critère éliminatoire « concurrent direct »

**Changement (si D8 = oui).** Supprimer `:272` (`<li>` « Apporte déjà pour un concurrent direct… »)
et `:358` (case à cocher). Test : la trame ne contient plus « concurrent direct ».

**Lançable sans décision du dirigeant : non. Attend D8 : « Acceptez-vous de ne plus écarter, à
l'entrée, une personne qui apporte déjà des affaires à un concurrent ? »**

---

## 5. Dépendances et ordre de fusion

```
L0  ───────────────────────────────── (indépendant, éclaire D1 et D2)
L1a ──► (en ligne, worker compris) ──► L1b
L2  ─────────────────────────────────  (conflit schema.prisma avec L1b : rebaser)
L3a ──► [D3] ──► L3b                   (conflit actions-commissions.ts avec L1b : rebaser)
L4a ──► [D4 + contrat 2.8] ──► L4b     (sur les branches du chantier rendez-vous)
L5a ──► [D5] ──► L5b
    └─► [D6] ──► L5c
[D7] ──► L6
L7a ;  [D8] ──► L7b
```

Sept lots partent en parallèle aujourd'hui : **L0, L1a, L2, L3a, L4a, L5a, L7a**, puis **L1b** dès que
L1a est en ligne. Les fichiers partagés sont `prisma/schema.prisma` (L1b, L2), `actions-commissions.ts`
et `passage-quotidien.ts` (L1b, L3a) : modèles et fonctions différents, conflits de texte seulement.
Une seule session tient la file de fusion (AGENTS.md).

---

## 6. Décisions attendues du dirigeant

Chaque question appelle un oui ou un non.

- **D1 — Résiliations déjà exécutées sans préavis.** Si L0 en trouve : acceptez-vous d'écrire à
  chaque personne concernée pour régulariser (et, si l'avocat le conseille, de lui verser ce qu'elle
  aurait touché pendant 30 jours de préavis) ?
- **D2 — Apporteurs déjà « retirés du réseau » alors que leur contrat était signé.** Si L0 en trouve :
  pour chacun, les remettre dans le réseau (avec un nouveau lien envoyé), ou leur notifier une
  résiliation avec 30 jours de préavis ?
- **D3 — Prestation réalisée d'office.** Acceptez-vous qu'une prestation soit considérée comme
  réalisée d'office N jours après que le client a tout payé, sauf opposition motivée d'Axion ? Et
  quelle durée N (l'audit propose 90 jours) ?
- **D4 — Validation d'office d'une entreprise présentée.** Acceptez-vous qu'une entreprise présentée
  soit validée d'office si Axion ne l'a pas contactée dans les 30 jours, et qu'un rendez-vous annulé
  par Axion prolonge la réservation ?
- **D5 — Questions d'embauche à l'entrée.** Acceptez-vous de ne plus demander la date de naissance, la
  nationalité, la zone, les déplacements, la disponibilité et le parcours sur dix ans ?
- **D6 — Adresse du formulaire.** Acceptez-vous de passer de `/devenir-commercial-ia/candidature` à
  `/apporteur-affaires/dossier`, l'ancienne adresse redirigeant vers la nouvelle ?
- **D7 — Offre « Commercial·e terrain B2B ».** Acceptez-vous de la retirer des carrières et des sites
  d'emploi où elle est diffusée ?
- **D8 — Concurrents.** Acceptez-vous de ne plus écarter à l'entrée une personne qui apporte déjà des
  affaires à un concurrent ?
- **D9 — Commission due au paiement intégral, sans condition de réalisation.** Votre règle dit
  « commission due quand le client a payé à 100 % » ; le contrat 2.6 ajoute « et prestation
  réalisée ». Voulez-vous que le prochain contrat supprime cette condition ? (Le code ne peut pas le
  faire seul : il suit le contrat signé.)

---

## 7. Pour l'avocat et le nouveau contrat

Aucun lot de ce plan ne touche `contrat-v2.ts`, `CONTRAT_VERSION` ni `src/content/legal.ts`. Ce qui
suit demande un texte nouveau et une relecture :

1. **Article 4.2, deuxième alinéa** (B3) : « quelle qu'en soit la cause, y compris du fait de la
   Société » (`contrat-v2.ts:406-408`, vérifié). Rédaction proposée par l'audit (B3, « Correctif du
   contrat ») : commission due sur les sommes encaissées et conservées quand la non-réalisation vient
   de la Société ; prestation réputée réalisée au plus tard quatre-vingt-dix jours après l'encaissement
   intégral. À arbitrer avec D3 et D9.
2. **Article 3.2 nouveau** (B4, contrat 2.8) : réservation de 60 jours, faits de validation, diligence
   de la Société, validation réputée, motif écrit de l'écartement et réponse motivée sous trente
   jours. Rédaction proposée : audit, section 4.3. À arbitrer avec D4. **L'interrupteur
   `APPORTEURS_VALIDATION_RDV` ne doit pas être allumé avant la signature de ce texte**, et le code
   (lot 2) ne l'applique qu'aux signatures ≥ 2.8.
3. **Passage des signataires de la 2.6 à la 2.8** : avenant, ou résiliation avec préavis puis
   nouveau contrat ? (audit, question 5).
4. **Durée du préavis** : 30 jours suffisent-ils pour une relation ancienne (audit, question 7) ? Le
   code de L1b lit 30 jours dans une constante : un barème selon l'ancienneté serait un changement
   de constante et de contrat, pas de structure.
5. **Article 11.2** : la résiliation sans préavis pour manquement aux articles 22 et 22 bis est-elle
   proportionnée (question 8) ? L1b exige déjà une mise en demeure datée et un motif.
6. **Mode restreint après la fin du contrat** (B1 bis) : vérifier que l'article 12.2 couvre bien le
   dépôt d'attestations après la fin, et que la rédaction n'en fait pas une condition du paiement.
7. **Note sur 20 à l'entrée** (question 14) et **sélection** : L5b cesse de nourrir la note avec des
   critères d'embauche, mais ne la supprime pas.
8. **Retrait des apporteurs « non actifs »** : le contrat ne connaît que la suspension de quinze jours
   (`contrat-v2.ts:336-345`, vérifié) ; après L2, la console ne peut plus écarter un apporteur
   sous contrat. Confirmer qu'aucun autre geste ne doit exister.

---

## 8. Ce que ce plan ne couvre pas

- Les **31 constats importants et 22 mineurs** de l'audit, dont : invitations envoyées à des
  candidats à un emploi salarié (I1), manquement appliqué avant la réponse de l'apporteur, refus d'une
  déclaration sans motif enregistré, reprise manuelle sans journal, article 22 bis et outils de
  communication. Ils appellent un plan à part.
- La **pratique réelle** (appels, visios, messages hors système), que le code ne voit pas.
- La **publication réelle** de l'offre B6 et des annonces externes : à constater à la main (D7).
- Les branches anciennes non lues par l'audit (contrat 2.7, manquement et fraude, rappels de
  dossier) : à vérifier avant de lancer L1b et L3a, pour ne pas les contredire.
