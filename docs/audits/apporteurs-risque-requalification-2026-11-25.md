# Réseau d'apporteurs d'affaires : audit du risque de requalification

**Date : 25 novembre 2026. État audité : `origin/main` au commit `3151c61a1`, plus les branches
`feat/apporteurs-rdv-lot1-donnees` et `feat/apporteurs-rdv-lot7a-gabarits`.**

> **Je ne suis pas avocat.** Ce rapport est une lecture juridique du produit (contrat, textes, écrans,
> règles codées) par un auditeur. Il ne remplace pas une consultation. Il ne dit rien de la pratique
> réelle (appels, messages hors système, ce qui est dit en visio), que seul un juge apprécierait et que
> je n'ai pas pu observer. Les références de jurisprudence sont classées plus bas en « certaine » ou
> « à vérifier » : aucune ne doit être citée à un tiers sans relecture par un avocat.

Aucun code n'a été produit ni modifié. Ce document est le seul fichier ajouté.

## Sommaire

1. Verdict en dix lignes
2. Méthode et périmètre
3. Constats (bloquants, importants, mineurs)
4. Les règles nouvelles (60 jours, rendez-vous tenu, 6 mois, 100 % payé)
5. Indices d'indépendance déjà présents, à conserver
6. Textes et jurisprudences, avec le degré de certitude
7. Dossier de preuves : ce qui est journalisé, ce qui manque
8. Questions à poser à l'avocat
9. Résumé d'une page pour le dirigeant
10. Ce que je n'ai pas pu vérifier

---

## 1. Verdict en dix lignes

- **Le contrat en service (version 2.6) est solide sur l'indépendance.** Il écarte objectifs, quotas,
  comptes rendus, exclusivité, mandat, pouvoir de négocier ; il interdit à la Société de fonder une
  décision sur le volume ou le rythme. Peu de contrats d'apport sont aussi explicites.
- **Après signature, le produit ne pilote pas l'activité.** Aucun e-mail de relance d'activité, aucun
  compteur, classement ou objectif affiché à l'apporteur. Les seules relances visent le dossier avant
  signature et l'attestation URSSAF.
- **Le risque « contrat de travail » vient de l'entrée dans le réseau, pas de la vie du contrat.** Le
  parcours d'entrée parle de « poste », de « candidature », demande dix ans de parcours, la
  disponibilité, la zone et les déplacements ; les fiches sont rangées sous « recrutement » ; une offre
  « carrières » décrit un commercial terrain ; des personnes qui ont postulé à un emploi salarié se
  voient proposer le statut indépendant.
- **Le risque « sanction et rupture » vient de l'outil, qui fait moins bien que le contrat.** La console
  résilie à effet immédiat, sans préavis, sans écrit, sans trace ; elle permet de « retirer du réseau »
  un apporteur sous contrat sans motif ni message ; elle applique un « manquement » avant toute réponse
  de l'apporteur.
- **Le risque « Axion décide seule si la commission est due » est réel sur six points** : la prestation
  « marquée réalisée » par Axion, le paiement à 100 % sans délai butoir, la reprise pour geste
  commercial ou faute d'Axion, la suspension sans terme, le refus d'une déclaration sans pièce, et
  surtout la règle nouvelle du « rendez-vous tenu, constaté par Axion ».
