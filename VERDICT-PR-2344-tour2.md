VERDICT: À CORRIGER

# Seconde relecture de la PR #2344 (`feat/apporteurs-presentations-regle-rdv`), après le tour 2

Relu : `git diff origin/main...origin/feat/apporteurs-presentations-regle-rdv` (tête `be5146cf6`), le
premier verdict (`origin/verdict/pr-2344:VERDICT-PR-2344.md`) et le rapport
`.pr/feat-apporteurs-presentations-regle-rdv-tour2.md`.

## Ce qui a été lancé

- `NODE_OPTIONS=--max-old-space-size=12000 pnpm typecheck` : **vert** (exit 0).
- `pnpm vitest run src/features/apporteurs-reseau` : **106 fichiers, 1487 tests verts** (6 todo).
- `pnpm-lock.yaml` : identique à `origin/main`.
- Mutations, une à une, fichier restauré après chacune (`git status` propre à la fin) :

| #   | Mutation                                                                    | Résultat               |
| --- | --------------------------------------------------------------------------- | ---------------------- |
| M1  | `termeApresBascule` rend toujours le terme normal                           | 2 tests rouges ✅      |
| M2  | `jobId` de l'alerte de lot sans l'empreinte des ids                         | 2 tests rouges ✅      |
| M3  | erreur non-P2002 relancée au lieu d'être comptée                            | 1 test rouge ✅        |
| M4  | `annoncerBascule` jamais appelée                                            | 1 test rouge ✅        |
| M7  | jour de la clé en UTC au lieu de Paris                                      | 1 test rouge ✅        |
| M8  | délai minimal 29 jours au lieu de 30                                        | 2 tests rouges ✅      |
| M5  | **clause transitoire retirée de l'article 13.5**                            | **0 test rouge** ❌ (222 fichiers de `src/features/apporteurs-reseau` + `src/content`) |
| M6  | `dejaEnvoye` retiré de `annoncerBascule`                                    | 0 test rouge (garde redondante, cf. constat 6) |

## Suivi des constats du premier verdict

| Constat                        | État                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Contradiction avec l'art. 13.5 | **Corrigé sur le texte**, `CONTRAT_VERSION` reste `"2.8"`, et le texte est cohérent avec l'article 3.2 (règle du premier rendez-vous, numérotation juste). **Mais le critère du code est la version et non le texte signé** : voir constat 1 ci-dessous.                                                     |
| 2. Termes courts                | **Corrigé dans le principe** (`termeApresBascule` = max(fin du 60e jour, bascule + 30 j), au moins 30 jours). **Mais le dernier jour est tronqué à l'heure du passage** : voir constat 2.                                                                                                                 |
| 3. Apporteur non informé        | **Corrigé** : un e-mail par présentation (clé `apporteur-bascule-regle-<id>`), sans `gabaritRepli`, aucun prix ni barème (gabarit inscrit dans la liste anti-barème de `remuneration-indicative.spec.ts`). Texte : constats 3 et 4.                                                                         |
| 4. Alerte de lot dédoublonnée   | **Corrigé** : clé `apporteur-bascule-lot-<jour Paris>-<sha256 des ids triés, 12 car.>`. Idempotente pour un même lot, distincte pour un autre lot du même jour. Tests mordants (M2, M7).                                                                                                                  |
| 5. Une erreur bloque tout       | **Corrigé** : erreur comptée dans `bilan.erreurs`, signalée, la boucle continue. Test mordant (M3).                                                                                                                                                                                                           |
| 6. Tests manquants              | **Corrigé en partie** : les nouveaux tests mordent (M1, M2, M3, M4, M7, M8). Rien ne fige la clause du contrat (M5).                                                                                                                                                                                           |

## Constats

### 1. 🔴 BLOQUANT : la bascule porte sur la version et non sur le texte signé, alors que ce texte vient de changer sans changement de version

