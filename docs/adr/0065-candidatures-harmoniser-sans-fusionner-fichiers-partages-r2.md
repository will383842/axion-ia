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
