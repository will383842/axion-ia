# ADR 0060 — Verrou du dossier de session et réouverture motivée, visible par l'auditeur

- **Statut** : proposé (PR `qualiopi/verrou-dossier-serveur`, lot L1 de la refonte « session de bout en bout », label `schema`)
- **Date** : 2026-09-30
- **Auteur** : A02 Architecte (spécification) + Claude (réalisation)
- **Numéro** : la spécification visait 0052 ; 0052 à 0059 sont pris, d'où 0060.
- **Constat** : audit UX du 30/09 en production sur AXI-SESS-2026-001 (« Réalisée », attestation émise) — dates, lieu, formateur, inscriptions, statuts, grille d'émargement, évaluations, pièces, saisie du questionnaire à froid à la place du stagiaire et « Annuler cette pièce » sur une convention signée restaient modifiables sur un dossier terminé.
- **Référence** : `src/server/qualiopi/sessions/verrou-dossier.ts` (prédicat) ; `verrou-dossier-garde.ts` (garde) ; `verrou-dossier-registre.ts` (registre exécutable) ; `historique-dossier.ts` (ce que voit le certificateur) ; `src/server/actions/qualiopi/dossier-verrou.ts` (réouverture) ; migration `prisma/migrations/20260930150000_session_dossier_verrou`.

## Contexte

Une session réalisée dont chaque stagiaire a reçu son attestation est une **preuve** : c'est ce dossier que le certificateur Qualiopi ouvre. Or rien ne le figeait. Un clic pouvait déplacer une date, retirer le formateur, inscrire un stagiaire de plus, saisir à la main une présence, régénérer une pièce ou répondre au questionnaire à froid à la place du stagiaire — et rien, dans le dossier remis à l'auditeur, ne le disait.

À l'inverse, figer brutalement le dossier empêcherait des gestes légitimes et dus : le questionnaire à froid (J+30), les signatures encore attendues, la facturation, les demandes RGPD.

## Décision

### D1. Le verrou est un état DÉRIVÉ, jamais un statut