- **Code** : `src/features/apporteurs-reseau/regle-attribution.ts:124` (`versionAuMoins(e.apporteur.signature, "2.8")`).
  **Contrat** : `src/features/apporteurs-reseau/contrat-v2.ts:667` (clause ajoutée dans 13.5, version restée `2.8`).
- La signature archive le texte signé et son empreinte (`signature.ts:193`, `verification.ts:347`). Le contrat
  le dit lui-même (l. 808-810) : « Le texte signé est figé : toute modification en change l'empreinte. »
  Un apporteur qui a signé la 2.8 **avant** cette PR a signé un 13.5 **sans** l'exception. Son
  `signature.version` vaut pourtant `"2.8"`, et le code fait basculer ses présentations, ce qui est
  exactement la contradiction du constat 1 du premier verdict.
- **Ce n'est pas seulement une question d'état actuel de la prod** (le rapport du tour 2 demande au pilote
  de vérifier qu'aucun apporteur n'a signé la 2.8). Après la fusion, l'**app** continue de servir l'ancien
  texte 2.8 jusqu'au prochain créneau de mise en ligne, plus la durée du build (AGENTS.md). Pendant ce
  temps, un apporteur peut signer le 13.5 sans l'exception, avec la version `"2.8"`. Le passage quotidien
  tourne dans le **worker**, qui peut être sur ce commit avant l'app. La vérification doit aussi porter
  sur les dossiers `a_verifier` : une contresignature ultérieure les rend `signe` avec l'ancien texte.
- **Correctif** (au choix) :
  - (a) dans `basculeVersRendezVous`, exiger que le texte signé archivé (`signatureApporteur.texte`)
    contienne la clause, par exemple le marqueur « Par exception, les présentations encore en attente
    d'attribution ». Sans texte archivé, ou sans la clause : `motif: "version"`, pas de bascule. Ajouter un
    test « 2.8 signée sans la clause → pas de bascule » ;
  - (b) publier la clause sous une version `2.9`, faire basculer à partir de `2.9` et faire signer un
    avenant ;
  - (c) au minimum, rendre la vérification du pilote **datée et écrite** (aucune signature 2.8, `signe` ni
    `a_verifier`, avant la mise en ligne de l'app qui porte la clause) et laisser l'interrupteur
    `APPORTEURS_VALIDATION_RDV` éteint jusqu'à cette mise en ligne. C'est fragile, car rien ne l'impose
    dans le code.

  (a) est le plus sûr, et le seul qui ne dépend pas d'une vérification humaine.

### 2. 🟠 IMPORTANT (argent) : le terme « au moins 30 jours » s'arrête à l'heure du passage, et l'e-mail annonce le jour entier

- **Code** : `src/features/apporteurs-reseau/regle-attribution.ts:88`,
  `minimal = maintenant + 30 × 86 400 000 ms`. Le test le fige : `bascule-ancienne-regle-vers-rendez-vous.spec.ts:370`
  et `:395` (`j(VINGT_SIX, 30)`, avec `VINGT_SIX = 2026-11-26T08:00Z`).
- **Scénario** : bascule au passage du 26/11 à 9 h, heure de Paris. Terme enregistré : 26/12/2026 à 9 h.
  L'e-mail (`dateEnClair`) dit « au plus tard le 26 décembre 2026 ». Un rendez-vous pris le 26/12 à 14 h
  est postérieur à `reserveeJusquAt` : `reservationOccupe` (`regle-attribution.ts:196`, `pris > reserveeJusquAt`)
  ne le retient pas, et la réservation prend fin. L'apporteur perd l'attribution alors qu'il a respecté
  la date écrite. Le terme normal, lui, est bien « fin du jour, heure de Paris » (`finDuNiemeJourParis`).
  Il y a donc deux conventions dans la même fonction.
- **Correctif** : `minimal = finDuNiemeJourParis(maintenant, DELAI_MINIMAL_BASCULE_JOURS + 1)`, ce qui
  donne la fin du 30e jour qui suit la bascule à 23 h 59 59,999 à Paris, ou tout autre calcul qui finit le
  jour annoncé à minuit, heure de Paris. Remplacer `j(VINGT_SIX, 30)` dans les deux tests par
  `2026-12-26T22:59:59.999Z`, et ajouter un test : rendez-vous pris le dernier jour annoncé, à 20 h, heure
  de Paris → retenu.

### 3. 🟡 MOYEN (texte de l'e-mail) : « est à nous signaler » présente comme une obligation ce que l'article 3.2 exclut

- **Fichier** : `src/lib/email/templates/apporteur-presentation-regle-rendez-vous.tsx:42`.
- L'article 3.2 (Rattachement) : « L'Apporteur peut, s'il le souhaite, lui signaler un rendez-vous par
  tout moyen ; **il n'y est jamais tenu** et l'absence de signalement ne le prive d'aucun droit. »
  Par ailleurs, un rendez-vous pris **avant la déclaration** ne compte pas, et la phrase ne le précise pas.
- **Correctif proposé** : « Si un rendez-vous a déjà été pris avec cette entreprise depuis votre
  présentation, vous pouvez nous le signaler en répondant à ce message ; vous n'y êtes pas tenu. »

### 4. 🟡 MOYEN (texte de l'e-mail) : la validation par la commande est omise, et la phrase de fin est donc inexacte

- **Fichier** : `apporteur-presentation-regle-rendez-vous.tsx:36-41`.
- L'article 3.2 prévoit aussi la validation par la **commande** signée pendant la réservation. L'e-mail
  écrit : « Passé cette date sans rendez-vous pris, la réservation prend fin. » C'est faux si une commande
  a été signée. Le commentaire de l'étape (`passage-quotidien.ts`, « règle du 1er rendez-vous tenu ou du
  devis signé ») le reconnaît.
