/**
 * Le texte du contrat d'apporteur d'affaires, VERSION 2 — texte de travail, à valider par Will
 * avant la première signature (2026-10-05).
 *
 * GÉNÉRÉ depuis `_APPORTEURS-DEMARRAGE-2026-10-05/CONTRAT-APPORTEUR-V2.md` (hors dépôt) :
 * gabarit v1 d'Axion Partners + décisions du 28/09 au 05/10. Les valeurs de la Société et
 * de la grille sont remplies ; restent les variables de l'apporteur ({{APPORTEUR_…}}) et
 * la date de la grille ({{GRILLE_DATE}}), remplies à la génération de chaque contrat.
 *
 * ⚠️ Ne pas retoucher à la main : toute modification du contrat est un avenant (art. 13)
 * et doit d'abord être validée par Williams.
 */

// 2.1 (07/10/2026, décision de Will) : commission par produit et produits créés après la signature
// (annexe 1, A1.7 ; renvois aux articles 4.1, 13.1 et 17). Nouvelle empreinte du texte signé.
// 2.2 (07/10/2026, décision de Will) : déclaration par le seul formulaire (3.2), attribution
// définitive aussi sur confirmation écrite de la Société (3.2), 6 mois à compter de la DÉCLARATION
// sans fin anticipée à 90 jours (3.4), prise en charge alignée (3.5). Nouvelle empreinte.
// 2.3 (07/10/2026, décision de Will) : commission due sur une prestation RÉALISÉE et encaissée,
// reprise quelle que soit la cause (garde-fou contre la privation volontaire), suspension en
// cas de contestation écrite du client, reprise sur 24 mois, fraude (3.7, 8.4), CPF constaté après.
// 2.4 (08/10/2026, décision de Will) : identification par le SIRET de l'établissement (première
// page : « dont l'établissement est situé »), article 22 bis « Communication et image de marque »
// (droit d'usage encadré de la marque), article 22 assoupli en conséquence ; 22 et 22 bis dans les
// manquements (11.2), 22 bis dans la garantie (8.5), 22 bis.4 dans la survie (21). Nouvelle empreinte.
// 2.5 (09/10/2026, décision de Will) : la signature tient en deux cases (« je certifie » et
// « j'accepte le contrat », qui énumère les articles 3.7, 4.5, 5.2, 7, 12 et 14) ; les mentions
// « case d'acceptation distincte » sont retirées. Un Apporteur société est désigné par sa
// dénomination, « représentée par » la personne physique qui signe.
// 2.6 (09/10/2026, décision de Will) : l'attribution porte sur l'ÉTABLISSEMENT déclaré (SIRET),
// commissionné sur ses seules commandes ; la Société peut, à sa seule discrétion et sur demande,
// l'étendre à toute l'entreprise (SIREN). L'antériorité (3.3) se juge par établissement.
// 2.8 (25/11/2026, OUI final de Will ; la 2.7 n'a jamais été fusionnée) : réservation provisoire de
// 60 jours et validation au premier rendez-vous tenu ou à la commande signée (3.2, 3.3, 3.4, 3.4 bis,
// 3.5, 3.7, 4.4, 11.1 bis, 12.1, 12.3) ; aucun résultat attendu (2.2) ; définitions et prix public
// (4.0) ; grille « version 3 », remise au prorata, déduction de la Journée IA, fait générateur à
// l'encaissement intégral de la part commissionnable sans condition de réalisation, virement sous
// 30 jours, reprise en cas de remboursement de la garantie (4.1 à 4.5, annexe 1) ; commission brute
// (6.5) ; information RGPD dans le premier message (7.2) ; résiliation par courrier électronique
// (11.1) ; avenant et dispositions transitoires 2.6 vers 2.8 (13) ; hiérarchie avec l'annexe 1 bis,
// fiche des commissions (17) ; licence de marque (22 bis). La version 2.6 est conservée dans
// l'historique git (`git log -- contrat-v2.ts`) et, pour chaque signataire, dans sa signature
// (`texte`, `texteSha256`, `version`). Nouvelle empreinte du texte signé.
export const CONTRAT_VERSION = "2.8";

