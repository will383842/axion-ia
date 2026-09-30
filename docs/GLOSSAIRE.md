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