- **Correctif** : « … elle est validée à votre nom dès qu'un premier rendez-vous avec Axion-IA a eu lieu,
  ou dès qu'une commande est signée. » et « Passé cette date sans rendez-vous pris ni commande signée,
  la réservation prend fin. » Détail de forme : « Votre présentation de Acme » devient « Votre présentation
  d'Acme » quand le nom commence par une voyelle. Une formulation sans élision évite le problème :
  « Votre présentation de l'entreprise Acme ».

### 5. 🟡 MOYEN : l'information promise par le contrat n'est pas garantie

- **Fichiers** : `src/features/apporteurs-reseau/attribution-annonce.ts:132` et l'appel à
  `passage-quotidien.ts:690`.
- La clause écrit « il en est informé par courrier électronique ». Or :
  - (i) sans adresse déchiffrable, `annoncerBascule` rend `false` sans rien signaler ;
  - (ii) une erreur d'`envoyer` n'est que journalisée (`signalerErreurReseau`) ;
  - (iii) si le processus s'arrête entre la transaction et l'envoi, le passage suivant voit la ligne de
    réservation et ne renvoie jamais l'e-mail.

  Dans les trois cas, la bascule est acquise et l'apporteur n'a rien reçu.
- **Correctif** : si `annoncerBascule` rend `false` alors que la clé n'était pas déjà envoyée, émettre
  une alerte interne par présentation (`jobId: apporteur-bascule-email-non-parti-<id>`), « e-mail de
  bascule non parti, à prévenir à la main ». Pour (iii), une reprise au passage suivant : relancer
  `annoncerBascule` pour les lignes portant l'`activityLog` `apporteur.presentation_basculee_rendez_vous`.
  Sa clé idempotente le permet sans doublon.

### 6. 🟢 MINEUR : tests et commentaires

- **Aucun test ne fige la clause transitoire** (mutation M5 survivante). Ajouter dans
  `contrat-2-8-reservation-validation-argent.spec.ts` une assertion sur la présence de l'exception de 13.5
  et sur le délai « au moins trente jours ». Ce test doit lier le délai écrit à
  `DELAI_MINIMAL_BASCULE_JOURS`, comme le dépôt le fait ailleurs pour la parité contrat/code.
- `passage-quotidien.ts:542` : le commentaire « terme = fin du 60e jour depuis la saisie » est périmé.
  Remplacer par « terme = `termeApresBascule` : au moins 30 jours après la bascule ».
