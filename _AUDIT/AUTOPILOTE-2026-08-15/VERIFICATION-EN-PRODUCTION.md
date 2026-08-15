# Vérification en production — ce que la base dit réellement

**Date** : 15/08/2026, ~20h30 · **Méthode** : requêtes **lecture seule** sur la base de production
(`docker exec … psql -At`). Aucune écriture, aucun e-mail, aucune donnée de AXI-SESS-2026-005
modifiée.

> **Ce document est le premier de la série à reposer sur des faits observés et non sur la forme du
> code.** Il confirme certaines conclusions, en réfute d'autres, et sort deux constats opérationnels
> qu'aucune lecture de code ne pouvait produire.

---

## 1. La question qui bloquait #609 — répondue

```
role        | status | n
super_admin | active | 1
```

**Un seul compte actif en production, et il est `super_admin`.** Aucun compte `editor` n'existe.

Deux conséquences :

1. ✅ **#609 ne peut enfermer personne dehors.** Le durcissement ne retire de droits qu'à `editor`,
   rôle que personne ne porte. La réserve « ne pas merger avant la session du 16/08 » **tombe**.
2. ⚠️ **L'exposition était latente, jamais exploitée.** Un `editor` *pouvait* attester, facturer,
   conclure et habiliter — mais aucun `editor` n'a jamais existé. C'est un risque de conception
   fermé avant sa première occasion, pas un incident. La note de la flotte l'avait anticipé, et il
   faut le dire ainsi.

---

## 2. 🔴 Aucune convocation n'a JAMAIS été envoyée

