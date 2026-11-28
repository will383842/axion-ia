# Équipe D8 : retrait en un clic et effacement réel sur demande

## Quoi

- **Lien personnel de retrait** : jeton de 32 octets, seule l'empreinte sha256 est stockée (`withdrawTokenHash`). Il est remis à la publication, par e-mail, si la fiche a une adresse.
- **Page `/[locale]/equipe/retrait/[jeton]`** : noindex, `force-dynamic`, hors sitemap, interdite dans `robots.txt` (le questionnaire l'est aussi désormais). Message neutre identique pour tout jeton invalide. Turnstile et limites (par IP hachée, par jeton).
- **Retrait total** : statut « retire », accord de publication retiré, hors carte, jeton consommé. **Retrait partiel** : photo seule (retour à l'avatar, donc noindex) ou LinkedIn seul (jeton conservé).
- Effet immédiat : `revalidatePath` fiche, hub, sitemap. Alerte à l'administrateur à chaque retrait par lien (`notify`, aucun job neuf).
- **Console** : « Dépublier maintenant » existait déjà ; ajout de « Retirer la photo », « Retirer LinkedIn » et « Effacer définitivement » (mot `EFFACER` à taper, revérifié côté serveur, administrateur seulement, date de demande facultative).
- **Effacement réel** : fichiers photo d'abord (original privé, variantes publiques, photos des réponses) ; si un seul résiste, rien n'est supprimé en base. Puis une transaction supprime la fiche, ses réponses, ses invitations (y compris celles sans fiche, retrouvées par l'empreinte d'e-mail), son journal et les preuves `ConsentEvent` `team-profile-*`. Reste une seule ligne d'effacement : dates de demande et de traitement, aucun prénom, slug, e-mail ni identifiant.
- Republier une fiche retirée exige un nouvel accord de publication (l'ancien est effacé au retrait ; la règle existante `publicationConsentAt > withdrawnAt` reste).

## Pourquoi

Décision du propriétaire : l'effacement est réel sur demande, exception à la règle de non-suppression pour les fiches collaborateurs seulement. Les motifs de `rgpd-erase.ts` sont mis à jour.

## Comment vérifier

- `pnpm vitest run src/server/equipe src/server/actions/equipe src/app/robots.spec.ts src/features/admin-calendly` (jeton, retrait partiel, effacement complet, trace minimale, IDOR, rôle).
- `pnpm typecheck`, eslint sur les fichiers touchés : verts.

## Risques et restes

- **Aucune migration, aucun enum, aucun job** : les colonnes `withdrawTokenHash` et `erasureRequestedAt` existaient déjà.
- **ConsentEvent** : le dépôt n'a pas de pratique d'anonymisation ; les preuves `team-profile-*` de la personne sont donc **supprimées** (clés : empreinte d'e-mail et clé dérivée de chaque invitation).
- **Cache Cloudflare** des pages HTML : non vérifié ici. À contrôler ; sinon ajouter une purge ciblée de l'URL au retrait.
- `pnpm bundle:check` non lancé (demande un build complet). La page de retrait ne charge Turnstile qu'en différé, comme le questionnaire.
- Les fiches sans e-mail n'ont pas de lien : retrait par la console.
- Après un retrait partiel le jeton reste valable (pour pouvoir retirer le reste) ; il est consommé au retrait total.
- Un job BullMQ en vol n'est pas concerné (aucun contrat app/worker touché).

## Relecture Opus (données/RGPD + sécurité) : corrigé

- Effacement : invitations et preuves ne sont cherchées par l'adresse que si elles n'ont pas de fiche ; refus si une autre fiche porte la même adresse.
- Alerte administrateur : plus aucune donnée personnelle (elle part aussi vers Sentry).
- Effacement : verrou sur la version de la fiche, erreurs rendues en message (plus d'exception), date de demande tolérante d'un jour.
- Formulaire : le widget Turnstile est remonté après chaque envoi.

## Restes (non corrigés)

- La preuve « retrait » n'est écrite que si la fiche a une empreinte d'e-mail ; sans e-mail, pas de ligne `optout`.
- Un échec de suppression d'un fichier lors d'un retrait de photo (pas d'effacement) n'est pas remonté à l'administrateur.
- Chaque publication renvoie un nouveau lien de retrait ; l'échec d'envoi n'est pas affiché à l'administrateur.
- Fusion de `origin/main` non faite (fichier en lecture seule dans l'environnement du robot) : à fusionner avant la PR.

VERDICT OPUS : À CORRIGER — restes ci-dessus (aucun bloquant)
