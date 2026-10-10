# ADR 0067 — Une fiche formateur par relation : unicité de l'e-mail limitée aux fiches ouvertes

- **Statut** : **ACCEPTÉ**
- **Date** : 2026-10-10
- **Auteur** : Will + Claude
- **Lot** : S0 du chantier « formateurs freelance » (socle documentaire, sans code)
- **Prolonge** : ADR 0066 (parcours du formateur indépendant) ; ADR 0060 (fermeture et réouverture motivées, datées, attribuées)
- **Référence** : `prisma/schema.prisma` (`Trainer.email`, aujourd'hui `@unique @db.Citext` ; `TrainerStatut`)

## Contexte

`Trainer.email` porte aujourd'hui une contrainte d'**unicité globale**. Une même adresse
ne peut donc exister que sur **une seule fiche formateur, pour toujours**.

Or une même personne peut avoir **plusieurs relations successives** avec Axion-IA, de
natures différentes : par exemple un salarié devenu indépendant, ou un indépendant qui
interviendra plus tard pour le compte d'un organisme sous-traitant. Ces relations n'ont
ni le même contrat, ni les mêmes obligations (ADR 0066, (a)), ni les mêmes pièces.
Réutiliser la fiche existante en changeant son statut mélangerait deux historiques —
émargements, contrats, relevés — qui doivent rester séparés et lisibles par un auditeur.

Il faut donc pouvoir **fermer** une fiche et en **ouvrir** une nouvelle pour la même
adresse, sans jamais permettre deux fiches **ouvertes** sur la même adresse.

## Décision

### 1. Unicité limitée aux fiches ouvertes

- L'unicité de `Trainer.email` ne porte plus que sur les fiches **ouvertes** (non
  fermées).
- Elle est assurée par un **index unique partiel** posé en **SQL brut** dans la
  migration (Prisma 5.22 ne sait pas l'exprimer dans le schéma), comparé sur la valeur
  `citext` de l'adresse, avec une clause `WHERE` excluant les fiches fermées.
- Cet index étant invisible pour `prisma migrate diff`, sa présence est **vérifiée
  par `pg_indexes`** : un test lit
  `pg_indexes` et échoue si l'index n'existe pas ou si sa définition ne porte plus la
  clause partielle. La base est la preuve, pas le fichier de migration.

### 2. Un seul module lit « la fiche de cette adresse »

- La recherche d'une fiche par e-mail passe par **un seul module** :
  **`trouverFicheOuverteParEmail`**. Il ne renvoie que la fiche **ouverte** (ou rien).
- Aucun autre code n'écrit de `findUnique({ where: { email } })` sur `Trainer` : une
  fois l'unicité globale retirée, cette requête n'est plus valide, et un `findFirst`
  sans filtre d'ouverture pourrait renvoyer une fiche fermée. Une garde statique le
  refuse.

### 3. Fermeture motivée

- Une fiche ne se ferme que **avec un motif** choisi dans une liste fermée. Le motif de
  ce chantier est **`changement_de_nature`** (exemple : salarié devenu indépendant).
- La fermeture est **datée et attribuée** à un administrateur identifié ; elle ne
  supprime rien : la fiche fermée garde ses contrats, émargements et relevés, consultables
  en lecture seule.
- La nouvelle fiche ouverte pour la même adresse **renvoie** à la fiche fermée, pour que
  l'historique de la personne reste reconstituable.

### 4. Bascule en expand / contract

L'ordre est imposé, chaque étape dans sa propre PR :

1. **Expand** — l'**index unique partiel arrive d'abord**, à côté de l'unique global
   (les deux coexistent ; l'unique global reste plus strict, rien ne change pour les
   données).
2. **Bascule du code** — toutes les lectures passent par `trouverFicheOuverteParEmail` ;
   la fermeture motivée est livrée. Le code doit fonctionner **avec ou sans** l'unique
   global (fenêtre app / worker d'environ une heure, cf. `AGENTS.md`).
3. **Contract** — l'**unique global n'est retiré qu'après** que la bascule du code est
   en production sur l'app **et** le worker.

Retirer l'unique global avant l'étape 2 ouvrirait une fenêtre où deux fiches ouvertes
pourraient exister sans que le code sache choisir.

## Alternatives écartées

- **Changer le statut de la fiche existante** (salarié → sous-traitant). Écartée :
  mélange deux relations juridiques dans un même historique ; un contrat de travail et
  un contrat de sous-traitance ne doivent jamais partager une fiche.
- **Suffixer l'adresse de l'ancienne fiche** pour libérer l'unicité. Écartée : altère
  une donnée personnelle exacte, casse les rapprochements (émargements, e-mails envoyés)
  et cache le motif.
- **Supprimer l'unicité sans la remplacer.** Écartée : rien n'empêcherait deux fiches
  ouvertes, et toutes les lectures par e-mail deviendraient ambiguës.
- **Index partiel exprimé dans le schéma Prisma.** Impossible en 5.22 ; d'où le SQL brut
  et la vérification par `pg_indexes`.

## Conséquences

**Positives**

- Une relation = une fiche = un historique cohérent, lisible par un auditeur.
- Deux fiches ouvertes sur la même adresse restent impossibles, garanties par la base.
- Un seul point de lecture : le jour où la règle d'ouverture change, un seul module change.

**Négatives**

- Un index hors du schéma Prisma : `prisma migrate diff` ne le voit pas, d'où le test
  `pg_indexes`.
- Trois PR au lieu d'une, et une période où les deux contraintes coexistent.

## Suivi

- PR « expand » : migration de l'index partiel + test `pg_indexes`.
- PR « bascule » : `trouverFicheOuverteParEmail`, garde statique, fermeture motivée
  `changement_de_nature`.
- PR « contract » : retrait de l'unique global, après vérification de l'atterrissage de
  la bascule sur l'app et le worker.
