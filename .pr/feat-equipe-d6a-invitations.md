# Invitations au questionnaire des collaborateurs (D6a)

## Quoi

- Un point d'entrée serveur unique, `inviterCollaborateur`, qui crée l'invitation et envoie l'e-mail tout seul.
- Sur l'écran Collaborateurs de la console : un formulaire « Envoyer le questionnaire » et la liste des invitations (envoyée, ouverte, remplie, expirée, révoquée) avec « Renvoyer » et « Révoquer ».
- Le fichier commun `src/server/equipe/questionnaire/jeton.ts`, écrit à l'identique de la consigne.

## Pourquoi

L'envoi ne doit plus être un copier-coller. Plus tard, la contresignature du contrat d'un apporteur appellera le même point d'entrée (non branché ici, expliqué en tête de `inviter.ts`).

## Comment

- Jeton de 32 octets ; seul son sha256 est stocké. Lien : `/fr/equipe/questionnaire/{jeton}`. Validité : 14 jours. Version du questionnaire figée.
- Idempotent : une fois le message parti, les invitations actives plus anciennes (même adresse, même catégorie) sont révoquées ; avec deux envois simultanés, seule la plus récente reste active. Si l'envoi échoue, le lien précédent reste valable.
- E-mail en envoi direct (`sendEmail`), aucun job, aucune valeur d'énumération nouvelle. Si l'envoi échoue, seule la nouvelle ligne est révoquée. Une écriture de suivi qui échoue après l'envoi ne fait pas échouer l'appel (pas de second e-mail).
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

## Relecture Opus (sécurité et données)

Corrigés : lien précédent perdu si l'envoi échoue ; course entre deux envois ; double e-mail si une écriture de suivi échoue ; déchiffrement qui peut lever ; liste des fiches masquée si les colonnes d'invitation ne sont pas encore migrées.

## Restes (à ne pas oublier)

- **Ne pas utiliser le bouton avant que la page publique du questionnaire soit en ligne** (autre branche, D6b) : sinon le lien donne une page introuvable.
- **Effacement RGPD** : les invitations stockent maintenant une adresse chiffrée et un prénom. L'exception de `src/lib/rgpd-erase.ts` dit que l'effacement réel arrive avec le lot retrait et effacement « avant toute première fiche » : ce lot doit couvrir aussi ces colonnes (recherche par empreinte d'e-mail), avant la première vraie invitation.
- Si l'ancien envoi d'e-mail passe un jour par un gabarit du registre, déplacer le texte de `composerEmailInvitation`.

VERDICT OPUS : BON, avec les restes ci-dessus