`TrainingSessionStatut` ne change pas ; `realisee` reste final, et la réouverture ne remet jamais la session `en_cours` (l'historique de réalisation ne se réécrit pas). Une seule fonction pure, `etatVerrouDossier`, calcule l'état ; l'écran, les actions, les workers et le dossier d'audit la lisent (RM-01).

Le dossier est **clos** quand : (a) `statut = realisee` ; (b) chaque inscription active (hors `abandon`, `exclu`) a **sa propre** attestation vivante — rapprochement par `enrollment.attestationDocumentId`, pièce de type attestation, non annulée ; jamais par comptage (deux attestations pour A et aucune pour B ne font pas un dossier complet) ; (c) aucun jeton d'émargement n'est encore valide pour une inscription active (le jeton expire à fin + 48 h).

Le **dernier** événement prime : après une `reouverture`, le dossier est `rouvert` quelles que soient (a), (b), (c).

États : `en_preparation`, `en_cours`, `a_recueillir` (manquants nommés par inscription), `clos` (`depuis` = dernier reverrouillage, sinon la plus récente des dates : passage à réalisée, dernière attestation vivante, dernière sortie), `rouvert` (`depuis`, `par`, `motif`), `hors_parcours` (annulée, reportée). `phaseDossier` en déduit la phase d'écran (`preparer`, `jour_j`, `apres`, `cloturee`, `hors_parcours`).

**Interprétation de la décision (1) du dirigeant.** Les recueils qui arrivent APRÈS l'attestation — questionnaire à froid (J+30, qui peut ne jamais arriver), contreseings restants — ne retardent pas le verrou : ils restent ouverts pendant que le dossier est clos. Seul l'émargement encore signable (c) le retarde. Si le dirigeant préfère que le questionnaire à froid retarde aussi le verrou, il suffit d'une condition de plus dans `manquantsPourClore`, sans toucher au schéma.

### D2. La réouverture est un événement append-only dédié

Table `session_dossier_evenements` (enum `TypeEvenementDossierSession { reouverture, reverrouillage }`) : `session_id` (FK **ON DELETE RESTRICT**), `type`, `motif`, `auteur_id` **sans** clé étrangère (une mise à NULL en cascade serait un UPDATE, refusé), `auteur_nom` NOT NULL (figé au moment du geste), `created_at`. Aucune unicité ; index `(session_id, created_at)`.

En base : CHECK `session_dossier_evenements_motif_reouverture` (une réouverture porte `char_length(btrim(motif)) ≥ 10`) ; trigger `session_dossier_evenements_ajout_seul` (BEFORE UPDATE OR DELETE → exception) ; trigger `session_dossier_evenements_pas_de_truncate`. Ces objets sont invisibles à `migrate diff` : `verrou-dossier-objets-sql.ts` les déclare, et la garde de dérive (Gate D) les confronte à `pg_trigger` et `pg_constraint`.

Pourquoi pas `activity_logs` : il est best-effort et sans trigger. Pourquoi pas `formation_transitions` : sa contrainte d'unicité `[sessionId, toStatus, trigger]` avalerait une seconde réouverture.

L'écriture de l'événement se fait dans une `prisma.$transaction` qui relit l'état ; `logQualiopiActivity` est appelé EN PLUS, pour la recherche transverse.

### D3. Origine des réponses aux questionnaires (indicateur 30)

Colonne nullable `questionnaires.origine_reponse` (enum `OrigineReponseQuestionnaire { stagiaire, organisme }`). Le portail (`soumettreSatisfactionPortailAction`) et le lien public (`soumettreEnqueteEntrepriseAction`) écrivent `stagiaire` — pour l'enquête entreprise, lire « le répondant externe lui-même » ; la saisie console (`saisirReponsesQuestionnaireAction`) écrit `organisme`. Reprise : `organisme` là où la console avait persisté `saisie_admin: true` dans `reponses` (vérifié : le marqueur est bien persisté) ; NULL ailleurs, affiché « origine non tracée (réponse antérieure au 30/09/2026) », jamais « stagiaire » par défaut.

Sur un dossier `clos` **ou** `a_recueillir`, la saisie par l'organisme est refusée : seul le stagiaire répond.

### D4. Migration additive, tolérante à la fenêtre de déploiement

Deux enums, une table, une colonne nullable, deux triggers, un CHECK, une reprise par UPDATE. Aucun DROP, aucun renommage, pas de `lock_timeout`. `packages/contracts` n'est pas touché.

Fenêtre app/worker (~50 min, le worker atterrit avant l'app qui migre) — conséquences **acceptées** :

- une réponse enregistrée par l'application N-1 garde `origine_reponse = NULL` ;
- un worker N-1 peut encore produire une pièce sur un dossier clos, le temps de la bascule ;
- le worker N (bâti avant la migration) lit `session_dossier_evenements` : l'absence de table (P2021) est traitée comme « aucun événement » — le verrou se calcule sur les pièces seules, ce qui **ferme** plutôt qu'ouvre ;
- une requête Prisma sur `questionnaires` sans `select` relit toutes les colonnes, dont `origine_reponse`. Les trois écritures du worker concernées portent désormais un `select` explicite ; une lecture résiduelle sans `select` échouerait pendant la fenêtre et serait rejouée au passage suivant. **Recommandation de fusion** : hors des créneaux des crons questionnaires (matinée UTC).

### D5. Habilitation `rouvrir_dossier`

Réservée à la DIRECTION (`super_admin`, `admin`), comme `revoquer_signature` : rouvrir rend modifiable une preuve constituée. Le reverrouillage manuel exige la même habilitation, motif facultatif ; il est refusé tant que (a), (b), (c) ne sont pas réunies, et le refus liste ce qui manque. Un dossier rouvert ne se reverrouille pas tout seul (la page « À traiter » signalera un dossier rouvert depuis plus de 7 jours — lot L4).

**Mot de passe de sécurité (décision du dirigeant, 2026-09-30).** Rouvrir exige, en plus de l'habilitation et du motif, un mot de passe. Le dépôt étant public, seule son empreinte scrypt salée vit dans la variable `QUALIOPI_REOUVERTURE_MDP` (application WEB, format `scrypt:<sel hex>:<empreinte hex>`, générée par `scripts/qualiopi/empreinte-mot-de-passe-reouverture.ts`, saisie sans écho, 12 caractères au moins, hachée telle quelle). Sans variable ou mal formée : aucune réouverture (fermé par défaut). Ordre des contrôles : habilitation → motif → **5 essais par heure et par compte** (Redis ; compteur en panne = on laisse passer, le mot de passe restant exigé) → mot de passe → écriture. Chaque refus est tracé `qualiopi.session.dossier.reouverture_refusee` avec sa raison (`incorrect`, `non_configure`, `trop_d_essais`), jamais le mot de passe ; ces refus n'ayant rien modifié, ils sont exclus des « actions menées pendant l'ouverture » du dossier d'audit.

**Interrupteur de secours (« ne rien casser »).** `QUALIOPI_VERROU_DOSSIER=off` (casse et espaces indifférents), posé sur l'app ET le worker puis redémarrage, coupe le BLOCAGE sans redéploiement : garde `assertDossierOuvert`, saisie à la place du stagiaire, workers (`dossierFige`). Il ne change jamais l'ÉTAT : fiche, bandeau et dossier d'audit continuent d'afficher « clos ». Toute écriture laissée passer sur un dossier clos est **signalée** (Sentry, niveau warning, `etape: verrou_dossier_coupe`) : elle n'apparaît pas au journal du dossier, puisqu'elle contourne précisément la réouverture motivée. Usage réservé à un blocage légitime en production, le temps d'un correctif ; à retirer aussitôt après.

### D6. Classement de chaque écriture : VERROU, OUVERTE ou ENTRANTE

`verrou-dossier-registre.ts` (`ECRITURES_SESSION`) classe chaque Server Action qui touche un dossier de session, avec sa raison. Les `verrou` appellent `assertDossierOuvert` en tête (refus `DOSSIER_CLOS`, avec la date et l'invitation à rouvrir) ; certaines sont conditionnelles (financement : seulement type/dispositif/payeur ; attestation : seulement la régénération ; certificat et kits : seulement la régénération d'une pièce vivante ; incident : seulement s'il est rattaché à une session). Restent ouverts : lecture, téléchargements, ZIP, facturation et avoirs, suivi OPCO, acompte, relances, portail, RGPD, incidents et réclamations, contreseings et visas restants, remise des exemplaires. Restent toujours ouverts (ENTRANTE) : ce que signent ou répondent le stagiaire, le formateur ou l'entreprise, et les crons.

Workers : `handleProductionAuJalon` écarte les dossiers clos ; `handleAttestationsAuto` ne fait que des premières émissions et ne régénère jamais sur un dossier clos.

La garde vit dans son propre module (`verrou-dossier-garde.ts`, ré-exporté par `_guards.ts`) : 75 specs remplacent `_guards` tout entier par un mock, où une garde y logée deviendrait `undefined`.

### D7. Corrections d'intégrité du même mouvement

- « Regénérer (forcer) » l'attestation sans `rectificationMotif` est refusé côté serveur.
- Annuler une pièce qui porte au moins une signature vivante exige `revoquer_signature`, même hors verrou.
- `revoquerSignatureAction` (pièces) lit la session par `requireAdminRead` : la porte est l'habilitation `revoquer_signature`, plus `requireAdminWrite`.
- Le retour d'une inscription sortie vers un statut actif exige un motif (≥ 10 caractères) et écrit l'ancienne sortie (statut, date, motif) au journal AVANT de l'effacer.

### D8. Ce que voit le certificateur

- **Dossier de session** : « Historique du dossier : verrouillage et réouvertures » (état actuel avec le texte même du bandeau — `texteEtatVerrou` —, chaque réouverture avec date et heure de Paris, nom de l'auteur, motif intégral, actions du journal menées pendant l'ouverture avec avant/après, reverrouillage ; une ligne dit que le journal est best-effort) ; « Signatures révoquées » (émargement, contreseing formateur, pièce : motif, date, auteur) ; « Origine des réponses aux questionnaires » ; un avertissement à l'index dès qu'il y a eu une réouverture.
- **Manifeste global** : `reouverturesSessions[]` (et `reouverturesRegistreLu`) dans `manifeste.json` ; une section récapitulative en tête du Markdown (« N sessions rouvertes », liste des réouvertures). Un registre illisible est DIT, jamais rendu comme « aucune ».
- **RGPD** : le verrou ne bloque jamais un effacement (`supprimerStagiaire` ne connaît pas le verrou). Le marqueur daté `Trainee.deletedAt` existe : le dossier écrit « Stagiaire anonymisé le … (art. 17 §3 b), preuves conservées ».

## Conséquences

**Positives** — Un dossier clos est une preuve que personne ne modifie sans le dire ; toute rectification après clôture est motivée, nommée, datée, inaltérable en base et lisible par l'auditeur. La saisie à la place du stagiaire devient traçable (ind. 30). Le registre exécutable empêche qu'une nouvelle action échappe au verrou.

**Négatives et mitigations** — Le bouton « Regénérer (forcer) » de l'attestation n'envoie pas encore de motif : il est désormais refusé avec un message qui dit quoi faire ; le champ de motif arrive avec le lot L2. Les actions de réouverture n'ont pas encore d'écran (lot L2) : elles sont inscrites dans la liste des actions « sans surface connue », qui rougira quand L2 les raccordera. L'analyse statique du registre ne voit que les écritures Prisma directes ; les générateurs qui délèguent à un service sont listés à la main et chacun est appelé par le test de refus.

## Alternatives considérées

- **Un statut `close`** dans `TrainingSessionStatut` : aurait obligé à réécrire la machine à états et à « défaire » une réalisation pour rouvrir. Écarté (D1).
- **Tracer la réouverture dans `activity_logs`** : best-effort, sans trigger, falsifiable par UPDATE. Écarté (D2).
- **Verrouiller tant que le questionnaire à froid n'est pas revenu** : bloquerait des dossiers indéfiniment (réponse facultative). Laissé au choix du dirigeant (D1).

## Suivi

- L2 : bandeau de verrou, mode lecture seule, boutons « Rouvrir le dossier » / « Clore à nouveau », champ de motif de rectification de l'attestation.
- L3 : fil conducteur par phase (`phaseDossier`).
- L4 : liste par phase (`chargerEtatsVerrou`), dossiers rouverts depuis plus de 7 jours dans « À traiter ».