export const CONTRAT_V2_MARKDOWN = `## Contrat d'apporteur d'affaires

**Entre les soussignés :**

**AXION IA SAS**, société par actions simplifiée au capital de 1 000 €, immatriculée sous le
numéro SIREN 108 018 631 (SIRET 108 018 631 00011), numéro de TVA intracommunautaire FR51108018631, dont le
siège est 11 avenue Paul Verlaine, Elite Bureaux boîte 53, 38100 Grenoble, représentée par
M. Williams Jullin, en qualité de Président, ci-après « **la Société** »,

**et**

**{{APPORTEUR_PARTIE}}**, {{APPORTEUR_STATUT}}, {{APPORTEUR_IMMATRICULE}} sous le numéro SIREN {{APPORTEUR_SIREN}},
{{APPORTEUR_ETABLISSEMENT}}{{APPORTEUR_REPRESENTANT}}, ci-après « **l'Apporteur** »,

**il a été convenu ce qui suit.**

---

### Article 1 — Objet du contrat 

**1.1** Le présent contrat a pour objet de définir les conditions dans lesquelles la Société rémunère
l'Apporteur lorsque celui-ci lui signale une entreprise susceptible d'être intéressée par ses prestations,
déclarée selon les modalités de l'article 3. **L'Apporteur n'est tenu d'aucune obligation de signalement :
il signale s'il le souhaite et quand il le souhaite, et le présent contrat ne met à sa charge aucune
obligation d'activité.**

**1.2** **L'Apporteur n'est investi d'aucun mandat.** Il ne représente pas la Société, ne négocie
aucune condition, aucun prix, aucun délai, ne conclut aucun contrat et ne prend aucun engagement au nom
ou pour le compte de la Société. Il ne dispose d'aucun pouvoir de la lier.

**1.3** La Société conserve la totalité de la relation commerciale : elle qualifie, propose, négocie,
conclut, facture et encaisse seule. Elle demeure libre de donner suite ou non à toute entreprise déclarée,
sans avoir à motiver sa décision. Cette liberté s'exerce de bonne foi : la Société ne peut s'abstenir de
donner suite, différer la signature d'une commande ou son encaissement dans le seul but de faire échec au
droit à commission de l'Apporteur.

**1.4** Le présent contrat est un contrat d'entreprise de droit commun. **Il ne constitue ni un contrat
d'agence commerciale au sens des articles L.134-1 et suivants du code de commerce, ni un contrat de
travail.** Les parties écartent expressément **tout pouvoir de l'Apporteur de négocier et de conclure**,
et toute représentation de la Société. L'Apporteur n'est chargé d'aucune mission
durable d'entremise : chaque déclaration épuise son objet à la date où elle est faite, et l'attribution qui
en naît est bornée dans le temps et non reconductible (articles 3.4 et 3.4 bis).

---

### Article 2 — Indépendance de l'Apporteur 

**2.1** L'Apporteur exerce une activité indépendante. Il organise librement son activité, ses horaires,
ses méthodes, ses moyens et ses déplacements.

**2.2** **Aucun objectif, aucun quota, aucun volume minimum ne lui est assigné.** L'absence d'activité de l'Apporteur, quelle qu'en soit la durée, n'est pas un manquement contractuel : elle ne peut fonder ni une mise en demeure, ni une suspension au titre de l'article 3.7, ni une résiliation au titre de l'article 11.2, ni aucune conséquence sur les réservations provisoires, sur les attributions en cours ou sur les commissions acquises ou à venir. **L'Apporteur n'est tenu à aucun résultat : ni l'absence de rendez-vous d'une entreprise qu'il a déclarée, ni la fin d'une réservation provisoire (article 3.2), ni le nombre ou la fréquence de ses déclarations ne constituent un manquement, et aucun ne peut fonder l'une de ces mesures.** **La faculté reconnue à chacune des parties par l'article 11.1 de résilier sans avoir à motiver sa décision demeure entière.**

**2.3** **Aucun compte rendu d'activité ne lui est demandé**, à l'exception des seules informations
d'identification énumérées à l'article 3.2, nécessaires à la Société pour reprendre le contact, et qui ne
constituent pas un compte rendu d'activité. Les outils mis à sa disposition par la Société — espace en
ligne, **documents de présentation**, documentation, réunions d'information — sont proposés à son usage
libre ; leur utilisation n'est pas une condition du contrat. **Le support de déclaration désigné à l'article 3.2 fait exception : il conditionne l'effet de la
déclaration ; l'Apporteur demeure entièrement libre de déclarer ou de ne pas déclarer.**

**2.4** **Aucune exclusivité n'est consentie**, ni au profit de l'Apporteur sur un territoire, un secteur
ou une clientèle, ni au profit de la Société sur l'activité de l'Apporteur. L'Apporteur demeure libre
d'exercer toute autre activité, y compris auprès d'entreprises concurrentes ; **la seule limite est
l'obligation de non-divulgation de l'article 9, qui ne restreint aucune activité.**

**2.5** L'Apporteur supporte seul ses frais. Il ne perçoit aucune rémunération fixe, aucun remboursement,
aucune avance, et n'est redevable d'aucun droit d'entrée ni d'aucune contribution. Il ne bénéficie
d'aucun régime ni d'aucun avantage réservé aux salariés de la Société, aucun n'étant dû au titre du présent
contrat.

**2.6** Le contrat est conclu en considération de la personne de l'Apporteur : il ne peut ni le céder ni le
transférer (article 16). Cette considération tient à ce que la déclaration suppose un contact personnel
avec l'entreprise déclarée ; elle n'emporte aucun mandat ni aucune mission de représentation. L'Apporteur
demeure libre de s'organiser comme il l'entend et **de recourir aux moyens humains de son choix — associés,
préposés ou sous-traitants —, dont il répond seul envers la Société ; il en assume la rémunération,
l'encadrement et les obligations légales, et aucune relation contractuelle ne naît entre eux et la
Société.** Seules ouvrent droit à attribution les déclarations portant sur des entreprises dont l'Apporteur,
ou une personne agissant pour son compte et déclarée à la Société, a effectivement rencontré ou joint un
représentant ; l'Apporteur en répond au titre de l'article 3.7.

**2.7** Aucun message, notification, contenu ou fonctionnalité de l'espace en ligne, des documents de
présentation, de la documentation ou des courriers électroniques de la Société ne constitue une
instruction, une directive, une consigne de méthode ou une demande de compte rendu, et aucun ne peut être
invoqué comme tel. L'Apporteur n'est tenu à aucune fréquence de connexion à l'espace en ligne ; l'absence
de réponse à un message de la Société, quelle qu'en soit la durée, n'emporte aucune conséquence.

**2.8 — Période de démarrage.** Tant que l'espace en ligne n'est pas ouvert, aucune date d'ouverture
n'étant promise, les déclarations de l'article 3.2 sont faites par le seul formulaire du lien personnel ;
les notifications de l'article 20, les autofactures et leurs décomptes (article 5) sont
adressés par courrier électronique ; toute mention de l'espace en ligne s'entend de ces échanges.

Les délais qui courent de plein droit (articles 3.2, 3.4, 3.5, 3.7 et 5.1 à 5.5) et les échéances de paiement ne sont ni suspendus ni prorogés par la présente période. **Elle ne reporte aucun délai de paiement (article 5.3 ; article L.441-10 du code de commerce) et ne suspend aucune pénalité de retard. L'encaissement, au sens de l'article 4.0, s'entend du jour où la somme est créditée sur le compte bancaire de la Société, quels que soient le moyen de paiement et le payeur.**

Les opérations que le contrat confie à la Société (enregistrement des déclarations, refus, constats de validation, informations, autofactures, décomptes, réponses) sont effectuées manuellement ; elles le sont dans les délais que le contrat fixe et, à défaut, dans un délai raisonnable. Le retard de la Société dans l'une de ces opérations ne prive l'Apporteur d'aucun droit et ne vaut pas renonciation de la Société à se prévaloir de la stipulation concernée.

Les stipulations qui supposent une fonction de l'espace en ligne non ouverte (vérification d'entreprise par
l'Apporteur, liste des filleuls, consultation du registre) s'appliquent à compter de son ouverture ; dans
l'intervalle, l'information correspondante est donnée par courrier électronique sur demande. Le présent
article ne crée aucune obligation nouvelle à la charge de l'Apporteur. Si l'espace en ligne est ouvert, la
Société en informe l'Apporteur ; les déclarations, attributions et commissions nées auparavant y sont
reprises avec leur date d'origine.

---

### Article 3 — Déclaration des entreprises et attribution 

**3.1 — Clé d'attribution.** L'attribution porte sur l'**établissement déclaré**, identifié par son
**numéro SIRET** (14 chiffres) : l'Apporteur n'est commissionné que sur les commandes de cet établissement.
Un établissement ne peut être attribué qu'à un seul Apporteur ; plusieurs établissements d'une même entreprise
peuvent être attribués à des Apporteurs différents.

À la demande de l'Apporteur, notamment lorsqu'il a rencontré la direction de l'entreprise, la Société peut,
**à sa seule discrétion** et par écrit, étendre l'attribution à l'ensemble des établissements de l'entreprise
(numéro SIREN) qui ne sont pas déjà attribués à un autre Apporteur. Elle n'est jamais tenue de le faire, et
son refus n'a pas à être motivé. L'extension suit le sort de l'attribution qu'elle étend (durée,
prolongation, fin).

Dans le présent contrat, l'**entreprise attribuée** s'entend de l'établissement attribué ou, en cas
d'extension, de l'ensemble des établissements qu'elle couvre. L'établissement qui commande est celui dont le
numéro SIRET figure sur le devis ou la commande, à défaut sur la fiche du client. L'extension n'emporte pas un
établissement que la Société connaît déjà au sens de l'article 3.3, apprécié établissement par établissement.

Lorsque la commande ne peut être rattachée à une attribution ou à une réservation provisoire, faute de numéro SIRET ou faute de correspondance, la Société procède elle-même au rattachement dans les **quinze jours** de l'encaissement intégral. La commission qui en résulte reste due ; le délai de paiement de l'article 5.3 court à compter de ce rattachement, et ce délai ne prive l'Apporteur d'aucun droit. Lorsque la Société constate qu'aucune attribution ni aucune réservation provisoire ne correspond à la commande, ou qu'elle revient à un autre Apporteur, elle en informe l'Apporteur concerné par écrit et motive sa décision ; il peut la contester par écrit, et la Société y répond de façon motivée dans les trente jours.

**3.2 — Déclaration, réservation provisoire et validation.** La réservation naît de la **déclaration** de l'entreprise, faite par l'Apporteur **au moyen du seul formulaire** accessible depuis son lien personnel et, une fois l'espace en ligne ouvert, de celui qu'il contient. **Une déclaration adressée par tout autre moyen, notamment par courrier électronique, est sans effet** : la Société invite alors l'Apporteur à utiliser le formulaire. Aucun droit n'est acquis du seul fait d'une démarche non déclarée.

La déclaration comporte l'identification de l'entreprise et le **numéro SIRET de l'établissement** visité, le **nom et la fonction de la personne rencontrée**, un **moyen direct de la joindre**, à savoir son adresse électronique et son numéro de téléphone, et la **date du contact**. Cette date n'est recueillie qu'aux seules fins des articles 3.4 bis et 3.7 ; l'adresse électronique sert en outre au premier message que la Société adresse à la personne (article 7.2) et au rattachement d'un rendez-vous à la déclaration. Aucune de ces données ne fait l'objet d'une exploitation statistique.

**Réservation provisoire.** La déclaration enregistrée fait naître, au profit de l'Apporteur, une **réservation provisoire** de l'établissement déclaré, pour une durée de **60 jours**, qui prend fin au terme du 60e jour, à minuit, heure de Paris ; le jour de l'enregistrement de la déclaration, constaté par l'horodatage du serveur de la Société, compte pour le premier jour. Pendant cette durée, l'établissement ne peut être ni réservé ni attribué à un autre Apporteur, ni pris en charge par la Société (article 3.5). La date de fin de la réservation est indiquée à l'Apporteur lors de l'enregistrement.

**Validation par le rendez-vous.** L'attribution devient **définitive** au **premier rendez-vous qui a eu lieu** entre la Société et un représentant de l'établissement déclaré, **dès lors que ce rendez-vous a été pris pendant la réservation provisoire**. Le rendez-vous peut avoir lieu après le terme des 60 jours : seule la date à laquelle il a été pris doit se situer dans ce délai. L'attribution est définitive à la date à laquelle le rendez-vous a eu lieu, quels qu'en soient la durée et le résultat.

Le rendez-vous s'entend d'un entretien entre la Société et un représentant de l'établissement déclaré — la personne déclarée ou toute autre personne agissant pour cet établissement —, tenu **en visio, par téléphone ou en personne**. Il est pris à la date à laquelle sa tenue est convenue ; l'entretien qui a lieu sans avoir été fixé à l'avance est réputé pris le jour où il a lieu. Le report, convenu entre la Société et l'entreprise, d'un rendez-vous pris pendant la réservation provisoire conserve la date à laquelle ce rendez-vous a été pris. Un rendez-vous annulé sans être reporté, ou auquel l'entreprise ne s'est pas présentée, n'a pas eu lieu ; un rendez-vous annulé, manqué ou reporté par l'entreprise ne valide pas l'attribution tant qu'il n'a pas eu lieu.

**Le rendez-vous pris pendant la réservation provisoire et qui n'a pas lieu du fait de la Société, notamment parce qu'elle l'a annulé, est réputé avoir eu lieu à la date à laquelle il était fixé** (article 1304-3 du code civil). La Société ne peut refuser, différer ou annuler un rendez-vous, ni s'abstenir d'en constater la tenue, dans le seul but de faire échec à la validation (article 1.3).

Lorsqu'un rendez-vous pris pendant la réservation provisoire n'a pas encore eu lieu au terme des 60 jours, la réservation est maintenue jusqu'au jour où il a lieu. Elle prend fin si ce rendez-vous est annulé ou n'est pas honoré par l'entreprise sans qu'un report soit convenu dans les quinze jours.

**Un rendez-vous pris avant l'enregistrement de la déclaration est sans effet sur celle-ci**, quelle que soit la date à laquelle il a lieu.

**Validation par la commande.** La **commande** de l'établissement déclaré (article 4.4) signée pendant la réservation provisoire **vaut validation**, même en l'absence de tout rendez-vous : l'attribution est définitive à la date de cette signature et la commande est commissionnée dans les conditions de l'article 4. Ne vaut pas validation la signature d'un devis émis par la Société avant la déclaration : l'établissement relevait alors de l'article 3.3.

**Rattachement.** La validation n'est pas subordonnée à ce que l'entreprise cite l'Apporteur. La Société recherche elle-même, sur les données dont elle dispose, les rendez-vous et les commandes des établissements réservés. L'Apporteur peut, s'il le souhaite, lui signaler un rendez-vous par tout moyen ; il n'y est jamais tenu et l'absence de signalement ne le prive d'aucun droit. Lorsqu'un rendez-vous ne permet pas de savoir pour quel établissement d'une même entreprise la personne agit, il est rattaché à l'établissement dont la personne déclarée a pris le rendez-vous et, à défaut, à celui dont la déclaration porte l'horodatage le plus ancien.

**Constat et information.** La Société constate la validation et **en informe l'Apporteur par courrier électronique dans les cinq jours ouvrés** suivant le jour où le rendez-vous a eu lieu ou la commande a été signée, en indiquant la date de la validation et le terme de l'attribution. La validation résulte du rendez-vous ou de la commande eux-mêmes : le retard de la Société à la constater ou à en informer l'Apporteur ne le prive d'aucun droit. La Société inscrit au registre de l'article 3.5 la date à laquelle le rendez-vous a été pris, celle à laquelle il a eu lieu et sa forme ; ces mentions font foi entre les parties **jusqu'à preuve contraire**, que l'Apporteur peut rapporter par tout moyen. Il peut contester par écrit l'absence de validation ; la Société y répond de façon motivée dans les trente jours, en lui communiquant l'extrait du registre relatif à sa déclaration.

**Fin de la réservation provisoire.** À défaut de rendez-vous pris ou de commande signée pendant la réservation provisoire, celle-ci **prend fin de plein droit** à son terme. **Cette fin n'est jamais un manquement et n'emporte aucune autre conséquence** : elle ne peut fonder aucune des mesures mentionnées à l'article 2.2, et l'Apporteur peut déclarer à nouveau la même entreprise dans les conditions de l'article 3.4 bis, sans limite de nombre. **Le silence de l'entreprise ne vaut jamais validation** ; il ne vaut pas davantage indication au sens de l'article 3.7. Pendant les 30 jours qui suivent la fin de la réservation provisoire sans validation, personne d'autre ne peut déclarer cette entreprise et la Société ne la démarche pas (article 3.5) ; l'Apporteur peut la déclarer à nouveau dans les conditions de l'article 3.4 bis. Dans l'exemple d'une déclaration du 10 janvier, la réservation court jusqu'au 10 mars inclus, puis ces 30 jours jusqu'au 9 avril.

L'Apporteur n'a l'obligation ni d'obtenir un rendez-vous, ni d'en obtenir un nombre déterminé, ni d'accomplir aucune démarche après sa déclaration. La validation ne fait naître par elle-même aucune commission : la commission ne naît que dans les conditions de l'article 4.

**L'Apporteur est informé que ses prénom et nom sont communiqués à la personne qu'il déclare**, comme source de ses coordonnées, dans le premier message que la Société lui adresse (article 7.2) ; ses coordonnées ne lui sont pas communiquées.

**3.3 — Antériorité de la Société.** Aucune réservation ni aucune attribution ne peut porter sur un établissement que la Société connaît déjà à la date de la déclaration, c'est-à-dire **client au titre d'une prestation facturée au cours des vingt-quatre derniers mois, destinataire d'un devis de moins de six mois, ou ayant signé un devis qui n'a été ni entièrement facturé, ni annulé, quelle que soit sa date**. La Société enregistre la déclaration ; lorsqu'elle constate, sur les données dont elle dispose, que l'établissement lui est déjà connu au sens du présent alinéa ou est déjà réservé ou attribué à un autre Apporteur, elle refuse la déclaration par une décision motivée adressée à l'Apporteur, sans lui révéler l'identité de l'occupant (article 3.5). À défaut, la déclaration fait naître une réservation provisoire jusqu'à sa validation (article 3.2). **Lorsque l'antériorité est établie après l'enregistrement de la déclaration et avant la validation, la réservation est annulée, l'Apporteur en est informé avec le motif, et aucune commission nouvelle n'est due ; les commissions déjà acquises restent acquises. Après la validation, l'attribution ne peut plus être annulée au titre du présent article, sauf erreur d'identification de l'entreprise, signature d'un devis émis avant la déclaration (article 3.2) ou fraude de l'Apporteur ; les commandes signées et les commissions acquises avant l'annulation restent commissionnées. L'Apporteur peut contester un refus ou une annulation par écrit ; la Société y répond de façon motivée dans les trente jours.**

**3.3 bis — Autres cas de refus.** Est également refusée la déclaration portant sur : (a) une entreprise dont l'établissement déclaré est administrativement cessé ; (b) une administration ou un organisme avec lequel la Société est en relation, figurant sur une liste tenue par la Société, dont l'existence et le principe sont portés à la connaissance de l'Apporteur ; (c) une entreprise pour laquelle deux déclarations sont déjà en attente au sens de l'article 3.5 ; (d) une personne inscrite au registre d'opposition au démarchage tenu par la Société. Le refus est notifié avec sa catégorie ; il n'emporte aucune autre conséquence et n'est pas un manquement.

**3.4 — Durée de l'attribution définitive.** L'attribution définitive est consentie pour **6 mois à compter du jour où le rendez-vous a eu lieu** ou, lorsqu'elle résulte d'une commande (article 3.2), **du jour de la signature de cette commande**. Elle ne prend pas fin avant ce terme, sous réserve des articles 3.3, 3.7 et 12.1. À son terme, prolongé le cas échéant dans les conditions de l'alinéa suivant, l'entreprise redevient librement déclarable, dans les conditions de l'article 3.4 bis.

**L'attribution définitive est prolongée de trois mois, une seule fois et sans démarche de l'Apporteur, lorsqu'au terme de la période l'une des conditions suivantes est remplie : (a) un devis émis par la Société à l'entreprise est en cours ; (b) la Société a tenu un rendez-vous ou eu un échange avec l'entreprise au cours des trente derniers jours ; (c) une demande de financement de la prestation par un tiers est en cours d'instruction.** Ces conditions s'apprécient sur les seules données de la Société ; aucune ne dépend de l'activité de l'Apporteur. Un devis est en cours tant qu'il n'est ni signé, ni refusé, ni expiré. L'Apporteur est informé de la prolongation. **La prolongation est réservée aux attributions définitives : la réservation provisoire n'est jamais prolongée, sous la seule réserve de son maintien jusqu'à un rendez-vous déjà pris (article 3.2).**

*Exemple : une entreprise est déclarée le 10 janvier ; elle est réservée jusqu'au 10 mars inclus. Elle prend rendez-vous le 2 mars, pour le 18 mars : le rendez-vous a lieu, l'attribution est définitive le 18 mars et court jusqu'au 18 septembre. La Société a un échange avec l'entreprise le 1er septembre : l'attribution est prolongée jusqu'au 18 décembre, et une commande signée en novembre est commissionnée.*

**3.4 bis — Absence de reconduction.** Ni la réservation provisoire ni l'attribution définitive **ne se renouvellent** ; elles ne font l'objet d'aucune reconduction, tacite ou automatique. À leur terme, elles s'éteignent de plein droit. L'Apporteur ne peut pas déclarer à nouveau une entreprise devenue cliente de la Société : celle-ci relève désormais de l'article 3.3.

L'Apporteur dont la réservation provisoire ou l'attribution définitive est arrivée à son terme peut déclarer à nouveau la même entreprise en indiquant un **nouveau contact** avec l'un de ses représentants, postérieur à ce terme, dont la date figure à la déclaration. **Cette faculté n'est soumise à aucun plafond, à aucun compteur, à aucun délai d'attente et à aucun rythme** ; la nouvelle déclaration fait naître une nouvelle réservation provisoire, à son propre horodatage, sous réserve de la priorité reconnue par l'article 3.5 à l'Apporteur dont la déclaration est en attente.

*Cette absence de reconduction est une condition essentielle du présent contrat.*

**3.5 — Entreprise déjà prise, concours entre Apporteurs.** Une entreprise peut être déjà prise **par un autre apporteur ou par la Société ou ses préposés**, les préposés de la Société s'entendant des personnes qu'elle emploie, et non des préposés de l'Apporteur mentionnés à l'article 2. Est prise l'entreprise qui fait l'objet d'une réservation provisoire, d'une attribution définitive ou d'une prise en charge en cours. **L'effet pour l'Apporteur est le même quel que soit l'occupant, et la Société ne révèle jamais qui occupe une entreprise donnée.** Lorsque deux Apporteurs déclarent la même entreprise, ou lorsqu'une déclaration et une prise en charge par la Société ou ses préposés portent sur la même entreprise, **la première déclaration ou prise en charge prime** : l'entreprise revient à celui dont la déclaration ou la prise en charge porte **l'horodatage serveur le plus ancien**, qui conserve l'intégralité de sa réservation provisoire. Cette règle s'applique de plein droit, sans appréciation de la Société, quelles que soient la durée ou l'intensité des démarches invoquées, et quel que soit l'Apporteur que l'entreprise cite lors d'un rendez-vous. Lorsqu'une réservation ou une attribution a été enregistrée par erreur au profit d'une déclaration postérieure, la Société rétablit l'ordre résultant des horodatages dès qu'elle constate l'erreur et en informe l'Apporteur avec le motif ; les commandes signées avant cette information, par une entreprise dont l'attribution lui avait été notifiée comme définitive, restent commissionnées à son profit.

L'Apporteur dont la déclaration est postérieure est informé que l'entreprise n'est pas disponible ; **l'identité de celui qui l'occupe ne lui est jamais communiquée**. **Deux déclarations au plus sont conservées en attente par entreprise, dans l'ordre de leur horodatage ; au-delà, la déclaration n'est pas conservée et l'Apporteur en est informé. Lorsque la réservation provisoire ou l'attribution en cours, ou la prise en charge de l'entreprise par la Société ou ses préposés, prend fin, l'Apporteur dont la déclaration est en attente au premier rang en est informé et dispose de quinze jours pour déclarer à nouveau l'entreprise ; lorsque la réservation provisoire a pris fin à son terme sans validation, ces quinze jours ne s'ouvrent qu'à l'expiration des 30 jours qui suivent la fin de la réservation provisoire (article 3.2) ; à défaut, sa déclaration est effacée et l'entreprise redevient librement déclarable par tous. Ce délai ne court pas tant que l'enregistrement des déclarations de l'Apporteur est suspendu en application de l'article 3.7 ; il reprend, pour sa durée restante, à la fin de la suspension. Aucune réservation ne naît d'une déclaration conservée sans nouvelle déclaration de l'Apporteur ; la nouvelle déclaration fait naître une réservation provisoire dans les conditions de l'article 3.2. Une déclaration en attente s'éteint en tout état de cause douze mois après son enregistrement.** Ne pas déclarer à nouveau dans ce délai n'est pas un manquement et n'emporte aucune autre conséquence.

**La prise en charge d'une entreprise par la Société ou ses préposés obéit aux mêmes bornes que celles qui s'imposent à l'Apporteur**, la Société et l'ensemble de ses préposés comptant pour un seul occupant. Elle vaut pour **60 jours**, décomptés comme à l'article 3.2 à partir de son enregistrement ; elle ne se poursuit, pour **6 mois**, que si un rendez-vous pris pendant ces 60 jours a eu lieu, à compter de ce rendez-vous, ou si une commande a été signée pendant ces 60 jours, à compter de cette signature. La prolongation de l'article 3.4 ne s'applique qu'une fois, dans les mêmes conditions ; la prise en charge ne fait l'objet d'aucune reconduction (article 3.4 bis). **La Société ne prend pas en charge une entreprise pendant le délai de quinze jours ouvert à l'Apporteur en attente au premier rang.**

**La Société conserve dans ses propres outils, et peut utiliser à ses propres fins commerciales, les entreprises déclarées par l'Apporteur et les coordonnées qu'il a transmises, y compris pour les démarcher elle-même ou par ses préposés. Cette utilisation ne retire rien aux droits de l'Apporteur : pendant la réservation provisoire et pendant la durée de l'attribution, toute commande de l'entreprise est commissionnée dans les conditions de l'article 4.4, et tout rendez-vous est pris en compte dans les conditions de l'article 3.2, qu'ils résultent des démarches de l'Apporteur, de celles de la Société ou de ses préposés, ou d'une initiative de l'entreprise. La Société peut, sans y être tenue, prendre contact avec l'entreprise déclarée pour lui présenter ses services et la relancer par tout moyen dès l'enregistrement de la déclaration, sans que cela retire quoi que ce soit aux droits de l'Apporteur. Dans les 30 jours qui suivent une vérification d'entreprise faite par l'Apporteur, une déclaration de sa part refusée ou en attente, ou la fin de sa réservation provisoire sans validation, la Société ne démarche pas l'entreprise concernée et ne la prend pas en charge ; cette réserve ne s'applique ni à une entreprise que la Société connaissait déjà au sens de l'article 3.3, ni à une entreprise dont une réservation, une attribution ou une prise en charge au profit d'un autre occupant était en cours à la date de cette vérification, de cette déclaration ou de cette fin. Pendant les 30 jours qui suivent la fin d'une réservation provisoire sans validation, aucun autre Apporteur ne peut non plus déclarer l'entreprise.**

Les parties conviennent que l'horodatage attribué par le serveur de la Société fait foi entre elles **jusqu'à preuve contraire** pour l'application du présent article, conformément à l'article 1356 du code civil, **quel que soit l'occupant de l'entreprise**. Cet horodatage est inscrit dans un registre horodaté tenu par la Société, qui porte aussi les mentions de l'article 3.2 relatives aux rendez-vous ; l'Apporteur peut en obtenir sur simple demande un extrait relatif à ses propres déclarations, qui ne révèle pas qui occupe l'entreprise.

**3.6 — Groupes de sociétés.** Chaque personne morale dispose de son propre SIREN. L'attribution d'une
filiale n'emporte aucun droit sur sa société mère ni sur les autres sociétés du groupe.

Lorsqu'une commande est passée par une société distincte de celle qui a été déclarée, l'affaire est
rattachée à l'attribution existante dès lors que l'une des deux sociétés contrôle l'autre au sens de
l'article L.233-3 du code de commerce, ou que les deux sont contrôlées par une même personne, **ce lien de
contrôle devant exister à la date de la déclaration et être établi par les données publiques disponibles à
cette date ; un lien né postérieurement n'ouvre aucun droit. Le rattachement est décidé par la Société,
motivé et tracé ; l'Apporteur peut le demander en justifiant du lien de contrôle, et la décision lui est
notifiée avec son motif.** Aucun autre rattachement n'ouvre droit à commission.

**3.7 — Sincérité de la déclaration.** L'Apporteur ne déclare que des entreprises dont il a effectivement rencontré ou joint un représentant.

Lorsque le représentant de l'entreprise déclarée indique expressément n'avoir eu aucun échange avec l'Apporteur, la réservation provisoire ou l'attribution correspondante s'éteint et l'entreprise redevient librement déclarable. Vaut une telle indication la déclaration en ce sens faite spontanément par l'entreprise à la Société, lors d'un échange avec elle. **La Société ne demande à l'entreprise de confirmer aucun échange avec l'Apporteur et ne lui fait part d'aucune vérification le concernant.** Ne valent pas une telle indication l'impossibilité de joindre l'entreprise, son silence, l'absence de rendez-vous, l'absence de souvenir de l'échange, le fait de ne pas citer l'Apporteur, le changement d'interlocuteur ou le refus de répondre : ces circonstances n'emportent aucune autre conséquence que la fin de plein droit de la réservation provisoire à son terme (article 3.2). L'indication de l'entreprise est journalisée avec sa date, la personne qui l'a donnée, et ses termes ; l'extrait en est communiqué à l'Apporteur sur sa demande.

La Société peut suspendre l'enregistrement de nouvelles déclarations le temps d'une vérification. La suspension est notifiée avec les faits qui la motivent, lesquels ne peuvent être que l'indication de l'entreprise déclarée prévue au deuxième alinéa ou des éléments établissant la fabrication ou l'automatisation d'une déclaration. **Aucune suspension ne peut être fondée, même partiellement, sur le nombre de déclarations, sur leur rythme, sur le nombre de réservations provisoires arrivées à leur terme sans rendez-vous, sur le nombre de déclarations renouvelées, sur l'heure ou le lieu depuis lesquels elles sont faites, ni sur la zone, le secteur ou la méthode de l'Apporteur.** Elle n'obéit à aucun barème, à aucun compteur et à aucun seuil. Elle porte exclusivement sur l'enregistrement de nouvelles déclarations : **elle est sans effet sur les réservations provisoires et les attributions en cours, sur les rendez-vous pris ou à venir, sur les commandes signées, sur les commissions acquises ou à venir, et sur l'accès de l'Apporteur à son espace.** Elle ne peut excéder quinze jours à compter de sa notification ; à l'expiration de ce délai elle est levée de plein droit, la Société demeurant libre de résilier dans les conditions de l'article 11.

**3.8 — Accès.** L'accès à l'espace en ligne et au formulaire de déclaration est personnel.
L'Apporteur conserve son lien personnel et ses moyens d'accès et ne les communique à aucun tiers. **Toute
déclaration enregistrée au moyen de son lien personnel ou de ses moyens d'accès est réputée émaner de lui**, sauf signalement immédiat d'un usage qu'il n'a
pas autorisé, auquel cas la Société révoque l'accès. La Société peut révoquer et renouveler à tout moment
un moyen d'accès pour un motif de sécurité, sans que cela n'affecte les attributions ni les commissions
acquises.

---

### Article 4 — Rémunération

**4.0 — Définitions.** Pour l'application du présent contrat : *encaissement* s'entend du crédit effectif des fonds sur un compte bancaire de la Société, quels que soient le moyen de paiement (virement, carte bancaire, prélèvement ou autre) et le payeur ; la date de l'encaissement est celle du jour où la somme est créditée sur ce compte ; *prix facturé* s'entend du prix de la commande, hors taxes, net des remises et des avoirs ; *prix public* s'entend du prix de référence hors taxes que l'annexe 1 attribue à la prestation ; *part commissionnable* s'entend des sommes de la commande qui ouvrent droit à commission selon l'annexe 1, à l'exclusion des sommes qu'elle déclare non commissionnées (A1.6) ; *commission acquise* s'entend de la commission dont le fait générateur de l'article 4.2 est intervenu ; *réservation provisoire*, *validation* et *attribution définitive* ont le sens que leur donne l'article 3.2, l'*attribution* s'entendant de l'attribution définitive ; *entreprise* s'entend de la personne morale ou de l'entrepreneur individuel titulaire du numéro SIREN ; *établissement* s'entend de l'établissement de l'entreprise identifié par son numéro SIRET.

**4.1 — Grille.** La rémunération est exclusivement constituée de commissions, selon la **grille figurant en annexe 1** (version 3 du {{GRILLE_DATE}}), annexée au présent contrat et en faisant partie intégrante. Les produits créés après la signature relèvent de l'annexe 1, A1.8. La fiche des commissions (annexe 1 bis) en est une présentation illustrée.

Cette grille est **propre au présent contrat**. Elle est arrêtée palier par palier avant la génération du contrat. Elle peut différer, à la hausse comme à la baisse, de la grille de référence que la Société publie ; les mentions de rémunération figurant sur les supports publics ou commerciaux de la Société sont **indicatives** et n'ont pas valeur contractuelle (article 17).

**Les prix de référence et les commissions de l'annexe 1 n'évoluent que par un avenant accepté par l'Apporteur (article 13).** La commission d'une commande est calculée d'après la version de la grille acceptée par l'Apporteur à la date de signature de cette commande. Une nouvelle version de la grille ne s'applique qu'aux ventes signées après l'acceptation de l'avenant correspondant par l'Apporteur ; à défaut d'acceptation, la dernière version acceptée continue de s'appliquer.

Lorsqu'un palier de la présente grille est inférieur à la valeur correspondante de la grille de référence publiée par la Société, **l'écart et son motif sont portés à la connaissance de l'Apporteur avant la signature**, dans le parcours de signature.

**4.1 bis — Remise.** Pour une prestation dont la commission est un forfait (annexe 1, A1.1 et A1.2), la commission de la commande est égale au forfait multiplié par le nombre de journées ou de sessions facturées et non annulées, réduit dans la proportion du prix facturé au prix public : commission = forfait × nombre × (prix hors taxes facturé de ces journées ou sessions ÷ prix public hors taxes de ces mêmes journées ou sessions), arrondie au centime le plus proche, **sans jamais excéder forfait × nombre**. **Toute remise, ristourne ou réduction de prix consentie au client, quelles qu'en soient la forme et la contrepartie — y compris lorsqu'elle est accordée en échange d'un témoignage ou d'un tournage —, diminue le prix facturé.** Une prestation offerte ne donne lieu à aucune commission. Lorsque plusieurs prestations sont vendues à un prix global, ce prix est réparti entre elles au prorata de leurs prix publics hors taxes et, à défaut de prix public pour l'une d'elles, selon la ventilation du devis. Un avoir ou un remboursement partiel diminue le prix facturé : la commission est recalculée sur le prix net selon la présente formule et la différence fait l'objet d'une reprise (article 4.5). **Une remise consentie dans le seul but de réduire la commission est sans effet sur celle-ci ; il en va de même d'une ventilation du prix entre la part commissionnable et les sommes non commissionnées arrêtée dans ce seul but.** L'autofacture, ou le décompte qui l'accompagne, indique, pour chaque commande concernée, le prix public, le prix facturé et la commission qui en résulte. Le pourcentage n'est pas concerné par la formule : il s'applique au montant hors taxes facturé de la part commissionnable, de sorte qu'une remise le réduit dans la même proportion.

**4.1 ter — Déduction du prix de la Journée IA.** Lorsque l'entreprise passe commande dans les **60 jours** qui suivent sa Journée IA et que la Société déduit de cette commande le prix de la Journée IA, **la commission de la Journée IA reste acquise à l'Apporteur en entier** : cette déduction n'est ni un avoir, ni un remboursement, ni une annulation de la Journée IA au sens de l'article 4.5, et ne donne lieu à aucune reprise. La commission de la commande ainsi passée est calculée sur son montant hors taxes facturé, après déduction, dans les conditions de l'annexe 1. La Société ne pratique cette déduction que dans les conditions prévues par ses conditions générales de vente, notamment lorsque la commande atteint au moins 5 000 € HT de mise en place payée en une fois, hors abonnements, avant déduction ; cette commande n'est commissionnée que si elle est signée pendant la durée de l'attribution (article 4.4).

**4.2 — Fait générateur.** **La commission est calculée une seule fois, sur le montant net hors taxes de la part commissionnable arrêté à la signature du devis ; elle n'est pas recalculée ensuite, sauf application de l'article 4.5. Elle est acquise et due dès que la Société a encaissé l'intégralité** du prix facturé au client au titre de la part commissionnable de la commande, tous payeurs confondus, même si le travail n'est pas terminé. Le versement a lieu par virement, au plus tard 30 jours après cet encaissement. Le paiement ou le défaut de paiement des sommes non commissionnées (annexe 1, A1.6) est sans effet sur l'acquisition de la commission ; lorsqu'une même facture porte une part commissionnable et des sommes non commissionnées, la commission est acquise à l'encaissement intégral de cette facture.

**Le retard, l'inexécution ou l'exécution partielle de la prestation par la Société ne diffère pas la commission une fois l'encaissement intégral constaté ; la commission n'est reprise que dans les cas de l'article 4.5 (impayé, remboursement, avoir, encaissement annulé).**

**4.2 bis — Contestation du client.** Tant qu'une contestation **écrite** du client portant sur la prestation
ou sur sa facture est en cours, la commission correspondante est **suspendue** : elle n'est ni facturée ni
versée. À l'issue de la contestation, elle est versée, ou fait l'objet d'une reprise, selon le prix finalement
conservé par la Société. L'Apporteur est informé de la suspension et de son issue.

**4.3 — Paiement partiel.** Aucune part de commission n'est due au titre d'un paiement partiel de la part commissionnable. La commission est facturée et versée dans les conditions de l'article 5, à compter de son encaissement complet ; l'autofacture est établie le jour de l'encaissement intégral, et le virement a lieu au plus tard 30 jours après cet encaissement.

**4.4 — Périmètre.** **On entend par commande le devis ou le bon de commande signé par l'entreprise ; la date retenue est celle de cette signature et, à défaut de document signé, la date de la commande passée en ligne ou, à défaut, la date d'émission de la première facture.**

**Une commande conclue sous condition suspensive est datée de sa signature ; elle est réputée n'avoir jamais existé si la condition défaille.** La défaillance de la condition rend la commande caduque, et cette caducité vaut annulation au sens de l'article 3.3 du devis qu'elle constitue, le cas échéant. Si la partie dans l'intérêt exclusif de laquelle la condition est stipulée l'abandonne avant sa défaillance, la commande conserve la date de sa signature. Une commande signée par l'entreprise après la défaillance constitue une nouvelle commande, datée de sa propre signature, qui n'est commissionnée que si elle est signée pendant la réservation provisoire ou pendant la durée de l'attribution.

Sont commissionnées toutes les commandes de l'entreprise attribuée **signées pendant la durée de l'attribution**, pour les prestations figurant à la grille — quel que soit leur nombre. **Est également commissionnée la commande signée pendant la réservation provisoire : elle vaut validation (article 3.2), et l'attribution court alors pour 6 mois à compter de sa signature (article 3.4).** Une commande signée entre la déclaration et un rendez-vous qui valide ensuite l'attribution est réputée signée pendant la durée de l'attribution. **La Société ne demande à l'entreprise de confirmer aucun échange avec l'Apporteur, ni à l'occasion d'une commande ni à l'occasion d'un rendez-vous, et ne lui fait part d'aucune vérification le concernant : la validation suit les seules règles de l'article 3.2.** **Cette commission rémunère la seule mise en relation initiale, dont le prix est ainsi forfaitisé sur la durée de l'attribution ; elle ne rémunère aucun suivi, aucune intervention ni aucune mission de l'Apporteur postérieure à sa déclaration, dont le contrat ne met aucune à sa charge (article 2.2).**

C'est la **date de signature de la commande** qui ouvre le droit, et elle seule. Une commande signée pendant la réservation provisoire ou pendant la durée de l'attribution reste commissionnée même si son encaissement intervient après leur expiration, dans les conditions de l'article 4.2.

À l'inverse, une commande signée **après** la fin de la réservation provisoire non validée, ou après l'expiration de l'attribution, n'ouvre aucun droit, y compris lorsque l'entreprise est devenue cliente à la suite d'une déclaration de l'Apporteur.

Lorsqu'une prestation est payée en tout ou partie par un tiers, la commission porte sur le **total hors taxes de la part commissionnable**, quel que soit le payeur.

**4.5 — Annulation d'un encaissement, remboursement, avoir.** Un avoir ou un remboursement partiel diminue le prix facturé : la commission est recalculée sur le prix net, selon l'article 4.1 bis pour un forfait ou sur le montant hors taxes net pour un pourcentage, et la différence fait l'objet d'une reprise. **Lorsque le client est remboursé en totalité par un avoir, la commission correspondante est annulée si elle n'a pas encore été versée, et reprise si elle l'a été (déduction sur les commissions suivantes), pour tous les produits ; lorsque le remboursement est partiel, la commission est réduite dans la même proportion. Les montants sont arrondis au centime le plus proche.** Lorsqu'un encaissement ayant donné lieu à commission est **annulé, rétracté ou restitué, quelle qu'en soit la cause** — impayé, remboursement au client, avoir imputé sur la facture, rejet ou révocation d'un prélèvement ou d'un virement, litige tranché en faveur du client, ou toute autre restitution des fonds, **y compris une restitution consentie sans réclamation du client, à titre de geste commercial, ou résultant de l'inexécution par la Société de ses propres obligations** —, la commission correspondante fait l'objet d'une reprise. **Il en va ainsi du remboursement de la Journée IA au titre de la garantie que la Société consent à ses clients (annexe 1, A1.1). La déduction prévue à l'article 4.1 ter n'est pas un remboursement et ne donne lieu à aucune reprise.** **Ne constitue pas une restitution des fonds, et ne donne lieu à aucune reprise, un bon d'achat ou un avoir valable sur un achat futur que la Société offre à titre exceptionnel ; le remboursement en argent, même partiel et même consenti à titre exceptionnel, reste une restitution. Le bon d'achat ou l'avoir ainsi utilisé sur une commande ultérieure diminue le prix facturé de cette commande, comme une remise (article 4.1 bis).** **Toutefois, une annulation, un remboursement ou un avoir consenti dans le seul but de priver l'Apporteur de sa commission est sans effet sur celle-ci** (article 1304-3 du code civil), comme la remise de l'article 4.1 bis. **La reprise est constatée par un avoir d'autofacture**, établi au nom et pour le compte de l'Apporteur (annexe 2) dès que la Société constate l'annulation : il porte la mention « Autofacturation — avoir », fait référence à l'autofacture d'origine (numéro et date) et indique la commission corrigée, la taxe sur la valeur ajoutée correspondante et la somme reprise. **L'autofacture d'origine n'est jamais modifiée, et aucune autofacture n'est émise pour un montant diminué d'une reprise.** L'avoir s'impute par compensation conventionnelle (article 1348-2 du code civil) sur la prochaine somme à verser, dans les conditions du présent article ; le décompte qui accompagne l'autofacture de cette commission indique l'avoir imputé et la somme virée.

La reprise ne peut intervenir que dans les vingt-quatre mois suivant **la date de l'annulation** — et non celle
de l'encaissement d'origine, une annulation pouvant survenir longtemps après lui.

Elle s'impute par compensation conventionnelle (article 1348-2 du code civil) sur les commissions à venir. **À défaut de commissions à venir suffisantes,
le solde négatif suit le régime de l'article 12.4**, que le contrat soit en cours ou terminé.

**4.5 bis — Déclaration non sincère, intérêt non déclaré, fraude.** Aucune commission n'est due au titre
d'une affaire pour laquelle l'Apporteur a manqué à l'article 3.7 (déclaration non sincère) ou à
l'article 8.4 (rémunération ou avantage reçu de l'entreprise, relation d'affaires ou d'intérêt non
déclarée), ni en cas de fraude ; les commissions déjà versées au titre de cette affaire font l'objet d'une
reprise dans les conditions de l'article 4.5. Le manquement est notifié à l'Apporteur avec les faits qui le
fondent ; il peut le contester par écrit, et la Société y répond de façon motivée dans les trente jours.

**4.6 — Parrainage.** L'Apporteur qui présente à la Société une personne devenant elle-même Apporteur
perçoit **10 % des commissions du filleul nées de commandes signées dans les
6 mois de la signature de son contrat par la Société, quelle que soit la date de leur encaissement.** Est
présentée au sens du présent article la personne dont l'Apporteur a communiqué à la Société, avant la
signature de son contrat par cette personne, l'identité et l'adresse électronique en indiquant qu'il en est
le parrain ; le rattachement est enregistré par la Société à la date de cette communication et notifié à
l'Apporteur et à cette personne.

Cette somme est versée par la Société et **n'est jamais prélevée sur la rémunération du filleul**. Elle est
facturée et versée dans les conditions de l'article 5, le jour où la commission du filleul dont elle procède
devient acquise tenant lieu de jour d'encaissement. **L'autofacture de cette somme, son décompte et l'avoir
qui en reprendrait une partie (article 4.5) la portent sur une ligne unique libellée « Parrainage
(article 4.6) » : ils n'indiquent ni l'identité du filleul, ni aucune commande, ni le prix, la commission ou
toute autre somme du filleul.** Lorsque les commissions de plusieurs filleuls deviennent acquises le même
jour, la somme est portée pour leur total.

**Aucune somme n'est due au titre de l'inscription elle-même**, ni au titre du nombre de personnes
présentées : seules les ventes effectivement encaissées par le filleul ouvrent droit à rémunération. Le
dispositif est limité à **un seul niveau** : les personnes présentées par le filleul n'ouvrent aucun droit.

Le parrain et le filleul sont deux personnes distinctes. Aucun lien de parrainage n'est reconnu lorsque les
deux contrats partagent un même numéro SIREN, une même adresse électronique, un même numéro de téléphone
ou un même compte bancaire.

**Lorsque l'identité de numéro SIREN, d'adresse électronique, de numéro de téléphone ou de compte bancaire
apparaît en cours de contrat, le versement des sommes de parrainage est suspendu le temps d'une
vérification, dans les conditions de l'article 3.7 ; les sommes déjà acquises demeurent dues.**

**Le parrainage n'emporte aucune fonction d'encadrement, d'animation, de formation ni de suivi. Le parrain
ne dispose d'aucun pouvoir à l'égard du filleul et n'est tenu d'aucune obligation envers lui ni envers la
Société à son sujet.** Le parrain a accès, par son espace en ligne ou, tant que celui-ci n'est pas ouvert, sur demande par
courrier électronique, au montant du parrainage qui lui revient,
présenté par mois et tous filleuls confondus, ainsi qu'à la liste de ses filleuls directs, réduite pour
chacun au prénom, à l'initiale du nom et à l'état de son contrat : « en signature » ou « signé ». Cet état
s'apprécie sur les seules versions du contrat du filleul postérieures à sa dernière résiliation, s'il y en a
eu une ; l'envoi ou la signature d'un avenant ne le modifie pas. Le filleul dont la relation contractuelle a
pris fin sort de la liste. **Le parrain n'a accès à aucune autre donnée relative au filleul : aucun montant
par filleul, aucune donnée relative à son activité, aucune date qui lui soit propre, aucune information sur
les personnes que le filleul a lui-même présentées. Ni le motif de la fin de la relation, ni aucune mesure
prise à l'égard du filleul, qu'il s'agisse d'une suspension ou d'une vérification, ne sont portés à la connaissance
du parrain.** La période de 6 mois prévue au premier alinéa lui est rappelée par un
texte identique pour tous les parrains, sans date calculée.

Le droit au parrainage suit le sort des commissions ordinaires : il subsiste après la fin du contrat de
l'Apporteur pour les commissions du filleul nées de commandes signées jusqu'au terme de la période de
6 mois, et ne porte pas sur les commandes signées après la fin du contrat du filleul.

**Correction du rattachement.** La Société peut rattacher un filleul à un autre parrain pour l'un des seuls
motifs suivants, limitativement énumérés : une erreur dans le rattachement initial ; une fraude ou un
auto-parrainage, au sens du quatrième alinéa ; le départ du parrain ou la résiliation de son contrat. **Le
changement prend effet à la date à laquelle la Société l'opère et ne vaut que pour l'avenir : les sommes de
parrainage nées des commissions du filleul acquises avant cette date restent acquises au parrain d'origine ;
pour les commissions acquises après cette date, elles reviennent au nouveau parrain, le septième alinéa
cessant de s'appliquer au parrain d'origine, dans la limite de la période de 6 mois
courant depuis la signature du contrat du filleul par la Société, qui n'est ni prolongée ni rouverte.** Une reprise
opérée après la date d'effet sur une commission acquise avant cette date est imputée au parrain d'origine,
comme la somme de parrainage qu'elle corrige. L'accord du parrain d'origine n'est pas requis. Le filleul, le
parrain d'origine et le nouveau parrain en sont informés par courrier électronique, avec la date d'effet du
changement et sans indication du motif.

**4.7 — Taxe sur la valeur ajoutée.** Les commissions sont exprimées hors taxes. Lorsque l'Apporteur est
assujetti à la taxe sur la valeur ajoutée, la taxe au taux en vigueur (20 % à la date de la présente version)
s'ajoute à la commission et figure sur la facture ; lorsqu'il bénéficie de la franchise en base, la facture
porte la mention « TVA non applicable, article 293 B du CGI » ou, à compter de l'entrée en vigueur du code des impositions sur les biens et services (CIBS), la mention correspondante de ce code. Les commissions sont facturées selon le
régime que l'Apporteur a déclaré (article 6.3) à la date d'établissement de l'autofacture. L'autofacture
porte la date de son établissement comme date d'émission et la date de l'encaissement intégral comme date de
la prestation ; l'exigibilité de la taxe suit le régime déclaré par l'Apporteur.

---

### Article 5 — Facturation et paiement 

**5.1 — Autofacture.** Le jour de l'encaissement intégral qui rend une commission acquise (article 4.2) — ou,
si le crédit intervient un jour non ouvré ou n'est constaté que plus tard, le premier jour ouvré où la Société
le constate —, la Société établit, au nom et pour le compte de l'Apporteur (article 5.2 et annexe 2),
l'autofacture correspondante et la lui transmet par courrier électronique, forme sous laquelle l'Apporteur
accepte de la recevoir. Une autofacture est établie pour chaque encaissement intégral ; lorsque plusieurs
commissions de l'Apporteur, y compris les sommes de parrainage de l'article 4.6, deviennent acquises le même
jour, une seule autofacture est établie pour l'ensemble. Elle est accompagnée d'un décompte indiquant, pour
chaque commande, le prix facturé, le prix public, la commission et la date de l'encaissement intégral, ainsi
que, le cas échéant, l'avoir imputé (article 4.5) et la somme virée ; les sommes de parrainage y figurent dans
les conditions de l'article 4.6. **L'autofacture est émise pour le montant intégral de la commission : elle
n'est jamais diminuée d'une reprise. Toute commission acquise est facturée et versée, quel que soit son
montant : aucun montant minimum n'est appliqué.**

**5.2 — Mandat de facturation.** L'Apporteur donne mandat à la Société d'établir en son nom et pour son
compte les autofactures de l'article 5.1, ainsi que les factures complémentaires et les avoirs des
articles 4.5, 5.6 et 5.7, dans les conditions de l'**annexe 2**. Chaque facture porte la mention
« Autofacturation ». L'Apporteur peut contester une facture ou un avoir dans un délai de trente jours
à compter de l'envoi du courrier électronique
qui lui transmet la facture ou en signale la mise à disposition dans l'espace en ligne, la date d'envoi étant
journalisée ; à défaut, elle est réputée acceptée, **sauf
erreur matérielle ou preuve contraire. Cette acceptation porte sur la forme et les mentions de la facture ;
la contestation du calcul de la commission qu'elle porte obéit à l'article 5.5.**

**Ce mandat est exclusivement un mandat de facturation au sens de l'article 289, I, 2 du code général des
impôts, ou de la disposition qui lui succède dans le code des impositions sur les biens et services (CIBS) à compter de son entrée en vigueur. Il est donné PAR l'Apporteur À la Société, aux seules fins d'établir des factures en son nom ; il
n'emporte aucun pouvoir de l'Apporteur de représenter la Société, ni aucun mandat de la Société à
l'Apporteur (article 1.2).**

**5.3 — Paiement.** La Société verse la commission par virement. **La date d'échéance de chaque
autofacture est le trentième jour suivant son émission, laquelle a lieu le jour de l'encaissement intégral
(article 5.1) ; elle n'en connaît pas d'autre et figure sur l'autofacture, avec les conditions de pénalité du
présent article.** Ce délai ne court jamais de la signature de la commande ni de l'émission de la facture au
client ; le retour en erreur de la transmission (article 20) ne le modifie pas. Une facture complémentaire
(articles 5.6 et 5.7) a la même échéance, comptée de son émission.

**Délai indicatif.** La Société s'efforce de verser la commission dans les deux jours ouvrés (du lundi au
vendredi, hors jours fériés en France métropolitaine) suivant l'encaissement intégral. **Ce délai n'est pas une
échéance et ne constitue pas un engagement de la Société : un virement effectué après lui, mais au plus tard à
l'échéance de trente jours, ne donne lieu à aucun frais, aucune pénalité et aucune indemnité.** Aucun montant
minimum ne s'applique, y compris après la fin du contrat. **Tout retard de versement au-delà de l'échéance
donne lieu, de plein droit, conformément à l'article L.441-10 du code de commerce, à compter du lendemain de
l'échéance et sans rappel préalable, à des pénalités calculées au taux d'intérêt
de la Banque centrale européenne à son opération de refinancement la plus récente majoré de dix points de pourcentage, sans pouvoir être inférieur à trois fois le taux d'intérêt légal,
ainsi qu'à l'indemnité forfaitaire pour frais de recouvrement de 40 euros prévue à l'article D.441-5 du
code de commerce.**

**5.4 — Conditions du versement.** Aucun versement ne peut intervenir sans numéro SIREN valide **et actif**
(entreprise non cessée au répertoire SIRENE), régime de
taxe sur la valeur ajoutée déclaré (article 6.3) ni coordonnées bancaires au nom de l'Apporteur. L'attestation de vigilance et l'extrait
d'immatriculation prévus à l'article 6.2 conditionnent en outre le versement des sommes qui portent le cumul
des sommes dues au titre du présent contrat au seuil fixé par l'article R.8222-1 du code du
travail, et au-delà. **Hors la contestation écrite du client prévue à l'article 4.2 bis, aucune autre
pièce et aucun autre motif ne peuvent différer un versement ; en particulier ni un défaut de
rattachement d'un encaissement, ni l'absence de palier à la grille ne peuvent le différer au-delà de
soixante jours (annexe 1, A1.8).**

Les sommes dont le versement est ainsi différé, notamment lorsque l'entreprise de l'Apporteur est cessée
au répertoire SIRENE, demeurent acquises à l'Apporteur. Elles ne sont
ni facturées ni versées avant la régularisation ; l'autofacture est alors établie et transmise, et la somme
est versée dans les conditions de l'article 5.3, le délai indicatif de deux jours ouvrés et l'échéance de
trente jours courant de la régularisation, sans montant minimum. La régularisation s'entend de la réception
par la Société de la dernière pièce ou information manquante ; l'autofacture porte alors la date de la
régularisation comme date d'émission et mentionne la date de l'encaissement intégral comme date de la
prestation. Le motif du blocage lui est
indiqué par courrier électronique ou dans son espace.

Les sommes suspendues faute de pièces de vigilance (article 6.2) le restent après la fin du contrat, sans
limite de délai, jusqu'à la production des pièces ; ce report n'ouvre droit à aucune pénalité et n'oblige la
Société à aucune relance.

**5.5 — Contestation de la commission.** Toute contestation portant sur l'existence, l'assiette, le calcul ou
la date d'encaissement d'une commission est formée par écrit dans les douze mois de l'envoi de l'autofacture qui aurait dû
la porter. **Le présent délai organise la contestation de la commission ; il n'abrège pas la prescription de
l'action en paiement.**

**5.6 — Réponse.** La Société répond de façon motivée dans les trente jours de la réception d'une
contestation formée dans le délai de l'article 5.5. Elle justifie, à la demande de l'Apporteur, la date de
l'encaissement intégral par un extrait de son compte bancaire dont les mentions étrangères à l'opération sont
masquées (pour une somme de parrainage, par une attestation qui n'identifie pas le filleul). La commission est
soit maintenue, soit ajustée ; l'ajustement donne lieu, selon le cas, à une facture complémentaire ou à un
avoir d'autofacture, établis avec la réponse et faisant référence à l'autofacture d'origine (numéro et date).

**5.7 — Ajustements.** La Société peut corriger une erreur matérielle de calcul, dans un sens comme dans
l'autre, dans le délai de l'article 5.5, par une facture complémentaire (commission insuffisante) ou par un
avoir d'autofacture (commission excessive), qui font référence à l'autofacture d'origine (numéro et date),
indiquent leur motif et la ligne corrigée et suivent respectivement l'article 5.3 et l'article 4.5. Aucun autre
ajustement que la reprise de l'article 4.5 ne peut réduire une commission.

---

### Article 6 — Obligations légales de l'Apporteur 

**6.1** L'Apporteur exerce sous un statut régulièrement déclaré et demeure à jour de ses obligations
sociales et fiscales. **Il dispose d'un numéro SIREN valide et actif (entreprise non cessée au répertoire
SIRENE) : c'est une condition de la signature du présent contrat, de sa contresignature par la Société et de
tout versement (article 5.4).**

**6.2** Lorsque le cumul des sommes dues au titre du présent contrat
approche le seuil fixé par l'article R.8222-1 du code du travail pour l'application de l'article L.8222-1 — la Société appréciant par prudence ce
cumul toutes taxes comprises, ce qui est plus strict que le seuil légal, apprécié hors taxes, et cette approche
au vu des commissions acquises et des commandes signées —, elle lui demande son
**attestation de vigilance** délivrée par l'URSSAF, datant de moins de six mois et portant son code de vérification, ainsi
que les documents d'immatriculation prévus par l'article D.8222-5 (**extrait d'immatriculation** ou
document équivalent) ; il les lui remet, puis une attestation actualisée tous les six mois tant que le
contrat se poursuit ou que des sommes restent dues. La seule conséquence de leur absence est celle de
l'article 5.4 ; elle n'est pas une inexécution au sens de l'article 11.2.

**6.3** L'Apporteur garantit l'exactitude et l'actualité des informations qu'il communique à la Société, en
particulier sa dénomination, sa forme juridique, son numéro SIREN, **son régime de taxe sur la valeur
ajoutée** et ses coordonnées bancaires. Il informe la Société de tout changement les affectant dans les
quinze jours. Il supporte les conséquences d'une information inexacte ou non actualisée, notamment le
rappel de taxe, les majorations, pénalités et frais que la Société établit avoir supportés de ce fait,
ainsi que les sommes versées sur des coordonnées bancaires erronées qu'il a déclarées.

**6.4** L'Apporteur répond seul des dommages qu'il cause dans l'exercice de son activité (article 8.5).
Il est libre de souscrire une assurance de responsabilité civile professionnelle et d'en remettre l'attestation
à la Société ; aucune n'est exigée au titre du présent contrat.

**6.5 — Déclarations et paiements propres à l'Apporteur.** **La commission est un montant brut, exprimé hors taxes : les cotisations et contributions sociales, les impôts et toutes les charges dus à raison de l'activité de l'Apporteur sont à sa seule charge et ne s'ajoutent jamais à la commission.** L'Apporteur fait son affaire personnelle de l'ensemble des déclarations, cotisations, contributions et impositions dues à raison de son activité et des sommes qui lui sont versées en exécution des présentes, et en supporte seul le paiement. Il en va de même des obligations lui incombant en qualité d'employeur, le cas échéant. La Société n'est tenue pour son compte d'aucune retenue, d'aucun reversement et d'aucune déclaration, à l'exception de celles que la loi met à sa charge, notamment la déclaration prévue à l'article 240 du code général des impôts, dont un récapitulatif est mis à sa disposition.

**6.6 — Absence de travail dissimulé.** L'Apporteur déclare ne pas se trouver dans les situations définies aux
articles L.8221-3 et L.8221-5 du code du travail, n'avoir recours à aucun travail dissimulé et n'employer aucun travailleur étranger dépourvu
d'autorisation de travail ; il remet, le cas échéant, la liste nominative prévue à l'article D.8254-2. Il
indemnise la Société du préjudice **qu'elle établit avoir subi** du fait d'une mise en cause au titre des
articles L.8222-1 à L.8222-5 ou L.8254-1 du code du travail imputable à un manquement de sa part.

---

### Article 7 — Données personnelles 

**7.1** Lorsqu'il déclare une entreprise, l'Apporteur transmet à la Société les coordonnées
professionnelles d'une personne physique. Il garantit avoir informé cette personne, **dans les conditions
de l'article 13 du règlement (UE) 2016/679**, de la transmission de ses coordonnées et de sa finalité.

**7.2** La Société est responsable du traitement de ces données. **Elle en informe la personne concernée dans les conditions de l'article 14 du règlement (UE) 2016/679, dans le premier message qu'elle lui adresse, au plus tard dans le délai d'un mois à compter de l'enregistrement de la déclaration (article 14, 3 du règlement) ; ce message lui indique que ses coordonnées lui ont été transmises par l'Apporteur. Aucun message d'information distinct n'est envoyé.** Ce message indique l'identité de la Société, les données reçues, leur source — l'Apporteur, désigné par ses prénom et nom —, les finalités et la base juridique du traitement, sa durée, les droits de la personne, dont celui de s'opposer à tout moment à la prospection et de demander l'effacement, et le moyen de les exercer. **Il ne fait état d'aucune vérification relative à l'Apporteur et ne demande à la personne de confirmer aucun échange avec lui.**

La Société traite ces données pour le suivi de la déclaration, le rattachement des rendez-vous et des commandes à celle-ci (article 3.2), la tenue du registre de l'article 3.5 et sa propre prospection. Elle les conserve pour la durée nécessaire à ces finalités, dans la limite des durées de conservation qu'elle porte à la connaissance de la personne. La Société conserve en outre ces données dans son outil de gestion de la relation client, à des fins de prospection et de gestion de sa relation commerciale avec l'entreprise, aussi longtemps qu'elle poursuit cette activité, sans échéance fixée à l'avance. La personne concernée peut à tout moment s'opposer à la prospection et demander l'effacement de ses données ; la Société les met à jour ou les efface dès qu'elle apprend qu'elles ne sont plus exactes, notamment lorsque la personne n'exerce plus la fonction pour laquelle elles ont été recueillies. L'Apporteur en informe la personne lorsqu'il recueille ses coordonnées.

**7.3** L'Apporteur ne collecte ni ne transmet aucune donnée relevant de l'article 9 du même règlement.

**7.4** L'Apporteur dispose, sur les données le concernant, des droits prévus par ce règlement, exerçables
auprès de la Société à l'adresse indiquée en tête des présentes.

**7.5** L'Apporteur agit en qualité de responsable de traitement distinct pour la collecte des coordonnées
professionnelles qu'il transmet ; la Société en devient responsable de traitement dès leur réception.
Aucune des parties n'agit pour le compte de l'autre au sens de l'article 28 du règlement.

**7.6** L'Apporteur garantit la Société contre toute réclamation, action ou procédure résultant d'un
manquement de sa part au présent article, dans les conditions et sous les réserves de l'article 8.5.

**7.7** L'Apporteur met en œuvre les mesures de sécurité appropriées au sens de l'article 32 du règlement.
Il n'utilise les données qu'il reçoit de la Société (retours, coordonnées issues des échanges de la Société
avec l'entreprise) qu'aux fins du présent contrat et les efface à la fin de celui-ci. Les coordonnées qu'il
détenait avant la déclaration ou qu'il obtient par ailleurs relèvent de sa seule responsabilité de
traitement.

**7.8** La Société traite les données de l'Apporteur (identité, coordonnées, pièces justificatives,
coordonnées bancaires, commissions) pour conclure et exécuter le contrat, tenir sa comptabilité et satisfaire
à ses obligations légales, notamment fiscales. Les pièces justificatives sont conservées pendant la durée
indiquée par la politique de confidentialité de la Société ; le contrat et son fichier de preuve sont
conservés cinq ans après la fin du contrat ; les autofactures, leurs décomptes et les pièces comptables, pendant la durée légale de conservation (dix ans, article L.123-22 du code de commerce). L'information
prévue à l'article 13 du règlement est accessible depuis la politique de confidentialité du site de la
Société.

---

### Article 8 — Interdictions 

**8.1** L'Apporteur ne démarche aucune personne, salariée ou non, en vue de lui faire mobiliser son
**compte personnel de formation**, le démarchage y étant interdit par la loi n° 2022-1587 du 19 décembre
2022, **codifiée à l'article L.6323-8-1 du code du travail**.

Aucune commission n'est due au titre d'une prestation **effectivement financée, en tout ou partie, par le
compte personnel de formation**, quelle que soit l'origine du contact. Les paliers susceptibles d'un tel
financement sont identifiés dans la grille annexée. Lorsque ce financement est constaté après le
versement de la commission, celle-ci fait l'objet d'une reprise (article 4.5). Cette absence de commission
est une règle du présent contrat et non de la loi.

**8.2** Il ne se présente pas comme salarié, mandataire, agent ou représentant de la Société, n'utilise
aucune adresse électronique ni aucun support laissant croire à un lien de cette nature, et ne fait aucune
promesse sur les prix, les délais, les résultats ou la prise en charge financière des prestations.

**8.3** L'Apporteur ne discute, ne présente, ne chiffre et ne commente aucune condition de l'offre de la
Société — prix, remise, échéancier, délai, contenu, durée, éligibilité ou prise en charge par un financeur.
Il renvoie toute question de cette nature à la Société, seule habilitée à y répondre. Il ne participe à
aucun entretien de vente, de négociation ou de conclusion, **sauf invitation écrite de la Société qu'il est libre
de décliner, et à titre de simple présentation des personnes**.

**8.4** L'Apporteur ne perçoit de l'entreprise qu'il déclare aucune rémunération, commission ni avantage au
titre de la mise en relation avec la Société. Il informe la Société de toute relation d'affaires ou
d'intérêt le liant à une entreprise qu'il déclare.

**8.5** L'Apporteur répond seul des dommages qu'il cause à l'occasion de son activité. Il indemnise la
Société du préjudice **qu'elle établit avoir subi**, et la garantit contre toute réclamation d'un tiers,
résultant d'un manquement de sa part aux articles 6, 8, 9, 22 ou 22 bis ou d'un fait qui lui est imputable.
**Cette garantie ne joue pas dans la mesure où le dommage procède d'un fait de la Société ; elle exclut les
amendes administratives et pénales et est plafonnée au montant des commissions versées à l'Apporteur au
cours des vingt-quatre mois précédant la réclamation, sauf dol ou faute lourde. La Société informe l'Apporteur de toute réclamation
dans les trente jours de sa réception, lui communique les pièces et le met en mesure de participer à sa
défense ; aucune transaction conclue sans son accord écrit ne lui est opposable.**

---

### Article 9 — Confidentialité 

Chacune des parties s'abstient de divulguer les informations non publiques dont elle a connaissance à
l'occasion du présent contrat, pendant sa durée et deux ans après son terme. Cette obligation ne fait pas
obstacle à la liberté de l'Apporteur d'exercer toute autre activité (article 2.4).

Sont exclues de cette obligation les informations publiques ou devenues publiques sans faute de la partie
qui les détient, celles qu'elle détenait déjà, et celles dont la communication est exigée par la loi ou par
une autorité, la partie concernée en informant l'autre lorsqu'elle le peut. Chaque partie peut communiquer
ces informations à ses conseils tenus au secret professionnel. Au terme du contrat, chaque partie restitue
ou détruit les documents confidentiels en sa possession.

---

### Article 10 — Durée

Le contrat est conclu pour une durée indéterminée et prend effet à sa signature par la Société. **Cette durée indéterminée
n'emporte par elle-même aucune mission durable au profit de l'Apporteur : elle organise seulement la
faculté ouverte à celui-ci de faire, s'il le souhaite, de nouvelles déclarations, chacune épuisant son
objet et donnant naissance à une attribution bornée et non reconductible (articles 3.4 et 3.4 bis).**

---

### Article 11 — Résiliation 

**11.1** Chaque partie peut résilier le contrat à tout moment, sans avoir à motiver sa décision, **par courrier électronique adressé dans les conditions de l'article 20**, moyennant un préavis de **30 jours** à compter de son envoi, **le jour de l'envoi n'étant pas compté**. **Ce préavis est stipulé en considération de la durée prévisible de la relation et sans préjudice de l'article L.442-1, II du code de commerce. Les parties n'ayant pas entendu conclure un contrat d'agence commerciale (article 1.4), les articles L.134-11 et suivants du même code ne s'appliquent pas.** Il n'est pas dû en cas de résiliation fondée sur l'article 11.2 ni en cas de force majeure. La Société accuse réception de la résiliation notifiée par l'Apporteur, par courrier électronique indiquant la date de fin du contrat ; l'absence de cet accusé est sans effet sur la résiliation.

**11.1 bis** Pendant le préavis, le contrat continue de produire ses effets : l'Apporteur peut déclarer de nouvelles entreprises, les rendez-vous qui ont lieu pendant le préavis valident l'attribution dans les conditions de l'article 3.2, et les commandes signées pendant le préavis ouvrent droit à commission dans les conditions de l'article 12.3. Les déclarations en attente et les réservations provisoires à la date de fin du contrat sont traitées selon l'article 12.1.

**11.2** En cas d'inexécution par l'Apporteur de ses obligations au titre des articles 3.7, 6.1, 6.3, 6.5,
6.6, 7, 8, 9, 22 ou 22 bis.4,
la Société peut résilier le contrat sans préavis, par écrit et par décision motivée, après mise en demeure
d'y remédier restée sans effet pendant quinze jours. La mise en demeure n'est pas requise lorsque
l'inexécution est irrémédiable. Il en va de même en cas de déclaration inexacte au titre de l'article 23.
**La mise en demeure n'est ni un avertissement ni une mesure disciplinaire ; elle ne constitue pas un
antécédent, et aucune décision de la Société ne peut être fondée, en tout ou partie, sur le nombre de mises
en demeure ou de suspensions antérieures.**

**11.3** La résiliation régulièrement notifiée dans le respect du préavis stipulé à l'article 11.1 n'ouvre
droit à aucune indemnité **au titre de la rupture elle-même, sans préjudice des dispositions d'ordre public
et de** la réparation du préjudice causé par l'inexécution d'une obligation contractuelle.

---

### Article 12 — Effets de la fin du contrat 

**12.1** Les réservations provisoires et les déclarations en attente prennent fin à la date de fin du contrat ; un rendez-vous qui a lieu après cette date est sans effet, même s'il a été pris avant elle. Cette fin est sans effet sur les commandes déjà signées, y compris pendant une réservation provisoire, qui demeurent commissionnées selon l'article 12.3. Les attributions définitives non converties prennent fin ; les entreprises correspondantes redeviennent librement déclarables, sans préjudice de ces mêmes commandes.

**12.2** **Les autofactures émises avant la fin du contrat restent payables à leur échéance. Les commissions
acquises à cette date et non encore facturées sont facturées et versées** dans les conditions des
articles 5.1 et 5.3, sans montant minimum, sous la seule réserve de l'article 5.4.

**12.3** Les commandes signées avant la fin du contrat, ou pendant le préavis, continuent d'ouvrir droit à commission, y compris lorsqu'elles ont été signées pendant une réservation provisoire (article 4.4), sauf annulation ou extinction de la réservation ou de l'attribution au titre des articles 3.3 ou 3.7. Cette commission devient acquise dans les conditions de l'article 4.2 et est facturée et versée dans les conditions des articles 5.1 et 5.3 (article 4.3), quelle que soit la date de l'encaissement complet. La Société établit les autofactures et, le cas échéant, les avoirs, selon les articles 4.5 et 5, jusqu'à extinction complète de ces droits. L'Apporteur reçoit par courrier électronique ses autofactures, ses avoirs, leurs décomptes et le motif de tout blocage, jusqu'à l'extinction de ses droits ; son lien personnel est révoqué à la fin du contrat. Il peut obtenir sur simple demande à contact@axion-ia.com la copie de son contrat signé et de ses autofactures.

**12.4** Si le solde de l'Apporteur est négatif à la suite de reprises ou d'avoirs de l'article 5.7, ce solde
s'impute par compensation conventionnelle (article 1348-2 du code civil) sur les commissions à venir.

À défaut de commissions à venir permettant cette imputation dans un délai de douze mois — que le contrat
soit en cours ou terminé —, la Société peut en demander le remboursement par écrit, avec l'avoir
d'autofacture et son décompte ; il est dû dans les trente jours de la demande, dans la limite des commissions
qui ont été versées à l'Apporteur au cours des vingt-quatre mois précédant l'annulation ou l'erreur à l'origine de
la reprise ou de l'avoir.

Le solde négatif non recouvré est constaté en créance et n'emporte aucune autre conséquence.

**12.5** **Le contrat étant conclu en considération de la personne de l'Apporteur (articles 2.6 et 16), il**
prend fin de plein droit au décès de l'Apporteur personne physique, à la cessation de son activité ou à la
radiation de son immatriculation, sans préavis. **L'ouverture d'une procédure collective à l'égard de
l'Apporteur n'entraîne pas, à elle seule, la fin du contrat, dont le sort est réglé par le livre VI du code de commerce, notamment les articles L.622-13 et
L.641-11-1 ; elle met seulement fin au mandat de facturation, dans les conditions de l'article 2.5 de l'annexe 2.** Les commissions acquises à la date de fin du contrat, ou à celle de la fin du mandat de facturation, sont versées, selon le cas, à
l'Apporteur, à ses ayants droit ou au mandataire désigné, sur justification de leur qualité et de
coordonnées bancaires à leur nom, l'article 5.4 étant écarté pour le seul numéro SIREN ; le mandat de
facturation ayant pris fin, la facture est alors établie dans les conditions de l'article 2.5 de l'annexe 2.

> *Aucune commission acquise, ni aucune commission afférente à une commande signée avant la fin du contrat,
> n'est perdue du fait de la résiliation, quelle qu'en soit la cause.*

---

### Article 13 — Modification

**13.1** Toute modification du présent contrat, de la grille annexée, **des prix de référence qu'elle porte** ou de la fiche des commissions (annexe 1 bis) fait l'objet d'un avenant soumis à la signature de l'Apporteur. La publication de la commission d'un produit créé après la signature (annexe 1, A1.8) n'est pas une modification du contrat. La Société demeure libre de fixer les prix qu'elle pratique envers ses clients ; ces prix sont sans effet sur les prix de référence de l'annexe 1 tant qu'un avenant ne les a pas modifiés.

**13.2** Tant que l'Apporteur n'a pas signé un avenant, **les conditions de la version qu'il a signée continuent de s'appliquer** — à ses réservations et attributions en cours comme à ses déclarations nouvelles, ainsi qu'aux commissions correspondantes.

**13.3** Le refus ou l'absence de signature d'un avenant **n'est pas un manquement** et n'emporte par lui-même aucune conséquence : l'Apporteur conserve l'intégralité de ses droits sous la version qu'il a signée, et demeure libre de déclarer de nouvelles entreprises. Si la Société entend ne plus poursuivre la relation aux conditions antérieures, il lui appartient de résilier le contrat selon l'article 11.1.

**13.4** Les modifications imposées par la loi ou par un acte réglementaire, notamment les mentions de facturation et les seuils ou taux légaux, s'appliquent de plein droit à compter de leur entrée en vigueur, sans avenant, dans la seule mesure où elles l'exigent.

**13.5 — Passage d'une version antérieure à la présente version.** Lorsque l'Apporteur était lié à la Société par une version antérieure du contrat, la présente version ne s'applique qu'aux **déclarations enregistrées à compter de sa prise d'effet**, c'est-à-dire de la date à laquelle la Société lui notifie avoir enregistré son acceptation. **Les déclarations enregistrées auparavant — qu'elles aient donné lieu à une attribution provisoire, à une attribution confirmée ou à une mise en attente —, ainsi que les commandes et les commissions qui s'y rattachent, restent régies jusqu'à leur extinction par la version sous laquelle elles ont été faites, grille comprise.** L'entreprise dont l'attribution née sous la version antérieure a pris fin ne peut être déclarée à nouveau que dans les conditions de la présente version. Par exception, les présentations encore en attente d'attribution le jour où l'Apporteur accepte la présente version passent à la règle du premier rendez-vous tenu (article 3.2) ; l'Apporteur dispose d'au moins trente jours à compter de ce jour pour obtenir ce rendez-vous, et il en est informé par courrier électronique. Entre Apporteurs, l'ordre des horodatages de l'article 3.5 s'applique quelle que soit la version du contrat de chacun.

---

### Article 14 — Loi applicable et juridiction 

Le présent contrat est soumis au droit français.

À défaut d'accord amiable, **TOUT LITIGE RELATIF AU PRÉSENT CONTRAT RELÈVE DE LA COMPÉTENCE EXCLUSIVE DES
TRIBUNAUX DU RESSORT DU SIÈGE DE LA SOCIÉTÉ, DANS LA MESURE OÙ LES DEUX PARTIES ONT CONTRACTÉ EN QUALITÉ
DE COMMERÇANT. À DÉFAUT, LES RÈGLES DE COMPÉTENCE DE DROIT COMMUN S'APPLIQUENT.** La présente clause est
stipulée sous réserve des juridictions spécialisées désignées par la loi pour les litiges relevant des
articles L.442-1 et suivants du code de commerce (article L.442-4, III et article D.442-3).

**Les parties reconnaissent que la présente clause a fait l'objet, dans le parcours de signature
électronique, d'une acceptation distincte et spécialement signalée, conservée dans le fichier de preuve
(article 48 du code de procédure civile : spécification très apparente). L'Apporteur déclare contracter en
la qualité suivante : {{APPORTEUR_QUALITE}}.**

> *Cette clause a été portée à la connaissance de l'Apporteur et acceptée par lui de manière spécifique,
> par une case distincte au moment de la signature électronique (article 48 du code de procédure civile).*

---

### Article 15 — Force majeure

Aucune partie n'est responsable de l'inexécution due à un événement de force majeure au sens de
l'article 1218 du code civil. Si l'empêchement dure plus de trois mois, chaque partie peut résilier sans
préavis. La force majeure ne dispense ni du paiement des sommes dues, ni de l'établissement des autofactures.

---

### Article 16 — Cession

Le contrat est conclu en considération de la personne de l'Apporteur : il ne peut ni le céder ni le
transférer. La Société peut céder le contrat à toute société qu'elle contrôle, qui la contrôle, ou à
laquelle elle transfère l'activité concernée. **L'Apporteur consent expressément, par avance, à la cession du contrat (article 1216 du code civil)
et à la libération de la Société pour l'avenir (article 1216-1) ; la cession produit effet à son égard
lorsqu'elle lui est notifiée par écrit.** L'Apporteur peut, dans les trente jours
de la notification de la cession, résilier le contrat sans préavis. Le cessionnaire reprend les commissions
acquises ou afférentes à des commandes signées, les engagements de l'annexe 2 et la grille en vigueur, qu'une
cession ne peut modifier.

---

### Article 17 — Intégralité et hiérarchie

Le contrat et ses annexes expriment l'intégralité de l'accord et remplacent tout échange antérieur. En cas de contradiction : le contrat, puis l'annexe 1, puis l'annexe 1 bis, puis l'annexe 2 ; **la fiche des commissions (annexe 1 bis) illustre l'annexe 1 et ne peut ni y ajouter ni en retrancher**. Aucun contenu de l'espace en ligne, des documents de présentation ou d'un courrier électronique, **ni aucun support public ou commercial de la Société, notamment les pages de son site présentant les commissions,** n'a valeur contractuelle, **à l'exception des documents que le présent contrat désigne — autofactures, avoirs et décomptes, notifications de l'article 20, décisions relatives aux réservations et aux attributions et extraits du registre de l'article 3.5 —, qui font partie de l'exécution du contrat, et de la grille de référence publiée, pour les seuls produits créés après la signature (annexe 1, A1.8). La présente stipulation ne limite ni n'exclut le devoir d'information de l'article 1112-1 du code civil.**

---

### Article 18 — Divisibilité

Si une stipulation est jugée nulle, réputée non écrite ou inapplicable, les autres demeurent en vigueur.

---

### Article 19 — Non-renonciation

Le fait de ne pas se prévaloir d'une stipulation ne vaut pas renonciation à s'en prévaloir ultérieurement.

---

### Article 20 — Notifications

Toute notification est valablement faite par courrier électronique à l'adresse déclarée par chaque partie
ou par message déposé dans l'espace en ligne, avec effet à sa date d'envoi ; les parties conviennent,
conformément à l'article 1366 du code civil, que ces écrits électroniques ont la même force probante qu'un
écrit sur support papier.

**Toute notification faisant courir un délai — et notamment la transmission d'une autofacture
(articles 5.1 et 5.2), la mise en demeure et la résiliation (article 11) — est adressée par courrier électronique à
l'adresse déclarée par le destinataire ; le délai court à compter de cet envoi, dont la date est
journalisée. Le dépôt d'un message dans l'espace en ligne ne fait courir aucun délai. Après la fin du
contrat, les notifications sont faites par courrier électronique à la dernière adresse déclarée. Lorsqu'un
message est retourné en erreur, le délai ne court qu'à compter de son renvoi à une adresse valide
communiquée par le destinataire, à l'exception de l'échéance de paiement de l'article 5.3, qui court de
l'émission.**

---

### Article 21 — Survie

Les articles 3.3, 3.5, 4, 5, 6.3, 6.5, 6.6, 7, 8.5, 9, 12, 14, 17, 18, 19, 20, 22, 22 bis.4 et 23, ainsi
que les annexes 1 et 2, survivent au terme du contrat, chacun pour la durée nécessaire à son objet.

---

### Article 22 — Supports de présentation

La Société remet à l'Apporteur des documents de présentation de ses prestations. L'Apporteur peut les
transmettre **en l'état, sans aucune modification**, à seule fin d'identifier la Société auprès d'une
entreprise et de lui communiquer les coordonnées de celle-ci. **Sauf dans les conditions de l'article
22 bis, aucun droit d'usage de la dénomination, du logo ou de la charte de la Société ne lui est concédé :
il ne peut les reproduire sur aucun support, aucune signature électronique, aucun profil, page ou compte en
ligne, aucune carte, aucun document lui appartenant, ni les faire figurer dans son intitulé
professionnel.** Il ne dépose ni marque, ni nom de
domaine, ni dénomination reprenant tout ou partie du nom de la Société, et ne crée aucun compte sur un
service en ligne portant ce nom. Les documents de présentation restent la propriété de la
Société ; aucun droit sur son nom, son logo ou ses contenus n'est cédé. À la fin du contrat, il cesse tout
usage et détruit ou restitue les documents en sa possession.

---

### Article 22 bis — Communication et image de marque

**22 bis.1 — Liberté de communication.** L'Apporteur fait connaître les prestations de la Société s'il le souhaite, par les moyens, sur les supports et au rythme de son choix. Il n'y est jamais tenu et ne soumet aucune communication à l'accord préalable de la Société. Seules s'appliquent les limites des articles 8.2, 8.3 et 22 bis.5.

**22 bis.2 — Licence de marque.** Pour ces communications, la Société concède à l'Apporteur un droit d'usage personnel, non exclusif, gratuit et révocable de sa dénomination et de son logo, pour la durée du contrat. Lorsqu'il reproduit ces signes, l'Apporteur le fait dans les formes de la charte de marque remise par la Société (couleurs, typographies, versions du logo) ; la charte ne régit que l'usage des signes, et non le contenu, le format ou la méthode de la communication. Ce droit ne s'étend ni à la modification du logo, ni au dépôt d'une marque ou d'un nom de domaine, ni à la création d'un compte ou d'une page au nom de la Société (article 22).

**22 bis.3 — Transparence.** Dans ses communications, l'Apporteur se présente comme apporteur d'affaires indépendant, jamais comme salarié ou représentant de la Société. Il n'y annonce aucun prix, remise, délai, résultat ou financement (article 8.3), et ne fait aucune affirmation inexacte sur la Société ou ses prestations.

**22 bis.4 — Retrait de la licence.** La Société peut, par un écrit qui en indique le motif, retirer le droit d'usage de l'article 22 bis.2 pour une communication qui reproduit ses signes en méconnaissance de la charte ou qui contrevient aux articles 8.2 ou 8.3, ou le retirer pour l'avenir. L'Apporteur cesse alors, dans les meilleurs délais et au plus tard sous sept jours, d'utiliser la dénomination et le logo de la Société dans la communication concernée, sans indemnité. Ce retrait ne porte que sur l'usage des signes de la Société ; il n'est ni un avertissement ni une mesure disciplinaire.

**22 bis.5 — Pratiques interdites.** Restent interdits en toutes circonstances l'achat de mots-clés ou de référencement reprenant le nom de la Société, les envois de messages en masse ou automatisés non sollicités, et toute communication relative au compte personnel de formation.

---

### Article 23 — Déclarations de l'Apporteur

L'Apporteur déclare que l'exercice de la présente activité n'est contraire ni à une obligation de loyauté,
ni à une clause de non-concurrence ou d'exclusivité, ni à un statut ou à une réglementation professionnelle
qui lui serait applicable, et qu'il a vérifié sa situation, le cas échéant, auprès de son employeur, de son
ordre professionnel ou de sa caisse de retraite. **Il déclare exercer sous un statut régulièrement déclaré
l'autorisant à percevoir et à facturer les commissions prévues aux présentes, et ne faire l'objet ni d'une
procédure de liquidation judiciaire, ni d'une interdiction de gérer.** Il informe la Société de tout
changement affectant ces déclarations. Une déclaration inexacte autorise la résiliation dans les conditions
de l'article 11.2.

---

**Formation du contrat.** Le présent
contrat est conclu à la date de sa signature par la Société, qui intervient après celle de l'Apporteur et la
vérification des pièces de son dossier. La signature de l'Apporteur seule ne forme pas le contrat : la Société
demeure libre de ne pas y donner suite, sans avoir à motiver sa décision, ou de lui demander de compléter son
dossier. La contresignature est notifiée à l'Apporteur par courrier électronique.

**Signature électronique et preuve.** Le présent contrat est signé sous forme électronique, au moyen d'une
signature électronique au sens de l'article 3, 10°, du règlement (UE) n° 910/2014, ni avancée ni qualifiée, dont l'effet juridique n'est pas refusé au seul motif de sa forme électronique (article 25, 1 du même règlement). L'Apporteur est
identifié par le lien personnel adressé à l'adresse électronique qu'il a déclarée et exprime son
consentement en validant la signature ; la Société signe par son représentant légal depuis un accès
personnel. À chaque signature sont enregistrés dans un fichier de preuve : la date et l'heure, l'empreinte
numérique du texte signé, l'adresse IP de connexion sous forme hachée, le navigateur utilisé et les cases
cochées. Le texte signé est figé : toute modification en change l'empreinte. Les parties reconnaissent que
ces éléments font foi, jusqu'à preuve contraire, de l'identité du signataire, de son consentement et de
l'intégrité du texte signé (articles 1356, 1366 et 1367 du code civil). La présomption de fiabilité de l'article 1367 ne joue que pour la signature électronique qualifiée ; pour la présente signature, la convention de preuve de l'article 1356 s'applique. Le fichier de preuve est une annexe
du contrat signé ; le contrat signé et son fichier de preuve sont conservés par la Société pendant la durée
du contrat et cinq ans après sa fin ; un exemplaire de chacun est adressé à l'Apporteur par courrier
électronique à la contresignature et lui est remis sur simple demande.

Le présent contrat est rédigé en langue française, seule version faisant foi.

**La Société** — M. Williams Jullin · **L'Apporteur** — {{APPORTEUR_SIGNATAIRE}}

---

## Annexe 1 — Grille de commissions du présent contrat, version 3

*Les prix de référence ci-dessous sont hors taxes. Ils n'évoluent, comme les commissions, que par avenant (articles 4.1 et 13). Les commissions sont exprimées hors taxes (article 4.7) et sont des montants bruts (article 6.5). Toute commission est calculée une seule fois à la signature du devis et acquise dès que la part commissionnable de la commande a été payée en totalité (article 4.2) ; elle est reprise en cas d'impayé, d'annulation ou de remboursement (article 4.5).*

### A1.1 — Journée IA

*Forfait de 500 € HT par Journée IA vendue et payée au prix de référence de 1 490 € HT. Lorsque le prix facturé est inférieur, le forfait est réduit dans la même proportion (article 4.1 bis) : commission = 500 € × prix hors taxes facturé ÷ 1 490 €. La commission n'excède jamais 500 € par Journée IA.*

| Prestation | Prix de référence HT | Commission du présent contrat |
| --- | --- | --- |
| Journée IA | 1 490 € | 500 € |

*Exemples : une Journée IA payée 1 490 € HT donne 500 € ; payée 1 341 € HT (10 % de moins), 450 € ; payée 1 192 € HT (20 % de moins), 400 € ; payée plus de 1 490 € HT, 500 € ; offerte, rien ; payée en partie seulement, encore rien.*

**Commande passée après la Journée IA.** Lorsque l'entreprise passe commande dans les 60 jours qui suivent sa Journée IA et que la Société déduit de cette commande les 1 490 € HT de la Journée IA, l'Apporteur conserve ses 500 € en entier (article 4.1 ter).

**Garantie.** La Société vend la Journée IA à ses clients avec la garantie suivante : « Si les gains identifiés dans votre rapport n’atteignent pas 3 fois le prix HT de la journée, vous êtes remboursé sur demande écrite. » (article 47.10 des conditions générales de vente). Les gains sont chiffrés dans le rapport écrit remis sous 10 jours ouvrés ; ils comptent aussi les erreurs, retards et pénalités évités, et jamais les ventes espérées. Le remboursement n'est pas automatique : le client le demande par écrit dans les 30 jours qui suivent la remise du rapport, la Société répond sous 15 jours (sans réponse, la demande est acceptée) et le virement a lieu sous 30 jours après l'acceptation. Cette garantie est un engagement de la Société envers son client ; l'Apporteur ne la présente ni ne la commente (article 8.3). Le remboursement d'une Journée IA à ce titre donne lieu à la reprise de la commission correspondante (article 4.5).

### A1.2 — Formations collectives

*Forfait par formation vendue et payée au prix de référence, réduit au prorata en cas de remise (article 4.1 bis). Une demi-journée est une formation de quatre heures. Lorsqu'une même commande porte plusieurs sessions, la commission est due pour chacune d'elles. Prix par groupe de 2 à 15 participants.*

| Formation | Durée | Prix de référence HT | Commission du présent contrat |
| --- | --- | --- | --- |
| Formation générale | 4 heures | 1 200 € | 250 € |
| Formation générale | 1 jour | 1 900 € | 500 € |
| Formation générale | 2 jours | 3 600 € | 1 000 € |
| Formation par métier | 1 jour | 1 900 € | 500 € |
| Formation par métier | 2 jours | 3 600 € | 1 000 € |
| Formation par secteur | 1 jour | 2 200 € | 500 € |
| Formation par secteur | 2 jours | 3 900 € | 1 000 € |

*Exemple : une formation d'un jour payée 1 520 € HT au lieu de 1 900 € donne 500 € × 1 520 ÷ 1 900 = 400 €.*

### A1.3 — Accompagnement individuel

L'accompagnement individuel (coaching « one to one »), vendu à la séance ou à la journée, ne donne lieu à aucune commission ; il relève de A1.6.

### A1.4 — Audits vendus seuls

**30 % du montant hors taxes facturé** de tout audit vendu seul, quel qu'en soit le palier. Un audit compris dans une Journée IA ou dans une autre prestation ne donne lieu à aucune commission distincte.

*Exemple : un audit vendu seul 2 900 € HT et payé en totalité donne 870 €.*

### A1.5 — Automatisations, intégrations et développements

**15 % du montant hors taxes facturé** : (a) des frais de mise en service ; (b) des ventes en une fois. Une vente en une fois s'entend d'une prestation dont le prix est dû une seule fois, quel que soit l'échelonnement de son paiement. Entrent dans la présente catégorie les automatisations, les intégrations et tout développement effectué par la Société pour l'entreprise.

*Exemples : une mise en service facturée 6 000 € HT et payée en totalité donne 900 €. Une commande de 4 000 € HT de mise en service et de 150 € HT par mois de maintenance donne 600 €, calculés sur les 4 000 € seulement.*

### A1.6 — Sommes et prestations non commissionnées

**Ne donnent lieu à aucune commission, quelles que soient leur périodicité et la durée de l'engagement du client, y compris lorsqu'elles sont payées d'avance pour une période :**

| Sommes | Commission |
| --- | --- |
| Abonnements | **Aucune** |
| Maintenance | **Aucune** |
| Hébergement | **Aucune** |
| Licences | **Aucune** |
| Intervention sur demande | **Aucune** |

**Les prestations qui ne figurent dans aucun des paragraphes A1.1 à A1.5 ne donnent lieu à aucune commission**, sous réserve de A1.8 pour les produits créés après la date de la présente version. Le « coup de projecteur » (podcast, interview, page dédiée) est fourni à titre gratuit et ne donne lieu à aucune commission par construction.

### A1.7 — Compte personnel de formation

Conformément à l'article 8.1, **aucune commission n'est due au titre d'une prestation effectivement financée, en tout ou partie, par le compte personnel de formation**, quelle que soit l'origine du contact. Un tel financement constaté après le versement de la commission donne lieu à sa reprise (article 4.5). **À la date de la présente version, aucune prestation de la présente grille n'est proposée avec ce financement.**

### A1.8 — Produits créés après la signature

**Chaque prestation figurant à la présente annexe conserve la commission que lui attribue le présent contrat tant que la Société la propose.**

Lorsque la Société crée un produit après la signature du présent contrat (palier, prestation ou format), **sa commission est celle que la grille de référence publiée par la Société lui attribue à la date de la vente**, sans avenant. La Société fixe la commission de chaque nouveau produit à sa création et la publie, datée, avant toute vente de ce produit ; elle la motive sur demande de l'Apporteur (article 1164 du code civil). **La commission ainsi publiée n'est jamais rétroactive** : une vente déjà conclue conserve la commission publiée à la date de cette vente. Un produit créé après la signature n'est jamais commissionné sur ses sommes périodiques (A1.6).

Lorsqu'un tel produit est vendu à une entreprise attribuée sans qu'aucune commission n'ait été publiée à la date de la vente, la commission correspondante est portée en attente **sous le libellé « prestation hors grille de commissions »**. **La situation est réglée dans les soixante jours de l'encaissement**, soit par la publication de la commission de ce produit, soit par la constatation écrite que ce produit n'est pas commissionné, portée à la connaissance de l'Apporteur avec son motif. **À défaut de décision de la Société dans ce délai, la commission est due au taux ou au forfait que la grille publiée par la Société portait à la date de la vente.** Aucun taux n'est appliqué par défaut en dehors de ce cas.

**Le retrait d'un produit de l'offre de la Société n'affecte ni les commissions acquises ni les attributions en cours.**

---

## Annexe 1 bis — Fiche des commissions

La fiche des commissions jointe au présent contrat, datée du {{GRILLE_DATE}}, présente sous une forme illustrée la grille de l'annexe 1 et ses exemples. Elle est signée avec le contrat et adressée à l'Apporteur avec l'exemplaire contresigné. **Elle n'ajoute rien à l'annexe 1 et n'en retranche rien : en cas de différence, l'annexe 1 et le contrat s'appliquent seuls (article 17).** Elle n'évolue que par avenant (article 13.1).

---

## Annexe 2 — Mandat donné à la Société aux fins d'autofacturation

**2.1** L'Apporteur donne mandat à la Société d'établir en son nom et pour son compte les factures, factures
complémentaires et avoirs afférents aux commissions et aux sommes de parrainage dues au titre du présent
contrat. Il accepte, par la signature du contrat, de les recevoir sous forme électronique et que chacun de ces
documents soit soumis à la procédure d'acceptation de l'article 2.4. **Ce mandat est exclusivement un mandat de
facturation au sens de l'article 289, I, 2 du code général des impôts, ou de la disposition qui lui succède dans le code des impositions sur les biens et services (CIBS) à compter de son entrée en vigueur. Il est donné PAR l'Apporteur À la
Société, aux seules fins d'établir des factures en son nom ; il n'emporte aucun pouvoir de l'Apporteur de
représenter la Société, ni aucun mandat de la Société à l'Apporteur (article 1.2).**

**2.1 bis** Chaque autofacture est établie le jour de l'encaissement intégral qui rend la commission acquise
ou, à défaut, le premier jour ouvré où la Société le constate (article 5.1) ; elle porte son jour d'établissement
comme date d'émission et la date de l'encaissement intégral comme date de la prestation, est numérotée selon
une séquence chronologique unique et continue, sans rupture, propre à l'Apporteur, et est transmise le même
jour à l'Apporteur par courrier électronique avec un décompte (commande, prix facturé, prix public,
commission, date de l'encaissement). Une autofacture est établie pour chaque encaissement intégral ; lorsque
plusieurs commissions de l'Apporteur deviennent acquises le même jour, une seule autofacture les regroupe.
Elle n'est jamais diminuée d'une reprise : celle-ci est constatée par un avoir d'autofacture, de même
séquence, qui porte la mention « Autofacturation — avoir », fait référence à l'autofacture d'origine (numéro et
date) et indique la commission corrigée et la taxe correspondante (article 4.5).

**2.2** Chaque facture ainsi émise comporte l'ensemble des mentions légales : au titre de l'article L.441-9 du code de commerce, **le taux des
pénalités de retard et l'indemnité forfaitaire de recouvrement de 40 euros mentionnés à l'article 5.3**, la
date d'échéance du règlement (trente jours à compter de l'émission, article 5.3) et les conditions d'escompte (« pas d'escompte pour paiement anticipé ») ;
au titre de l'article 242 nonies A de l'annexe II du code général des impôts, ou de la disposition qui lui succède à compter de son entrée en vigueur,
le numéro d'ordre, la date d'émission et la date de la prestation, la désignation de la prestation (mise en
relation, commande concernée), la quantité et le prix unitaire hors taxes, les numéros SIREN des deux parties et, lorsque l'Apporteur est assujetti, les
numéros de taxe sur la valeur ajoutée des deux parties, ainsi que le taux et le montant de la taxe ou la
mention « TVA non applicable, article 293 B du CGI » ou, à compter de l'entrée en vigueur du code des impositions sur les biens et services (CIBS), la mention correspondante de ce code,
la mention « **Autofacturation** » (14° du même article), et
l'identification complète des deux parties. Ces mentions figurent sur chaque facture, quel que soit le délai
effectif de paiement.

**2.3** L'Apporteur conserve la qualité d'émetteur des factures et en assume les conséquences fiscales. Il
demeure tenu de reverser la taxe sur la valeur ajoutée éventuellement mentionnée. **Lorsque la mention de
la taxe résulte d'une erreur imputable à la Société ou à son système de facturation, celle-ci en fait son
affaire, émet sans délai une facture rectificative et garantit l'Apporteur de toute conséquence.** L'avoir
d'autofacture diminue la taxe mentionnée sur la facture d'origine ; l'Apporteur en tire les conséquences dans
sa déclaration.

**2.4** L'Apporteur dispose d'un délai de trente jours à compter de l'envoi du courrier électronique qui lui
transmet la facture ou l'avoir, ou en signale la mise à disposition dans l'espace en ligne, la date d'envoi
étant journalisée (ou, si le message est retourné en erreur, celle de son renvoi à une adresse valide
communiquée par l'Apporteur), pour la contester ; à défaut, elle est réputée acceptée, **sauf erreur matérielle
ou preuve contraire. Cette acceptation porte sur la forme et les mentions de la facture ; la contestation du
calcul de la commission qu'elle porte obéit à l'article 5.5.** La contestation de la forme ou des mentions
reçoit une réponse motivée dans les trente jours et, si elle est fondée, une facture rectificative faisant
référence à la facture d'origine.

**2.5** Le mandat prend fin en même temps que le contrat, **sous réserve de sa survie pour
les seules commissions restant à acquérir au titre de l'article 12.3 et les reprises de l'article 4.5,
jusqu'à leur extinction complète, sauf
décès de l'Apporteur, ouverture d'une procédure collective à son égard ou cessation de son activité, cas dans
lesquels le mandat prend fin et la dernière phrase du présent article s'applique ; la fin du mandat à l'ouverture d'une procédure
collective n'entraîne pas, à elle seule, la fin du contrat, dont le sort est réglé par l'article 12.5.**
Il peut être dénoncé par écrit par l'une ou l'autre des parties avec un préavis de trente jours. **La fin
du mandat, quelle qu'en soit la cause, ne fait obstacle ni à l'acquisition ni au paiement des commissions :
à compter de cette date, la Société transmet à l'Apporteur — ou, selon le cas, à ses ayants droit ou au
mandataire désigné — le décompte de la commission ou de la reprise, qu'il facture lui-même par une facture
ou un avoir conforme à l'article 2.2, faisant référence, le cas échéant, à l'autofacture d'origine. Le paiement
intervient dans les trente jours de la réception de la facture conforme et au plus tard soixante jours après sa
date d'émission, aux conditions de l'article 5.3 (pénalités et indemnité à compter du lendemain de
l'échéance) ; le délai indicatif de deux jours ouvrés ne s'applique pas. La Société indique, dans un délai
raisonnable, ce qui rend une facture non conforme ; le délai court de la réception de la facture
corrigée.**
`;
