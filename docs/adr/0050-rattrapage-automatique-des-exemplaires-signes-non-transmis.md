# ADR 0050 — Rattrapage AUTOMATIQUE des exemplaires signés non transmis

- **Statut** : **ACCEPTÉ** — renversement d'une décision prise le matin même, confirmé en direct par Will le 2026-09-06
- **Date** : 2026-09-06
- **Auteur** : Claude, à la clôture du dossier SCI Invest Sun
- **Référence** : `src/server/qualiopi/documents/signature/transmission-exemplaire.ts`, `src/server/qualiopi/documents/signature/rattrapage-transmission.ts`, `src/server/queue/workers/qualiopi-formation-crons-worker.ts`, `src/server/queue/queues.ts`, `tests/unit/ci/l-alerte-prescrit-un-geste-qui-existe.spec.ts`, PR #1003, #1008
- **Renverse** : la décision « bouton seul, pas de cron » du 2026-09-06 matin

## Pourquoi cet ADR existe

Une garde de dépôt l'exige nommément. `tests/unit/ci/l-alerte-prescrit-un-geste-qui-existe.spec.ts`
interdisait qu'un cron appelle `transmettreExemplaireSigne`, avec ce message :

> « un cron appelle désormais `transmettreExemplaireSigne` : des exemplaires contractuels
> partiraient vers de vrais signataires sans qu'aucun écran humain s'interpose. **Si c'est
> délibéré, il faut un ADR et l'accord de Will** — pas un import de plus. »

Le présent document est cet ADR. Il n'existe pas pour justifier après coup : il existe
parce qu'une garde a demandé qu'on écrive avant de lever un interdit.

## 1. Ce qui a été décidé le matin, et pourquoi ça change

Le 2026-09-06 au matin, `transmettreExemplaireSigne` venait d'être écrite (#1003) mais
n'avait qu'un seul appelant : le hook de complétion de signature. Toute pièce dont ce
moment était passé restait hors d'atteinte — dont `AXI-DOC-2026-039` (SCI Invest Sun),
contresignée le 04/09 à 21:33, dont l'exemplaire n'est jamais parti.

