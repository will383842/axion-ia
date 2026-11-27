# Invitations au questionnaire des collaborateurs (D6a)

## Quoi

- Un point d'entrée serveur unique, `inviterCollaborateur`, qui crée l'invitation et envoie l'e-mail tout seul.
- Sur l'écran Collaborateurs de la console : un formulaire « Envoyer le questionnaire » et la liste des invitations (envoyée, ouverte, remplie, expirée, révoquée) avec « Renvoyer » et « Révoquer ».
- Le fichier commun `src/server/equipe/questionnaire/jeton.ts`, écrit à l'identique de la consigne.

## Pourquoi

L'envoi ne doit plus être un copier-coller. Plus tard, la contresignature du contrat d'un apporteur appellera le même point d'entrée (non branché ici, expliqué en tête de `inviter.ts`).

## Comment

- Jeton de 32 octets ; seul son sha256 est stocké. Lien : `/fr/equipe/questionnaire/{jeton}`. Validité : 14 jours. Version du questionnaire figée.
- Idempotent : une invitation active pour la même adresse et la même catégorie est révoquée, puis remplacée.
- E-mail en envoi direct (`sendEmail`), aucun job, aucune valeur d'énumération nouvelle. Si l'envoi échoue, l'invitation est révoquée.
- Migration additive `20261128010000_team_invite_envoi` (avec `down.sql`) : 4 colonnes nullables (adresse chiffrée, prénom, source, date d'envoi). Elles manquaient : sans adresse chiffrée, « Renvoyer » est impossible. « Renvoyer » émet un lien neuf (l'ancien n'est pas relisible).
- Les pages de la console appellent `gardeLectureEchanges` avant toute lecture (liste et fiche corrigées), puis la garde administrateur.
- Journal : un `TeamMemberEvent` est écrit seulement si l'adresse correspond déjà à une fiche (la colonne `memberId` du journal est obligatoire). Sinon, la ligne d'invitation fait trace.

## Comment vérifier

`pnpm vitest run src/server/equipe src/server/actions/equipe src/features/admin-calendly`, puis `pnpm typecheck`.

## Risques

- La branche D4 est en retard sur main : je suis parti de main et j'y ai fusionné D4 (le changement de branche direct échouait, des fichiers du dépôt étant en lecture seule). Un conflit de compteur dans `admin-nav.test.ts` est résolu à 184. `pnpm-lock.yaml` n'a pas été touché.
- `pnpm bundle:check` n'a pas été lancé (pas de build) : aucune page publique n'est touchée.
- `pnpm format:check` échoue seulement sur `.mcp.json` (fichier non versionné, illisible ici).
- Le hook de commit lance `tsc` en entier : il manque de mémoire sans `NODE_OPTIONS=--max-old-space-size=7000`.

VERDICT OPUS : EN COURS
