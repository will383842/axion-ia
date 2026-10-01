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