Face à un choix à trois options, Will a coché **« bouton seul »**. Un bouton
« Relancer la remise » a été livré (#1008), et il a servi le jour même à 13:40 : la
convention est partie à la cliente, le drapeau `exemplaireSigneEnvoyeAt` s'est posé,
l'alerte s'est éteinte.

Ce qui a changé dans la journée, et qui fonde le renversement :

1. **Le bouton existe et fonctionne** — le risque n'est plus « automatiser un mécanisme
   jamais éprouvé », mais « automatiser un geste dont on a vu qu'il marche ».
2. **La chaîne d'envoi est prouvée de bout en bout**, par une PRÉSENCE et non par une
   absence : `piece-exemplaire-signe → beeeditions@gmail.com → Envoyé` dans le journal.
3. **Un bouton suppose que quelqu'un sache qu'il faut cliquer.** C'est précisément ce qui
   a échoué : une pièce complète disparaît de toutes les surfaces de rattrapage
   (`listerPiecesEnAttente` filtre `en_attente | partielle`, `partieARelancer` rend `null`
   dès `signee`). Le défaut se cachait dans son propre succès.

## 2. Ce à quoi Will a consenti — mot pour mot

Le consentement porte sur une FORME, pas sur le principe « automatise ». L'option cochée
disait :

> « Je renverse ma décision de ce matin en connaissance de cause. Un cron remettra
> automatiquement les exemplaires signés dont l'envoi n'a jamais eu lieu — **donc des
> conventions partiront à de vrais clients sans qu'un humain les regarde**. Avec borne
> basse au 01/09 et plafond par passage, ADR à l'appui. **Le bouton reste.** »

Quatre éléments, tous contraignants : **cron**, **borne basse au 2026-09-01**, **plafond
par passage**, **bouton conservé**. S'écarter de l'un d'eux exige de reposer la question.

## 3. La borne basse — et la raison qui n'est PAS la bonne

`SEUIL_RATTRAPAGE = 2026-09-01`. Le cron ne remet que les pièces signées depuis.

🔴 **Attention à la justification.** Une première rédaction disait que les pièces
antérieures sont « d'état inconnu », `exemplaireSigneEnvoyeAt` étant une colonne neuve.
**C'est faux**, et la migration `20260905040000_exemplaire_signe_transmission` l'écrit
exprès :

> « Aucun backfill : toutes les pièces déjà signées passent donc pour non transmises —
> **ce qui est exactement vrai**, et ce que l'alerte `exemplaire_signe_non_transmis` doit
> faire remonter. Les antidater silencieusement effacerait le défaut au lieu de le réparer. »

Ces exemplaires n'ont réellement jamais été remis, puisque le mécanisme n'existait pas.
La borne ne se justifie donc **pas** par une incertitude, mais par ceci :

> Écrire aujourd'hui, sans prévenir, à quelqu'un au sujet d'un contrat signé il y a cinq
> semaines mérite qu'un humain regarde d'abord. Ce n'est pas le même acte que remettre
> sous 24 h une pièce qui vient d'être signée.

⚠️ **Conséquence qu'il faut lire dans le bon sens : le stock antérieur au seuil reste DU
VRAI DÛ.** La borne l'écarte de l'automate, elle ne l'absout pas. Il reste **cliquable**
(le bouton de #1008 le couvre) et **visible** (la règle d'alerte
`exemplaire_signe_non_transmis` n'a délibérément aucune borne basse et continue de le
lister). Quiconque lirait ce seuil comme « ces pièces vont bien » se tromperait.

Le cron compte et journalise ce stock à chaque passage (`ignoreesAvantSeuil`) : c'est le
seul endroit d'où il reste mesurable, et sans ce nombre la borne cacherait exactement ce
qu'elle est censée rendre décidable.

## 4. Le plafond par passage

`PLAFOND_PAR_PASSAGE = 25`. Ce n'est pas une perte, c'est un **débit** : la sélection est
un ÉTAT (`exemplaireSigneEnvoyeAt: null`), pas une fenêtre, donc ce qui déborde d'un
passage est repris au suivant. Il existe pour qu'un défaut de masse — R2 muet une journée,
file d'e-mails bloquée — se rattrape en plusieurs vagues plutôt qu'en une rafale vers des
clients réels.

## 5. La garde est RETOURNÉE, pas supprimée

C'est le point de méthode de cet ADR, et il vaut au-delà de ce cas.

La garde disait « **aucun** cron n'appelle `transmettreExemplaireSigne` ». Une garde qui
interdit tout disparaît le jour où l'interdit est levé — et l'on se retrouve sans aucune
protection au moment précis où le risque devient réel. Elle exige désormais que le cron
qui appelle **porte ses deux bornes** : `SEUIL_RATTRAPAGE` et `PLAFOND_PAR_PASSAGE`.

Une garde qui impose la forme sûre survit au renversement et continue de protéger.

Le commentaire « le geste est manuel, et il doit le rester » est retiré du fichier plutôt
que laissé en place : un commentaire qui ment sur le code est pire qu'un commentaire
absent, parce qu'on le croit.

## 6. Ce que cet ADR ne décide pas

- **Le bouton reste**, et n'est pas déprécié. Le cron couvre ce que personne ne clique ;
  il ne remplace pas le geste délibéré, qui reste le seul moyen d'agir sur le stock
  antérieur au seuil.
- **Rien n'est antidaté.** Aucun backfill n'est introduit ici, et la migration d'origine
  reste la référence sur ce point.
- **Le seuil n'est pas un réglage.** Le déplacer, c'est décider d'écrire à des clients plus
  anciens : cela vaut une nouvelle décision, pas un changement de constante.
