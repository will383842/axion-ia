# ADR 0043 — Produire ≠ immatriculer ≠ remettre : où allouer le numéro de registre ?

- **Statut** : **PROPOSÉ — attend l'arbitrage de Will**
- **Date** : 2026-08-17
- **Auteur** : Claude, en exécutant le Lot 1ter du plan console
- **Référence** : `_PLANS/2026-08-15_PLAN-CONSOLE-PARCOURS-GUIDE.md` §1ter, `src/lib/numbering/allocate.ts`, `src/server/qualiopi/portail/piece-remise.ts` (PR #672)

## Le problème, et pourquoi il bloque un lot entier

Le Lot 1ter §1 demande de **générer automatiquement les six pièces standard à la
création d'une session** — programme, convention, règlement intérieur, livret
d'accueil, questionnaire de positionnement, convocation.

L'objectif est juste, et il est chiffré : **six pièces × ~1 200 sessions/an =
~7 200 clics annuels** qui n'engagent rien et que personne ne fera sans en
oublier. C'est la demande explicite de Will — _« automatiser au maximum pour
éviter les oublis »_.

Le plan justifie l'automatisation par : _« ces pièces n'engagent rien tant
qu'elles ne sont ni signées ni envoyées »_.

**C'est vrai du CONTENU. Ce ne l'est pas de l'IMMATRICULATION.**

## Ce que le code dit, vérifié

- `DocumentGenere.numero` est `String @unique`, **non nullable** : produire une
  pièce **alloue un numéro** de la série légale ;
- `numbering/allocate.ts` grave la règle en tête de fichier — _« un numéro émis
  n'est jamais réattribué »_, art. **242 nonies A ann. II du CGI**, qui exige une
  séquence chronologique **continue et sans réemploi** ;
- une pièce existante ne se **corrige** pas, elle se **RECTIFIE** : motif
  obligatoire et filigrane « COPIE » (`useMotifRectification`).

### Les trois conséquences, si l'on applique le §1 tel quel

| #   | Conséquence                                                                                                                                     | Ordre de grandeur                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | Numéros de la série légale consommés d'avance                                                                                                   | **~7 200 / an**                  |
| 2   | Tout ajustement ultérieur (une date, un formateur, un prix) devient un **acte de rectification tracé**                                          | à chaque modification de session |
| 3   | Chaque session annulée laisse six pièces à **annuler au registre** — on ne les supprime pas, un trou dans la série est ce que le texte interdit | ~6 par annulation                |

La conséquence n° 2 est la plus insidieuse : elle transforme une console qu'on
voulait fluide en une console où **corriger une coquille laisse une trace au
registre**. C'est exactement le défaut D4 que le plan dénonce par ailleurs.

## La doctrine se dédouble

`piece-remise.ts` (PR #672, fusionnée) a séparé **produire** de **remettre**.
Il manque le terme du milieu :

| Acte                                  | Engage quoi         | Régime                    |
| ------------------------------------- | ------------------- | ------------------------- |
| **Produire** un brouillon             | rien                | automatique               |
| **Immatriculer** (numéro de registre) | la **série légale** | au premier usage réel     |
| **Remettre / envoyer / signer**       | l'organisme         | gardé (`piece-remise.ts`) |

## Les options

### A. `numero` devient nullable, immatriculation différée

Un brouillon naît **sans numéro**. Le numéro est alloué au premier usage réel :
remise au bénéficiaire, envoi, ou mise en signature.

- ✅ Une seule table, un seul cycle de vie, la pièce garde son identité.
- ✅ Le registre ne contient que ce qui a existé pour de vrai.
- ⚠️ `numero` nullable oblige à auditer **tous** les lecteurs : un `numero` null
  qui s'affiche « undefined » sur une pièce serait pire que le défaut d'origine.
- ⚠️ L'unicité doit devenir **partielle** (`WHERE numero IS NOT NULL`) — même
  patron que l'index des alertes (T3a) et des habilitations (PR #690).

### B. Les brouillons vivent hors de `documents_generes`

Une table `DocumentBrouillon` distincte, sans numéro. La production
automatique y écrit ; l'immatriculation **déplace** la pièce dans le registre.

- ✅ `documents_generes` reste ce qu'il est : le registre, et rien d'autre.
- ✅ Aucun lecteur existant à auditer.
- ⚠️ Deux tables pour une même notion : le risque de divergence est réel, et le
  dépôt a déjà payé ce prix (la clé R2 recopiée dans sept fichiers).
- ⚠️ Le déplacement est une opération à écrire, avec sa transaction et sa garde.

### C. Ne rien automatiser — statu quo

- ✅ Zéro risque.
- ❌ Les ~7 200 clics annuels restent, et **l'oubli avec eux**. C'est le défaut
  que le lot existe pour fermer.

## Recommandation

**Option A**, pour une raison de fond : une pièce et son brouillon sont **la même
pièce à deux moments**. Les séparer en deux tables oblige à tenir deux vérités
sur un objet qui n'en a qu'une — et c'est toujours celle qu'on oublie de mettre
à jour qui finit par servir.

Le coût de A est un **audit de lecteurs**, borné et mécanisable : un test
statique peut exiger que tout affichage d'un `numero` traite le cas null, sur le
modèle des gardes déjà en place.

## ⛔ Décision attendue

Ceci est une **décision de schéma sur une série à valeur légale**. Elle
n'appartient pas à l'implémentation.

**Tant qu'elle n'est pas prise, le Lot 1ter §1 n'est pas livrable** — et les
§2, §3, §5, §6 du même lot ont été livrés séparément, sans en dépendre.
