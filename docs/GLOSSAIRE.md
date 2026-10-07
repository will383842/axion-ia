# Glossaire du dépôt

Les valeurs d'énumération et les termes métier qui ne s'expliquent pas d'eux-mêmes. Une valeur d'enum ajoutée au schéma Prisma s'inscrit ici, avec l'ADR qui l'a décidée.

## Dossier de session (ADR 0060)

| Terme                                                                  | Sens                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dossier de session**                                                 | L'ensemble des preuves d'une session de formation : inscriptions, émargements, évaluations, questionnaires, pièces émises et signatures. C'est ce que le certificateur Qualiopi ouvre.                                                         |
| **Verrou du dossier**                                                  | État DÉRIVÉ (jamais stocké) calculé par `etatVerrouDossier` (`src/server/qualiopi/sessions/verrou-dossier.ts`). Ce n'est pas un statut de session.                                                                                             |
| `en_preparation`                                                       | État du verrou : session planifiée, tout reste modifiable.                                                                                                                                                                                     |
| `en_cours`                                                             | État du verrou : session en cours, tout reste modifiable.                                                                                                                                                                                      |
| `a_recueillir`                                                         | État du verrou : session réalisée, mais une attestation manque ou un émargement reste signable. Les manquants sont nommés par inscription.                                                                                                     |
| `clos`                                                                 | État du verrou : session réalisée, chaque inscription active a son attestation vivante, plus aucun émargement signable. Les écritures classées VERROU sont refusées (`DOSSIER_CLOS`).                                                          |
| `rouvert`                                                              | État du verrou : un responsable habilité a rouvert le dossier clos, avec un motif. Les modifications sont possibles et tracées.                                                                                                                |
| `hors_parcours`                                                        | État du verrou : session annulée ou reportée.                                                                                                                                                                                                  |
| `DOSSIER_CLOS`                                                         | Code de refus renvoyé par `assertDossierOuvert` quand une écriture VERROU vise un dossier clos.                                                                                                                                                |
| **VERROU / OUVERTE / ENTRANTE**                                        | Classement de chaque écriture dans `ECRITURES_SESSION` (`verrou-dossier-registre.ts`) : refusée sur un dossier clos / toujours possible (suivi, RGPD, facturation…) / venue de l'extérieur (stagiaire, formateur, entreprise), jamais bloquée. |
| **Phase** (`preparer`, `jour_j`, `apres`, `cloturee`, `hors_parcours`) | Découpage de l'écran de la fiche session, déduit par `phaseDossier`.                                                                                                                                                                           |

## Énumérations Prisma

