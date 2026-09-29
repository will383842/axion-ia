# Ta tâche : extraire les faits de cet échange

Tu lis la transcription d'un rendez-vous et tu produis, au format imposé :

- nature_echange : échange complet, partiel (des sujets manquent), interrompu (coupé avant la
  fin), pas un rendez-vous client (conversation personnelle, entretien d'embauche, échange avec
  un apporteur, test), ou inexploitable (transcription incompréhensible). Une phrase
  d'explication.
- consentement : la phrase par laquelle la ou les personnes côté client acceptent
  l'enregistrement, si elle est dans les deux premières minutes ; sinon null.
- demande_arret_enregistrement : la phrase par laquelle quelqu'un demande d'arrêter ou refuse
  l'enregistrement, où qu'elle soit ; sinon null. Si elle existe, tu n'extrais aucun fait des
  segments qui la suivent.
- participants : chaque étiquette de la transcription (AXION, CLIENT_1…) et la personne qu'elle
  représente si on peut l'établir (présentation, prénom utilisé), sinon null. Si la
  transcription semble attribuer à CLIENT_1 les paroles de deux personnes différentes, dis-le
  dans nature_echange.explication.
- personnes : toutes les personnes dont on parle, présentes ou non (« mon associé », « le DG »),
  avec ce qui est dit de leur fonction et de leur statut (partie de l'entreprise, arrivée
  récemment). Si c'est une personne déjà connue (liste « contacts connus »), indique sa
  référence C… ; en cas de doute, laisse null.
- projets_evoques : chaque projet distinct dont on parle. Deux sujets sont deux projets quand
  ils n'auraient pas le même devis (une formation des commerciaux et un audit de la
  comptabilité). Plusieurs modules d'une même formation restent un seul projet. Si c'est un
  projet déjà connu (liste « projets connus »), indique sa référence PRJ-… ; en cas de doute,
  laisse null.
- faits : tous les faits utiles, un fait = une information. Sois complet : une information
  utile non extraite est perdue pour le devis. Pour chaque fait :
  · type et clé (voir la table) ; « global » pour un type à valeur unique ;
  · enonce : une phrase autonome et neutre (« La gérante veut former les 12 commerciaux »),
  compréhensible sans la citation ;
  · valeur : les champs typés qui s'appliquent, null pour les autres. Montants en centimes
  d'euro (3 000 € → 300000). « Entre 3 et 4 000 » → min 300000, max 400000 ; un montant
  unique → min = max. base_montant « ht » ou « ttc » seulement si c'est dit, sinon
  « non_precise ». Pour une date, recopie l'expression exacte dans expression_temporelle
  et calcule date_cible à partir de la date de l'échange ;
  « avant le 15 décembre » → date_cible 15/12, precision_date « avant_le ». ref_catalogue
  seulement si une offre du catalogue est clairement désignée ;
  · certitude, confiance (haute : dit clairement ; moyenne : formulation vague ou mot mal
  transcrit ; faible : il faut interpréter) ;
  · locuteur_declare, preuves, confirmation_client (voir la règle 4) ;
  · portee et projet_ref : « entreprise » (projet_ref null) pour ce qui est vrai pour toute
  l'entreprise (activité, effectif, outils généraux, décideur général) ; sinon « projet »
  et la référence J… du projet évoqué. Si tu ne sais pas à quel projet un fait appartient,
  mets portee « projet », projet_ref null, et explique-le dans ambiguite ;
  · personne_sujet_ref : la personne dont parle le fait (le décideur désigné, celle qui a pris
  l'engagement), pas forcément celle qui parle ;
  · ambiguite : ce qui reste incertain, sinon null.
  Deux montants de budget différents donnent deux faits, même s'ils se contredisent : tu ne
  choisis pas, tu ne fais pas de moyenne.
  Un engagement (« je vous envoie le devis vendredi ») précise qui, quoi et pour quand.
  Une question ouverte est une question posée pendant l'appel restée sans réponse, ou une
  information que quelqu'un a dit devoir vérifier (« je dois voir avec la direction »).
  Un prix ou une condition commerciale annoncée par Williams (« la journée est à 1 900 euros »,
  « je peux vous faire un geste ») est un fait prix_annonce_axion ou engagement_axion.
- suivi_du_connu : pour chaque engagement ou question déjà connu (H…) dont on reparle
  aujourd'hui, son statut (tenu, répondu, en cours, abandonné) et la preuve du jour. Tu ne
  cites jamais une référence H… comme preuve : la preuve est toujours un segment du jour.
- couverture : pour chacune des 12 rubriques, « aborde » (au moins un fait),
  « evoque_sans_precision » (le sujet a été effleuré sans rien de précis : « le budget, on
  verra »), ou « non_aborde », avec la liste des faits correspondants. N'invente pas de fait
  pour remplir une rubrique.
- passages_ecartes : les segments contenant une information sensible ou une appréciation d'une
  personne (règle 7), avec seulement le motif.

Ce qu'un bon résultat évite : recopier les informations déjà connues comme si elles avaient été
redites ; transformer une hypothèse de Williams en fait du client ; mettre dans le projet
« formation » un budget dit pour l'audit ; donner une date précise quand le client a dit « au
printemps » (precision_date « trimestre ») ; résumer une citation au lieu de la recopier.
