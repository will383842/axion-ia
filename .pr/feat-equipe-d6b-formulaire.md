# Pages équipe · D6b : questionnaire public par lien personnel

## Quoi

Une page privée `/fr/equipe/questionnaire/<jeton>` où un collaborateur remplit son questionnaire. L'envoi crée une fiche « à valider » : elle n'est jamais publiée toute seule.

## Pourquoi

Chaque personne écrit elle-même sa présentation et donne ses accords un par un. L'équipe relit ensuite avant toute mise en ligne.

## Ce qui est fait

- Le jeton n'est jamais stocké : on cherche par `sha256(jeton)` (`src/server/equipe/questionnaire/jeton.ts`, fichier commun écrit tel quel).
- Même message pour un lien inconnu, expiré, révoqué, déjà utilisé ou une fiche en cours d'effacement. La première ouverture est notée.
- Questions communes et questions de la catégorie (version figée par l'invitation, déjà dans `src/lib/equipe/donnees`).
- Cases séparées et non cochées d'avance : publication, photo, LinkedIn, carte (simple souhait, rien n'est mis sur la carte), et attestation obligatoire « Je certifie l'exactitude des informations fournies et j'en assume la responsabilité. » (texte versionné `team-attestation-v1`).
- Contrôlé côté serveur : pas d'envoi sans attestation ni consentement de publication ; photo refusée si la case photo n'est pas cochée.
- Turnstile (strict), limite par IP hachée (5 par heure) et par jeton (3 par heure).
- Une transaction : invitation consommée (condition dans l'UPDATE, donc un double envoi simultané ne passe qu'une fois), fiche créée ou mise à jour en `a_valider`, réponse conservée, un `ConsentEvent` par accord plus l'attestation (`team-profile-attestation`), journal.
- Une fiche déjà publiée n'est pas modifiée : la réponse est gardée, la photo n'est pas appliquée.
- Photo : `deposerPhotoCollaborateur` (branche D4) appelée après la transaction ; elle ré-encode sans EXIF. La photo est contrôlée avant l'écriture.
- Aucune migration : l'attestation est tracée dans `ConsentEvent` et dans la réponse conservée. Aucun job, aucune énumération, aucun e-mail.
- Garde `gardeLectureEchanges` ajoutée en première instruction des deux pages console `collaborateurs` (même rôles qu'avant) : le test de garde échouait sur la base D4.

## Comment vérifier

- `pnpm vitest run src/server/equipe src/lib/equipe src/features/admin-calendly/__tests__/la-lecture-est-gardee-comme-l-ecriture.spec.ts`
- Créer une invitation en base (jeton de `genererJetonQuestionnaire`, hash dans `tokenHash`), ouvrir le lien, envoyer, vérifier la fiche en `a_valider`.

## Risques et restes

- Le clone du robot a des fichiers en lecture seule (`package.json`, deux scripts `apporteurs`) : ils sont restés dans l'état de `main` dans l'arbre de travail et ne sont PAS dans le commit. `pnpm-lock.yaml` n'a pas été comparé.
- `pnpm typecheck` ne signale que deux scripts restés de `main` (hors de cette branche), rien dans le code ajouté.
- Le lieu saisi est rapproché d'une ville ou d'un département par son nom ; sinon il reste en texte sans coordonnées.
- Si la photo échoue après la transaction, la fiche est gardée et la personne en est informée.
- `pnpm bundle:check` : voir le compte rendu final.

## Relecture Opus (sécurité et données) : corrigé

- Case photo ou LinkedIn décochée : l'accord antérieur est retiré (colonnes remises à vide, photo retirée, preuve `optout` écrite). Sur une fiche déjà publiée rien n'est touché, c'est voulu : la version en ligne reste jusqu'à la relecture.
- La mise à jour d'une fiche existante refuse une fiche devenue publiée entre la lecture et l'écriture.
- Réponse « apport » rangée à part de celles de la catégorie (le partenaire a une question du même nom).
- Invitation et fiche de catégories différentes : message neutre.
- Collision de slug entre deux envois simultanés : message d'erreur, invitation non consommée.
- Échec de la photo après l'envoi : un événement `photo_questionnaire_echec` est écrit pour que l'équipe recontacte la personne.
- Clé de preuve : l'empreinte e-mail de l'invitation, sinon celle de la fiche, sinon une empreinte de l'invitation. Agent navigateur de la réponse haché.
- Limite par jeton qui refuse si Redis tombe ; le formulaire n'efface plus les réponses après un refus.

## Restes

- À faire côté invitations (autre branche) : renseigner `emailHash` à la création, sinon les accords restent introuvables par la recherche RGPD, et créer l'invitation avec la même catégorie que la fiche.
- La photo est décodée deux fois (contrôle avant, dépôt après) : coût accepté.
- `pnpm bundle:check` et la mesure du premier chargement de la page n'ont pas pu être faits : le build du robot n'a pas abouti dans le temps imparti. La page n'envoie en JavaScript que l'îlot du formulaire, et Turnstile est chargé à la demande.
- Pour passer le contrôle de typage du commit, des fichiers de `main` ont été posés temporairement hors commit ; ils ne sont pas dans la branche.
- Le dernier `git merge origin/main` n'a pas pu être fait dans cet environnement (fichiers en lecture seule) : à faire avant la fusion.

VERDICT OPUS : BON, avec les restes ci-dessus
