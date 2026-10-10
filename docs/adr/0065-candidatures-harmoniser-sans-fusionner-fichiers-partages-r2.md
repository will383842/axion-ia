# ADR 0065 — Candidatures : harmoniser sans fusionner ; fichiers partagés sur R2, par lien à jeton

- **Statut** : proposé (chantier « Candidatures unifiées », 2026-10-07 ; PR du lot L4, label `schema` — A02 bloquant)
- **Date** : 2026-10-07
- **Auteur** : A02 Architecte
- **Prolonge** : ADR 0047 (arbitrage 3 « une seule porte »), 0051 (f « Sans suite », h opposition, j messagerie), 0054 (R2), 0058 (poids de la console), 0060 (SQL brut), 0063 (lien à jeton, journal d'ouverture)
- **Référence** : `_PLAN-CANDIDATURES-UNIFIEES-2026-10-07/01…05`, `maquettes/maquette-candidatures.html`, `src/features/personne/fiche-personne.ts`, `docs/partners/ANTI-REQUALIFICATION.md`

## Contexte

Cinq types de candidatures, quatre tables, cinq jeux de statuts, deux composeurs, une relève des réponses pour les seuls apporteurs, aucun moyen d'échanger un fichier lourd avec un candidat, un disque presque plein. Will demande l'harmonie : classer par prix, voir les vidéos, répondre avec des fichiers de plusieurs Go, recevoir l'essai en retour, suivre chaque échange. Contrainte de droit : un apporteur n'est jamais traité avec le vocabulaire ou la file d'un recrutement. Ordre de Will : aucun effacement automatique.

## Décision

- **D1 Couche commune, pas de fusion.** Lectures adaptées, composants et gestes communs ; tables inchangées.
- **D2 Deux mondes.** Pas de statut, de file ni d'alerte de dormance communs aux mondes emploi et apporteurs ; deux listes, deux menus, deux fonctions d'étape dérivées sans union de types ; une pastille et une barre d'étapes neutres.
- **D3 Étapes dérivées**, jamais stockées.
- **D4 Échanges** : réponses envoyées dans leurs tables ; réponses reçues des candidats dans `JobApplicationInboundReply` + événement `email_recu` ; fil dérivé ; rebonds rattachés aux deux tables ; une alerte par message même si la personne est dans les deux mondes.
- **D5 Fichiers** : `FichierPartage` (équipe ou personne, bibliothèque ou ponctuel, fichier R2 ou lien externe), `LienPartage` (une personne, `num_nonnulls = 1`), `LienPartageFichier`, `LienPartageAcces` (ajout seul, **sans clé étrangère ni donnée personnelle**). R2, préfixe `partages/`, bucket distinct des sauvegardes, multipart 64 Mio avec reprise ; 20 Go (équipe), 4 Go (retour candidat). Fichiers jamais effacés automatiquement ; `liens_partage` sans anti-suppression pour laisser passer la cascade d'un effacement manuel, garde statique contre toute suppression directe.
- **D6 Jamais de pièce jointe vers un candidat.** Lien `/api/partage/[id]/[jeton]`, `HMAC-SHA256(PARTAGES_SECRET, "lien-partage:v1:" + id)`, 30 jours (7 avec des rushs), retrait manuel, automatique à l'opposition, proposé à la décision négative ; page neutre pour tout refus et toute panne ; URL R2 signée 1 h (12 h au-delà de 1 Go) ; plafond de 20 téléchargements par fichier et par lien.
- **D7 Antivirus** : fichiers venus de l'extérieur toujours analysés avant affichage, jamais montrés sans verdict ; fichiers de l'équipe jusqu'à 200 Mo, au-delà `hors_limite`.
- **D8 Bibliothèque filtrée par monde**, dérivée de la catégorie : kit et présentation seulement pour un apporteur, sans dépôt depuis l'ordinateur.
- **D9 Prix** comparés dans une offre et une question, en centimes à la lecture, tri en mémoire ; table dérivée au-delà de ~1 000 dossiers.
- **D10 Droits** : `ROLES_DOSSIER_CANDIDAT` et garde des fiches apporteurs, vérifiés dans les actions, tracés dans `ActivityLog`.

## Conséquences

- Positives : aucune donnée déplacée ni effacée ; lots livrables seuls ; la frontière juridique devient un principe d'écran ; plus de gros fichier sur le disque du serveur.
- Négatives : deux tables de réponses et deux branches d'envoi demeurent ; deux relèves Zoho ; adresses relais non rattachées ; fichiers de l'équipe > 200 Mo non analysés ; dépendance au CORS du bucket et à un secret de plus ; morceaux d'envois jamais terminés nettoyés par R2 à 7 jours (pas des fichiers).
- À surveiller : volume sous `partages/` (affiché dans la bibliothèque), `cf-cache-status: DYNAMIC` sur `/api/partage/…`, alertes de plafond de téléchargement.

## Alternatives écartées

Fusion en une table « candidature » ; table commune des échanges ; PUT simple ≤ 5 Go ; stockage en base (0063) ou sur disque ; pièce jointe e-mail ; liens Drive seuls ; réutilisation de `/document/` (0063) ; clé dérivée d'`AUTH_SECRET` (une rotation couperait tous les liens) ; journal d'accès avec clé étrangère (bloque l'effacement manuel).

## Ce que cet ADR ne décide pas

La suppression de l'effacement automatique (PR distincte, décision de Will du 07/10) ; la messagerie avec les apporteurs signés (Axion Partners).

## Écarts décidés pendant le lot L4 (2026-10-07)

- **Antivirus lancé depuis l'APPLICATION**, pas par une tâche du worker : à la fin d'un dépôt, puis relancé à l'ouverture de la bibliothèque pour les fichiers restés « en attente », comme pour les vidéos des candidats. Le fichier est lu en flux depuis R2 et passé à clamd sans rien poser sur le disque. Le worker ne lit ni n'écrit ces tables.
- **Pas d'analyse au-delà de 200 Mo pour les dépôts de l'équipe** (décision 7 de Will) : le fichier naît `hors_limite` et se télécharge, affiché « Non analysé (déposé par vous) ».
- **Interrupteur éteint par défaut** (`src/server/partages/config.ts`) : sans `R2_PARTAGES_BUCKET_NAME`, ses accès et `PARTAGES_SECRET` (≥ 32 caractères), la console affiche « pas encore activée » avec la raison, et aucune fonction ne touche la base ni R2. Le compartiment des sauvegardes est refusé même s'il est configuré par erreur.
- **Le serveur ne croit pas les ETag du navigateur** : il relit `ListParts`, assemble, puis revérifie la taille par `HeadObject`. L'exposition de l'en-tête `ETag` (CORS) reste demandée pour le lot L5b, sans être lue en L4.

## Durcissements (relecture sécurité, 2026-10-08)

- **Chaque morceau est signé à sa longueur exacte** (`signerMorceauR2`, `src/lib/r2-storage.ts`) : la commande `UploadPart` porte `ContentLength = tailleMorceau(taille, numero)` et la signature inclut `content-length` (`signableHeaders`). R2 refuse un `PUT` d'une autre longueur : une adresse signée ne permet plus de pousser un volume arbitraire sur un numéro de morceau. Une taille invalide (non entière, < 1, > 5 Gio) est refusée avant toute signature.
- **Jeton dédié obligatoire** (`src/server/partages/config.ts`) : plus aucun repli sur `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` (les clés générales, qui ouvrent le compartiment des sauvegardes). Sans `R2_PARTAGES_ACCESS_KEY_ID` + `R2_PARTAGES_SECRET_ACCESS_KEY`, la bibliothèque reste éteinte : « le jeton dédié au compartiment de la bibliothèque n'est pas encore réglé ».
- **Un morceau reçu de mauvaise taille arrête l'envoi** (`terminerDepot`) : comme chaque adresse est signée à la longueur exacte, un tel écart n'est pas un incident réseau. L'envoi multipart est arrêté dans R2 (`arreterEnvoiR2`) et la ligne passe `abandonne` ; elle reste en base, rien n'est supprimé. Un morceau simplement MANQUANT reste, lui, repris.
- **Le jeton du lien privé n'est jamais écrit en base** (lot L5) : `job_application_replies.body_html` / `body_text` et `job_application_events.body` ne portent que l'adresse masquée `…/api/partage/<id>/lien-prive-de-telechargement` (`adresseMasqueeLien`, `src/server/partages/jeton.ts`). Le worker d'e-mails remet le vrai jeton au moment de l'envoi (`devoilerLienPrive`), uniquement pour le lien de cette réponse (`liens_partage.reponse_id`) ; s'il ne le peut pas, la réponse est marquée en échec et rien ne part avec le marqueur. **Conséquence d'exploitation : le worker (`axion-ia-worker`) a désormais besoin de `PARTAGES_SECRET`, même valeur que l'application**, et il lit `liens_partage.id` (lecture seule) — exception à « le worker ne lit ni n'écrit ces tables ».
- **Dépôt public d'un candidat** (lot L5b) : chaque morceau est signé à sa taille et un morceau de mauvaise taille arrête l'envoi (mêmes règles qu'au-dessus, `origine = personne` compris) ; le plafond de 10 fichiers par lien se compte sous `pg_advisory_xact_lock` propre au lien, dans la transaction qui ouvre l'envoi ; le limiteur de la route publique **refuse** quand Redis est en panne (`surPanne: "refuser"`).
- **Effacement manuel d'un dossier** : si un fichier renvoyé par le candidat ne peut pas être effacé du stockage (stockage injoignable, ou bibliothèque éteinte alors que de tels fichiers existent), le dossier n'est **pas** supprimé — la console affiche « Les fichiers renvoyés par le candidat n'ont pas pu être effacés du stockage ; réessayez. » et la demande art. 17 signale la candidature comme conservée. L'export art. 15 liste ces fichiers (nom, date, taille ; copie sur demande à contact@axion-ia.com) ; `FichierPartage` est annoté `rgpd: dossier-client`.
- **Antivirus — réglage exigé côté serveur** (`clamd.conf` du conteneur `axion-clamav`) : `AlertExceedsMax yes`, et `StreamMaxLength`, `MaxScanSize`, `MaxFileSize` **≥ 4 Go** (ex. `4100M`). Sans `AlertExceedsMax`, clamd n'analyse que le début d'un gros fichier et répond `OK`. Un dépassement signalé (`Heuristics.Limits.Exceeded…`) ou un flux trop long (`INSTREAM size limit exceeded`) est lu « indisponible », jamais « sain » : le fichier reste en attente et n'est pas servi (`src/server/careers/clamav.ts`).
