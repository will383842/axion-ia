# E-mails aux formateurs indépendants — version à relire

Nouvelle version des textes, réécrite au ton des e-mails apporteurs d'affaires (vouvoiement, « nous », phrases courtes, une idée par paragraphe). **Texte seul : rien ne part tant que les textes ne sont pas validés** (interrupteur `textes_valides` éteint).

Comment lire chaque fiche :

- **Titre** : la ligne affichée en tête du message. Le gabarit commun des formateurs affiche l'objet comme titre ; ils sont donc identiques.
- **Aperçu** : la ligne grise visible dans la boîte de réception avant l'ouverture. Le gabarit prend la première phrase du corps qui diffère de l'objet.
- **Corps** : chaque message commence par « Bonjour Prénom, » et se termine par la signature courte du fondateur. Les mots entre [crochets] sont remplis par l'outil.
- Les messages marqués **sollicitation** portent en plus, en bas, la ligne : « Si vous ne souhaitez plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message. »

## F0 — Accusé de candidature (variante « mission »)

- **Envoyé quand** : juste après une candidature de formateur indépendant (seulement si le formulaire freelance et les textes validés sont allumés).
- **Objet** : Bien reçu : votre candidature de formateur
- **Titre** : Bien reçu, merci
- **Aperçu** : Une personne la lit. Si votre profil correspond, nous vous proposerons un échange de 20 minutes.
- **Corps** :

  > Votre candidature à nos missions de formateur IA indépendant est bien arrivée.
  >
  > Bonjour Prénom,
  > Merci pour votre intérêt. Chaque candidature est lue par une personne. Si votre profil correspond, nous vous proposerons un échange de 20 minutes en visio pour faire connaissance, sans engagement.

- **Bouton** : aucun (lien « Supprimer ma candidature » en bas, inchangé)

## F1 — Invitation à l'échange

- **Gabarit** : `formateur-invitation-echange` — sollicitation
- **Envoyé quand** : 15 à 20 minutes après la candidature (une seule invitation par personne ; rien ne part si le registre des entreprises montre une entreprise fermée).

- **Objet** : Et si on en parlait 20 minutes ?
- **Titre** : Et si on en parlait 20 minutes ?
- **Aperçu** : Merci pour votre candidature à nos missions de formateur IA indépendant.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour votre candidature à nos missions de formateur IA indépendant.
  >
  > Nous vous proposons un échange de 20 minutes en visio : faire connaissance, vous expliquer simplement comment fonctionnent nos missions et répondre à vos questions. Sans engagement : à l'issue, chacun décide librement de la suite.
  >
  > Choisissez vous-même le moment qui vous arrange, en un clic, avec le bouton ci-dessous.

- **Bouton** : « Réserver mon créneau »

## F2 — Relances de l'invitation (2 au plus)

- **Gabarit** : `formateur-invitation-relance` — sollicitation
- **Envoyé quand** : 3 jours puis 7 jours après l'invitation, tant que la personne n'a ni réservé, ni répondu, ni été classée par vous. Rien après 14 jours.

### F2 — J+3

- **Objet** : Votre échange vous attend
- **Titre** : Votre échange vous attend
- **Aperçu** : Il ne vous reste plus qu'à choisir le moment de notre échange de 20 minutes en visio.
- **Corps** :

  > Bonjour Prénom,
  >
  > Il ne vous reste plus qu'à choisir le moment de notre échange de 20 minutes en visio.
  >
  > Réservez le vôtre en un clic avec le bouton ci-dessous.

- **Bouton** : « Réserver mon créneau »

### F2 — J+7

- **Objet** : Dernier rappel : notre échange en visio
- **Titre** : Dernier rappel : notre échange en visio
- **Aperçu** : C'est notre dernier message à ce sujet.
- **Corps** :

  > Bonjour Prénom,
  >
  > C'est notre dernier message à ce sujet.
  >
  > L'échange de 20 minutes en visio reste ouvert si vous souhaitez découvrir nos missions.
  >
  > Si ce n'est pas le bon moment, aucun souci : sans réservation de votre part, nous ne vous relancerons plus.

- **Bouton** : « Réserver mon créneau »

## F55 — Rattrapage unique des candidatures déjà reçues (sans « 15 minutes », sans relance)

- **Gabarit** : `formateur-invitation-rattrapage` — sollicitation
- **Envoyé quand** : une seule fois, après votre aperçu de la liste nominative, aux candidatures reçues depuis le 9 octobre qui n'ont pas encore été invitées.

- **Objet** : Votre candidature : nous revenons vers vous
- **Titre** : Votre candidature : nous revenons vers vous
- **Aperçu** : Merci pour votre candidature à nos missions de formateur IA indépendant.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour votre candidature à nos missions de formateur IA indépendant.
  >
  > Notre réponse arrive plus tard que prévu : pardon pour ce délai.
  >
  > Nous vous proposons un échange en visio : faire connaissance, vous expliquer simplement comment fonctionnent nos missions et répondre à vos questions. Sans engagement.
  >
  > Et si vous avez trouvé une autre voie entre-temps, vous n'avez rien à faire : nous ne vous relancerons pas.

- **Bouton** : « Réserver mon créneau »

## F3 — Échange confirmé

