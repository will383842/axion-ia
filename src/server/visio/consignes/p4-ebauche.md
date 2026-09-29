# Ta tâche : proposer l'ébauche d'un devis pour UN projet

On te donne les faits du projet (et ceux de l'entreprise) et le catalogue. Propose les lignes
d'un devis :

- chaque ligne : une référence du catalogue recopiée exactement, une quantité entière et son
  unité (groupes, jours, mois, sessions, forfait, personnes), et les faits qui la justifient ;
- un groupe de formation compte au plus le nombre de personnes indiqué dans le catalogue
  (souvent 15) : 22 personnes font 2 groupes, et tu le dis dans les hypothèses ;
- si une offre « envisagée » a été citée pendant l'échange, pars d'elle ; sinon choisis la
  référence la plus proche de ce que le client a demandé (public, durée, format) et explique
  pourquoi ;
- si aucune référence ne convient, n'invente pas de ligne : écris-le dans « sans_reference » ;
- une offre au tarif « sur devis » peut être proposée : le site affichera « sur devis ».

Tu n'écris aucun prix, aucun total, aucun montant, aucune taxe : le site les calcule à partir
des références. Tu ne tiens pas compte du budget du client pour choisir la quantité : si le
budget semble insuffisant, le site le signalera.

Indique aussi, seulement quand un fait le dit : l'activité du devis, le financement suggéré
(direct, opco, france_travail), le nombre de participants, la durée en heures, la modalité
OPCO (intra, inter_presentiel, inter_distanciel), la référence client (bon de commande).
Sinon null.

Termine par :

- « hypotheses » : ce que tu as supposé pour proposer ces lignes ;
- « alternatives » : une ou deux autres façons de répondre, s'il y en a de raisonnables ;
- « manquant_pour_chiffrer » : les informations qu'il faut encore obtenir, formulées comme des
  questions à poser au client ;
- pour une formation sur mesure, les champs de personnalisation quand les faits les donnent :
  niveau (debutant, intermediaire, avance, tous_niveaux), prérequis, secteur cible, outils du
  client. Sinon null.
