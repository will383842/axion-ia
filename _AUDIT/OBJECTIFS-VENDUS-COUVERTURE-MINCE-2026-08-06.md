# Objectifs vendus dont le programme ne livre pas la promesse

**Date** : 2026-08-06
**Origine** : relevé indépendant par les rédacteurs des contenus pédagogiques
**Statut** : ⏳ arbitrage commercial — aucun n'est corrigé, tous sont documentés

---

## Ce dont il s'agit

Chaque formation vend cinq objectifs pédagogiques. Ils sont **publics** (indicateur 1) et
**opposables** : ils figurent au programme remis au client et à l'OPCO, et un auditeur
Qualiopi confronte l'objectif annoncé au contenu réellement dispensé (indicateur 6), puis
à l'évaluation de son atteinte (indicateur 11).

En rédigeant le contenu des seize premières formations, les rédacteurs ont dû rattacher
chaque module à un objectif vendu. Ce rattachement est vérifié par un test : **aucun
objectif ne peut rester découvert**. C'est en cherchant ce rattachement qu'ils ont buté sur
des cas où l'objectif existe, où le rattachement est honnête, mais où le programme n'y
consacre presque rien.

Aucun de ces cas n'est un rattachement de complaisance. Tous sont défendables. Mais **un
client qui achète en lisant cet objectif-là n'aura pas l'atelier qu'il imagine.**

---

## Les cas relevés

| Formation | Objectif vendu | Ce que le programme livre réellement |
|---|---|---|
| **Achats** | « Rédiger un cahier des charges » | Une seule séquence de **10 minutes** (trame de consultation : objet, périmètre, critères, pièces, délai). Produit une amorce, pas un cahier des charges. |
| **BTP** | « Appui au suivi de planning » | **Aucune séquence dédiée.** Couvert obliquement par les écrits qui tiennent le planning (constat de retard, relance de sous-traitant, demande d'avenant). Un client attendant un outil de planification ne l'aura pas. |
| **Santé** | Volet « prise de rendez-vous » de l'objectif écrits | **Aucune séquence dédiée.** Servi par les trames de courriers (confirmation, report). ⚠️ Un planning de rendez-vous nominatif étant une donnée interdite, un atelier plus ambitieux serait de toute façon impossible. |
| **Hôtellerie-restauration** | « Utiliser l'IA en appui à la planification des équipes » | **Aucune séquence ne produit un planning.** Le seul point d'accroche est « plannings nominatifs » dans la liste rouge. Le contenu enseigne la seule forme licite (trame dépersonnalisée, noms rattachés hors outil). |
| **Commerce** | « Appliquer les règles de confidentialité » | Enseigné dans les séquences `cadre`, qui ne portent pas de bloc rédigé. La couverture repose sur un module dont c'est un objectif réel mais **partagé** avec l'assemblage du manuel. |
| **Banque-assurance** | « Courriers et **propositions** » | Le mot « propositions » (commerciales) n'a **aucune séquence dédiée**. Le reste de l'objectif est servi. |
| **Immobilier**, **transport**, autres | *(à compléter selon les rapports restants)* | |

### Un cas inverse, plus intéressant

**Banque-assurance** consacre **105 minutes** — un module entier — à la frontière des usages
interdits (haut risque, décisions non déléguées, droit du client). **Aucun des cinq
objectifs vendus ne nomme cette compétence.** C'est le contraire des cas ci-dessus : la
formation livre plus qu'elle ne vend, et ce qui n'est pas annoncé ne peut pas être évalué
au titre de l'indicateur 11.

Un sixième objectif — « Distinguer les usages autorisés des usages à haut risque » — serait
plus honnête, et rendrait évaluable ce qui est déjà enseigné.

---

## Trois sorties possibles

Pour chaque cas, l'arbitrage est commercial et n'appartient pas au contenu :

1. **Reformuler l'objectif** pour qu'il dise ce que la journée fait réellement. C'est ce qui
   a été retenu le 2026-08-06 pour trois objectifs (choix d'outil ×2, rapprochements
   automatisés). Rapide, sans impact sur le déroulé, aligne la promesse sur la livraison.
2. **Ajouter une séquence** au programme. Tient la promesse telle quelle, mais consomme du
   temps qu'il faut prendre ailleurs — le minutage est exact à la minute sur les 22 fiches.
3. **Retirer l'objectif**, quand il n'apporte rien que les autres ne portent déjà.

⚠️ Toute modification d'un `objectifsFr` change le programme opposable et la page publique.
Les tests de couverture rougiront si un objectif disparaît alors qu'un module s'y rattache :
c'est voulu, ils forcent à mettre le contenu en cohérence dans le même geste.

---

## Ce qui rend ces cas visibles aujourd'hui

Avant le 2026-08-06, rien ne confrontait un objectif vendu au contenu qui le sert : les
programmes n'étaient pas minutés, les modules ne portaient pas de contenu, et le
rattachement objectif ↔ module n'existait pas.

Il existe désormais, il est vérifié à chaque exécution des tests, et
`diagnostiquerFormation` refuse de déclarer publiable une formation dont un objectif reste
découvert. Ces écarts ne sont donc pas apparus — **ils sont devenus visibles.**
