# Contresignature d'un apporteur : invitation automatique au questionnaire équipe

**Base : la branche `feat/equipe-d6a6-invitations` (PR #2474)**, pas `main`. À fusionner après elle.

## Quoi

Quand Axion contresigne le contrat d'un apporteur, l'apporteur reçoit l'invitation à remplir son questionnaire de collaborateur (futur page équipe). Le message est celui de `inviterCollaborateur` : aucun prix, aucune commission, aucun montant, aucun nom de ville.

## Comment

- `src/features/apporteurs-reseau/verification.ts` : juste après le `try/catch` de `alerterContresignature`, un bloc **séparé**, dans son propre `try/catch`, appelle `inviterCollaborateur({ categorie: "apporteur", email, prenom, source: "contrat_apporteur" })`.
- Un échec (exception ou `ok: false`) est seulement signalé (Sentry, sans donnée personnelle) ; la contresignature est déjà actée et reste valide.
- Pas de doublon : `inviterCollaborateur` n'en protège pas (il envoie puis révoque les anciennes). Le bloc vérifie donc avant s'il existe une invitation active (même adresse normalisée, catégorie apporteur, ni utilisée, ni révoquée, ni expirée) et, si oui, n'envoie rien.
- Commentaire d'en-tête de `inviter.ts` mis à jour. Un import en double (`gardeLectureEchanges`) hérité de la fusion de la base, qui cassait `tsc`, est retiré dans les deux pages `collaborateurs`.
- Aucune migration, aucun job BullMQ, aucun enum (règle « deux conteneurs »).

## Vérifier

`pnpm vitest run src/features/apporteurs-reseau/__tests__` (150 fichiers verts, dont `contresigner-invitation-equipe.spec.ts` : invitation appelée, erreur non bloquante, pas de doublon, aucune invitation si la contresignature est refusée), `pnpm typecheck`, `pnpm lint` (0 erreur).

## Risques / à signaler

- L'envoi est direct et synchrone : un SMTP lent retarde la réponse de l'action, sans l'annuler.
- Une personne ayant déjà répondu (invitation utilisée) ou déjà fiche équipe peut être réinvitée à une nouvelle contresignature : à trancher.
- Pas de relance automatique si l'envoi échoue : envoi manuel depuis la console.
- `lireDossier` est lu deux fois (alerte puis invitation) : négligeable.
- Le tip récent de la branche des invitations (d33aeb30) n'ajoute que des changements de CI (`.github/workflows`, AGENTS.md, specs CI) que le bac à sable du robot ne peut pas écrire : la branche est basée sur 66a4a9cf5 ; un `git merge origin/feat/equipe-d6a6-invitations` suffira.
- `pnpm format:check` global échoue seulement sur `.mcp.json` (fichier de l'environnement) ; les fichiers touchés sont conformes.

VERDICT OPUS : BON

Restes : réinvitation d'une personne déjà répondante (décision produit) ; fusion du tip CI de la base.
