# Équipe D7 : écran console « À valider »

## Quoi

Une page console `/{adminPrefix}/collaborateurs/a-valider`, liée depuis le compteur « À valider » de la liste. Pour chaque fiche au statut « à valider » :

- comparaison côte à côte : fiche enregistrée / réponse du questionnaire ;
- photo proposée, accords reçus (date et version) et attestation de responsabilité ;
- indexation prévue (ce qui manque, via `evaluerIndexabilite`) ;
- le formulaire complet de la fiche (tous les champs modifiables, photo à remplacer ou à retirer avec le dépôt D4), puis trois décisions : **Enregistrer en brouillon**, **Valider et publier**, **Refuser** (note obligatoire).

## Pourquoi

Une fiche arrivée par le questionnaire ne se publie jamais seule : Will la relit, la corrige si besoin, puis décide.

## Comment

- `src/server/actions/equipe/a-valider.ts` : trois actions serveur. Rôle administrateur revérifié dans chacune avant toute lecture ; UUID vérifié ; seule une fiche « à valider » passe (pas de décision sur une fiche publiée ou en brouillon) ; version de la fiche contrôlée.
- Les accords du formulaire sont **remplacés par ceux de la base** : on ne donne aucun accord depuis cet écran.
- Publier : toutes les conditions sont contrôlées AVANT la première écriture (accord de publication ; photo réelle seulement avec accord photo ; lien LinkedIn seulement avec accord LinkedIn). Puis réutilisation de `modifierCollaborateur` et `publierCollaborateur` (donc leurs règles : effacement en cours, republication d'une fiche retirée = nouvel accord). Revalidation de la fiche, du hub et de `/sitemap.xml`.
- Brouillon : la fiche passe au statut « brouillon » (elle sort de la file « À valider »). Événement `mise_en_brouillon`.
- Refuser : note obligatoire (10 caractères au moins), fiche renvoyée en brouillon, réponse marquée « refusée » avec la note, événement `refus`.
- Chaque décision écrit au moins un `TeamMemberEvent`. La réponse du questionnaire est marquée « validée » ou « refusée » (colonnes existantes).
- Le formulaire existant gagne un mode `modeValidation` (cases d'accord grisées, trois décisions à la place de « Publier »). La construction des valeurs initiales est extraite dans `fiche-initiale.ts`, partagée avec la fiche.
- Page : `gardeLectureEchanges` AVANT toute lecture ; lecture tolérante de la réponse (`reponse-questionnaire.ts`).
- Aucune migration, aucun enum, aucun job BullMQ. Couleurs terracotta, pas de bleu. Aucun montant ni nom de famille.

## Vérifier

- `pnpm vitest run src/server/actions/equipe src/lib/equipe src/features/admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`
- Les tests couvrent : rôle refusé (sans session, éditeur, secrétaire) sans aucune lecture, statut autre que « à valider » refusé, UUID invalide, publication sans accord refusée sans rien écrire, photo réelle sans accord photo, LinkedIn sans accord, accord non accordable depuis le formulaire, publication (événement, revalidations, réponse validée), brouillon, refus (note obligatoire, version périmée). Le retour à l'avatar après retrait de photo reste couvert par les tests D4.
- À la main : ouvrir la page avec une fiche arrivée par le questionnaire.

## Risques et limites

- Les réponses propres à la catégorie s'affichent en lecture seule : elles ne sont pas modifiables depuis cet écran (le formulaire existant ne les édite pas non plus).
- Le questionnaire écrit la réponse directement dans la fiche : la colonne « fiche enregistrée » est donc souvent identique à la réponse ; les écarts (corrections de Will, saisies) sont surlignés.
- Un « Refuser » renvoie la fiche en brouillon comme « Enregistrer en brouillon » : seul le journal (événement `refus`) et la réponse (marquée refusée, avec la note) en gardent la trace ; l'écran ordinaire de la fiche peut encore la publier si l'accord existe (à trancher : statut dédié).
- Le dépôt de photo reste possible dans cet écran (accord photo avec note de preuve, comme sur la fiche) ; le contrôle « photo réelle sans accord » est fait avant écriture, pas rejoué dans la transaction de publication (fenêtre très courte).
- `/sitemap.xml` est revalidé par prudence : le hub et la fiche (revalidés par la publication) sont ce qui compte.
- Un « Enregistrer en brouillon » retire la fiche de la file : elle se retrouve dans la liste filtrée « Brouillon ».
- Branche créée depuis `feat/equipe-d6a6-invitations` (non fusionnée). Dans le bac à sable du robot, `.git/config` est en lecture seule : la branche est créée sans suivi amont, poussée sans `-u`.

Relecture Opus (données et sécurité) : rien de bloquant ; rôle, IDOR, consentements et courses vérifiés ; état partiel quand la note de preuve manque corrigé.

VERDICT OPUS : BON