- **Le risque « agent commercial » est contenu, pas nul.** L'absence de pouvoir de fixer les prix ne
  suffit plus depuis 2020 ; ce qui protège est l'absence de mission permanente. L'article 22 bis et les
  outils de communication (bannière de profil, signature d'e-mail au logo) tirent dans le mauvais sens.

Décompte : **7 bloquants, 31 importants, 22 mineurs.**

---

## 2. Méthode et périmètre

**Lu par moi, en entier, ligne par ligne :** le contrat en service
(`src/features/apporteurs-reseau/contrat-v2.ts`, 1 280 lignes, version 2.6) et la charte de marque
(`src/features/apporteurs-reseau/charte-de-marque-html.ts`, six pages).

**Lu en entier par cinq lectures déléguées, une par zone, puis recoupé par moi :** pages publiques et
contenus de recrutement ; tous les gabarits d'e-mails et leur déclenchement ; tous les écrans de
l'espace apporteur ; la console d'administration et le schéma de données ; les règles codées
(présentations, commissions, facturation, litige, reprise, hors grille, parrainage). Chaque lecture a
rendu la liste des fichiers lus en entier et de ceux seulement survolés ; cette liste est reprise en
section 10.

**Recoupement.** J'ai revérifié moi-même dans le code une soixantaine de citations, dont toutes celles
des constats bloquants. Deux affirmations des lectures déléguées ont été corrigées à cette occasion
(la bascule automatique des candidatures salariées, retirée le 26 octobre 2026 ; le message du retrait,
qui rappelle bien le préavis à l'administrateur). Les citations que je n'ai pas revérifiées une à une
restent exposées à une erreur de numéro de ligne.

**Branches demandées.** Deux existent sur `origin` et ont été lues : `feat/apporteurs-rdv-lot1-donnees`
et `feat/apporteurs-rdv-lot7a-gabarits`. Quatre n'existent pas : `feat/apporteurs-rdv-lot2-regles`,
`feat/apporteurs-espace-documents`, `feat/apporteurs-documents-joints`, `feat/apporteurs-espace-aide`.

**Abréviations de chemins.**

- `AR/` = `src/features/apporteurs-reseau/`
- `TPL/` = `src/lib/email/templates/`
- `ESP/` = `src/app/apporteur/dossier/[id]/[jeton]/`
- `ADM/` = `src/components/admin/`

**Risques.** (a) contrat de travail ; (b) agent commercial ; (c) déséquilibre significatif ou condition
potestative.

**Gravité.** Bloquant : à corriger avant d'étendre le réseau ou avant de mettre la règle en service.
Important : à corriger dans les semaines qui viennent. Mineur : à corriger au fil de l'eau.

---

## 3. Constats

### 3.1 Bloquants

#### B1. La résiliation est exécutée sans préavis, sans écrit et sans trace (c ; a, rupture discrétionnaire)

- `AR/resiliation.ts:76` : `data: { statut: "resilie", resilieAt: maintenant, versionLien: { increment: 1 } },`
- `AR/resiliation.ts:48-53` : le terme de chaque attribution est ramené à `maintenant`.
- `ADM/apporteurs/fiche/FinDeVieEtVigilance.tsx:158` : une seule case, « Je confirme la résiliation de
  ce contrat. »
- Aucun e-mail : la liste des gabarits de `AR/envois.ts` n'en contient pas pour la résiliation. Aucune
  écriture au journal dans `AR/resiliation.ts` ; la fonction ne reçoit même pas l'identité de
  l'administrateur (`AR/actions-commissions.ts:113`).
- Le contrat dit l'inverse : `AR/contrat-v2.ts:796-797` « par écrit et sans avoir à motiver sa décision,
  moyennant un préavis de **30 jours » ; `:802` « Pendant le préavis, le contrat continue de produire
  ses effets : l'Apporteur peut déclarer de nouvelles entreprises ».

**Risque.** L'outil commet la rupture brutale que le contrat interdit (article L.442-1, II du code de
commerce) et ne laisse aucune preuve de la notification. Une rupture sans forme ni délai est aussi ce
qu'un salarié décrirait comme un licenciement de fait.

**Correctif.** Le geste « Résilier » demande trois champs obligatoires :

> Fondement : article 11.1 (préavis de 30 jours) / article 11.2 (inexécution, après mise en demeure) /
> article 12.5 (cessation ou radiation). Date de la notification écrite. Date d'effet.

La date d'effet vaut notification + 30 jours en 11.1 et ne peut pas être avancée. Le lien et les
attributions ne sont coupés qu'à la date d'effet. L'auteur, le fondement et les dates sont journalisés
dans la même transaction. L'apporteur reçoit ce message :

> Nous vous notifions la résiliation de votre contrat d'apporteur d'affaires, conformément à son
> article 11.1. Elle prendra effet le {date}. Jusqu'à cette date, vous pouvez continuer à nous présenter
> des entreprises. Les commandes signées avant cette date par les entreprises qui vous sont attribuées
> restent commissionnées (article 12.3), et vos commissions acquises vous seront facturées et versées
> normalement (article 12.2).

#### B2. « Retirer du réseau » écarte un apporteur sous contrat, sans motif, sans message, sans durée (a, pouvoir de sanction ; c)

- `AR/retrait.ts:73` : `await tx.apporteurReseauRetrait.create({ data: { apporteurId, retirePar: adminId } });`
  Le modèle ne porte aucun champ de motif.
- `AR/retrait.ts:92` (message rendu à l'administrateur) : « Fiche retirée du réseau et lien du dossier
  désactivé. Le contrat N'EST PAS résilié : pour y mettre fin, utilisez « Résilier le contrat » (préavis
  de 30 jours, art. 11.1). Les commissions dues restent dues. »
- Effets pour l'apporteur : il ne peut plus déclarer ni télécharger son contrat ; tous les e-mails hors
  argent sont coupés. Il lit seulement (`ESP/textes.ts:123`) : « Votre fiche n'est plus active dans le
  réseau. »
- Le contrat ne connaît qu'une suspension notifiée, motivée, bornée à quinze jours et « sans effet […]
  sur l'accès de l'Apporteur à son espace » (`AR/contrat-v2.ts:336-345`).

**Risque.** Mise à l'écart de fait, hors contrat, sans limite de temps. Lue avec l'article 2.2 (aucune
conséquence attachée à l'inactivité ou au volume), c'est exactement la mesure discrétionnaire que le
contrat promet de ne jamais prendre.

**Correctif.** Refuser le retrait quand le contrat est signé, avec ce message :

> Contrat en cours : le retrait n'est pas possible. Pour mettre fin au contrat, utilisez « Résilier le
> contrat » (article 11).

Pour un dossier non signé, renommer le bouton « Classer le dossier (non signé) ». Conserver la règle
qui maintient l'accès tant que de l'argent est dû (`AR/retrait.ts:288-299`).

#### B3. La commission dépend d'un geste d'Axion, sans délai : « prestation marquée réalisée » (c, article 1304-2 du code civil)

- `AR/realisation.ts:3-4` : « AUCUNE commission n'est facturée (autofacture) ni versée (« Virement
  fait ») avant que la prestation soit marquée réalisée. »
- Hors formation avec session terminée, la réalisation est un bouton de la console. Aucun délai,
  aucune alerte « payée à 100 %, non marquée réalisée ». L'annulation du marquage n'exige aucun motif
  (`AR/realisation.ts:104-139`).
- Le contrat aggrave : `AR/contrat-v2.ts:406-408` « Lorsque la prestation n'est pas réalisée, en tout ou
  partie, quelle qu'en soit la cause, y compris du fait de la Société, la commission n'est pas due ».

**Risque.** L'obligation de payer dépend d'un fait que le débiteur maîtrise seul (réaliser, puis
constater). Le garde-fou de l'article 1.3 (bonne foi) et le renvoi à l'article 1304-3 ne visent que le
cas où Axion agit « dans le seul but » de priver l'apporteur, preuve quasi impossible à rapporter.

**Correctif du contrat (article 4.2, deuxième alinéa), mot pour mot :**

> Lorsque la prestation n'est pas réalisée, en tout ou partie, pour une cause qui tient au client ou à
> un cas de force majeure, la commission n'est due qu'à proportion de la part réalisée et encaissée.
> Lorsqu'elle n'est pas réalisée du fait de la Société alors que le prix a été encaissé et conservé, la
> commission reste due sur les sommes conservées. Pour l'application du présent article, la prestation
> est réputée réalisée au plus tard quatre-vingt-dix jours après l'encaissement intégral, sauf report
> demandé par écrit par le client, dont la Société justifie sur demande.

**Correctif du code.** Marquage d'office à l'échéance de ce délai, sauf opposition motivée, journalisée
et notifiée à l'apporteur. Motif obligatoire pour annuler un marquage.

#### B4. Règle nouvelle : « validée au premier rendez-vous tenu, constaté par Axion » (c, article 1304-2 ; conception)

Détail et rédaction de remplacement en section 4. En l'état des branches, c'est Axion qui prend ou non
le rendez-vous, le tient ou non, et décide s'il compte. La branche lot 1 prévoit qu'un rendez-vous est
« proposé à Williams qui le retient ou l'écarte », sans colonne pour le motif de l'écartement. La règle
supprime en outre le meilleur garde-fou actuel : le silence d'Axion vaut aujourd'hui confirmation.

#### B5. Le formulaire d'entrée est un formulaire d'embauche (a)

Fichier `src/components/forms/commercial-application/steps.tsx`, servi à l'adresse publique
`/devenir-commercial-ia/candidature`.

| Ligne | Citation exacte                                                                                                           | Correctif mot pour mot                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 233   | « Ce poste demande une vraie expérience de la vente B2B. C’est le seul prérequis, mais il est indispensable. »            | « Aucune expérience n'est exigée. Ces réponses nous aident seulement à préparer notre échange. »    |
| 300   | « Le profil recherché est vraiment orienté vente B2B. Vous pouvez quand même envoyer votre candidature, nous la lirons. » | Supprimer le paragraphe.                                                                            |
| 213   | « J’accepte que mes informations soient utilisées pour l’étude de ma candidature. »                                       | « J’accepte que mes informations soient utilisées pour l’étude de ma demande d’apport d’affaires. » |
| 139   | « Date de naissance »                                                                                                     | Supprimer le champ (et « Nationalité »).                                                            |
| 687   | « Sur quelle zone souhaitez-vous travailler ? »                                                                           | Supprimer. À défaut : « Où se trouvent les dirigeants que vous connaissez ? (facultatif) »          |
| 771   | « Êtes-vous prêt à vous déplacer chez les clients ? »                                                                     | Supprimer la question et son caractère obligatoire.                                                 |
| 878   | « À partir de quand êtes-vous disponible ? »                                                                              | Supprimer.                                                                                          |

Dans `CommercialApplicationWizard.tsx:462` : « Êtes-vous sûr d’avoir indiqué TOUTES vos expériences
professionnelles des 10 dernières années ? » Le parcours professionnel est obligatoire, alors que la
page promet « sans CV ».

**Risque.** Poste, prérequis, profil recherché, parcours sur dix ans, zone de travail, déplacements,
disponibilité : c'est la sélection d'un salarié. Zone et visites de clients sont aussi des marqueurs
du représentant ou de l'agent.

**Correctif.** Ramener le formulaire à l'identité, aux coordonnées et à une question facultative
« Quelques mots sur vous ». Supprimer l'écran du parcours. Changer l'adresse pour
`/apporteur-affaires/dossier` avec redirection permanente. Renommer les boutons « J’envoie mon
dossier » et l'écran final « Dossier envoyé ».

#### B6. Une offre « carrières » décrit l'apporteur comme un commercial terrain (a, b)

- `careers-gen/business-developer-ia.json` (titre) : « Commercial·e terrain B2B — solutions &
  interventions IA » ; corps : « Ton job : aller sur le terrain, rencontrer les dirigeants » ; « Tes
  missions » ; « Pourquoi nous rejoindre » ; « Recrutement ouvert à toutes et tous, sans
  discrimination. » Le texte tutoie, parle de pipeline, de zone, de rendez-vous de découverte, de
  négociation, de tenue d'un outil de suivi et de permis de conduire requis.
- `scripts/seed-careers-offers.ts:55-57` précise que ce « Commercial·e terrain B2B » « est un apporteur
  d'affaires, pas un CDI ».

**Risque.** Une offre d'emploi qui décrit des missions, une zone, une méthode et un outil, pour un
statut indépendant à la commission, est la pièce que produirait un demandeur. Elle contredit tout le
reste du site (« Vous n’êtes ni vendeur ni expert en IA »).

**Correctif.** Retirer l'offre des carrières et rediriger son adresse vers la page des apporteurs. Je
n'ai pas pu vérifier si elle est publiée en production (elle vit en base).

#### B7. La trame de l'échange installe une non-concurrence de fait, que le contrat exclut (a, c ; bloquant si elle est appliquée)

Fichier `docs/imprimes/trame-echange-apporteur.html` (document interne, productible en justice).

- `:244` : « Oui, aucune exclusivité. Seule limite de bon sens : ne pas recommander en même temps un
  concurrent direct sur les mêmes prestations IA. »
- `:272` (critères éliminatoires) : « Apporte déjà pour un concurrent direct sur les mêmes prestations
  IA, sans vouloir y renoncer. »
- Le contrat dit : `AR/contrat-v2.ts:100-101` « L'Apporteur demeure libre d'exercer toute autre
  activité, y compris auprès d'entreprises concurrentes ».

**Correctif.** Supprimer les lignes 272 et 358. Remplacer la ligne 244 par :

> Oui, aucune exclusivité, y compris pour des prestations comparables.

### 3.2 Importants

#### Entrée dans le réseau

**I1. Le statut indépendant est proposé à des personnes qui ont postulé à un emploi salarié (a).**

- `TPL/apporteur-invitation-appel.tsx:142` : « En parallèle de nos recrutements, nous développons un
  réseau d'apporteurs d'affaires indépendants partout en France, et votre profil commercial nous a donné
  envie de vous le proposer. » ; `:152` : « nous n'avons pas de besoin immédiat sur ce poste. »
- `src/server/careers/proposer-reseau-auto.ts:7-8` (commentaire) : « postuler au poste d'apporteur
  d'affaires indépendant ».
- `src/features/admin-job-applications/fiche-apporteur-depuis-candidature.ts:1` : « FICHE APPORTEUR NÉE
  D'UNE CANDIDATURE À UNE OFFRE D'EMPLOI ».
- État réel : l'envoi automatique a été retiré le 26 octobre 2026
  (`src/features/commercial-application/invitation-auto.ts:146-148` : « une candidature à une offre
  d'emploi n'ouvre PLUS jamais le tunnel apporteur toute seule »). Le bouton « Proposer le réseau » de
  la console et les deux variantes de texte subsistent.

**Risque.** Remplacer un emploi par un contrat à la commission, pour une personne qui cherchait un
emploi, est l'indice le plus classique du faux indépendant. Devient bloquant si le bouton est utilisé
pour des candidats à un poste salarié sans activité indépendante préexistante.

**Correctif.** Supprimer la variante « poste pourvu ». Pour l'autre, remplacer la ligne 142 par :

> Votre candidature à notre offre suit son cours, indépendamment de ce message. Par ailleurs, Axion-IA
> travaille avec des apporteurs d'affaires : des professionnels indépendants, déjà immatriculés, qui
> nous mettent librement en relation avec des entreprises et perçoivent une commission. Ce n'est ni un
> emploi ni une alternative au poste auquel vous avez postulé. Si vous exercez déjà une activité
> indépendante et que le sujet vous intéresse, nous pouvons en parler 15 minutes.

Supprimer le lien technique entre la candidature à l'emploi et la fiche d'apporteur.

**I2. Les fiches d'apporteurs sont rangées sous « recrutement » et « candidature » (a).**

- `src/lib/commercial-application/est-apporteur.ts:30` : `const UNIFIED_TYPE_RECRUTEMENT = "recrutement";`
  et sous-type `"candidature-commerciale"`.
- Schéma de données : « la console du site recrute les apporteurs » ; « La candidature d'origine » ;
  décision d'échange `retenu / a_revoir / non_retenu`.
- Console : « fiche candidat », « candidats apporteurs », boutons « Retenu » et « Non retenu ».

**Correctif.** Nouvelles fiches typées `partenariat` / `demande-apporteur` (lecture tolérante des
anciennes valeurs). Libellés : « fiche de premier contact », « personne intéressée », « Contrat
proposé », « Sans suite », « À recontacter ».

**I3. Tous les e-mails d'avant contrat parlent de candidature retenue (a).**

| Fichier:ligne                                 | Citation exacte                                                                                                                                                             | Correctif mot pour mot                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TPL/apporteur-invitation-appel.tsx:118`      | « Votre candidature est retenue »                                                                                                                                           | « Faisons connaissance »                                                                                                                                   |
| idem `:122`                                   | « Nous avons étudié votre candidature au réseau d'apporteurs d'affaires d'Axion-IA : elle est retenue pour l'étape suivante, un échange de 15 minutes en visio avec nous. » | « Vous avez souhaité en savoir plus sur l'apport d'affaires avec Axion-IA. Nous vous proposons un échange de 15 minutes en visio. »                        |
| `TPL/apporteur-invitation-relance.tsx:48`     | « Dernier rappel : votre candidature apporteur »                                                                                                                            | « Dernier rappel : notre échange de 15 minutes »                                                                                                           |
| `TPL/lead-apporteur-relance.tsx:38`           | « Votre candidature d'apporteur : dernier rappel »                                                                                                                          | « Votre demande : dernier rappel »                                                                                                                         |
| `TPL/apporteur-issue-echange.tsx:86-87`       | « Bienvenue parmi les apporteurs d'Axion-IA » ; « Bienvenue dans le réseau »                                                                                                | « Suite à notre échange : votre contrat d'apporteur » ; « La suite, si vous le souhaitez »                                                                 |
| idem `:91`                                    | « Nous sommes ravis de vous accueillir dans le réseau d'apporteurs d'affaires indépendants d'Axion-IA. »                                                                    | « Merci pour notre échange. Si vous souhaitez nous présenter des entreprises en tant qu'apporteur d'affaires indépendant, voici comment cela fonctionne. » |
| `TPL/candidature-commercial-confirmee.tsx:55` | « elle sera lue avec attention — c'est promis, pas par un robot »                                                                                                           | Supprimer la phrase (l'invitation part par automate quinze minutes après un dossier complet).                                                              |

**I4. L'espace incite à créer une micro-entreprise pour entrer (a, renversement de la présomption).**

- `ESP/textes.ts:66` : « Si vous résidez en France : pour recevoir vos commissions, il vous faut un
  numéro SIREN. Le plus simple : créer une micro-entreprise. C'est gratuit et cela se fait en ligne, en
  une vingtaine de minutes, sur le site officiel ».
- Même idée dans `TPL/apporteur-issue-echange.tsx:105` (« une micro-entreprise, par exemple ») et
  `AR/regles.ts:143`.

**Risque.** Une immatriculation créée à l'initiative et pour les seuls besoins du donneur d'ordre est
un indice retenu pour renverser la présomption de non-salariat, et un indice de dépendance économique.

**Correctif (`ESP/textes.ts:66`) :**

> Ce contrat s'adresse aux professionnels déjà immatriculés (numéro SIRET actif). Si vous ne l'êtes
> pas, le choix de créer une entreprise, et de sa forme, vous appartient.

**I5. L'échange d'entrée est un entretien noté, avec mesure du temps envisagé (a).**

- `docs/imprimes/trame-echange-apporteur.html:127` : « À quoi ressemblerait une semaine où vous parlez
  d'Axion-IA ? Combien de temps pensez-vous y consacrer, à titre indicatif ? »
- `:348` : « Repère : 16 et plus = on continue… » (grille sur 20) ; critères éliminatoires `:266-275`.
- `ADM/contacts/IssueEchangeApporteurForm.tsx:171` : « Note d'échange /20 (facultatif) » (champ
  `noteSur20` en base, communicable à la personne au titre du droit d'accès).
- `src/lib/commercial-application/scoring.ts:5` : « profils qui ne vendront rien » (note sur 100).

**Correctif.** Remplacer la grille par la vérification de trois faits (activité immatriculée ou
prévue, rôle compris, aucune confusion avec un représentant). Supprimer la question du temps consacré
et le champ de note pour les apporteurs.

**I6. Les pages publiques émettent des mots-clés d'emploi (a).**
`src/content/recrutement/commercial-offer.ts:328-405` : « emploi commercial IA », « offre d'emploi
IA », « recrutement commercial », « embauche », « poste à pourvoir », « poste de commercial ».
`docs/tunnel-facebook-apporteurs.md:108` : « **Catégorie spéciale** : déclarer **Emploi**. »

**Correctif.** Liste de remplacement : « apporteur d'affaires », « apporteur d'affaires indépendant »,
« mise en relation dirigeants », « indépendant », « micro-entreprise ». Pour la régie publicitaire,
consigner par écrit que la catégorie choisie est une contrainte de la plateforme et ne qualifie pas la
relation.

#### Contrat

**I7. Le contrôle des communications dépasse la protection de la marque (a, directives et contrôle).**

- `AR/contrat-v2.ts:1001-1002` : « à condition de respecter la charte de marque remise par la Société
  (couleurs, typographies, logos, ton et règles de présentation) ».
- `:1010` : « Chaque communication est soignée et conforme à l'image de la Société. »
- `:1015-1017` : « **22 bis.4 — Contrôle de la Société.** La Société peut à tout moment demander la
  modification ou le retrait d'une communication qu'elle juge non conforme à sa charte ou à son image ;
  l'Apporteur s'exécute dans les quarante-huit heures, sans indemnité. »
- L'inexécution de l'article 22 bis ouvre la résiliation sans préavis (`:807-808`).

**Risque.** Protéger un logo est légitime. Imposer un ton à la parole de l'apporteur, en juger seul la
conformité à une « image » et exiger l'exécution sous 48 heures sous peine de résiliation, c'est
réunir directive, contrôle et sanction sur la manière d'exercer. Le titre « Contrôle de la Société »
et le verbe « s'exécute » seraient cités tels quels.

**Correctif, mot pour mot :**

> **22 bis.1 — Communication libre.** L'Apporteur communique librement sur son activité, sous son nom
> et par les moyens de son choix. Lorsqu'une communication reproduit la dénomination ou le logo de la
> Société, elle respecte les règles d'usage de la marque (formes, couleurs et zone de protection du
> logo) et les articles 8.2 et 8.3. Ces règles ne portent ni sur le ton, ni sur le contenu, ni sur la
> fréquence des communications de l'Apporteur.
>
> **22 bis.3 — Transparence.** Dans une communication qui cite la Société, l'Apporteur se présente
> comme apporteur d'affaires indépendant, n'annonce aucun prix, remise, délai, résultat ou financement
> (article 8.3) et n'affirme rien d'inexact sur la Société.
>
> **22 bis.4 — Protection de la marque.** Lorsqu'une communication reproduisant la dénomination ou le
> logo de la Société contrevient aux règles d'usage de la marque ou à l'article 8, la Société l'indique
> par écrit à l'Apporteur en désignant la règle concernée ; l'Apporteur la corrige ou la retire dans un
> délai de cinq jours ouvrés, ramené à quarante-huit heures en cas d'information inexacte ou d'atteinte
> manifeste à la marque.

**I8. Reprise de commission pour un geste commercial ou une faute d'Axion (c).**
`AR/contrat-v2.ts:458-460` : « y compris une restitution consentie sans réclamation du client, à titre
de geste commercial, ou résultant de l'inexécution par la Société de ses propres obligations ». Même
formule à l'acceptation : `AR/regles-dossier.ts:39`.

**Correctif (article 4.5), mot pour mot :**

> La commission ne fait l'objet d'une reprise que lorsque l'encaissement est restitué pour une cause
> qui ne tient pas à la Société. Un remboursement consenti à titre de geste commercial, au titre d'une
> garantie commerciale de la Société ou à raison de l'inexécution par la Société de ses propres
> obligations ne donne lieu à aucune reprise.

**I9. Paiement à 100 % : tout ou rien, sans délai butoir (c).**
`AR/contrat-v2.ts:415` : « Aucune part de commission n'est due au titre d'un paiement partiel. » Code :
`AR/commandes.ts:81` : `if (membres.length === 0 || membres.some((f) => f.statut !== "payee")) continue;`
Un client qui paie 99 %, ou un solde qu'Axion ne facture jamais, donne zéro commission pour toujours.

**Correctif (article 4.3), mot pour mot :**

> La commission est facturée et versée à l'encaissement intégral. À défaut d'encaissement intégral
> quatre-vingt-dix jours après l'échéance de la dernière facture de la commande, elle est due au
> prorata des sommes encaissées, le solde suivant les encaissements ultérieurs. Une remise de dette, un
> abandon de recouvrement ou un solde non facturé du fait de la Société valent encaissement pour le
> calcul de la commission.

**I10. Suspension pour contestation du client, sans terme (c).**
`AR/contrat-v2.ts:410-413` ; `AR/litige.ts:7` : « Aucun délai n'est promis, rien n'est effacé. » ;
`TPL/apporteur-demarrage.tsx:385` : « elle n'est ni facturée ni versée. »

**Correctif (à ajouter à l'article 4.2 bis) :**

> La suspension porte sur la seule part contestée. La Société informe l'Apporteur de son état tous les
> soixante jours. Au-delà de six mois sans procédure engagée par le client, la commission est versée,
> sous réserve de reprise dans les conditions de l'article 4.5.

**I11. Faisceau « agent commercial » (b).**
Le contrat écarte le mandat et le pouvoir de négocier (`AR/contrat-v2.ts:61-63`, `:71-76`). Trois
éléments tirent pourtant vers une mission permanente de développement de clientèle : la durée
indéterminée (article 10), le droit à commission sur toutes les commandes de l'entreprise pendant
l'attribution, y compris celles qui ne viennent pas de l'apporteur (`:297-299`), et l'article 22 bis
qui organise une promotion continue de la Société sous sa marque. Depuis 2020, l'absence de pouvoir de
modifier les prix ne suffit plus à écarter le statut (voir section 6).

**Correctif.** Garder la borne de l'attribution et son absence de reconduction. Rendre l'article
22 bis strictement facultatif et le réduire à l'usage de la marque (I7). Ne jamais demander à
l'apporteur d'être présent à un rendez-vous de vente (l'article 8.3 l'autorise « sur invitation
écrite » : à limiter à la demande de l'entreprise elle-même).

**I12. Qualification retenue par le contrat (b, c).**
`AR/contrat-v2.ts:71` : « Le présent contrat est un contrat d'entreprise de droit commun. » L'apport
d'affaires se rapproche plutôt du courtage. La qualification choisie n'est pas neutre (régime de la
rupture, de la rémunération). À faire trancher par l'avocat.

**I13. L'en-tête du fichier dit que le texte n'est pas validé.**
`AR/contrat-v2.ts:2-3` : « texte de travail, à valider par Will avant la première signature ». À
l'inverse `docs/contrat-apporteur-clauses.md` le dit « validé par Williams le 2026-10-05 ». Un fichier
de contrat en service ne doit pas porter la mention « texte de travail ».

#### Charte et outils de communication

**I14. La charte impose un ton à la parole de l'apporteur (a).** `AR/charte-de-marque-html.ts:8` :

- page 4 : « On vouvoie chaque lecteur, dans chaque message, même sur les réseaux sociaux. » ; « Pas de
  superlatifs, pas d'emoji en rafale, pas de majuscules criées. »
- page 6 : « Mention obligatoire, sur chaque communication » ; « 48 h […] pour modifier ou retirer une
  communication jugée non conforme, à la demande d'Axion-IA. »
- couverture : « Parler d'Axion-IA avec la même exigence que nous ».

**Correctif.** Bandeau en tête de charte :

> Cette charte ne s'applique qu'aux communications dans lesquelles vous utilisez le logo ou le nom
> d'Axion-IA. Vos autres communications, vos supports et votre façon de vous adresser à vos contacts
> restent les vôtres.

Page 4 : « Quand vous reprenez nos textes, gardez-les tels quels. Dans vos propres messages, vous
écrivez comme vous l'entendez, sans rien affirmer d'inexact sur Axion-IA. » Page 6 : aligner sur le
correctif I7 (cinq jours ouvrés, règle désignée par écrit).

**I15. Les outils sont présentés à l'impératif, jamais comme facultatifs (a, service organisé).**
`ESP/outils/page.tsx:55-57` : « Des pièces prêtes à l'emploi, conformes à la charte de marque :
téléchargez-les ou copiez-les, sans rien retoucher. »

**Correctif :**

> Ces pièces sont facultatives : vous restez libre de ne pas communiquer, ou de créer vos propres
> supports. Si vous utilisez ces pièces, gardez-les telles quelles : la mention « apporteur d'affaires
> indépendant » y figure déjà.

**I16. Signature d'e-mail au logo d'Axion, sans l'identité propre de l'apporteur (b, a).**
`AR/outils-communication.ts:185-197` : logo d'Axion sous le nom, ni dénomination ni numéro
d'immatriculation de l'apporteur ; l'aide la fait installer comme signature générale.

**Correctif.** Retirer le logo. Texte : « {Prénom Nom}, {dénomination ou entreprise individuelle}.
Apporteur d'affaires indépendant. Je n'ai pas le pouvoir d'engager Axion-IA. » Aide : « À utiliser
seulement pour vos messages qui concernent Axion-IA. »

**I17. Trois documents se contredisent sur le logo.** La fiche « comment ça marche » interdit le nom et
le logo sur les supports de l'apporteur ; la charte et les outils les lui remettent. Une règle
contradictoire s'interprète contre celui qui l'a rédigée. Aligner la fiche :

> Ne modifiez pas le logo d'Axion-IA et ne créez ni page ni compte à son nom.

#### E-mails pendant le contrat

**I18. « Manquement constaté » : sanction appliquée avant toute réponse (a, pouvoir de sanction ; c).**

- `TPL/apporteur-demarrage.tsx:349-355` : « Manquement constaté sur votre déclaration » ; « aucune
  commission n'est due au titre de cette affaire ».
- `ADM/apporteurs/entreprises/ActionsPresentation.tsx:89` : « Manquement ou fraude (art. 4.5 bis) ».
- `AR/manquement.ts:293-357` : dans le même geste, la présentation passe « démentie », les commissions
  non facturées sont annulées, les facturées retenues, les versées reprises ; la part du parrain suit.
  Aucune fonction ne lève un constat reconnu infondé.
- Points à garder : faits obligatoires, envoyés à l'apporteur, contestation ouverte.

**Correctif.** Deux temps : notifier les faits et **suspendre** ; décider après quinze jours ou après la
réponse. Prévoir « Lever (contestation fondée) », qui rétablit tout. Texte :

> Objet : Difficulté sur une entreprise que vous nous avez présentée.
> Nous estimons que les conditions de l'article 4.5 bis de votre contrat sont réunies, pour les faits
> suivants : {faits}. Vous disposez de quinze jours pour nous faire part de vos observations en
> répondant à cet e-mail. Pendant ce délai, les commissions liées à cette affaire sont suspendues. Nous
> vous écrirons ensuite notre décision motivée.

Libellés de console : « Déclaration non sincère (art. 4.5 bis) » au lieu de « Manquement ou fraude » ;
« Commissions non dues (art. 4.5 bis) » au lieu de « Retenues (manquement) ».

**I19. Refus d'une déclaration sur un critère non daté et non vérifiable (c).**
`TPL/apporteur-demarrage.tsx:203` : « elle est déjà cliente d'Axion-IA, ou elle a reçu un devis de
notre part récemment. » ; `:205` : « cette entreprise est déjà suivie par Axion-IA ». Le contrat, lui,
est précis (`AR/contrat-v2.ts:211-213` : facture de moins de vingt-quatre mois, devis de moins de six
mois). Le code n'exige aucune pièce : `AR/presentations.ts:13-14` « Les signalements (déjà présentée,
déjà cliente) ne sont qu'une INDICATION : Williams tranche. » Ni motif, ni auteur, ni date de décision
en base.

**Correctif du texte :**

> Nous ne pouvons pas vous la réserver : elle est cliente d'Axion-IA au titre d'une prestation facturée
> dans les vingt-quatre derniers mois, ou elle a reçu un devis de notre part dans les six derniers mois
> (article 3.3 de votre contrat). Sur simple demande, nous vous en communiquons la date. Vous pouvez
> contester ce refus par écrit : nous vous répondrons de façon motivée dans les trente jours.

**Correctif du code.** Le refus « déjà connue » n'est enregistré que si une antériorité existe dans les
données ; la pièce retenue (type, référence, date) et l'auteur sont journalisés.

**I20. « Nous avons décidé que ce produit n'est pas commissionné » (c).**
`TPL/apporteur-demarrage.tsx:371`. Aucune voie de contestation dans ce message. Et le filet du contrat
n'est pas appliqué : `AR/hors-grille.ts:16-17` « Ce module ne décide rien à la place de Williams », la
ligne reste en attente après soixante jours, alors que `AR/contrat-v2.ts:1206-1208` dit la commission
due à défaut de décision dans ce délai.

**Correctif.** Texte : remplacer par « nous constatons que ce produit n'entre dans aucune ligne de
votre grille » et ajouter « Vous pouvez contester cette constatation en répondant à cet e-mail : nous
vous répondrons de façon motivée dans les trente jours. » Code : passé soixante jours, refuser le
constat et qualifier d'office au taux de la grille publiée à la date de la vente.

**I21. Le démenti éteint une attribution d'un clic, sans la trace promise (c).**
`AR/presentations.ts:818-821` : `data: { statut: "dementie" },` sans date, auteur, ni termes, sans
e-mail ; la ligne disparaît de l'espace de l'apporteur (`AR/declaration-regles.ts:123`). Le contrat
promet (`AR/contrat-v2.ts:334`) : « La réponse de l'entreprise est journalisée avec sa date, la
personne qui l'a donnée, et ses termes ».

**Correctif.** Champs obligatoires (date de la réponse, personne, termes exacts), journal dans la même
transaction, geste réservé aux administrateurs, et message :

> L'entreprise {nom} nous a indiqué le {date} n'avoir eu aucun échange avec vous. L'attribution
> s'éteint (article 3.7). Vous pouvez nous écrire pour contester : nous vous répondrons de façon
> motivée dans les trente jours.

**I22. Promesse « au plus tard 30 jours » sans la réserve de l'adresse en erreur (c).**
`TPL/apporteur-demarrage.tsx:192`. Le délai ne court pas si le message rebondit, et rien ne prévient
l'apporteur, alors que `AR/contrat-v2.ts:203-204` l'exige. Ajouter : « Si notre message ne peut pas lui
être remis, nous vous le signalons pour que vous puissiez nous communiquer une adresse valide. »

#### Espace apporteur

**I23. Une seule case coche toutes les acceptations, et la preuve les enregistre « une par une » (c).**
`ESP/DossierEnLigne.tsx:332` : « Une case coche (ou décoche) d'un coup TOUTES les déclarations ou
TOUTES les acceptations ». Or `AR/contrat-v2.ts:899-905` affirme une acceptation « distincte et
spécialement signalée […] par une case distincte » pour la clause de compétence.

**Correctif.** Une case distincte au moins pour les articles 4.5 (reprise), 5.2 (mandat de facturation)
et 14 (compétence). À défaut, corriger le contrat pour qu'il décrive ce qui se passe réellement : une
affirmation fausse dans le texte signé affaiblit toute la convention de preuve.

**I24. Aucun accusé horodaté n'est remis à l'apporteur, alors que la date fait foi (c).**
L'e-mail `apporteur-declaration-recue` part en interne ; la liste montre le jour, pas l'heure.

**Correctif.** Message à l'apporteur : « Votre déclaration de {dénomination}, SIRET {numéro}, a été
enregistrée le {date} à {heure} (heure de Paris). Conservez ce message. »

**I25. L'apporteur ne voit aucun relevé chiffré de ses commissions (c).**
`ESP/commissions/page.tsx` n'affiche que le barème. Avec l'autofacturation, l'apporteur ne peut pas
vérifier l'assiette. Ajouter par déclaration : commande, base hors taxes, commission, état. C'est une
information sur ses droits, pas un indicateur d'activité.

**I26. Résilié, l'apporteur perd son contrat et ses preuves (c).**
`AR/resiliation.ts:76` révoque le lien ; la page devient « Ce lien ne fonctionne plus ». Ouvrir aux
contrats terminés un accès restreint : contrat signé, liste en lecture seule, dépôt des attestations.

#### Console

**I27. « Apporteur actif » à 60 jours (a).**
`src/app/[locale]/(admin)/[adminPrefix]/tunnels/_components/VueApporteurs.tsx:268` : « Apporteur
actif : contrat signé et au moins une entreprise présentée dans les 60 jours ». Calcul par personne
(`src/features/admin-tunnels/apporteurs.ts:63`), affiché en agrégat ; onglet « Actifs » dans la liste.

**Correctif.** « Contrat ayant donné lieu à une première déclaration », avec la mention : « Mesure du
rendement de la publicité ; n'est utilisée pour aucune décision concernant un apporteur. » Onglet :
« Contrats en cours ».

**I28. Réductions, annulations et reprises sans information de l'apporteur (c).**
`AR/ajustement.ts:259-268` : motif libre, aucun message. `AR/resiliation.ts:19-20` : la reprise manuelle
« est un jugement, pas un calcul », tracée dans une note interne réécrivable, sans auteur.
`AR/commissions.ts:375-379` : un classement « site web » clôt la commission à zéro en statut
« versée », sans trace. Le retrait d'un parrain n'est ni tracé ni notifié, contre
`AR/contrat-v2.ts:488-489`.

**Correctif.** Tout changement de montant exige la référence de la pièce qui le fonde, est journalisé
avec son auteur dans la même transaction et notifié : « Votre commission sur {entreprise} passe de
{avant} à {après} : {motif}. Vous pouvez contester par écrit. »

#### Règles codées

**I29. Pénalités de retard promises, jamais calculées (c).**
`AR/facturation.ts:16-17` : « Aucune pénalité n'est calculée ici : la loi s'applique, le contrat le
dit. » Le contrat les stipule de plein droit (`AR/contrat-v2.ts:595-600`). Calculer et verser les
pénalités et l'indemnité de 40 € à tout virement postérieur à l'échéance.

**I30. Autres écarts entre le code et le contrat (c).**

- **Grille non versionnée** : `AR/regles.ts:338`, le calcul ne reçoit ni date ni version signée ; un
  changement de code s'applique à tous, contre l'article 13.
- **Client sans numéro SIREN** : `AR/passage-quotidien.ts:726` `if (!signeeAt || !siren) continue;`, la
  commission est perdue en silence sur une saisie d'Axion. L'envoyer dans « commandes à attribuer ».
- **Solde négatif** : toutes les commissions dues sont bloquées et `AR/solde-negatif.ts:7-8` « rien
  n'est envoyé à l'apporteur (décision de Will) ». Envoyer un décompte.
- **Date de prestation de l'autofacture** : dérivée de l'émission (`AR/autofacture-donnees.ts:426-427`)
  et non de l'encaissement réel ; l'échéance de trente jours court donc d'une date qu'Axion maîtrise.
- **Délais d'Axion sans effet** : 15 jours d'attribution, 60 jours hors grille, 30 jours de réponse ne
  produisent que des alertes internes, quand les délais de l'apporteur emportent déchéance.
- **Radiation de l'apporteur** : aucune vérification périodique de l'immatriculation ; un apporteur
  radié reste « Signé » et son paiement est bloqué sans terme, alors que le contrat prévoit la fin de
  plein droit et le versement (`AR/contrat-v2.ts:854-861`).

#### Documents internes, productibles en justice

**I31. Des documents versionnés décrivent un pilotage d'activité que le code n'applique pas (a).**

- `docs/tableaux-de-bord-apporteurs.md:280` : « **actifs (ont déposé)** · dormants (>60 j sans
  dépôt) » ; `:292` « Apporteurs actifs devenus dormants ».
- `docs/fonctionnement-reseau-apporteurs.md:163` : « 15 dépôts cette semaine » ; `:108` « Provoquer le
  premier acte » ; « Péremption à 90 jours ».
- `docs/plan-recrutement-apporteurs-daffaires.md:350` : « quota 15/semaine » ; webinaire hebdomadaire à
  créneau fixe ; indicateur « premier contact dans les 30 jours suivant leur signature ».
- `docs/imprimes/devenir-apporteur-d-affaires.html:122` : « Réseau 2026 · +200 apporteurs en France »
  (non vérifiable), tableau de bord fictif avec « Commissions du mois 3 200 € ».
- Le document de doctrine `docs/partners/ANTI-REQUALIFICATION.md`, cité dans au moins cinq fichiers,
  **n'existe pas dans le dépôt**.

**Correctif.** Bandeau en tête de chacun :

> DOCUMENT HISTORIQUE, NON APPLIQUÉ. Le réseau fonctionne sans score, sans quota, sans péremption pour
> inactivité, sans relance d'activité et sans suivi d'apporteurs « actifs » ou « dormants ». Seuls le
> contrat signé et le code font foi.

Retirer les chiffres de revenus et l'allégation « +200 » de la plaquette avant toute rediffusion.

### 3.3 Mineurs

| N°  | Fichier:ligne                                  | Citation exacte                                                                                                        | Risque                                    | Correctif mot pour mot                                                                                                                          |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | `TPL/apporteur-demarrage.tsx:146`              | « Votre contrat est signé : à vous de jouer »                                                                          | (a) injonction d'activité                 | « Votre contrat d'apporteur est signé »                                                                                                         |
| M2  | idem `:151`                                    | « bienvenue officiellement dans le réseau d'Axion-IA »                                                                 | (a) intégration                           | « Votre contrat d'apporteur d'affaires est signé des deux parties : merci. »                                                                    |
| M3  | idem `:304`                                    | « Vous continuez à nous présenter des entreprises normalement. »                                                       | (a) activité présumée                     | « Cela ne change rien à votre possibilité de nous présenter des entreprises. »                                                                  |
| M4  | idem `:184`                                    | « Bien reçu : elle est à vous »                                                                                        | (b) clientèle confiée                     | « Bien reçu : elle vous est réservée »                                                                                                          |
| M5  | idem `:227`                                    | « Une personne de notre réseau »                                                                                       | (a, b) membre d'Axion                     | « Une de nos relations professionnelles »                                                                                                       |
| M6  | `TPL/apporteur-issue-echange.tsx:71`           | « Nous vous avons attendu »                                                                                            | (a) ton de reproche                       | « Nous n'avons pas pu nous parler : un autre créneau ? »                                                                                        |
| M7  | `ESP/textes.ts:111`                            | « Déposez ici les attestations que nous vous demandons. »                                                              | (a) impératif                             | « La loi nous impose de vous demander ces attestations à partir de 5 000 € : vous pouvez les déposer ici. »                                     |
| M8  | `SectionsPrincipale.tsx:288` (landings)        | « La seule phrase à retenir »                                                                                          | (a) script fourni                         | « Un exemple de phrase, à dire avec vos mots »                                                                                                  |
| M9  | `AR/contrat-v2.ts:159`                         | « **à sa seule discrétion** » (extension à l'entreprise)                                                               | (c)                                       | « sur demande de l'Apporteur qui justifie d'un contact avec la direction, par décision écrite et motivée »                                      |
| M10 | `AR/contrat-v2.ts:65-67`                       | « sans avoir à motiver sa décision » (suite donnée)                                                                    | (c)                                       | Conserver, mais ajouter : « Elle indique à l'Apporteur, sur sa demande, si elle a pris contact avec l'entreprise. »                             |
| M11 | `AR/contrat-v2.ts:176-180`                     | « **Une déclaration adressée par tout autre moyen, notamment par courrier électronique, est sans effet** »             | (a) outil imposé ; (c)                    | Ajouter : « En cas d'indisponibilité du formulaire, la déclaration adressée par courrier électronique est enregistrée à la date de son envoi. » |
| M12 | `AR/contrat-v2.ts:115-117`                     | « une personne agissant pour son compte et déclarée à la Société »                                                     | (a) contrôle des moyens humains           | Supprimer « et déclarée à la Société ».                                                                                                         |
| M13 | `AR/contrat-v2.ts:665-666`                     | « Il informe la Société de tout changement les affectant dans les quinze jours. »                                      | (a) délai impératif, faible               | « dans un délai raisonnable, et avant toute nouvelle facture »                                                                                  |
| M14 | `AR/contrat-v2.ts:572-575` contre `:470`       | 30 jours pour contester une autofacture ; 24 mois de reprise pour la Société                                           | (c) asymétrie                             | Porter à soixante jours, ou préciser que le silence ne vaut jamais accord sur le montant (déjà dit à l'article 5.5 : à conserver).              |
| M15 | `AR/regles.ts:371`                             | arrondi toujours inférieur                                                                                             | (c)                                       | Arrondi au centime le plus proche.                                                                                                              |
| M16 | `faq.tsx:32` (landings)                        | « En cas de remise accordée à l’entreprise, elle est réduite au prorata »                                              | (c) remise décidée par Axion              | « Une remise que nous décidons seuls après la signature du devis ne réduit pas votre commission. » (et aligner l'article 4.1 bis)               |
| M17 | documents publics                              | virement « sous 10 jours ouvrés, dès 50 € cumulés » (trame) contre « sans montant minimum », 30 jours (fiche, contrat) | (c) information contradictoire            | Une seule règle partout : celle du contrat.                                                                                                     |
| M18 | `docs/fonctionnement-reseau-apporteurs.md:393` | parrainage « 12 mois »                                                                                                 | incohérence (contrat : 6 mois)            | Corriger ou archiver.                                                                                                                           |
| M19 | `AR/contrat-v2.ts:483-485`                     | parrainage, 10 % des commissions du filleul                                                                            | (a) animation de réseau ; vente en réseau | Conserver un seul niveau et l'absence de tout rôle du parrain ; à faire valider (section 8).                                                    |
| M20 | `TPL/apporteur-demarrage.tsx:1185-1193`        | sept gabarits réécrivables à la main                                                                                   | (a)                                       | Contrôle bloquant d'une liste de mots (mission, objectif, poste, obligatoire, vous devez).                                                      |
| M21 | `src/server/email/verdict-envoi.ts:90-104`     | le rappel de dossier n'obéit pas à l'opposition                                                                        | données personnelles                      | Ajouter `apporteur-dossier-lien` à la liste.                                                                                                    |
| M22 | `AR/facturation.ts:911`                        | « Virement fait » daté du clic, sans référence bancaire                                                                | preuve                                    | Saisir la date de valeur et la référence du virement.                                                                                           |

---

## 4. Les règles nouvelles

Rappel de ce qui est annoncé : entreprise gardée 60 jours à l'apporteur ; validée au premier
rendez-vous tenu, constaté par Axion ; 6 mois de droit à commission ensuite ; aucun plafond sur le
nombre de présentations ; commission versée quand le client a payé à 100 %.

### 4.1 État du code

| Règle annoncée                      | Sur `main`                                                                                                                  | Branches                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Gardée 60 jours                     | Non. Sens **inverse** : sans démarche d'Axion, la déclaration est réputée confirmée à 30 + 30 jours (`AR/regles.ts:37-44`). | Lot 1 : colonnes `reservee_jusqu_at`, `echue_at`, sans code appelant. Lot 7a : 60 jours dans un gabarit non branché. |
| Validée au premier rendez-vous tenu | Non. Trois voies aujourd'hui : réponse de l'entreprise, confirmation écrite, confirmation tacite.                           | Lot 1 : données seules ; un rendez-vous est « proposé à Williams qui le retient ou l'écarte ».                       |
| 6 mois ensuite                      | Non : 6 mois à compter de la **déclaration**, plus 3 mois de prolongation.                                                  | Lot 7a : « partent alors du jour de ce rendez-vous ». Sort de la prolongation non dit.                               |
| Aucun plafond                       | Oui (`AR/declaration-regles.ts:19-21`), verrouillé par tests.                                                               |                                                                                                                      |
| 100 % payé                          | Oui, mais le code et le contrat ajoutent « prestation réalisée » (B3).                                                      |                                                                                                                      |

### 4.2 Analyse

**Ce qui est favorable.** Le total du droit s'allonge (jusqu'à 60 jours + 6 mois). L'absence de plafond
confirme qu'aucun volume n'est mesuré. Valider par un fait objectif (un rendez-vous) vaut mieux qu'une
appréciation libre.

**Ce qui est dangereux (B4).**

1. **Condition entre les mains du débiteur.** C'est Axion qui appelle l'entreprise, propose le
   rendez-vous, s'y présente et le « constate ». Si Axion ne fait rien pendant 60 jours, l'apporteur
   perd son droit. L'article 1304-3 du code civil répute la condition accomplie quand celui qui y
   avait intérêt en a empêché l'accomplissement, mais l'apporteur devra le prouver.
2. **Disparition du garde-fou actuel.** Aujourd'hui le silence d'Axion profite à l'apporteur. Demain il
   lui nuit. C'est un recul net sur le terrain du déséquilibre.
3. **« Tenu » n'est pas défini.** Rendez-vous annulé par Axion, reporté au-delà du 60ᵉ jour, entreprise
   absente, rendez-vous tenu par téléphone : rien n'est dit.
4. **Pas de motif à l'écartement.** La branche lot 1 enregistre qui écarte un rendez-vous, pas
   pourquoi. La source de validation admet « saisie », donc une validation à la main.
5. **Pression indirecte sur l'activité (a).** Si, en pratique, l'apporteur doit pousser l'entreprise à
   prendre rendez-vous pour ne pas perdre sa réservation, on recrée une obligation de suivi que
   l'article 4.4 du contrat exclut (« elle ne rémunère aucun suivi »).
6. **Le mot « reproche ».** Le gabarit lot 7a écrit « la réservation s'arrête, sans aucun reproche » :
   le mot installe un cadre disciplinaire là où il n'y en a pas.
7. **Les contrats déjà signés.** L'article 13 exige un avenant signé ; à défaut, la version 2.6
   continue de s'appliquer, « à ses attributions en cours comme à ses déclarations nouvelles ». Deux
   régimes coexisteront : le code doit appliquer à chaque apporteur la version qu'il a signée.

### 4.3 Rédaction proposée (article 3.2 nouveau), mot pour mot

> **Réservation.** L'entreprise déclarée est réservée à l'Apporteur pendant soixante jours à compter de
> l'enregistrement de sa déclaration.
>
> **Validation.** L'attribution est validée par le premier des faits suivants, survenu pendant la
> réservation : (a) la prise d'un rendez-vous entre la Société et l'entreprise, quelle que soit la date
> à laquelle il se tient ; (b) l'émission d'un devis à l'entreprise ; (c) la signature d'une commande
> par l'entreprise. Ces faits se constatent sur les seules données horodatées de la Société (agenda,
> devis, commande), dont l'extrait est communiqué à l'Apporteur sur sa demande.
>
> **Diligence de la Société.** La Société propose un rendez-vous à l'entreprise dans les quinze jours
> de la déclaration. À défaut de toute démarche de sa part dans les trente jours, l'attribution est
> réputée validée. Un rendez-vous annulé ou reporté par la Société prolonge la réservation d'autant ;
> un rendez-vous auquel la Société ne se présente pas vaut validation.
>
> **Durée.** L'attribution validée dure six mois à compter du fait qui la valide. Elle n'est pas
> reconductible.
>
> **Décision d'écarter un rendez-vous.** Lorsque la Société estime qu'un rendez-vous pris avec
> l'entreprise ne se rattache pas à la déclaration, elle l'écrit à l'Apporteur avec son motif ;
> l'Apporteur peut contester par écrit, et la Société répond de façon motivée dans les trente jours.
>
> **Fin de la réservation.** Sans validation au terme des soixante jours, la réservation prend fin,
> sans autre conséquence pour l'Apporteur. Il peut déclarer à nouveau l'entreprise après un nouveau
> contact avec elle.

**Correctifs techniques associés.** Ajouter au lot 1 les colonnes du motif d'écartement, du motif de
validation manuelle et de la date de notification à l'apporteur. Dans le gabarit lot 7a, remplacer la
phrase sur le reproche par :

> Sans rendez-vous pris d'ici là, la réservation prend fin automatiquement ; vous pourrez nous
> présenter de nouveau cette entreprise après un nouveau contact avec elle.

et « validée sur votre compte » par « validée à votre nom ». Le second gabarit du lot 7a (information
de la personne présentée) ne reprend ni la base légale, ni la durée de conservation, ni le droit de
réclamation qui figurent dans la version en service : à compléter.

### 4.4 « Commission versée quand le client a payé à 100 % »

La règle annoncée est plus simple que le contrat, qui exige en plus la réalisation. Elle est
préférable à condition de traiter le paiement partiel (I9) et la reprise (I8). Si la condition de
réalisation est maintenue, appliquer B3.

---

## 5. Indices d'indépendance déjà présents, à conserver

**Dans le contrat (`AR/contrat-v2.ts`).**

- `:57-59` : « **L'Apporteur n'est tenu d'aucune obligation de signalement : il signale s'il le souhaite
  et quand il le souhaite** ».
- `:61-63` : « **L'Apporteur n'est investi d'aucun mandat.** Il ne représente pas la Société, ne négocie
  aucune condition, aucun prix, aucun délai, ne conclut aucun contrat ».
- `:82-83` : « Il organise librement son activité, ses horaires, ses méthodes, ses moyens et ses
  déplacements. »
- `:85-88` : « **Aucun objectif, aucun quota, aucun volume minimum ne lui est assigné.** L'absence
  d'activité de l'Apporteur, quelle qu'en soit la durée, n'est pas un manquement contractuel ».
- `:92` : « **Aucun compte rendu d'activité ne lui est demandé** ».
- `:99-101` : « **Aucune exclusivité n'est consentie** […] y compris auprès d'entreprises
  concurrentes ».
- `:104-105` : il supporte ses frais, aucune rémunération fixe, aucun droit d'entrée.
- `:112-114` : liberté de recourir à des associés, préposés ou sous-traitants.
- `:119-123` : aucun message ne vaut instruction ; aucune fréquence de connexion.
- `:339-341` : « **Aucune suspension ne peut être fondée, même partiellement, sur le nombre de
  déclarations, sur leur rythme, sur l'heure ou le lieu** […] Elle n'obéit à aucun barème, à aucun
  compteur et à aucun seuil. »
- `:437-440` : la commission « ne rémunère aucun suivi, aucune intervention ni aucune mission ».
- `:511-513` : le parrainage « n'emporte aucune fonction d'encadrement, d'animation, de formation ni de
  suivi ».
- `:812-814` : « **La mise en demeure n'est ni un avertissement ni une mesure disciplinaire** ».
- `:863-864` : aucune commission acquise n'est perdue du fait de la résiliation.
- `:874-881` : pas de modification sans avenant ; refuser un avenant n'est pas un manquement.
- Articles 5.3 et 6.2 : pénalités de retard légales, attestation de vigilance, immatriculation.

**Dans les règles codées.**

- `AR/declaration-regles.ts:19-21` : « Aucun plafond par apporteur ».
- `AR/regles.ts:213-214` : « Les trois conditions se lisent dans les données de la Société, jamais dans
  l'activité de l'apporteur. »
- `AR/regles.ts:39-42` : le silence d'Axion vaut confirmation (à ne pas perdre, voir section 4).
- `AR/presentations.ts:249-252` : horodatage par le serveur, pas d'antidatage ; priorité mécanique à la
  déclaration la plus ancienne.
- `AR/resiliation.ts:14-16` : une commission créée « est ACQUISE ».
- Contrôle de l'immatriculation active à la signature et à la contresignature ; refus d'un apporteur
  qui porterait le numéro de la Société.
- Rappels de dossier limités à J+3 et J+7, avant signature seulement
  (`AR/passage-quotidien.ts:20`). **Aucune relance d'activité après signature.**
- Parrainage à un seul niveau, sans rémunération de l'inscription, auto-parrainage bloqué.

**Dans l'espace, les e-mails et les pages publiques.**

- L'espace n'affiche ni compteur, ni objectif, ni classement, ni badge ; seulement l'état de ses
  propres déclarations.
- `TPL/apporteur-issue-echange.tsx:105` : « Vous restez indépendant, libre de votre organisation, sans
  objectif ni exclusivité. »
- `TPL/apporteur-demarrage.tsx:168` : « Vous n'avez pas à suivre le client : nous nous en occupons. »
- `AR/regles-dossier.ts:25` : « Je ne suis ni salarié ni associé d'Axion-IA. »
- Charte, page 4 : « Vous êtes apporteur d'affaires indépendant : jamais salarié, jamais représentant
  d'Axion-IA. »
- Landings : « Pas de quota, pas d’exclusivité, pas de reporting » ; « Vous n’êtes ni vendeur ni
  expert en IA. Vous mettez en relation. »
- `src/content/recrutement/vsl-apporteur.ts:209` : « Vous n'êtes pas salarié d'Axion-IA. » ; aucune
  garantie de gain.
- Aucune donnée structurée d'offre d'emploi sur les pages apporteurs (choix écrit dans le code).
- Décision d'architecture `docs/adr/0051-…md:74-77` : « On ne « refuse » pas un apporteur : il n'y a ni
  poste, ni subordination, et le vocabulaire d'un recrutement salarié serait lui-même un indice de
  requalification. » La règle est écrite ; elle n'est pas appliquée au parcours d'entrée.

---

## 6. Textes et jurisprudences

**Franchise sur les sources.** Je n'ai pas consulté de base de jurisprudence pendant cet audit. Les
références ci-dessous viennent de ma connaissance. « Certaine » veut dire que je suis sûr de
l'existence, de la date et du sens de la décision ou du texte ; le numéro doit quand même être relu
avant toute citation dans un acte. « À vérifier » veut dire que je suis sûr du sens mais pas du numéro
ou de la date exacte. Je n'ai inventé aucun numéro : quand je ne le connais pas, je ne le donne pas.

### 6.1 Textes

| Texte                                                   | Objet                                                                                                                                                              | Certitude                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Code du travail, L.8221-6                               | Présomption de non-salariat des personnes immatriculées ; renversée par la preuve d'un « lien de subordination juridique permanente » à l'égard du donneur d'ordre | Certaine                                       |
| Code du travail, L.8221-6-1                             | Est présumé indépendant celui dont les conditions de travail sont définies exclusivement par lui-même ou par le contrat                                            | Certaine                                       |
| Code du travail, L.8221-5 et L.8223-1                   | Travail dissimulé par dissimulation d'emploi salarié ; indemnité forfaitaire de six mois de salaire                                                                | Certaine                                       |
| Code du travail, L.8222-1, R.8222-1, D.8222-5           | Obligation de vigilance du donneur d'ordre, seuil de 5 000 € hors taxes, documents à obtenir tous les six mois                                                     | Certaine                                       |
| Code du travail, L.7311-3 et L.7313-1                   | Statut du voyageur, représentant, placier : conditions et présomption de contrat de travail                                                                        | Sens certain ; numérotation exacte à vérifier  |
| Code du travail, L.6323-8-1                             | Interdiction du démarchage sur le compte personnel de formation                                                                                                    | À vérifier (repris tel que cité au contrat)    |
| Code de la sécurité sociale, L.311-2 et L.311-11        | Affiliation au régime général ; présomption de non-salariat côté sécurité sociale                                                                                  | Sens certain ; L.311-11 à vérifier             |
| Code de commerce, L.134-1                               | Définition de l'agent commercial : chargé « de façon permanente » de négocier et, éventuellement, de conclure, au nom et pour le compte du mandant                 | Certaine                                       |
| Code de commerce, L.134-6, L.134-11, L.134-12, L.134-16 | Commission sur les opérations de la clientèle ; préavis ; indemnité de fin de contrat ; caractère d'ordre public                                                   | Certaine                                       |
| Code de commerce, L.442-1, I, 2°                        | Déséquilibre significatif                                                                                                                                          | Certaine                                       |
| Code de commerce, L.442-1, II                           | Rupture brutale d'une relation commerciale établie                                                                                                                 | Certaine                                       |
| Code de commerce, L.442-4 et D.442-3                    | Juridictions spécialisées                                                                                                                                          | Certaine pour le principe ; alinéas à vérifier |
| Code de commerce, L.441-10 et D.441-5                   | Délais de paiement, pénalités, indemnité forfaitaire de 40 €                                                                                                       | Certaine                                       |
| Code de commerce, L.441-9                               | Mentions des factures                                                                                                                                              | Certaine                                       |
| Code civil, 1304-2                                      | Nullité de l'obligation contractée sous une condition dépendant de la seule volonté du débiteur                                                                    | Certaine                                       |
| Code civil, 1304-3                                      | Condition réputée accomplie si celui qui y avait intérêt en a empêché l'accomplissement                                                                            | Certaine                                       |
| Code civil, 1110, 1171 et 1190                          | Contrat d'adhésion ; clause créant un déséquilibre significatif réputée non écrite ; interprétation contre celui qui l'a proposé                                   | Certaine                                       |
| Code civil, 1164                                        | Fixation unilatérale du prix dans un contrat cadre, à charge de motiver                                                                                            | Certaine                                       |
| Code civil, 1170                                        | Clause privant de sa substance l'obligation essentielle                                                                                                            | Certaine                                       |
| Code civil, 1112-1                                      | Devoir d'information précontractuel                                                                                                                                | Certaine                                       |
| Code civil, 1356, 1366, 1367                            | Convention de preuve, écrit électronique, signature électronique                                                                                                   | Certaine                                       |
| Code général des impôts, 289, I, 2                      | Mandat de facturation                                                                                                                                              | Certaine                                       |
| Code de la consommation, L.121-15                       | Ventes pyramidales (à rapprocher du parrainage)                                                                                                                    | À vérifier                                     |

### 6.2 Jurisprudence

| Décision                                                       | Apport                                                                                                                                                                                                                                                         | Certitude                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Cass. soc., 13 novembre 1996, n° 94-13.187, _Société Générale_ | Définition du lien de subordination : pouvoir de donner des ordres et des directives, d'en contrôler l'exécution et de sanctionner les manquements ; le service organisé peut être un indice quand l'employeur fixe unilatéralement les conditions d'exécution | Certaine                                                |
| Cass. ass. plén., 4 mars 1983, n° 81-11.647 et 81-15.290       | L'existence d'un contrat de travail ne dépend ni de la volonté des parties ni du nom donné à la convention, mais des conditions de fait                                                                                                                        | Certaine pour le principe ; numéros à vérifier          |
| Cass. soc., 19 décembre 2000, n° 98-40.572, _Labbane_          | Même principe : requalification d'un contrat de location de taxi                                                                                                                                                                                               | Certaine                                                |
| Cass. soc., 28 novembre 2018, n° 17-20.079, _Take Eat Easy_    | Géolocalisation et système de sanctions caractérisent la subordination d'un livreur de plateforme                                                                                                                                                              | Certaine                                                |
| Cass. soc., 4 mars 2020, n° 19-13.316, _Uber_                  | Statut d'indépendant « fictif » : service organisé, absence de clientèle propre, tarifs imposés, pouvoir de sanction par déconnexion                                                                                                                           | Certaine                                                |
| Cass. crim., 5 avril 2022, _Clic and Walk_                     | Limite utile : une activité occasionnelle, libre et sans contrôle n'est pas un contrat de travail                                                                                                                                                              | Sens certain ; numéro à vérifier (je ne le donne pas)   |
| Cass. soc., 13 avril 2022, _Le Cab_                            | Appréciation concrète des conditions d'exercice d'un chauffeur de plateforme                                                                                                                                                                                   | À vérifier (date et portée)                             |
| CJUE, 4 juin 2020, C-828/18, _Trendsetteuse_                   | Il n'est pas nécessaire de pouvoir modifier les prix pour être agent commercial : « négocier » couvre le fait de prospecter, d'informer et de favoriser la conclusion                                                                                          | Certaine                                                |
| Cass. com., 2 décembre 2020                                    | Alignement de la chambre commerciale sur _Trendsetteuse_                                                                                                                                                                                                       | Sens certain ; numéro à vérifier (je ne le donne pas)   |
| Cass. soc., 11 mai 2022                                        | L'action en reconnaissance d'un contrat de travail est une action personnelle soumise à la prescription de cinq ans, qui court de la fin de la relation                                                                                                        | Sens certain ; numéros à vérifier (je ne les donne pas) |
| Cass. com., 26 janvier 2022                                    | Articulation de l'article 1171 du code civil avec les textes spéciaux sur le déséquilibre significatif                                                                                                                                                         | À vérifier entièrement                                  |

### 6.3 Ce que ces sources impliquent ici

- **Le contrat ne suffit jamais.** Le juge regarde les faits : textes envoyés, écrans, gestes de la
  console, journal. C'est pourquoi les constats sur l'outil pèsent plus que ceux sur le contrat.
- **Trois critères cumulés pour le salariat.** Directives (charte, script), contrôle (suivi « actif »,
  note sur 20, retrait sous 48 heures) et sanction (manquement, retrait du réseau, résiliation
  immédiate). Le produit n'en réunit aucun franchement aujourd'hui ; les correctifs visent à ce qu'il
  n'en approche aucun.
- **Agent commercial : le critère est la permanence, plus le prix.** L'interdiction de parler prix ne
  protège plus à elle seule. Protègent : le caractère ponctuel de chaque déclaration, l'absence de
  suivi, l'absence de mission de promotion.
- **Prescription.** Si la prescription de cinq ans après la fin de la relation est confirmée, la
  conservation des preuves « cinq ans après la fin du contrat » prévue au contrat est juste suffisante ;
  prévoir une marge.

---

## 7. Dossier de preuves

### 7.1 Ce que le système conserve déjà

- **Signature.** Texte intégral signé, empreinte numérique, version du contrat, date et heure, adresse
  de connexion hachée, navigateur, cases cochées, déclarations de l'apporteur ; contrat signé des deux
  parties en PDF avec certificat ; contresignature datée.
- **Immatriculation.** Contrôle au registre à la signature et à la contresignature ; pièces déposées
  avec empreinte, date de dépôt, date de vérification, date d'expiration.
- **Déclarations.** Date et heure du serveur, date de prise de contact, date et mode de confirmation
  (expresse ou tacite), terme, prolongation et son motif.
- **Commissions.** Montants, paliers, prix public et prix facturé, numéros d'autofacture et d'avoir,
  dates, motif de mise en attente, motif de litige, auteur du marquage « réalisée », PDF archivés.
- **E-mails.** Une ligne par envoi (gabarit, destinataire, statut, dates, rebond) et une copie du
  contenu tel que parti.
- **Journal des gestes d'administration**, avec auteur : retrait et remise dans le réseau, correction
  du nom, constat de manquement avec les faits, extension à l'entreprise, attribution manuelle d'une
  commande avec motif, réduction, annulation, suspension et levée de suspension, hors grille.

### 7.2 Ce qui manque

| Manque                                                                                                                                 | Pourquoi c'est gênant                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Résiliation : ni auteur, ni fondement, ni date de notification, ni préavis, ni e-mail                                                  | Impossible de prouver une rupture régulière             |
| Retrait du réseau : pas de motif                                                                                                       | Apparence de mise à l'écart arbitraire                  |
| Refus d'une déclaration : ni motif enregistré, ni auteur, ni pièce d'antériorité                                                       | Impossible de prouver que le refus était fondé          |
| Démenti : ni date, ni personne, ni termes                                                                                              | Le contrat promet cette trace                           |
| Contresignature, « à compléter », refus de dossier, jugement des pièces : pas d'auteur                                                 | Qui a décidé ?                                          |
| Reprise manuelle : pas de journal, note réécrivable et tronquée                                                                        | Preuve fragile d'une somme reprise                      |
| Qualification du palier, classement « aucune commission » : pas de journal                                                             | Montant de la commission non justifiable                |
| Contestations de l'apporteur et réponses d'Axion : aucun enregistrement, aucun suivi du délai de trente jours                          | Le contrat promet une réponse motivée sous trente jours |
| Accusé horodaté remis à l'apporteur                                                                                                    | La preuve de l'antériorité reste chez Axion seule       |
| Date réelle d'encaissement sur la commission et l'autofacture                                                                          | Point de départ des délais non prouvé                   |
| Référence bancaire du virement                                                                                                         | Preuve du paiement                                      |
| Traces « jamais bloquantes » : plusieurs gestes réussissent même si l'écriture au journal échoue                                       | Un geste peut exister sans trace                        |
| Copie du contenu des e-mails en « meilleur effort », pièces jointes non copiées, durée de conservation décrite de façon contradictoire | Un envoi peut exister sans copie                        |
| Lecture ou acceptation de la charte : aucune trace                                                                                     | Opposabilité de la charte                               |
| Cases d'acceptation groupées, nom « tapé » en réalité prérempli                                                                        | La preuve décrit mieux que le geste réel                |
| Vérification périodique de l'immatriculation                                                                                           | Preuve continue de l'indépendance                       |

### 7.3 Dossier à constituer, par apporteur

1. Contrat signé, certificat, version et empreinte.
2. Preuve de l'immatriculation **antérieure** à la relation (date de création de l'entreprise au
   registre), et de son maintien (relevé périodique).
3. Attestations de vigilance successives.
4. Toute preuve que l'apporteur a d'autres clients ou d'autres activités (déclarations de l'article 23,
   informations publiques). C'est l'antidote à la dépendance économique.
5. Historique complet des e-mails reçus, montrant l'absence de relance d'activité.
6. Historique des déclarations, montrant un rythme libre et irrégulier.
7. Autofactures, décomptes, virements avec références.
8. Toute décision défavorable, avec son motif, sa notification et la réponse apportée à la
   contestation.
9. Les textes publics tels qu'ils étaient à la date d'entrée de l'apporteur (archiver les pages).

**Durée.** Au moins cinq ans après la fin du contrat, avec une marge (section 6.3) ; dix ans pour les
pièces comptables.

---

## 8. Questions à poser à l'avocat

1. **Qualification.** « Contrat d'entreprise de droit commun » (article 1.4) est-il le bon habit, ou
   faut-il parler de courtage ? Quelles conséquences sur la rupture et la rémunération ?
2. **Agent commercial.** Après l'arrêt de la CJUE du 4 juin 2020, l'article 22 bis (communication sous
   la marque), la durée indéterminée et la commission sur toutes les commandes de l'entreprise
   suffisent-ils à faire de l'apporteur un agent chargé « de façon permanente » ? Faut-il supprimer
   22 bis ou le réduire à une simple licence de marque ?
3. **Fait générateur.** La clause « prestation réalisée et intégralement encaissée, quelle qu'en soit
   la cause, y compris du fait de la Société » résiste-t-elle aux articles 1304-2, 1170 et 1171 du code
   civil et à l'article L.442-1 du code de commerce ? La rédaction proposée en B3 suffit-elle ?
4. **Règle nouvelle.** La validation par un rendez-vous « constaté par Axion » est-elle une condition
   potestative ? La rédaction de la section 4.3 (diligence, validation réputée, motif de l'écartement)
   la sécurise-t-elle ?
5. **Contrats déjà signés.** Comment faire passer les signataires de la version 2.6 à la règle
   nouvelle : avenant, ou résiliation avec préavis puis nouveau contrat ? Risque de rupture brutale ?
6. **Reprise sur 24 mois** et remboursement du solde négatif : durée et plafond sont-ils
   proportionnés ? La reprise pour geste commercial doit-elle disparaître ?
7. **Préavis de 30 jours.** Est-il suffisant au regard de la rupture brutale pour une relation de
   plusieurs années ? Faut-il un barème selon l'ancienneté ?
8. **Résiliation sans préavis** pour manquement aux articles 22 et 22 bis : proportionnée ?
9. **Clause de compétence** (article 14) : valable alors que beaucoup d'apporteurs ne sont pas
   commerçants ? L'acceptation par case groupée satisfait-elle l'exigence de spécification très
   apparente ? Quelle juridiction en cas de demande de requalification (le conseil de prud'hommes se
   reconnaîtra compétent quoi que dise la clause) ?
10. **Candidats à un emploi.** Peut-on proposer l'apport d'affaires à une personne qui a postulé à un
    poste salarié ? À quelles conditions (activité indépendante préexistante, délai, écrit) ?
11. **Micro-entreprise créée pour l'occasion.** Quel poids un juge donne-t-il au fait que l'apporteur
    s'est immatriculé pour signer ? Faut-il exiger une ancienneté ou d'autres clients ?
12. **Dépendance économique.** Faut-il surveiller, sans en faire un suivi d'activité, la part d'Axion
    dans le revenu d'un apporteur, et que faire au-delà d'un seuil ?
13. **Parrainage.** Le dispositif à un niveau est-il hors du champ des ventes pyramidales ? Le parrain
    devient-il un recruteur, donc un indice d'animation de réseau ?
14. **Sélection à l'entrée.** Jusqu'où peut-on choisir ses apporteurs (échange, critères) sans que cela
    ressemble à une embauche ? La note sur 20 est-elle à proscrire ?
15. **Signature électronique simple** avec convention de preuve : suffisante pour un contrat de cette
    portée, ou faut-il une signature avancée ?
16. **Autofacturation.** L'acceptation tacite sous trente jours est-elle conforme à la doctrine
    fiscale ? L'entrée en vigueur de la facturation électronique change-t-elle le dispositif ?
17. **Obligation de vigilance.** Le contrôle « à l'œil » de l'attestation, sans vérification du code de
    sécurité, suffit-il à dégager la solidarité financière ?
18. **Documents internes.** Les notes de conception périmées (quotas, « dormants », webinaire fixe)
    doivent-elles être archivées avec un bandeau ou retirées ? Risque d'un retrait après un premier
    litige ?
19. **Données personnelles.** Base légale de la transmission des coordonnées par l'apporteur, et
    information de la personne présentée dans la règle nouvelle.
20. **Assurance.** Une couverture existe-t-elle pour le risque de redressement et de requalification ?

---

## 9. Résumé d'une page pour le dirigeant

**En une phrase.** Votre contrat est bon ; ce qui peut vous coûter cher, ce sont quelques mots et
quelques boutons autour du contrat, et une règle nouvelle à réécrire avant de la mettre en service.

**Ce qui va bien.**

- Le contrat dit clairement que l'apporteur est libre : pas d'objectif, pas d'horaire, pas de compte à
  rendre, pas d'exclusivité, pas le droit de négocier à votre place.
- Une fois le contrat signé, vous ne relancez jamais un apporteur parce qu'il ne présente personne.
  C'est le point le plus important, et il est respecté.
- Vous vérifiez que chacun a bien une entreprise déclarée, et vous demandez l'attestation URSSAF quand
  il le faut.

**Ce qu'il faut corriger tout de suite (sept points).**

1. **Mettre fin à un contrat.** Aujourd'hui, un clic coupe tout, tout de suite, sans lettre. Votre
   contrat promet trente jours et un écrit. Il faut que l'outil fasse ce que le contrat dit.
2. **« Retirer du réseau ».** Ce bouton écarte quelqu'un sans lui dire pourquoi, alors que son contrat
   court toujours. À interdire pour un contrat signé.
3. **Payer la commission.** Elle n'est versée que si vous cochez « prestation réalisée ». Si vous ne
   cochez pas, rien ne part. Il faut un délai automatique.
4. **La règle nouvelle du rendez-vous.** Telle qu'elle est écrite, c'est vous qui décidez s'il y a eu
   rendez-vous. Si vous n'appelez pas l'entreprise, l'apporteur perd tout. Il faut vous engager à
   appeler, et dire que votre silence vaut validation.
5. **Le formulaire d'entrée.** Il parle de « poste », demande dix ans de parcours, la zone, les
   déplacements, la disponibilité. C'est un formulaire d'embauche. Il faut le réduire à l'essentiel.
6. **L'annonce « commercial terrain ».** Elle décrit un vrai poste de vendeur. À retirer.
7. **La concurrence.** Votre guide d'entretien écarte ceux qui travaillent pour un concurrent. Votre
   contrat dit le contraire. À supprimer du guide.

**Ce qu'il faut corriger ensuite.**

- Les mots « candidature », « retenu », « bienvenue dans le réseau », « recrutement » dans les
  messages et dans l'outil. On ne recrute pas un indépendant : on signe un contrat avec lui.
- Ne plus proposer le réseau à quelqu'un qui cherchait un emploi salarié chez vous.
- Ne plus conseiller de « créer une micro-entreprise » pour entrer.
- La charte de marque : protéger votre logo, oui ; dire à l'apporteur comment écrire, non.
- Le « manquement » : prévenir d'abord, laisser répondre, décider après.
- Toujours écrire à l'apporteur quand vous refusez une entreprise, baissez ou reprenez une commission,
  avec la raison et la pièce.
- Ne pas reprendre une commission quand c'est vous qui faites un geste au client.

**Ce que vous risquez.** Si un apporteur est reconnu salarié : salaires, cotisations, indemnités, et
une indemnité de six mois de salaire pour travail dissimulé, par personne. S'il est reconnu agent
commercial : une indemnité de fin de contrat, souvent comptée en années de commissions. Si une clause
est jugée déséquilibrée : elle saute, et vous payez ce qu'elle vous évitait de payer.

**À faire cette semaine.** Montrer ce rapport à un avocat (les questions sont prêtes en section 8).
Corriger les sept points ci-dessus. Ne pas mettre la règle du rendez-vous en service avant sa
réécriture.

---

## 10. Ce que je n'ai pas pu vérifier

**La pratique réelle.** Rien de ce qui se dit en visio, au téléphone ou par messagerie hors système.
Aucune donnée de production : je ne sais pas combien d'apporteurs ont signé, quelle version, ni si un
retrait, une résiliation ou un manquement a déjà été appliqué.

**Ce qui est en ligne.** Je n'ai pas vérifié si l'offre « commercial terrain » est publiée, ni les
annonces réellement diffusées sur les sites d'emploi et les réseaux sociaux, ni le film de la page
vidéo et ses sous-titres, ni le PDF de plaquette diffusé.

**Quatre branches demandées n'existent pas** sur le dépôt distant : `feat/apporteurs-rdv-lot2-regles`,
`feat/apporteurs-espace-documents`, `feat/apporteurs-documents-joints`,
`feat/apporteurs-espace-aide`. La règle nouvelle n'est donc auditée que sur ses données (lot 1) et
deux gabarits (lot 7a), pas sur sa logique. D'autres branches anciennes touchant aux apporteurs
(contrat 2.7, manquement et fraude, rappels de dossier) existent, non fusionnées et datées d'octobre :
non lues.

**Fichiers lus seulement en partie ou par recherche de mots.**

- Tests : seuls les titres de la plupart ont été lus.
- `CommercialApplicationWizard.tsx`, `wizard-state.ts` : extraits.
- Les 15 images intégrées de la plaquette ; les fichiers de dessin et d'archive des outils de
  communication ; le rendu réel des écrans et des visuels.
- `appel-rappel.tsx` (briques communes des rappels de rendez-vous) et les alertes internes : survolés.
- Les modèles `Submission` et `JobApplication` du schéma : extraits.
- La vue « Contacts › Commercial » de la console (tri éventuel par note) : non lue.
- La source de la charte, hors dépôt : je n'ai pas pu vérifier qu'elle est identique à la version
  servie.

**Limites de méthode.**

- Les zones autres que le contrat et la charte ont été lues par des lectures déléguées. J'ai recoupé
  une soixantaine de citations, pas toutes : une erreur de numéro de ligne reste possible sur celles
  que je n'ai pas revérifiées.
- L'absence d'un e-mail (résiliation, retrait, démenti, réduction) est déduite de la liste des gabarits
  et de la recherche des appels d'envoi dans les fichiers concernés, pas d'un essai en conditions
  réelles.
- Les références de jurisprudence n'ont pas été vérifiées dans une base : voir section 6.
- Les correctifs « mot pour mot » sont des propositions de rédaction à faire relire, pas des textes
  prêts à signer.