- `dejaEnvoye` dans `annoncerBascule` n'est pas testé (M6). C'est sans conséquence aujourd'hui, car une
  seconde bascule de la même présentation est impossible (ligne de réservation), mais le test « une fois
  par présentation » ne vérifie qu'un passage. Le rejouer sur deux passages, ou retirer la promesse du
  nom du test.

### 7. ℹ️ Écart favorable, à connaître (pas de correctif exigé)

La clause dit que les présentations en attente « le jour où l'Apporteur accepte » passent à la nouvelle
règle. Le code ne bascule que lorsque l'interrupteur est allumé, et jamais une présentation dont le
silence est déjà atteint. Entre l'acceptation et la bascule, une présentation peut donc encore être
confirmée par le silence. C'est plus favorable à l'apporteur que le texte, donc sans risque juridique.
Mais le texte et le comportement ne disent pas la même chose. Autre point : le contrat définit la prise
d'effet comme la date de **notification de l'enregistrement** de l'acceptation, tandis que la clause dit
« le jour où l'Apporteur accepte ». Le délai de 30 jours court en pratique depuis la bascule, qui est
toujours postérieure, donc sans perte pour l'apporteur.

## Ce qu'il faut pour passer à BON

1. Constat 1 : conditionner la bascule au texte signé qui contient la clause (a), ou passer en 2.9 (b).
2. Constat 2 : terme minimal à la fin du jour annoncé, heure de Paris, avec ses tests.
3. Constats 3 et 4 : corriger le texte de l'e-mail, puis le faire relire par Will.
4. Constats 5 et 6 : recommandés dans la même PR.

## Texte complet de l'e-mail `apporteur-presentation-regle-rendez-vous`, pour relecture par Will

Rendu réel du gabarit (`@react-email/render`, `plainText`), sur la branche à `be5146cf6`, avec la
charge : `contactName: "Paul Martin"`, `entreprise: "Acme"`, `dateLimite: "8 janvier 2027"`. Recopié
mot pour mot :

**Objet** : Nouvelle règle : Acme

**Texte d'aperçu (préheader, non affiché dans le corps)** : Elle est désormais validée au premier rendez-vous tenu.

**Corps** :

```
https://axion-ia.com

Le partenaire IA de bout en bout des PME


LA RÈGLE DE VALIDATION CHANGE POUR CETTE ENTREPRISE

Bonjour Paul,

Votre présentation de Acme était en attente. Depuis l'acceptation de la version 2.8 de votre contrat, elle suit la règle du premier rendez-vous tenu (article 3.2) : elle est validée à votre nom dès qu'un premier rendez-vous avec Axion-IA a eu lieu.

Pour cela, ce rendez-vous doit être pris au plus tard le 8 janvier 2027. Passé cette date sans rendez-vous pris, la réservation prend fin.

Un rendez-vous déjà pris avec cette entreprise est à nous signaler en répondant à ce message.

Une question ? Répondez simplement à cet e-mail — il arrive directement chez nous, et c'est un humain qui lit.

Williams Jullin
Fondateur & CEO · Axion-IA
LinkedIn https://www.linkedin.com/in/williamsjullin/

AXION IA SAS · SAS française
11 Avenue Paul Verlaine, ELITE BUREAUX - boîte 53, 38100 Grenoble, France
SIREN 108018631 · TVA FR51108018631 · NDA 84381100438
Cet enregistrement ne vaut pas agrément de l'État.
Contact : contact@axion-ia.com
© 2026 AXION IA SAS — Tous droits réservés.
```

Variante du paragraphe de date, quand `dateLimite` est vide (texte source,
`apporteur-presentation-regle-rendez-vous.tsx:38-41`) : « Pour cela, ce rendez-vous doit être pris dans
les trente jours. Passé ce délai sans rendez-vous pris, la réservation prend fin. »
Objet si l'entreprise est vide : « Nouvelle règle : votre présentation ».