- **Gabarit** : `formateur-echange-confirme`
- **Envoyé quand** : la personne vient de réserver son créneau (en moins d'une minute).

- **Objet** : C'est confirmé : [jour] à [heure]
- **Titre** : C'est confirmé : [jour] à [heure]
- **Aperçu** : Votre échange est confirmé.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre échange est confirmé.
  >
  > Au programme : faire connaissance, vous expliquer simplement nos missions, et répondre à toutes vos questions.
  >
  > L'invitation d'agenda vous parvient séparément, par Calendly. Nous vous écrivons la veille, puis une heure avant.
  >
  > Rien à préparer de votre côté.

- **Bouton** : aucun

## F4 — Rappels de l'échange (la veille, puis une heure avant)

- **Gabarit** : `formateur-echange-rappel`
- **Envoyé quand** : 24 heures avant, puis 1 heure avant l'échange, sauf annulation.

### F4 — veille

- **Objet** : Votre échange a lieu demain à [HH:MM]
- **Titre** : Votre échange a lieu demain à [HH:MM]
- **Aperçu** : Petit rappel, nous nous parlons demain à [HH:MM] (heure de Paris).
- **Corps** :

  > Bonjour Prénom,
  >
  > Petit rappel, nous nous parlons demain à [HH:MM] (heure de Paris).
  >
  > Le lien de connexion est dans l'invitation d'agenda. Rien à préparer de votre côté.

- **Bouton** : aucun

### F4 — 1 heure avant

- **Objet** : Votre échange a lieu dans une heure
- **Titre** : Votre échange a lieu dans une heure
- **Aperçu** : Petit rappel, nous nous parlons à [HH:MM] (heure de Paris).
- **Corps** :

  > Bonjour Prénom,
  >
  > Petit rappel, nous nous parlons à [HH:MM] (heure de Paris).
  >
  > Rien à préparer de votre côté.

- **Bouton** : « Rejoindre la visioconférence »

## F5 — Échange concluant : la suite (clic « Retenu »)

- **Gabarit** : `formateur-issue-retenu`
- **Envoyé quand** : vous cliquez « Retenu » après l'échange, et vous avez vu l'aperçu.

- **Objet** : Merci pour notre échange : la suite
- **Titre** : Merci pour notre échange : la suite
- **Aperçu** : Merci pour notre échange.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour notre échange. Nous serions heureux de vous confier des missions de formation.
  >
  > Comment ça marche :
  > • chaque mission vous est proposée avec ses dates et ses honoraires, avant que vous répondiez ;
  > • vous l'acceptez ou la refusez librement, sans aucune conséquence ;
  > • aucun volume n'est garanti ;
  > • vous restez libre de vos méthodes d'animation, dans le programme convenu, et de travailler pour d'autres clients.
  >
  > Vos honoraires : 350 € HT la journée, 175 € HT la demi-journée.
  >
  > Première étape : complétez votre dossier avec le bouton ci-dessous. Comptez environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard.
  >
  > Vous y signerez aussi votre contrat de sous-traitance. Nous le contresignons ensuite, après vérification : il ne prend effet qu'à ce moment-là.

- **Bouton** : « Compléter mon dossier »

## F6 — Échange non concluant (clic « Non retenu »)

- **Gabarit** : `formateur-issue-non-retenu`
- **Envoyé quand** : vous cliquez « Non retenu », après aperçu.

- **Objet** : Suite à notre échange
- **Titre** : Suite à notre échange
- **Aperçu** : Merci pour le temps que vous nous avez accordé lors de notre échange.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour le temps que vous nous avez accordé lors de notre échange.
  >
  > Nous ne donnons pas suite pour le moment. Nos besoins ne correspondent pas à votre profil.
  >
  > Votre candidature reste chez nous : si nos besoins évoluent, nous pourrons revenir vers vous.
  >
  > Vous préférez que nous effacions vos données ? Répondez simplement à ce message : Williams Jullin, responsable d'Axion-IA, traite votre demande. Votre fiche est alors rendue anonyme, et seul ce que la loi impose de conserver est gardé.
  >
  > Nous vous souhaitons le meilleur pour la suite de vos projets.

- **Bouton** : aucun

## F7 — Absent à l'échange (clic « Absent »)

- **Gabarit** : `formateur-issue-absent` — sollicitation
- **Envoyé quand** : vous cliquez « Absent » (une seule fois par personne).

- **Objet** : Nous vous avons attendu : un autre créneau ?
- **Titre** : Nous vous avons attendu : un autre créneau ?
- **Aperçu** : Nous vous avons attendu pour notre échange en visio.
- **Corps** :

  > Bonjour Prénom,
  >
  > Nous vous avons attendu pour notre échange en visio. Aucun souci : un imprévu arrive à tout le monde.
  >
  > Si nos missions vous intéressent toujours, choisissez simplement un nouveau créneau avec le bouton ci-dessous.
  >
  > Et si ce n'est plus d'actualité pour vous, vous n'avez rien à faire : nous ne vous relancerons pas.

- **Bouton** : « Choisir un nouveau créneau »

## F8 — Lien du dossier (renvoi)

- **Gabarit** : `formateur-dossier-lien`
- **Envoyé quand** : vous cliquez « Renvoyer le lien », ou le lien est renouvelé.

- **Objet** : Votre dossier de formateur, en ligne
- **Titre** : Votre dossier de formateur, en ligne
- **Aperçu** : Voici votre lien personnel pour compléter votre dossier.
- **Corps** :

  > Bonjour Prénom,
  >
  > Voici votre lien personnel pour compléter votre dossier.
  >
  > Vous y trouverez :
  > • vos coordonnées ;
  > • votre activité ;
  > • les pièces à fournir ;
  > • votre contrat.
  >
  > Comptez environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard.
  >
  > Ce lien vous est personnel.

- **Bouton** : « Compléter mon dossier »

## F9 — Relances du dossier (2 au plus)

- **Gabarit** : `formateur-dossier-relance`
- **Envoyé quand** : 3 puis 7 jours après F5 ou F8, tant que le dossier n'est pas envoyé. Rien après 14 jours.

### F9 — J+3

- **Objet** : Votre dossier vous attend
- **Titre** : Votre dossier vous attend
- **Aperçu** : Petit rappel, votre dossier n'est pas encore complété.
- **Corps** :

  > Bonjour Prénom,
  >
  > Petit rappel, votre dossier n'est pas encore complété.
  >
  > Il reste à le compléter pour que nous puissions vous confier des missions. Vous pouvez reprendre votre dossier là où vous l'avez laissé.

- **Bouton** : « Compléter mon dossier »

### F9 — J+7

- **Objet** : Dernier rappel : votre dossier reste ouvert
- **Titre** : Dernier rappel : votre dossier reste ouvert
- **Aperçu** : C'est notre dernier rappel au sujet de votre dossier.
- **Corps** :

  > Bonjour Prénom,
  >
  > C'est notre dernier rappel au sujet de votre dossier.
  >
  > Il reste ouvert, et vous pouvez le reprendre là où vous l'avez laissé.
  >
  > Si vous ne souhaitez pas donner suite, vous n'avez rien à faire.

- **Bouton** : « Compléter mon dossier »

## F10 — Dossier bien reçu (avec la copie de la signature du contrat)

- **Gabarit** : `formateur-dossier-recu`
- **Envoyé quand** : la personne envoie son dossier signé. Remplace l'ancien « F28 bis » : un seul e-mail au lieu de deux.

- **Objet** : Bien reçu : votre dossier et votre contrat
- **Titre** : Bien reçu : votre dossier et votre contrat
- **Aperçu** : Votre dossier et votre contrat signé nous sont bien parvenus, merci.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre dossier et votre contrat signé nous sont bien parvenus, merci.
  >
  > La copie du contrat que vous avez signé est en pièce jointe.
  >
  > Nous relisons maintenant votre dossier, en le rapprochant du registre public des entreprises.
  >
  > Vous recevrez ensuite par e-mail votre contrat contresigné et l'accès à votre espace.

- **Bouton** : aucun

## F11 — Dossier à vérifier (message interne, pour vous seul)

- **Gabarit** : `formateur-dossier-a-verifier` — message interne, pour Will seul (texte inchangé)
- **Envoyé quand** : un dossier est envoyé (alerte Telegram et corbeille, jamais de nom complet, d'IBAN ni de numéro d'entreprise).

- **Objet** : Dossier formateur reçu, à vérifier
- **Titre** : Dossier formateur reçu, à vérifier
- **Aperçu** : Dossier reçu · [identifiant court] · registre :
- **Corps** :

  > Bonjour Prénom,
  >
  > Dossier reçu · [identifiant court] · registre : [vert / orange / rouge] · [lien console « Vérifier et contresigner »]

- **Bouton** : aucun

## F12 — Il manque un élément (vous décidez)

- **Gabarit** : `formateur-dossier-a-completer`
- **Envoyé quand** : sur l'écran de vérification, vous cliquez « Demander un complément », en choisissant un motif dans une liste fermée.

- **Objet** : Votre dossier : un complément
- **Titre** : Votre dossier : un complément
- **Aperçu** : Merci pour votre dossier.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour votre dossier. Pour continuer, il nous manque : [motif].
  >
  > Déposez-le avec le même lien : il suffit de reprendre votre dossier.

- **Bouton** : « Reprendre mon dossier »

## F13 — Dossier non retenu (vous confirmez un registre rouge)

- **Gabarit** : `formateur-dossier-refuse`
- **Envoyé quand** : le registre indique une entreprise fermée ou un numéro introuvable, et vous cliquez « Refuser le dossier », après aperçu.

- **Objet** : Votre dossier de formateur indépendant
- **Titre** : Votre dossier de formateur indépendant
- **Aperçu** : Merci pour le temps consacré à votre dossier.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour le temps consacré à votre dossier.
  >
  > Le registre public n'indique pas d'activité ouverte à ce numéro [motif : entreprise fermée / numéro introuvable].
  >
  > Une micro-entreprise suffit. Dès que votre entreprise est créée ou régularisée, écrivez-nous : nous reprendrons votre dossier.

- **Bouton** : aucun

## F14 — Retrouver mon espace (lien demandé par la personne)

- **Gabarit** : `formateur-lien-espace`
- **Envoyé quand** : la personne demande son lien sur la page « Retrouver mon espace ». La page répond toujours la même phrase, quelle que soit l'adresse.

- **Objet** : Votre lien pour retrouver votre espace
- **Titre** : Votre lien pour retrouver votre espace
- **Aperçu** : Voici le lien que vous avez demandé.
- **Corps** :

  > Bonjour Prénom,
  >
  > Voici le lien que vous avez demandé.
  >
  > Ce lien vous est personnel : ne transférez pas cet e-mail. Si vous n'êtes pas à l'origine de cette demande, ignorez-le simplement.

- **Bouton** : « Reprendre mon dossier » ou « Ouvrir mon espace »

## F15 — Statut pas encore ouvert (portage salarial, coopérative, hors de France)

- **Gabarit** : `formateur-statut-non-ouvert`
- **Envoyé quand** : le dossier indique un statut que nous n'ouvrons pas encore (une seule fois).

- **Objet** : Votre dossier : un statut pas encore ouvert
- **Titre** : Votre dossier : un statut pas encore ouvert
- **Aperçu** : Merci pour votre dossier.
- **Corps** :

  > Bonjour Prénom,
  >
  > Merci pour votre dossier.
  >
  > Le statut que vous avez indiqué n'est pas encore ouvert chez nous.
  >
  > Votre dossier reste chez nous : nous revenons vers vous dès que ce sera possible.

- **Bouton** : aucun

## F16 — Contrat à signer (cas particuliers seulement : nouvelle version, organisme, mise à niveau)

- **Gabarit** : `formateur-contrat-a-signer`
- **Envoyé quand** : un contrat doit être signé hors du dossier (si la décision 93 est acceptée, ce n'est plus le parcours normal d'un nouveau formateur).

- **Objet** : Votre contrat de sous-traitance, en ligne
- **Titre** : Votre contrat de sous-traitance, en ligne
- **Aperçu** : Votre contrat de sous-traitance est prêt.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre contrat de sous-traitance est prêt.
  >
  > Lisez-le, puis signez-le en ligne avec le bouton ci-dessous. Au moment de signer, un code vous est envoyé par e-mail.
  >
  > Il prend effet une fois signé à son tour par Axion-IA : votre espace s'ouvre alors.

- **Bouton** : « Lire et signer mon contrat »

## F17 — Code de signature

- **Gabarit** : `formateur-code-signature`
- **Envoyé quand** : la personne clique « Recevoir mon code » (valable 15 minutes, 5 essais). Le code est dans l'objet pour se lire depuis la notification.

- **Objet** : [code] : votre code de signature Axion-IA
- **Titre** : [code] : votre code de signature Axion-IA
- **Aperçu** : Votre code de signature :
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre code de signature : [code]. Il est valable [durée].
  >
  > Vous n'êtes pas en train de signer ? Ignorez simplement ce message.

- **Bouton** : aucun

## F18 — Relances du contrat (2 au plus, seulement si F16 est parti)

- **Gabarit** : `formateur-contrat-relance`
- **Envoyé quand** : 3 puis 7 jours après F16, tant que le contrat n'est pas signé.

### F18 — J+3

- **Objet** : Votre contrat vous attend
- **Titre** : Votre contrat vous attend
- **Aperçu** : Il ne reste qu'à signer votre contrat de sous-traitance.
- **Corps** :

  > Bonjour Prénom,
  >
  > Il ne reste qu'à signer votre contrat de sous-traitance.

- **Bouton** : « Lire et signer mon contrat »

### F18 — J+7

- **Objet** : Dernier rappel : votre contrat
- **Titre** : Dernier rappel : votre contrat
- **Aperçu** : C'est notre dernier rappel.
- **Corps** :

  > Bonjour Prénom,
  >
  > C'est notre dernier rappel. Votre contrat reste disponible.
  >
  > Si vous avez changé d'avis, vous n'avez rien à faire.

- **Bouton** : « Lire et signer mon contrat »

## F20 — Espace ouvert

- **Gabarit** : `formateur-espace-ouvert`
- **Envoyé quand** : vous cliquez « Contresigner et ouvrir son espace ». Elle reçoit aussi l'exemplaire complet du contrat (F19, inchangé).

- **Objet** : Votre espace formateur est ouvert
- **Titre** : Votre espace formateur est ouvert
- **Aperçu** : Votre contrat est contresigné, et votre espace formateur est ouvert.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre contrat est contresigné, et votre espace formateur est ouvert.
  >
  > Quand une mission vous est proposée, vous recevez un e-mail. Vous l'acceptez ou la refusez librement.
  >
  > Aucun volume n'est garanti.

- **Bouton** : « Ouvrir mon espace »

## F21 — Numéro de déclaration d'activité à transmettre

- **Gabarit** : `formateur-nda-a-transmettre`
- **Envoyé quand** : le formateur a signé avec un numéro « en cours » ; 30 puis 60 jours après la contresignature (vous recevez une alerte à 90 jours).

- **Objet** : Votre numéro de déclaration d'activité
- **Titre** : Votre numéro de déclaration d'activité
- **Aperçu** : Dès que la préfecture vous a attribué votre numéro de déclaration d'activité, transmettez-le depuis votre espace.
- **Corps** :

  > Bonjour Prénom,
  >
  > Dès que la préfecture vous a attribué votre numéro de déclaration d'activité, transmettez-le depuis votre espace.
  >
  > Il est nécessaire pour vous confier une mission.

- **Bouton** : « Transmettre mon numéro »

## F22 — Présentation de notre méthode (facultative)

- **Gabarit** : `formateur-presentation-methode` — sollicitation
- **Envoyé quand** : vous proposez une date, après aperçu. Une seule proposition.

- **Objet** : Notre façon de travailler (facultatif)
- **Titre** : Notre façon de travailler (facultatif)
- **Aperçu** : Si vous le souhaitez, nous vous proposons une présentation de notre façon de travailler.
- **Corps** :

  > Bonjour Prénom,
  >
  > Si vous le souhaitez, nous vous proposons une présentation de notre façon de travailler.
  >
  > Une demi-journée, le [date], honorée 175 € HT.
  >
  > Elle est facultative : elle ne change rien aux missions qui vous seront proposées.

- **Bouton** : « Répondre à cette proposition »

## F45 — Nouvelle version du contrat (et relances à 7 et 21 jours)

- **Gabarit** : `formateur-contrat-nouvelle-version`
- **Envoyé quand** : vous lancez une nouvelle version du contrat, après aperçu.

### F45 — envoi

- **Objet** : Une nouvelle version de votre contrat
- **Titre** : Une nouvelle version de votre contrat
- **Aperçu** : Une nouvelle version de votre contrat de sous-traitance est disponible.
- **Corps** :

  > Bonjour Prénom,
  >
  > Une nouvelle version de votre contrat de sous-traitance est disponible.
  >
  > Ce qui change : [liste courte].
  >
  > Vous avez 30 jours pour la lire et la signer. Vos missions en cours ne changent pas.
  >
  > Vous préférez rester sur la version actuelle ? C'est possible.

- **Bouton** : « Lire la nouvelle version »

### F45 — Relance (J+7)

- **Objet** : Votre nouvelle version du contrat vous attend
- **Titre** : Votre nouvelle version du contrat vous attend
- **Aperçu** : Il vous reste [N] jours pour lire et signer la nouvelle version de votre contrat.
- **Corps** :

  > Bonjour Prénom,
  >
  > Il vous reste [N] jours pour lire et signer la nouvelle version de votre contrat.

- **Bouton** : « Lire la nouvelle version »

### F45 — Relance (J+21)

- **Objet** : Dernier rappel : nouvelle version du contrat
- **Titre** : Dernier rappel : nouvelle version du contrat
- **Aperçu** : Il vous reste [N] jours pour signer la nouvelle version de votre contrat.
- **Corps** :

  > Bonjour Prénom,
  >
  > Il vous reste [N] jours pour signer la nouvelle version de votre contrat.
  >
  > Vous préférez rester sur la version actuelle ? Répondez simplement à ce message.

- **Bouton** : aucun

## F24 — Proposition close (sans réponse)

- **Gabarit** : `formateur-proposition-close`
- **Envoyé quand** : la date limite de réponse est passée sans réponse.

- **Objet** : La proposition de mission du [date] est close
- **Titre** : La proposition de mission du [date] est close
- **Aperçu** : Sans réponse de votre part, la proposition de mission du [date] est close.
- **Corps** :

  > Bonjour Prénom,
  >
  > Sans réponse de votre part, la proposition de mission du [date] est close.
  >
  > Vous n'avez rien à faire : d'autres missions pourront vous être proposées.

- **Bouton** : aucun

## F25 — Accord enregistré, la lettre suit

- **Gabarit** : `formateur-accord-enregistre`
- **Envoyé quand** : le formateur accepte, mais la lettre ne peut pas partir tout de suite (le client n'a pas encore signé, ou le financeur n'a pas répondu).

- **Objet** : Merci, votre accord est enregistré
- **Titre** : Merci, votre accord est enregistré
- **Aperçu** : Votre accord pour la mission [intitulé] est bien noté.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre accord pour la mission [intitulé] est bien noté.
  >
  > Votre lettre de mission vous parviendra dès que le client aura signé sa convention.

- **Bouton** : aucun

## F26 — Lettre de mission à signer

- **Gabarit** : `formateur-lettre-a-signer`
- **Envoyé quand** : la lettre est prête (le client a signé, le formateur a accepté). Une lettre couvre toutes les journées de la mission, de 1 à plusieurs jours. Aucun lien secret : le bouton passe par la connexion si besoin.

- **Objet** : Votre lettre de mission est prête à signer
- **Titre** : Votre lettre de mission est prête à signer
- **Aperçu** : Votre lettre de mission pour [intitulé] est prête.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre lettre de mission pour [intitulé] est prête.
  >
  > Elle couvre [N] journée(s) et [M] demi-journée(s), du [date de début] au [date de fin], à [lieu].
  >
  > Elle rappelle votre contrat de sous-traitance, vos honoraires ([total] € HT) et le forfait de déplacement [le cas échéant].
  >
  > Elle rappelle aussi la date limite de paiement de vos honoraires : le [date limite] au plus tard, 30 jours après la dernière journée.

- **Bouton** : « Signer ma lettre »

## F27 — Relances de la lettre (2 au plus)

- **Gabarit** : `formateur-lettre-relance`
- **Envoyé quand** : une première fois entre 2 jours après l'envoi et le milieu du délai, puis 3 jours avant le début. Rien après le début de la mission.

### F27 — 1re

- **Objet** : Votre lettre de mission est à signer
- **Titre** : Votre lettre de mission est à signer
- **Aperçu** : Il ne reste qu'à signer votre lettre de mission pour [intitulé].
- **Corps** :

  > Bonjour Prénom,
  >
  > Il ne reste qu'à signer votre lettre de mission pour [intitulé].

- **Bouton** : « Signer ma lettre »

### F27 — J-3

- **Objet** : Votre mission commence dans 3 jours
- **Titre** : Votre mission commence dans 3 jours
- **Aperçu** : Votre lettre de mission pour [intitulé] attend encore votre signature.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre lettre de mission pour [intitulé] attend encore votre signature.

- **Bouton** : « Signer ma lettre »

## F28 — Copie de votre signature de la lettre

- **Gabarit** : `formateur-lettre-copie-signature`
- **Envoyé quand** : le formateur vient de signer sa lettre (l'exemplaire complet, signé des deux parties, suit par F19).

- **Objet** : Votre copie de la lettre de mission signée
- **Titre** : Votre copie de la lettre de mission signée
- **Aperçu** : C'est signé, merci.
- **Corps** :

  > Bonjour Prénom,
  >
  > C'est signé, merci.
  >
  > Voici la copie de votre signature de la lettre de mission [numéro], en PDF, en pièce jointe.
  >
  > L'exemplaire signé des deux parties vous parviendra ensuite.

- **Bouton** : aucun

## F29 — Lettre modifiée (rectificative)

- **Gabarit** : `formateur-lettre-rectifiee`
- **Envoyé quand** : les dates, le lieu ou le forfait changent après la signature.

- **Objet** : Les conditions de votre mission ont changé
- **Titre** : Les conditions de votre mission ont changé
- **Aperçu** : Les conditions de votre mission [intitulé] ont changé :
- **Corps** :

  > Bonjour Prénom,
  >
  > Les conditions de votre mission [intitulé] ont changé : [ce qui change].
  >
  > Une lettre rectifiée remplace la précédente. Signez-la depuis votre espace, avec le bouton ci-dessous.

- **Bouton** : « Signer ma lettre rectifiée »

## F30 — Mission retirée

- **Gabarit** : `formateur-mission-retiree`
- **Envoyé quand** : la mission ne lui est plus confiée (changement de formateur, financement non accordé, retrait). Motif choisi dans une liste fermée.

- **Objet** : Une mission ne vous est plus confiée
- **Titre** : Une mission ne vous est plus confiée
- **Aperçu** : La mission [intitulé] du [date] ne vous est plus confiée.
- **Corps** :

  > Bonjour Prénom,
  >
  > La mission [intitulé] du [date] ne vous est plus confiée.
  >
  > La raison : [motif : changement d'organisation du client / financement non accordé / autre choix d'Axion].
  >
  > Comme le prévoit votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.
  >
  > Cela ne remet pas en cause notre collaboration : d'autres missions pourront vous être proposées.

- **Bouton** : aucun

### F30, variante « lettre non signée »

- **Envoyé quand** : la lettre de mission avait été émise mais n'était pas encore signée. Aucune indemnité n'est annoncée. Variante neuve, à valider par Will.
- **Objet** : Une mission ne vous est plus confiée
- **Corps** :

  > Bonjour Prénom,
  >
  > La mission [intitulé] du [date] ne vous est plus confiée.
  >
  > La raison : [motif].
  >
  > La lettre de mission, que vous n'aviez pas encore signée, est annulée.
  >
  > Cela ne remet pas en cause notre collaboration : d'autres missions pourront vous être proposées.

- **Bouton** : aucun

## F31 — Formation annulée

- **Gabarit** : `formateur-formation-annulee`
- **Envoyé quand** : la session est annulée.

- **Objet** : La formation [intitulé] du [date] est annulée
- **Titre** : La formation [intitulé] du [date] est annulée
- **Aperçu** : La formation [intitulé] du [date] est annulée, et votre mission avec elle.
- **Corps** :

  > Bonjour Prénom,
  >
  > La formation [intitulé] du [date] est annulée, et votre mission avec elle.
  >
  > Comme le prévoit votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.

- **Bouton** : aucun

### F31, variante « lettre non signée »

- **Envoyé quand** : la lettre de mission avait été émise mais n'était pas encore signée. Aucune indemnité n'est annoncée. Variante neuve, à valider par Will.
- **Objet** : La formation [intitulé] du [date] est annulée
- **Corps** :

  > Bonjour Prénom,
  >
  > La formation [intitulé] du [date] est annulée, et votre mission avec elle.
  >
  > La lettre de mission, que vous n'aviez pas encore signée, est annulée.

- **Bouton** : aucun

## F32 — Mission en attente d'un élément

- **Gabarit** : `formateur-mission-en-attente`
- **Envoyé quand** : une lettre ne peut pas partir à cause d'une pièce manquante (une seule fois, sauf si le motif change).

- **Objet** : Votre mission : il nous manque un élément
- **Titre** : Votre mission : il nous manque un élément
- **Aperçu** : Pour vous confier cette mission, il nous manque :
- **Corps** :

  > Bonjour Prénom,
  >
  > Pour vous confier cette mission, il nous manque : [motif : attestation URSSAF à jour / numéro de déclaration d'activité / pièce à renvoyer].
  >
  > Déposez-le depuis votre espace : la lettre de mission partira aussitôt.

- **Bouton** : « Déposer depuis mon espace »

## F35 — Feuilles de présence manquantes

- **Gabarit** : `formateur-feuilles-manquantes`
- **Envoyé quand** : 3 jours après la dernière journée, s'il manque des signatures (c'est la 4e étape des rappels de contresignature existants).

- **Objet** : Il manque des signatures sur vos feuilles
- **Titre** : Il manque des signatures sur vos feuilles
- **Aperçu** : Il manque votre signature sur les feuilles de présence du [jour] ([N] demi-journée(s)).
- **Corps** :

  > Bonjour Prénom,
  >
  > Il manque votre signature sur les feuilles de présence du [jour] ([N] demi-journée(s)).
  >
  > Elle est nécessaire pour établir votre facture.
  >
  > Signez-les depuis votre espace, ou déposez la feuille papier signée.

- **Bouton** : « Signer mes feuilles »

## F48 — Désistement reçu

- **Gabarit** : `formateur-desistement-recu`
- **Envoyé quand** : le formateur clique « Je ne peux plus assurer cette mission » dans son espace.

- **Objet** : Votre désistement est enregistré
- **Titre** : Votre désistement est enregistré
- **Aperçu** : C'est noté pour la mission [intitulé] du [date].
- **Corps** :

  > Bonjour Prénom,
  >
  > C'est noté pour la mission [intitulé] du [date].
  >
  > Aucune pénalité n'est due, et vous n'avez rien d'autre à faire.
  >
  > Merci aussi pour la personne que vous nous avez indiquée : nous étudions cette piste et nous vous répondons.

- **Bouton** : aucun

### F48, deux variantes

Le texte ci-dessus est celui de la variante « avec remplaçant » (le formateur a indiqué une personne). Sans remplaçant, le dernier paragraphe n'est pas envoyé :

- **Variante sans remplaçant** :

  > Bonjour Prénom,
  >
  > C'est noté pour la mission [intitulé] du [date].
  >
  > Aucune pénalité n'est due, et vous n'avez rien d'autre à faire.

- **Bouton** : aucun

## F60 — Relevé de connexion à signer (formation à distance)

- **Gabarit** : `formateur-releve-connexion`
- **Envoyé quand** : une formation en visio est terminée et son relevé de connexion est prêt ; relance 3 jours après.

### F60 — envoi

- **Objet** : Votre relevé de connexion est à signer
- **Titre** : Votre relevé de connexion est à signer
- **Aperçu** : Le relevé de connexion de la formation [intitulé] est prêt.
- **Corps** :

  > Bonjour Prénom,
  >
  > Le relevé de connexion de la formation [intitulé] est prêt.
  >
  > Relisez-le et signez-le depuis votre espace : une minute suffit.
  >
  > Il garde la trace des connexions ; il ne remplace pas vos feuilles de présence.

- **Bouton** : « Signer le relevé »

### F60 — Relance (J+3)

- **Objet** : Le relevé de connexion attend votre signature
- **Titre** : Le relevé de connexion attend votre signature
- **Aperçu** : Le relevé de connexion de la formation [intitulé] attend encore votre signature.
- **Corps** :

  > Bonjour Prénom,
  >
  > Le relevé de connexion de la formation [intitulé] attend encore votre signature.

- **Bouton** : « Signer le relevé »

## F37 — Virement effectué

- **Gabarit** : `formateur-virement-fait`
- **Envoyé quand** : vous cliquez « Virements faits ».

- **Objet** : Virement effectué : facture n° [numéro]
- **Titre** : Virement effectué : facture n° [numéro]
- **Aperçu** : Le virement de [montant] € pour la facture n° [numéro] est parti le [date].
- **Corps** :

  > Bonjour Prénom,
  >
  > Le virement de [montant] € pour la facture n° [numéro] est parti le [date].
  >
  > Le délai d'arrivée sur votre compte dépend de votre banque.

- **Bouton** : aucun

## F38 — Virement en attente de l'attestation URSSAF

- **Gabarit** : `formateur-virement-en-attente`
- **Envoyé quand** : une facture est due mais l'attestation URSSAF est échue (une fois par facture).

- **Objet** : Virement en attente : attestation URSSAF
- **Titre** : Virement en attente : attestation URSSAF
- **Aperçu** : Votre facture n° [numéro] est due, et son virement attend votre attestation URSSAF à jour.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre facture n° [numéro] est due, et son virement attend votre attestation URSSAF à jour.
  >
  > Déposez-la depuis votre espace : le virement partira ensuite.
  >
  > Elle se télécharge sur urssaf.fr.

- **Bouton** : « Déposer mon attestation »

## F39 — Facture rectifiée

- **Gabarit** : `formateur-facture-rectifiee`
- **Envoyé quand** : vous acceptez un désaccord (avoir, puis nouvelle facture).

- **Objet** : Facture n° [numéro] corrigée
- **Titre** : Facture n° [numéro] corrigée
- **Aperçu** : Suite à votre remarque, la facture n° [numéro] est corrigée.
- **Corps** :

  > Bonjour Prénom,
  >
  > Suite à votre remarque, la facture n° [numéro] est corrigée.
  >
  > Elle est annulée par l'avoir n° [numéro], et la facture rectifiée n° [numéro] est jointe.

- **Bouton** : aucun

## F54 — Montant versé en trop

- **Gabarit** : `formateur-trop-percu`
- **Envoyé quand** : une correction a fait apparaître un trop-versé et le formateur n'a pas de relevé suivant dans les 60 jours (une fois par avoir).

- **Objet** : Une régularisation sur vos honoraires
- **Titre** : Une régularisation sur vos honoraires
- **Aperçu** : Une correction de la facture n° [numéro] (avoir n° [numéro]) montre que nous vous avons versé [montant] € de trop.
- **Corps** :

  > Bonjour Prénom,
  >
  > Une correction de la facture n° [numéro] (avoir n° [numéro]) montre que nous vous avons versé [montant] € de trop.
  >
  > Ce montant n'a pas pu être déduit d'une prochaine facture.
  >
  > Pourriez-vous nous le rembourser par virement, sur le compte ci-dessous ? Pour en parler, répondez simplement à ce message.
  >
  > [coordonnées bancaires d'Axion]
  >
  > Nous ne retenons jamais rien sur une autre mission sans votre accord écrit.

- **Bouton** : aucun

## F56 — Facture déposée bien reçue

- **Gabarit** : `formateur-facture-deposee`
- **Envoyé quand** : un formateur sans autofacturation (ou qui l'a révoquée) dépose sa propre facture dans son espace.

- **Objet** : Votre facture n° [numéro] est bien reçue
- **Titre** : Votre facture n° [numéro] est bien reçue
- **Aperçu** : Votre facture n° [numéro] est bien reçue, merci.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre facture n° [numéro] est bien reçue, merci.
  >
  > Nous relisons ses mentions. La date limite de paiement ne change pas : [date].

- **Bouton** : aucun

## F58 — Désaccord bien reçu

- **Gabarit** : `formateur-desaccord-recu`
- **Envoyé quand** : le formateur clique « Signaler un désaccord » sur une facture.

- **Objet** : Votre désaccord est bien reçu
- **Titre** : Votre désaccord est bien reçu
- **Aperçu** : Votre message du [date] sur la facture n° [numéro] est bien reçu.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre message du [date] sur la facture n° [numéro] est bien reçu.
  >
  > Nous l'examinons, et nous vous répondons par écrit.

- **Bouton** : aucun

## F59 — Désaccord non retenu (vous décidez)

- **Gabarit** : `formateur-desaccord-non-retenu`
- **Envoyé quand** : vous clôturez un désaccord sans suite, après aperçu. Le motif est celui que vous écrivez.

- **Objet** : Réponse à votre désaccord
- **Titre** : Réponse à votre désaccord
- **Aperçu** : Nous avons examiné votre message du [date].
- **Corps** :

  > Bonjour Prénom,
  >
  > Nous avons examiné votre message du [date].
  >
  > La facture n° [numéro] ne change pas, pour la raison suivante : [motif écrit par vous].
  >
  > Vous pensez toujours qu'elle est inexacte ? Répondez à ce message : nous la regarderons avec vous.

- **Bouton** : aucun

## F40 — Attestation URSSAF (3 variantes)

- **Gabarit** : `formateur-vigilance`
- **Envoyé quand** : à la signature du contrat ; avant l'échéance (15 jours avant, puis tous les 15 jours, 3 fois au plus) ; tout de suite si elle expire dans les 7 jours avant une formation.

### F40 — à la signature

- **Objet** : Votre attestation de vigilance URSSAF
- **Titre** : Votre attestation de vigilance URSSAF
- **Aperçu** : Pour vous confier des missions, nous avons besoin de votre attestation de vigilance URSSAF, datée de moins de 6 mois.
- **Corps** :

  > Bonjour Prénom,
  >
  > Pour vous confier des missions, nous avons besoin de votre attestation de vigilance URSSAF, datée de moins de 6 mois.
  >
  > Elle se télécharge en quelques minutes sur urssaf.fr. Déposez-la ensuite depuis votre espace.

- **Bouton** : « Déposer mon attestation »

### F40 — avant l'échéance

- **Objet** : Votre attestation URSSAF arrive à échéance
- **Titre** : Votre attestation URSSAF arrive à échéance
- **Aperçu** : Pensez à déposer la nouvelle depuis votre espace.
- **Corps** :

  > Bonjour Prénom,
  >
  > Pensez à déposer la nouvelle depuis votre espace.
  >
  > Elle se télécharge sur urssaf.fr, et elle est nécessaire pour vous confier de nouvelles missions.

- **Bouton** : « Déposer mon attestation »

### F40 — avant une formation

- **Objet** : Votre attestation URSSAF est à renouveler
- **Titre** : Votre attestation URSSAF est à renouveler
- **Aperçu** : Votre attestation URSSAF expire avant la formation du [date].
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre attestation URSSAF expire avant la formation du [date].
  >
  > Déposez la nouvelle depuis votre espace : sans elle, nous ne pouvons pas maintenir la mission.

- **Bouton** : « Déposer mon attestation »

## F41 — Autres pièces à renouveler (3 variantes)

- **Gabarit** : `formateur-piece-a-renouveler`
- **Envoyé quand** : 30 jours puis 15 jours avant l'échéance d'une pièce (CV de plus de 24 mois, assurance RC pro, numéro de déclaration d'activité) ; ou quand vous refusez une pièce, avec un motif de la liste.

### F41 — envoi

- **Objet** : Une pièce de votre dossier est à renouveler
- **Titre** : Une pièce de votre dossier est à renouveler
- **Aperçu** : Pour garder votre dossier à jour, déposez [la pièce] depuis votre espace avant le [date].
- **Corps** :

  > Bonjour Prénom,
  >
  > Pour garder votre dossier à jour, déposez [la pièce] depuis votre espace avant le [date].

- **Bouton** : « Déposer ma pièce »

### F41 — Relance (15 jours avant)

- **Objet** : Rappel : une pièce à renouveler
- **Titre** : Rappel : une pièce à renouveler
- **Aperçu** : Il reste [N] jours pour déposer votre nouvelle pièce depuis votre espace.
- **Corps** :

  > Bonjour Prénom,
  >
  > Il reste [N] jours pour déposer votre nouvelle pièce depuis votre espace.

- **Bouton** : « Déposer ma pièce »

### F41 — Pièce refusée

- **Objet** : Une pièce est à renvoyer
- **Titre** : Une pièce est à renvoyer
- **Aperçu** : La pièce déposée n'a pas pu être retenue :
- **Corps** :

  > Bonjour Prénom,
  >
  > La pièce déposée n'a pas pu être retenue : [motif : illisible / périmée / ne correspond pas à votre nom / incomplète].
  >
  > Déposez-en une nouvelle depuis votre espace.

- **Bouton** : « Déposer ma pièce »

## F42 — Pièce déposée (message interne, pour vous seul)

- **Gabarit** : `formateur-piece-deposee` — message interne, pour Will seul (texte inchangé)
- **Envoyé quand** : un formateur dépose une pièce.

- **Objet** : Pièce déposée par un formateur
- **Titre** : Pièce déposée par un formateur
- **Aperçu** : Pièce déposée · [identifiant court] · [type de pièce] · [lien console]
- **Corps** :

  > Bonjour Prénom,
  >
  > Pièce déposée · [identifiant court] · [type de pièce] · [lien console]

- **Bouton** : aucun

## F43 — Demande de changement de compte bancaire

- **Gabarit** : `formateur-iban-changement`
- **Envoyé quand** : le formateur demande à changer d'IBAN. Part à l'ancienne **et** à la nouvelle adresse e-mail s'il a aussi changé d'adresse. Ne contient jamais l'IBAN, même en partie.

- **Objet** : Changement de vos coordonnées bancaires
- **Titre** : Changement de vos coordonnées bancaires
- **Aperçu** : Nous avons reçu le [date] une demande de modification de vos coordonnées bancaires.
- **Corps** :

  > Bonjour Prénom,
  >
  > Nous avons reçu le [date] une demande de modification de vos coordonnées bancaires.
  >
  > Elle sera prise en compte après vérification, au plus tôt dans 48 heures. En attendant, vos virements continuent sur l'ancien compte.
  >
  > Vous n'êtes pas à l'origine de cette demande ? Répondez immédiatement à ce message.

- **Bouton** : aucun

## F44 — Changement validé

- **Gabarit** : `formateur-iban-valide`
- **Envoyé quand** : vous validez un changement (adresse, régime de TVA, compte bancaire).

- **Objet** : La modification de [nature] est enregistrée
- **Titre** : La modification de [nature] est enregistrée
- **Aperçu** : La modification de [nature :
- **Corps** :

  > Bonjour Prénom,
  >
  > La modification de [nature : votre adresse / votre régime de TVA / votre compte bancaire] est enregistrée à compter du [date].

- **Bouton** : aucun

## F46 — Fin de l'autofacturation (le formateur révoque le mandat)

- **Gabarit** : `formateur-fin-autofacturation`
- **Envoyé quand** : le formateur révoque le mandat qui nous permet d'établir ses factures. Préavis d'un mois, comme dans le contrat.

- **Objet** : Votre demande est enregistrée
- **Titre** : Votre demande est enregistrée
- **Aperçu** : Votre demande est enregistrée, merci.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre demande est enregistrée, merci.
  >
  > À compter du [date, un mois après], vous nous adresserez vos propres factures, à déposer dans votre espace.
  >
  > Les factures déjà établies à votre nom restent valables, et la date limite de paiement ne change pas.

- **Bouton** : aucun

## F47 — Fin de collaboration (aucun envoi en cas de décès)

- **Gabarit** : `formateur-fin-collaboration`
- **Envoyé quand** : vous mettez fin à la collaboration, après aperçu. Motif choisi dans une liste fermée. Cet e-mail passe même après la fin, comme les e-mails d'argent. Pas de bouton « Ouvrir mon espace ».

- **Objet** : Fin de notre collaboration
- **Titre** : Fin de notre collaboration
- **Aperçu** : Notre collaboration prend fin à compter du [date], [motif :
- **Corps** :

  > Bonjour Prénom,
  >
  > Notre collaboration prend fin à compter du [date], [motif : à votre demande / à notre demande, avec un préavis de [30/60/90] jours / entreprise ou numéro de déclaration devenus caducs / manquement grave].
  >
  > Les missions déjà acceptées sont menées à terme et payées selon votre contrat.
  > Les journées déjà réalisées vous sont payées selon votre contrat ; les missions qui n'ont pas commencé sont retirées.
  >
  > Vos relevés et vos factures vous parviendront par e-mail.
  >
  > Pour les consulter, vous pouvez aussi retrouver votre espace avec votre adresse habituelle.

- **Bouton** : aucun

## F49 — Avertissement avant une fin pour manquement grave

- **Gabarit** : `formateur-avertissement`
- **Envoyé quand** : au moins 8 jours avant toute fin pour manquement, sauf manquement qui ne peut pas être réparé (article 30.4 de votre contrat). Après aperçu et sur décision de vous seul.

- **Objet** : Un point important sur notre collaboration
- **Titre** : Un point important sur notre collaboration
- **Aperçu** : Nous avons constaté ce qui suit :
- **Corps** :

  > Bonjour Prénom,
  >
  > Nous avons constaté ce qui suit : [fait précis, écrit par Will].
  >
  > Merci de nous répondre ou de régulariser la situation d'ici 8 jours, soit avant le [date].
  >
  > Passé ce délai, sans réponse ou sans régularisation, nous pourrons mettre fin à notre collaboration sans préavis, comme le prévoit l'article 30.4 de votre contrat.
  >
  > Pour en parler, répondez simplement à ce message.

- **Bouton** : aucun

## F57 — Dossier à jour

- **Gabarit** : `formateur-dossier-a-jour`
- **Envoyé quand** : un blocage est levé (attestation ou pièce de nouveau valable). Une seule fois par épisode.

- **Objet** : Votre dossier est à jour
- **Titre** : Votre dossier est à jour
- **Aperçu** : Votre dossier est de nouveau à jour, merci.
- **Corps** :

  > Bonjour Prénom,
  >
  > Votre dossier est de nouveau à jour, merci.
  >
  > De nouvelles missions peuvent vous être proposées. Rien d'autre à faire de votre part.

- **Bouton** : aucun