Inventaire complet de `email_logs` (101 lignes, tout l'historique) :

| Gabarit | envoyés | dernier |
|---|--:|---|
| contact-confirmed | 75 | 13/08 |
| formateur-magic-link | 11 | 01/08 |
| qualiopi-alerte-interne | 3 | 15/08 |
| qualiopi-portail-acces | 2 | 15/08 |
| qualiopi-attestation-disponible | 2 | 02/08 |
| devis-envoi | 2 | 29/07 |
| qualiopi-satisfaction-j1 · suivi-j30 · convention-envoi · newsletter · candidature ×2 | 1 chacun | — |

**`qualiopi-convocation` n'apparaît pas. Pas une seule fois.**

Or les PDF de convocation existent bien (4 en base, dont un pour la session de demain,
`AXI-DOC-2026-038`) : **la pièce est produite, l'envoi ne part pas.**

Conséquences constatées :

- **AXI-SESS-2026-003, réalisée le 31/07, 1 inscrit — aucune convocation.** L'obligation de l'ind. 9
  n'a pas été satisfaite sur une action déjà tenue. C'est un écart **consommé**, à consigner tel
  quel — ⚠️ jamais à antidater.
- **AXI-SESS-2026-005, demain 09:00, 1 inscrit — aucune convocation** non plus. Le cron J-5 aurait
  dû se déclencher vers le 11/08.

> Le Lot 0 devait trancher : *« le cron de convocation J-5 réparé par #605 s'est-il réellement
> déclenché ? »*. **Réponse : non — et aucun autre chemin ne l'a fait non plus.** C'est la moitié
> « perdue » de J4, observée, et elle prime largement sur la moitié « doublon » que l'audit
> détaillait.

---

## 3. 🔴 Le positionnement de demain est parti avec le mauvais gabarit, et n'a pas de réponse

Chronologie exacte du 15/08 :

| Heure | Gabarit | Destinataire |
|---|---|---|
| 07:00 | `qualiopi-alerte-interne` | williamsjullin@gmail.com |
| **14:49** | `convention-envoi` | la stagiaire |
| **15:21** | **`qualiopi-portail-acces`** | la stagiaire |
| 17:08 | — | *merge de #607* |

`qualiopi-portail-acces` est **exactement le gabarit que #607 corrige** : celui qui écrit *« Vous
avez demandé un nouveau lien d'accès […] Si vous n'êtes pas à l'origine de cette demande, vous
pouvez ignorer cet email. »*

État du questionnaire : **`positionnement` envoyé le 15/08, `repondu_at` NULL.**

La stagiaire a donc reçu, à 15:21, un message qui l'invitait à ignorer la demande — et elle ne l'a
pas remplie. L'ind. 8 repose là-dessus, et la session est dans quelques heures.

✅ **Le correctif est déjà en production** : le déploiement de #607 s'est terminé avec succès à
17:08. Le gabarit `qualiopi-positionnement` — qui nomme la formation, la date et le délai — est
actif. **Un renvoi ce soir partirait avec le bon texte.**

⚠️ Et si elle ne répond pas : le nouveau gabarit prévoit explicitement le repli honnête — *« Si vous
n'avez pas eu le temps, ce n'est pas bloquant : nous le remplirons ensemble à l'ouverture de la
session. »* Ce qui **ne doit pas** arriver, c'est un positionnement daté d'après la formation.

### Le reste du dossier de demain est en ordre

| Pièce | État |
|---|---|
| Convention `AXI-DOC-2026-032` | ✅ **signée** |
| Convocation `AXI-DOC-2026-038` | générée, **non envoyée** |
| Émargement, programme, règlement intérieur, livret d'accueil | générés le 15/08 |

---

## 4. Deux de mes conclusions sont RÉFUTÉES par les données

### ❌ J3 — le doublon d'attestations n'a jamais eu lieu

Quatre attestations existent pour **la même stagiaire et la même session**. J'y ai d'abord vu la
course décrite par J3. C'est faux, sur deux points :

1. **Les horodatages sont espacés de heures** (02/08 09:00 · 03/08 04:43 · 03/08 20:49 · 04/08
   09:23), pas de millisecondes : ce sont des **rectifications délibérées**, chacune portant son
   motif (« Raison sociale de la cliente corrigée… »).
2. **La chaîne de remplacement est correcte** :

| Pièce | annulée | remplacée par |
|---|---|---|
| AXI-ATT-2026-003 | ✅ | 005 |
| AXI-ATT-2026-004 | — | 005 |
| AXI-ATT-2026-005 | — | 006 |
| AXI-ATT-2026-006 | — | *(courante)* |

La page publique de vérification lit `remplaceeParNumero` et rend **ambre « remplacé par X »** ; seul
006 sort en vert. Aucune pièce périmée n'est certifiée authentique.

> **#610 reste juste, mais c'est une prévention, pas la correction d'un incident.** La course qu'il
> ferme est réelle dans le code ; elle ne s'est jamais produite. Je le dis parce que l'inverse — un
> correctif présenté comme réparant un dégât observé — est exactement le genre d'affirmation que ces
> audits existent pour éliminer.

### ❌ J1 — aucun orphelin de numérotation

Une seule facture a jamais été émise (`AXI-FACT-2026-001`, 550 € HT, `emise`, avec son PDF). Deux
PDF de type facture existent, dont un annulé : un actif ↔ une facture active. **Aucun orphelin.**
La concurrence sur la numérotation n'a jamais été exercée.

---

## 5. 🔑 Le volume réel — et ce qu'il fait aux trois audits

| Entité | Production | Hypothèse de l'audit de scalabilité |
|---|--:|--:|
| Sessions | **3** | ~5 000 |
| Inscriptions | **2** | ~60 000 |
| Clients | **1** | ~500 |
| Formateurs | **1** | ~100 |
| Documents générés | **42** | ~40 000 |
| Factures | **1** | ~10 000 |
| Dossiers de financement | **0** | — |
| Alertes ouvertes | **0** (38 au total, toutes résolues) | ~400 |

**Aucun des défauts de charge n'a d'effet aujourd'hui.** Ils restent réels **en tant que forme de
code** — une liste sans `take` reste une liste sans `take` — mais leur urgence vient **entièrement**
de la cible annoncée (~100 formateurs sous 3-4 mois), jamais de l'état présent.

Cela ne les invalide pas ; cela les **ordonne**. Corriger `listSessionsForAdmin` avant que la base
grossisse est bon marché ; le faire en urgence ce soir n'a aucun fondement.

---

## 6. Trois confirmations empiriques

- ✅ **`dossiers_financement = 0`.** Le dossier de financement est bien **opt-in**, et personne ne
  l'a jamais créé. Tout le suivi OPCO — deux alertes, cockpit — n'a donc jamais eu quoi que ce soit
  à suivre. C'est la confirmation directe du constat central de l'audit du Lot 8.
- ✅ **Les alertes internes partent vers une seule adresse personnelle en dur.** Trois
  `qualiopi-alerte-interne`, toutes vers `williamsjullin@gmail.com`. Le Lot 14 vise juste (à la
  correction de cible près : c'est l'e-mail, pas Telegram).
- 🔴 **Deux `kit_opco` ont été générés pour AXI-SESS-2026-003, dont le financement est `direct`.**
  Une pièce produite sans objet, sur une session qu'aucun OPCO ne finance. C'est la thèse du Lot 16
  — *« le bruit n'est pas neutre : il produit des pièces à annuler »* — attestée par un cas réel.

---

## 7. Ce que Will devrait faire ce soir

Par ordre d'urgence, et **aucun de ces gestes n'est automatisable** — ils engagent tous l'organisme
ou touchent une personne réelle :

1. **Renvoyer le positionnement** à la stagiaire, maintenant que le bon gabarit est déployé. Sinon,
   le remplir **avec elle à l'ouverture** demain — jamais après.
2. **Envoyer la convocation** de AXI-SESS-2026-005 (le PDF `AXI-DOC-2026-038` existe déjà).
3. **Consigner l'écart** de AXI-SESS-2026-003 : convocation jamais envoyée sur une action réalisée.
   Un écart consigné vaut mieux qu'un faux.
4. **#609 peut être mergée** : la réserve est levée par la requête du §1.
