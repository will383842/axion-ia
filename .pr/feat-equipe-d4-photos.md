# Photos des collaborateurs dans la console (D4)

## Quoi

Dans la fiche d'un collaborateur (console), l'administrateur peut **déposer**, **remplacer** et **retirer** une photo. Sans photo réelle (ou sans accord photo), le public voit l'avatar à initiales.

- Dépôt : JPEG, PNG ou WebP, type lu dans les octets (pas dans le nom), 8 Mo maximum, 400 px minimum de côté, 40 millions de pixels maximum.
- Ré-encodage WebP carré en deux tailles (256 et 1024 px). Toutes les métadonnées (EXIF, GPS, profil couleur) sont supprimées.
- L'original reste **privé**, hors du dossier public, sous un nom aléatoire, et n'est jamais servi.
- Les variantes sont servies par `/api/equipe/photo/<jeton>/<256|1024>` **seulement si** la fiche est publiée, de type « reelle », avec accord photo enregistré et sans demande d'effacement. La base est relue à chaque requête. Sinon : 404.
- Retrait : supprime variantes et original, remet l'avatar, efface les champs photo **et l'accord photo**, écrit un événement `photo_retiree`, rafraîchit `/fr/equipe` et la fiche.
- Texte alternatif : « Photo de <prénom> » par défaut, modifiable.
- La logique est dans `src/server/equipe/photo-collaborateur.ts` (fonctions serveur réutilisables, sans écran ni session) : le futur questionnaire pourra les appeler. Les actions de la console (`src/server/actions/equipe/photo.ts`) ne font que vérifier le rôle administrateur.
- `src/lib/equipe/photo-publique.ts` : règle unique d'affichage, à utiliser par les pages publiques.

Aucune migration, aucun job, aucune énumération.

## Pourquoi

Une vraie photo avec accord est une condition d'indexation des fiches ; il faut pouvoir la gérer sans toucher à la base, et la retirer à tout moment.

## Comment vérifier

- `pnpm vitest run src/server/equipe src/server/actions/equipe src/lib/equipe src/app/api/equipe`
- `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check` sur les dossiers touchés : propres.
- À la main : ouvrir une fiche, déposer une photo (avec note de preuve si l'accord photo n'existe pas), publier, ouvrir l'URL de la variante (200) ; retirer la photo, la même URL répond 404.

## Stockage

Pas de nouveau volume : originaux sous `<CV_STORAGE_PATH>/equipe-photos` (surchargeable par `TEAM_PHOTO_PRIVATE_PATH`), variantes sous `<REVIEW_MEDIA_PATH>/equipe` (surchargeable par `TEAM_PHOTO_PUBLIC_PATH`). Les deux volumes sont déjà sauvegardés.

## Risques et points restants

- Cette PR part de la branche D3 (PR « console des collaborateurs » non fusionnée) : elle doit être fusionnée après D3. `pnpm-lock.yaml` n'a pas changé.
- **`pnpm bundle:check` non lancé** (pas de build local). Le changement est côté admin et une route API ; à confirmer par la CI.
- Les pages publiques devront afficher ces URLs avec `<img>` ou `unoptimized`, pas via `/_next/image` (cache d'un an qui survivrait à un retrait). Noté dans `photo-publique.ts`.
- Après retrait, le CDN peut servir l'image jusqu'à 5 minutes (`max-age=300`) ; pas de purge Cloudflare automatique.
- Un arrêt du processus entre l'écriture en base et la suppression des anciens fichiers peut laisser des fichiers orphelins ; pas de balayage automatique (à prévoir avec l'effacement).
- L'original garde ses métadonnées (il est privé) ; à revoir si on veut les retirer aussi.
- Dans le formulaire, une action photo recharge la fiche : une modification non enregistrée est perdue (enregistrer d'abord).
- `consentSource` est un champ unique partagé par les trois accords ; l'accord photo n'est pas encore doublé dans `ConsentEvent`.
- Avant d'ouvrir le dépôt au public (questionnaire) : limite de débit et un seul décodage d'image.
- Colonnes `photoUrl256/1024` sans index : à ajouter si la table grossit.

Relecture Opus (sécurité et données) : aucun défaut grave ; corrigés : retrait de l'accord sans fichier, erreurs disque renvoyées en message, texte alternatif conservé au remplacement, journalisation des échecs de suppression et suppression du dossier de l'original.

VERDICT OPUS : BON