| Enum                          | Valeur           | Sens                                                                                                                                   | ADR  |
| ----------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `TypeEvenementDossierSession` | `reouverture`    | Un dossier clos redevient modifiable. Motif ≥ 10 caractères, contrôlé en base (CHECK). Habilitation `rouvrir_dossier`.                 | 0060 |
| `TypeEvenementDossierSession` | `reverrouillage` | Un dossier rouvert est clos à nouveau, à la main ; refusé tant qu'il manque une attestation ou qu'un émargement reste signable.        | 0060 |
| `OrigineReponseQuestionnaire` | `stagiaire`      | La réponse vient du répondant lui-même (portail du stagiaire, ou lien de l'enquête entreprise).                                        | 0060 |
| `OrigineReponseQuestionnaire` | `organisme`      | La réponse a été saisie par l'organisme à la place du répondant (console).                                                             | 0060 |
| `OrigineReponseQuestionnaire` | _(NULL)_         | Origine non tracée : réponse antérieure au 30/09/2026, ou enregistrée pendant la fenêtre de déploiement. Jamais lue comme `stagiaire`. | 0060 |

## Habilitations

| Acte              | Qui                                                                                                   | ADR  |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---- |
| `rouvrir_dossier` | Direction seule (`super_admin`, `admin`) — rouvrir un dossier de session clos, ou le clore à nouveau. | 0060 |

## Documents du projet (ADR 0063)

| Enum                       | Valeur                | Sens                                                                                                                                                                                  | ADR  |
| -------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `CoteDocumentProjet`       | `envoye_au_client`    | Le document est parti chez le client ; il porte sa date d'envoi (CHECK).                                                                                                              | 0063 |
| `CoteDocumentProjet`       | `interne`             | Le document est resté chez Axion-IA (guide, notes, compte rendu, devis de travail) ; pas de date d'envoi.                                                                             | 0063 |
| `NatureDocumentProjet`     | `email`               | Un e-mail, tel qu'il est parti (fichier `.eml` ou `.html`, ou lien).                                                                                                                  | 0063 |
| `NatureDocumentProjet`     | `pdf`                 | Un document PDF (pièce jointe, plaquette, programme).                                                                                                                                 | 0063 |
| `NatureDocumentProjet`     | `page_en_ligne`       | Une page consultable en ligne (lien https).                                                                                                                                           | 0063 |
| `NatureDocumentProjet`     | `compte_rendu`        | Un compte rendu (réunion, audit).                                                                                                                                                     | 0063 |
| `NatureDocumentProjet`     | `devis`               | Un devis ou une proposition chiffrée (la pièce officielle reste dans « Devis liés »).                                                                                                 | 0063 |
| `NatureDocumentProjet`     | `note`                | Une note de travail.                                                                                                                                                                  | 0063 |
| `NatureDocumentProjet`     | `autre`               | Tout le reste.                                                                                                                                                                        | 0063 |
| `FormatFichierDocument`    | `pdf` … `csv`         | Format d'un fichier, liste fermée de 11 ; MIME, extension et signature en sont DÉRIVÉS (`formats.ts`).                                                                                | 0063 |
| `AnalyseAntivirusDocument` | `non_analyse`         | Antivirus injoignable à l'ajout : le fichier est gardé, l'analyse est refaite au téléchargement. Jamais servi tel quel.                                                               | 0063 |
| `AnalyseAntivirusDocument` | `sain`                | Verdict ClamAV : rien trouvé. Seul verdict qui laisse sortir le fichier.                                                                                                              | 0063 |
| `AnalyseAntivirusDocument` | `infecte`             | Verdict ClamAV : signature trouvée. Le document est archivé et ne se télécharge jamais ; il n'est pas supprimé.                                                                       | 0063 |
| `ProjetEvenementAction`    | `document_ajoute`     | Journal du projet : un document ajouté (`document_id`, jamais le titre).                                                                                                              | 0063 |
| `ProjetEvenementAction`    | `document_archive`    | Journal du projet : un document masqué de la liste.                                                                                                                                   | 0063 |
| `ProjetEvenementAction`    | `document_reaffiche`  | Journal du projet : un document archivé rendu visible.                                                                                                                                | 0063 |
| `ProjetEvenementAction`    | `document_telecharge` | Journal du projet : un fichier téléchargé (masqué de l'historique affiché, gardé au journal).                                                                                         | 0063 |
| `OrigineOuvertureDocument` | `navigateur`          | Ouverture du lien public d'une page partagée, déclenchée PROBABLEMENT par une personne (en-têtes `Sec-Fetch-*`, navigateur ordinaire). Heuristique, jamais une preuve de lecture.     | 0063 |
| `OrigineOuvertureDocument` | `apercu_automatique`  | Ouverture par un analyseur de liens, un aperçu de messagerie ou un robot : tout ce qui n'est pas `navigateur`.                                                                        | 0063 |
| **Lien public d'une page** | —                     | `https://axion-ia.com/document/<id>/<jeton>` : une page HTML « envoyée au client » ouverte sans compte. Jeton HMAC dérivé d'`AUTH_SECRET`, rien de stocké ; s'éteint par l'archivage. | 0063 |

## Candidatures — états des vidéos et des liens (paquet 4a, L12)

Listes fermées en phase « expand » : la colonne enum `etat_ferme` est écrite **en même temps** que l'ancienne colonne texte (`statut` pour les vidéos, `etat` pour les liens), qui reste lue. `NULL` = ligne écrite avant la migration et dont le texte n'était pas dans la liste (faute de frappe historique) — à repérer par `WHERE etat_ferme IS NULL`.

| Enum                | Valeur         | Sens                                                                                                                 | ADR |
| ------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- | --- |
| `EtatVideoCandidat` | `envoi`        | Vidéo déposée par le candidat, morceaux en cours de réception. Ménagée au bout d'une heure si l'envoi est abandonné. | —   |
| `EtatVideoCandidat` | `analyse`      | Fichier complet, format réel vérifié, en attente du verdict de l'antivirus. Jamais montré en console.                | —   |
| `EtatVideoCandidat` | `disponible`   | Verdict de l'antivirus : sain. Seul état lisible en console.                                                         | —   |
| `EtatVideoCandidat` | `rejetee`      | Format réel refusé ou fichier infecté ; le fichier est effacé, la ligne garde le motif.                              | —   |
| `EtatLienCandidat`  | `vivant`       | Le lien répond (2xx/3xx, ou l'oEmbed de la plateforme confirme la vidéo).                                            | —   |
| `EtatLienCandidat`  | `mort`         | 404/410, ou vidéo retirée selon l'oEmbed. `mort_depuis` garde la première date constatée.                            | —   |
| `EtatLienCandidat`  | `inverifiable` | Connexion exigée, 403, 429, 5xx, délai dépassé : on ne sait pas. Une panne n'est jamais lue comme une mort.          | —   |

## Réponses reçues des candidats (lot L3, 2026-10-07)

| Terme                         | Sens                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Réponse reçue** (emploi)    | Ligne de `job_application_inbound_replies` : un e-mail d'un candidat relevé dans la boîte Zoho Mail après un message parti vers son dossier. Date, objet, extrait chiffré (≤ 300 car.), drapeau `auto`. Jamais le corps. |
| **Réponse reçue** (apporteur) | Ligne de `submission_inbound_replies` (2026-09-27), relevé distinct. Une personne des deux mondes a une ligne dans CHAQUE table ; une seule alerte Telegram (celle des apporteurs).                                      |
| `CANDIDAT_REPLIED`            | Catégorie d'alerte (salon 💼 Candidatures) d'une réponse humaine récente (< 24 h) d'un candidat emploi. Distincte de `APPORTEUR_REPLIED` : jamais d'alerte commune aux deux mondes.                                      |
| `email_recu` (« Boîte mail ») | Événement du journal posé par le relevé pour une réponse humaine ; une réponse automatique (absence) est gardée sans événement.                                                                                          |

## Fichiers partagés et bibliothèque (ADR 0065)

| Enum                      | Valeur           | Sens                                                                                                                                 | ADR  |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| `NatureFichierPartage`    | `fichier`        | Un fichier stocké dans R2 (compartiment dédié, préfixe `partages/`), déposé par morceaux.                                            | 0065 |
| `NatureFichierPartage`    | `lien_externe`   | Un lien Drive / WeTransfer collé (https seulement) ; rien n'est stocké chez nous.                                                    | 0065 |
| `OrigineFichierPartage`   | `equipe`         | Déposé depuis la console par l'équipe.                                                                                               | 0065 |
| `OrigineFichierPartage`   | `personne`       | Renvoyé par un candidat depuis son lien personnel (L5b) ; toujours analysé, 4 Go au plus.                                            | 0065 |
| `CategorieFichierPartage` | `lut`            | Une LUT d'étalonnage.                                                                                                                | 0065 |
| `CategorieFichierPartage` | `video_exemple`  | Une vidéo d'exemple du rendu attendu.                                                                                                | 0065 |
| `CategorieFichierPartage` | `rushs`          | Des rushs (souvent ceux d'un client) : lien de 7 jours et mention de confidentialité à l'envoi (L5).                                 | 0065 |
| `CategorieFichierPartage` | `consignes`      | Des consignes de travail. Jamais proposées à un futur apporteur (ANTI-REQUALIFICATION, motif 10).                                    | 0065 |
| `CategorieFichierPartage` | `musique`        | Une musique à utiliser.                                                                                                              | 0065 |
| `CategorieFichierPartage` | `kit_apporteur`  | Le kit apporteur : un LIEN vers le kit déjà publié, jamais une copie. Seule catégorie, avec `presentation`, proposée à un apporteur. | 0065 |
| `CategorieFichierPartage` | `presentation`   | Une présentation (réseau, offre).                                                                                                    | 0065 |
| `CategorieFichierPartage` | `essai_rendu`    | Le montage d'essai renvoyé par un candidat (L5b) ; l'équipe ne le dépose pas.                                                        | 0065 |
| `CategorieFichierPartage` | `autre`          | Tout le reste.                                                                                                                       | 0065 |
| `EtatDepotFichier`        | `en_cours`       | Envoi par morceaux commencé, pas encore terminé : il reprend où il s'était arrêté.                                                   | 0065 |
| `EtatDepotFichier`        | `disponible`     | Morceaux assemblés et taille revérifiée auprès du stockage.                                                                          | 0065 |
| `EtatDepotFichier`        | `abandonne`      | Envoi arrêté (ou taille non conforme). La ligne reste ; R2 libère les morceaux d'un fichier jamais assemblé.                         | 0065 |
| `AnalyseFichierPartage`   | `en_attente`     | Pas encore de verdict antivirus : jamais servi. Analyse relancée depuis l'application.                                               | 0065 |
| `AnalyseFichierPartage`   | `sain`           | Verdict ClamAV : rien trouvé.                                                                                                        | 0065 |
| `AnalyseFichierPartage`   | `infecte`        | Verdict ClamAV : signature trouvée. Archivé, jamais servi, jamais effacé automatiquement.                                            | 0065 |
| `AnalyseFichierPartage`   | `hors_limite`    | Fichier de l'ÉQUIPE de plus de 200 Mo : non analysé (décision 7 de Will), affiché « Non analysé (déposé par vous) ».                 | 0065 |
| `TypeAccesPartage`        | `page_ouverte`   | Journal des accès d'un lien privé (L5) : la page du lien a été ouverte.                                                              | 0065 |
| `TypeAccesPartage`        | `telechargement` | Journal des accès d'un lien privé (L5) : un fichier a été téléchargé.                                                                | 0065 |
| **Bibliothèque**          | —                | Les fichiers `dans_bibliotheque = true`, non archivés : `/<console>/contacts/candidatures/bibliotheque`. Archiver ≠ supprimer.       | 0065 |
